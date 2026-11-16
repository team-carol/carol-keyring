// 빌드한 펌웨어를 웹이 올려 둘 수 있는 곳(web/public/firmware)에 복사하고 manifest.json 을 만든다.
// 웹은 이 manifest 를 보고 연결된 키링보다 새 펌웨어가 있으면 업데이트를 띄운다.
//
//   pio run -e seeed213_bwry           (firmware 폴더에서)
//   pnpm firmware:publish              빌드된 env 를 모두 올린다
//   pnpm firmware:publish seeed213_bwry  고른 env 만 올린다 (나머지는 manifest 에 그대로 둔다)
//
// web/public 은 Vite 가 그대로 dist 로 복사하므로 pnpm build 결과에 같이 들어간다.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'firmware', '.pio', 'build');
const outDir = join(root, 'web', 'public', 'firmware');
const manifestPath = join(outDir, 'manifest.json');

const TAG = Buffer.from('CAROL-KEYRING-FW|');

/** 펌웨어 안의 "CAROL-KEYRING-FW|<버전>|<env>|" 를 읽는다 (web/src/protocol.ts 의 parseFirmware 와 같은 규칙). */
function readTag(bytes) {
  if (bytes[0] !== 0xe9) throw new Error('ESP32 이미지가 아니다');
  const start = bytes.indexOf(TAG);
  if (start < 0) throw new Error('캐롤 키링 펌웨어 표시가 없다');
  const text = bytes.subarray(start + TAG.length, start + TAG.length + 128).toString('utf8');
  const [version, build] = text.split('|');
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error(`버전 모양이 아니다: ${version}`);
  return { version, build };
}

const wanted = process.argv.slice(2);
const envs = existsSync(buildDir)
  ? readdirSync(buildDir).filter((env) => existsSync(join(buildDir, env, 'firmware.bin')))
  : [];
const targets = wanted.length > 0 ? wanted : envs;
if (targets.length === 0) {
  console.error('올릴 펌웨어가 없다. firmware 폴더에서 pio run -e <env> 로 먼저 빌드한다.');
  process.exit(1);
}

const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { builds: {} };

for (const env of targets) {
  const source = join(buildDir, env, 'firmware.bin');
  if (!existsSync(source)) {
    console.error(`${env}: ${source} 가 없다`);
    process.exit(1);
  }
  const bytes = readFileSync(source);
  const { version, build } = readTag(bytes);
  if (build !== env) throw new Error(`${env}: 펌웨어 안의 빌드 이름이 ${build} 다`);

  const file = `${env}/carol-keyring-${env}-${version}.bin`;
  // 같은 env 의 예전 파일은 지운다. manifest 는 env 마다 최신 하나만 가리킨다.
  rmSync(join(outDir, env), { recursive: true, force: true });
  mkdirSync(join(outDir, env), { recursive: true });
  copyFileSync(source, join(outDir, file));

  manifest.builds[env] = {
    version,
    file,
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  console.log(`${env}: ${version} (${bytes.length} bytes) → web/public/firmware/${file}`);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('web/public/firmware/manifest.json 갱신');
