import { useCallback, useEffect, useRef, useState } from 'react';

import type { ProfileResponse } from './maishift.ts';
import { fetchProfile, fetchProfileIcon } from './profileApi.ts';
import { loadProfileFonts } from './profileLayout.ts';

export interface LoadedProfile {
  data: ProfileResponse;
  icon: ImageBitmap | null;
  iconError: string | null;
}

export type ProfileState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; value: LoadedProfile }
  | { kind: 'error'; message: string };

/**
 * maishift 프로필과 아이콘을 받는다. 홈(내 프로필)과 레이아웃 편집이 같이 쓴다.
 * 지난번 핸들이 있으면 처음 한 번 바로 불러온다 (Worker 가 5분 캐시해서 maishift 를 또 부르지 않는다).
 */
export function useProfile(savedHandle: string, onHandleSaved: (handle: string) => void, log: (message: string) => void) {
  const [state, setState] = useState<ProfileState>({ kind: 'idle' });

  const load = useCallback(
    async (handle: string) => {
      const trimmed = handle.trim();
      if (!trimmed) return;
      setState({ kind: 'loading' });
      try {
        const data = await fetchProfile(trimmed);
        // 아이콘은 못 받아도 프로필은 보여 준다 (이름 첫 글자로 대신).
        let icon: ImageBitmap | null = null;
        let iconError: string | null = null;
        try {
          icon = await fetchProfileIcon(data.profile.iconUrl);
        } catch (cause) {
          iconError = cause instanceof Error ? cause.message : String(cause);
          log(`아이콘 받기 실패: ${iconError}`);
        }
        await loadProfileFonts(data.profile);
        setState({ kind: 'loaded', value: { data, icon, iconError } });
        onHandleSaved(trimmed);
        log(`프로필 받음: ${data.handle} (${data.profile.name}, ${data.profile.rating})`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setState({ kind: 'error', message });
        log(`프로필 받기 실패: ${message}`);
      }
    },
    [log, onHandleSaved],
  );

  const autoLoaded = useRef(false);
  useEffect(() => {
    if (autoLoaded.current || !savedHandle) return;
    autoLoaded.current = true;
    void load(savedHandle);
  }, [savedHandle, load]);

  return { state, load, loaded: state.kind === 'loaded' ? state.value : null };
}
