// 보낼 수 있는 화면 목록.
// profile: 프로필 화면 (maishift 연동 전이라 샘플 데이터). 그릴 프로필은 따로 넘긴다.
// test: 회전 방향(화살표), 보이는 영역(테두리, 눈금), 색(팔레트 막대)을 한 화면에서 본다.
// 색은 기기가 알려 준 패널 팔레트에서만 고른다 (브랜드 색이 아니라 패널이 낼 수 있는 색이다).

import type { PlayerProfile } from './maishift.ts';
import { drawProfile } from './profileLayout.ts';
import type { IconImage } from './profileLayout.ts';
import type { DeviceInfo, PaletteColor } from './protocol.ts';

export interface PatternOption {
  id: string;
  label: string;
  /** 고를 때 보여 줄 설명 */
  help: string;
}

export const PROFILE_PATTERN = 'profile';

const PALETTE_LABELS: Record<string, string> = {
  black: '검정',
  white: '흰색',
  yellow: '노랑',
  red: '빨강',
  blue: '파랑',
  green: '초록',
};

export function colorLabel(name: string): string {
  return PALETTE_LABELS[name] ?? name;
}

export function patternOptions(palette: PaletteColor[]): PatternOption[] {
  return [
    {
      id: PROFILE_PATTERN,
      label: '프로필',
      help: 'maishift 에서 받은 프로필을 그립니다. 핸들을 넣기 전에는 샘플로 볼 수 있습니다.',
    },
    {
      id: 'test',
      label: '테스트 패턴',
      help: '화살표가 위를 가리키는지, 테두리 네 변이 모두 보이는지, 색 막대가 맞는지 확인합니다.',
    },
    ...palette.map((p) => ({
      id: `solid:${p.name}`,
      label: `단색 · ${colorLabel(p.name)}`,
      help: '패널 전체를 한 색으로 칠합니다. 실제 색을 확인할 때 씁니다.',
    })),
  ];
}

export function drawPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: PaletteColor[],
  id: string,
  info: DeviceInfo,
  /** id 가 profile 일 때 그릴 프로필 */
  profile?: PlayerProfile,
  /** 프로필 아이콘 이미지 */
  icon?: IconImage | null,
): void {
  const color = (name: string) => palette.find((p) => p.name === name)?.rgb ?? palette[0].rgb;
  ctx.imageSmoothingEnabled = false;

  if (id === PROFILE_PATTERN && profile) {
    drawProfile(ctx, width, height, palette, profile, { icon });
    return;
  }

  if (id.startsWith('solid:')) {
    ctx.fillStyle = color(id.slice('solid:'.length));
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const black = color('black');
  const white = color('white');
  ctx.fillStyle = white;
  ctx.fillRect(0, 0, width, height);

  // 가장자리 1px 테두리. 한쪽이 잘려 보이면 보이는 영역이 밀린 것이다.
  ctx.strokeStyle = black;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  // 위쪽·왼쪽 가장자리 눈금: 10px 마다 짧게, 50px 마다 길게.
  ctx.fillStyle = black;
  for (let x = 0; x < width; x += 10) ctx.fillRect(x, 1, 1, x % 50 === 0 ? 7 : 3);
  for (let y = 0; y < height; y += 10) ctx.fillRect(1, y, y % 50 === 0 ? 7 : 3, 1);

  ctx.font = 'bold 11px monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(`${info.panel} rot${info.rot}`, 10, 10);

  // 위쪽을 가리키는 화살표. 패널에서 이 방향이 위로 보여야 한다.
  const arrowX = 12;
  const arrowW = 36;
  const arrowTop = 28;
  const arrowBottom = height - 10;
  ctx.beginPath();
  ctx.moveTo(arrowX + arrowW / 2, arrowTop);
  ctx.lineTo(arrowX + arrowW, arrowTop + 22);
  ctx.lineTo(arrowX + arrowW * 0.68, arrowTop + 22);
  ctx.lineTo(arrowX + arrowW * 0.68, arrowBottom);
  ctx.lineTo(arrowX + arrowW * 0.32, arrowBottom);
  ctx.lineTo(arrowX + arrowW * 0.32, arrowTop + 22);
  ctx.lineTo(arrowX, arrowTop + 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = white;
  ctx.font = 'bold 10px monospace';
  ctx.save();
  ctx.translate(arrowX + arrowW / 2 + 4, arrowBottom - 4);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('UP', 0, 0);
  ctx.restore();

  // 흰색을 뺀 팔레트 막대. 이름은 막대 안에 쓴다.
  const bars = palette.filter((p) => p.name !== 'white');
  const barsX = arrowX + arrowW + 10;
  const barsW = width - barsX - 6;
  const barsTop = 26;
  const barH = Math.floor((height - barsTop - 6) / bars.length);
  ctx.font = 'bold 11px monospace';
  bars.forEach((p, i) => {
    const y = barsTop + i * barH;
    ctx.fillStyle = p.rgb;
    ctx.fillRect(barsX, y, barsW, barH - 2);
    ctx.fillStyle = p.name === 'yellow' ? black : white;
    ctx.fillText(p.name, barsX + 4, y + Math.max(1, (barH - 2 - 11) / 2));
  });
}
