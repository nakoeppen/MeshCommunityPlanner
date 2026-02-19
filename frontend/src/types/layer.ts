export type LayerType = 'geojson' | 'wms' | 'wmts' | 'tile' | 'vector';

export interface LayerSource {
  type: LayerType;
  url?: string;
  data?: any;
  attribution?: string;
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  opacity: number;
  zIndex: number;
  source: LayerSource;
  metadata?: Record<string, any>;
}

export interface LayerPreset {
  id: string;
  name: string;
  layers: string[]; // Layer IDs
  visibility: Record<string, boolean>;
  opacity: Record<string, number>;
  order: string[];
  createdAt: number;
}
