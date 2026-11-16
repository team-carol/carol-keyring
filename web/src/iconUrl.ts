// 받아도 되는 프로필 아이콘 주소인지. Worker 와 개발 서버(vite.config.ts)가 같이 쓴다.
// 아무 주소나 받아 주는 통로가 되지 않게 maimai DX NET 의 아이콘 이미지 경로만 허용한다.

const ICON_HOSTS = ['maimaidx-eng.com', 'maimaidx.jp'];
const ICON_PATH = /^\/maimai-mobile\/img\/Icon\/[0-9a-f]+\.png$/;

export const ICON_MAX_BYTES = 512 * 1024;

export function isAllowedIconUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && ICON_HOSTS.includes(url.hostname) && ICON_PATH.test(url.pathname) && !url.search;
}
