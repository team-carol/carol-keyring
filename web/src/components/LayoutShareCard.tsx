import { Button, Card, CardBody, CardTitle, TextInput, buttonClassName } from '@team-carol/design-system/react';
import { useState } from 'react';
import type { ChangeEvent } from 'react';

import { DEFAULT_LAYOUT, SHARE_PARAM, encodeLayout, normalizeLayout } from '../layout.ts';
import type { Layout } from '../layout.ts';
import { Notice } from './Notice.tsx';

interface LayoutShareCardProps {
  layout: Layout;
  onChange: (layout: Layout) => void;
}

type Status = { tone: 'success' | 'danger' | 'warning'; message: string; undo?: Layout } | null;

const FILE_NAME = 'carol-keyring-layout.json';

/** 지금 주소에서 탭(#)과 다른 쿼리를 뺀, 레이아웃만 담은 공유 링크 */
function shareUrl(code: string): string {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set(SHARE_PARAM, code);
  return url.toString();
}

/**
 * 레이아웃 공유: 서버에 저장하지 않고 레이아웃 전체를 링크에 넣는다. 파일로 내보내고 불러올 수도 있다.
 */
export function LayoutShareCard({ layout, onChange }: LayoutShareCardProps) {
  const [link, setLink] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const canShare = typeof navigator.share === 'function';

  async function makeLink(): Promise<string> {
    const url = shareUrl(await encodeLayout(layout));
    setLink(url);
    return url;
  }

  async function copyLink() {
    try {
      const url = await makeLink();
      await navigator.clipboard.writeText(url);
      setStatus({ tone: 'success', message: '공유 링크를 복사했습니다. 이 링크를 연 사람에게 같은 레이아웃이 적용됩니다.' });
    } catch {
      setStatus({ tone: 'warning', message: '복사하지 못했습니다. 아래 링크를 직접 복사해 주세요.' });
    }
  }

  async function share() {
    try {
      const url = await makeLink();
      await navigator.share({ title: '캐롤 키링 레이아웃', url });
    } catch (error) {
      // 사용자가 공유 창을 닫은 경우는 오류로 보이지 않는다.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus({ tone: 'warning', message: '공유하지 못했습니다. 링크 복사를 써 주세요.' });
    }
  }

  function exportFile() {
    const blob = new Blob([`${JSON.stringify(layout, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = FILE_NAME;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus({ tone: 'success', message: `${FILE_NAME} 로 내보냈습니다.` });
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 64 * 1024) throw new Error('파일이 너무 큽니다.');
      const next = normalizeLayout(JSON.parse(await file.text()));
      onChange(next);
      setLink(null);
      setStatus({ tone: 'success', message: `${file.name} 레이아웃을 적용했습니다.`, undo: layout });
    } catch (error) {
      const message = error instanceof SyntaxError ? '레이아웃 파일(JSON)이 아닙니다.' : error instanceof Error ? error.message : String(error);
      setStatus({ tone: 'danger', message: `${file.name}: ${message}` });
    }
  }

  function reset() {
    onChange(DEFAULT_LAYOUT);
    setLink(null);
    setStatus({ tone: 'success', message: '기본 레이아웃으로 바꿨습니다.', undo: layout });
  }

  return (
    <Card as="section" className="kr-stack">
      <div>
        <CardTitle>공유</CardTitle>
        <CardBody>레이아웃은 서버에 저장되지 않고 링크 안에 그대로 들어갑니다. 링크를 연 사람에게 같은 레이아웃이 적용됩니다.</CardBody>
      </div>

      <div className="kr-actions">
        <Button onClick={copyLink}>링크 복사</Button>
        {canShare ? (
          <Button variant="secondary" onClick={share}>
            공유하기
          </Button>
        ) : null}
      </div>
      {link ? (
        <TextInput label="공유 링크" value={link} readOnly onFocus={(event) => event.currentTarget.select()} />
      ) : null}

      <div className="kr-actions">
        <Button variant="secondary" onClick={exportFile}>
          파일로 내보내기
        </Button>
        <label className={buttonClassName({ variant: 'secondary' }, 'kr-file__pick')}>
          파일 불러오기
          <input type="file" accept=".json,application/json" onChange={importFile} hidden />
        </label>
        <Button variant="secondary" onClick={reset}>
          기본 레이아웃으로
        </Button>
      </div>

      {status ? (
        <Notice tone={status.tone}>
          {status.message}{' '}
          {status.undo ? (
            <button
              type="button"
              className="kr-link-btn"
              onClick={() => {
                if (status.undo) onChange(status.undo);
                setStatus(null);
              }}
            >
              되돌리기
            </button>
          ) : null}
        </Notice>
      ) : null}
    </Card>
  );
}
