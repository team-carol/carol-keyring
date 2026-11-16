# 캐롤 키링 웹

키링에 화면을 보내는 웹 앱. Vite + React + TypeScript 이고, 디자인은
[carol-design-system](https://github.com/team-carol/carol-design-system) 을 따른다.
BLE 프로토콜은 [`../docs/protocol.md`](../docs/protocol.md) 참고.

## 실행

저장소 루트에서 한다. pnpm 은 `packageManager` 에 적힌 버전(12.17.0)을 쓴다.

```sh
pnpm install                     # 의존성 설치
cp web/.dev.vars.example web/.dev.vars   # maishift API 키를 채운다 (프로필 받기에 필요)
pnpm dev                         # http://localhost:5173 (웹 + Worker)
```

pnpm 이 없으면 `npx pnpm@12.17.0 install` 처럼 앞에 `npx pnpm@12.17.0` 을 붙여도 된다.

| 명령 | 내용 |
|---|---|
| `pnpm dev` | 개발 서버. 웹과 Worker(`/api`)를 같이 띄운다 |
| `pnpm build` | 타입 검사(웹 + Worker) + 빌드 (`web/dist/client` 웹, `web/dist/carol_keyring` Worker) |
| `pnpm test` | 프로토콜·디더링·펌웨어 버전 테스트 (`node --test`) |
| `pnpm typecheck` | 타입 검사 |
| `pnpm cf:deploy` | 빌드 후 Cloudflare 에 배포 (`wrangler deploy`) |
| `pnpm --filter web cf-typegen` | `wrangler.jsonc` 를 바꾼 뒤 Worker 타입(`worker-configuration.d.ts`)을 다시 만든다 |

## 배포 (Cloudflare Worker 하나)

웹(정적 파일)과 API 를 Worker 하나로 같은 주소에서 내보낸다. 설정은 [`wrangler.jsonc`](wrangler.jsonc).

| 경로 | 처리 |
|---|---|
| `/api/profile/{handle}?region=intl` | [`worker/index.ts`](worker/index.ts): maishift 공개 프로필을 받아 준다. 5분 캐시 |
| 그 밖 (`/`, `/assets/*`, `/firmware/*`) | 정적 파일. 없는 경로는 `index.html` |

- maishift API 키는 브라우저로 보내지 않는다. 로컬은 `web/.dev.vars`(git 에 안 올라감), 배포는
  `pnpm --filter web exec wrangler secret put MAISHIFT_API_KEY`.
- 처음 배포 전에 `pnpm --filter web exec wrangler login` 으로 Cloudflare 에 로그인한다.
- 웹에서는 `src/profileApi.ts` 의 `fetchProfile(handle)` 로 부른다.

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
├─ patterns.ts         보낼 화면 목록: 프로필 샘플, 테스트 패턴, 단색
├─ maishift.ts         maishift 프로필 응답 형식, 단위 이름(真皆伝 …), 레이팅 색 구간
├─ profileLayout.ts    프로필 화면 그리기 (가로 250×122 / 정사각형 240×240 배치)
├─ profileSamples.ts   연동 전 샘플 프로필 (레이팅 구간마다 하나)
├─ sampleIcon.ts       연동 전 샘플 아이콘 (캔버스로 그린 그림)
├─ dither.ts           오차 확산 디더링 (아이콘을 패널 색으로)
├─ profileApi.ts       Worker 의 /api/profile 부르기
├─ demo.ts             기기 없이 둘러볼 때 쓰는 Info
├─ useLog.ts           로그 (개발자 모드가 꺼져 있어도 모아 둔다)
├─ useSettings.ts      설정 (개발자 모드)
├─ app.css             이 앱에서만 쓰는 스타일 (kr-*)
└─ components/         AppNav(탭 이동), ConnectCard, DeviceCard, ScreenCard, FirmwareCard,
                       DevModeCard, TransferCard, LogCard, PanelPreview, ProgressBar, Switch, Notice
test/protocol.test.ts, test/release.test.ts, test/dither.test.ts
worker/index.ts       Cloudflare Worker (/api)
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

## 프로필 화면

maishift `GET /api/v1/profiles/{handle}` 응답(`profile`)을 Worker(`/api/profile/{handle}`)로 받아 그린다.
"보낼 화면 → 프로필"에서 maishift 핸들을 넣고 불러오면 "내 프로필"이 되고, 핸들은 이 브라우저에 저장돼 다음에 열 때 바로 불러온다.
핸들이 없으면 샘플로 본다. 바닥글에 maishift 출처와 비공식 앱 문구를 넣었다 (maishift 개발자 약관).

- 2.13" (250×122): 위에 아이콘·이름·칭호·별/플레이 수/갱신 날짜, 아래에 레이팅 판과 단위·클래스.
- 1.54" (240×240): 같은 내용을 크게, 맨 아래에 이번 버전 플레이 수.
- 기본은 흑백이다. 칸은 흰 바탕 + 검정 테두리(레이팅, 칭호, 클래스)와 검정 바탕 + 흰 글자(단위) 두 가지다.
- 빨강·노랑·초록·파랑이 다 있는 패널(6색)에서만 레이팅 판에 구간 색을 넣는다 (`profileLayout.ts` 의 `ratingPlateStyle`).
  없는 색은 바탕 + 띠로 나타낸다: 보라 = 파랑 + 빨강 띠, 동 = 빨강 + 노랑 띠, 은 = 검정, 금 = 노랑 + 검정 띠,
  플래티넘 = 흰색 + 노랑 띠, 무지개 = 검정 바탕에 숫자마다 빨강·노랑·초록.
  4색(흑백적황)은 11단계를 나눌 수 없어서 흑백으로 둔다. 칭호 판은 어느 패널이든 흑백이다.
- 웹의 "보낼 화면 → 프로필 (샘플)"에서 레이팅 구간마다 하나씩 있는 샘플 11개를 골라 본다.
- 게임 이름은 보통 전각(ＣＡＲＯＬ)이라 반각으로 바꿔 그린다.
- 글자는 따로 그린 뒤 절반 넘게 칠해진 픽셀만 한 색으로 찍는다. 안티앨리어싱 중간색이 엉뚱한 패널 색으로 바뀌지 않게 한다.
- 화면에서 색은 아이콘에만 쓴다. 아이콘은 가운데를 정사각형으로 잘라 칸 크기로 줄이고, 밝기 범위를 늘리고 중간 밝기를 조금 어둡게(감마 1.15) 한 뒤
  패널 색 전부(4색)로 오차 확산 디더링한다 (`dither.ts` 의 `enhanceForPanel`, `ditherToPalette`). 이미지가 없으면 이름 첫 글자.
- 내 프로필은 게임 아이콘(`iconUrl`)을 Worker(`/api/profile/{handle}/icon`)로 받아 그린다. SEGA 서버에 CORS 헤더가 없어서 브라우저가 직접 읽지 못한다.
  로컬 Worker 런타임은 그 서버와 TLS 연결이 끊겨서, 개발 서버에서는 Vite 의 `/__dev/icon` 이 대신 받는다 (`vite.config.ts`). 샘플은 샘플 그림.

## 색 고르기

이미지의 각 픽셀은 패널 팔레트 중 가장 가까운 색으로 바뀐다. 거리는 OKLab 에서 재되 색 차이를 밝기 차이보다
무겁게 친다. 그래야 글자 테두리 같은 중간 회색이 밝기가 비슷한 빨강·노랑이 아니라 검정이나 흰색으로 간다.
사진처럼 색이 많은 이미지는 나중에 디더링을 붙인다.
