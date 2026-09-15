export interface NoteColorOption {
  id: string;
  name: string;
  bg: string;          // Tailwind / CSS background color
  border: string;      // subtle border color
  text: string;        // high-contrast dark text
  previewBorder: string;
}

export const NOTE_COLORS: NoteColorOption[] = [
  {
    id: 'soft_yellow',
    name: 'Soft Yellow',
    bg: '#FFF9C4',
    border: '#FFF176',
    text: '#4A3B18',
    previewBorder: '#E6D458',
  },
  {
    id: 'cream',
    name: 'Cream',
    bg: '#FFF8E1',
    border: '#FFE082',
    text: '#4A3E20',
    previewBorder: '#E6C65A',
  },
  {
    id: 'peach',
    name: 'Peach',
    bg: '#FFECD2',
    border: '#FFCCBC',
    text: '#4A2A1A',
    previewBorder: '#E8A793',
  },
  {
    id: 'soft_orange',
    name: 'Soft Orange',
    bg: '#FFE0B2',
    border: '#FFB74D',
    text: '#4A2800',
    previewBorder: '#E89828',
  },
  {
    id: 'soft_pink',
    name: 'Soft Pink',
    bg: '#FCE4EC',
    border: '#F8BBD0',
    text: '#4A1525',
    previewBorder: '#E495B0',
  },
  {
    id: 'rose',
    name: 'Rose',
    bg: '#F8BBD0',
    border: '#F48FB1',
    text: '#4A1125',
    previewBorder: '#D86890',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    bg: '#E8DEF8',
    border: '#D0BCFF',
    text: '#281B4E',
    previewBorder: '#B297F0',
  },
  {
    id: 'soft_purple',
    name: 'Soft Purple',
    bg: '#E1BEE7',
    border: '#CE93D8',
    text: '#2F123C',
    previewBorder: '#BA68C8',
  },
  {
    id: 'soft_blue',
    name: 'Soft Blue',
    bg: '#DCEEFB',
    border: '#B3E5FC',
    text: '#133554',
    previewBorder: '#7FC2EA',
  },
  {
    id: 'sky_blue',
    name: 'Sky Blue',
    bg: '#B3E5FC',
    border: '#81D4FA',
    text: '#0D3650',
    previewBorder: '#4FC3F7',
  },
  {
    id: 'cyan',
    name: 'Cyan',
    bg: '#B2EBF2',
    border: '#80DEEA',
    text: '#0B383D',
    previewBorder: '#4DD0E1',
  },
  {
    id: 'soft_teal',
    name: 'Soft Teal',
    bg: '#B2DFDB',
    border: '#80CBC4',
    text: '#0C3834',
    previewBorder: '#4DB6AC',
  },
  {
    id: 'mint',
    name: 'Mint',
    bg: '#C8E6C9',
    border: '#A5D6A7',
    text: '#163E19',
    previewBorder: '#81C784',
  },
  {
    id: 'soft_green',
    name: 'Soft Green',
    bg: '#DCEDC8',
    border: '#C5E1A5',
    text: '#243C12',
    previewBorder: '#AED581',
  },
  {
    id: 'sage',
    name: 'Sage',
    bg: '#E8ECD7',
    border: '#D4DCB9',
    text: '#2E381D',
    previewBorder: '#B4C093',
  },
  {
    id: 'soft_grey',
    name: 'Soft Grey',
    bg: '#ECEFF1',
    border: '#CFD8DC',
    text: '#263238',
    previewBorder: '#B0BEC5',
  },
];

export const DEFAULT_NOTE_COLOR = NOTE_COLORS[0];

export function getNoteColor(colorId?: string | null): NoteColorOption {
  if (!colorId) return DEFAULT_NOTE_COLOR;
  const found = NOTE_COLORS.find((c) => c.id === colorId);
  return found || DEFAULT_NOTE_COLOR;
}

/**
 * Pick a random color from the palette, optionally excluding a specific color id
 * to avoid consecutive identical colors.
 */
export function getRandomNoteColor(excludeColorId?: string | null): NoteColorOption {
  const eligible = excludeColorId
    ? NOTE_COLORS.filter((c) => c.id !== excludeColorId)
    : NOTE_COLORS;
  
  const pool = eligible.length > 0 ? eligible : NOTE_COLORS;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

/**
 * Deterministically pick an auto-assigned color based on index or count
 */
export function getAutoAssignedColor(count: number): NoteColorOption {
  const index = Math.abs(count) % NOTE_COLORS.length;
  return NOTE_COLORS[index];
}
