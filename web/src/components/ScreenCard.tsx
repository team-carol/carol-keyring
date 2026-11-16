import { Button, Card, CardTitle, Select } from '@team-carol/design-system/react';
import { useMemo, useRef, useState } from 'react';

import { DeviceError } from '../device.ts';
import type { KeyringDevice, SendProgress, SendResult } from '../device.ts';
import { drawPattern, patternOptions } from '../patterns.ts';
import { canvasSize, encodeFrame, parsePalette } from '../protocol.ts';
import type { DeviceInfo, EncodedFrame, PaletteColor } from '../protocol.ts';
import { Notice } from './Notice.tsx';
import { PanelPreview } from './PanelPreview.tsx';
import { ProgressBar } from './ProgressBar.tsx';

interface ScreenCardProps {
  info: DeviceInfo;
  /** null 이면 미리보기 모드라 보낼 수 없다. */
  device: KeyringDevice | null;
  log: (message: string) => void;
  /** 블루투스로 한 번에 보내는 바이트 수. 기기 설정 탭(개발자 모드)에서 바꾼다. */
  chunkSize: number;
}

type SendState =
  | { kind: 'idle' }
  | { kind: 'sending'; progress: SendProgress }
  | { kind: 'done'; result: SendResult }
  | { kind: 'error'; message: string };

function renderPattern(info: DeviceInfo, palette: PaletteColor[], patternId: string): EncodedFrame | Error {
  const { width, height } = canvasSize(info);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Error('캔버스를 만들 수 없다');
  drawPattern(ctx, width, height, palette, patternId, info);
  try {
    return encodeFrame(ctx.getImageData(0, 0, width, height), info);
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
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

export function ScreenCard({ info, device, log, chunkSize }: ScreenCardProps) {
  const palette = useMemo(() => parsePalette(info), [info]);
  const options = useMemo(() => patternOptions(palette), [palette]);
  const [patternId, setPatternId] = useState(options[0].id);
  const [state, setState] = useState<SendState>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const rendered = useMemo(() => renderPattern(info, palette, patternId), [info, palette, patternId]);
  const encoded = rendered instanceof Error ? null : rendered;
  const size = canvasSize(info);

  const busy = state.kind === 'sending';
  const canSend = device !== null && encoded !== null && !busy;

  async function send() {
    if (!device || !encoded) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: 'sending', progress: { phase: 'sending', sent: 0, total: encoded.frame.length } });
    try {
      const result = await device.send(encoded.frame, {
        chunkSize,
        signal: controller.signal,
        onProgress: (progress) => setState({ kind: 'sending', progress }),
      });
      setState({ kind: 'done', result });
    } catch (error) {
      const message = error instanceof DeviceError || error instanceof Error ? error.message : String(error);
      log(`실패: ${message}`);
      setState({ kind: 'error', message });
    } finally {
      abortRef.current = null;
    }
  }

  const progress = progressView(state);
  const cancellable = state.kind === 'sending' && state.progress.phase === 'sending';

  return (
    <Card as="section" className="kr-stack">
      <CardTitle>보낼 화면</CardTitle>

      <Select
        label="화면"
        value={patternId}
        onChange={(event) => setPatternId(event.target.value)}
        disabled={busy}
        helperText={
          patternId === 'test'
            ? '화살표가 위를 가리키는지, 테두리 네 변이 모두 보이는지, 색 막대가 맞는지 확인합니다.'
            : '패널 전체를 한 색으로 칠합니다. 실제 색을 확인할 때 씁니다.'
        }
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>

      {encoded ? (
        <PanelPreview width={size.width} height={size.height} indices={encoded.indices} palette={palette} />
      ) : (
        <Notice tone="danger">{(rendered as Error).message}</Notice>
      )}

      {progress ? (
        <div className="kr-progress-block">
          <ProgressBar value={progress.value} label="전송 진행률" tone={progress.tone} />
          <p className="crl-caption" aria-live="polite">
            {progress.text}
          </p>
        </div>
      ) : null}
      {state.kind === 'error' ? <Notice tone="danger">{state.message}</Notice> : null}
      {device === null ? (
        <Notice tone="warning">미리보기 모드라 보낼 수 없습니다. 기기를 연결하면 보낼 수 있습니다.</Notice>
      ) : null}

      <div className="kr-actions">
        <Button size="lg" onClick={send} disabled={!canSend}>
          {busy ? '보내는 중…' : '키링에 보내기'}
        </Button>
        {busy ? (
          <Button size="lg" variant="secondary" onClick={() => abortRef.current?.abort()} disabled={!cancellable}>
            취소
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
