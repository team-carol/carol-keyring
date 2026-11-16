import { Card } from '@team-carol/design-system/react';
import { useId } from 'react';

import { PROTOCOL_VERSION } from '../protocol.ts';
import { Switch } from './Switch.tsx';

interface DevModeCardProps {
  devMode: boolean;
  onChange: (devMode: boolean) => void;
}

export function DevModeCard({ devMode, onChange }: DevModeCardProps) {
  const switchId = useId();
  const descId = useId();
  return (
    <Card as="section" className="kr-stack" aria-label="개발자 모드">
      <div className="kr-setting">
        <div className="kr-setting__text">
          <label htmlFor={switchId} className="kr-setting__label">
            개발자 모드
          </label>
          <p id={descId} className="crl-caption">
            파일로 펌웨어 올리기, 전송 조각 크기, 패널·빌드 정보, 로그 같은 개발용 도구를 보여 줍니다. 이 브라우저에만
            저장됩니다.
          </p>
        </div>
        <Switch id={switchId} checked={devMode} onChange={onChange} describedBy={descId} />
      </div>
      {devMode ? <p className="crl-caption">BLE 프로토콜 v{PROTOCOL_VERSION}</p> : null}
    </Card>
  );
}
