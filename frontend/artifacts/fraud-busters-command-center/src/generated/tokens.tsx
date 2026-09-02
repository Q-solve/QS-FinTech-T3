/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "primary": "#0F7180",
      "secondary": "#DCECEE",
      "accent": "#F3C46B",
      "background": "#F3F8F7",
      "foreground": "#0A2430",
      "card": "#FFFFFF",
      "cardForeground": "#0A2430",
      "popover": "#FFFFFF",
      "popoverForeground": "#0A2430",
      "primaryForeground": "#FFFFFF",
      "secondaryForeground": "#0A3B49",
      "muted": "#E6F1F0",
      "mutedForeground": "#52727A",
      "accentForeground": "#3A2A0A",
      "destructive": "#D45D57",
      "destructiveForeground": "#FFFFFF",
      "border": "#C9DEDF",
      "input": "#C9DEDF",
      "ring": "#0F7180",
      "chart1": "#0F7180",
      "chart2": "#2F9D99",
      "chart3": "#D59A35",
      "chart4": "#D45D57",
      "chart5": "#557CC7",
      "sidebar": "#EAF4F3",
      "sidebarForeground": "#234C57",
      "sidebarBorder": "#C9DEDF",
      "sidebarPrimary": "#0F7180",
      "sidebarPrimaryForeground": "#FFFFFF",
      "sidebarAccent": "#DCECEE",
      "sidebarAccentForeground": "#0A3B49",
      "sidebarRing": "#0F7180"
    },
    "dark": {
      "primary": "#6AD8D1",
      "secondary": "#153A4C",
      "accent": "#F3C46B",
      "background": "#081A26",
      "foreground": "#E8F3F3",
      "card": "#102B3A",
      "cardForeground": "#E8F3F3",
      "popover": "#123448",
      "popoverForeground": "#E8F3F3",
      "primaryForeground": "#081A26",
      "secondaryForeground": "#E8F3F3",
      "muted": "#123040",
      "mutedForeground": "#99B7BC",
      "accentForeground": "#2A220F",
      "destructive": "#E8756A",
      "destructiveForeground": "#081A26",
      "border": "#234B5A",
      "input": "#234B5A",
      "ring": "#6AD8D1",
      "chart1": "#6AD8D1",
      "chart2": "#83B9F3",
      "chart3": "#F3C46B",
      "chart4": "#E8756A",
      "chart5": "#B49AF2",
      "sidebar": "#0B2432",
      "sidebarForeground": "#D5E8E8",
      "sidebarBorder": "#234B5A",
      "sidebarPrimary": "#6AD8D1",
      "sidebarPrimaryForeground": "#081A26",
      "sidebarAccent": "#153A4C",
      "sidebarAccentForeground": "#E8F3F3",
      "sidebarRing": "#6AD8D1"
    }
  },
  "fontFamily": {
    "sans": [
      "DM Sans",
      "sans-serif"
    ],
    "serif": [
      "Georgia",
      "serif"
    ],
    "mono": [
      "Geist Mono",
      "monospace"
    ]
  },
  "radius": "0.625rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
