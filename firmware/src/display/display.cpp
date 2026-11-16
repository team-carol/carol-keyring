#include "display.h"

#if defined(PANEL_PREVIEW_E6)
#include "e6_palette.h"
#include "serial_preview.h"
#elif defined(PANEL_PREVIEW_BWRY)
#include "bwry_palette.h"
#include "serial_preview.h"
#elif defined(PANEL_WS154_E6)
#include "ws154_e6.h"
#elif defined(PANEL_SEEED213_BW)
#include "seeed213_bw.h"
#elif defined(PANEL_SEEED213_BWRY)
#include "seeed213_bwry.h"
#else
#error "패널이 지정되지 않았습니다. platformio.ini 의 env 를 확인하세요."
#endif

const char* pixelFormatName(PixelFormat format) {
  switch (format) {
    case PixelFormat::kBw1bpp:
      return "1bpp-bw";
    case PixelFormat::kBwry2bpp:
      return "2bpp-bwry";
    case PixelFormat::kE64bpp:
      return "4bpp-e6";
  }
  return "unknown";
}

size_t rowBytes(const PanelInfo& info) {
  switch (info.format) {
    case PixelFormat::kBw1bpp:
      return (info.width + 7) / 8;
    case PixelFormat::kBwry2bpp:
      return (info.width + 3) / 4;
    case PixelFormat::kE64bpp:
      return (info.width + 1) / 2;
  }
  return 0;
}

size_t frameBytes(const PanelInfo& info) { return rowBytes(info) * info.height; }

Display& createDisplay() {
#if defined(PANEL_PREVIEW_E6)
  static SerialPreviewDisplay display(kE6PanelInfo);
#elif defined(PANEL_PREVIEW_BWRY)
  static SerialPreviewDisplay display(kBwryPanelInfo);
#elif defined(PANEL_WS154_E6)
  static Ws154E6Display display;
#elif defined(PANEL_SEEED213_BW)
  static Seeed213BwDisplay display;
#elif defined(PANEL_SEEED213_BWRY)
  static Seeed213BwryDisplay display;
#endif
  return display;
}
