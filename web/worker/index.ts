// carol-keyring Worker: /api/* 만 여기로 온다. 나머지(웹)는 정적 파일로 바로 나간다.
//
// GET /api/profile/{handle}?region=intl
//   maishift 의 공개 프로필을 대신 받아 준다. API 키는 브라우저에 보내지 않고 Worker 비밀값(MAISHIFT_API_KEY)으로 둔다.
//   같은 프로필은 5분 동안 캐시해서 maishift 호출 한도(앱 전체 120, 초당 2 회복)를 아낀다.
//   아이콘은 Worker 가 SEGA 서버에 연결하지 못해서 브라우저가 캐롤봇 API 에서 받는다 (src/iconUrl.ts).
//
// GET /api/firmware/manifest.json
// GET /api/firmware/{env}/carol-keyring-{env}-{버전}.bin
//   R2 버킷(FIRMWARE)에 올린 펌웨어. 웹 배포와 따로 pnpm firmware:release 로 올린다 (src/firmwareStore.ts).
//   manifest 는 매번 새로 확인하게 하고, .bin 은 이름에 버전이 들어가고 한 번 올리면 바뀌지 않으니 오래 캐시한다.
//
// 오류는 { "error": "<사용자에게 보여 줄 문장>" } 와 알맞은 HTTP 상태로 돌려준다.

import { FIRMWARE_API_PREFIX, MANIFEST_KEY, parseFirmwareKey } from '../src/firmwareStore.ts';
import type { ProfileResponse, Region } from '../src/maishift.ts';

type WorkerEnv = Env & {
  /** maishift Settings > Developer 에서 발급. 로컬은 .dev.vars, 배포는 wrangler secret put */
  MAISHIFT_API_KEY?: string;
};

const MAISHIFT_ORIGIN = 'https://maimai.shiftpsh.com';
const PROFILE_CACHE_SECONDS = 300;
const REGIONS: readonly Region[] = ['intl', 'jp', 'na'];


function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

function error(status: number, message: string, headers: HeadersInit = {}): Response {
  return json({ error: message }, status, headers);
}

/** 프로필을 캐시나 maishift 에서 가져온다. 실패하면 그대로 돌려줄 오류 응답을 준다. */
async function loadProfile(
  handle: string,
  region: Region,
  env: WorkerEnv,
  ctx: ExecutionContext,
): Promise<{ data: ProfileResponse; cache: 'HIT' | 'MISS' } | { response: Response }> {
  const apiKey = env.MAISHIFT_API_KEY;
  if (!apiKey) return { response: error(503, '서버에 maishift API 키가 설정되지 않았습니다.') };

  // 캐시 키는 실제로 열리지 않는 내부 주소다. 핸들은 대소문자를 구분하지 않는다고 보고 소문자로 맞춘다.
  const cacheKey = new Request(
    `https://cache.carol-keyring.internal/profile/${region}/${encodeURIComponent(handle.toLowerCase())}`,
  );
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return { data: (await cached.json()) as ProfileResponse, cache: 'HIT' };

  const upstream = await fetch(`${MAISHIFT_ORIGIN}/api/v1/profiles/${encodeURIComponent(handle)}?region=${region}`, {
    headers: { 'X-API-Key': apiKey, accept: 'application/json', 'user-agent': 'carol-keyring' },
  });

  if (upstream.status === 404) {
    return {
      response: error(404, '프로필을 찾을 수 없습니다. 핸들이 맞는지, maishift 에서 프로필을 공개했는지 확인해 주세요.'),
    };
  }
  if (upstream.status === 403) return { response: error(403, '이 프로필은 공개되어 있지 않습니다.') };
  if (upstream.status === 429) {
    const retryAfter = upstream.headers.get('retry-after') ?? '60';
    return {
      response: error(429, `요청이 너무 많습니다. ${retryAfter}초 뒤에 다시 시도해 주세요.`, { 'retry-after': retryAfter }),
    };
  }
  if (upstream.status === 401) return { response: error(502, '서버의 maishift API 키가 올바르지 않습니다.') };
  if (!upstream.ok) return { response: error(502, `maishift 가 응답하지 않습니다 (HTTP ${upstream.status}).`) };

  const raw = (await upstream.json()) as ProfileResponse;
  // 화면에 쓰는 필드만 남긴다.
  const data: ProfileResponse = { handle: raw.handle, region: raw.region, regions: raw.regions, profile: raw.profile };
  ctx.waitUntil(
    cache.put(
      cacheKey,
      new Response(JSON.stringify(data), {
        headers: { 'content-type': 'application/json', 'cache-control': `max-age=${PROFILE_CACHE_SECONDS}` },
      }),
    ),
  );
  return { data, cache: 'MISS' };
}

async function getFirmware(key: string, request: Request, env: WorkerEnv): Promise<Response> {
  const isManifest = key === MANIFEST_KEY;
  if (!isManifest && !parseFirmwareKey(key)) return error(404, '없는 펌웨어 파일입니다.');

  const object = await env.FIRMWARE.get(key, { onlyIf: request.headers });
  if (!object) return error(404, isManifest ? '아직 배포한 펌웨어가 없습니다.' : '없는 펌웨어 파일입니다.');

  const headers = new Headers({ etag: object.httpEtag, 'x-content-type-options': 'nosniff' });
  if (isManifest) {
    headers.set('content-type', 'application/json; charset=utf-8');
    headers.set('cache-control', 'no-cache');
  } else {
    headers.set('content-type', 'application/octet-stream');
    headers.set('cache-control', 'public, max-age=31536000, immutable');
  }
  // If-None-Match 가 맞으면 body 없이 돌아온다.
  if (!('body' in object)) return new Response(null, { status: 304, headers });
  headers.set('content-length', String(object.size));
  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'GET') return error(405, 'GET 만 지원합니다.', { allow: 'GET' });

    if (url.pathname.startsWith(FIRMWARE_API_PREFIX)) {
      try {
        return await getFirmware(url.pathname.slice(FIRMWARE_API_PREFIX.length), request, env);
      } catch (cause) {
        console.error('firmware', cause);
        return error(502, '펌웨어 저장소에 연결하지 못했습니다.');
      }
    }

    const match = /^\/api\/profile\/([^/]+)$/.exec(url.pathname);
    if (!match) return error(404, '없는 API 입니다.');

    const handle = decodeURIComponent(match[1]).trim();
    if (handle.length < 1 || handle.length > 32) return error(400, '핸들은 1~32자입니다.');
    const region = (url.searchParams.get('region') ?? 'intl') as Region;
    if (!REGIONS.includes(region)) return error(400, `region 은 ${REGIONS.join(', ')} 중 하나입니다.`);

    try {
      const result = await loadProfile(handle, region, env, ctx);
      if ('response' in result) return result.response;
      return json(result.data, 200, { 'x-cache': result.cache });
    } catch (cause) {
      console.error('profile', cause);
      return error(502, 'maishift 에 연결하지 못했습니다.');
    }
  },
} satisfies ExportedHandler<WorkerEnv>;
