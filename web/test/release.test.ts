import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DeviceInfo } from '../src/protocol.ts';
import { compareVersions, findUpdate, parseVersion } from '../src/release.ts';
import type { FirmwareManifest } from '../src/release.ts';

const INFO: DeviceInfo = {
  proto: 1,
  fw: '0.1.0',
  panel: 'seeed213_bwry',
  w: 122,
  h: 250,
  rot: 90,
  fmt: '2bpp-bwry',
  palette: [],
  refreshMs: 25000,
  maxLen: 7750,
  build: 'seeed213_bwry',
  otaMaxLen: 1310720,
};

function manifest(version: string, build = 'seeed213_bwry'): FirmwareManifest {
  return { builds: { [build]: { version, file: `${build}/x.bin`, size: 1000, sha256: 'ab' } } };
}

test('버전은 x.y.z 숫자만 읽는다', () => {
  assert.deepEqual(parseVersion('0.10.2'), [0, 10, 2]);
  assert.equal(parseVersion('demo'), null);
  assert.equal(parseVersion('1.2.3-rc1'), null);
  assert.equal(parseVersion('1.2'), null);
});

test('버전 비교는 자리마다 숫자로 한다', () => {
  assert.ok((compareVersions('0.10.0', '0.9.9') ?? 0) > 0);
  assert.ok((compareVersions('0.1.0', '0.1.1') ?? 0) < 0);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('demo', '1.0.0'), null);
});

test('같은 빌드의 더 새 버전만 업데이트로 본다', () => {
  assert.equal(findUpdate(manifest('0.1.1'), INFO)?.version, '0.1.1');
  assert.equal(findUpdate(manifest('0.1.1'), INFO)?.build, 'seeed213_bwry');
  assert.equal(findUpdate(manifest('0.1.0'), INFO), null, '같은 버전');
  assert.equal(findUpdate(manifest('0.0.9'), INFO), null, '더 옛 버전');
  assert.equal(findUpdate(manifest('0.2.0', 'ws154_e6'), INFO), null, '다른 빌드');
});

test('무선 업데이트를 못 하는 기기나 버전을 모르는 기기에는 알리지 않는다', () => {
  assert.equal(findUpdate(manifest('0.2.0'), { ...INFO, otaMaxLen: 0 }), null);
  assert.equal(findUpdate(manifest('0.2.0'), { ...INFO, build: undefined }), null);
  assert.equal(findUpdate(manifest('0.2.0'), { ...INFO, fw: 'demo' }), null);
});
