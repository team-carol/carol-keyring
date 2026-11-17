import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_LAYOUT, decodeLayout, encodeLayout, normalizeLayout } from '../src/layout.ts';

test('기본 레이아웃은 검사를 그대로 통과한다', () => {
  assert.deepEqual(normalizeLayout(structuredClone(DEFAULT_LAYOUT)), DEFAULT_LAYOUT);
});

test('공유 문자열로 바꿨다가 되돌리면 같다', async () => {
  const code = await encodeLayout(DEFAULT_LAYOUT);
  assert.match(code, /^[A-Za-z0-9_-]+$/, '주소에 그대로 넣을 수 있는 글자만 쓴다');
  assert.ok(code.length < 600, `링크가 너무 길지 않다 (${code.length}자)`);
  assert.deepEqual(await decodeLayout(code), DEFAULT_LAYOUT);
});

test('범위를 벗어난 값은 화면 안으로 맞추고, 모르는 항목은 버린다', () => {
  const layout = normalizeLayout({
    v: 1,
    w: 250,
    h: 122,
    elements: [
      { id: 'a', kind: 'rating', x: 999, y: -5, w: 9999, h: 40, box: 'weird', size: 500 },
      { id: 'b', kind: 'script', x: 0, y: 0, w: 10, h: 10 },
      { id: 'c', kind: 'text', x: 0, y: 0, w: 50, h: 10, text: 'x'.repeat(100) },
    ],
  });
  assert.equal(layout.elements.length, 2);
  const [rating, text] = layout.elements;
  assert.deepEqual([rating.x, rating.y, rating.w, rating.h], [0, 0, 250, 40]);
  assert.equal(rating.box, 'outline');
  assert.equal(rating.size, 80);
  assert.equal(text.text?.length, 40);
});

test('손상된 공유 문자열은 알아들을 수 있는 오류를 낸다', async () => {
  await assert.rejects(decodeLayout('not-a-layout'), /손상/);
  await assert.rejects(Promise.resolve().then(() => normalizeLayout({ v: 2, elements: [] })), /버전/);
});
