/**
 * AntennaStep component
 * Step 4: Configure antenna parameters
 */

import React from 'react';
import { Tooltip } from '../../common/Tooltip';
import { AccessibleIcon } from '../../common/AccessibleIcon';
import { NumberInput } from '../../common/NumberInput';
import type { Node } from '../../../types';

export interface AntennaStepProps {
  data: Partial<Node>;
  errors: Record<string, string>;
  onChange: (field: string, value: any) => void;
}

export function AntennaStep({ data, errors, onChange }: AntennaStepProps) {
  return (
    <div className="wizard-step antenna-step">
      <h3>Antenna Configuration</h3>
      <p>Configure antenna gain, height, and cable loss.</p>

      <div className="form-group">
        <label htmlFor="antenna_gain_dbi">
          Antenna Gain (dBi){' '}
          <Tooltip
            content="Antenna gain in decibels relative to isotropic radiator (dBi). Higher gain focuses the signal in a specific direction, increasing effective range. Typical values: 0-6 dBi. Omnidirectional antennas: 0-3 dBi, directional antennas: 3-15+ dBi."
            position="right"
          >
            <AccessibleIcon icon="ℹ️" label="Antenna Gain information" />
          </Tooltip>
          <NumberInput
            id="antenna_gain_dbi"
            value={data.antenna_gain_dbi || 2}
            onChange={(v) => onChange('antenna_gain_dbi', v)}
            step={0.1}
          />
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="antenna_height_m">
          Antenna Height (m){' '}
          <Tooltip
            content="Height of the antenna above ground level in meters. Higher placement improves line-of-sight and reduces obstacles. Typical values: 2-10 meters for ground-level deployments, higher for towers. Increasing height significantly improves range."
            position="right"
          >
            <AccessibleIcon icon="ℹ️" label="Antenna Height information" />
          </Tooltip>
          <NumberInput
            id="antenna_height_m"
            value={data.antenna_height_m || 2}
            onChange={(v) => onChange('antenna_height_m', v)}
            step={0.1}
          />
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="cable_loss_db">
          Cable Loss (dB){' '}
          <Tooltip
            content="Signal loss in the coaxial cable between radio and antenna, measured in decibels. Longer and thinner cables have higher loss. Typical values: 0-3 dB for short runs (< 3m). Use quality low-loss cable (LMR-400, RG-58) and keep cables as short as possible."
            position="right"
          >
            <AccessibleIcon icon="ℹ️" label="Cable Loss information" />
          </Tooltip>
          <NumberInput
            id="cable_loss_db"
            value={data.cable_loss_db || 0}
            onChange={(v) => onChange('cable_loss_db', v)}
            step={0.1}
          />
        </label>
      </div>
      <div className="form-group">
        <label htmlFor="environment">
          Environment{' '}
          <Tooltip
            content="Propagation environment for this node's coverage analysis. Determines path loss exponent and fade margin. A hilltop repeater might use 'Clear LOS' while a client in a neighborhood uses 'Suburban'."
            position="right"
          >
            <AccessibleIcon icon="ℹ️" label="Environment information" />
          </Tooltip>
          <select
            id="environment"
            value={data.environment || 'suburban'}
            onChange={(e) => onChange('environment', e.target.value)}
          >
            <option value="los_elevated">Clear LOS (Elevated)</option>
            <option value="open_rural">Open / Rural</option>
            <option value="suburban">Suburban (default)</option>
            <option value="urban">Urban</option>
            <option value="indoor">Indoor / Dense Cover</option>
          </select>
        </label>
      </div>
    </div>
  );
}
