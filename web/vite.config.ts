import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages 같은 하위 경로에 올려도 동작하도록 상대 경로로 빌드한다.
  base: './',
  server: {
    // Web Bluetooth 는 https 나 localhost 에서만 동작한다.
    host: 'localhost',
    port: 5173,
  },
});
