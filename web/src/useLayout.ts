import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_LAYOUT, SHARE_PARAM, decodeLayout, normalizeLayout } from './layout.ts';
import type { Layout } from './layout.ts';

const STORAGE_KEY = 'carol-keyring:layout';

// 이 브라우저에만 저장된다. 저장소를 못 쓰는 환경에서는 기본 레이아웃으로 동작한다.
function load(): Layout {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeLayout(JSON.parse(raw)) : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function save(layout: Layout): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // 저장하지 못해도 이번 방문 동안은 바뀐 레이아웃으로 동작한다.
  }
}

/** 공유 링크로 받은 레이아웃을 적용했을 때의 안내 */
export type SharedNotice =
  | { kind: 'applied'; previous: Layout }
  | { kind: 'error'; message: string };

/** 지금 레이아웃. 주소에 ?layout= 이 있으면 그 레이아웃을 적용하고 주소에서 지운다 (되돌릴 수 있다). */
export function useLayout() {
  const [layout, setLayoutState] = useState<Layout>(load);
  const [shared, setShared] = useState<SharedNotice | null>(null);

  const setLayout = useCallback((next: Layout) => {
    setLayoutState(next);
    save(next);
  }, []);

  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const url = new URL(window.location.href);
    const code = url.searchParams.get(SHARE_PARAM);
    if (!code) return;
    // 새로 고침해도 다시 적용되지 않게 주소에서 지운다 (탭 # 은 남긴다).
    url.searchParams.delete(SHARE_PARAM);
    window.history.replaceState(window.history.state, '', url);
    const previous = load();
    decodeLayout(code)
      .then((next) => {
        setLayout(next);
        setShared({ kind: 'applied', previous });
      })
      .catch((error: unknown) => {
        setShared({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
      });
  }, [setLayout]);

  const undoShared = useCallback(() => {
    if (shared?.kind === 'applied') setLayout(shared.previous);
    setShared(null);
  }, [shared, setLayout]);

  return { layout, setLayout, shared, dismissShared: () => setShared(null), undoShared };
}
