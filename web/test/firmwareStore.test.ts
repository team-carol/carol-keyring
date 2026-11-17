import assert from 'node:assert/strict';
import { test } from 'node:test';

import { firmwareKey, parseFirmwareKey } from '../src/firmwareStore.ts';
import { MANIFEST_PATH } from '../src/release.ts';

test('펌웨어 파일 경로를 만들고 다시 읽는다', () => {
  const key = firmwareKey('seeed213_bwry', '0.1.0');
  assert.equal(key, 'seeed213_bwry/carol-keyring-seeed213_bwry-0.1.0.bin');
  assert.deepEqual(parseFirmwareKey(key), { env: 'seeed213_bwry', version: '0.1.0' });
});

test('펌웨어 파일이 아닌 경로는 받지 않는다', () => {
  for (const key of [
    'manifest.json',
    '../.dev.vars',
    'seeed213_bwry/../manifest.json',
    'seeed213_bwry/carol-keyring-ws154_e6-0.1.0.bin',
    'seeed213_bwry/carol-keyring-seeed213_bwry-0.1.bin',
    'seeed213_bwry/carol-keyring-seeed213_bwry-0.1.0.bin/x',
    'SEEED/carol-keyring-SEEED-0.1.0.bin',
  ]) {
    assert.equal(parseFirmwareKey(key), null, key);
  }
});

test('이상한 env·버전으로는 경로를 만들지 않는다', () => {
  assert.throws(() => firmwareKey('../x', '0.1.0'));
  assert.throws(() => firmwareKey('seeed213_bwry', '0.1.0-rc1'));
});

test('웹은 Worker 의 /api/firmware/ 에서 manifest 를 받는다', () => {
  assert.equal(new URL(MANIFEST_PATH, 'https://keyring.example/').pathname, '/api/firmware/manifest.json');
});
