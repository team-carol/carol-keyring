#include "device_name.h"

#include <esp_mac.h>
#include <stdio.h>

#include "config.h"

const std::string& deviceName() {
  static const std::string name = [] {
    uint8_t mac[6] = {};
    esp_efuse_mac_get_default(mac);
    char suffix[5];
    snprintf(suffix, sizeof(suffix), "%02X%02X", mac[4], mac[5]);
    return std::string(config::kDeviceNamePrefix) + suffix;
  }();
  return name;
}
