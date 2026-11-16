#if defined(PANEL_SEEED213_BW)

#include "seeed213_bw.h"

#include <SPI.h>

static constexpr PaletteEntry kBwPalette[] = {
    {0x0, 0x1A1A1A, "black"},
    {0x1, 0xE8E8E0, "white"},
};

// 패널 메모리는 세로(122x250)라서 웹의 가로 이미지를 시계 방향으로 90도 돌려서 보낸다.
static constexpr PanelInfo kInfo = {
    "seeed213_bw",
    Seeed213Panel::WIDTH_VISIBLE,
    Seeed213Panel::HEIGHT,
    90,
    PixelFormat::kBw1bpp,
    kBwPalette,
    sizeof(kBwPalette) / sizeof(kBwPalette[0]),
    3000,
};

// 프로토콜의 한 줄 바이트 수(ceil(122 / 8) = 16)가 패널 RAM 폭(128 / 8)과 같아서
// 받은 프레임을 그대로 writeImage 에 넘길 수 있다.
static_assert((Seeed213Panel::WIDTH_VISIBLE + 7) / 8 == Seeed213Panel::WIDTH / 8,
              "row stride mismatch");

Seeed213BwDisplay::Seeed213BwDisplay()
    : epd_(config::kPinCs, config::kPinDc, config::kPinRst, config::kPinBusy) {}

const PanelInfo& Seeed213BwDisplay::info() const { return kInfo; }

bool Seeed213BwDisplay::begin() {
  SPI.begin(config::kPinSck, -1, config::kPinMosi, -1);
  epd_.init(0);
  return true;
}

bool Seeed213BwDisplay::draw(const uint8_t* frame) {
  epd_.writeImage(frame, 0, 0, Seeed213Panel::WIDTH, Seeed213Panel::HEIGHT);
  epd_.refresh(false);
  epd_.powerOff();
  // GxEPD2 는 BUSY 를 자체 시간 제한까지만 기다리고 실패를 알려 주지 않으므로 항상 성공으로 본다.
  return true;
}

void Seeed213BwDisplay::sleep() { epd_.hibernate(); }

#endif  // PANEL_SEEED213_BW
