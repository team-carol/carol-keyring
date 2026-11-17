// 프로필 화면 레이아웃: 어떤 항목을 어디에 어떤 모양으로 그릴지. 사용자가 편집하고 링크로 공유한다.
// 저장소 없이 레이아웃 전체를 압축해서 공유 링크(?layout=...)에 넣는다.
// DOM 없이 Node 테스트에서도 쓴다.

export type ElementKind = 'icon' | 'name' | 'title' | 'rating' | 'dan' | 'class' | 'stars' | 'plays' | 'synced' | 'text';
export type BoxStyle = 'none' | 'outline' | 'solid';
export type Align = 'left' | 'center' | 'right';

export interface LayoutElement {
  /** 편집기에서 항목을 구분하는 짧은 id */
  id: string;
  kind: ElementKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 칸 모양: 없음 / 흰 바탕 + 검정 테두리 / 검정 바탕 + 흰 글자 */
  box: BoxStyle;
  /** 테두리 두께 (outline 일 때) */
  border: number;
  /** 글자 크기 (최대). 칸에 안 들어가면 줄인다. */
  size: number;
  align: Align;
  /** RATING, DAN, CLASS 같은 작은 이름표를 붙일지 */
  label: boolean;
  /** kind 가 text 일 때 쓸 글 */
  text?: string;
}

export interface Layout {
  v: 1;
  /** 이 레이아웃을 만든 화면 크기. 다른 크기의 패널에서는 비율을 맞춰 줄이거나 키운다. */
  w: number;
  h: number;
  elements: LayoutElement[];
}

export interface ElementInfo {
  label: string;
  /** 새로 추가할 때의 기본값 (위치 제외) */
  defaults: Omit<LayoutElement, 'id' | 'kind' | 'x' | 'y'>;
  /** 이름표(label) 설정이 의미 있는 항목 */
  hasLabel: boolean;
  /** 글자 크기 설정이 의미 있는 항목 */
  hasText: boolean;
}

export const ELEMENT_INFO: Record<ElementKind, ElementInfo> = {
  icon: { label: '아이콘', hasLabel: false, hasText: false, defaults: { w: 54, h: 54, box: 'outline', border: 1, size: 0, align: 'center', label: false } },
  name: { label: '이름', hasLabel: false, hasText: true, defaults: { w: 120, h: 24, box: 'none', border: 1, size: 20, align: 'left', label: false } },
  title: { label: '칭호', hasLabel: false, hasText: true, defaults: { w: 140, h: 17, box: 'outline', border: 1, size: 11, align: 'center', label: false } },
  rating: { label: '레이팅', hasLabel: true, hasText: true, defaults: { w: 140, h: 56, box: 'outline', border: 2, size: 32, align: 'center', label: true } },
  dan: { label: '단위', hasLabel: true, hasText: true, defaults: { w: 96, h: 26, box: 'solid', border: 1, size: 15, align: 'right', label: true } },
  class: { label: '클래스', hasLabel: true, hasText: true, defaults: { w: 96, h: 26, box: 'outline', border: 1, size: 15, align: 'right', label: true } },
  stars: { label: '별', hasLabel: false, hasText: true, defaults: { w: 60, h: 14, box: 'none', border: 1, size: 11, align: 'left', label: false } },
  plays: { label: '플레이 수', hasLabel: false, hasText: true, defaults: { w: 70, h: 14, box: 'none', border: 1, size: 11, align: 'left', label: false } },
  synced: { label: '갱신 날짜', hasLabel: false, hasText: true, defaults: { w: 50, h: 14, box: 'none', border: 1, size: 10, align: 'right', label: false } },
  text: { label: '글자', hasLabel: false, hasText: true, defaults: { w: 80, h: 16, box: 'none', border: 1, size: 12, align: 'left', label: false, text: '글자' } },
};

export const ELEMENT_KINDS = Object.keys(ELEMENT_INFO) as ElementKind[];

/** 2.13" (250×122) 기본 레이아웃. 위: 아이콘·이름·칭호·별/플레이 수/날짜, 아래: 레이팅·단위·클래스 */
export const DEFAULT_LAYOUT: Layout = {
  v: 1,
  w: 250,
  h: 122,
  elements: [
    { id: 'icon', kind: 'icon', x: 4, y: 4, w: 54, h: 54, box: 'outline', border: 1, size: 0, align: 'center', label: false },
    { id: 'name', kind: 'name', x: 64, y: 4, w: 182, h: 24, box: 'none', border: 1, size: 20, align: 'left', label: false },
    { id: 'title', kind: 'title', x: 64, y: 30, w: 182, h: 17, box: 'outline', border: 1, size: 11, align: 'center', label: false },
    { id: 'stars', kind: 'stars', x: 64, y: 48, w: 58, h: 14, box: 'none', border: 1, size: 11, align: 'left', label: false },
    { id: 'plays', kind: 'plays', x: 122, y: 48, w: 70, h: 14, box: 'none', border: 1, size: 11, align: 'left', label: false },
    { id: 'synced', kind: 'synced', x: 196, y: 48, w: 50, h: 14, box: 'none', border: 1, size: 10, align: 'right', label: false },
    { id: 'rating', kind: 'rating', x: 4, y: 62, w: 140, h: 56, box: 'outline', border: 2, size: 32, align: 'center', label: true },
    { id: 'dan', kind: 'dan', x: 150, y: 62, w: 96, h: 26, box: 'solid', border: 1, size: 15, align: 'right', label: true },
    { id: 'class', kind: 'class', x: 150, y: 92, w: 96, h: 26, box: 'outline', border: 1, size: 15, align: 'right', label: true },
  ],
};

export const MAX_ELEMENTS = 30;
const MAX_TEXT = 40;

function int(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** 새 항목 id. 이미 있는 id 와 겹치지 않게 한다. */
export function newElementId(layout: Layout, kind: ElementKind): string {
  const used = new Set(layout.elements.map((e) => e.id));
  if (!used.has(kind)) return kind;
  for (let i = 2; ; i++) if (!used.has(`${kind}${i}`)) return `${kind}${i}`;
}

/**
 * 밖에서 들어온 레이아웃(공유 링크, 저장된 값)을 검사하고 값을 범위 안으로 맞춘다.
 * 모양이 아예 다르면 Error 를 던진다.
 */
export function normalizeLayout(raw: unknown): Layout {
  if (typeof raw !== 'object' || raw === null) throw new Error('레이아웃 형식이 아닙니다.');
  const r = raw as Partial<Layout>;
  if (r.v !== 1) throw new Error('지원하지 않는 레이아웃 버전입니다.');
  if (!Array.isArray(r.elements)) throw new Error('레이아웃 항목이 없습니다.');
  const w = int(r.w, 50, 800, DEFAULT_LAYOUT.w);
  const h = int(r.h, 50, 800, DEFAULT_LAYOUT.h);
  const layout: Layout = { v: 1, w, h, elements: [] };
  for (const item of r.elements.slice(0, MAX_ELEMENTS)) {
    if (typeof item !== 'object' || item === null) continue;
    const e = item as Partial<LayoutElement>;
    if (!ELEMENT_KINDS.includes(e.kind as ElementKind)) continue;
    const kind = e.kind as ElementKind;
    const d = ELEMENT_INFO[kind].defaults;
    const ew = int(e.w, 4, w, d.w);
    const eh = int(e.h, 4, h, d.h);
    const id = typeof e.id === 'string' && /^[a-z0-9]{1,16}$/.test(e.id) && !layout.elements.some((x) => x.id === e.id)
      ? e.id
      : newElementId(layout, kind);
    const element: LayoutElement = {
      id,
      kind,
      x: int(e.x, 0, w - ew, 0),
      y: int(e.y, 0, h - eh, 0),
      w: ew,
      h: eh,
      box: oneOf(e.box, ['none', 'outline', 'solid'] as const, d.box),
      border: int(e.border, 1, 6, d.border),
      size: int(e.size, 0, 80, d.size),
      align: oneOf(e.align, ['left', 'center', 'right'] as const, d.align),
      label: typeof e.label === 'boolean' ? e.label : d.label,
    };
    if (kind === 'text') element.text = typeof e.text === 'string' ? Array.from(e.text).slice(0, MAX_TEXT).join('') : '';
    layout.elements.push(element);
  }
  return layout;
}

// ---- 공유 링크 ----

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** 레이아웃을 링크에 넣을 짧은 문자열로 (JSON → deflate → base64url). */
export async function encodeLayout(layout: Layout): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(layout));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

/** 링크의 문자열을 레이아웃으로. 잘못된 값이면 Error. */
export async function decodeLayout(code: string): Promise<Layout> {
  if (code.length > 8000) throw new Error('공유 레이아웃이 너무 깁니다.');
  let json: string;
  try {
    const bytes = await pipe(fromBase64Url(code), new DecompressionStream('deflate-raw'));
    if (bytes.length > 64 * 1024) throw new Error('too large');
    json = new TextDecoder().decode(bytes);
  } catch {
    throw new Error('공유 링크가 손상됐습니다.');
  }
  return normalizeLayout(JSON.parse(json));
}

/** 공유 링크의 쿼리 이름 */
export const SHARE_PARAM = 'layout';
