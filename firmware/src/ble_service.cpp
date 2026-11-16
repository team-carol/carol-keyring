#include "ble_service.h"

#include <Arduino.h>

#include "config.h"
#include "device_name.h"

namespace {

enum Opcode : uint8_t {
  kOpBegin = 0x01,
  kOpCommit = 0x02,
  kOpAbort = 0x03,
  kOpUpdateBegin = 0x10,
};

constexpr size_t kDataHeaderBytes = 4;

uint32_t readU32(const uint8_t* p) {
  return p[0] | (p[1] << 8) | (p[2] << 16) | (static_cast<uint32_t>(p[3]) << 24);
}

}  // namespace

class BleService::ServerCallbacks : public NimBLEServerCallbacks {
 public:
  explicit ServerCallbacks(BleService& owner) : owner_(owner) {}

  void onConnect(NimBLEServer*, NimBLEConnInfo& info) override {
    Serial.printf("[ble] connected %s\n", info.getAddress().toString().c_str());
  }

  void onDisconnect(NimBLEServer*, NimBLEConnInfo&, int reason) override {
    Serial.printf("[ble] disconnected (reason %d)\n", reason);
    owner_.onDisconnect();
  }

 private:
  BleService& owner_;
};

class BleService::ControlCallbacks : public NimBLECharacteristicCallbacks {
 public:
  explicit ControlCallbacks(BleService& owner) : owner_(owner) {}

  void onWrite(NimBLECharacteristic* chr, NimBLEConnInfo&) override {
    const NimBLEAttValue value = chr->getValue();
    owner_.onControl(value.data(), value.size());
  }

 private:
  BleService& owner_;
};

class BleService::DataCallbacks : public NimBLECharacteristicCallbacks {
 public:
  explicit DataCallbacks(BleService& owner) : owner_(owner) {}

  void onWrite(NimBLECharacteristic* chr, NimBLEConnInfo&) override {
    const NimBLEAttValue value = chr->getValue();
    owner_.onData(value.data(), value.size());
  }

 private:
  BleService& owner_;
};

BleService::BleService(Transfer& transfer, FirmwareUpdate& update, const PanelInfo& panel)
    : transfer_(transfer), update_(update), panel_(panel) {}

void BleService::begin() {
  NimBLEDevice::init(deviceName());
  NimBLEDevice::setMTU(BLE_ATT_MTU_MAX);

  NimBLEServer* server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks(*this));
  server->advertiseOnDisconnect(true);

  NimBLEService* service = server->createService(config::kServiceUuid);

  NimBLECharacteristic* info =
      service->createCharacteristic(config::kInfoUuid, NIMBLE_PROPERTY::READ);
  info->setValue(buildInfoJson());

  NimBLECharacteristic* control =
      service->createCharacteristic(config::kControlUuid, NIMBLE_PROPERTY::WRITE);
  control->setCallbacks(new ControlCallbacks(*this));

  NimBLECharacteristic* data =
      service->createCharacteristic(config::kDataUuid, NIMBLE_PROPERTY::WRITE_NR);
  data->setCallbacks(new DataCallbacks(*this));

  status_ = service->createCharacteristic(
      config::kStatusUuid, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
  notifyStatus(transfer_.status());

  // 128비트 UUID 와 이름이 광고 패킷 하나(31바이트)에 다 들어가지 않아서 이름은 스캔 응답에 넣는다.
  NimBLEAdvertisementData advData;
  advData.setFlags(BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP);
  advData.addServiceUUID(NimBLEUUID(config::kServiceUuid));
  NimBLEAdvertisementData scanData;
  scanData.setName(deviceName());

  NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
  advertising->setAdvertisementData(advData);
  advertising->setScanResponseData(scanData);
  advertising->start();
  Serial.printf("[ble] advertising as %s\n", deviceName().c_str());
}

void BleService::notifyStatus(const TransferStatus& status) {
  if (status_ == nullptr) return;
  uint8_t payload[6] = {
      static_cast<uint8_t>(status.state),
      static_cast<uint8_t>(status.error),
      static_cast<uint8_t>(status.value),
      static_cast<uint8_t>(status.value >> 8),
      static_cast<uint8_t>(status.value >> 16),
      static_cast<uint8_t>(status.value >> 24),
  };
  status_->setValue(payload, sizeof(payload));
  status_->notify();
}

bool BleService::frameBusy() const {
  const TransferState state = transfer_.status().state;
  return state == TransferState::kReceiving || state == TransferState::kRefreshing;
}

void BleService::onControl(const uint8_t* data, size_t len) {
  if (len == 0) return;
  TransferStatus status;
  switch (data[0]) {
    case kOpBegin:
    case kOpUpdateBegin:
      if (len < 9) {
        status = {TransferState::kError, TransferError::kBadLength, 0};
      } else if (data[0] == kOpBegin && update_.receiving()) {
        status = {TransferState::kError, TransferError::kBusy, 0};
      } else if (data[0] == kOpUpdateBegin && frameBusy()) {
        status = {TransferState::kError, TransferError::kBusy, 0};
      } else if (data[0] == kOpBegin) {
        status = transfer_.begin(readU32(data + 1), readU32(data + 5));
      } else {
        status = update_.begin(readU32(data + 1), readU32(data + 5));
      }
      lastProgressNotify_ = 0;
      break;
    case kOpCommit:
      status = update_.receiving() ? update_.commit() : transfer_.commit();
      break;
    case kOpAbort:
      status = update_.receiving() ? update_.abort() : transfer_.abort();
      break;
    default:
      status = {TransferState::kError, TransferError::kBadOpcode, data[0]};
      break;
  }
  Serial.printf("[ble] control 0x%02x -> state %u error %u value %u\n", data[0],
                static_cast<unsigned>(status.state), static_cast<unsigned>(status.error),
                static_cast<unsigned>(status.value));
  notifyStatus(status);
  // REFRESHING 알림을 먼저 보내고 나서 갱신을 시작시킨다.
  if (data[0] == kOpCommit && status.state == TransferState::kRefreshing && onFrameReady_) {
    onFrameReady_();
  }
  if (data[0] == kOpCommit && status.state == TransferState::kRebooting && onReboot_) {
    onReboot_();
  }
}

void BleService::onData(const uint8_t* data, size_t len) {
  if (len < kDataHeaderBytes) return;
  const bool firmware = update_.receiving();
  const uint32_t offset = readU32(data);
  const uint8_t* chunk = data + kDataHeaderBytes;
  const size_t chunkLen = len - kDataHeaderBytes;
  const TransferStatus status =
      firmware ? update_.write(offset, chunk, chunkLen) : transfer_.write(offset, chunk, chunkLen);
  if (status.state == TransferState::kError) {
    notifyStatus(status);
    return;
  }
  // 진행률은 일정 바이트마다만 알린다.
  const uint32_t total = firmware ? update_.length() : frameBytes(panel_);
  if (status.value - lastProgressNotify_ >= config::kProgressNotifyBytes ||
      status.value == total) {
    lastProgressNotify_ = status.value;
    notifyStatus(status);
  }
}

void BleService::onDisconnect() {
  // 받다가 끊기면 버린다. 갱신 중이면 Transfer 가 거부하므로 그대로 진행된다.
  if (transfer_.status().state == TransferState::kReceiving) transfer_.abort();
  if (update_.receiving()) update_.abort();
}

std::string BleService::buildInfoJson() const {
  std::string json;
  char buf[96];
  snprintf(buf, sizeof(buf), "{\"proto\":%u,\"fw\":\"%s\",\"panel\":\"%s\",",
           config::kProtocolVersion, FW_VERSION, panel_.id);
  json += buf;
  snprintf(buf, sizeof(buf), "\"w\":%u,\"h\":%u,\"rot\":%u,\"fmt\":\"%s\",\"palette\":[",
           panel_.width, panel_.height, panel_.rotation, pixelFormatName(panel_.format));
  json += buf;
  for (uint8_t i = 0; i < panel_.paletteSize; ++i) {
    const PaletteEntry& entry = panel_.palette[i];
    snprintf(buf, sizeof(buf), "%s{\"code\":%u,\"rgb\":\"#%06lx\",\"name\":\"%s\"}",
             i == 0 ? "" : ",", entry.code, static_cast<unsigned long>(entry.rgb),
             entry.name);
    json += buf;
  }
  snprintf(buf, sizeof(buf), "],\"refreshMs\":%lu,\"maxLen\":%u,",
           static_cast<unsigned long>(panel_.refreshMs),
           static_cast<unsigned>(frameBytes(panel_)));
  json += buf;
  snprintf(buf, sizeof(buf), "\"build\":\"%s\",\"otaMaxLen\":%u}", FW_ENV,
           static_cast<unsigned>(FirmwareUpdate::maxLength()));
  json += buf;
  return json;
}
