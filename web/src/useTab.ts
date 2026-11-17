import { useCallback, useEffect, useState } from 'react';

export type Tab = 'home' | 'layout' | 'device';

const HASHES: Record<Tab, string> = {
  home: '',
  layout: '#/layout',
  device: '#/device',
};

function fromHash(hash: string): Tab {
  return (Object.keys(HASHES) as Tab[]).find((tab) => tab !== 'home' && HASHES[tab] === hash) ?? 'home';
}

function urlFor(tab: Tab): string {
  return window.location.pathname + window.location.search + HASHES[tab];
}

/** history.state 에 남기는 표시. 홈에서 탭을 눌러 들어온 화면인지 알아본다. */
interface TabHistoryState {
  krTab: true;
}

function cameFromHome(): boolean {
  const state = window.history.state as Partial<TabHistoryState> | null;
  return state?.krTab === true;
}

/**
 * 지금 탭. 주소의 # 에 남겨서 새로 고침해도 그 탭이 열리고, 안드로이드 뒤로 가기를 누르면 홈으로 돌아온다.
 * 앱의 아래 탭처럼 기록이 쌓이지 않게, 홈 → 다른 탭 한 단계만 기록에 남기고 다른 탭끼리는 바꿔치기한다.
 */
export function useTab() {
  const [tab, setTab] = useState<Tab>(() => fromHash(window.location.hash));

  useEffect(() => {
    const sync = () => setTab(fromHash(window.location.hash));
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  const navigate = useCallback((next: Tab) => {
    const current = fromHash(window.location.hash);
    if (next === current) return;
    if (next === 'home') {
      // 홈에서 들어왔으면 뒤로 가기와 같게 기록을 하나 되돌린다.
      if (cameFromHome()) {
        window.history.back();
        return;
      }
      window.history.replaceState(null, '', urlFor('home'));
    } else {
      const state: TabHistoryState = { krTab: true };
      if (current === 'home') window.history.pushState(state, '', urlFor(next));
      else window.history.replaceState(window.history.state ?? state, '', urlFor(next));
    }
    setTab(next);
  }, []);

  return { tab, navigate };
}
