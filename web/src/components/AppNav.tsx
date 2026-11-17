import { TopBarLink, cx } from '@team-carol/design-system/react';
import type { MouseEvent, ReactNode } from 'react';

import type { Tab } from '../useTab.ts';

interface AppNavProps {
  tab: Tab;
  onNavigate: (tab: Tab) => void;
  /** top: 넓은 화면의 상단바 안, bottom: 폰의 아래 탭 막대. CSS 가 화면 너비에 맞는 쪽 하나만 보여 준다. */
  variant: 'top' | 'bottom';
  /** 탭 옆에 점을 찍고 화면 읽기 프로그램에 읽어 줄 말 (예: 기기 설정 → "새 펌웨어 있음") */
  badges?: Partial<Record<Tab, string>>;
}

function Badge({ text }: { text: string | undefined }) {
  if (!text) return null;
  return (
    <>
      <span className="kr-badge-dot" aria-hidden />
      <span className="kr-sr-only">, {text}</span>
    </>
  );
}

function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.3 3.6c.4-1.5 3-1.5 3.4 0a1.7 1.7 0 0 0 2.6 1.1c1.4-.8 3.2 1 2.4 2.4a1.7 1.7 0 0 0 1.1 2.6c1.5.4 1.5 3 0 3.4a1.7 1.7 0 0 0-1.1 2.6c.8 1.4-1 3.2-2.4 2.4a1.7 1.7 0 0 0-2.6 1.1c-.4 1.5-3 1.5-3.4 0a1.7 1.7 0 0 0-2.6-1.1c-1.4.8-3.2-1-2.4-2.4a1.7 1.7 0 0 0-1.1-2.6c-1.5-.4-1.5-3 0-3.4a1.7 1.7 0 0 0 1.1-2.6c-.8-1.4 1-3.2 2.4-2.4a1.7 1.7 0 0 0 2.6-1.1Z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LayoutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      <path strokeLinecap="round" d="M3.5 11h17M10 11v8" />
    </svg>
  );
}

const ITEMS: { tab: Tab; label: string; href: string; icon: ReactNode }[] = [
  { tab: 'home', label: '홈', href: './', icon: <HomeIcon /> },
  { tab: 'layout', label: '레이아웃', href: '#/layout', icon: <LayoutIcon /> },
  { tab: 'device', label: '기기 설정', href: '#/device', icon: <SettingsIcon /> },
];

/**
 * 탭 이동. 주소가 바뀌는 이동이라 탭 위젯(role="tablist") 대신 nav 안의 링크 + aria-current 를 쓴다.
 * 그래서 화면 읽기 프로그램에서는 "주 메뉴" 랜드마크로 찾을 수 있고, Tab 키로 차례대로 지나간다.
 */
export function AppNav({ tab, onNavigate, variant, badges = {} }: AppNavProps) {
  const go = (event: MouseEvent<HTMLAnchorElement>, next: Tab) => {
    // 새 탭으로 열기(Ctrl/⌘ 클릭)는 브라우저에 맡긴다.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onNavigate(next);
  };

  if (variant === 'top') {
    return (
      <nav className="kr-nav-top" aria-label="주 메뉴">
        {ITEMS.map((item) => (
          <TopBarLink key={item.tab} href={item.href} active={tab === item.tab} onClick={(e) => go(e, item.tab)}>
            {item.label}
            <Badge text={badges[item.tab]} />
          </TopBarLink>
        ))}
      </nav>
    );
  }

  return (
    <nav className="kr-tabbar" aria-label="주 메뉴">
      {ITEMS.map((item) => (
        <a
          key={item.tab}
          href={item.href}
          className={cx('kr-tabbar__item')}
          aria-current={tab === item.tab ? 'page' : undefined}
          onClick={(e) => go(e, item.tab)}
        >
          <span className="kr-tabbar__icon">
            {item.icon}
            {badges[item.tab] ? <span className="kr-badge-dot" aria-hidden /> : null}
          </span>
          <span className="kr-tabbar__label">
            {item.label}
            {badges[item.tab] ? <span className="kr-sr-only">, {badges[item.tab]}</span> : null}
          </span>
        </a>
      ))}
    </nav>
  );
}
