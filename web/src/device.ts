// 키링 기기와의 BLE 통신. 화면(React)과 분리해 두어 나중에 다른 화면에서도 그대로 쓴다.

import {
  CONTROL_UUID,
  DATA_UUID,
  Err,
  INFO_UUID,
  Op,
  PROTOCOL_VERSION,
  SERVICE_UUID,
  STATUS_UUID,
  State,
  beginPacket,
  crc32,
  dataPacket,
  parseStatus,
} from './protocol.ts';
import type { DeviceInfo, Status } from './protocol.ts';

export interface DeviceEvents {
  onStatus?: (status: Status) => void;
  onDisconnect?: () => void;
  onLog?: (message: string) => void;
}

export type SendProgress =
  | { phase: 'sending'; sent: number; total: number }
  | { phase: 'refreshing'; elapsedMs: number; expectedMs: number };

export type UpdateProgress =
  | { phase: 'sending'; sent: number; total: number }
  | { phase: 'installing' }
  | { phase: 'reconnecting'; elapsedMs: number };

export interface TransferOptions<P> {
  /** 한 번에 보내는 데이터 바이트 수 (offset 4바이트 제외) */
  chunkSize: number;
  signal?: AbortSignal;
  onProgress?: (progress: P) => void;
}

export interface SendResult {
  sendMs: number;
  refreshMs: number;
}

interface Waiter {
  match: (status: Status) => boolean;
  resolve: (status: Status) => void;
}

const DISCONNECTED: Status = { state: State.ERROR, error: -1, value: 0, stateName: 'ERROR', errorName: 'DISCONNECTED' };

const isBadOffset = (s: Status) => s.state === State.ERROR && s.error === Err.BAD_OFFSET;
const isDisconnected = (s: Status) => s.errorName === 'DISCONNECTED';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class DeviceError extends Error {
  readonly status: Status | undefined;
  constructor(message: string, status?: Status) {
    super(message);
    this.status = status;
  }
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export class KeyringDevice {
  readonly name: string;
  readonly info: DeviceInfo;

  private readonly device: BluetoothDevice;
  private readonly control: BluetoothRemoteGATTCharacteristic;
  private readonly data: BluetoothRemoteGATTCharacteristic;
  private readonly status: BluetoothRemoteGATTCharacteristic;
  private readonly events: DeviceEvents;
  private waiters: Waiter[] = [];
  private lastStatus: Status | null = null;
  private pendingBadOffset: number | null = null;
  private busy = false;

  private readonly onStatusChanged = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (value) this.handleStatus(parseStatus(value));
  };
  private readonly onGattDisconnected = () => this.handleDisconnect();

  /** 브라우저의 기기 선택 창을 띄워 키링에 연결한다. 사용자 동작(클릭) 안에서 불러야 한다. */
  static async request(events: DeviceEvents = {}): Promise<KeyringDevice> {
    const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE_UUID] }] });
    events.onLog?.(`${device.name ?? '이름 없는 기기'} 연결 중`);
    return KeyringDevice.open(device, events);
  }

  private static async open(device: BluetoothDevice, events: DeviceEvents): Promise<KeyringDevice> {
    if (!device.gatt) throw new DeviceError('GATT 를 지원하지 않는 기기');
    try {
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const [infoChar, control, data, status] = await Promise.all([
        service.getCharacteristic(INFO_UUID),
        service.getCharacteristic(CONTROL_UUID),
        service.getCharacteristic(DATA_UUID),
        service.getCharacteristic(STATUS_UUID),
      ]);

      const info = JSON.parse(new TextDecoder().decode(await infoChar.readValue())) as DeviceInfo;
      if (info.proto !== PROTOCOL_VERSION) {
        throw new DeviceError(`프로토콜 v${info.proto} 는 지원하지 않는다 (웹은 v${PROTOCOL_VERSION})`);
      }

      const keyring = new KeyringDevice(device, info, control, data, status, events);
      status.addEventListener('characteristicvaluechanged', keyring.onStatusChanged);
      await status.startNotifications();
      device.addEventListener('gattserverdisconnected', keyring.onGattDisconnected);
      return keyring;
    } catch (error) {
      if (device.gatt.connected) device.gatt.disconnect();
      throw error;
    }
  }

  private constructor(
    device: BluetoothDevice,
    info: DeviceInfo,
    control: BluetoothRemoteGATTCharacteristic,
    data: BluetoothRemoteGATTCharacteristic,
    status: BluetoothRemoteGATTCharacteristic,
    events: DeviceEvents,
  ) {
    this.device = device;
    this.name = device.name ?? '키링';
    this.info = info;
    this.control = control;
    this.data = data;
    this.status = status;
    this.events = events;
  }

  get connected(): boolean {
    return this.device.gatt?.connected ?? false;
  }

  /** 무선 업데이트를 받을 수 있는 최대 크기. 0 이면 이 펌웨어는 무선 업데이트를 지원하지 않는다. */
  get otaMaxLen(): number {
    return this.info.otaMaxLen ?? 0;
  }

  disconnect(): void {
    this.device.gatt?.disconnect();
  }

  /** 프레임 한 장을 보내고 화면 갱신이 끝날 때까지 기다린다. */
  async send(frame: Uint8Array, options: TransferOptions<SendProgress>): Promise<SendResult> {
    return this.exclusive(async () => {
      const sendMs = await this.upload(Op.BEGIN, frame, options);

      const commitAck = this.waitFor(() => true, 5000, 'COMMIT');
      await this.control.writeValueWithResponse(Uint8Array.of(Op.COMMIT));
      const committed = await commitAck;
      if (committed.state !== State.REFRESHING) throw statusError('COMMIT', committed);

      // 갱신은 기기 쪽에서 진행되므로 예상 시간 기준으로만 진행률을 알린다.
      const refreshStarted = performance.now();
      const expectedMs = this.info.refreshMs;
      const ticker = setInterval(() => {
        options.onProgress?.({ phase: 'refreshing', elapsedMs: performance.now() - refreshStarted, expectedMs });
      }, 200);
      try {
        // 기기는 BUSY 한 번에 최대 60초까지 기다리므로 그보다 넉넉히 기다린다.
        const final = await this.waitFor(
          (s) => s.state === State.DONE || s.state === State.ERROR,
          expectedMs * 3 + 70000,
          '화면 갱신',
        );
        if (final.state !== State.DONE) throw statusError('화면 갱신', final);
      } finally {
        clearInterval(ticker);
      }
      const refreshMs = performance.now() - refreshStarted;
      this.log(`화면 갱신 완료: ${(refreshMs / 1000).toFixed(1)} s (예상 ${(expectedMs / 1000).toFixed(1)} s)`);
      return { sendMs, refreshMs };
    });
  }

  /**
   * 펌웨어 파일을 보내 설치한다. 성공하면 기기가 재부팅하며 연결이 끊긴다.
   * 새 펌웨어로 다시 연결하려면 이어서 reconnect() 를 부른다.
   */
  async updateFirmware(firmware: Uint8Array, options: TransferOptions<UpdateProgress>): Promise<void> {
    if (this.otaMaxLen === 0) throw new DeviceError('이 펌웨어는 무선 업데이트를 지원하지 않습니다. USB 로 올려 주세요.');
    if (firmware.length > this.otaMaxLen) {
      throw new DeviceError(`펌웨어가 너무 큽니다 (${firmware.length} > ${this.otaMaxLen} bytes)`);
    }
    await this.exclusive(async () => {
      await this.upload(Op.UPDATE_BEGIN, firmware, options);

      options.onProgress?.({ phase: 'installing' });
      // 기기는 COMMIT 을 받으면 CRC 와 이미지를 검증한 뒤 REBOOTING 을 알리고 재부팅한다.
      const commitAck = this.waitFor((s) => s.state === State.REBOOTING || s.state === State.ERROR, 15000, '설치');
      await this.control.writeValueWithResponse(Uint8Array.of(Op.COMMIT));
      const committed = await commitAck;
      if (committed.state !== State.REBOOTING) throw statusError('설치', committed);
      this.log('설치 완료, 기기가 재부팅합니다');
    });
  }

  /** 재부팅한 같은 기기에 다시 연결한다 (기기 선택 창 없이). */
  async reconnect(timeoutMs: number, onProgress?: (elapsedMs: number) => void): Promise<KeyringDevice> {
    this.dispose();
    const started = performance.now();
    // 재부팅해서 다시 광고하기까지 시간이 걸린다.
    await sleep(1500);
    let lastError: unknown = null;
    while (performance.now() - started < timeoutMs) {
      onProgress?.(performance.now() - started);
      try {
        const next = await KeyringDevice.open(this.device, this.events);
        this.log(`다시 연결됨: 펌웨어 ${next.info.fw}`);
        return next;
      } catch (error) {
        lastError = error;
        await sleep(1500);
      }
    }
    const reason = lastError instanceof Error ? ` (${lastError.message})` : '';
    throw new DeviceError(`${Math.round(timeoutMs / 1000)}초 안에 다시 연결하지 못했습니다${reason}`);
  }

  // 한 번에 하나의 전송만 한다. 실패하면 기기 쪽 수신 상태를 정리한다.
  private async exclusive<T>(job: () => Promise<T>): Promise<T> {
    if (this.busy) throw new DeviceError('이미 보내는 중');
    this.busy = true;
    try {
      return await job();
    } catch (error) {
      if (this.connected && this.lastStatus?.state === State.RECEIVING) {
        await this.control.writeValueWithResponse(Uint8Array.of(Op.ABORT)).catch(() => {});
      }
      throw error;
    } finally {
      this.busy = false;
    }
  }

  // BEGIN → 조각 전송 → 기기가 다 받았다고 알릴 때까지. 보내는 데 걸린 ms 를 돌려준다.
  private async upload(
    op: number,
    bytes: Uint8Array,
    { chunkSize, signal, onProgress }: TransferOptions<{ phase: 'sending'; sent: number; total: number }>,
  ): Promise<number> {
    const total = bytes.length;
    const crc = crc32(bytes);
    this.log(`전송 시작: ${total} bytes, crc32 0x${crc.toString(16).padStart(8, '0')}, 조각 ${chunkSize} bytes`);

    // 알림을 놓치지 않도록 쓰기 전에 대기를 먼저 건다.
    const beginAck = this.waitFor(() => true, 10000, 'BEGIN');
    await this.control.writeValueWithResponse(beginPacket(total, crc, op));
    const begun = await beginAck;
    if (begun.state !== State.RECEIVING) throw statusError('BEGIN', begun);

    const started = performance.now();
    const isComplete = (s: Status) => s.state === State.RECEIVING && s.value === total;
    let offset = 0;
    let resends = 0;
    this.pendingBadOffset = null;
    for (;;) {
      while (offset < total && this.pendingBadOffset === null) {
        if (signal?.aborted) throw new DeviceError('취소함');
        if (!this.connected) throw new DeviceError('전송 중 연결이 끊김', DISCONNECTED);
        const length = Math.min(chunkSize, total - offset);
        await this.data.writeValueWithoutResponse(dataPacket(bytes, offset, length));
        offset += length;
        onProgress?.({ phase: 'sending', sent: offset, total });
      }

      // 마지막 조각까지 보냈으면 기기가 다 받았다고 알릴 때까지 기다린다.
      if (this.pendingBadOffset === null) {
        const last = this.lastStatus;
        const done =
          last && isComplete(last)
            ? last
            : await this.waitFor((s) => isComplete(s) || isBadOffset(s) || s.state === State.ERROR, 10000, '수신 완료');
        if (isComplete(done)) break;
        if (!isBadOffset(done)) throw statusError('전송', done);
      }

      // 기기가 BAD_OFFSET 을 알리면 그 위치부터 다시 보낸다.
      resends += 1;
      if (resends > 5) throw new DeviceError('BAD_OFFSET 이 계속 나서 포기함');
      offset = this.pendingBadOffset ?? 0;
      this.pendingBadOffset = null;
      this.log(`BAD_OFFSET: ${offset} 부터 다시 보냄`);
    }
    const sendMs = performance.now() - started;
    this.log(`전송 완료: ${(sendMs / 1000).toFixed(2)} s (${((total / sendMs) * 1000 / 1024).toFixed(1)} KB/s)`);
    return sendMs;
  }

  private handleStatus(status: Status): void {
    this.lastStatus = status;
    if (isBadOffset(status)) this.pendingBadOffset = status.value;
    if (status.state === State.ERROR) this.log(`Status ${status.errorName} value=${status.value}`);
    else if (status.state !== State.RECEIVING) this.log(`Status ${status.stateName}`);
    this.events.onStatus?.(status);

    const waiters = this.waiters;
    this.waiters = [];
    for (const waiter of waiters) {
      if (waiter.match(status)) waiter.resolve(status);
      else this.waiters.push(waiter);
    }
  }

  private handleDisconnect(): void {
    this.log('연결 끊김');
    const waiters = this.waiters;
    this.waiters = [];
    for (const waiter of waiters) waiter.resolve(DISCONNECTED);
    this.events.onDisconnect?.();
  }

  // 다시 연결할 때 이 객체에 걸어 둔 이벤트를 떼어 내서 중복으로 불리지 않게 한다.
  private dispose(): void {
    this.status.removeEventListener('characteristicvaluechanged', this.onStatusChanged);
    this.device.removeEventListener('gattserverdisconnected', this.onGattDisconnected);
  }

  // 조건에 맞는 다음 Status 알림을 기다린다. 연결이 끊기면 DISCONNECTED 로 끝난다.
  private waitFor(match: (s: Status) => boolean, timeoutMs: number, step: string): Promise<Status> {
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        match: (s) => match(s) || isDisconnected(s),
        resolve: (status) => {
          clearTimeout(timer);
          resolve(status);
        },
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(new DeviceError(`${step}: ${(timeoutMs / 1000).toFixed(0)}초 동안 응답 없음`));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  private log(message: string): void {
    this.events.onLog?.(message);
  }
}

function statusError(step: string, status: Status): DeviceError {
  if (isDisconnected(status)) return new DeviceError(`${step} 중 연결이 끊김`, status);
  switch (status.error) {
    case Err.PANEL_TIMEOUT:
      return new DeviceError('패널이 응답하지 않음. 커넥터 연결을 확인하세요.', status);
    case Err.BUSY:
      return new DeviceError('기기가 다른 일을 하는 중입니다. 잠시 뒤 다시 해 주세요.', status);
    case Err.CRC_MISMATCH:
      return new DeviceError('받은 데이터가 깨졌습니다 (CRC 불일치). 다시 보내 주세요.', status);
    case Err.FLASH:
      return new DeviceError(`펌웨어를 쓰거나 검증하지 못했습니다 (esp_err 0x${status.value.toString(16)})`, status);
    default:
      return new DeviceError(`${step} 실패: ${status.errorName} (${status.value})`, status);
  }
}
