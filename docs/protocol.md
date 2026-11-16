# 캐롤 키링 BLE 프로토콜 v1

펌웨어와 웹이 공유하는 통신 규약이다. 기기는 빌드할 때 정해진 패널 정보를 Info로 알려 주고,
웹은 그 정보만 보고 이미지를 만들어 전송한다.

## 광고

- 이름: `carol-keyring-XXXX` (스캔 응답에 포함). `XXXX`는 칩 기본 MAC 끝 2바이트의 대문자 16진수다.
  기본 MAC은 USB 시리얼 번호로도 보이므로 PC에 꽂았을 때 보이는 번호와 맞춰 볼 수 있다.
- 광고 데이터에 서비스 UUID 포함 → 웹은 서비스 UUID로 필터링한다.

## GATT 서비스

서비스 UUID: `321f25a5-0001-4f89-8108-301f40abeb17`

| 이름 | UUID | 속성 | 형식 |
|---|---|---|---|
| Info | `321f25a5-0002-4f89-8108-301f40abeb17` | Read | UTF-8 JSON |
| Control | `321f25a5-0003-4f89-8108-301f40abeb17` | Write | opcode + payload |
| Data | `321f25a5-0004-4f89-8108-301f40abeb17` | Write Without Response | offset + 데이터 조각 |
| Status | `321f25a5-0005-4f89-8108-301f40abeb17` | Read, Notify | 6바이트 |

모든 정수는 리틀 엔디언이다.

### Info

```json
{
  "proto": 1,
  "fw": "0.1.0",
  "panel": "ws154_e6",
  "w": 240,
  "h": 240,
  "rot": 0,
  "fmt": "4bpp-e6",
  "palette": [
    { "code": 0, "rgb": "#1a1a1a", "name": "black" },
    { "code": 1, "rgb": "#e8e8e0", "name": "white" }
  ],
  "refreshMs": 27000,
  "maxLen": 28800,
  "build": "ws154_e6",
  "otaMaxLen": 1310720
}
```

| 필드 | 의미 |
|---|---|
| `proto` | 프로토콜 버전. 웹은 모르는 버전이면 전송하지 않는다. |
| `panel` | 빌드할 때 지정한 패널 ID |
| `w`, `h` | **패널 메모리 기준** 가로, 세로 픽셀 수 (스캔 순서) |
| `rot` | 웹에서 그린 이미지를 패널 메모리 방향으로 맞추기 위해 시계 방향으로 돌릴 각도 (0/90/180/270). 90/270이면 웹의 캔버스 크기는 `h`×`w`다. |
| `fmt` | 픽셀 형식 (아래 표) |
| `palette` | 디더링용 색 목록. `code`는 픽셀 값, `rgb`는 실제 패널에서 보이는 색에 가까운 값 |
| `refreshMs` | 전체 갱신 예상 시간. 웹은 진행 표시에 쓴다. |
| `maxLen` | 한 프레임의 바이트 수 |
| `build` | 펌웨어 빌드 환경 이름 (`platformio.ini` 의 env). 펌웨어 파일과 기기를 맞춰 볼 때 쓴다. |
| `otaMaxLen` | 무선 업데이트로 받을 수 있는 펌웨어 최대 크기. 0이거나 없으면 무선 업데이트를 지원하지 않는다. |

### 픽셀 형식

| fmt | 바이트 구성 | 한 줄 바이트 수 | 픽셀 값 |
|---|---|---|---|
| `1bpp-bw` | 1바이트에 8픽셀, MSB가 왼쪽 | `ceil(w / 8)` (남는 비트는 1) | 0 = 검정, 1 = 흰색 |
| `2bpp-bwry` | 1바이트에 4픽셀, 최상위 2비트가 왼쪽 | `ceil(w / 4)` (남는 픽셀은 흰색) | `palette[].code` |
| `4bpp-e6` | 1바이트에 2픽셀, 상위 4비트가 왼쪽 | `ceil(w / 2)` | `palette[].code` |

프레임은 위쪽 줄부터 줄 단위로 이어 붙인다. 프레임 크기 = 한 줄 바이트 수 × `h` = `maxLen`.

### Control

| opcode | 이름 | payload | 설명 |
|---|---|---|---|
| `0x01` | BEGIN | `u32 length`, `u32 crc32` | 전송 시작. `length`는 `maxLen`과 같아야 한다. |
| `0x02` | COMMIT | 없음 | 수신 완료. CRC를 검증하고 화면을 갱신한다. |
| `0x03` | ABORT | 없음 | 진행 중인 전송을 취소한다. |
| `0x10` | UPDATE_BEGIN | `u32 length`, `u32 crc32` | 펌웨어 전송 시작. `length`는 `otaMaxLen` 이하. 아래 [펌웨어 업데이트](#펌웨어-업데이트) 참고. |

COMMIT 과 ABORT 는 지금 받고 있는 쪽(화면 프레임이나 펌웨어)에 적용된다. 둘을 동시에 받지는 않는다.
프레임을 받거나 화면을 갱신하는 중에 UPDATE_BEGIN 이 오면, 또는 펌웨어를 받는 중에 BEGIN 이 오면 `BUSY` 다.

CRC는 CRC-32 (IEEE 802.3, zlib의 `crc32`와 같음)다.

### Data

```
u32 offset | 데이터 (최대 MTU - 7바이트)
```

`offset`은 반드시 이전 조각의 끝과 같아야 한다. 어긋나면 기기는 `BAD_OFFSET` 오류와 함께
기대한 offset을 Status `value`로 알려 준다. 웹은 그 위치부터 다시 보내면 된다.

### Status

```
u8 state | u8 error | u32 value
```

| state | 이름 | value |
|---|---|---|
| 0 | IDLE | 0 |
| 1 | RECEIVING | 지금까지 받은 바이트 수 |
| 2 | REFRESHING | 0 |
| 3 | DONE | 0 |
| 4 | ERROR | 오류마다 다름 (아래 표) |
| 5 | REBOOTING | 0. 펌웨어 검증이 끝나 곧 재부팅한다. |

| error | 이름 | value |
|---|---|---|
| 0 | NONE | |
| 1 | BAD_LENGTH | 기대한 길이 (`maxLen`) |
| 2 | BAD_OFFSET | 기대한 offset |
| 3 | CRC_MISMATCH | 기기가 계산한 CRC |
| 4 | NOT_RECEIVING | |
| 5 | BUSY | |
| 6 | INCOMPLETE | 받은 바이트 수 |
| 7 | BAD_OPCODE | 받은 opcode |
| 8 | PANEL_TIMEOUT | 갱신을 시작하고 포기할 때까지 걸린 ms |
| 9 | FLASH | 펌웨어를 쓰거나 검증하다 실패. ESP-IDF `esp_err_t` 값 |

RECEIVING 알림은 너무 잦지 않도록 일정 바이트마다 보낸다.

## 전송 절차

```
웹                                    기기
 |-- Info 읽기 ------------------------>|
 |-- Status 알림 구독 ----------------->|
 |-- Control BEGIN(len, crc) ---------->|  state=RECEIVING
 |-- Data (offset=0, ...) ------------->|
 |-- Data (offset=n, ...) ------------->|
 |<-------------- Status RECEIVING(n) --|
 |-- Control COMMIT ------------------->|  CRC 검증
 |<-------------- Status REFRESHING ----|  refreshMs 동안 갱신
 |<-------------- Status DONE ----------|  이제 분리해도 된다
```

REFRESHING 중에는 새 BEGIN을 받지 않는다 (`BUSY`).

패널이 응답하지 않으면(BUSY 한 번에 60초 초과) DONE 대신 `PANEL_TIMEOUT` 오류를 알리고 IDLE로
돌아간다. 패널이 빠졌거나 고장 난 경우다. 웹은 사용자에게 알리고, 다시 보낼 때는 BEGIN부터 한다.

## 펌웨어 업데이트

화면 프레임과 같은 Data 특성, 같은 조각 형식으로 보낸다. 기기는 받는 대로 쓰지 않는 쪽 펌웨어 자리
(OTA 파티션)에 바로 쓴다.

```
웹                                    기기
 |-- Control UPDATE_BEGIN(len, crc) --->|  state=RECEIVING
 |-- Data (offset=0, ...) ------------->|  플래시에 기록
 |<-------------- Status RECEIVING(n) --|
 |-- Control COMMIT ------------------->|  CRC-32, 이미지 SHA-256 검증 → 부팅 자리 변경
 |<-------------- Status REBOOTING -----|
 |            (연결 끊김, 재부팅)          |
 |-- 다시 연결, Info 읽기 --------------->|  fw 가 새 버전이면 성공
```

- **전원이 끊기면**: 부팅 자리는 COMMIT 의 검증이 끝나야 바뀌므로, 그 전에 끊기면 기존 펌웨어로 켜진다.
  처음부터 다시 보내면 된다.
- **새 펌웨어가 이상하면**: 새 펌웨어는 처음 켜졌을 때 BLE 광고까지 올라와야 스스로 정상으로 표시한다.
  30초 안에 그러지 못하거나 그 전에 재부팅되면 부트로더가 이전 펌웨어로 되돌린다.
- **파일 확인**: 웹은 보내기 전에 파일을 확인한다.
  - ESP 이미지 매직(`0xE9`)과 칩 ID(ESP32-C3 = 5)가 맞는지 본다.
  - 파일 안의 표시 `CAROL-KEYRING-FW|<버전>|<빌드 환경>|` 를 찾는다. 없으면 이 기기의 펌웨어가 아니다.
  - 빌드 환경이 기기의 `build` 와 다르면 경고한다. 패널 종류가 다른 펌웨어일 수 있다.
- 지금은 누구나 업데이트할 수 있다. 버튼 확인이나 서명 확인은 나중에 추가한다.
