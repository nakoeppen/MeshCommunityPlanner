export interface KeyboardShortcut {
  id: string;
  name: string;
  description: string;
  category: 'navigation' | 'editing' | 'selection' | 'view' | 'system';
  keys: string[]; // e.g. ['Ctrl', 'S'] or ['Alt', 'Shift', 'N']
  action: () => void;
  enabled: boolean;
}

export interface ShortcutCategory {
  id: string;
  name: string;
  description: string;
}

export interface ShortcutConflict {
  shortcutId1: string;
  shortcutId2: string;
  keys: string[];
}

export type KeyModifier = 'Ctrl' | 'Alt' | 'Shift' | 'Meta';
