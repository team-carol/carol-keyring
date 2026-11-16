// 레이아웃 확인용 샘플 프로필. maishift 연동 전까지 쓴다.
// 레이팅 구간 11개를 하나씩 넣었다 (6색 패널에서 구간 색이 다 보이게).
// 레이팅 자릿수, 긴 칭호, 단위 이름 길이도 고루 섞었다. 실존 플레이어가 아니다.

import type { PlayerProfile } from './maishift.ts';

export interface ProfileSample {
  id: string;
  label: string;
  profile: PlayerProfile;
}

type SampleInput = Omit<PlayerProfile, 'iconUrl' | 'friendCode' | 'syncedAt' | 'playCount'> & { plays: number };

function sample(id: string, tierLabel: string, input: SampleInput): ProfileSample {
  const { plays, ...profile } = input;
  return {
    id,
    label: `${profile.rating} · ${tierLabel}`,
    profile: {
      ...profile,
      playCount: { total: plays, current: Math.round(plays / 6) },
      iconUrl: '',
      friendCode: null,
      syncedAt: '2026-11-16T09:30:00Z',
    },
  };
}

export const PROFILE_SAMPLES: ProfileSample[] = [
  sample('rainbow', '무지개', {
    name: 'ＣＡＲＯＬ',
    rating: 15234,
    title: { text: 'でらっくす譜面マスター', tier: 'RAINBOW' },
    classRank: 'LEGEND',
    courseRank: 'SHIN_KAIDEN',
    stars: 1873,
    plays: 4321,
  }),
  sample('platinum', '플래티넘', {
    name: 'ＰＬＡＴＩＮＡ',
    rating: 14712,
    title: { text: '天上の旋律', tier: 'RAINBOW' },
    classRank: 'SSS1',
    courseRank: 'SHIN_DAN_10',
    stars: 1402,
    plays: 3307,
  }),
  sample('gold', '금', {
    name: 'ＫＥＹＲＩＮＧ',
    rating: 14187,
    title: { text: '電子ペーパーの向こう側', tier: 'GOLD' },
    classRank: 'SSS3',
    courseRank: 'DAN_10',
    stars: 942,
    plays: 1580,
  }),
  sample('silver', '은', {
    name: 'ＳＩＬＶＥＲ',
    rating: 13560,
    title: { text: 'ゆびさきの魔術師', tier: 'GOLD' },
    classRank: 'SS1',
    courseRank: 'DAN_8',
    stars: 611,
    plays: 1102,
  }),
  sample('bronze', '동', {
    name: 'ＢＲＯＮＺＥ',
    rating: 12345,
    title: { text: 'リズムの申し子', tier: 'SILVER' },
    classRank: 'S2',
    courseRank: 'DAN_5',
    stars: 388,
    plays: 760,
  }),
  sample('purple', '보라', {
    name: 'ＭＵＲＡＳＡＫＩ',
    rating: 10980,
    title: { text: 'キーリング職人', tier: 'SILVER' },
    classRank: 'A1',
    courseRank: 'DAN_3',
    stars: 214,
    plays: 455,
  }),
  sample('red', '빨강', {
    name: 'ＭＡＩＭＡＩ',
    rating: 8123,
    title: { text: 'はじめての段位認定', tier: 'BRONZE' },
    classRank: 'A4',
    courseRank: 'DAN_1',
    stars: 97,
    plays: 231,
  }),
  sample('yellow', '노랑', {
    name: 'ＹＥＬＬＯＷ',
    rating: 5480,
    title: { text: 'ぐるぐる回る', tier: 'BRONZE' },
    classRank: 'B2',
    courseRank: 'NONE',
    stars: 41,
    plays: 102,
  }),
  sample('green', '초록', {
    name: 'ＭＩＤＯＲＩ',
    rating: 3021,
    title: { text: 'タッチパネル入門', tier: 'NORMAL' },
    classRank: 'B4',
    courseRank: 'NONE',
    stars: 12,
    plays: 38,
  }),
  sample('blue', '파랑', {
    name: 'ＡＯ',
    rating: 1520,
    title: { text: 'ようこそ', tier: 'NORMAL' },
    classRank: 'B5',
    courseRank: 'NONE',
    stars: 3,
    plays: 11,
  }),
  sample('white', '흰색', {
    name: 'ｍａｉｍａｉＤＸ',
    rating: 412,
    title: { text: 'はじめてのでらっくす！ようこそmaimaiの世界へ', tier: 'NORMAL' },
    classRank: 'B5',
    courseRank: 'NONE',
    stars: 0,
    plays: 2,
  }),
];
