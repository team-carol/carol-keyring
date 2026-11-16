interface SwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** 설명 문단의 id. 화면 읽기 프로그램이 이름 다음에 읽어 준다. */
  describedBy?: string;
}

/** 켜고 끄는 스위치. 디자인 시스템에 아직 없어서 이 프로젝트에 둔다. */
export function Switch({ id, checked, onChange, disabled, describedBy }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={describedBy}
      className="kr-switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="kr-switch__thumb" aria-hidden />
    </button>
  );
}
