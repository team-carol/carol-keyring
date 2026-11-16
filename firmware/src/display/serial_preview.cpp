#include "serial_preview.h"

#include <Arduino.h>
#include <string.h>

// 터미널 폭에 맞추기 위해 가로 2픽셀, 세로 4픽셀을 한 글자로 줄여서 그린다.
static constexpr uint16_t kStepX = 2;
static constexpr uint16_t kStepY = 4;

bool SerialPreviewDisplay::draw(const uint8_t* frame) {
  Serial.printf("[preview] %ux%u %s\n", info_.width, info_.height,
                pixelFormatName(info_.format));
  for (uint16_t y = 0; y < info_.height; y += kStepY) {
    for (uint16_t x = 0; x < info_.width; x += kStepX) {
      Serial.print(glyphFor(pixelAt(frame, x, y)));
    }
    Serial.println();
  }
  return true;
}

uint8_t SerialPreviewDisplay::pixelAt(const uint8_t* frame, uint16_t x,
                                      uint16_t y) const {
  const uint8_t* row = frame + rowBytes(info_) * y;
  switch (info_.format) {
    case PixelFormat::kBw1bpp:
      return (row[x / 8] >> (7 - x % 8)) & 0x1;
    case PixelFormat::kBwry2bpp:
      return (row[x / 4] >> (6 - 2 * (x % 4))) & 0x3;
    case PixelFormat::kE64bpp:
      return x % 2 == 0 ? row[x / 2] >> 4 : row[x / 2] & 0xF;
  }
  return 0;
}

char SerialPreviewDisplay::glyphFor(uint8_t code) const {
  if (info_.format == PixelFormat::kBw1bpp) return code ? ' ' : '#';
  for (uint8_t i = 0; i < info_.paletteSize; ++i) {
    if (info_.palette[i].code != code) continue;
    const char* name = info_.palette[i].name;
    if (strcmp(name, "white") == 0) return ' ';
    if (strcmp(name, "black") == 0) return '#';
    return name[0];  // yellow → y, red → r, blue → b, green → g
  }
  return '?';
}
