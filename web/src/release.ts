// 배포된 펌웨어 찾기. DOM 없이 Node 테스트에서도 쓴다.
//
// 펌웨어는 R2 에 두고 Worker 가 /api/firmware/ 아래로 내려준다 (pnpm firmware:release 가 올린다).
// 웹과 같은 출처라 CORS 설정이 필요 없다.

import { FIRMWARE_API_PREFIX, MANIFEST_KEY, compareVersions, parseVersion } from './firmwareStore.ts';
import { parseFirmware } from './protocol.ts';
import type { DeviceInfo } from './protocol.ts';

export interface FirmwareRelease {
  version: string;
  /** 빌드 환경 (platformio.ini 의 env) */
  build: string;
  /** manifest.json 기준 상대 경로 */
  file: string;
  size: number;
  /** 소문자 16진수 */
  sha256: string;
}

export interface FirmwareManifest {
  /** 빌드 환경 이름 → 그 빌드의 최신 펌웨어 */
  builds: Record<string, Omit<FirmwareRelease, 'build'>>;
}

/** 페이지 주소 기준 상대 경로 (api/firmware/manifest.json). manifest 의 file 은 이 주소 기준으로 푼다. */
export const MANIFEST_PATH = `${FIRMWARE_API_PREFIX.slice(1)}${MANIFEST_KEY}`;

export { compareVersions, parseVersion };

/** 기기보다 새 펌웨어가 있으면 돌려준다. 빌드가 같은 것만 본다. */
export function findUpdate(manifest: FirmwareManifest, info: DeviceInfo): FirmwareRelease | null {
  if (!info.build || !info.otaMaxLen) return null;
  const entry = manifest.builds[info.build];
  if (!entry) return null;
  const newer = compareVersions(entry.version, info.fw);
  return newer !== null && newer > 0 ? { ...entry, build: info.build } : null;
}

function isManifest(value: unknown): value is FirmwareManifest {
  if (typeof value !== 'object' || value === null) return false;
  const builds = (value as { builds?: unknown }).builds;
  if (typeof builds !== 'object' || builds === null) return false;
  return Object.values(builds).every(
    (b) =>
      typeof b === 'object' &&
      b !== null &&
      typeof (b as FirmwareRelease).version === 'string' &&
      typeof (b as FirmwareRelease).file === 'string' &&
      typeof (b as FirmwareRelease).size === 'number' &&
      typeof (b as FirmwareRelease).sha256 === 'string',
  );
}

/** manifest.json 을 받는다. 아직 올린 펌웨어가 없으면(404) null. */
export async function fetchManifest(baseUrl: string): Promise<FirmwareManifest | null> {
  const response = await fetch(new URL(MANIFEST_PATH, baseUrl), { cache: 'no-cache' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`업데이트 정보를 받지 못했습니다 (HTTP ${response.status})`);
  // 개발 서버는 없는 파일에 index.html 을 돌려주기도 한다.
  if (!(response.headers.get('content-type') ?? '').includes('json')) return null;
  const json: unknown = await response.json();
  if (!isManifest(json)) throw new Error('업데이트 정보 형식이 맞지 않습니다');
  return json;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 펌웨어 파일을 받아 크기, SHA-256, 파일 안의 버전·빌드가 manifest 와 맞는지 확인한다. */
export async function downloadRelease(release: FirmwareRelease, baseUrl: string): Promise<Uint8Array> {
  const url = new URL(release.file, new URL(MANIFEST_PATH, baseUrl));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`펌웨어 파일을 받지 못했습니다 (HTTP ${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== release.size) {
    throw new Error(`받은 파일 크기가 다릅니다 (${bytes.length} / ${release.size} bytes)`);
  }
  const hash = toHex(await crypto.subtle.digest('SHA-256', bytes));
  if (hash !== release.sha256.toLowerCase()) throw new Error('받은 파일이 손상됐습니다 (SHA-256 불일치)');
  const parsed = parseFirmware(bytes);
  if (parsed.version !== release.version || parsed.build !== release.build) {
    throw new Error(`파일 안의 정보(${parsed.version}, ${parsed.build})가 업데이트 정보와 다릅니다`);
  }
  return bytes;
}
