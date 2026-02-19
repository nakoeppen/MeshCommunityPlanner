/**
 * PromptDialog Component
 * Styled input dialog matching the app's dark theme.
 * Replaces native window.prompt() throughout the app.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './PromptDialog.css';

export interface PromptDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  submitText?: string;
  cancelText?: string;
  placeholder?: string;
}

export function PromptDialog({
  isOpen,
  title = 'Mesh Community Planner',
  message,
  defaultValue = '',
  onSubmit,
  onCancel,
  submitText = 'OK',
  cancelText = 'Cancel',
  placeholder = '',
}: PromptDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (!isOpen) return;
    setValue(defaultValue);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, defaultValue, onCancel]);

  if (!isOpen) return null;

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  const handleInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return createPortal(
    <div className="prompt-dialog-overlay" onClick={handleBackdrop}>
      <div className="prompt-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="prompt-dialog-header">
          <span className="prompt-dialog-icon">&#9998;</span>
          <span className="prompt-dialog-title">{title}</span>
        </div>
        <div className="prompt-dialog-body">
          <div className="prompt-dialog-message">{message}</div>
          <input
            ref={inputRef}
            className="prompt-dialog-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleInputKey}
            placeholder={placeholder}
          />
        </div>
        <div className="prompt-dialog-footer">
          <button className="prompt-dialog-cancel" onClick={onCancel}>{cancelText}</button>
          <button
            className="prompt-dialog-ok"
            onClick={handleSubmit}
            disabled={!value.trim()}
          >
            {submitText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
