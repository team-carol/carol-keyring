// 배포한 펌웨어를 두는 곳(Cloudflare R2)의 규칙. Worker, 웹, 배포 스크립트(scripts/release-firmware.mjs)가 같이 쓴다.
// Node 가 타입만 지우고 바로 불러 쓰므로 TS 전용 문법(enum 등)은 쓰지 않는다.
//
// 버킷 안:
//   manifest.json                                   빌드(env)마다 최신 펌웨어 하나
//   <env>/carol-keyring-<env>-<버전>.bin             펌웨어 파일. 예전 버전도 지우지 않고 남긴다.
//
// 웹에서는 /api/firmware/<버킷 안 경로> 로 받는다.

export const FIRMWARE_BUCKET = 'carol-keyring-firmware';
export const MANIFEST_KEY = 'manifest.json';
export const FIRMWARE_API_PREFIX = '/api/firmware/';

const ENV_PATTERN = /^[a-z0-9_]{1,32}$/;
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/** "1.2.3" → [1, 2, 3]. 그 밖의 모양("demo", "1.2.3-rc")은 null. */
export function parseVersion(version: string): [number, number, number] | null {
  const match = VERSION_PATTERN.exec(version.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** a 가 b 보다 새로우면 양수. 둘 중 하나라도 버전 모양이 아니면 null. */
export function compareVersions(a: string, b: string): number | null {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) return null;
  for (let i = 0; i < 3; i++) {
    if (va[i] !== vb[i]) return va[i] - vb[i];
  }
  return 0;
}

/** env 와 버전으로 펌웨어 파일의 버킷 안 경로를 만든다. manifest 의 file 에도 이 값이 들어간다. */
export function firmwareKey(env: string, version: string): string {
  if (!ENV_PATTERN.test(env)) throw new Error(`빌드 이름 모양이 아니다: ${env}`);
  if (!VERSION_PATTERN.test(version)) throw new Error(`버전 모양이 아니다: ${version}`);
  return `${env}/carol-keyring-${env}-${version}.bin`;
}

/** 버킷 안 경로가 펌웨어 파일이면 env 와 버전을 돌려준다. 그 밖의 경로(../, 다른 파일)는 null. */
export function parseFirmwareKey(key: string): { env: string; version: string } | null {
  const match = /^([a-z0-9_]{1,32})\/carol-keyring-([a-z0-9_]{1,32})-(\d+\.\d+\.\d+)\.bin$/.exec(key);
  if (!match || match[1] !== match[2]) return null;
  return { env: match[1], version: match[3] };
}
