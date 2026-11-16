import { useCallback, useEffect, useState } from 'react';

export type Tab = 'home' | 'device';

const DEVICE_HASH = '#/device';

function fromHash(hash: string): Tab {
  return hash === DEVICE_HASH ? 'device' : 'home';
}

function urlFor(tab: Tab): string {
  const base = window.location.pathname + window.location.search;
  return tab === 'device' ? base + DEVICE_HASH : base;
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
 * 앱의 아래 탭처럼 기록이 쌓이지 않게, 홈 → 기기 설정 한 단계만 기록에 남긴다.
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
    if (next === fromHash(window.location.hash)) return;
    if (next === 'home') {
      // 홈에서 들어왔으면 뒤로 가기와 같게 기록을 하나 되돌린다.
      if (cameFromHome()) {
        window.history.back();
        return;
      }
      window.history.replaceState(null, '', urlFor('home'));
    } else {
      const state: TabHistoryState = { krTab: true };
      window.history.pushState(state, '', urlFor(next));
    }
    setTab(next);
  }, []);

  return { tab, navigate };
}
