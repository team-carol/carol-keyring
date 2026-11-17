# 캐롤 키링 펌웨어

BLE 이름은 `carol-keyring-XXXX` 다. `XXXX` 는 칩 기본 MAC 끝 4자리라 기기마다 다르다.

XIAO ESP32-C3용. 폰 USB-C로 전원을 받고, BLE로 받은 프레임을 전자잉크에 그린다.
프로토콜은 [`../docs/protocol.md`](../docs/protocol.md) 참고.

## 빌드 환경

패널은 빌드할 때 고른다. 펌웨어는 그 패널 정보를 BLE Info로 알려 준다.

| env | 패널 | 비고 |
|---|---|---|
| `preview_e6` (기본) | 없음 | 받은 프레임을 시리얼에 문자로 출력. Info는 1.54" 6색과 같다. |
| `preview_bwry` | 없음 | 위와 같고, Info는 2.13" 4색과 같다. |
| `seeed213_bwry` | Seeed 2.13" 4색(흑백적황) 122×250, JD79676 + XIAO ePaper 드라이버 보드 | 갱신 시간은 실측 필요 |
| `ws154_e6` | Waveshare 1.54inch e-Paper Module (E), 240×240, 6색 | 갱신 약 27초 |
| `seeed213_bw` | Seeed 2.13" 흑백 122×250, SSD1680 + XIAO ePaper 드라이버 보드 | 개발용 |

```sh
pio run -e preview_e6 -t upload
pio device monitor
```

## 배선 (XIAO ESP32-C3)

Seeed XIAO ePaper 드라이버 보드와 같은 배치다. Waveshare 모듈은 PWR을 D4에 추가로 연결한다.

| 신호 | 핀 |
|---|---|
| RST | D0 |
| CS | D1 |
| BUSY | D2 |
| DC | D3 |
| PWR (Waveshare만) | D4 |
| SCK | D8 |
| MOSI (DIN) | D10 |

안테나를 꼭 연결할 것. 없으면 BLE 거리가 극단적으로 짧다.

## 구조

```
src/
├─ main.cpp            부팅, 워커 태스크 (화면 갱신, 업데이트 뒤 재부팅)
├─ config.h            UUID, 핀, 버전
├─ device_name.*       BLE 이름 carol-keyring-XXXX
├─ ble_service.*       GATT 서비스 (Info / Control / Data / Status)
├─ transfer.*          화면 프레임: 조각 조립, offset 검사, CRC 검증
├─ firmware_update.*   무선 업데이트: OTA 파티션에 쓰기, 검증, 롤백 확인
├─ crc32.*
└─ display/
   ├─ display.*        공통 인터페이스, env별 디스플레이 선택
   ├─ epd_spi.*        SPI 명령/데이터 전송, 리셋, BUSY 대기 공통 처리
   ├─ e6_palette.h     6색 팔레트와 패널 정보
   ├─ bwry_palette.h   4색 팔레트와 패널 정보
   ├─ serial_preview.* 패널 없는 개발용
   ├─ seeed213_bwry.*  Seeed 2.13" 4색 (Seeed_GFX JD79676 드라이버 기반)
   ├─ ws154_e6.*       Waveshare 1.54" 6색 (Waveshare 예제 기반)
   └─ seeed213_bw.*    Seeed 2.13" 흑백 (GxEPD2)
```

새 패널을 추가하려면 `display/`에 `Display`를 구현하고, `display.cpp`의 `createDisplay()`와
`platformio.ini`에 env를 추가한다. 웹은 Info만 보고 동작하므로 고칠 필요가 없다.

## 참고

- `seeed213_bw`는 GxEPD2(GPL-3.0)를 링크한다. 이 빌드를 배포할 때는 GPL 조건을 따라야 한다.
- 6색 팔레트의 `rgb` 값은 디더링용 근사값이다. 실물을 보고 조정한다.

## 무선 업데이트

블루투스로 펌웨어를 올린다. 절차와 안전장치는 [`../docs/protocol.md`](../docs/protocol.md#펌웨어-업데이트) 참고.

- **사용자**: 웹이 연결된 키링보다 새 펌웨어가 배포돼 있으면 홈과 기기 설정 탭에 알리고, 버튼 하나로 업데이트한다.
- **개발자 모드**: 기기 설정 → 펌웨어 카드에서 `.pio/build/<env>/firmware.bin` 파일을 직접 골라 올릴 수도 있다.

### 새 버전 배포

1. `platformio.ini` 의 `FW_VERSION` 을 올린다 (`x.y.z` 숫자만. 웹이 이 값으로 새 버전인지 비교한다).
2. 저장소 루트에서 `pnpm firmware:release seeed213_bwry --remote` 를 실행한다. 여러 env 를 한 번에 적어도 된다.
   - pio 로 빌드하고, 펌웨어 안의 버전·빌드 표시를 확인한다.
   - R2 버킷 `carol-keyring-firmware` 에 올라가 있는 버전보다 높을 때만 `<env>/carol-keyring-<env>-<버전>.bin` 을 올리고,
     맨 마지막에 `manifest.json` (버전, 크기, SHA-256) 을 바꾼다. 같은 버전을 다른 내용으로 다시 올리지는 않는다.
   - 웹 배포(`pnpm cf:deploy`)는 필요 없다. 올리자마자 웹이 Worker 의 `/api/firmware/` 로 새 버전을 본다.
3. `--remote` 를 빼면 로컬(`pnpm dev` 가 쓰는 R2)에 올린다. 배포 전에 업데이트를 시험할 때 쓴다.

처음 한 번은 `pnpm --filter web exec wrangler login` 과
`pnpm --filter web exec wrangler r2 bucket create carol-keyring-firmware` 가 필요하다.

웹은 키링의 Info `build` 와 같은 env 의 펌웨어만 보고, 받은 파일의 크기·SHA-256·안의 버전 표시가 manifest 와 맞을 때만 보낸다.
예전 버전 파일은 지우지 않고 R2 에 기록으로 남긴다. 웹은 키링보다 새 버전만 권하므로, 문제가 있는 버전을 냈으면
고친 펌웨어를 더 높은 버전으로 다시 낸다.

- 펌웨어 자리(OTA 파티션)가 두 개 필요해서 `board_build.partitions = default.csv` 를 쓴다 (app0/app1 각 1.25MB).
- 새 펌웨어는 처음 켜졌을 때 BLE 광고까지 올라와야 스스로 정상으로 표시한다. 30초 안에 못 하면 이전 펌웨어로 돌아간다.
- 펌웨어에는 `CAROL-KEYRING-FW|<버전>|<env>|` 표시가 들어간다. 웹은 이걸로 파일을 확인한다.
  버전은 `platformio.ini` 의 `FW_VERSION`, env 는 빌드 환경 이름이다.
- 아직 누구나 업데이트할 수 있다 (버튼 확인, 서명은 나중에).
