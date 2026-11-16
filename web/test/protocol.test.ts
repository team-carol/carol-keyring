import assert from 'node:assert/strict';
import { test } from 'node:test';
import zlib from 'node:zlib';

import {
  beginPacket,
  canvasSize,
  crc32,
  dataPacket,
  encodeFrame,
  parseFirmware,
  parsePalette,
  parseStatus,
  quantize,
} from '../src/protocol.ts';
import type { DeviceInfo, RgbaImage } from '../src/protocol.ts';

type Rgb = [number, number, number];
const W: Rgb = [232, 232, 224];
const K: Rgb = [26, 26, 26];
const R: Rgb = [180, 34, 30];
const Y: Rgb = [230, 200, 0];

const BWRY: DeviceInfo['palette'] = [
  { code: 0, rgb: '#1a1a1a', name: 'black' },
  { code: 1, rgb: '#e8e8e0', name: 'white' },
  { code: 2, rgb: '#e6c800', name: 'yellow' },
  { code: 3, rgb: '#b4221e', name: 'red' },
];

const bwry: DeviceInfo = {
  proto: 1, fw: 'test', panel: 'seeed213_bwry', w: 122, h: 250, rot: 90, fmt: '2bpp-bwry',
  palette: BWRY, refreshMs: 25000, maxLen: 7750,
};

function image(width: number, height: number, pixel: (x: number, y: number) => Rgb): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      [data[i], data[i + 1], data[i + 2]] = pixel(x, y);
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

function px2(frame: Uint8Array, info: DeviceInfo, x: number, y: number): number {
  const rowBytes = Math.ceil(info.w / 4);
  return (frame[y * rowBytes + (x >> 2)] >> (6 - 2 * (x % 4))) & 3;
}

// 캔버스 세 모서리에 색을 찍는다: 왼쪽 위 빨강, 오른쪽 위 노랑, 왼쪽 아래 검정.
const corners = image(250, 122, (x, y) =>
  x === 0 && y === 0 ? R : x === 249 && y === 0 ? Y : x === 0 && y === 121 ? K : W,
);

test('crc32 는 zlib 과 같다', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const bytes = new Uint8Array(7750).map((_, i) => (i * 31 + 7) & 0xff);
  assert.equal(crc32(bytes), zlib.crc32(bytes));
});

test('rot 90 이면 캔버스는 가로', () => {
  assert.deepEqual(canvasSize(bwry), { width: 250, height: 122 });
});

test('rot 90: 캔버스를 시계 방향으로 돌려 패널 메모리에 넣는다', () => {
  const { frame } = encodeFrame(corners, bwry);
  assert.equal(frame.length, 7750);
  assert.equal(px2(frame, bwry, 121, 0), 3, '캔버스 왼쪽 위 → 패널 오른쪽 위');
  assert.equal(px2(frame, bwry, 121, 249), 2, '캔버스 오른쪽 위 → 패널 오른쪽 아래');
  assert.equal(px2(frame, bwry, 0, 0), 0, '캔버스 왼쪽 아래 → 패널 왼쪽 위');
  assert.equal(px2(frame, bwry, 60, 100), 1);
  assert.equal(px2(frame, bwry, 122, 5), 1, '줄 끝 채움은 흰색');
  assert.equal(px2(frame, bwry, 123, 5), 1, '줄 끝 채움은 흰색');
});

test('rot 270: 반시계 방향', () => {
  const info: DeviceInfo = { ...bwry, rot: 270 };
  const { frame } = encodeFrame(corners, info);
  assert.equal(px2(frame, info, 0, 249), 3);
  assert.equal(px2(frame, info, 0, 0), 2);
  assert.equal(px2(frame, info, 121, 249), 0);
});

test('4bpp-e6: 상위 4비트가 왼쪽 픽셀', () => {
  const info: DeviceInfo = {
    proto: 1, fw: 'test', panel: 'ws154_e6', w: 240, h: 240, rot: 0, fmt: '4bpp-e6', refreshMs: 27000, maxLen: 28800,
    palette: [...BWRY, { code: 5, rgb: '#2850a0', name: 'blue' }, { code: 6, rgb: '#2e7d3c', name: 'green' }],
  };
  const { frame } = encodeFrame(image(240, 240, (x, y) => (x === 1 && y === 0 ? [40, 80, 160] : W)), info);
  assert.equal(frame.length, 28800);
  assert.equal(frame[0], 0x15);
});

test('1bpp-bw: MSB 가 왼쪽, 남는 비트는 1', () => {
  const info: DeviceInfo = {
    proto: 1, fw: 'test', panel: 'seeed213_bw', w: 122, h: 250, rot: 90, fmt: '1bpp-bw', refreshMs: 3000, maxLen: 4000,
    palette: BWRY.slice(0, 2),
  };
  const { frame } = encodeFrame(image(250, 122, (x, y) => (x === 0 && y === 121 ? K : W)), info);
  assert.equal(frame.length, 4000);
  assert.equal(frame[0], 0x7f);
  assert.equal(frame[15], 0xff);
});

test('회색(글자 테두리)은 빨강이 아니라 검정이나 흰색으로 간다', () => {
  const palette = parsePalette(bwry);
  for (const v of [64, 96, 128, 160, 192]) {
    const [index] = quantize(image(1, 1, () => [v, v, v]), palette);
    assert.ok(['black', 'white'].includes(palette[index].name), `gray ${v} → ${palette[index].name}`);
  }
});

test('캔버스 크기가 다르면 거부한다', () => {
  assert.throws(() => encodeFrame(image(122, 250, () => W), bwry));
});

test('패킷 바이트 배열', () => {
  assert.deepEqual([...beginPacket(7750, 0xdeadbeef)], [1, 0x46, 0x1e, 0, 0, 0xef, 0xbe, 0xad, 0xde]);
  const frame = new Uint8Array(400).map((_, i) => i & 0xff);
  assert.deepEqual([...dataPacket(frame, 300, 4)], [0x2c, 1, 0, 0, 44, 45, 46, 47]);
  const status = parseStatus(new DataView(Uint8Array.of(4, 8, 0x30, 0x75, 0, 0).buffer));
  assert.equal(status.errorName, 'PANEL_TIMEOUT');
  assert.equal(status.value, 30000);
});

function firmwareBytes(opts: { magic?: number; chipId?: number; tag?: string } = {}): Uint8Array {
  const bytes = new Uint8Array(8192);
  bytes[0] = opts.magic ?? 0xe9;
  bytes[12] = opts.chipId ?? 5;
  if (opts.tag !== '') bytes.set(new TextEncoder().encode(opts.tag ?? 'CAROL-KEYRING-FW|0.2.1|seeed213_bwry|'), 5000);
  return bytes;
}

test('펌웨어 파일에서 버전과 빌드를 읽는다', () => {
  assert.deepEqual(parseFirmware(firmwareBytes()), { version: '0.2.1', build: 'seeed213_bwry', size: 8192 });
});

test('ESP 이미지가 아니거나 다른 칩이거나 표시가 없으면 거부한다', () => {
  assert.throws(() => parseFirmware(firmwareBytes({ magic: 0 })), /ESP32 펌웨어 파일이 아닙니다/);
  assert.throws(() => parseFirmware(firmwareBytes({ chipId: 9 })), /ESP32-C3/);
  assert.throws(() => parseFirmware(firmwareBytes({ tag: '' })), /캐롤 키링 펌웨어가 아닙니다/);
});
