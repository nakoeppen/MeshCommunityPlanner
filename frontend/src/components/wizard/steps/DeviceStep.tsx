/**
 * DeviceStep component
 * Step 2: Select device type and firmware
 */

import React from 'react';
import type { Node } from '../../../types';

export interface DeviceStepProps {
  data: Partial<Node>;
  errors: Record<string, string>;
  onChange: (field: string, value: any) => void;
}

export function DeviceStep({ data, errors, onChange }: DeviceStepProps) {
  return (
    <div className="wizard-step device-step">
      <h3>Device Configuration</h3>
      <p>Select the device type and firmware family.</p>

      <div className="form-group">
        <label htmlFor="device_id">
          Device ID
          <input
            type="text"
            id="device_id"
            value={data.device_id || ''}
            onChange={(e) => onChange('device_id', e.target.value)}
          />
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="firmware_family">
          Firmware Family
          <select
            id="firmware_family"
            value={data.firmware_family || 'meshtastic'}
            onChange={(e) => onChange('firmware_family', e.target.value)}
          >
            <option value="meshtastic">Meshtastic</option>
            <option value="custom">Custom</option>
          </select>
        </label>
      </div>
    </div>
  );
}
