import { useCallback, useRef, useState } from 'react';

import { DeviceError } from './device.ts';
import type { KeyringDevice, SendProgress, SendResult } from './device.ts';

export type SendState =
  | { kind: 'idle' }
  | { kind: 'sending'; progress: SendProgress }
  | { kind: 'done'; result: SendResult }
  | { kind: 'error'; message: string };

/** 프레임 하나를 키링에 보낸다. 진행 상태와 취소를 같이 관리한다 (프로필 카드, 패널 점검 카드가 같이 쓴다). */
export function useFrameSender(device: KeyringDevice | null, chunkSize: number, log: (message: string) => void) {
  const [state, setState] = useState<SendState>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (frame: Uint8Array) => {
      if (!device) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ kind: 'sending', progress: { phase: 'sending', sent: 0, total: frame.length } });
      try {
        const result = await device.send(frame, {
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
    },
    [device, chunkSize, log],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => setState({ kind: 'idle' }), []);

  return { state, send, cancel, reset, busy: state.kind === 'sending' };
}
