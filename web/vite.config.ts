import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

import { ICON_MAX_BYTES, isAllowedIconUrl } from './src/iconUrl.ts';

/**
 * 개발 서버 전용 아이콘 통로 (/__dev/icon?url=...).
 * 로컬 Worker 런타임(workerd)은 maimaidx-eng.com 과 TLS 연결이 끊긴다 ("Network connection lost").
 * curl, Node, OpenSSL 로는 받아지고 다른 사이트는 Worker 에서도 받아져서, 로컬 런타임과 그 서버 사이의 문제로 본다.
 * 그래서 개발할 때만 Node 로 대신 받는다. 배포본에는 들어가지 않고, 배포본은 Worker 의 /api/profile/{handle}/icon 을 쓴다.
 */
function devIconProxy(): Plugin {
  return {
    name: 'carol-dev-icon',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/icon', (req, res) => {
        const target = new URL(req.url ?? '', 'http://localhost').searchParams.get('url') ?? '';
        if (!isAllowedIconUrl(target)) {
          res.statusCode = 400;
          res.end('받을 수 없는 아이콘 주소');
          return;
        }
        fetch(target, { headers: { 'user-agent': 'carol-keyring-dev' } })
          .then(async (upstream) => {
            const type = upstream.headers.get('content-type') ?? '';
            const body = Buffer.from(await upstream.arrayBuffer());
            if (!upstream.ok || !type.startsWith('image/') || body.length > ICON_MAX_BYTES) {
              res.statusCode = 502;
              res.end(`아이콘을 받지 못함 (HTTP ${upstream.status})`);
              return;
            }
            res.setHeader('content-type', type);
            res.setHeader('cache-control', 'no-store');
            res.end(body);
          })
          .catch(() => {
            res.statusCode = 502;
            res.end('아이콘 서버에 연결하지 못함');
          });
      });
    },
  };
}

export default defineConfig({
  // cloudflare(): pnpm dev 에서 worker/index.ts 를 Cloudflare 런타임(workerd)으로 같이 띄우고,
  // pnpm build 에서 웹(dist/client)과 Worker 를 함께 빌드한다. 설정은 wrangler.jsonc.
  plugins: [devIconProxy(), react(), cloudflare()],
  // 하위 경로에 올려도 동작하도록 상대 경로로 빌드한다.
  base: './',
  server: {
    // Web Bluetooth 는 https 나 localhost 에서만 동작한다.
    host: 'localhost',
    port: 5173,
  },
});
