/**
 * ConfirmDialog Component
 * Styled confirmation dialog matching the app's dark theme.
 * Replaces native window.confirm() throughout the app.
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ConfirmDialog.css';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger';
  closeOnBackdrop?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title = 'Mesh Community Planner',
  message,
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  variant = 'primary',
  closeOnBackdrop = true,
}: ConfirmDialogProps) {
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => okRef.current?.focus(), 50);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && e.target === e.currentTarget) onCancel();
  };

  const isDanger = variant === 'danger';
  const icon = isDanger ? '\u26A0' : '\u2753';

  return createPortal(
    <div className="confirm-dialog-overlay" onClick={handleBackdrop}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-dialog-header${isDanger ? ' danger' : ''}`}>
          <span className="confirm-dialog-icon">{icon}</span>
          <span className="confirm-dialog-title">{title}</span>
        </div>
        <div className="confirm-dialog-body">{message}</div>
        <div className="confirm-dialog-footer">
          <button className="confirm-dialog-cancel" onClick={onCancel}>{cancelText}</button>
          <button
            ref={okRef}
            className={`confirm-dialog-ok${isDanger ? ' danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
