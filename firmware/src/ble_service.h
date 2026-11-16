#pragma once

#include <NimBLEDevice.h>

#include <functional>
#include <string>

#include "display/display.h"
#include "firmware_update.h"
#include "transfer.h"

// docs/protocol.md 의 GATT 서비스를 구현한다.
// 화면 프레임(Transfer)과 펌웨어(FirmwareUpdate)는 같은 Data 특성으로 받고, 한 번에 하나만 받는다.
class BleService {
 public:
  BleService(Transfer& transfer, FirmwareUpdate& update, const PanelInfo& panel);

  // 아래 두 핸들러는 BLE 태스크에서 불린다. 오래 걸리는 일은 하지 말 것.
  // COMMIT 이 성공해 프레임이 준비되면 부른다.
  void setFrameReadyHandler(std::function<void()> handler) { onFrameReady_ = std::move(handler); }
  // 펌웨어 업데이트가 끝나 재부팅해야 할 때 부른다 (REBOOTING 알림을 보낸 뒤).
  void setRebootHandler(std::function<void()> handler) { onReboot_ = std::move(handler); }

  void begin();
  // 어느 태스크에서 불러도 된다.
  void notifyStatus(const TransferStatus& status);

 private:
  class ServerCallbacks;
  class ControlCallbacks;
  class DataCallbacks;

  void onControl(const uint8_t* data, size_t len);
  void onData(const uint8_t* data, size_t len);
  void onDisconnect();
  bool frameBusy() const;
  std::string buildInfoJson() const;

  Transfer& transfer_;
  FirmwareUpdate& update_;
  const PanelInfo& panel_;
  std::function<void()> onFrameReady_;
  std::function<void()> onReboot_;
  NimBLECharacteristic* status_ = nullptr;
  uint32_t lastProgressNotify_ = 0;
};
