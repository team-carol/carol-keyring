#pragma once

#include "display.h"

// 패널 없이 개발할 때 쓰는 가짜 디스플레이. 받은 프레임을 시리얼에 문자로 그린다.
class SerialPreviewDisplay : public Display {
 public:
  explicit SerialPreviewDisplay(const PanelInfo& info) : info_(info) {}

  const PanelInfo& info() const override { return info_; }
  bool begin() override { return true; }
  bool draw(const uint8_t* frame) override;
  void sleep() override {}

 private:
  uint8_t pixelAt(const uint8_t* frame, uint16_t x, uint16_t y) const;
  char glyphFor(uint8_t code) const;

  const PanelInfo& info_;
};
