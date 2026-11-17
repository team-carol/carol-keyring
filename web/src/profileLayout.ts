// 프로필 화면 그리기. 레이아웃(layout.ts)에 적힌 항목을 차례로 그린다. 캔버스에 그린 뒤 encodeFrame 이 패널 팔레트로 줄인다.
// 기본은 흑백이고 색은 아이콘(디더링)에만 쓴다. 빨강·노랑·초록·파랑이 다 있는 패널(6색)에서만 레이팅 판에 게임 색을 넣는다.
// 글자는 굵게 그리고 한 색으로 찍어서 또렷하게 한다.
// 레이아웃 크기와 패널 크기가 다르면 비율을 지켜 줄이거나 키우고 가운데에 놓는다.

import { fontFamily } from '@team-carol/design-system';

import { ditherToPalette, enhanceForPanel } from './dither.ts';
import { DEFAULT_LAYOUT } from './layout.ts';
import type { Layout, LayoutElement } from './layout.ts';
import { courseRankLabel, ratingTier } from './maishift.ts';
import type { PlayerProfile, RatingTier } from './maishift.ts';
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

/** 칸 모양. none: 칸 없음, outline: 흰 바탕 + 검정 테두리, solid: 검정 바탕 + 흰 글자 */
type Box = LayoutElement['box'];

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
  if (kind === 'none') return ink.black;
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

/** 아이콘 칸. 이미지가 없으면 이름 첫 글자를 넣는다. 칸 모양이 none 이어도 테두리는 그리지 않을 뿐 그림은 그린다. */
function icon(ctx: Ctx, r: Rect, el: LayoutElement, profile: PlayerProfile, image: IconImage | null, ink: Ink, s: number) {
  const border = Math.max(1, Math.round(el.border * s));
  if (image) {
    ditheredIcon(ctx, r, image, ink);
    if (el.box !== 'none') strokeRect(ctx, r, ink.black, border);
    return;
  }
  const fg = box(ctx, r, el.box, ink, border);
  ctx.font = font(Math.round(Math.min(r.w, r.h) * 0.55));
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

/** 글자 한 줄 항목 (이름, 칭호, 별, 플레이 수, 날짜, 직접 쓴 글) 이 그릴 글 */
function lineText(el: LayoutElement, p: PlayerProfile): string {
  switch (el.kind) {
    case 'name':
      return displayText(p.name);
    case 'title':
      return displayText(p.title.text);
    case 'stars':
      return `★ ${formatNumber(p.stars)}`;
    case 'plays':
      return p.playCount ? `▶ ${formatNumber(p.playCount.total)}` : '';
    case 'synced':
      return syncDate(p.syncedAt);
    case 'text':
      return el.text ?? '';
    default:
      return '';
  }
}

function textX(r: Rect, align: LayoutElement['align'], inset: number): number {
  return align === 'left' ? r.x + inset : align === 'right' ? r.x + r.w - inset : r.x + r.w / 2;
}

/** 글자 한 줄. 칸에 안 들어가면 글자를 줄이고, 그래도 넘치면 뒤를 … 으로 자른다. */
function line(ctx: Ctx, r: Rect, el: LayoutElement, value: string, ink: Ink, s: number) {
  const fg = box(ctx, r, el.box, ink, Math.max(1, Math.round(el.border * s)));
  if (!value) return;
  const inset = el.box === 'none' ? 0 : Math.round(4 * s);
  const size = Math.max(6, Math.round(el.size * s));
  const fit = fitText(ctx, value, r.w - inset * 2, size, Math.max(6, Math.round(size * 0.6)));
  ctx.font = font(fit.size, el.kind === 'synced' ? 500 : 700);
  text(ctx, fit.text, textX(r, el.align, inset), r.y + r.h / 2 + 1, fg, el.align);
}

/** 이름표 칸 (단위, 클래스). 이름표를 켜면 왼쪽에 작은 이름, 값은 정렬대로. */
function chip(ctx: Ctx, r: Rect, el: LayoutElement, label: string, value: string, ink: Ink, s: number) {
  const fg = box(ctx, r, el.box, ink, Math.max(1, Math.round(el.border * s)));
  const inset = Math.round(4 * s);
  const size = Math.max(6, Math.round(el.size * s));
  let labelWidth = 0;
  if (el.label) {
    setLabelFont(ctx, Math.max(9, Math.round(size * 0.6)));
    labelWidth = ctx.measureText(label).width + inset;
    text(ctx, label, r.x + inset, r.y + r.h / 2, fg);
    ctx.letterSpacing = '0px';
  }
  const fit = fitText(ctx, value, r.w - inset * 2 - labelWidth, size, Math.round(size * 0.7));
  ctx.font = font(fit.size);
  const valueRect = { ...r, x: r.x + labelWidth, w: r.w - labelWidth };
  text(ctx, fit.text, textX(valueRect, el.align, inset), r.y + r.h / 2 + 1, fg, el.align);
}

/** 글자마다 색을 바꿔 찍는다 (6색 패널의 무지개 레이팅). */
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

/** 레이팅 판: 이름표(RATING)를 위에, 큰 숫자를 아래에. 6색 패널이고 칸이 outline 이면 레이팅 구간 색을 넣는다. */
function rating(ctx: Ctx, r: Rect, el: LayoutElement, value: number, ink: Ink, s: number) {
  const border = Math.max(1, Math.round(el.border * s));
  const style: Plate =
    el.box === 'outline'
      ? ratingPlateStyle(ratingTier(value), ink, border)
      : el.box === 'solid'
        ? { bg: ink.black, fg: ink.white, border: 0 }
        : { bg: '', fg: ink.black, border: 0 };
  if (style.bg) fillRect(ctx, r, style.bg);
  if (style.frame) strokeRect(ctx, r, style.frame.color, style.frame.width);
  if (style.border > 0) strokeRect(ctx, r, ink.black, style.border);
  const inset = Math.max(style.border, style.frame?.width ?? 0) + Math.round(4 * s);

  const size = Math.max(6, Math.round(el.size * s));
  const labelSize = Math.max(9, Math.round(size * 0.28));
  const labelH = el.label ? labelSize : 0;
  if (el.label) {
    setLabelFont(ctx, labelSize);
    text(ctx, 'RATING', r.x + inset, r.y + inset + labelSize / 2, style.fg);
    ctx.letterSpacing = '0px';
  }
  const fit = fitText(ctx, String(value), r.w - inset * 2, size, Math.round(size * 0.6));
  ctx.font = font(fit.size);
  const x = textX(r, el.align, inset);
  const y = r.y + r.h / 2 + labelH / 2;
  if (style.cycle) cycleText(ctx, fit.text, x, y, style.cycle, el.align);
  else text(ctx, fit.text, x, y, style.fg, el.align);
}

export interface ProfileDrawOptions {
  /** 아이콘 이미지. 없으면 이름 첫 글자로 대신한다. */
  icon?: IconImage | null;
  /** 그릴 레이아웃. 없으면 기본 레이아웃. */
  layout?: Layout;
}

/** 레이아웃 좌표 → 캔버스 좌표. 비율을 지켜 맞추고 가운데에 놓는다. */
export function layoutTransform(layout: Layout, width: number, height: number) {
  const s = Math.min(width / layout.w, height / layout.h);
  const offsetX = Math.round((width - layout.w * s) / 2);
  const offsetY = Math.round((height - layout.h * s) / 2);
  return {
    s,
    rect: (el: Pick<LayoutElement, 'x' | 'y' | 'w' | 'h'>): Rect => ({
      x: offsetX + Math.round(el.x * s),
      y: offsetY + Math.round(el.y * s),
      w: Math.max(1, Math.round(el.w * s)),
      h: Math.max(1, Math.round(el.h * s)),
    }),
  };
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
  const layout = options.layout ?? DEFAULT_LAYOUT;
  const { s, rect } = layoutTransform(layout, width, height);

  // 목록 순서대로 그린다 (뒤에 있는 항목이 위에 그려진다).
  for (const el of layout.elements) {
    const r = rect(el);
    switch (el.kind) {
      case 'icon':
        icon(ctx, r, el, profile, image, ink, s);
        break;
      case 'rating':
        rating(ctx, r, el, profile.rating, ink, s);
        break;
      case 'dan':
        chip(ctx, r, el, 'DAN', courseRankLabel(profile.courseRank) ?? '-', ink, s);
        break;
      case 'class':
        chip(ctx, r, el, 'CLASS', profile.classRank, ink, s);
        break;
      default:
        line(ctx, r, el, lineText(el, profile), ink, s);
    }
  }
}


/** 캔버스는 글꼴이 다 받아지기 전에 그리면 대체 글꼴로 그린다. 프로필 글자에 필요한 글꼴을 먼저 받는다. */
export async function loadProfileFonts(profile: PlayerProfile, extraText = ''): Promise<void> {
  const sample = `${displayText(profile.name)}${displayText(profile.title.text)}${courseRankLabel(profile.courseRank) ?? ''}RATING CLASS DAN ★▶0123456789.,${extraText}`;
  await Promise.all(
    [700, 500].flatMap((weight) =>
      ['Pretendard', 'Noto Sans JP'].map((family) =>
        document.fonts.load(`${weight} 16px "${family}"`, sample).catch(() => []),
      ),
    ),
  );
}
