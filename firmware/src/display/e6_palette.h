#pragma once

#include "display.h"

// Spectra 6 색 코드. Waveshare 예제 기준이며 실물로 확인이 필요하다.
// rgb 는 디더링용 근사값이라 실물을 보고 조정한다.
inline constexpr PaletteEntry kE6Palette[] = {
    {0x0, 0x1A1A1A, "black"},
    {0x1, 0xE8E8E0, "white"},
    {0x2, 0xE6C800, "yellow"},
    {0x3, 0xB4221E, "red"},
    {0x5, 0x2850A0, "blue"},
    {0x6, 0x2E7D3C, "green"},
};

inline constexpr PanelInfo kE6PanelInfo = {
    "ws154_e6",
    240,
    240,
    0,
    PixelFormat::kE64bpp,
    kE6Palette,
    sizeof(kE6Palette) / sizeof(kE6Palette[0]),
    27000,
};
