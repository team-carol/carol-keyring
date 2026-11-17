// 같은 주소의 Worker(/api/profile)에서 maishift 프로필을 받는다. API 키는 Worker 에만 있다.
// 아이콘은 캐롤봇의 아이콘 중계 API 에서 받는다 (src/iconUrl.ts).

import { ICON_MAX_BYTES, carolIconUrl } from './iconUrl.ts';
import type { ProfileResponse, Region } from './maishift.ts';

/** 프로필 아이콘을 캐롤봇에서 받는다. CORS 가 열려 있어 캔버스에서 픽셀을 읽고 디더링할 수 있다. */
export async function fetchProfileIcon(iconUrl: string): Promise<ImageBitmap> {
  const url = carolIconUrl(iconUrl);
  if (!url) throw new Error('받을 수 없는 아이콘 주소입니다.');
  const response = await fetch(url);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(`아이콘을 받지 못했습니다 (${body?.error ?? `HTTP ${response.status}`})`);
  }
  const blob = await response.blob();
  if (!blob.type.startsWith('image/') || blob.size > ICON_MAX_BYTES) throw new Error('아이콘 파일이 이상합니다.');
  return createImageBitmap(blob);
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
