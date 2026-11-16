import { Button, Card, CardBody, CardTitle, Stat, StatGrid, buttonClassName } from '@team-carol/design-system/react';
import { useState } from 'react';
import type { ChangeEvent } from 'react';

import type { KeyringDevice, UpdateProgress } from '../device.ts';
import { parseFirmware } from '../protocol.ts';
import type { DeviceInfo, FirmwareFile } from '../protocol.ts';
import { downloadRelease } from '../release.ts';
import type { ReleaseCheck } from '../useFirmwareRelease.ts';
import { Notice } from './Notice.tsx';
import { ProgressBar } from './ProgressBar.tsx';

interface FirmwareCardProps {
  info: DeviceInfo;
  /** null 이면 미리보기 모드라 업데이트할 수 없다. */
  device: KeyringDevice | null;
  /** 배포된 새 펌웨어 확인 결과 */
  release: ReleaseCheck;
  onRecheck: () => void;
  /** 개발자 모드: 빌드 정보와 파일(.bin)로 올리기를 보여 준다. */
  devMode: boolean;
  chunkSize: number;
  log: (message: string) => void;
  /** 업데이트 중 재부팅으로 연결이 끊기는 동안 true. 앱이 연결 끊김을 무시하게 한다. */
  expectReboot: (expected: boolean) => void;
  /** 새 펌웨어로 다시 연결됐을 때 */
  onReconnected: (next: KeyringDevice) => void;
  /** 업데이트 뒤 다시 연결하지 못했을 때 */
  onLost: (message: string) => void;
}

interface SelectedFile {
  name: string;
  bytes: Uint8Array;
  parsed: FirmwareFile | null;
  error: string | null;
}

type UpdateState =
  | { kind: 'idle' }
  | { kind: 'downloading' }
  | { kind: 'running'; progress: UpdateProgress }
  | { kind: 'done'; from: string; to: string }
  | { kind: 'error'; message: string };

const RECONNECT_TIMEOUT_MS = 45000;

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function progressView(state: UpdateState): { value: number; text: string } | null {
  if (state.kind === 'downloading') return { value: 0.02, text: '펌웨어 파일 받는 중' };
  if (state.kind !== 'running') return null;
  const progress = state.progress;
  switch (progress.phase) {
    case 'sending':
      return {
        value: 0.02 + (progress.sent / progress.total) * 0.88,
        text: `보내는 중 ${formatKb(progress.sent)} / ${formatKb(progress.total)}`,
      };
    case 'installing':
      return { value: 0.92, text: '기기가 펌웨어를 검증하는 중' };
    case 'reconnecting':
      return { value: 0.96, text: `재부팅 뒤 다시 연결하는 중 ${(progress.elapsedMs / 1000).toFixed(0)}초` };
  }
}

function releaseText(release: ReleaseCheck): string {
  switch (release.kind) {
    case 'idle':
    case 'checking':
      return '새 펌웨어가 있는지 확인하는 중입니다.';
    case 'none':
      return '아직 배포된 펌웨어가 없습니다.';
    case 'latest':
      return '최신 버전입니다.';
    case 'available':
      return `새 펌웨어 ${release.release.version} 이 나왔습니다. 업데이트는 1~2분 걸리고, 중간에 전원이 꺼져도 기존 펌웨어로 켜집니다.`;
    case 'error':
      return `새 펌웨어를 확인하지 못했습니다. ${release.message}`;
  }
}

export function FirmwareCard(props: FirmwareCardProps) {
  const { info, device, release, onRecheck, devMode, chunkSize, log, expectReboot, onReconnected, onLost } = props;
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [state, setState] = useState<UpdateState>({ kind: 'idle' });

  const supported = (info.otaMaxLen ?? 0) > 0;
  const busy = state.kind === 'downloading' || state.kind === 'running';
  const ready = device !== null && supported && !busy;

  const tooLarge = file?.parsed != null && info.otaMaxLen != null && file.bytes.length > info.otaMaxLen;
  const buildMismatch = file?.parsed != null && info.build != null && file.parsed.build !== info.build;
  const canUpdateFile = ready && file?.parsed != null && !tooLarge;
  const available = release.kind === 'available' ? release.release : null;

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;
    const bytes = new Uint8Array(await picked.arrayBuffer());
    try {
      const parsed = parseFirmware(bytes);
      setFile({ name: picked.name, bytes, parsed, error: null });
      log(`펌웨어 파일: ${picked.name} ${parsed.version} (${parsed.build}), ${bytes.length} bytes`);
    } catch (error) {
      setFile({ name: picked.name, bytes, parsed: null, error: error instanceof Error ? error.message : String(error) });
    }
    setState({ kind: 'idle' });
  }

  /** 받은 펌웨어를 보내고, 재부팅한 기기에 다시 연결한다. */
  async function install(bytes: Uint8Array) {
    if (!device) return;
    const from = device.info.fw;
    expectReboot(true);
    setState({ kind: 'running', progress: { phase: 'sending', sent: 0, total: bytes.length } });
    try {
      await device.updateFirmware(bytes, {
        chunkSize,
        onProgress: (progress) => setState({ kind: 'running', progress }),
      });
    } catch (error) {
      expectReboot(false);
      const message = error instanceof Error ? error.message : String(error);
      log(`업데이트 실패: ${message}`);
      setState({ kind: 'error', message });
      return;
    }

    try {
      const next = await device.reconnect(RECONNECT_TIMEOUT_MS, (elapsedMs) =>
        setState({ kind: 'running', progress: { phase: 'reconnecting', elapsedMs } }),
      );
      expectReboot(false);
      onReconnected(next);
      setState({ kind: 'done', from, to: next.info.fw });
      setFile(null);
    } catch (error) {
      expectReboot(false);
      const message = error instanceof Error ? error.message : String(error);
      log(`다시 연결 실패: ${message}`);
      onLost(`업데이트는 끝났지만 다시 연결하지 못했습니다. 기기 찾기로 다시 연결해 주세요. (${message})`);
    }
  }

  async function updateFromRelease() {
    if (!available) return;
    setState({ kind: 'downloading' });
    let bytes: Uint8Array;
    try {
      bytes = await downloadRelease(available, document.baseURI);
      log(`배포 펌웨어 받음: ${available.version} (${available.build}), ${bytes.length} bytes`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`펌웨어 받기 실패: ${message}`);
      setState({ kind: 'error', message });
      return;
    }
    await install(bytes);
  }

  const progress = progressView(state);

  return (
    <Card as="section" className="kr-stack">
      <div>
        <CardTitle>펌웨어</CardTitle>
        <CardBody>{state.kind === 'done' ? '업데이트가 끝났습니다.' : releaseText(release)}</CardBody>
      </div>

      <StatGrid className="kr-stats">
        <Stat label="현재 버전" value={info.fw} />
        {available ? <Stat label="새 버전" value={available.version} /> : null}
        {devMode ? <Stat label="빌드" value={info.build ?? '알 수 없음'} /> : null}
      </StatGrid>

      {supported ? null : (
        <Notice tone="warning">
          이 기기의 펌웨어는 무선 업데이트를 지원하지 않습니다. 한 번만 USB 로 0.1.0 이상을 올려 주세요.
        </Notice>
      )}
      {device === null && available ? (
        <Notice tone="warning">미리보기 모드라 업데이트할 수 없습니다.</Notice>
      ) : null}

      {progress ? (
        <div className="kr-progress-block">
          <ProgressBar value={progress.value} label="업데이트 진행률" />
          <p className="crl-caption" aria-live="polite">
            {progress.text}
          </p>
        </div>
      ) : null}
      {state.kind === 'done' ? (
        <Notice tone="success">
          업데이트 완료: {state.from} → {state.to}
        </Notice>
      ) : null}
      {state.kind === 'error' ? <Notice tone="danger">{state.message}</Notice> : null}

      <div className="kr-actions">
        {available ? (
          <Button size="lg" onClick={updateFromRelease} disabled={!ready}>
            {busy ? '업데이트 중…' : `${available.version} 으로 업데이트`}
          </Button>
        ) : null}
        {release.kind === 'error' ? (
          <Button variant="secondary" onClick={onRecheck} disabled={busy}>
            다시 확인
          </Button>
        ) : null}
      </div>

      {devMode ? (
        <div className="kr-stack kr-dev-section">
          <div>
            <h4 className="kr-section-title">파일로 올리기</h4>
            <p className="crl-caption kr-subtitle">
              개발자 모드 전용. PlatformIO 빌드 결과 <code>firmware/.pio/build/&lt;빌드&gt;/firmware.bin</code> 을
              고릅니다.
            </p>
          </div>

          <div className="kr-file">
            <label className={buttonClassName({ variant: 'secondary' }, 'kr-file__pick')} aria-disabled={busy || undefined}>
              펌웨어 파일 고르기
              <input type="file" accept=".bin,application/octet-stream" onChange={onPick} disabled={busy} hidden />
            </label>
          </div>

          {file ? (
            file.parsed ? (
              <dl className="kr-meta">
                <dt>파일</dt>
                <dd>{file.name}</dd>
                <dt>버전</dt>
                <dd>
                  {file.parsed.version}
                  {file.parsed.version === info.fw ? <span className="crl-caption"> · 지금과 같은 버전</span> : null}
                </dd>
                <dt>빌드</dt>
                <dd>{file.parsed.build}</dd>
                <dt>크기</dt>
                <dd>{formatKb(file.bytes.length)}</dd>
              </dl>
            ) : (
              <Notice tone="danger">
                {file.name}: {file.error}
              </Notice>
            )
          ) : null}
          {buildMismatch ? (
            <Notice tone="warning">
              이 파일은 <strong>{file?.parsed?.build}</strong> 빌드라 기기({info.build})와 패널 종류가 다를 수 있습니다.
              그래도 업데이트할 수는 있고, 블루투스는 그대로 동작하니 맞는 파일로 다시 올리면 됩니다.
            </Notice>
          ) : null}
          {tooLarge ? (
            <Notice tone="danger">파일이 기기가 받을 수 있는 크기({formatKb(info.otaMaxLen ?? 0)})보다 큽니다.</Notice>
          ) : null}

          {file?.parsed ? (
            <div className="kr-actions">
              <Button onClick={() => file.parsed && install(file.bytes)} disabled={!canUpdateFile}>
                {busy ? '업데이트 중…' : '이 파일로 업데이트'}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
