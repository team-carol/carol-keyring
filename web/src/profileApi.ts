// 같은 주소의 Worker(/api/profile)에서 maishift 프로필을 받는다. API 키는 Worker 에만 있다.

import type { ProfileResponse, Region } from './maishift.ts';

/**
 * 프로필 아이콘을 Worker 를 거쳐 받는다. 원래 주소(SEGA 서버)는 CORS 헤더가 없어서 브라우저가 픽셀을 읽지 못한다.
 * 같은 주소로 받으면 캔버스에서 읽을 수 있어 디더링할 수 있다.
 */
export async function fetchProfileIcon(handle: string, iconUrl: string, region: Region = 'intl'): Promise<ImageBitmap> {
  const url = new URL(`api/profile/${encodeURIComponent(handle.trim())}/icon`, document.baseURI);
  url.searchParams.set('region', region);
  const response = await fetch(url);
  if (response.ok) return createImageBitmap(await response.blob());

  // 개발 서버에서는 로컬 Worker 런타임이 아이콘 서버와 연결이 끊겨서, Vite 개발 서버로 대신 받는다 (vite.config.ts).
  if (import.meta.env.DEV) {
    const dev = await fetch(`/__dev/icon?url=${encodeURIComponent(iconUrl)}`);
    if (dev.ok) return createImageBitmap(await dev.blob());
  }
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? `아이콘을 받지 못했습니다 (HTTP ${response.status})`);
}

export async function fetchProfile(handle: string, region: Region = 'intl'): Promise<ProfileResponse> {
  const url = new URL(`api/profile/${encodeURIComponent(handle.trim())}`, document.baseURI);
  url.searchParams.set('region', region);
  const response = await fetch(url);
  const body = (await response.json().catch(() => null)) as (ProfileResponse & { error?: string }) | null;
  if (!response.ok || !body || body.error) {
    throw new Error(body?.error ?? `프로필을 받지 못했습니다 (HTTP ${response.status})`);
  }
  return body;
}
