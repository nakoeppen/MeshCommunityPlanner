/**
 * RadioStep component
 * Step 3: Configure radio parameters
 */

import React from 'react';
import { Tooltip } from '../../common/Tooltip';
import { AccessibleIcon } from '../../common/AccessibleIcon';
import { NumberInput } from '../../common/NumberInput';
import type { Node} from '../../../types';

export interface RadioStepProps {
  data: Partial<Node>;
  errors: Record<string, string>;
  onChange: (field: string, value: any) => void;
}

export function RadioStep({ data, errors, onChange }: RadioStepProps) {
  return (
    <div className="wizard-step radio-step">
      <h3>Radio Configuration</h3>
      <p>Configure transmit power and sensitivity.</p>

      <div className="form-group">
        <label htmlFor="tx_power_dbm">
          TX Power (dBm){' '}
          <Tooltip
            content="Transmit power in decibels relative to 1 milliwatt (dBm). Higher values increase range but consume more battery power. Typical values: 14-20 dBm. Check your local regulations for maximum allowed power."
            position="right"
          >
            <AccessibleIcon icon="ℹ️" label="TX Power information" />
          </Tooltip>
          <NumberInput
            id="tx_power_dbm"
            value={data.tx_power_dbm || 20}
            onChange={(v) => onChange('tx_power_dbm', v)}
          />
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="rx_sensitivity_dbm">
          RX Sensitivity (dBm){' '}
          <Tooltip
            content="Receiver sensitivity threshold in dBm. Lower (more negative) values mean better ability to receive weak signals. Typical values: -120 to -130 dBm. Better sensitivity allows reception over longer distances."
            position="right"
          >
            <AccessibleIcon icon="ℹ️" label="RX Sensitivity information" />
          </Tooltip>
          <NumberInput
            id="rx_sensitivity_dbm"
            value={data.rx_sensitivity_dbm || -120}
            onChange={(v) => onChange('rx_sensitivity_dbm', v)}
          />
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="region_code">
          Region Code{' '}
          <Tooltip
            content="Regulatory region determining allowed frequency bands and maximum transmit power. Choose the region where your devices will operate to ensure compliance with local radio regulations."
            position="right"
          >
            <AccessibleIcon icon="ℹ️" label="Region Code information" />
          </Tooltip>
          <select
            id="region_code"
            value={data.region_code || 'us_fcc'}
            onChange={(e) => onChange('region_code', e.target.value)}
          >
            <option value="us_fcc">US (FCC)</option>
            <option value="eu_etsi">EU (ETSI)</option>
          </select>
        </label>
      </div>
    </div>
  );
}
