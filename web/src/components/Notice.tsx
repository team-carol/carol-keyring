import { cx } from '@team-carol/design-system/react';
import type { ReactNode } from 'react';

interface NoticeProps {
  tone: 'warning' | 'danger' | 'success';
  children: ReactNode;
}

/** 카드 안에 들어가는 한 줄짜리 안내. 디자인 시스템에 아직 없어서 이 프로젝트에 둔다. */
export function Notice({ tone, children }: NoticeProps) {
  return (
    <p className={cx('kr-notice', `kr-notice--${tone}`)} role={tone === 'danger' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
