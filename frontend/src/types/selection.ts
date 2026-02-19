export type SelectionMode = 'click' | 'lasso' | 'region' | 'flood';

export interface BulkOperation {
  type: 'edit' | 'delete' | 'copy' | 'paste' | 'move';
  nodeIds: number[];
  properties?: Record<string, any>;
  offset?: { lat: number; lng: number };
}
