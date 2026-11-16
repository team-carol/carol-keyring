import { useCallback, useEffect, useState } from 'react';

import type { DeviceInfo } from './protocol.ts';
import { fetchManifest, findUpdate } from './release.ts';
import type { FirmwareManifest, FirmwareRelease } from './release.ts';

export type ReleaseCheck =
  | { kind: 'idle' }
  | { kind: 'checking' }
  /** 배포된 펌웨어 정보가 없다 (manifest.json 없음, 이 빌드 없음) */
  | { kind: 'none' }
  | { kind: 'latest'; version: string }
  | { kind: 'available'; release: FirmwareRelease }
  | { kind: 'error'; message: string };

// manifest 는 한 번만 받는다. 다시 확인을 누르면 새로 받는다.
let cached: Promise<FirmwareManifest | null> | null = null;

function loadManifest(force: boolean): Promise<FirmwareManifest | null> {
  if (force || !cached) {
    cached = fetchManifest(document.baseURI);
    // 실패하면 다음에 다시 받게 비운다.
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}

/** 연결된 기기에 맞는 새 펌웨어가 있는지 본다. info 가 바뀌면(업데이트 뒤 재연결 등) 다시 본다. */
export function useFirmwareRelease(info: DeviceInfo | null) {
  const [check, setCheck] = useState<ReleaseCheck>({ kind: 'idle' });
  const [attempt, setAttempt] = useState(0);

  const build = info?.build;
  const fw = info?.fw;
  const otaMaxLen = info?.otaMaxLen;

  useEffect(() => {
    if (!info) {
      setCheck({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setCheck({ kind: 'checking' });
    loadManifest(attempt > 0)
      .then((manifest) => {
        if (cancelled) return;
        const entry = manifest && build ? manifest.builds[build] : undefined;
        if (!manifest || !entry) {
          setCheck({ kind: 'none' });
          return;
        }
        const release = findUpdate(manifest, info);
        setCheck(release ? { kind: 'available', release } : { kind: 'latest', version: entry.version });
      })
      .catch((error: unknown) => {
        if (!cancelled) setCheck({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      cancelled = true;
    };
    // info 객체 대신 비교에 쓰는 값만 본다. 같은 기기 정보로 다시 그려질 때 또 받지 않는다.
  }, [info === null, build, fw, otaMaxLen, attempt]);

  const recheck = useCallback(() => setAttempt((n) => n + 1), []);
  return { check, recheck };
}
