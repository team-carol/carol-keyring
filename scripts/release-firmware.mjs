// 펌웨어를 빌드해서 R2 버킷에 올리고 manifest.json 을 바꾼다. 웹은 이 manifest 를 보고 업데이트를 띄운다.
// 웹 배포(pnpm cf:deploy)와 상관없이 따로 올린다. 규칙은 web/src/firmwareStore.ts.
//
//   pnpm firmware:release seeed213_bwry            로컬(pnpm dev 의 R2)에 올린다. 업데이트 시험용
//   pnpm firmware:release seeed213_bwry --remote   실제 배포 (wrangler login, 버킷 만들기가 먼저 필요)
//
// 순서: pio 빌드 → 펌웨어 안의 버전·빌드 표시 확인 → 올라가 있는 버전보다 새로운지 확인 → .bin 올리기 → manifest 바꾸기.
// manifest 를 맨 나중에 바꾸므로, 받는 사람은 올리는 도중에도 이전 펌웨어나 새 펌웨어 둘 중 하나를 온전히 받는다.
// 같은 버전을 다른 내용으로 다시 올리지 않는다 (웹이 .bin 을 오래 캐시한다). 고쳤으면 FW_VERSION 을 올린다.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FIRMWARE_BUCKET,
  MANIFEST_KEY,
  compareVersions,
  firmwareKey,
} from '../web/src/firmwareStore.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const firmwareDir = join(root, 'firmware');
const webDir = join(root, 'web');
const wranglerBin = join(webDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

const args = process.argv.slice(2);
const remote = args.includes('--remote');
const envs = args.filter((a) => !a.startsWith('--'));
const where = remote ? '--remote' : '--local';

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function platformioEnvs() {
  const ini = readFileSync(join(firmwareDir, 'platformio.ini'), 'utf8');
  return [...ini.matchAll(/^\[env:([^\]]+)\]/gm)].map((m) => m[1]);
}

if (!existsSync(wranglerBin)) fail('web 의 wrangler 를 찾지 못했다. 저장소 루트에서 pnpm install 을 먼저 한다.');
if (envs.length === 0) {
  fail(`올릴 빌드(env)를 적는다. 예: pnpm firmware:release seeed213_bwry [--remote]\n  env: ${platformioEnvs().join(', ')}`);
}
for (const env of envs) {
  if (!platformioEnvs().includes(env)) fail(`platformio.ini 에 없는 env 다: ${env}`);
}

/** PATH 의 pio, 없으면 PlatformIO 기본 설치 위치. PIO 환경 변수로 바꿀 수 있다. */
function findPio() {
  const candidates = [
    process.env.PIO,
    'pio',
    join(homedir(), '.platformio', 'penv', 'Scripts', 'pio.exe'),
    join(homedir(), '.platformio', 'penv', 'bin', 'pio'),
  ].filter(Boolean);
  for (const cmd of candidates) {
    if (spawnSync(cmd, ['--version'], { stdio: 'ignore' }).status === 0) return cmd;
  }
  fail('pio 를 찾지 못했다. PlatformIO 를 설치하거나 PIO 환경 변수에 pio 경로를 넣는다.');
}

function wrangler(wranglerArgs, options = {}) {
  return execFileSync(process.execPath, [wranglerBin, ...wranglerArgs], {
    cwd: webDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

/** 지금 올라가 있는 manifest. 아직 없으면 빈 manifest. */
function readManifest() {
  try {
    const out = wrangler(['r2', 'object', 'get', `${FIRMWARE_BUCKET}/${MANIFEST_KEY}`, '--pipe', where]);
    return JSON.parse(out.toString('utf8'));
  } catch (error) {
    const message = `${error.stderr ?? ''}${error.stdout ?? ''}${error.message ?? ''}`;
    if (/does not exist|not found|NoSuchKey/i.test(message)) return { builds: {} };
    if (error instanceof SyntaxError) fail('올라가 있는 manifest.json 을 읽지 못했다 (JSON 아님).');
    fail(`manifest.json 을 받지 못했다.\n${message.trim()}${remote ? '\n  wrangler login, 버킷 만들기를 했는지 확인한다 (README 참고).' : ''}`);
  }
}

function putObject(key, file, contentType) {
  try {
    wrangler(['r2', 'object', 'put', `${FIRMWARE_BUCKET}/${key}`, '--file', file, '--content-type', contentType, where]);
  } catch (error) {
    fail(`${key} 를 올리지 못했다.\n${`${error.stderr ?? ''}${error.stdout ?? ''}`.trim()}`);
  }
}

const TAG = Buffer.from('CAROL-KEYRING-FW|');

/** 펌웨어 안의 "CAROL-KEYRING-FW|<버전>|<env>|" 를 읽는다 (web/src/protocol.ts 의 parseFirmware 와 같은 규칙). */
function readTag(bytes) {
  if (bytes[0] !== 0xe9) throw new Error('ESP32 이미지가 아니다');
  const start = bytes.indexOf(TAG);
  if (start < 0) throw new Error('캐롤 키링 펌웨어 표시가 없다');
  const [version, build] = bytes.subarray(start + TAG.length, start + TAG.length + 128).toString('utf8').split('|');
  return { version, build };
}

console.log(`펌웨어 등록: ${envs.join(', ')} → R2 ${FIRMWARE_BUCKET} (${remote ? '실제 배포' : '로컬'})\n`);

const pio = findPio();
const manifest = readManifest();
manifest.builds ??= {};
let changed = false;

for (const env of envs) {
  console.log(`[${env}] 빌드`);
  const built = spawnSync(pio, ['run', '-e', env], { cwd: firmwareDir, stdio: 'inherit' });
  if (built.status !== 0) fail(`${env} 빌드 실패`);

  const binPath = join(firmwareDir, '.pio', 'build', env, 'firmware.bin');
  const bytes = readFileSync(binPath);
  let tag;
  try {
    tag = readTag(bytes);
  } catch (error) {
    fail(`${env}: ${error.message}`);
  }
  if (tag.build !== env) fail(`${env}: 펌웨어 안의 빌드 이름이 ${tag.build} 다`);
  const { version } = tag;
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const key = firmwareKey(env, version);

  const current = manifest.builds[env];
  if (current) {
    const order = compareVersions(version, current.version);
    if (order === null) fail(`${env}: 버전을 비교하지 못했다 (${version} / ${current.version})`);
    if (order < 0) fail(`${env}: ${version} 은 올라가 있는 ${current.version} 보다 낮다. FW_VERSION 을 올린다.`);
    if (order === 0) {
      if (current.sha256 === sha256) {
        console.log(`[${env}] ${version} 은 이미 올라가 있다. 건너뜀\n`);
        continue;
      }
      fail(`${env}: ${version} 이 이미 다른 내용으로 올라가 있다. 고쳤으면 platformio.ini 의 FW_VERSION 을 올린다.`);
    }
  }

  console.log(`[${env}] ${version} (${bytes.length} bytes) 올리는 중 → ${key}`);
  putObject(key, binPath, 'application/octet-stream');
  manifest.builds[env] = { version, file: key, size: bytes.length, sha256 };
  changed = true;
  console.log(`[${env}] 올림${current ? ` (${current.version} → ${version})` : ''}\n`);
}

if (!changed) {
  console.log('바뀐 것이 없어서 manifest.json 은 그대로 둔다.');
  process.exit(0);
}

const tempDir = mkdtempSync(join(tmpdir(), 'carol-keyring-'));
try {
  const manifestFile = join(tempDir, MANIFEST_KEY);
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  putObject(MANIFEST_KEY, manifestFile, 'application/json');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
console.log(`manifest.json 갱신 완료.${remote ? '' : ' pnpm dev 로 띄운 웹에서 바로 보인다.'}`);
