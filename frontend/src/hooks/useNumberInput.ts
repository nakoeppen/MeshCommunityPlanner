/**
 * useNumberInput — defer validation to blur so users can freely type intermediate values.
 *
 * Problem: typing "2000" into <input min={100}> fails because "2" < 100 is rejected immediately.
 * Solution: let onChange accept any string, validate+clamp on blur.
 */

import { useState, useCallback } from 'react';

export function useNumberInput(initial: number, min: number, max: number) {
  const [value, setValue] = useState(initial);
  const [display, setDisplay] = useState(String(initial));

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDisplay(e.target.value),
    [],
  );

  const handleBlur = useCallback(() => {
    const v = parseFloat(display);
    if (!isNaN(v) && v >= min && v <= max) {
      setValue(v);
      setDisplay(String(v));
    } else {
      // Revert to last valid value
      setDisplay(String(value));
    }
  }, [display, min, max, value]);

  const reset = useCallback((newValue: number) => {
    setValue(newValue);
    setDisplay(String(newValue));
  }, []);

  return { value, display, handleChange, handleBlur, reset } as const;
}
