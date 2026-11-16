#pragma once

#include "bwry_palette.h"
#include "display.h"
#include "epd_spi.h"

// Seeed 2.13" 4색(흑백적황) 122x250 + XIAO ePaper 드라이버 보드.
// 컨트롤러는 JD79676 이고, 초기화 순서는 Seeed_GFX(TFT_Drivers/JD79676_Defines.h)를 옮긴 것이다.
class Seeed213BwryDisplay : public Display {
 public:
  const PanelInfo& info() const override { return kBwryPanelInfo; }
  bool begin() override;
  bool draw(const uint8_t* frame) override;
  void sleep() override;

 private:
  bool init();
  void powerOff(bool waitBusy);

  EpdSpi epd_;
};
