/**
 * AccessibleIcon component
 * Icon component with proper accessibility attributes
 */

import React from 'react';

export interface AccessibleIconProps {
  name: string;
  label?: string;
  decorative?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const AccessibleIconComponent = ({
  name,
  label,
  decorative = false,
  size = 'medium',
  className = '',
}: AccessibleIconProps) => {
  const nameClass = `icon-${name}`;
  const sizeClass = `icon-${size}`;
  const classes = ['icon', nameClass, sizeClass, className].filter(Boolean).join(' ');

  return (
    <span
      className={classes}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? 'true' : 'false'}
      role={decorative ? undefined : 'img'}
    />
  );
};

// Memoize to prevent unnecessary re-renders
export const AccessibleIcon = React.memo(AccessibleIconComponent);
