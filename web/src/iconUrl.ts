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

/**
 * 아이콘을 받아 볼 주소들, 먼저 시도할 순서대로.
 * Cloudflare Worker(workerd)는 maimaidx-eng.com 에 TLS 연결을 맺지 못한다 (배포 520, 로컬 "Network connection lost").
 * 같은 아이콘이 같은 경로로 maimaidx.jp 에도 있어서 그쪽을 먼저 받고, 안 되면 원래 주소로 한 번 더 시도한다.
 */
export function iconFetchUrls(value: string): string[] {
  if (!isAllowedIconUrl(value)) return [];
  const url = new URL(value);
  if (url.hostname !== 'maimaidx-eng.com') return [url.href];
  const jp = new URL(url.href);
  jp.hostname = 'maimaidx.jp';
  return [jp.href, url.href];
}
