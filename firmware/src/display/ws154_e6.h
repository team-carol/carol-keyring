#pragma once

#include "display.h"
#include "e6_palette.h"
#include "epd_spi.h"

// Waveshare 1.54inch e-Paper Module (E), Spectra 6, 240x240.
// 명령 순서는 Waveshare 예제(1.54inch_e-Paper_E.zip, ESP32/EPD_1in54e.cpp)를 옮긴 것이다.
class Ws154E6Display : public Display {
 public:
  const PanelInfo& info() const override { return kE6PanelInfo; }
  bool begin() override;
  bool draw(const uint8_t* frame) override;
  void sleep() override;

 private:
  void powerOff(bool waitBusy);

  EpdSpi epd_;
};
