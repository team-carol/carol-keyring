// 기기 없이 화면을 볼 때 쓰는 Info. 펌웨어의 bwry_palette.h, e6_palette.h 와 같은 값이다.
// 주소에 ?demo=seeed213_bwry 처럼 붙이면 이 정보로 연결된 것처럼 보여 준다 (전송은 안 됨).

import type { DeviceInfo } from './protocol.ts';

const BWRY: DeviceInfo['palette'] = [
  { code: 0, rgb: '#1a1a1a', name: 'black' },
  { code: 1, rgb: '#e8e8e0', name: 'white' },
  { code: 2, rgb: '#e6c800', name: 'yellow' },
  { code: 3, rgb: '#b4221e', name: 'red' },
];

export const DEMO_INFO: Record<string, DeviceInfo> = {
  seeed213_bwry: {
    proto: 1,
    fw: '0.1.0',
    panel: 'seeed213_bwry',
    w: 122,
    h: 250,
    rot: 90,
    fmt: '2bpp-bwry',
    palette: BWRY,
    refreshMs: 25000,
    maxLen: 7750,
    build: 'seeed213_bwry',
    otaMaxLen: 1310720,
  },
  ws154_e6: {
    proto: 1,
    fw: '0.1.0',
    panel: 'ws154_e6',
    w: 240,
    h: 240,
    rot: 0,
    fmt: '4bpp-e6',
    palette: [
      ...BWRY,
      { code: 5, rgb: '#2850a0', name: 'blue' },
      { code: 6, rgb: '#2e7d3c', name: 'green' },
    ],
    refreshMs: 27000,
    maxLen: 28800,
    build: 'ws154_e6',
    otaMaxLen: 1310720,
  },
};

export const DEFAULT_DEMO = 'seeed213_bwry';

export function demoFromLocation(): DeviceInfo | null {
  const id = new URLSearchParams(window.location.search).get('demo');
  return id ? (DEMO_INFO[id] ?? null) : null;
}
