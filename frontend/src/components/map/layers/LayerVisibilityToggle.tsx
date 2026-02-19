import React from 'react';
import { useLayerStore } from '../../../stores/layerStore';

interface LayerVisibilityToggleProps {
  layerId: string;
}

const LayerVisibilityToggle: React.FC<LayerVisibilityToggleProps> = ({ layerId }) => {
  const { getLayer, activeLayerIds, toggleLayer } = useLayerStore();
  const layer = getLayer(layerId);

  if (!layer) return null;

  const isVisible = activeLayerIds.has(layerId);

  return (
    <input
      type="checkbox"
      checked={isVisible}
      onChange={() => toggleLayer(layerId)}
      aria-label={`Toggle visibility of ${layer.name}`}
      className="layer-visibility-toggle"
    />
  );
};

export default LayerVisibilityToggle;
