const hexToNumber = (hex: string): number => Number.parseInt(hex.replace('#', ''), 16);

export const theme = {
  colors: {
    bg: {
      canvas: '#0b0f1a',
      game: '#0f172a',
    },
    surface: {
      panel: '#131b2c',
      panelBorder: '#2b3852',
      card: '#111827',
      cardAlt: '#1f2937',
      raised: '#22253a',
      disabled: '#374151',
    },
    text: {
      primary: '#ebe5e5',
      secondary: '#c9d4ea',
      muted: '#9ca3af',
      subtle: '#8fa0bb',
      inverse: '#ffffff',
      success: '#d1fae5',
    },
    decor: {
      cardBackLeft: '#263042',
      cardBackRight: '#24314c',
      sparkle: '#9ec1ff',
      shadowDeep: '#101723',
      overlay: '#000000',
    },
    action: {
      primary: {
        base: '#6c5ce7',
        hover: '#7e6ff0',
        border: '#4e44b7',
        shadow: '#2b2368',
      },
      secondary: {
        base: '#3a86ff',
        hover: '#5a9cff',
        border: '#2d69c6',
        shadow: '#163869',
      },
      danger: {
        base: '#ff4d4d',
        hover: '#ff6767',
        border: '#c33434',
        shadow: '#5b2323',
      },
      neutral: {
        base: '#22253a',
        hover: '#2a2f4a',
        border: '#404a6a',
        shadow: '#131722',
      },
    },
    status: {
      success: '#22c55e',
      danger: '#ff4d4d',
      info: '#3a86ff',
    },
    card: {
      red: '#dc2626',
      green: '#16a34a',
      blue: '#2563eb',
      yellow: '#eab308',
      wild: '#1f2937',
    },
  },
} as const;

export const phaserTheme = {
  colors: {
    bg: {
      canvas: hexToNumber(theme.colors.bg.canvas),
      game: hexToNumber(theme.colors.bg.game),
    },
    surface: {
      panel: hexToNumber(theme.colors.surface.panel),
      panelBorder: hexToNumber(theme.colors.surface.panelBorder),
      card: hexToNumber(theme.colors.surface.card),
      cardAlt: hexToNumber(theme.colors.surface.cardAlt),
      raised: hexToNumber(theme.colors.surface.raised),
      disabled: hexToNumber(theme.colors.surface.disabled),
    },
    text: {
      primary: hexToNumber(theme.colors.text.primary),
      secondary: hexToNumber(theme.colors.text.secondary),
      muted: hexToNumber(theme.colors.text.muted),
      subtle: hexToNumber(theme.colors.text.subtle),
      inverse: hexToNumber(theme.colors.text.inverse),
      success: hexToNumber(theme.colors.text.success),
    },
    decor: {
      cardBackLeft: hexToNumber(theme.colors.decor.cardBackLeft),
      cardBackRight: hexToNumber(theme.colors.decor.cardBackRight),
      sparkle: hexToNumber(theme.colors.decor.sparkle),
      shadowDeep: hexToNumber(theme.colors.decor.shadowDeep),
      overlay: hexToNumber(theme.colors.decor.overlay),
    },
    action: {
      primary: {
        base: hexToNumber(theme.colors.action.primary.base),
        hover: hexToNumber(theme.colors.action.primary.hover),
        border: hexToNumber(theme.colors.action.primary.border),
        shadow: hexToNumber(theme.colors.action.primary.shadow),
      },
      secondary: {
        base: hexToNumber(theme.colors.action.secondary.base),
        hover: hexToNumber(theme.colors.action.secondary.hover),
        border: hexToNumber(theme.colors.action.secondary.border),
        shadow: hexToNumber(theme.colors.action.secondary.shadow),
      },
      danger: {
        base: hexToNumber(theme.colors.action.danger.base),
        hover: hexToNumber(theme.colors.action.danger.hover),
        border: hexToNumber(theme.colors.action.danger.border),
        shadow: hexToNumber(theme.colors.action.danger.shadow),
      },
      neutral: {
        base: hexToNumber(theme.colors.action.neutral.base),
        hover: hexToNumber(theme.colors.action.neutral.hover),
        border: hexToNumber(theme.colors.action.neutral.border),
        shadow: hexToNumber(theme.colors.action.neutral.shadow),
      },
    },
    status: {
      success: hexToNumber(theme.colors.status.success),
      danger: hexToNumber(theme.colors.status.danger),
      info: hexToNumber(theme.colors.status.info),
    },
    card: {
      red: hexToNumber(theme.colors.card.red),
      green: hexToNumber(theme.colors.card.green),
      blue: hexToNumber(theme.colors.card.blue),
      yellow: hexToNumber(theme.colors.card.yellow),
      wild: hexToNumber(theme.colors.card.wild),
    },
  },
} as const;

export const themeCssVariables: Record<string, string> = {
  '--color-bg-canvas': theme.colors.bg.canvas,
  '--color-bg-game': theme.colors.bg.game,
  '--color-surface-panel': theme.colors.surface.panel,
  '--color-surface-panel-border': theme.colors.surface.panelBorder,
  '--color-surface-card': theme.colors.surface.card,
  '--color-surface-card-alt': theme.colors.surface.cardAlt,
  '--color-text-primary': theme.colors.text.primary,
  '--color-text-muted': theme.colors.text.muted,
  '--color-text-secondary': theme.colors.text.secondary,
  '--color-text-inverse': theme.colors.text.inverse,
  '--color-action-primary': theme.colors.action.primary.base,
  '--color-action-secondary': theme.colors.action.secondary.base,
  '--color-action-danger': theme.colors.action.danger.base,
  '--color-status-success': theme.colors.status.success,
  '--color-status-danger': theme.colors.status.danger,
};

export function applyThemeCssVariables(root: HTMLElement = document.documentElement): void {
  Object.entries(themeCssVariables).forEach(([token, value]) => {
    root.style.setProperty(token, value);
  });
}
