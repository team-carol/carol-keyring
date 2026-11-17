import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // cloudflare(): pnpm dev 에서 worker/index.ts 를 Cloudflare 런타임(workerd)으로 같이 띄우고,
  // pnpm build 에서 웹(dist/client)과 Worker 를 함께 빌드한다. 설정은 wrangler.jsonc.
  plugins: [react(), cloudflare()],
  // 하위 경로에 올려도 동작하도록 상대 경로로 빌드한다.
  base: './',
  server: {
    // Web Bluetooth 는 https 나 localhost 에서만 동작한다.
    host: 'localhost',
    port: 5173,
  },
});
