import { cx } from '@team-carol/design-system/react';

interface ProgressBarProps {
  /** 0 ~ 1 */
  value: number;
  label: string;
  tone?: 'accent' | 'success' | 'danger';
}

export function ProgressBar({ value, label, tone = 'accent' }: ProgressBarProps) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className={cx('kr-progress', `kr-progress--${tone}`)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div className="kr-progress__bar" style={{ width: `${percent}%` }} />
    </div>
  );
}
