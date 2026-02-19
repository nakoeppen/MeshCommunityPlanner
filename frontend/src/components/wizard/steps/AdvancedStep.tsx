/**
 * AdvancedStep component
 * Step 5: Advanced configuration options
 */

import React from 'react';
import type { Node } from '../../../types';

export interface AdvancedStepProps {
  data: Partial<Node>;
  errors: Record<string, string>;
  onChange: (field: string, value: any) => void;
}

export function AdvancedStep({ data, errors, onChange }: AdvancedStepProps) {
  return (
    <div className="wizard-step advanced-step">
      <h3>Advanced Options</h3>
      <p>Configure advanced settings (optional).</p>

      <div className="form-group">
        <label htmlFor="status">
          Status
          <select
            id="status"
            value={data.status || 'configured'}
            onChange={(e) => onChange('status', e.target.value)}
          >
            <option value="configured">Configured</option>
            <option value="deployed">Deployed</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>
    </div>
  );
}
