#pragma once

#include <GxEPD2_BW.h>

#include "config.h"
#include "display.h"

// Seeed 2.13" 흑백 122x250 + XIAO ePaper 드라이버 보드 (개발용).
// 컨트롤러는 SSD1680 이다 (Seeed_GFX Setup508 기준). GxEPD2 의 GDEY0213B74 드라이버를 쓴다.
using Seeed213Panel = GxEPD2_213_GDEY0213B74;

class Seeed213BwDisplay : public Display {
 public:
  Seeed213BwDisplay();

  const PanelInfo& info() const override;
  bool begin() override;
  bool draw(const uint8_t* frame) override;
  void sleep() override;

 private:
  Seeed213Panel epd_;
};
