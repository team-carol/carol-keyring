import assert from 'node:assert/strict';
import { test } from 'node:test';

import { carolIconUrl, iconId } from '../src/iconUrl.ts';

const ENG = 'https://maimaidx-eng.com/maimai-mobile/img/Icon/84b923fa041a1354.png';
const JP = 'https://maimaidx.jp/maimai-mobile/img/Icon/84b923fa041a1354.png';

test('SEGA 아이콘 주소에서 id 를 꺼낸다', () => {
  assert.equal(iconId(ENG), '84b923fa041a1354');
  assert.equal(iconId(JP), '84b923fa041a1354');
});

test('다른 주소는 받지 않는다', () => {
  for (const value of [
    'http://maimaidx-eng.com/maimai-mobile/img/Icon/84b923fa041a1354.png',
    'https://example.com/maimai-mobile/img/Icon/84b923fa041a1354.png',
    'https://maimaidx-eng.com/maimai-mobile/home/',
    'https://maimaidx-eng.com/maimai-mobile/img/Icon/84b923fa.png',
    `${ENG}?x=1`,
    'not a url',
  ]) {
    assert.equal(iconId(value), null, value);
  }
});

test('캐롤봇 아이콘 API 주소를 만든다', () => {
  assert.equal(carolIconUrl(ENG), 'https://maimai.team-carol.com/api/icon/84b923fa041a1354');
  assert.equal(carolIconUrl('https://example.com/a.png'), null);
});
