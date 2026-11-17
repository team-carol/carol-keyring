import { Button, Card, CardBody, CardTitle, Select, TextInput, cx } from '@team-carol/design-system/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

import { DEFAULT_DEMO, DEMO_INFO } from '../demo.ts';
import { ELEMENT_INFO, ELEMENT_KINDS, MAX_ELEMENTS, newElementId } from '../layout.ts';
import type { ElementKind, Layout, LayoutElement } from '../layout.ts';
import type { PlayerProfile } from '../maishift.ts';
import { drawProfile, layoutTransform, loadProfileFonts } from '../profileLayout.ts';
import { canvasSize, parsePalette } from '../protocol.ts';
import type { DeviceInfo } from '../protocol.ts';
import { renderFrame } from '../render.ts';
import type { LoadedProfile } from '../useProfile.ts';
import { Notice } from './Notice.tsx';
import { PixelScreen } from './PanelPreview.tsx';
import { Switch } from './Switch.tsx';

/** 프로필을 아직 안 불러왔을 때 편집 화면에 채워 넣는 예시 값 (실존 플레이어 아님) */
const EXAMPLE_PROFILE: PlayerProfile = {
  name: 'ＣＡＲＯＬ',
  rating: 15234,
  iconUrl: '',
  title: { text: 'でらっくす譜面マスター', tier: 'RAINBOW' },
  classRank: 'LEGEND',
  courseRank: 'SHIN_KAIDEN',
  stars: 1873,
  playCount: { total: 4321, current: 720 },
  friendCode: null,
  syncedAt: '2026-11-16T09:30:00Z',
};

interface LayoutEditorProps {
  /** 연결된 기기 (없으면 2.13" 기준으로 보여 준다) */
  info: DeviceInfo | null;
  profile: LoadedProfile | null;
  layout: Layout;
  onChange: (layout: Layout) => void;
}

type Drag = { id: string; mode: 'move' | 'resize'; startX: number; startY: number; origin: LayoutElement; pxPerUnit: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 요소 하나를 바꾸고 화면 밖으로 나가지 않게 맞춘다. */
function updateElement(layout: Layout, id: string, patch: Partial<LayoutElement>): Layout {
  return {
    ...layout,
    elements: layout.elements.map((el) => {
      if (el.id !== id) return el;
      const next = { ...el, ...patch };
      next.w = clamp(Math.round(next.w), 4, layout.w);
      next.h = clamp(Math.round(next.h), 4, layout.h);
      next.x = clamp(Math.round(next.x), 0, layout.w - next.w);
      next.y = clamp(Math.round(next.y), 0, layout.h - next.h);
      return next;
    }),
  };
}

const BOX_OPTIONS = [
  { value: 'none', label: '칸 없음' },
  { value: 'outline', label: '흰 바탕 + 테두리' },
  { value: 'solid', label: '검정 바탕' },
] as const;

const ALIGN_OPTIONS = [
  { value: 'left', label: '왼쪽' },
  { value: 'center', label: '가운데' },
  { value: 'right', label: '오른쪽' },
] as const;

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <TextInput
      label={label}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={String(value)}
      onChange={(event) => {
        const next = Number(event.target.value);
        if (event.target.value !== '' && Number.isFinite(next)) onChange(next);
      }}
    />
  );
}

/** 레이아웃 탭: 프로필 항목을 끌어서 옮기고 크기를 바꾼다. 아래 칸에서 숫자로도 바꿀 수 있다. */
export function LayoutEditor({ info, profile, layout, onChange }: LayoutEditorProps) {
  const panel = info ?? DEMO_INFO[DEFAULT_DEMO];
  const palette = useMemo(() => parsePalette(panel), [panel]);
  const size = canvasSize(panel);
  const previewProfile = profile?.data.profile ?? EXAMPLE_PROFILE;
  const [selectedId, setSelectedId] = useState<string | null>(layout.elements[0]?.id ?? null);
  const selected = layout.elements.find((el) => el.id === selectedId) ?? null;
  const [addKind, setAddKind] = useState<ElementKind>('text');

  // 글꼴(이름, 칭호, 직접 쓴 글)을 받은 뒤 다시 그린다.
  const texts = layout.elements.map((el) => el.text ?? '').join('');
  const [fontEpoch, setFontEpoch] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void loadProfileFonts(previewProfile, texts).then(() => {
      if (!cancelled) setFontEpoch((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [previewProfile, texts]);

  const rendered = useMemo(
    () =>
      renderFrame(panel, (ctx, width, height) =>
        drawProfile(ctx, width, height, palette, previewProfile, { icon: profile?.icon ?? null, layout }),
      ),
    // fontEpoch: 글꼴을 받은 뒤 다시 그린다.
    [panel, palette, previewProfile, profile, layout, fontEpoch],
  );
  const encoded = rendered instanceof Error ? null : rendered;
  const transform = layoutTransform(layout, size.width, size.height);

  // ---- 끌기 ----
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  function startDrag(event: PointerEvent<HTMLElement>, el: LayoutElement, mode: Drag['mode']) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(el.id);
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) return;
    drag.current = {
      id: el.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: el,
      pxPerUnit: (stage.width / size.width) * transform.s,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = Math.round((event.clientX - d.startX) / d.pxPerUnit);
    const dy = Math.round((event.clientY - d.startY) / d.pxPerUnit);
    const patch =
      d.mode === 'move'
        ? { x: d.origin.x + dx, y: d.origin.y + dy }
        : {
            w: clamp(d.origin.w + dx, 4, layout.w - d.origin.x),
            h: clamp(d.origin.h + dy, 4, layout.h - d.origin.y),
          };
    onChange(updateElement(layout, d.id, patch));
  }

  function endDrag() {
    drag.current = null;
  }

  /** 화살표로 1칸, Shift 와 함께 5칸 옮긴다. Alt 와 함께면 크기를 바꾼다. */
  function onItemKey(event: KeyboardEvent<HTMLElement>, el: LayoutElement) {
    const step = event.shiftKey ? 5 : 1;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[
      event.key
    ] as [number, number] | undefined;
    if (!delta) return;
    event.preventDefault();
    const patch = event.altKey ? { w: el.w + delta[0], h: el.h + delta[1] } : { x: el.x + delta[0], y: el.y + delta[1] };
    onChange(updateElement(layout, el.id, patch));
  }

  // ---- 추가, 삭제, 순서 ----
  function addElement() {
    if (layout.elements.length >= MAX_ELEMENTS) return;
    const defaults = ELEMENT_INFO[addKind].defaults;
    const el: LayoutElement = { id: newElementId(layout, addKind), kind: addKind, x: 4, y: 4, ...defaults };
    el.w = Math.min(el.w, layout.w - 4);
    el.h = Math.min(el.h, layout.h - 4);
    onChange({ ...layout, elements: [...layout.elements, el] });
    setSelectedId(el.id);
  }

  function removeSelected() {
    if (!selected) return;
    const index = layout.elements.indexOf(selected);
    const elements = layout.elements.filter((el) => el.id !== selected.id);
    onChange({ ...layout, elements });
    setSelectedId(elements[Math.min(index, elements.length - 1)]?.id ?? null);
  }

  function bringToFront() {
    if (!selected) return;
    onChange({ ...layout, elements: [...layout.elements.filter((el) => el.id !== selected.id), selected] });
  }

  const patchSelected = (patch: Partial<LayoutElement>) => selected && onChange(updateElement(layout, selected.id, patch));
  const info2 = selected ? ELEMENT_INFO[selected.kind] : null;

  return (
    <Card as="section" className="kr-stack">
      <div>
        <CardTitle>레이아웃 편집</CardTitle>
        <CardBody>
          항목을 끌어서 옮기고, 오른쪽 아래 모서리를 끌어서 크기를 바꿉니다. 아래에서 숫자로 정확히 맞출 수도 있습니다.
          {profile ? '' : ' 프로필을 불러오기 전이라 예시 값으로 보여 줍니다.'}
        </CardBody>
      </div>

      <div className="kr-panel">
        <div className="kr-panel__frame" style={{ maxWidth: size.width * 2 }}>
          <div className="kr-editor__stage" ref={stageRef}>
            {encoded ? (
              <PixelScreen
                className="kr-panel__screen"
                width={size.width}
                height={size.height}
                indices={encoded.indices}
                palette={palette}
                label="편집 중인 키링 화면"
              />
            ) : null}
            <div className="kr-editor__overlay">
              {layout.elements.map((el) => {
                const r = transform.rect(el);
                const active = el.id === selectedId;
                return (
                  <button
                    key={el.id}
                    type="button"
                    className={cx('kr-editor__item', active && 'is-active')}
                    style={{
                      left: `${(r.x / size.width) * 100}%`,
                      top: `${(r.y / size.height) * 100}%`,
                      width: `${(r.w / size.width) * 100}%`,
                      height: `${(r.h / size.height) * 100}%`,
                    }}
                    aria-label={`${ELEMENT_INFO[el.kind].label} (가로 ${el.x}, 세로 ${el.y}, 크기 ${el.w}×${el.h})`}
                    aria-pressed={active}
                    onPointerDown={(event) => startDrag(event, el, 'move')}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onFocus={() => setSelectedId(el.id)}
                    onKeyDown={(event) => onItemKey(event, el)}
                  >
                    {active ? (
                      <span
                        className="kr-editor__handle"
                        aria-hidden
                        onPointerDown={(event) => startDrag(event, el, 'resize')}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {rendered instanceof Error ? <Notice tone="danger">{rendered.message}</Notice> : null}
      <p className="crl-caption">키보드: 항목에서 화살표로 1칸, Shift 와 함께 5칸 옮깁니다. Alt 와 함께 누르면 크기를 바꿉니다.</p>

      <ul className="kr-chips" aria-label="항목">
        {layout.elements.map((el) => (
          <li key={el.id}>
            <button
              type="button"
              className={cx('crl-chip', 'kr-chip-btn', el.id === selectedId && 'is-active')}
              aria-pressed={el.id === selectedId}
              onClick={() => setSelectedId(el.id)}
            >
              {el.kind === 'text' ? `글자 · ${el.text || '(비어 있음)'}` : ELEMENT_INFO[el.kind].label}
            </button>
          </li>
        ))}
      </ul>

      {selected && info2 ? (
        <div className="kr-stack kr-dev-section">
          <h4 className="kr-section-title">{info2.label}</h4>
          {selected.kind === 'text' ? (
            <TextInput
              label="글"
              value={selected.text ?? ''}
              maxLength={40}
              onChange={(event) => patchSelected({ text: event.target.value })}
            />
          ) : null}
          <div className="kr-field-grid">
            <NumberField label="가로 위치" value={selected.x} min={0} max={layout.w} onChange={(x) => patchSelected({ x })} />
            <NumberField label="세로 위치" value={selected.y} min={0} max={layout.h} onChange={(y) => patchSelected({ y })} />
            <NumberField label="너비" value={selected.w} min={4} max={layout.w} onChange={(w) => patchSelected({ w })} />
            <NumberField label="높이" value={selected.h} min={4} max={layout.h} onChange={(h) => patchSelected({ h })} />
            {info2.hasText ? (
              <NumberField label="글자 크기" value={selected.size} min={6} max={80} onChange={(size) => patchSelected({ size })} />
            ) : null}
            {selected.box === 'outline' ? (
              <NumberField
                label="테두리 두께"
                value={selected.border}
                min={1}
                max={6}
                onChange={(border) => patchSelected({ border })}
              />
            ) : null}
          </div>
          <div className="kr-field-grid">
            <Select
              label="칸 모양"
              value={selected.box}
              onChange={(event) => patchSelected({ box: event.target.value as LayoutElement['box'] })}
            >
              {BOX_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            {selected.kind !== 'icon' ? (
              <Select
                label="정렬"
                value={selected.align}
                onChange={(event) => patchSelected({ align: event.target.value as LayoutElement['align'] })}
              >
                {ALIGN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
          {info2.hasLabel ? (
            <div className="kr-setting">
              <span className="kr-setting__label" id={`label-${selected.id}`}>
                이름표 ({selected.kind === 'rating' ? 'RATING' : selected.kind === 'dan' ? 'DAN' : 'CLASS'})
              </span>
              <Switch checked={selected.label} onChange={(label) => patchSelected({ label })} describedBy={`label-${selected.id}`} />
            </div>
          ) : null}
          <div className="kr-actions">
            <Button variant="secondary" onClick={bringToFront}>
              맨 위로
            </Button>
            <Button variant="secondary" onClick={removeSelected}>
              항목 빼기
            </Button>
          </div>
        </div>
      ) : null}

      <div className="kr-handle">
        <Select label="항목 추가" value={addKind} onChange={(event) => setAddKind(event.target.value as ElementKind)}>
          {ELEMENT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {ELEMENT_INFO[kind].label}
            </option>
          ))}
        </Select>
        <Button variant="secondary" onClick={addElement} disabled={layout.elements.length >= MAX_ELEMENTS}>
          추가
        </Button>
      </div>
    </Card>
  );
}
