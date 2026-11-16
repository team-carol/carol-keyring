# 캐롤 키링 웹

키링에 화면을 보내는 웹 앱. Vite + React + TypeScript 이고, 디자인은
[carol-design-system](https://github.com/team-carol/carol-design-system) 을 따른다.
BLE 프로토콜은 [`../docs/protocol.md`](../docs/protocol.md) 참고.

## 실행

저장소 루트에서 한다. pnpm 은 `packageManager` 에 적힌 버전(12.17.0)을 쓴다.

```sh
pnpm install                     # 의존성 설치
pnpm dev                         # http://localhost:5173
```

pnpm 이 없으면 `npx pnpm@12.17.0 install` 처럼 앞에 `npx pnpm@12.17.0` 을 붙여도 된다.

| 명령 | 내용 |
|---|---|
| `pnpm dev` | 개발 서버 (localhost) |
| `pnpm build` | 타입 검사 + `web/dist` 에 정적 파일 빌드 |
| `pnpm test` | 프로토콜 인코딩 테스트 (`node --test`) |
| `pnpm typecheck` | 타입 검사 |

- `?demo=seeed213_bwry`, `?demo=ws154_e6`: 기기 없이 화면을 둘러본다 (전송은 안 됨).
- **탭**: 폰(720px 이하)은 화면 아래 탭 막대, 넓은 화면은 상단바 오른쪽 링크.
  - **홈** (`./`): 기기 연결, 기기 정보, 보낼 화면.
  - **기기 설정** (`#/device`): 펌웨어, 개발자 모드, 전송 조각 크기, 로그.
  - 주소의 `#` 에 탭이 남아 새로 고침해도 그 탭이 열리고, 뒤로 가기를 누르면 홈으로 돌아온다.
  - 두 탭을 모두 그려 두고 안 보이는 쪽만 숨긴다. 업데이트나 전송 중에 탭을 옮겨도 멈추지 않는다.
- **펌웨어 업데이트**: 연결하면 `firmware/manifest.json`(웹과 같은 곳)을 보고, 키링과 같은 빌드의 더 새 버전이 있으면
  홈에 알림 카드, 기기 설정 탭에 점을 띄운다. 기기 설정 → 펌웨어에서 버튼 하나로 받고(크기·SHA-256·버전 확인) 올린다.
  배포 방법은 [`../firmware/README.md`](../firmware/README.md#새-버전-배포) 참고.
- **개발자 모드**: 기기 설정 탭에서 켠다. 켜야 파일(.bin)로 펌웨어 올리기, 조각 크기, 로그, 패널 ID·빌드·프레임 크기가
  보인다. 설정은 이 브라우저(localStorage)에만 저장된다.
- Web Bluetooth 는 `https` 나 `localhost` 에서만 동작한다. 폰에서 쓰려면 https 로 올려야 한다.
  안드로이드는 Chrome, iPhone 은 Safari 가 지원하지 않아서 Bluefy 앱으로 연다.

## 디자인 시스템

npmjs 에 공개된 [`@team-carol/design-system`](https://www.npmjs.com/package/@team-carol/design-system) 을 쓴다
(토큰이나 `.npmrc` 설정 필요 없음).

| 가져오는 경로 | 쓰는 곳 |
|---|---|
| `@team-carol/design-system/react` | 컴포넌트 (`Button`, `Card`, `TopBar` …), `cx` |
| `@team-carol/design-system/carol.css` | 토큰 + 리셋 + 컴포넌트 CSS (`main.tsx`) |
| `@team-carol/design-system` | 토큰 JS 값 (`color`, `fontUrls`) |

새 버전으로 올릴 때는 `web/package.json` 의 버전을 바꾸고 `pnpm install` 한다. pnpm 은 막 배포된 버전을 바로
받지 않으므로, 하루가 안 된 버전이면 `pnpm-workspace.yaml` 의 `minimumReleaseAgeExclude` 에 들어간다.

규칙 (디자인 시스템 스킬 요약):

- 색은 hex 를 쓰지 않고 토큰을 쓴다. CSS 는 `var(--crl-*)`, JS 는 `@team-carol/design-system` 의 `color`.
- 있는 컴포넌트(`Button`, `Card`, `Select`, `Stat`, `TopBar` …)를 먼저 쓴다.
- 없는 UI 는 `src/app.css` 에 `kr-` 접두사로 만든다. 다른 프로젝트도 쓰게 되면 디자인 시스템으로 옮긴다.
- 예외: 패널 미리보기와 색 견본은 기기가 알려 준 패널 팔레트 색을 그대로 쓴다 (브랜드 색이 아니다).

## 구조

```
src/
├─ main.tsx            진입점. 디자인 시스템 CSS, 글꼴, theme-color
├─ App.tsx             탭 두 개(홈, 기기 설정) 구성, 연결 상태
├─ useTab.ts           지금 탭. 주소 # 과 뒤로 가기에 맞춘다
├─ release.ts          배포된 펌웨어 manifest 읽기, 버전 비교, 받은 파일 검증
├─ useFirmwareRelease.ts  연결된 기기에 새 펌웨어가 있는지 확인
├─ device.ts           BLE 연결과 전송 (KeyringDevice). 화면과 분리돼 있다
├─ protocol.ts         UUID, CRC-32, 프레임 인코딩. DOM 없이 Node 테스트에서도 쓴다
├─ patterns.ts         테스트 패턴, 단색
├─ demo.ts             기기 없이 둘러볼 때 쓰는 Info
├─ useLog.ts           로그 (개발자 모드가 꺼져 있어도 모아 둔다)
├─ useSettings.ts      설정 (개발자 모드)
├─ app.css             이 앱에서만 쓰는 스타일 (kr-*)
└─ components/         AppNav(탭 이동), ConnectCard, DeviceCard, ScreenCard, FirmwareCard,
                       DevModeCard, TransferCard, LogCard, PanelPreview, ProgressBar, Switch, Notice
test/protocol.test.ts, test/release.test.ts
```

## 모바일 접근성

- 탭 이동은 `nav` 안의 링크에 `aria-current="page"` 를 단다. 화면 읽기 프로그램에서 "주 메뉴"로 찾을 수 있다.
- 탭을 바꾸면 새 화면의 제목으로 초점을 옮기고 페이지 제목(`document.title`)도 바꾼다.
- 연결 상태 표시는 `role="status"` 라 바뀔 때 읽어 준다.
- 누르는 영역은 44px 이상이다 (탭 막대 64px, 스위치와 접기 제목줄 44px).
- 폰에서는 입력 칸 글자를 16px 로 해서 iOS 가 초점을 받을 때 화면을 확대하지 않게 한다. 손가락 확대는 막지 않는다.
- 아이폰 아래 홈 막대와 가로 화면 노치(`safe-area-inset`)만큼 탭 막대를 띄운다.
- 키보드로 이동할 때 초점 받은 요소가 상단바나 탭 막대에 가리지 않게 `scroll-padding` 을 준다.
- 움직임 줄이기 설정은 디자인 시스템이 처리한다.

## 색 고르기

이미지의 각 픽셀은 패널 팔레트 중 가장 가까운 색으로 바뀐다. 거리는 OKLab 에서 재되 색 차이를 밝기 차이보다
무겁게 친다. 그래야 글자 테두리 같은 중간 회색이 밝기가 비슷한 빨강·노랑이 아니라 검정이나 흰색으로 간다.
사진처럼 색이 많은 이미지는 나중에 디더링을 붙인다.
