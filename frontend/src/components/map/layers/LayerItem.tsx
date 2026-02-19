import React from 'react';
import { useLayerStore } from '../../../stores/layerStore';
import LayerVisibilityToggle from './LayerVisibilityToggle';
import OpacitySlider from './OpacitySlider';

interface LayerItemProps {
  layerId: string;
}

const LayerItem: React.FC<LayerItemProps> = ({ layerId }) => {
  const { getLayer } = useLayerStore();
  const layer = getLayer(layerId);

  if (!layer) return null;

  return (
    <li
      className="layer-item"
      role="listitem"
      aria-label={`Layer: ${layer.name}`}
    >
      <div className="layer-drag-handle" aria-label={`Drag to reorder ${layer.name}`}>
        ⋮⋮
      </div>

      <LayerVisibilityToggle layerId={layerId} />

      <div className="layer-info">
        <span className="layer-name">{layer.name}</span>
        <span className="layer-type">{layer.type}</span>
      </div>

      <OpacitySlider layerId={layerId} />
    </li>
  );
};

export default LayerItem;
