#pragma once

#include <stddef.h>
#include <stdint.h>

enum class PixelFormat : uint8_t {
  kBw1bpp,    // "1bpp-bw"
  kBwry2bpp,  // "2bpp-bwry"
  kE64bpp,    // "4bpp-e6"
};

struct PaletteEntry {
  uint8_t code;      // 프레임에 들어가는 픽셀 값
  uint32_t rgb;      // 실제 패널에서 보이는 색에 가까운 값 (0xRRGGBB)
  const char* name;
};

// 빌드할 때 정해지는 패널 정보. BLE Info로 그대로 나간다.
struct PanelInfo {
  const char* id;
  uint16_t width;     // 패널 메모리 기준
  uint16_t height;
  uint16_t rotation;  // 웹 이미지를 패널 방향으로 맞추는 시계 방향 회전 각도
  PixelFormat format;
  const PaletteEntry* palette;
  uint8_t paletteSize;
  uint32_t refreshMs;
};

const char* pixelFormatName(PixelFormat format);
size_t rowBytes(const PanelInfo& info);
size_t frameBytes(const PanelInfo& info);

class Display {
 public:
  virtual ~Display() = default;

  virtual const PanelInfo& info() const = 0;
  virtual bool begin() = 0;
  // 프레임 전체를 그리고 갱신이 끝날 때까지 기다린다.
  // 패널이 응답하지 않아(BUSY 시간 초과) 갱신하지 못했으면 false 를 돌려준다.
  virtual bool draw(const uint8_t* frame) = 0;
  virtual void sleep() = 0;
};

// 빌드 플래그(PANEL_*)로 선택된 디스플레이를 돌려준다.
Display& createDisplay();
