import { Button, Card, CardBody, CardTitle, TextInput } from '@team-carol/design-system/react';
import { useMemo, useState } from 'react';

import type { KeyringDevice } from '../device.ts';
import type { Layout } from '../layout.ts';
import { drawProfile } from '../profileLayout.ts';
import { canvasSize, parsePalette } from '../protocol.ts';
import type { DeviceInfo } from '../protocol.ts';
import { renderFrame } from '../render.ts';
import { useFrameSender } from '../useFrameSender.ts';
import type { ProfileState } from '../useProfile.ts';
import { Notice } from './Notice.tsx';
import { PanelPreview } from './PanelPreview.tsx';
import { SendControls } from './SendControls.tsx';

interface ProfileCardProps {
  info: DeviceInfo;
  /** null 이면 미리보기 모드라 보낼 수 없다. */
  device: KeyringDevice | null;
  log: (message: string) => void;
  /** 블루투스로 한 번에 보내는 바이트 수. 기기 설정 탭(개발자 모드)에서 바꾼다. */
  chunkSize: number;
  /** 입력 칸의 처음 값 (지난번에 확인한 핸들) */
  savedHandle: string;
  profile: ProfileState;
  onLoad: (handle: string) => void;
  layout: Layout;
}

function syncedLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}월 ${d.getDate()}일 동기화`;
}

/** 홈: maishift 핸들을 넣고 확인하면 키링 화면을 그리고, 키링에 보낸다. */
export function ProfileCard({ info, device, log, chunkSize, savedHandle, profile, onLoad, layout }: ProfileCardProps) {
  const palette = useMemo(() => parsePalette(info), [info]);
  const [handleText, setHandleText] = useState(savedHandle);
  const sender = useFrameSender(device, chunkSize, log);

  const loaded = profile.kind === 'loaded' ? profile.value : null;
  const rendered = useMemo(
    () =>
      loaded
        ? renderFrame(info, (ctx, width, height) =>
            drawProfile(ctx, width, height, palette, loaded.data.profile, { icon: loaded.icon, layout }),
          )
        : null,
    [info, palette, loaded, layout],
  );
  const encoded = rendered instanceof Error ? null : rendered;
  const size = canvasSize(info);
  const loading = profile.kind === 'loading';

  return (
    <Card as="section" className="kr-stack">
      <div>
        <CardTitle>내 프로필</CardTitle>
        <CardBody>maishift 핸들을 넣고 확인을 누르면 키링에 나올 화면이 아래에 그려집니다.</CardBody>
      </div>

      <form
        className="kr-handle"
        onSubmit={(event) => {
          event.preventDefault();
          sender.reset();
          onLoad(handleText);
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
          enterKeyHint="go"
          helperText="maishift 에서 프로필을 공개로 해 두어야 받아 올 수 있습니다."
        />
        <Button type="submit" disabled={loading || sender.busy || handleText.trim() === ''}>
          {loading ? '불러오는 중…' : '확인'}
        </Button>
      </form>
      {profile.kind === 'error' ? <Notice tone="danger">{profile.message}</Notice> : null}

      {loaded ? (
        <>
          <p className="crl-caption" aria-live="polite">
            {loaded.data.profile.name.normalize('NFKC')} · {syncedLabel(loaded.data.profile.syncedAt)}
            {loaded.iconError ? ` · 아이콘을 받지 못해 이름 첫 글자로 대신합니다` : ''}
          </p>
          {encoded ? (
            <PanelPreview width={size.width} height={size.height} indices={encoded.indices} palette={palette} />
          ) : (
            <Notice tone="danger">{(rendered as Error).message}</Notice>
          )}
          <SendControls
            state={sender.state}
            connected={device !== null}
            canSend={encoded !== null}
            onSend={() => encoded && void sender.send(encoded.frame)}
            onCancel={sender.cancel}
          />
        </>
      ) : null}
    </Card>
  );
}
