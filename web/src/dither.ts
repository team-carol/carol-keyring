// 사진(아이콘)을 패널 색 몇 개로 줄이는 오차 확산 디더링 (Floyd–Steinberg).
// 가장 가까운 색으로 바꾸고, 그 차이를 아직 안 칠한 옆 픽셀에 나눠 준다. 점이 섞여서 멀리서 보면 중간색이 난다.
// DOM 없이 Node 테스트에서도 쓴다.

import type { PaletteColor, RgbaImage } from './protocol.ts';

/** 사람 눈에 가까운 RGB 거리 ("redmean"). 빨강이 많은 색끼리는 파랑 차이를 덜 친다. */
function distance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
}

function nearest(palette: PaletteColor[], r: number, g: number, b: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i];
    const d = distance(r, g, b, p.r, p.g, p.b);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

/**
 * 이미지를 팔레트 인덱스로 바꾼다. 줄마다 방향을 바꿔(지그재그) 한쪽으로 쏠린 무늬가 덜 생기게 한다.
 * 투명한 픽셀은 흰 바탕 위에 있는 것으로 본다.
 * strength 는 넘겨 주는 오차의 비율이다. 1 보다 작으면 밝은 곳의 흩뿌린 점이 줄고 면이 깔끔해진다 (대신 중간색 표현이 줄어든다).
 */
export function ditherToPalette(image: RgbaImage, palette: PaletteColor[], strength = 1): Uint8Array {
  const { width, height, data } = image;
  const work = new Float32Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const a = data[i * 4 + 3] / 255;
    work[i * 3] = data[i * 4] * a + 255 * (1 - a);
    work[i * 3 + 1] = data[i * 4 + 1] * a + 255 * (1 - a);
    work[i * 3 + 2] = data[i * 4 + 2] * a + 255 * (1 - a);
  }

  const out = new Uint8Array(width * height);
  const spread = (x: number, y: number, er: number, eg: number, eb: number, weight: number) => {
    if (x < 0 || x >= width || y >= height) return;
    const j = (y * width + x) * 3;
    work[j] += er * weight;
    work[j + 1] += eg * weight;
    work[j + 2] += eb * weight;
  };

  for (let y = 0; y < height; y++) {
    const leftToRight = y % 2 === 0;
    const dir = leftToRight ? 1 : -1;
    for (let k = 0; k < width; k++) {
      const x = leftToRight ? k : width - 1 - k;
      const i = y * width + x;
      const r = Math.min(255, Math.max(0, work[i * 3]));
      const g = Math.min(255, Math.max(0, work[i * 3 + 1]));
      const b = Math.min(255, Math.max(0, work[i * 3 + 2]));
      const index = nearest(palette, r, g, b);
      out[i] = index;
      const p = palette[index];
      const er = (r - p.r) * strength;
      const eg = (g - p.g) * strength;
      const eb = (b - p.b) * strength;
      spread(x + dir, y, er, eg, eb, 7 / 16);
      spread(x - dir, y + 1, er, eg, eb, 3 / 16);
      spread(x, y + 1, er, eg, eb, 5 / 16);
      spread(x + dir, y + 1, er, eg, eb, 1 / 16);
    }
  }
  return out;
}

export interface EnhanceOptions {
  /** 1 보다 크면 중간 밝기를 어둡게 한다. 밝은 파스텔 그림이 흰색으로 다 날아가지 않게 한다. */
  gamma: number;
  /** 채도 배율. 패널 색이 적어서 옅은 색은 흰색이나 회색으로 가 버린다. */
  saturation: number;
  /** 밝기 범위를 위아래 이 비율(0~0.5)만큼 잘라 낸 뒤 0~255 로 늘린다. */
  clip: number;
}

/**
 * 디더링 전에 이미지를 패널에 맞게 다듬는다: 밝기 범위 늘리기 → 채도 올리기 → 감마.
 * 투명한 곳은 흰 바탕으로 합친다. 새 RgbaImage 를 돌려준다.
 */
export function enhanceForPanel(image: RgbaImage, options: EnhanceOptions): RgbaImage {
  const { width, height, data } = image;
  const n = width * height;
  const rgb = new Float32Array(n * 3);
  const luma = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3] / 255;
    const r = data[i * 4] * a + 255 * (1 - a);
    const g = data[i * 4 + 1] * a + 255 * (1 - a);
    const b = data[i * 4 + 2] * a + 255 * (1 - a);
    rgb.set([r, g, b], i * 3);
    luma[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const sorted = Float32Array.from(luma).sort();
  const lo = sorted[Math.floor((n - 1) * options.clip)];
  const hi = sorted[Math.ceil((n - 1) * (1 - options.clip))];
  const span = Math.max(1, hi - lo);

  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    let r = ((rgb[i * 3] - lo) * 255) / span;
    let g = ((rgb[i * 3 + 1] - lo) * 255) / span;
    let b = ((rgb[i * 3 + 2] - lo) * 255) / span;
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = gray + (r - gray) * options.saturation;
    g = gray + (g - gray) * options.saturation;
    b = gray + (b - gray) * options.saturation;
    const curve = (c: number) => 255 * Math.pow(Math.min(255, Math.max(0, c)) / 255, options.gamma);
    out[i * 4] = curve(r);
    out[i * 4 + 1] = curve(g);
    out[i * 4 + 2] = curve(b);
    out[i * 4 + 3] = 255;
  }
  return { width, height, data: out };
}
