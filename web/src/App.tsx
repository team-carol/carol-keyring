import { Brand, Button, Card, CardBody, CardTitle, Footer, TopBar } from '@team-carol/design-system/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppNav } from './components/AppNav.tsx';
import { ConnectCard } from './components/ConnectCard.tsx';
import { DevModeCard } from './components/DevModeCard.tsx';
import { DeviceCard } from './components/DeviceCard.tsx';
import { FirmwareCard } from './components/FirmwareCard.tsx';
import { LayoutEditor } from './components/LayoutEditor.tsx';
import { LayoutShareCard } from './components/LayoutShareCard.tsx';
import { LogCard } from './components/LogCard.tsx';
import { Notice } from './components/Notice.tsx';
import { PanelCheckCard } from './components/PanelCheckCard.tsx';
import { ProfileCard } from './components/ProfileCard.tsx';
import { TransferCard } from './components/TransferCard.tsx';
import { DEFAULT_DEMO, DEMO_INFO, demoFromLocation } from './demo.ts';
import { KeyringDevice } from './device.ts';
import type { DeviceEvents } from './device.ts';
import { useFirmwareRelease } from './useFirmwareRelease.ts';
import { useLayout } from './useLayout.ts';
import { useLog } from './useLog.ts';
import { useProfile } from './useProfile.ts';
import { useSettings } from './useSettings.ts';
import { useTab } from './useTab.ts';
import type { Tab } from './useTab.ts';

/** 블루투스로 한 번에 보내는 기본 조각 크기 (바이트) */
const DEFAULT_CHUNK = 180;

const TITLES: Record<Tab, string> = {
  home: '캐롤 키링',
  layout: '레이아웃 · 캐롤 키링',
  device: '기기 설정 · 캐롤 키링',
};

export function App() {
  const [demo] = useState(demoFromLocation);
  const [device, setDevice] = useState<KeyringDevice | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK);
  // 로그는 개발자 모드가 꺼져 있어도 모아 둔다. 켜면 그때까지의 기록이 바로 보인다.
  const { entries, log } = useLog();
  const { settings, update: updateSettings } = useSettings();
  const { devMode } = settings;
  const { tab, navigate } = useTab();

  // maishift 프로필 (홈과 레이아웃 편집이 같이 쓴다), 레이아웃 (공유 링크로 받으면 적용)
  const onHandleSaved = useCallback((handle: string) => updateSettings({ handle }), [updateSettings]);
  const profile = useProfile(settings.handle, onHandleSaved, log);
  const { layout, setLayout, shared, dismissShared, undoShared } = useLayout();

  // 탭을 바꾸면 맨 위로 올리고, 화면 읽기 프로그램이 새 화면 제목부터 읽도록 제목에 초점을 옮긴다.
  // 처음 열 때는 옮기지 않는다.
  const headingRefs = useRef<Record<Tab, HTMLHeadingElement | null>>({ home: null, layout: null, device: null });
  // 처음 열 때와 개발 모드(StrictMode)에서 effect 가 두 번 돌 때는 탭이 그대로라 옮기지 않는다.
  const shownTab = useRef(tab);
  useEffect(() => {
    document.title = TITLES[tab];
    if (shownTab.current === tab) return;
    shownTab.current = tab;
    window.scrollTo({ top: 0 });
    headingRefs.current[tab]?.focus({ preventScroll: true });
  }, [tab]);

  // 펌웨어 업데이트 뒤 재부팅으로 끊기는 동안에는 연결 화면으로 돌아가지 않는다.
  const rebootExpected = useRef(false);
  const events = useMemo<DeviceEvents>(
    () => ({
      onLog: log,
      onDisconnect: () => {
        if (!rebootExpected.current) setDevice(null);
      },
    }),
    [log],
  );

  const info = device?.info ?? demo;
  // 연결된 기기에 맞는 새 펌웨어가 배포돼 있으면 홈과 탭에 알린다.
  const { check: release, recheck: recheckRelease } = useFirmwareRelease(info);
  const available = device && release.kind === 'available' ? release.release : null;
  const badges = available ? { device: '새 펌웨어 있음' } : undefined;

  const connect = useCallback(async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const next = await KeyringDevice.request(events);
      const { panel, w, h, fmt, fw } = next.info;
      log(`연결됨: ${panel} ${w}x${h} ${fmt}, 펌웨어 ${fw}`);
      setDevice(next);
    } catch (error) {
      // 기기 선택 창을 닫으면 NotFoundError 가 온다. 오류로 보이지 않는다.
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        log('기기 선택을 취소함');
      } else {
        const message = error instanceof Error ? error.message : String(error);
        setConnectError(message);
        log(`연결 실패: ${message}`);
      }
    } finally {
      setConnecting(false);
    }
  }, [events, log]);

  const onDeviceLost = useCallback((message: string) => {
    setDevice(null);
    setConnectError(message);
  }, []);

  const connectCard = <ConnectCard connecting={connecting} error={connectError} onConnect={connect} />;

  return (
    <div className="kr-app">
      <TopBar brand={<Brand name="캐롤 키링" href="./" />}>
        <AppNav variant="top" tab={tab} onNavigate={navigate} badges={badges} />
      </TopBar>
      {/* 연결 상태가 바뀌면 화면 읽기 프로그램이 알려 준다. 눈에 보이는 표시는 기기 카드 제목 옆에 있다. */}
      <span role="status" className="kr-sr-only">
        {device ? `${device.name} 연결됨` : demo ? '미리보기' : '키링 연결 안 됨'}
      </span>

      {/* 탭을 모두 그려 두고 안 보이는 쪽만 숨긴다. 펌웨어 업데이트나 전송 중에 탭을 옮겨도 멈추지 않는다. */}
      <main className="crl-container crl-container--narrow kr-main">
        {shared ? (
          <div className="kr-shared">
            {shared.kind === 'applied' ? (
              <Notice tone="success">
                공유받은 레이아웃을 적용했습니다.{' '}
                <button type="button" className="kr-link-btn" onClick={undoShared}>
                  되돌리기
                </button>{' '}
                <button type="button" className="kr-link-btn" onClick={dismissShared}>
                  닫기
                </button>
              </Notice>
            ) : (
              <Notice tone="danger">
                공유 링크를 열지 못했습니다: {shared.message}{' '}
                <button type="button" className="kr-link-btn" onClick={dismissShared}>
                  닫기
                </button>
              </Notice>
            )}
          </div>
        ) : null}
        <section className="kr-page" hidden={tab !== 'home'} aria-labelledby="kr-title-home">
          <header className="kr-hero">
            <p className="crl-eyebrow">maimai DX 프로필 키링</p>
            <h1
              id="kr-title-home"
              ref={(el) => {
                headingRefs.current.home = el;
              }}
              tabIndex={-1}
              className="crl-heading-2 kr-page__title"
            >
              키링 화면 보내기
            </h1>
            <p className="crl-body-sm">
              키링을 USB-C 단자에 꽂으면 블루투스로 연결됩니다. maishift 핸들을 넣으면 프로필 화면을 만들어 보냅니다.
            </p>
          </header>

          {available && device ? (
            <Card as="section" className="kr-stack" aria-labelledby="kr-update-title">
              <div>
                <CardTitle id="kr-update-title">새 펌웨어 {available.version}</CardTitle>
                <CardBody>지금은 {device.info.fw} 입니다. 기기 설정에서 업데이트할 수 있고, 1~2분 걸립니다.</CardBody>
              </div>
              <div className="kr-actions">
                <Button onClick={() => navigate('device')}>업데이트하러 가기</Button>
              </div>
            </Card>
          ) : null}

          {info ? (
            <DeviceCard
              info={info}
              name={device?.name ?? '미리보기 기기'}
              demo={device === null}
              devMode={devMode}
              onDisconnect={device ? () => device.disconnect() : undefined}
            />
          ) : (
            connectCard
          )}

          {/* 기기가 없어도 2.13" 기준으로 미리 볼 수 있다 (보내기는 연결 뒤에). */}
          <ProfileCard
            key={(info ?? DEMO_INFO[DEFAULT_DEMO]).panel}
            info={info ?? DEMO_INFO[DEFAULT_DEMO]}
            device={device}
            log={log}
            chunkSize={chunkSize}
            savedHandle={settings.handle}
            profile={profile.state}
            onLoad={(handle) => void profile.load(handle)}
            layout={layout}
          />
        </section>

        <section className="kr-page" hidden={tab !== 'layout'} aria-labelledby="kr-title-layout">
          <header className="kr-hero">
            <h1
              id="kr-title-layout"
              ref={(el) => {
                headingRefs.current.layout = el;
              }}
              tabIndex={-1}
              className="crl-heading-2 kr-page__title"
            >
              레이아웃
            </h1>
            <p className="crl-body-sm">키링 화면에 무엇을 어디에 둘지 정하고, 링크나 파일로 공유합니다.</p>
          </header>
          <LayoutEditor info={info} profile={profile.loaded} layout={layout} onChange={setLayout} />
          <LayoutShareCard layout={layout} onChange={setLayout} />
        </section>

        <section className="kr-page" hidden={tab !== 'device'} aria-labelledby="kr-title-device">
          <header className="kr-hero">
            <h1
              id="kr-title-device"
              ref={(el) => {
                headingRefs.current.device = el;
              }}
              tabIndex={-1}
              className="crl-heading-2 kr-page__title"
            >
              기기 설정
            </h1>
            <p className="crl-body-sm">펌웨어 업데이트와 전송 방식을 정합니다.</p>
          </header>

          {info === null ? connectCard : null}

          {/* 배포된 새 펌웨어는 누구나 업데이트한다. 파일(.bin)로 올리기는 개발자 모드에서만 보인다. */}
          {info ? (
            <FirmwareCard
              info={info}
              device={device}
              release={release}
              onRecheck={recheckRelease}
              devMode={devMode}
              chunkSize={chunkSize}
              log={log}
              expectReboot={(expected) => {
                rebootExpected.current = expected;
              }}
              onReconnected={setDevice}
              onLost={onDeviceLost}
            />
          ) : null}

          <DevModeCard devMode={devMode} onChange={(next) => updateSettings({ devMode: next })} />

          {devMode && info ? (
            <PanelCheckCard key={info.panel} info={info} device={device} log={log} chunkSize={chunkSize} />
          ) : null}
          {devMode ? <TransferCard chunkSize={chunkSize} onChunkSizeChange={setChunkSize} /> : null}
          {devMode ? <LogCard entries={entries} /> : null}
        </section>
      </main>

      {/* maishift 개발자 약관: 데이터 출처와 비공식 앱임을 밝힌다. */}
      <Footer>
        <span>캐롤 키링</span>
        <span>
          프로필 데이터: <a href="https://maimai.shiftpsh.com">maishift</a> · SEGA 와 관계없는 비공식 앱입니다. maimai 는
          SEGA 의 상표입니다.
        </span>
      </Footer>

      <AppNav variant="bottom" tab={tab} onNavigate={navigate} badges={badges} />
    </div>
  );
}
