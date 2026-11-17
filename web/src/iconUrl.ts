// 프로필 아이콘 받기 규칙.
//
// 아이콘은 SEGA 서버(maimaidx-eng.com / maimaidx.jp)에 있는데, CORS 헤더가 없어서 브라우저가 픽셀을 읽지 못하고
// (4색 디더링을 못 한다) Cloudflare Worker 에서는 SEGA 서버에 연결이 안 된다 (배포 520, 로컬 "Network connection lost").
// 그래서 캐롤봇 서버의 아이콘 중계 API 에서 받는다: GET https://maimai.team-carol.com/api/icon/{id} (CORS 허용).

export const CAROL_ICON_API = 'https://maimai.team-carol.com/api/icon/';
export const ICON_MAX_BYTES = 512 * 1024;

const ICON_HOSTS = ['maimaidx-eng.com', 'maimaidx.jp'];
const ICON_PATH = /^\/maimai-mobile\/img\/Icon\/([0-9a-f]{16})\.png$/;

/** maishift 가 알려 준 SEGA 아이콘 주소에서 아이콘 id(16진수 16자리)를 꺼낸다. 다른 주소면 null. */
export function iconId(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !ICON_HOSTS.includes(url.hostname) || url.search) return null;
  return ICON_PATH.exec(url.pathname)?.[1] ?? null;
}

/** 아이콘을 받을 캐롤봇 주소. 받을 수 없는 아이콘 주소면 null. */
export function carolIconUrl(iconUrl: string): string | null {
  const id = iconId(iconUrl);
  return id ? `${CAROL_ICON_API}${id}` : null;
}
