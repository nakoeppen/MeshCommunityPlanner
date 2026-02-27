/**
 * ConfirmDialog Component
 * Styled confirmation dialog matching the app's dark theme.
 * Replaces native window.confirm() throughout the app.
 * Includes focus trap so Tab/Shift+Tab cycle within the dialog.
 */

import React, { useEffect, useRef, useCallback } from 'react';
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
  showCloseButton?: boolean;
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
  showCloseButton = false,
}: ConfirmDialogProps) {
  const okRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap: keep Tab/Shift+Tab cycling within the dialog
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
      return;
    }
    if (e.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [onCancel]);

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => okRef.current?.focus(), 50);
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && e.target === e.currentTarget) onCancel();
  };

  const isDanger = variant === 'danger';
  const icon = isDanger ? '\u26A0' : '\u2753';

  return createPortal(
    <div className="confirm-dialog-overlay" onClick={handleBackdrop}>
      <div
        className="confirm-dialog"
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`confirm-dialog-header${isDanger ? ' danger' : ''}`}>
          <span className="confirm-dialog-icon">{icon}</span>
          <span className="confirm-dialog-title">{title}</span>
          {showCloseButton && (
            <button
              className="confirm-dialog-close"
              onClick={onCancel}
              aria-label="Close dialog"
              title="Close dialog"
              type="button"
            >
              &times;
            </button>
          )}
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
