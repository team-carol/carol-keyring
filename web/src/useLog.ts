import { useCallback, useState } from 'react';

export interface LogEntry {
  id: number;
  time: string;
  message: string;
}

const MAX_ENTRIES = 300;
let nextId = 0;

/** 화면 아래 로그 카드에 쌓을 기록. 오래된 것부터 버린다. */
export function useLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const log = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    setEntries((prev) => [...prev.slice(-(MAX_ENTRIES - 1)), { id: nextId++, time, message }]);
  }, []);

  return { entries, log };
}
