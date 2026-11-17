import assert from 'node:assert/strict';
import { test } from 'node:test';

import { iconFetchUrls, isAllowedIconUrl } from '../src/iconUrl.ts';

const ENG = 'https://maimaidx-eng.com/maimai-mobile/img/Icon/84b923fa041a1354.png';
const JP = 'https://maimaidx.jp/maimai-mobile/img/Icon/84b923fa041a1354.png';

test('maimai DX NET 아이콘 경로만 받는다', () => {
  assert.ok(isAllowedIconUrl(ENG));
  assert.ok(isAllowedIconUrl(JP));
  assert.ok(!isAllowedIconUrl('http://maimaidx-eng.com/maimai-mobile/img/Icon/84b923fa041a1354.png'));
  assert.ok(!isAllowedIconUrl('https://example.com/maimai-mobile/img/Icon/84b923fa041a1354.png'));
  assert.ok(!isAllowedIconUrl('https://maimaidx-eng.com/maimai-mobile/home/'));
  assert.ok(!isAllowedIconUrl(`${ENG}?x=1`));
});

test('eng 아이콘은 jp 서버를 먼저, 원래 주소를 다음으로 시도한다', () => {
  assert.deepEqual(iconFetchUrls(ENG), [JP, ENG]);
  assert.deepEqual(iconFetchUrls(JP), [JP]);
  assert.deepEqual(iconFetchUrls('https://example.com/a.png'), []);
});
