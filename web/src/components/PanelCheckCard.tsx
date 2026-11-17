import { Card, CardBody, CardTitle, Select } from '@team-carol/design-system/react';
import { useMemo, useState } from 'react';

import type { KeyringDevice } from '../device.ts';
import { drawPattern, patternOptions } from '../patterns.ts';
import { canvasSize, parsePalette } from '../protocol.ts';
import type { DeviceInfo } from '../protocol.ts';
import { renderFrame } from '../render.ts';
import { useFrameSender } from '../useFrameSender.ts';
import { Notice } from './Notice.tsx';
import { PanelPreview } from './PanelPreview.tsx';
import { SendControls } from './SendControls.tsx';

interface PanelCheckCardProps {
  info: DeviceInfo;
  device: KeyringDevice | null;
  log: (message: string) => void;
  chunkSize: number;
}

/** 패널 점검 (개발자 모드): 회전·보이는 영역·색을 확인하는 테스트 패턴과 단색 */
export function PanelCheckCard({ info, device, log, chunkSize }: PanelCheckCardProps) {
  const palette = useMemo(() => parsePalette(info), [info]);
  const options = useMemo(() => patternOptions(palette), [palette]);
  const [patternId, setPatternId] = useState(options[0].id);
  const sender = useFrameSender(device, chunkSize, log);

  const rendered = useMemo(
    () => renderFrame(info, (ctx, width, height) => drawPattern(ctx, width, height, palette, patternId, info)),
    [info, palette, patternId],
  );
  const encoded = rendered instanceof Error ? null : rendered;
  const size = canvasSize(info);

  return (
    <Card as="section" className="kr-stack">
      <div>
        <CardTitle>패널 점검</CardTitle>
        <CardBody>개발자 모드 전용. 실물 패널의 방향, 보이는 영역, 색을 확인합니다.</CardBody>
      </div>
      <Select
        label="화면"
        value={patternId}
        onChange={(event) => setPatternId(event.target.value)}
        disabled={sender.busy}
        helperText={options.find((o) => o.id === patternId)?.help}
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
      <SendControls
        state={sender.state}
        connected={device !== null}
        canSend={encoded !== null}
        onSend={() => encoded && void sender.send(encoded.frame)}
        onCancel={sender.cancel}
      />
    </Card>
  );
}
