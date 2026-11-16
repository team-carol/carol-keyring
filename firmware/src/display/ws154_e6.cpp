#if defined(PANEL_WS154_E6)

#include "ws154_e6.h"

#include "config.h"

bool Ws154E6Display::begin() {
  pinMode(config::kPinPwr, OUTPUT);
  digitalWrite(config::kPinPwr, HIGH);
  epd_.begin();
  return true;
}

bool Ws154E6Display::draw(const uint8_t* frame) {
  bool ok = epd_.reset();
  if (ok) {
    epd_.command(0xE9, {0x01});

    epd_.command(0x10);
    epd_.data(frame, frameBytes(info()));

    epd_.command(0x04);  // power on
    ok = epd_.waitWhileBusy();
  }
  if (ok) {
    epd_.command(0x12, {0x00});  // refresh
    ok = epd_.waitWhileBusy();
  }
  // 실패했으면 BUSY 를 믿을 수 없으므로 기다리지 않고 바로 끈다. 다음 갱신은 리셋부터 다시 한다.
  powerOff(ok);
  sleep();
  return ok;
}

void Ws154E6Display::sleep() { epd_.command(0x07, {0xA5}); }

void Ws154E6Display::powerOff(bool waitBusy) {
  epd_.command(0x02, {0x00});
  if (waitBusy) epd_.waitWhileBusy();
}

#endif  // PANEL_WS154_E6
