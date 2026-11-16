import { Button, Card, CardTitle, Select, TextInput, buttonClassName } from '@team-carol/design-system/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import { DeviceError } from '../device.ts';
import type { KeyringDevice, SendProgress, SendResult } from '../device.ts';
import type { PlayerProfile, ProfileResponse } from '../maishift.ts';
import { PROFILE_PATTERN, drawPattern, patternOptions } from '../patterns.ts';
import { fetchProfile, fetchProfileIcon } from '../profileApi.ts';
import { loadProfileFonts } from '../profileLayout.ts';
import type { IconImage } from '../profileLayout.ts';
import { PROFILE_SAMPLES } from '../profileSamples.ts';
import { sampleIcon } from '../sampleIcon.ts';
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
  /** 지난번에 불러온 maishift 핸들. 있으면 열 때 바로 불러온다. */
  savedHandle: string;
  onHandleSaved: (handle: string) => void;
}

type RemoteProfile =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; data: ProfileResponse; icon: ImageBitmap | null; iconError: string | null }
  | { kind: 'error'; message: string };

/** 프로필 고르기에서 "내 프로필"(maishift 에서 받은 것)의 값. 나머지는 샘플 id 다. */
const MY_PROFILE = 'me';

function syncedLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}월 ${d.getDate()}일 동기화`;
}

type SendState =
  | { kind: 'idle' }
  | { kind: 'sending'; progress: SendProgress }
  | { kind: 'done'; result: SendResult }
  | { kind: 'error'; message: string };

function renderPattern(
  info: DeviceInfo,
  palette: PaletteColor[],
  patternId: string,
  profile: PlayerProfile,
  icon: IconImage | null,
): EncodedFrame | Error {
  const { width, height } = canvasSize(info);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Error('캔버스를 만들 수 없다');
  drawPattern(ctx, width, height, palette, patternId, info, profile, icon);
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

export function ScreenCard({ info, device, log, chunkSize, savedHandle, onHandleSaved }: ScreenCardProps) {
  const palette = useMemo(() => parsePalette(info), [info]);
  const options = useMemo(() => patternOptions(palette), [palette]);
  const [patternId, setPatternId] = useState(options[0].id);
  const [state, setState] = useState<SendState>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  // maishift 에서 받은 내 프로필
  const [handleText, setHandleText] = useState(savedHandle);
  const [remote, setRemote] = useState<RemoteProfile>({ kind: 'idle' });
  const loaded = remote.kind === 'loaded' ? remote.data : null;

  async function loadProfile(handle: string) {
    const trimmed = handle.trim();
    if (!trimmed) return;
    setRemote({ kind: 'loading' });
    try {
      const data = await fetchProfile(trimmed);
      // 아이콘은 못 받아도 프로필은 보여 준다 (이름 첫 글자로 대신).
      let icon: ImageBitmap | null = null;
      let iconError: string | null = null;
      try {
        icon = await fetchProfileIcon(trimmed, data.profile.iconUrl);
      } catch (cause) {
        iconError = cause instanceof Error ? cause.message : String(cause);
        log(`아이콘 받기 실패: ${iconError}`);
      }
      setRemote({ kind: 'loaded', data, icon, iconError });
      setSelectedId(MY_PROFILE);
      onHandleSaved(trimmed);
      log(`프로필 받음: ${data.handle} (${data.profile.name}, ${data.profile.rating})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRemote({ kind: 'error', message });
      log(`프로필 받기 실패: ${message}`);
    }
  }

  // 지난번 핸들이 있으면 열 때 바로 불러온다. (Worker 가 5분 캐시해서 다시 불러도 maishift 를 또 부르지 않는다.)
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (autoLoaded.current || !savedHandle) return;
    autoLoaded.current = true;
    void loadProfile(savedHandle);
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 보여 줄 프로필: 내 프로필 또는 샘플
  const [selectedId, setSelectedId] = useState(PROFILE_SAMPLES[0].id);
  const showingMine = selectedId === MY_PROFILE && loaded !== null;
  const profile: PlayerProfile = showingMine
    ? loaded.profile
    : (PROFILE_SAMPLES.find((s) => s.id === selectedId) ?? PROFILE_SAMPLES[0]).profile;
  const isProfile = patternId === PROFILE_PATTERN;

  // 프로필 글꼴을 받으면 다시 그린다. 받기 전에 그리면 대체 글꼴로 그려진다.
  // 샘플과 내 프로필에 나오는 글자(이름, 칭호, 단위)를 한 번에 받는다.
  const [fontEpoch, setFontEpoch] = useState(0);
  useEffect(() => {
    if (!isProfile) return;
    let cancelled = false;
    const profiles = [...PROFILE_SAMPLES.map((s) => s.profile), ...(loaded ? [loaded.profile] : [])];
    void Promise.all(profiles.map(loadProfileFonts)).then(() => {
      if (!cancelled) setFontEpoch((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [isProfile, loaded]);

  // 아이콘: 샘플은 샘플 그림, 내 프로필은 아직 이름 첫 글자 (실제 아이콘은 이미지 서버가 브라우저 읽기를 막아서 못 쓴다).
  // 시험용으로 아무 이미지나 골라 볼 수 있다 (이 브라우저 안에서만 쓰고 어디에도 올리지 않는다).
  const [customIcon, setCustomIcon] = useState<{ name: string; image: ImageBitmap } | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);
  const myIcon = remote.kind === 'loaded' ? remote.icon : null;
  const icon: IconImage | null = customIcon?.image ?? (showingMine ? myIcon : sampleIcon());

  async function onPickIcon(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const image = await createImageBitmap(file);
      setCustomIcon({ name: file.name, image });
      setIconError(null);
    } catch {
      setIconError(`${file.name}: 이미지를 읽을 수 없습니다.`);
    }
  }

  const rendered = useMemo(
    () => renderPattern(info, palette, patternId, profile, icon),
    // fontEpoch: 글꼴을 받은 뒤 다시 그린다.
    [info, palette, patternId, profile, icon, fontEpoch],
  );
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
        helperText={options.find((o) => o.id === patternId)?.help}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>

      {isProfile ? (
        <>
          <form
            className="kr-handle"
            onSubmit={(event) => {
              event.preventDefault();
              void loadProfile(handleText);
            }}
          >
            <TextInput
              label="maishift 핸들"
              value={handleText}
              onChange={(event) => setHandleText(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={32}
              helperText="maishift 에서 프로필을 공개로 해 두어야 받아 올 수 있습니다."
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={busy || remote.kind === 'loading' || handleText.trim() === ''}
            >
              {remote.kind === 'loading' ? '불러오는 중…' : '불러오기'}
            </Button>
          </form>
          {remote.kind === 'error' ? <Notice tone="danger">{remote.message}</Notice> : null}

          <Select
            label="보여 줄 프로필"
            value={showingMine ? MY_PROFILE : selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={busy}
            helperText={
              showingMine && loaded
                ? `${loaded.handle} · ${syncedLabel(loaded.profile.syncedAt)} · 데이터: maishift`
                : '레이아웃 확인용 샘플입니다.'
            }
          >
            {loaded ? <option value={MY_PROFILE}>내 프로필 · {loaded.profile.name.normalize('NFKC')}</option> : null}
            {PROFILE_SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>
                샘플 · {s.label}
              </option>
            ))}
          </Select>

          <div className="kr-file">
            <span className="kr-section-title">아이콘</span>
            <div className="kr-actions">
              <label className={buttonClassName({ variant: 'secondary' }, 'kr-file__pick')} aria-disabled={busy || undefined}>
                이미지로 시험하기
                <input type="file" accept="image/*" onChange={onPickIcon} disabled={busy} hidden />
              </label>
              {customIcon ? (
                <Button variant="secondary" onClick={() => setCustomIcon(null)} disabled={busy}>
                  원래대로
                </Button>
              ) : null}
            </div>
            <p className="crl-caption">
              {customIcon
                ? `${customIcon.name} · 고른 이미지는 이 브라우저 안에서만 씁니다.`
                : showingMine
                  ? myIcon
                    ? '게임 아이콘을 받아 왔습니다.'
                    : `게임 아이콘을 받지 못해 이름 첫 글자로 대신합니다${remote.kind === 'loaded' && remote.iconError ? ` (${remote.iconError})` : ''}.`
                  : '샘플 그림'}{' '}
              아이콘만 패널 색 4가지를 섞어(디더링) 그립니다.
            </p>
            {iconError ? <Notice tone="danger">{iconError}</Notice> : null}
          </div>
        </>
      ) : null}

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
