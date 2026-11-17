import { Button } from '@team-carol/design-system/react';

import type { SendState } from '../useFrameSender.ts';
import { Notice } from './Notice.tsx';
import { ProgressBar } from './ProgressBar.tsx';

interface SendControlsProps {
  state: SendState;
  /** false 면 미리보기 모드(기기 없음)라 보낼 수 없다. */
  connected: boolean;
  canSend: boolean;
  onSend: () => void;
  onCancel: () => void;
}

function progressView(state: SendState): { value: number; text: string; tone: 'accent' | 'success' | 'danger' } | null {
  switch (state.kind) {
    case 'idle':
      return null;
    case 'sending': {
      const p = state.progress;
      if (p.phase === 'sending') {
        return { value: p.sent / p.total, text: `보내는 중 ${Math.round((p.sent / p.total) * 100)}%`, tone: 'accent' };
      }
      return {
        value: Math.min(0.99, p.elapsedMs / p.expectedMs),
        text: `화면 바꾸는 중 ${(p.elapsedMs / 1000).toFixed(0)}초 / 약 ${Math.round(p.expectedMs / 1000)}초`,
        tone: 'accent',
      };
    }
    case 'done':
      return {
        value: 1,
        text: `완료 · 전송 ${(state.result.sendMs / 1000).toFixed(1)}초, 화면 갱신 ${(state.result.refreshMs / 1000).toFixed(1)}초`,
        tone: 'success',
      };
    case 'error':
      return { value: 1, text: '실패', tone: 'danger' };
  }
}

/** 진행 막대, 오류, "키링에 보내기"·"취소" 버튼 */
export function SendControls({ state, connected, canSend, onSend, onCancel }: SendControlsProps) {
  const progress = progressView(state);
  const busy = state.kind === 'sending';
  const cancellable = busy && state.progress.phase === 'sending';
  return (
    <>
      {progress ? (
        <div className="kr-progress-block">
          <ProgressBar value={progress.value} label="전송 진행률" tone={progress.tone} />
          <p className="crl-caption" aria-live="polite">
            {progress.text}
          </p>
        </div>
      ) : null}
      {state.kind === 'error' ? <Notice tone="danger">{state.message}</Notice> : null}
      {connected ? null : (
        <Notice tone="warning">미리보기 모드라 보낼 수 없습니다. 기기를 연결하면 보낼 수 있습니다.</Notice>
      )}
      <div className="kr-actions">
        <Button size="lg" onClick={onSend} disabled={!connected || !canSend || busy}>
          {busy ? '보내는 중…' : '키링에 보내기'}
        </Button>
        {busy ? (
          <Button size="lg" variant="secondary" onClick={onCancel} disabled={!cancellable}>
            취소
          </Button>
        ) : null}
      </div>
    </>
  );
}
