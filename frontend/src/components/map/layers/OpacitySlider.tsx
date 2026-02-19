import React from 'react';
import { useLayerStore } from '../../../stores/layerStore';

interface OpacitySliderProps {
  layerId: string;
}

const OpacitySlider: React.FC<OpacitySliderProps> = ({ layerId }) => {
  const { layerOpacity, setOpacity } = useLayerStore();
  const opacity = layerOpacity.get(layerId) ?? 1;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) / 100;
    setOpacity(layerId, value);
  };

  return (
    <div className="opacity-slider-container">
      <label htmlFor={`opacity-${layerId}`} className="sr-only">
        Opacity for layer {layerId}
      </label>
      <input
        id={`opacity-${layerId}`}
        type="range"
        min="0"
        max="100"
        value={Math.round(opacity * 100)}
        onChange={handleChange}
        aria-label="Adjust opacity"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(opacity * 100)}
        aria-valuetext={`${Math.round(opacity * 100)}% opacity`}
        className="opacity-slider"
      />
      <span className="opacity-value">{Math.round(opacity * 100)}%</span>
    </div>
  );
};

export default OpacitySlider;
