export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'in'
  | 'notIn'
  | 'between';

export type FilterValueType = string | number | boolean | string[] | number[];

export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: FilterValueType;
}

export interface FilterGroup {
  id: string;
  logic: 'AND' | 'OR';
  conditions: FilterCondition[];
  groups: FilterGroup[];
}

export interface Filter {
  id: string;
  name: string;
  description?: string;
  rootGroup: FilterGroup;
  createdAt: number;
  updatedAt: number;
}

export interface FilterPreset extends Filter {
  isShared: boolean;
  createdBy?: string;
  tags: string[];
}

export interface FilterResult {
  filterId: string;
  matchCount: number;
  matches: any[];
  executionTime: number;
}

export interface FilterField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
  operators: FilterOperator[];
  enumValues?: Array<{ value: string; label: string }>;
}
