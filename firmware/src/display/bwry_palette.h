#pragma once

#include "display.h"

// Seeed 2.13" 4색(JD79676) 색 코드. Seeed_GFX 의 JD79676 드라이버 기준.
// rgb 는 디더링용 근사값이라 실물을 보고 조정한다.
inline constexpr PaletteEntry kBwryPalette[] = {
    {0x0, 0x1A1A1A, "black"},
    {0x1, 0xE8E8E0, "white"},
    {0x2, 0xE6C800, "yellow"},
    {0x3, 0xB4221E, "red"},
};

// 패널 메모리는 세로(122x250)라서 웹의 가로 이미지를 시계 방향으로 90도 돌려서 보낸다.
inline constexpr PanelInfo kBwryPanelInfo = {
    "seeed213_bwry",
    122,
    250,
    90,
    PixelFormat::kBwry2bpp,
    kBwryPalette,
    sizeof(kBwryPalette) / sizeof(kBwryPalette[0]),
    25000,  // 추정값. 실물로 재서 고친다.
};
