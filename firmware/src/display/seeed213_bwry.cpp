#if defined(PANEL_SEEED213_BWRY)

#include "seeed213_bwry.h"

// 패널 RAM 은 한 줄이 128픽셀(32바이트)이고 그중 앞쪽 122픽셀이 보인다.
static constexpr uint16_t kRamWidth = 128;
static constexpr size_t kRamRowBytes = kRamWidth / 4;
static constexpr uint8_t kWhite4px = 0x55;  // 흰색(01) 4픽셀

bool Seeed213BwryDisplay::begin() {
  epd_.begin();
  return true;
}

bool Seeed213BwryDisplay::draw(const uint8_t* frame) {
  bool ok = epd_.reset() && init();
  if (ok) {
    // 프로토콜의 한 줄(31바이트)을 패널 RAM 한 줄(32바이트)에 맞춰 흰색으로 채운다.
    const size_t srcRowBytes = rowBytes(info());
    epd_.command(0x10);
    for (uint16_t y = 0; y < info().height; ++y) {
      epd_.data(frame + srcRowBytes * y, srcRowBytes);
      for (size_t pad = srcRowBytes; pad < kRamRowBytes; ++pad) epd_.data(kWhite4px);
    }

    epd_.command(0x12, {0x00});  // refresh
    ok = epd_.waitWhileBusy();
  }
  // 실패했으면 BUSY 를 믿을 수 없으므로 기다리지 않고 바로 재운다. 다음 갱신은 리셋부터 다시 한다.
  powerOff(ok);
  return ok;
}

void Seeed213BwryDisplay::sleep() { powerOff(true); }

void Seeed213BwryDisplay::powerOff(bool waitBusy) {
  epd_.command(0x02);  // power off
  if (waitBusy) epd_.waitWhileBusy();
  delay(100);
  epd_.command(0x07, {0xA5});  // deep sleep
}

bool Seeed213BwryDisplay::init() {
  epd_.command(0x4D, {0x78});
  epd_.command(0x00, {0x0F, 0x29});  // PSR
  epd_.command(0x01, {0x07});        // PWR
  epd_.command(0x03, {0x10, 0x54, 0x44});
  epd_.command(0x06, {0x0F, 0x0A, 0x2F, 0x25, 0x22, 0x2E, 0x21});  // booster
  epd_.command(0x50, {0x37});        // CDI
  epd_.command(0x60, {0x02, 0x02});  // TCON
  epd_.command(0x61, {kRamWidth >> 8, kRamWidth & 0xFF, 250 >> 8, 250 & 0xFF});  // TRES
  epd_.command(0xE7, {0x1C});
  epd_.command(0xE3, {0x22});
  epd_.command(0xB4, {0xD0});
  epd_.command(0xB5, {0x03});
  epd_.command(0xE9, {0x01});
  epd_.command(0x30, {0x08});
  epd_.command(0x04);  // power on
  return epd_.waitWhileBusy();
}

#endif  // PANEL_SEEED213_BWRY
