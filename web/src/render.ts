// 캔버스에 그린 화면을 패널로 보낼 프레임으로 바꾼다.

import { canvasSize, encodeFrame } from './protocol.ts';
import type { DeviceInfo, EncodedFrame } from './protocol.ts';

/** 패널 크기 캔버스를 만들어 draw 로 그리고 인코딩한다. 실패하면 Error 를 돌려준다 (던지지 않는다). */
export function renderFrame(
  info: DeviceInfo,
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
): EncodedFrame | Error {
  const { width, height } = canvasSize(info);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Error('캔버스를 만들 수 없다');
  try {
    draw(ctx, width, height);
    return encodeFrame(ctx.getImageData(0, 0, width, height), info);
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
