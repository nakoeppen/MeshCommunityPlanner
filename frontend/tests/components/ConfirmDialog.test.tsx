/**
 * Tests for ConfirmDialog component — close button, accessibility.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { ConfirmDialog } from '../../src/components/common/ConfirmDialog';

describe('ConfirmDialog', () => {
  const baseProps = {
    isOpen: true,
    title: 'Test Dialog',
    message: 'Are you sure?',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    confirmText: 'OK',
    cancelText: 'Cancel',
  };

  describe('basic rendering', () => {
    it('renders title and message when open', () => {
      render(<ConfirmDialog {...baseProps} />);
      expect(screen.getByText('Test Dialog')).toBeTruthy();
      expect(screen.getByText('Are you sure?')).toBeTruthy();
    });

    it('renders nothing when closed', () => {
      const { container } = render(<ConfirmDialog {...baseProps} isOpen={false} />);
      expect(container.innerHTML).toBe('');
    });

    it('renders confirm and cancel buttons', () => {
      render(<ConfirmDialog {...baseProps} />);
      expect(screen.getByText('OK')).toBeTruthy();
      expect(screen.getByText('Cancel')).toBeTruthy();
    });

    it('calls onConfirm when OK is clicked', () => {
      render(<ConfirmDialog {...baseProps} />);
      fireEvent.click(screen.getByText('OK'));
      expect(baseProps.onConfirm).toHaveBeenCalled();
    });

    it('calls onCancel when Cancel is clicked', () => {
      render(<ConfirmDialog {...baseProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(baseProps.onCancel).toHaveBeenCalled();
    });

    it('calls onCancel on Escape key', () => {
      const onCancel = vi.fn();
      render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('close button (showCloseButton)', () => {
    it('does not render X button by default', () => {
      render(<ConfirmDialog {...baseProps} />);
      expect(screen.queryByLabelText('Close dialog')).toBeNull();
    });

    it('renders X button when showCloseButton is true', () => {
      render(<ConfirmDialog {...baseProps} showCloseButton />);
      const closeBtn = screen.getByLabelText('Close dialog');
      expect(closeBtn).toBeTruthy();
    });

    it('X button has title attribute for mouseover', () => {
      render(<ConfirmDialog {...baseProps} showCloseButton />);
      const closeBtn = screen.getByLabelText('Close dialog');
      expect(closeBtn.getAttribute('title')).toBe('Close dialog');
    });

    it('clicking X button calls onCancel (does not confirm)', () => {
      const onCancel = vi.fn();
      const onConfirm = vi.fn();
      render(
        <ConfirmDialog {...baseProps} showCloseButton onCancel={onCancel} onConfirm={onConfirm} />
      );
      fireEvent.click(screen.getByLabelText('Close dialog'));
      expect(onCancel).toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('X button is keyboard accessible (has type=button)', () => {
      render(<ConfirmDialog {...baseProps} showCloseButton />);
      const closeBtn = screen.getByLabelText('Close dialog');
      expect(closeBtn.getAttribute('type')).toBe('button');
    });
  });

  describe('variants', () => {
    it('renders danger header with warning icon for danger variant', () => {
      render(<ConfirmDialog {...baseProps} variant="danger" />);
      const header = document.querySelector('.confirm-dialog-header');
      expect(header?.classList.contains('danger')).toBe(true);
    });

    it('renders question icon for primary variant', () => {
      render(<ConfirmDialog {...baseProps} variant="primary" />);
      const icon = document.querySelector('.confirm-dialog-icon');
      // ❓ = \u2753
      expect(icon?.textContent).toBe('\u2753');
    });

    it('renders warning icon for danger variant', () => {
      render(<ConfirmDialog {...baseProps} variant="danger" />);
      const icon = document.querySelector('.confirm-dialog-icon');
      // ⚠ = \u26A0
      expect(icon?.textContent).toBe('\u26A0');
    });
  });

  describe('backdrop behavior', () => {
    it('calls onCancel on backdrop click when closeOnBackdrop is true', () => {
      const onCancel = vi.fn();
      const { container } = render(
        <ConfirmDialog {...baseProps} onCancel={onCancel} closeOnBackdrop />
      );
      const overlay = container.parentElement?.querySelector('.confirm-dialog-overlay');
      if (overlay) fireEvent.click(overlay);
      expect(onCancel).toHaveBeenCalled();
    });

    it('does not call onCancel on backdrop click when closeOnBackdrop is false', () => {
      const onCancel = vi.fn();
      const { container } = render(
        <ConfirmDialog {...baseProps} onCancel={onCancel} closeOnBackdrop={false} />
      );
      const overlay = container.parentElement?.querySelector('.confirm-dialog-overlay');
      if (overlay) fireEvent.click(overlay);
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('ARIA attributes', () => {
    it('has role="alertdialog"', () => {
      render(<ConfirmDialog {...baseProps} />);
      const dialog = document.querySelector('.confirm-dialog');
      expect(dialog?.getAttribute('role')).toBe('alertdialog');
    });

    it('has aria-modal="true"', () => {
      render(<ConfirmDialog {...baseProps} />);
      const dialog = document.querySelector('.confirm-dialog');
      expect(dialog?.getAttribute('aria-modal')).toBe('true');
    });

    it('has aria-label matching the title', () => {
      render(<ConfirmDialog {...baseProps} title="My Title" />);
      const dialog = document.querySelector('.confirm-dialog');
      expect(dialog?.getAttribute('aria-label')).toBe('My Title');
    });
  });

  describe('focus trap', () => {
    it('Tab from last button wraps to first button', () => {
      render(<ConfirmDialog {...baseProps} showCloseButton />);
      // DOM order: Close(X), Cancel, OK — OK is last
      const okBtn = document.querySelector('.confirm-dialog-ok') as HTMLElement;
      const closeBtn = document.querySelector('.confirm-dialog-close') as HTMLElement;
      okBtn.focus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(closeBtn);
    });

    it('Shift+Tab from first button wraps to last button', () => {
      render(<ConfirmDialog {...baseProps} showCloseButton />);
      const closeBtn = document.querySelector('.confirm-dialog-close') as HTMLElement;
      const okBtn = document.querySelector('.confirm-dialog-ok') as HTMLElement;
      closeBtn.focus();
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(okBtn);
    });

    it('Tab cycles without escaping when no close button', () => {
      render(<ConfirmDialog {...baseProps} />);
      // DOM order: Cancel, OK — OK is last
      const okBtn = document.querySelector('.confirm-dialog-ok') as HTMLElement;
      const cancelBtn = document.querySelector('.confirm-dialog-cancel') as HTMLElement;
      okBtn.focus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(cancelBtn);
    });
  });

  describe('accessibility', () => {
    it('has no axe violations (primary variant)', async () => {
      const { container } = render(<ConfirmDialog {...baseProps} />);
      const portal = document.querySelector('.confirm-dialog-overlay') as HTMLElement;
      const results = await axe(portal || container);
      expect(results.violations).toEqual([]);
    });

    it('has no axe violations (danger variant with close button)', async () => {
      const { container } = render(
        <ConfirmDialog {...baseProps} variant="danger" showCloseButton />
      );
      const portal = document.querySelector('.confirm-dialog-overlay') as HTMLElement;
      const results = await axe(portal || container);
      expect(results.violations).toEqual([]);
    });
  });
});
