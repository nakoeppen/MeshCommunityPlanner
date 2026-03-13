/**
 * NumberInput — controlled number input that only commits on Enter or blur.
 * Allows free typing; clamps to [min, max] on commit.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  className?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  title?: string;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
  style?: React.CSSProperties;
}

export function NumberInput({
  value, onChange, min, max, step, id, className,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  title, disabled, placeholder, required, style,
}: NumberInputProps) {
  const [draft, setDraft] = useState(String(value));
  const isFocused = useRef(false);

  // Sync from parent only when not being edited
  useEffect(() => {
    if (!isFocused.current) {
      setDraft(String(value));
    }
  }, [value]);

  const commit = useCallback((raw: string) => {
    const parsed = parseFloat(raw);
    if (isNaN(parsed)) {
      // Revert to last known good value
      setDraft(String(value));
      return;
    }
    let clamped = parsed;
    if (min !== undefined) clamped = Math.max(min, clamped);
    if (max !== undefined) clamped = Math.min(max, clamped);
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  }, [value, min, max, onChange]);

  return (
    <input
      type="number"
      id={id}
      className={className}
      value={draft}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      placeholder={placeholder}
      required={required}
      aria-label={ariaLabel}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      title={title}
      style={style}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => { isFocused.current = true; }}
      onBlur={(e) => { isFocused.current = false; commit(e.target.value); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit((e.target as HTMLInputElement).value); }
        if (e.key === 'Escape') { setDraft(String(value)); (e.target as HTMLInputElement).blur(); }
      }}
    />
  );
}
