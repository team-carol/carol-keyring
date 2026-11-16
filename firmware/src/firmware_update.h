#pragma once

#include <esp_ota_ops.h>
#include <stddef.h>
#include <stdint.h>

#include "transfer.h"

// 웹이 펌웨어 파일(.bin)에서 버전과 빌드 환경을 찾아 잘못된 파일을 거르는 표시.
// 형식: "CAROL-KEYRING-FW|<버전>|<빌드 환경>|"
extern "C" const char kFirmwareTag[];

// BLE 로 받은 펌웨어를 쓰지 않는 쪽 OTA 파티션에 바로 쓴다 (RAM 에 다 담기에는 크다).
// 화면 프레임 전송(Transfer)과 같은 방식: BEGIN(길이, CRC) → offset 순서대로 조각 → COMMIT.
// 전원이 중간에 꺼져도 부팅 파티션은 COMMIT 이 성공해야 바뀌므로 기존 펌웨어로 켜진다.
class FirmwareUpdate {
 public:
  // 받을 수 있는 최대 크기 (다음 OTA 파티션 크기). 0 이면 업데이트할 수 없다.
  static size_t maxLength();

  bool receiving() const { return state_ == TransferState::kReceiving; }
  uint32_t length() const { return length_; }

  TransferStatus begin(uint32_t length, uint32_t crc);
  TransferStatus write(uint32_t offset, const uint8_t* data, size_t len);
  // CRC 와 이미지를 검증하고 부팅 파티션을 바꾼다. 성공하면 REBOOTING 을 돌려주고,
  // 재부팅은 알림을 보낸 뒤 호출한 쪽이 한다.
  TransferStatus commit();
  TransferStatus abort();

 private:
  TransferStatus fail(TransferError error, uint32_t value);
  void release();

  const esp_partition_t* partition_ = nullptr;
  esp_ota_handle_t handle_ = 0;
  TransferState state_ = TransferState::kIdle;
  uint32_t length_ = 0;
  uint32_t expectedCrc_ = 0;
  uint32_t crcState_ = 0;
  uint32_t received_ = 0;
};

// 새 펌웨어로 처음 켜졌을 때의 확인. 부트로더는 확인되지 않은 펌웨어가 재부팅되면 이전 펌웨어로 돌아간다.
namespace rollback {

// setup() 맨 앞에서 부른다. 새 펌웨어로 처음 켜진 것이면 제한 시간 안에 markHealthy() 가
// 불리지 않을 때 스스로 이전 펌웨어로 되돌리고 재부팅한다.
void beginCheck();
// BLE 광고까지 정상으로 올라오면 부른다.
void markHealthy();

}  // namespace rollback
