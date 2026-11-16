import { Button, Card, CardTitle, Stat, StatGrid } from '@team-carol/design-system/react';

import { colorLabel } from '../patterns.ts';
import { canvasSize } from '../protocol.ts';
import type { DeviceInfo } from '../protocol.ts';

interface DeviceCardProps {
  info: DeviceInfo;
  name: string;
  demo: boolean;
  /** 패널 ID, 빌드, 프레임 크기 같은 개발용 정보를 보여 준다. */
  devMode: boolean;
  onDisconnect?: () => void;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}

export function DeviceCard({ info, name, demo, devMode, onDisconnect }: DeviceCardProps) {
  const size = canvasSize(info);
  return (
    <Card as="section" className="kr-stack">
      <div>
        <CardTitle>{name}</CardTitle>
        <p className="crl-caption kr-subtitle">
          펌웨어 {info.fw}
          {devMode ? ` · ${info.panel} · 빌드 ${info.build ?? '알 수 없음'}` : null}
        </p>
      </div>

      <StatGrid className="kr-stats">
        <Stat label="화면" value={`${size.width}×${size.height}`} />
        <Stat label="색" value={`${info.palette.length}색`} />
        {devMode ? <Stat label="한 장 크기" value={formatBytes(info.maxLen)} /> : null}
        <Stat label="갱신 시간" value={`약 ${Math.round(info.refreshMs / 1000)}초`} />
      </StatGrid>

      <ul className="kr-swatches" aria-label="패널 색">
        {info.palette.map((p) => (
          <li key={p.code} className="crl-chip kr-swatch">
            {/* 패널이 실제로 내는 색이라 기기 정보 값을 그대로 쓴다. */}
            <span className="kr-swatch__dot" style={{ background: p.rgb }} aria-hidden />
            {colorLabel(p.name)}
          </li>
        ))}
      </ul>

      <div className="kr-actions">
        {onDisconnect ? (
          <Button variant="secondary" onClick={onDisconnect}>
            연결 끊기
          </Button>
        ) : null}
        {demo ? (
          <Button variant="secondary" href="./">
            미리보기 끝내기
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
