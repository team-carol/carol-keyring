#include "firmware_update.h"

#include <Arduino.h>
#include <freertos/timers.h>

#include "config.h"
#include "crc32.h"

extern "C" const char kFirmwareTag[] = "CAROL-KEYRING-FW|" FW_VERSION "|" FW_ENV "|";

namespace {

// 이보다 작은 파일은 펌웨어일 수 없다 (이미지 헤더 + 세그먼트 몇 개).
constexpr uint32_t kMinImageBytes = 4096;

}  // namespace

size_t FirmwareUpdate::maxLength() {
  const esp_partition_t* next = esp_ota_get_next_update_partition(nullptr);
  return next != nullptr ? next->size : 0;
}

TransferStatus FirmwareUpdate::begin(uint32_t length, uint32_t crc) {
  // 받던 중에 다시 BEGIN 이 오면 처음부터 다시 받는다.
  if (state_ == TransferState::kReceiving) release();

  partition_ = esp_ota_get_next_update_partition(nullptr);
  if (partition_ == nullptr) return fail(TransferError::kFlash, ESP_ERR_NOT_FOUND);
  if (length < kMinImageBytes || length > partition_->size) {
    return fail(TransferError::kBadLength, partition_->size);
  }

  // 순차 쓰기 모드는 파티션 전체를 미리 지우지 않고 쓰는 만큼만 지운다.
  // 미리 지우면 BEGIN 응답이 수 초 늦어진다.
  const esp_err_t err = esp_ota_begin(partition_, OTA_WITH_SEQUENTIAL_WRITES, &handle_);
  if (err != ESP_OK) return fail(TransferError::kFlash, static_cast<uint32_t>(err));

  Serial.printf("[ota] begin %lu bytes -> %s\n", static_cast<unsigned long>(length),
                partition_->label);
  length_ = length;
  expectedCrc_ = crc;
  crcState_ = kCrc32Init;
  received_ = 0;
  state_ = TransferState::kReceiving;
  return {state_, TransferError::kNone, 0};
}

TransferStatus FirmwareUpdate::write(uint32_t offset, const uint8_t* data, size_t len) {
  if (state_ != TransferState::kReceiving) return fail(TransferError::kNotReceiving, 0);
  if (offset != received_) {
    // 수신 상태는 유지해서 웹이 기대 offset 부터 다시 보낼 수 있게 한다.
    return {TransferState::kError, TransferError::kBadOffset, received_};
  }
  if (len > length_ - received_) return fail(TransferError::kBadLength, length_);

  // 첫 조각이면 esp_ota_write 가 이미지 매직 바이트(0xE9)도 확인한다.
  const esp_err_t err = esp_ota_write(handle_, data, len);
  if (err != ESP_OK) return fail(TransferError::kFlash, static_cast<uint32_t>(err));

  crcState_ = crc32Update(crcState_, data, len);
  received_ += len;
  return {state_, TransferError::kNone, received_};
}

TransferStatus FirmwareUpdate::commit() {
  if (state_ != TransferState::kReceiving) return fail(TransferError::kNotReceiving, 0);
  if (received_ != length_) return fail(TransferError::kIncomplete, received_);

  const uint32_t actual = crc32Final(crcState_);
  if (actual != expectedCrc_) return fail(TransferError::kCrcMismatch, actual);

  // esp_ota_end 는 이미지 구조와 이미지에 붙은 SHA-256 을 검증한다.
  esp_err_t err = esp_ota_end(handle_);
  handle_ = 0;
  if (err != ESP_OK) {
    state_ = TransferState::kIdle;
    return {TransferState::kError, TransferError::kFlash, static_cast<uint32_t>(err)};
  }
  err = esp_ota_set_boot_partition(partition_);
  if (err != ESP_OK) {
    state_ = TransferState::kIdle;
    return {TransferState::kError, TransferError::kFlash, static_cast<uint32_t>(err)};
  }

  Serial.printf("[ota] verified, next boot from %s\n", partition_->label);
  state_ = TransferState::kRebooting;
  return {state_, TransferError::kNone, 0};
}

TransferStatus FirmwareUpdate::abort() {
  if (state_ == TransferState::kReceiving) {
    Serial.println("[ota] aborted");
    release();
  }
  return {TransferState::kIdle, TransferError::kNone, 0};
}

TransferStatus FirmwareUpdate::fail(TransferError error, uint32_t value) {
  if (state_ == TransferState::kReceiving) release();
  Serial.printf("[ota] error %u value 0x%lx\n", static_cast<unsigned>(error),
                static_cast<unsigned long>(value));
  return {TransferState::kError, error, value};
}

void FirmwareUpdate::release() {
  if (handle_ != 0) esp_ota_abort(handle_);
  handle_ = 0;
  received_ = 0;
  state_ = TransferState::kIdle;
}

// ---- 롤백 ----

// Arduino 는 기본으로 부팅하자마자 새 펌웨어를 "정상" 으로 표시한다.
// 그러면 롤백이 동작하지 않으므로, BLE 까지 올라온 뒤 직접 표시하도록 미룬다.
extern "C" bool verifyRollbackLater() { return true; }

namespace rollback {
namespace {

// 이 시간 안에 BLE 까지 올라오지 않으면 새 펌웨어가 잘못된 것으로 본다.
constexpr uint32_t kHealthyDeadlineMs = 30000;

TimerHandle_t deadline = nullptr;

bool pendingVerify() {
  esp_ota_img_states_t state;
  return esp_ota_get_state_partition(esp_ota_get_running_partition(), &state) == ESP_OK &&
         state == ESP_OTA_IMG_PENDING_VERIFY;
}

void onDeadline(TimerHandle_t) {
  if (!pendingVerify()) return;
  Serial.println("[ota] new firmware did not become healthy, rolling back");
  esp_ota_mark_app_invalid_rollback_and_reboot();
}

}  // namespace

void beginCheck() {
  const esp_partition_t* running = esp_ota_get_running_partition();
  Serial.printf("[ota] running from %s%s\n", running->label,
                pendingVerify() ? " (new, waiting for health check)" : "");
  if (!pendingVerify()) return;
  deadline = xTimerCreate("rollback", pdMS_TO_TICKS(kHealthyDeadlineMs), pdFALSE, nullptr,
                          onDeadline);
  if (deadline != nullptr) xTimerStart(deadline, 0);
}

void markHealthy() {
  if (!pendingVerify()) return;
  if (deadline != nullptr) xTimerStop(deadline, 0);
  esp_ota_mark_app_valid_cancel_rollback();
  Serial.println("[ota] new firmware marked healthy");
}

}  // namespace rollback
