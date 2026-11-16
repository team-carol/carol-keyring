import { Button, Card, CardBody, CardTitle } from '@team-carol/design-system/react';

import { DEFAULT_DEMO } from '../demo.ts';
import { isWebBluetoothSupported } from '../device.ts';
import { Notice } from './Notice.tsx';

interface ConnectCardProps {
  connecting: boolean;
  error: string | null;
  onConnect: () => void;
}

export function ConnectCard({ connecting, error, onConnect }: ConnectCardProps) {
  const supported = isWebBluetoothSupported();
  return (
    <Card as="section" className="kr-stack">
      <div>
        <CardTitle>기기 연결</CardTitle>
        <CardBody>
          기기 찾기를 누르면 근처의 키링 목록이 뜹니다. <strong>carol-keyring-</strong> 으로 시작하는 기기를
          고르세요. 뒤의 네 자리는 기기마다 다릅니다.
        </CardBody>
      </div>

      {supported ? null : (
        <Notice tone="warning">
          이 브라우저는 Web Bluetooth 를 지원하지 않습니다. 안드로이드와 PC 는 Chrome 이나 Edge, iPhone 은 Bluefy
          앱에서 열어 주세요.
        </Notice>
      )}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="kr-actions">
        <Button size="lg" onClick={onConnect} disabled={!supported || connecting}>
          {connecting ? '연결 중…' : '기기 찾기'}
        </Button>
        <Button size="lg" variant="secondary" href={`?demo=${DEFAULT_DEMO}`}>
          기기 없이 둘러보기
        </Button>
      </div>
    </Card>
  );
}
