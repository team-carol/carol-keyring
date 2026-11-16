// docs/protocol.md 의 웹 쪽 구현. DOM 에 의존하지 않아서 Node 테스트에서도 불러 쓴다.

export const SERVICE_UUID = '321f25a5-0001-4f89-8108-301f40abeb17';
export const INFO_UUID = '321f25a5-0002-4f89-8108-301f40abeb17';
export const CONTROL_UUID = '321f25a5-0003-4f89-8108-301f40abeb17';
export const DATA_UUID = '321f25a5-0004-4f89-8108-301f40abeb17';
export const STATUS_UUID = '321f25a5-0005-4f89-8108-301f40abeb17';

export const PROTOCOL_VERSION = 1;

export const Op = { BEGIN: 0x01, COMMIT: 0x02, ABORT: 0x03, UPDATE_BEGIN: 0x10 } as const;

export const State = { IDLE: 0, RECEIVING: 1, REFRESHING: 2, DONE: 3, ERROR: 4, REBOOTING: 5 } as const;
export const STATE_NAMES = ['IDLE', 'RECEIVING', 'REFRESHING', 'DONE', 'ERROR', 'REBOOTING'] as const;

export const Err = {
  NONE: 0,
  BAD_LENGTH: 1,
  BAD_OFFSET: 2,
  CRC_MISMATCH: 3,
  NOT_RECEIVING: 4,
  BUSY: 5,
  INCOMPLETE: 6,
  BAD_OPCODE: 7,
  PANEL_TIMEOUT: 8,
  FLASH: 9,
} as const;
export const ERROR_NAMES = Object.keys(Err);

export type PixelFormat = '1bpp-bw' | '2bpp-bwry' | '4bpp-e6';

export interface PaletteEntryInfo {
  code: number;
  rgb: string;
  name: string;
}

/** 기기가 Info 특성으로 알려 주는 패널 정보 */
export interface DeviceInfo {
  proto: number;
  fw: string;
  panel: string;
  w: number;
  h: number;
  rot: 0 | 90 | 180 | 270;
  fmt: PixelFormat;
  palette: PaletteEntryInfo[];
  refreshMs: number;
  maxLen: number;
  /** 펌웨어 빌드 환경 */
  build?: string;
  /** 무선 업데이트로 받을 수 있는 최대 크기. 0이거나 없으면 지원하지 않는다 */
  otaMaxLen?: number;
}

export interface PaletteColor extends PaletteEntryInfo {
  r: number;
  g: number;
  b: number;
}

export interface Status {
  state: number;
  error: number;
  value: number;
  stateName: string;
  errorName: string;
}

/** ImageData 와 같은 모양. Node 테스트에서도 만들 수 있게 따로 둔다. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const BITS_PER_PIXEL: Record<PixelFormat, number> = { '1bpp-bw': 1, '2bpp-bwry': 2, '4bpp-e6': 4 };

// CRC-32 (IEEE 802.3, zlib 의 crc32 와 같음)
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** 웹에서 그릴 캔버스 크기. 패널 메모리가 세로여도 웹은 rot 만큼 돌린 방향으로 그린다. */
export function canvasSize(info: Pick<DeviceInfo, 'w' | 'h' | 'rot'>): { width: number; height: number } {
  return info.rot % 180 === 0 ? { width: info.w, height: info.h } : { width: info.h, height: info.w };
}

export function parsePalette(info: Pick<DeviceInfo, 'palette'>): PaletteColor[] {
  return info.palette.map((entry) => {
    const hex = Number.parseInt(entry.rgb.slice(1), 16);
    return { ...entry, r: hex >> 16, g: (hex >> 8) & 0xff, b: hex & 0xff };
  });
}

// sRGB 0~255 → OKLab. 사람 눈에 가까운 색 거리를 재려고 쓴다.
// RGB 거리로 고르면 글자 테두리의 회색이 빨강으로 가는 식의 엉뚱한 결과가 나온다.
const SRGB_TO_LINEAR = (() => {
  const table = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    table[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  return table;
})();

function toOklab(r: number, g: number, b: number, out: Float32Array, at: number): void {
  const lr = SRGB_TO_LINEAR[r];
  const lg = SRGB_TO_LINEAR[g];
  const lb = SRGB_TO_LINEAR[b];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  out[at] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  out[at + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  out[at + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}

// 색 차이(a, b)를 밝기 차이(L)보다 무겁게 친다. 전자잉크 팔레트는 검정과 흰색 사이에 회색이 없어서,
// 그냥 OKLab 거리로 고르면 중간 회색이 밝기가 비슷한 빨강·노랑으로 간다. 무채색은 무채색으로 보내야 한다.
const CHROMA_WEIGHT_SQ = 3 * 3;

/** RGBA 픽셀마다 OKLab 거리로 가장 가까운 팔레트 항목의 인덱스를 고른다 (디더링 없음). */
export function quantize(image: RgbaImage, palette: PaletteColor[]): Uint8Array {
  const { width, height, data } = image;
  const lab = new Float32Array(palette.length * 3);
  palette.forEach((p, i) => toOklab(p.r, p.g, p.b, lab, i * 3));

  // 같은 색이 이어지는 경우가 많아서 직전 픽셀 결과를 다시 쓴다.
  const pixel = new Float32Array(3);
  const out = new Uint8Array(width * height);
  let lastRgb = -1;
  let lastBest = 0;
  for (let i = 0; i < out.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const rgb = (r << 16) | (g << 8) | b;
    if (rgb !== lastRgb) {
      toOklab(r, g, b, pixel, 0);
      let bestDist = Infinity;
      for (let p = 0; p < palette.length; p++) {
        const dl = pixel[0] - lab[p * 3];
        const da = pixel[1] - lab[p * 3 + 1];
        const db = pixel[2] - lab[p * 3 + 2];
        const dist = dl * dl + CHROMA_WEIGHT_SQ * (da * da + db * db);
        if (dist < bestDist) {
          bestDist = dist;
          lastBest = p;
        }
      }
      lastRgb = rgb;
    }
    out[i] = lastBest;
  }
  return out;
}

// 패널 메모리 좌표 (px, py) 에 들어갈 캔버스 좌표의 인덱스.
// 캔버스를 시계 방향으로 rot 만큼 돌리면 패널 메모리가 된다.
function sourceIndex(px: number, py: number, rot: number, cw: number, ch: number): number {
  switch (rot) {
    case 0:
      return py * cw + px;
    case 90:
      return (ch - 1 - px) * cw + py;
    case 180:
      return (ch - 1 - py) * cw + (cw - 1 - px);
    case 270:
      return px * cw + (cw - 1 - py);
    default:
      throw new Error(`지원하지 않는 rot: ${rot}`);
  }
}

export interface EncodedFrame {
  /** 기기로 보낼 프레임 바이트 */
  frame: Uint8Array;
  /** 캔버스 픽셀마다 고른 팔레트 인덱스 (미리보기용) */
  indices: Uint8Array;
}

/** 캔버스 이미지를 패널이 받는 프레임 바이트로 바꾼다. */
export function encodeFrame(image: RgbaImage, info: DeviceInfo): EncodedFrame {
  const bpp = BITS_PER_PIXEL[info.fmt];
  if (!bpp) throw new Error(`지원하지 않는 fmt: ${info.fmt}`);

  const expected = canvasSize(info);
  if (image.width !== expected.width || image.height !== expected.height) {
    throw new Error(
      `캔버스 크기가 ${expected.width}x${expected.height} 이어야 한다 (받은 값 ${image.width}x${image.height})`,
    );
  }

  const palette = parsePalette(info);
  const indices = quantize(image, palette);
  const white = palette.find((p) => p.name === 'white')?.code ?? 1;

  const { w, h, rot } = info;
  const pixelsPerByte = 8 / bpp;
  const rowBytes = Math.ceil(w / pixelsPerByte);
  const frame = new Uint8Array(rowBytes * h);

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < rowBytes * pixelsPerByte; px++) {
      // 한 줄 끝에 남는 픽셀은 흰색으로 채운다.
      const code =
        px < w ? palette[indices[sourceIndex(px, py, rot, image.width, image.height)]].code : white;
      const shift = 8 - bpp * ((px % pixelsPerByte) + 1);
      frame[py * rowBytes + Math.floor(px / pixelsPerByte)] |= code << shift;
    }
  }

  if (frame.length !== info.maxLen) {
    throw new Error(`프레임 크기 ${frame.length} 가 maxLen ${info.maxLen} 과 다르다`);
  }
  return { frame, indices };
}

export function parseStatus(view: DataView): Status {
  const state = view.getUint8(0);
  const error = view.getUint8(1);
  const value = view.getUint32(2, true);
  return {
    state,
    error,
    value,
    stateName: STATE_NAMES[state] ?? `state ${state}`,
    errorName: ERROR_NAMES[error] ?? `error ${error}`,
  };
}

export function beginPacket(length: number, crc: number, op: number = Op.BEGIN): Uint8Array<ArrayBuffer> {
  const packet = new Uint8Array(9);
  const view = new DataView(packet.buffer);
  view.setUint8(0, op);
  view.setUint32(1, length, true);
  view.setUint32(5, crc, true);
  return packet;
}

export function dataPacket(frame: Uint8Array, offset: number, length: number): Uint8Array<ArrayBuffer> {
  const packet = new Uint8Array(4 + length);
  new DataView(packet.buffer).setUint32(0, offset, true);
  packet.set(frame.subarray(offset, offset + length), 4);
  return packet;
}

// ---- 펌웨어 파일 ----

const ESP_IMAGE_MAGIC = 0xe9;
const ESP32C3_CHIP_ID = 5;
const FIRMWARE_TAG = 'CAROL-KEYRING-FW|';

export interface FirmwareFile {
  version: string;
  /** 빌드 환경 (platformio.ini 의 env) */
  build: string;
  size: number;
}

/**
 * 키링 펌웨어 파일(.bin)인지 확인하고 안에 든 버전과 빌드 환경을 읽는다.
 * 펌웨어는 "CAROL-KEYRING-FW|<버전>|<빌드 환경>|" 문자열을 품고 있다 (firmware_update.cpp).
 */
export function parseFirmware(bytes: Uint8Array): FirmwareFile {
  if (bytes.length < 32 || bytes[0] !== ESP_IMAGE_MAGIC) {
    throw new Error('ESP32 펌웨어 파일이 아닙니다. 빌드 폴더의 firmware.bin 을 고르세요.');
  }
  const chipId = bytes[12] | (bytes[13] << 8);
  if (chipId !== ESP32C3_CHIP_ID) {
    throw new Error(`ESP32-C3 용 펌웨어가 아닙니다 (칩 ID ${chipId}).`);
  }

  const tag = new TextEncoder().encode(FIRMWARE_TAG);
  const start = indexOf(bytes, tag);
  if (start < 0) throw new Error('캐롤 키링 펌웨어가 아닙니다.');
  const end = Math.min(bytes.length, start + 128);
  const text = new TextDecoder().decode(bytes.subarray(start + tag.length, end));
  const [version, build] = text.split('|');
  if (!version || build === undefined) throw new Error('펌웨어 정보를 읽을 수 없습니다.');
  return { version, build, size: bytes.length };
}

function indexOf(haystack: Uint8Array, needle: Uint8Array): number {
  const first = needle[0];
  outer: for (let i = haystack.indexOf(first); i >= 0 && i <= haystack.length - needle.length; i = haystack.indexOf(first, i + 1)) {
    for (let j = 1; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
