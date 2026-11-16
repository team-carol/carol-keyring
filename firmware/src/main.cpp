#include <Arduino.h>

#include <memory>

#include "ble_service.h"
#include "config.h"
#include "device_name.h"
#include "display/display.h"
#include "firmware_update.h"
#include "transfer.h"

static Display* display = nullptr;
static std::unique_ptr<Transfer> transfer;
static std::unique_ptr<FirmwareUpdate> update;
static std::unique_ptr<BleService> ble;
static TaskHandle_t workerTask = nullptr;

// 워커 태스크에 보내는 알림 비트
static constexpr uint32_t kWorkFrameReady = 1u << 0;
static constexpr uint32_t kWorkReboot = 1u << 1;

// REBOOTING 알림이 폰까지 가도록 재부팅 전에 잠깐 기다린다.
static constexpr uint32_t kRebootDelayMs = 500;

static void refreshDisplay() {
  if (!transfer->frameReady()) return;

  const uint32_t started = millis();
  const bool ok = display->draw(transfer->frame());
  const uint32_t elapsed = millis() - started;

  if (ok) {
    Serial.printf("[display] refreshed in %lu ms\n", static_cast<unsigned long>(elapsed));
    ble->notifyStatus(transfer->markDone());
  } else {
    Serial.printf("[display] panel timeout after %lu ms\n", static_cast<unsigned long>(elapsed));
    ble->notifyStatus(transfer->markFailed(TransferError::kPanelTimeout, elapsed));
  }
  // 스택 크기를 실측으로 맞추기 위한 기록. ESP-IDF 에서는 단위가 바이트다.
  Serial.printf("[worker] stack headroom %u bytes\n",
                static_cast<unsigned>(uxTaskGetStackHighWaterMark(nullptr)));
}

// 화면 갱신(수십 초)과 재부팅은 BLE 콜백이 아니라 이 태스크에서 한다.
// BLE 태스크가 알림 비트로 깨운다.
static void runWorkerTask(void*) {
  for (;;) {
    uint32_t work = 0;
    xTaskNotifyWait(0, UINT32_MAX, &work, portMAX_DELAY);
    if (work & kWorkReboot) {
      Serial.println("[ota] rebooting into new firmware");
      delay(kRebootDelayMs);
      esp_restart();
    }
    if (work & kWorkFrameReady) refreshDisplay();
  }
}

void setup() {
  Serial.begin(115200);
  // 폰에 꽂히면 시리얼을 읽는 쪽이 없으므로 출력 때문에 멈추지 않게 한다.
  Serial.setTxTimeoutMs(0);

  rollback::beginCheck();

  display = &createDisplay();
  const PanelInfo& panel = display->info();
  Serial.printf("[boot] %s, panel %s %ux%u %s, frame %u bytes\n", kFirmwareTag, panel.id,
                panel.width, panel.height, pixelFormatName(panel.format),
                static_cast<unsigned>(frameBytes(panel)));

  if (!display->begin()) Serial.println("[boot] display begin failed");

  transfer.reset(new Transfer(frameBytes(panel)));
  update.reset(new FirmwareUpdate());

  // BLE 가 일을 넘기기 전에 태스크가 있어야 하므로 BLE 보다 먼저 만든다.
  if (xTaskCreate(runWorkerTask, "worker", config::kWorkerTaskStackBytes, nullptr,
                  config::kWorkerTaskPriority, &workerTask) != pdPASS) {
    Serial.println("[boot] worker task create failed");
  }

  ble.reset(new BleService(*transfer, *update, panel));
  ble->setFrameReadyHandler([] {
    if (workerTask != nullptr) xTaskNotify(workerTask, kWorkFrameReady, eSetBits);
  });
  ble->setRebootHandler([] {
    if (workerTask != nullptr) xTaskNotify(workerTask, kWorkReboot, eSetBits);
  });
  ble->begin();
  Serial.printf("[boot] ble name %s\n", deviceName().c_str());

  // BLE 광고까지 올라왔으면 새 펌웨어도 정상으로 본다.
  rollback::markHealthy();
}

void loop() {
  // 할 일은 BLE 태스크와 워커 태스크가 모두 한다. Arduino 의 loop 태스크는 지워서 스택을 돌려받는다.
  vTaskDelete(nullptr);
}
