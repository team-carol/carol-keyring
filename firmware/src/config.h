#pragma once

#include <Arduino.h>

#ifndef FW_VERSION
#define FW_VERSION "0.0.0"
#endif
// 빌드 환경 이름 (platformio.ini 의 env). 웹이 펌웨어 파일과 기기를 맞춰 볼 때 쓴다.
#ifndef FW_ENV
#define FW_ENV "unknown"
#endif

namespace config {

// BLE 이름은 이 접두사 뒤에 칩 MAC 끝 4자리(16진수)를 붙인다. 예: carol-keyring-9A28
constexpr const char* kDeviceNamePrefix = "carol-keyring-";
constexpr uint8_t kProtocolVersion = 1;

// docs/protocol.md 와 같아야 한다.
constexpr const char* kServiceUuid = "321f25a5-0001-4f89-8108-301f40abeb17";
constexpr const char* kInfoUuid = "321f25a5-0002-4f89-8108-301f40abeb17";
constexpr const char* kControlUuid = "321f25a5-0003-4f89-8108-301f40abeb17";
constexpr const char* kDataUuid = "321f25a5-0004-4f89-8108-301f40abeb17";
constexpr const char* kStatusUuid = "321f25a5-0005-4f89-8108-301f40abeb17";

// RECEIVING 상태 알림 간격 (바이트)
constexpr uint32_t kProgressNotifyBytes = 2048;

// BUSY 한 번을 기다리는 최대 시간. 가장 느린 패널(6색, 약 27초)의 갱신보다 넉넉하게 잡는다.
// 넘기면 패널이 빠졌거나 고장 난 것으로 보고 PANEL_TIMEOUT 을 알린다.
constexpr uint32_t kBusyTimeoutMs = 60000;

// 화면 갱신과 재부팅을 맡는 워커 태스크. NimBLE 호스트 태스크보다 우선순위를 낮게 두어
// 갱신 중에도 BLE 가 응답하게 한다.
constexpr uint32_t kWorkerTaskStackBytes = 4096;
constexpr UBaseType_t kWorkerTaskPriority = 1;

// e-paper SPI 핀. Seeed XIAO ePaper 드라이버 보드 배치를 따른다.
// Waveshare 모듈도 같은 핀에 연결하고, PWR만 추가로 D4에 연결한다.
constexpr int kPinRst = D0;
constexpr int kPinCs = D1;
constexpr int kPinBusy = D2;
constexpr int kPinDc = D3;
constexpr int kPinPwr = D4;
constexpr int kPinSck = D8;
constexpr int kPinMosi = D10;

}  // namespace config
