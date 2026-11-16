import { useCallback, useState } from 'react';

export interface Settings {
  /** 로그, 프로토콜·빌드 정보, 파일로 펌웨어 올리기 같은 개발용 도구를 보여 준다. */
  devMode: boolean;
  /** 프로필을 받아 올 maishift 핸들. 비어 있으면 샘플만 보여 준다. */
  handle: string;
}

const STORAGE_KEY = 'carol-keyring:settings';
const DEFAULTS: Settings = { devMode: false, handle: '' };

// 이 브라우저에만 저장된다. 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 기본값으로 동작한다.
function load(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function save(settings: Settings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 저장하지 못해도 이번 방문 동안은 바뀐 값으로 동작한다.
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  return { settings, update };
}
