import { useEffect, useRef } from 'react';

import type { PaletteColor } from '../protocol.ts';

interface PanelPreviewProps {
  width: number;
  height: number;
  /** 캔버스 픽셀마다 고른 팔레트 인덱스 */
  indices: Uint8Array;
  palette: PaletteColor[];
  /** false 면 기기 테두리 없이 화면만 (목록의 작은 미리보기) */
  framed?: boolean;
  label?: string;
}

/** 팔레트 인덱스를 캔버스에 찍는다. 실제로 보낼 색(패널 팔레트로 줄인 결과) 그대로다. */
export function PixelScreen({
  width,
  height,
  indices,
  palette,
  className,
  label,
}: Omit<PanelPreviewProps, 'framed'> & { className: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const image = new ImageData(width, height);
    for (let i = 0; i < indices.length; i++) {
      const p = palette[indices[i]];
      image.data[i * 4] = p.r;
      image.data[i * 4 + 1] = p.g;
      image.data[i * 4 + 2] = p.b;
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }, [width, height, indices, palette]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={width}
      height={height}
      style={{ aspectRatio: `${width} / ${height}` }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

/** 보낼 화면을 기기 테두리 안에 픽셀 그대로 키워서 보여 준다. */
export function PanelPreview({ width, height, indices, palette }: PanelPreviewProps) {
  return (
    <div className="kr-panel">
      <div className="kr-panel__frame" style={{ maxWidth: width * 2 }}>
        <PixelScreen
          className="kr-panel__screen"
          width={width}
          height={height}
          indices={indices}
          palette={palette}
          label={`키링에 보낼 화면 미리보기 (${width}×${height})`}
        />
      </div>
    </div>
  );
}
