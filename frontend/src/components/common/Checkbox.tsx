/**
 * Checkbox component
 * Accessible checkbox with label, error handling, and validation
 */

import React, { useId } from 'react';

export interface CheckboxProps {
  label: string;
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
}

const CheckboxComponent = ({
  label,
  checked,
  onChange,
  disabled = false,
  required = false,
  error,
  className = '',
}: CheckboxProps) => {
  const checkboxId = useId();
  const errorId = useId();

  return (
    <div className={`checkbox-wrapper ${className}`}>
      <input
        id={checkboxId}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        required={required}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? errorId : undefined}
        className={error ? 'checkbox-error' : ''}
      />
      <label htmlFor={checkboxId}>
        {label}
        {required && <span aria-label="required"> *</span>}
      </label>
      {error && (
        <span id={errorId} className="error-message" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

// Memoize to prevent unnecessary re-renders
export const Checkbox = React.memo(CheckboxComponent);
