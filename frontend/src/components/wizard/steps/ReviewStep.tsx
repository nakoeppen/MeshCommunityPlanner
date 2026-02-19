/**
 * ReviewStep component
 * Step 7: Review all configuration before saving
 */

import React from 'react';
import type { Node } from '../../../types';

export interface ReviewStepProps {
  data: Partial<Node>;
  errors: Record<string, string>;
  onChange: (field: string, value: any) => void;
}

export function ReviewStep({ data, errors, onChange }: ReviewStepProps) {
  return (
    <div className="wizard-step review-step">
      <h3>Review Configuration</h3>
      <p>Review your node configuration before finishing.</p>

      <div className="review-section">
        <h4>Location</h4>
        <dl>
          <dt>Latitude:</dt>
          <dd>{data.latitude || 'Not set'}</dd>
          <dt>Longitude:</dt>
          <dd>{data.longitude || 'Not set'}</dd>
          <dt>Name:</dt>
          <dd>{data.name || 'Not set'}</dd>
        </dl>
      </div>

      <div className="review-section">
        <h4>Device</h4>
        <dl>
          <dt>Device ID:</dt>
          <dd>{data.device_id || 'Not set'}</dd>
          <dt>Firmware:</dt>
          <dd>{data.firmware_family || 'Not set'}</dd>
        </dl>
      </div>

      <div className="review-section">
        <h4>Radio</h4>
        <dl>
          <dt>TX Power:</dt>
          <dd>{data.tx_power_dbm || 'Not set'} dBm</dd>
          <dt>RX Sensitivity:</dt>
          <dd>{data.rx_sensitivity_dbm || 'Not set'} dBm</dd>
          <dt>Region:</dt>
          <dd>{data.region_code || 'Not set'}</dd>
        </dl>
      </div>

      <div className="review-section">
        <h4>Antenna</h4>
        <dl>
          <dt>Gain:</dt>
          <dd>{data.antenna_gain_dbi || 'Not set'} dBi</dd>
          <dt>Height:</dt>
          <dd>{data.antenna_height_m || 'Not set'} m</dd>
          <dt>Cable Loss:</dt>
          <dd>{data.cable_loss_db || 'Not set'} dB</dd>
        </dl>
      </div>
    </div>
  );
}
