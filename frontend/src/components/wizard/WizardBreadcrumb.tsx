/**
 * WizardBreadcrumb component
 * WCAG 2.4.8 Location - Breadcrumb navigation for multi-step wizards
 */

import React from 'react';

export interface WizardStep {
  label: string;
  completed: boolean;
  current: boolean;
}

export interface WizardBreadcrumbProps {
  steps: WizardStep[];
  onNavigate: (stepIndex: number) => void;
  className?: string;
}

export function WizardBreadcrumb({
  steps,
  onNavigate,
  className = '',
}: WizardBreadcrumbProps) {
  const handleStepClick = (index: number, step: WizardStep) => {
    // Only allow navigation to completed steps or current step
    if (step.completed || step.current) {
      onNavigate(index);
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    step: WizardStep
  ) => {
    // Handle Enter and Space keys for accessibility
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleStepClick(index, step);
    }
  };

  return (
    <nav
      className={`wizard-breadcrumb ${className}`}
      aria-label="Wizard progress"
      style={{
        padding: '16px 0',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <ol
        role="list"
        style={{
          display: 'flex',
          gap: '8px',
          listStyle: 'none',
          margin: 0,
          padding: 0,
          flexWrap: 'wrap',
        }}
      >
        {steps.map((step, index) => {
          const isClickable = step.completed || step.current;
          const isDisabled = !isClickable;

          return (
            <li
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <button
                onClick={() => handleStepClick(index, step)}
                onKeyDown={(e) => handleKeyDown(e, index, step)}
                disabled={isDisabled}
                aria-current={step.current ? 'step' : undefined}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: step.current ? 600 : 400,
                  cursor: isClickable ? 'pointer' : 'not-allowed',
                  backgroundColor: step.current
                    ? '#3b82f6'
                    : step.completed
                    ? '#10b981'
                    : '#e5e7eb',
                  color: step.current || step.completed ? 'white' : '#6b7280',
                  opacity: isDisabled ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                  outline: 'none',
                  boxShadow: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = '2px solid #3b82f6';
                  e.currentTarget.style.outlineOffset = '2px';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = 'none';
                }}
              >
                {step.label}
              </button>
              {index < steps.length - 1 && (
                <span
                  style={{
                    margin: '0 8px',
                    color: '#9ca3af',
                    fontSize: '14px',
                  }}
                  aria-hidden="true"
                >
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
