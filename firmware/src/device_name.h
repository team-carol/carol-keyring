#pragma once

#include <string>

// BLE 로 광고할 기기 이름. config::kDeviceNamePrefix 뒤에 칩 기본 MAC 의 끝 2바이트를
// 대문자 16진수 4자리로 붙인다 (예: carol-keyring-9A28). 기본 MAC 은 USB 시리얼 번호로도
// 보이는 값이라, PC 에 꽂았을 때 보이는 번호와 이름을 맞춰 볼 수 있다.
const std::string& deviceName();
