// 프로필 화면 그리기. 캔버스에 그린 뒤 encodeFrame 이 패널 팔레트로 줄인다.
// 기본은 흑백이다. 빨강·노랑·초록·파랑이 다 있는 패널(6색)에서만 레이팅 판에 게임 색을 넣는다.
// 4색(흑백적황)으로는 레이팅 11단계를 나눌 수 없고, 억지로 넣으면 산만해서 흑백으로 둔다.
// 글자는 굵게 그리고 한 색으로 찍어서 또렷하게 한다.
//
// 가로로 긴 화면(2.13" 250×122)과 정사각형에 가까운 화면(1.54" 240×240) 두 가지 배치가 있다.

import { fontFamily } from '@team-carol/design-system';

import { courseRankLabel, ratingTier } from './maishift.ts';
import type { PlayerProfile, RatingTier } from './maishift.ts';
import { ditherToPalette, enhanceForPanel } from './dither.ts';
import type { PaletteColor } from './protocol.ts';

/** 아이콘으로 그릴 수 있는 이미지 */
export type IconImage = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

type Ctx = CanvasRenderingContext2D;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 칸 모양. outline: 흰 바탕 + 검정 테두리, solid: 검정 바탕 + 흰 글자 */
type Box = 'outline' | 'solid';

interface Ink {
  black: string;
  white: string;
  /** 빨강·노랑·초록·파랑이 다 있는 패널(6색)일 때만 있다 */
  color: { red: string; yellow: string; green: string; blue: string } | null;
  /** 패널 팔레트 전체. 아이콘 디더링에 쓴다. */
  palette: PaletteColor[];
}

function inkOf(palette: PaletteColor[]): Ink {
  const find = (name: string) => palette.find((p) => p.name === name)?.rgb;
  const [red, yellow, green, blue] = [find('red'), find('yellow'), find('green'), find('blue')];
  return {
    black: find('black') ?? palette[0].rgb,
    white: find('white') ?? palette[palette.length - 1].rgb,
    color: red && yellow && green && blue ? { red, yellow, green, blue } : null,
    palette,
  };
}

/**
 * 레이팅 판 모양.
 * frame 은 테두리 안쪽 띠, cycle 은 글자마다 바꿔 쓰는 색(무지개)이다.
 */
interface Plate {
  bg: string;
  fg: string;
  /** 바깥 검정 선 두께 (0 이면 없음) */
  border: number;
  frame?: { color: string; width: number };
  cycle?: string[];
}

/**
 * 레이팅 구간 색. 6색 패널에 없는 색(보라, 동, 은, 플래티넘, 무지개)은 바탕 + 띠로 나타낸다.
 * 보라 = 파랑 + 빨강 띠, 동 = 빨강 + 노랑 띠, 은 = 검정, 금 = 노랑 + 검정 띠, 플래티넘 = 흰색 + 노랑 띠,
 * 무지개 = 검정 바탕에 글자마다 빨강·노랑·초록. 색 없는 패널은 늘 흰 바탕 + 검정 테두리.
 */
function ratingPlateStyle(tier: RatingTier, ink: Ink, border: number): Plate {
  const outline: Plate = { bg: ink.white, fg: ink.black, border };
  const c = ink.color;
  if (!c) return outline;
  const band = border + 1;
  switch (tier) {
    case 'white':
      return outline;
    case 'blue':
      return { bg: c.blue, fg: ink.white, border: 0 };
    case 'green':
      return { bg: c.green, fg: ink.white, border: 0 };
    case 'yellow':
      return { bg: c.yellow, fg: ink.black, border: 0 };
    case 'red':
      return { bg: c.red, fg: ink.white, border: 0 };
    case 'purple':
      return { bg: c.blue, fg: ink.white, border: 0, frame: { color: c.red, width: band } };
    case 'bronze':
      return { bg: c.red, fg: ink.white, border: 0, frame: { color: c.yellow, width: band } };
    case 'silver':
      return { bg: ink.black, fg: ink.white, border: 0 };
    case 'gold':
      return { bg: c.yellow, fg: ink.black, border: 0, frame: { color: ink.black, width: band } };
    case 'platinum':
      return { bg: ink.white, fg: ink.black, border: 1, frame: { color: c.yellow, width: band } };
    case 'rainbow':
      return { bg: ink.black, fg: ink.white, border: 0, cycle: [c.red, c.yellow, c.green] };
  }
}

function font(size: number, weight = 700): string {
  return `${weight} ${size}px ${fontFamily.sans}`;
}

/**
 * 작은 이름표(RATING, DAN, CLASS) 글꼴. 9~10px 굵은 글자는 한 색으로 찍으면 글자끼리 붙어서(TI, NG),
 * 한 단계 가늘게 하고 자간을 1px 벌린다. 다 쓰면 ctx.letterSpacing 을 0px 로 돌려놓는다.
 */
function setLabelFont(ctx: Ctx, size: number) {
  ctx.font = font(size, 600);
  ctx.letterSpacing = '1px';
}

/** 최대 너비에 들어가게 글자 크기를 줄이고, 최소 크기에서도 넘치면 뒤를 … 으로 자른다. */
function fitText(ctx: Ctx, text: string, maxWidth: number, size: number, minSize: number) {
  for (let s = size; s >= minSize; s--) {
    ctx.font = font(s);
    if (ctx.measureText(text).width <= maxWidth) return { text, size: s };
  }
  ctx.font = font(minSize);
  const chars = Array.from(text);
  while (chars.length > 1 && ctx.measureText(`${chars.join('')}…`).width > maxWidth) chars.pop();
  return { text: `${chars.join('')}…`, size: minSize };
}

function fillRect(ctx: Ctx, r: Rect, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

function strokeRect(ctx: Ctx, r: Rect, color: string, width = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(r.x, r.y, r.w, width);
  ctx.fillRect(r.x, r.y + r.h - width, r.w, width);
  ctx.fillRect(r.x, r.y, width, r.h);
  ctx.fillRect(r.x + r.w - width, r.y, width, r.h);
}

/** 칸을 칠하고 그 안에 쓸 글자색을 돌려준다. */
function box(ctx: Ctx, r: Rect, kind: Box, ink: Ink, border = 1): string {
  if (kind === 'solid') {
    fillRect(ctx, r, ink.black);
    return ink.white;
  }
  fillRect(ctx, r, ink.white);
  strokeRect(ctx, r, ink.black, border);
  return ink.black;
}

/**
 * 글자를 한 색으로 또렷하게 찍는다.
 * 캔버스 글자는 가장자리가 반투명(안티앨리어싱)이라 패널 색으로 줄일 때 번진다.
 * 따로 그린 뒤 절반 넘게 칠해진 픽셀만 그 색으로 옮긴다.
 */
function text(ctx: Ctx, value: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') {
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const m = ctx.measureText(value);
  const margin = 3;
  const left = Math.floor(x - m.actualBoundingBoxLeft) - margin;
  const top = Math.floor(y - m.actualBoundingBoxAscent) - margin;
  const width = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + margin * 2;
  const height = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + margin * 2;
  if (width <= 0 || height <= 0) return;

  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const lc = layer.getContext('2d', { willReadFrequently: true });
  if (!lc) return;
  lc.font = ctx.font;
  lc.letterSpacing = ctx.letterSpacing;
  lc.textAlign = align;
  lc.textBaseline = 'middle';
  lc.fillStyle = '#000';
  lc.fillText(value, x - left, y - top);

  const image = lc.getImageData(0, 0, width, height);
  const hex = Number.parseInt(color.slice(1), 16);
  const [r, g, b] = [hex >> 16, (hex >> 8) & 0xff, hex & 0xff];
  for (let i = 0; i < image.data.length; i += 4) {
    const on = image.data[i + 3] >= 128;
    image.data[i] = r;
    image.data[i + 1] = g;
    image.data[i + 2] = b;
    image.data[i + 3] = on ? 255 : 0;
  }
  lc.putImageData(image, 0, 0);
  ctx.drawImage(layer, left, top);
}

/** 게임 이름은 보통 전각(ＡＢＣ)이라 화면에서 너무 벌어져 보인다. 반각으로 바꿔 그린다. */
function displayText(value: string): string {
  return value.normalize('NFKC');
}

function imageSize(image: IconImage): { width: number; height: number } {
  return image instanceof HTMLImageElement
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : { width: image.width, height: image.height };
}

/**
 * 아이콘 다듬기 설정. 실제 아이콘(밝은 파스텔 그림)으로 몇 가지를 비교해서 골랐다.
 * 밝기 범위를 늘리고 중간 밝기를 조금 어둡게 하면, 분홍은 흰 바탕의 빨간 점으로, 윤곽은 검정으로 남는다.
 * 채도나 감마를 더 올리면 분홍이 새빨갛게 되고, 안 다듬으면 거의 흰색으로 날아간다.
 */
const ICON_ENHANCE = { gamma: 1.15, saturation: 1, clip: 0.01 };

/**
 * 아이콘 이미지를 칸 크기로 줄이고(가운데를 정사각형으로 잘라서) 다듬은 뒤 패널 색 전부로 디더링해 찍는다.
 * 화면에서 색이 들어가는 곳은 아이콘뿐이다.
 */
function ditheredIcon(ctx: Ctx, r: Rect, image: IconImage, ink: Ink) {
  const layer = document.createElement('canvas');
  layer.width = r.w;
  layer.height = r.h;
  const lc = layer.getContext('2d', { willReadFrequently: true });
  if (!lc) return;
  const { width, height } = imageSize(image);
  const side = Math.min(width, height);
  lc.fillStyle = '#fff';
  lc.fillRect(0, 0, r.w, r.h);
  lc.imageSmoothingEnabled = true;
  lc.imageSmoothingQuality = 'high';
  lc.drawImage(image, (width - side) / 2, (height - side) / 2, side, side, 0, 0, r.w, r.h);

  const pixels = lc.getImageData(0, 0, r.w, r.h);
  const indices = ditherToPalette(enhanceForPanel(pixels, ICON_ENHANCE), ink.palette);
  for (let i = 0; i < indices.length; i++) {
    const p = ink.palette[indices[i]];
    pixels.data[i * 4] = p.r;
    pixels.data[i * 4 + 1] = p.g;
    pixels.data[i * 4 + 2] = p.b;
    pixels.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(pixels, r.x, r.y);
}

/** 아이콘 칸. 이미지가 없으면 이름 첫 글자를 넣는다. */
function icon(ctx: Ctx, r: Rect, profile: PlayerProfile, image: IconImage | null, ink: Ink) {
  const border = Math.max(1, Math.round(r.w / 40));
  if (image) {
    ditheredIcon(ctx, r, image, ink);
    strokeRect(ctx, r, ink.black, border);
    return;
  }
  const fg = box(ctx, r, 'outline', ink, border);
  ctx.font = font(Math.round(r.h * 0.55));
  text(ctx, Array.from(displayText(profile.name))[0] ?? '?', r.x + r.w / 2, r.y + r.h / 2 + 1, fg, 'center');
}

function syncDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** 이름표 칸 (단위, 클래스). 왼쪽에 작은 이름, 오른쪽에 값. */
function chip(ctx: Ctx, r: Rect, label: string, value: string, kind: Box, size: number, ink: Ink) {
  const fg = box(ctx, r, kind, ink);
  setLabelFont(ctx, Math.max(9, Math.round(size * 0.6)));
  const labelWidth = ctx.measureText(label).width;
  text(ctx, label, r.x + 4, r.y + r.h / 2, fg);
  ctx.letterSpacing = '0px';
  const fit = fitText(ctx, value, r.w - 8 - labelWidth - 6, size, Math.round(size * 0.7));
  ctx.font = font(fit.size);
  text(ctx, fit.text, r.x + r.w - 4, r.y + r.h / 2 + 1, fg, 'right');
}

/** 칭호 판 */
function titlePlate(ctx: Ctx, r: Rect, value: string, size: number, minSize: number, ink: Ink) {
  const fg = box(ctx, r, 'outline', ink);
  const fit = fitText(ctx, displayText(value), r.w - 8, size, minSize);
  ctx.font = font(fit.size);
  text(ctx, fit.text, r.x + r.w / 2, r.y + r.h / 2 + 1, fg, 'center');
}

/** 글자마다 색을 바꿔 찍는다 (무지개 레이팅). */
function cycleText(ctx: Ctx, value: string, x: number, y: number, colors: string[], align: CanvasTextAlign) {
  ctx.textAlign = 'left';
  const total = ctx.measureText(value).width;
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  let i = 0;
  for (const ch of Array.from(value)) {
    if (ch.trim() !== '') text(ctx, ch, Math.round(cursor), y, colors[i++ % colors.length]);
    cursor += ctx.measureText(ch).width;
  }
}

/** 레이팅 판: 큰 숫자. 6색 패널이면 레이팅 구간 색을 넣는다. */
function ratingPlate(ctx: Ctx, r: Rect, rating: number, labelSize: number, size: number, border: number, ink: Ink) {
  const style = ratingPlateStyle(ratingTier(rating), ink, border);
  fillRect(ctx, r, style.bg);
  if (style.frame) strokeRect(ctx, r, style.frame.color, style.frame.width);
  if (style.border > 0) strokeRect(ctx, r, ink.black, style.border);
  const inset = Math.max(style.border, style.frame?.width ?? 0);

  setLabelFont(ctx, labelSize);
  text(ctx, 'RATING', r.x + inset + 4, r.y + inset + 4 + labelSize / 2, style.fg);
  ctx.letterSpacing = '0px';
  ctx.font = font(size);
  const x = r.x + r.w / 2;
  const y = r.y + r.h / 2 + labelSize / 2;
  if (style.cycle) cycleText(ctx, String(rating), x, y, style.cycle, 'center');
  else text(ctx, String(rating), x, y, style.fg, 'center');
}

export interface ProfileDrawOptions {
  /** 아이콘 이미지. 없으면 이름 첫 글자로 대신한다. */
  icon?: IconImage | null;
}

/** 2.13" 250×122 처럼 가로로 긴 화면. 위: 아이콘·이름·칭호, 아래: 레이팅·단위·클래스 */
function drawWide(ctx: Ctx, w: number, h: number, p: PlayerProfile, ink: Ink, image: IconImage | null) {
  const s = Math.min(w / 250, h / 122);
  const u = (n: number) => Math.round(n * s);
  const pad = u(4);

  const iconBox = { x: pad, y: pad, w: u(54), h: u(54) };
  icon(ctx, iconBox, p, image, ink);

  const colX = iconBox.x + iconBox.w + u(6);
  const colW = w - colX - pad;

  const name = fitText(ctx, displayText(p.name), colW, u(20), u(12));
  ctx.font = font(name.size);
  text(ctx, name.text, colX, pad + u(12), ink.black);

  titlePlate(ctx, { x: colX, y: pad + u(26), w: colW, h: u(17) }, p.title.text, u(11), u(9), ink);

  const lineY = pad + u(52);
  ctx.font = font(u(11));
  const play = p.playCount ? `  ▶ ${formatNumber(p.playCount.total)}` : '';
  text(ctx, `★ ${formatNumber(p.stars)}${play}`, colX, lineY, ink.black);
  ctx.font = font(u(10), 500);
  text(ctx, syncDate(p.syncedAt), w - pad, lineY, ink.black, 'right');

  const bottomY = iconBox.y + iconBox.h + u(4);
  const bottomH = h - pad - bottomY;
  const ratingBox = { x: pad, y: bottomY, w: u(140), h: bottomH };
  ratingPlate(ctx, ratingBox, p.rating, u(9), u(32), u(2), ink);

  const chipX = ratingBox.x + ratingBox.w + u(6);
  const chipW = w - pad - chipX;
  const chipH = Math.floor((bottomH - u(4)) / 2);
  chip(ctx, { x: chipX, y: bottomY, w: chipW, h: chipH }, 'DAN', courseRankLabel(p.courseRank) ?? '-', 'solid', u(15), ink);
  chip(ctx, { x: chipX, y: bottomY + bottomH - chipH, w: chipW, h: chipH }, 'CLASS', p.classRank, 'outline', u(15), ink);
}

/** 1.54" 240×240 처럼 정사각형에 가까운 화면 */
function drawSquare(ctx: Ctx, w: number, h: number, p: PlayerProfile, ink: Ink, image: IconImage | null) {
  const s = Math.min(w, h) / 240;
  const u = (n: number) => Math.round(n * s);
  const pad = u(8);

  const iconBox = { x: pad, y: pad, w: u(72), h: u(72) };
  icon(ctx, iconBox, p, image, ink);

  const colX = iconBox.x + iconBox.w + u(8);
  const colW = w - colX - pad;

  const name = fitText(ctx, displayText(p.name), colW, u(24), u(14));
  ctx.font = font(name.size);
  text(ctx, name.text, colX, pad + u(14), ink.black);

  titlePlate(ctx, { x: colX, y: pad + u(32), w: colW, h: u(20) }, p.title.text, u(13), u(10), ink);

  ctx.font = font(u(13));
  text(ctx, `★ ${formatNumber(p.stars)}`, colX, pad + u(64), ink.black);

  const ratingBox = { x: pad, y: iconBox.y + iconBox.h + u(8), w: w - pad * 2, h: u(76) };
  ratingPlate(ctx, ratingBox, p.rating, u(11), u(46), u(3), ink);

  const chipY = ratingBox.y + ratingBox.h + u(8);
  const chipW = Math.floor((w - pad * 2 - u(8)) / 2);
  const chipH = u(36);
  chip(ctx, { x: pad, y: chipY, w: chipW, h: chipH }, 'DAN', courseRankLabel(p.courseRank) ?? '-', 'solid', u(17), ink);
  chip(ctx, { x: w - pad - chipW, y: chipY, w: chipW, h: chipH }, 'CLASS', p.classRank, 'outline', u(17), ink);

  const footY = h - pad - u(8);
  ctx.font = font(u(12));
  const play = p.playCount
    ? `▶ ${formatNumber(p.playCount.total)} (이번 버전 ${formatNumber(p.playCount.current)})`
    : '';
  text(ctx, play, pad, footY, ink.black);
  ctx.font = font(u(11), 500);
  text(ctx, syncDate(p.syncedAt), w - pad, footY, ink.black, 'right');
}

export function drawProfile(
  ctx: Ctx,
  width: number,
  height: number,
  palette: PaletteColor[],
  profile: PlayerProfile,
  options: ProfileDrawOptions = {},
): void {
  const ink = inkOf(palette);
  ctx.fillStyle = ink.white;
  ctx.fillRect(0, 0, width, height);
  const image = options.icon ?? null;
  if (width / height >= 1.5) drawWide(ctx, width, height, profile, ink, image);
  else drawSquare(ctx, width, height, profile, ink, image);
}

/** 캔버스는 글꼴이 다 받아지기 전에 그리면 대체 글꼴로 그린다. 프로필 글자에 필요한 글꼴을 먼저 받는다. */
export async function loadProfileFonts(profile: PlayerProfile): Promise<void> {
  const sample = `${displayText(profile.name)}${displayText(profile.title.text)}${courseRankLabel(profile.courseRank) ?? ''}RATING CLASS DAN ★▶0123456789.,`;
  await Promise.all(
    [700, 500].flatMap((weight) =>
      ['Pretendard', 'Noto Sans JP'].map((family) =>
        document.fonts.load(`${weight} 16px "${family}"`, sample).catch(() => []),
      ),
    ),
  );
}
