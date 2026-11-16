import '@team-carol/design-system/carol.css';
import './app.css';

import { color, fontUrls } from '@team-carol/design-system';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';

// 글꼴과 모바일 브라우저 상단 색은 디자인 시스템 토큰에서 가져온다.
for (const href of Object.values(fontUrls)) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}
const themeColor = document.createElement('meta');
themeColor.name = 'theme-color';
themeColor.content = color.canvas;
document.head.append(themeColor);

const root = document.getElementById('root');
if (!root) throw new Error('#root 가 없다');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
