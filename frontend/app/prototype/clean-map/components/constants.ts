export const SIDEBAR_WIDTH = 356;
export const SIDEBAR_GAP = 16;

export const palette = {
  slate: { bg: "#f8fafc", text: "#334155", border: "#e2e8f0" },
  green: { bg: "#ecfdf5", text: "#047857", border: "#bbf7d0" },
  blue: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  pink: { bg: "#fdf2f8", text: "#9d174d", border: "#fbcfe8" },
  amber: { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
} as const;

export type Tone = keyof typeof palette;
