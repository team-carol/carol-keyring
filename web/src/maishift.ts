// maishift(https://maimai.shiftpsh.com) 프로필 응답 형식과 화면에 쓰는 이름표.
// GET /api/v1/profiles/{handle} 의 응답이다. 받아 오는 코드는 나중에 붙인다.

export type Region = 'intl' | 'jp' | 'na';

/** 칭호 판 색 */
export type TitleTier = 'NORMAL' | 'BRONZE' | 'SILVER' | 'GOLD' | 'RAINBOW';

/** 클래스. B5 가 가장 낮고 LEGEND 가 가장 높다. */
export type ClassRank =
  | `B${1 | 2 | 3 | 4 | 5}`
  | `A${1 | 2 | 3 | 4 | 5}`
  | `S${1 | 2 | 3 | 4 | 5}`
  | `SS${1 | 2 | 3 | 4 | 5}`
  | `SSS${1 | 2 | 3 | 4 | 5}`
  | 'LEGEND';

type Ten = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** 단위. null 은 이 목록보다 나중에 게임에 생긴 단위다. */
export type CourseRank = 'NONE' | `DAN_${Ten}` | `SHIN_DAN_${Ten}` | 'SHIN_KAIDEN' | 'URA_KAIDEN';

export interface PlayerProfile {
  /** 게임 안 이름 */
  name: string;
  rating: number;
  iconUrl: string;
  title: { text: string; tier: TitleTier };
  classRank: ClassRank;
  courseRank: CourseRank | null;
  stars: number;
  /** current 는 지금 버전에서 한 판 수 */
  playCount: { total: number; current: number } | null;
  /** 플레이어가 공개했을 때만 있다 */
  friendCode: string | null;
  /** ISO 8601 UTC */
  syncedAt: string;
}

export interface ProfileResponse {
  handle: string;
  region: Region;
  regions: Region[];
  profile: PlayerProfile;
}

const KANJI_NUMBERS = ['初', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/** 게임에 나오는 단위 이름 (初段, 真十段, 裏皆伝 …) */
export function courseRankLabel(rank: CourseRank | null): string | null {
  if (rank === null) return null;
  if (rank === 'NONE') return '初心者';
  if (rank === 'SHIN_KAIDEN') return '真皆伝';
  if (rank === 'URA_KAIDEN') return '裏皆伝';
  const shin = rank.startsWith('SHIN_DAN_');
  const n = Number(rank.slice(shin ? 'SHIN_DAN_'.length : 'DAN_'.length));
  return `${shin ? '真' : ''}${KANJI_NUMBERS[n - 1]}段`;
}

/** 레이팅 구간. 게임에서 레이팅 판 색이 이 구간으로 바뀐다. */
export type RatingTier =
  | 'white'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'red'
  | 'purple'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'rainbow';

const RATING_TIERS: [number, RatingTier][] = [
  [15000, 'rainbow'],
  [14500, 'platinum'],
  [14000, 'gold'],
  [13000, 'silver'],
  [12000, 'bronze'],
  [10000, 'purple'],
  [7000, 'red'],
  [4000, 'yellow'],
  [2000, 'green'],
  [1000, 'blue'],
];

export function ratingTier(rating: number): RatingTier {
  return RATING_TIERS.find(([min]) => rating >= min)?.[1] ?? 'white';
}
