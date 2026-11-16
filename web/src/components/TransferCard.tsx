import { Card, CardTitle, TextInput } from '@team-carol/design-system/react';
import { useState } from 'react';

export const MIN_CHUNK = 16;
export const MAX_CHUNK = 508;

interface TransferCardProps {
  chunkSize: number;
  onChunkSizeChange: (size: number) => void;
}

/** 블루투스 전송 설정 (개발자 모드). 화면과 펌웨어 전송에 같이 쓴다. */
export function TransferCard({ chunkSize, onChunkSizeChange }: TransferCardProps) {
  const [text, setText] = useState(String(chunkSize));
  const parsed = Number(text);
  const valid = Number.isInteger(parsed) && parsed >= MIN_CHUNK && parsed <= MAX_CHUNK;

  return (
    <Card as="section" className="kr-stack">
      <CardTitle>전송</CardTitle>
      <TextInput
        label="조각 크기 (바이트)"
        type="number"
        inputMode="numeric"
        min={MIN_CHUNK}
        max={MAX_CHUNK}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          const next = Number(event.target.value);
          if (Number.isInteger(next) && next >= MIN_CHUNK && next <= MAX_CHUNK) onChunkSizeChange(next);
        }}
        error={valid ? undefined : `${MIN_CHUNK} ~ ${MAX_CHUNK} 사이 정수를 넣어 주세요. 지금은 ${chunkSize} 으로 보냅니다.`}
        helperText="블루투스로 한 번에 보내는 크기입니다. 화면과 펌웨어 전송에 같이 씁니다. 전송이 실패하면 줄여 보세요. 보내는 중에 바꾸면 다음 전송부터 적용됩니다."
      />
    </Card>
  );
}
