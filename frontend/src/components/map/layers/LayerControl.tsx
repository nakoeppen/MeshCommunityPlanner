import React, { useState } from 'react';
import { useLayerStore } from '../../../stores/layerStore';
import LayerList from './LayerList';
import LayerPresetSelector from './LayerPresetSelector';
import './LayerControl.css';

const LayerControl: React.FC = () => {
  const { layerOrder } = useLayerStore();
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div
      className="layer-control"
      role="region"
      aria-label="Layer Control"
    >
      <div className="layer-control-header">
        <h3>Layers</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Collapse layer panel' : 'Expand layer panel'}
          aria-expanded={isExpanded}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <>
          <LayerPresetSelector />
          <LayerList layerIds={layerOrder} />
        </>
      )}
    </div>
  );
};

export default LayerControl;
