import React from 'react';
import LayerItem from './LayerItem';

interface LayerListProps {
  layerIds: string[];
}

const LayerList: React.FC<LayerListProps> = ({ layerIds }) => {
  return (
    <ul className="layer-list" role="list" aria-label="Map layers">
      {layerIds.map((layerId) => (
        <LayerItem key={layerId} layerId={layerId} />
      ))}
    </ul>
  );
};

export default LayerList;
