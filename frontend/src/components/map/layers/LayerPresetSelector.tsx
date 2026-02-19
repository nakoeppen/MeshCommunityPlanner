import React, { useState } from 'react';
import { useLayerStore } from '../../../stores/layerStore';

const LayerPresetSelector: React.FC = () => {
  const { presets, loadPreset, savePreset, deletePreset } = useLayerStore();
  const [isCreatingPreset, setIsCreatingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  const handleSavePreset = () => {
    if (presetName.trim()) {
      savePreset(presetName.trim());
      setPresetName('');
      setIsCreatingPreset(false);
    }
  };

  const handleLoadPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value) {
      loadPreset(e.target.value);
    }
  };

  return (
    <div className="layer-preset-selector">
      <label htmlFor="preset-select">Presets</label>
      <select
        id="preset-select"
        onChange={handleLoadPreset}
        defaultValue=""
        aria-label="Select layer preset"
      >
        <option value="">-- Select Preset --</option>
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </select>

      {!isCreatingPreset ? (
        <button
          onClick={() => setIsCreatingPreset(true)}
          aria-label="Save current configuration as preset"
        >
          Save Preset
        </button>
      ) : (
        <div className="preset-creation">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name"
            aria-label="Preset name"
          />
          <button onClick={handleSavePreset} aria-label="Confirm save preset">
            Confirm
          </button>
          <button
            onClick={() => {
              setIsCreatingPreset(false);
              setPresetName('');
            }}
            aria-label="Cancel save preset"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default LayerPresetSelector;
