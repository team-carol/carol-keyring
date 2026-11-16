import { Card } from '@team-carol/design-system/react';
import { useEffect, useRef } from 'react';

import type { LogEntry } from '../useLog.ts';

export function LogCard({ entries }: { entries: LogEntry[] }) {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const pre = preRef.current;
    if (pre) pre.scrollTop = pre.scrollHeight;
  }, [entries]);

  return (
    <Card as="section" className="kr-log">
      <details>
        <summary className="kr-log__summary">
          <span className="crl-card__title">로그</span>
          <span className="crl-caption">{entries.length}줄</span>
        </summary>
        <pre ref={preRef} className="kr-log__body">
          {entries.length === 0
            ? '아직 기록이 없습니다.'
            : entries.map((e) => `[${e.time}] ${e.message}`).join('\n')}
        </pre>
      </details>
    </Card>
  );
}
