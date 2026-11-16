import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ditherToPalette } from '../src/dither.ts';
import { parsePalette } from '../src/protocol.ts';

const palette = parsePalette({
  palette: [
    { code: 0, rgb: '#000000', name: 'black' },
    { code: 1, rgb: '#ffffff', name: 'white' },
    { code: 2, rgb: '#ffff00', name: 'yellow' },
    { code: 3, rgb: '#ff0000', name: 'red' },
  ],
});

function solid(width: number, height: number, rgb: [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...rgb, 255], i * 4);
  return { width, height, data };
}

function count(indices: Uint8Array, index: number): number {
  return indices.reduce((n, v) => n + (v === index ? 1 : 0), 0);
}

test('팔레트에 있는 색은 그대로 그 색이 된다', () => {
  const out = ditherToPalette(solid(8, 8, [255, 0, 0]), palette);
  assert.equal(count(out, 3), 64);
});

test('중간 회색은 검정과 흰색이 반쯤 섞인다', () => {
  const out = ditherToPalette(solid(16, 16, [128, 128, 128]), palette);
  const black = count(out, 0);
  const white = count(out, 1);
  assert.equal(black + white, 256, '회색에 빨강·노랑이 섞이지 않는다');
  assert.ok(Math.abs(black - white) < 40, `검정 ${black}, 흰색 ${white}`);
});

test('주황은 빨강과 노랑이 섞인다', () => {
  const out = ditherToPalette(solid(16, 16, [255, 128, 0]), palette);
  assert.ok(count(out, 3) > 64 && count(out, 2) > 64, `빨강 ${count(out, 3)}, 노랑 ${count(out, 2)}`);
});

test('투명한 픽셀은 흰색이 된다', () => {
  const image = solid(4, 4, [0, 0, 0]);
  for (let i = 0; i < 16; i++) image.data[i * 4 + 3] = 0;
  assert.equal(count(ditherToPalette(image, palette), 1), 16);
});
