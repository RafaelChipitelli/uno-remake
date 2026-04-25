const hexToNumber = (hex: string): number => Number.parseInt(hex.replace('#', ''), 16);

export const theme = {
  colors: {
    bg: {
      canvas: '#120D1C',
      game: '#181023',
    },
    surface: {
      panel: '#241A36',
      panelBorder: '#382A52',
      card: '#2B2140',
      cardAlt: '#342753',
      raised: '#3A2A5C',
      disabled: '#2A2435',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B9AEDB',
      muted: '#8F83B5',
      subtle: '#6F638F',
      inverse: '#FFFFFF',
      success: '#D8CFFF',
    },
    decor: {
      cardBackLeft: '#2A2140',
      cardBackRight: '#3A2A63',
      sparkle: '#B9A7FF',
      shadowDeep: '#08050D',
      overlay: '#000000',
    },
    action: {
      primary: {
        base: '#7B42E8',
        hover: '#8D55F2',
        border: '#9D7CFF',
        shadow: '#2D174F',
      },
      secondary: {
        base: '#4C2C7A',
        hover: '#5B3792',
        border: '#6F4BA8',
        shadow: '#1A102A',
      },
      danger: {
        base: '#B84A5A',
        hover: '#D45B6C',
        border: '#E47786',
        shadow: '#35121A',
      },
      neutral: {
        base: '#2A203D',
        hover: '#36294F',
        border: '#4A3A66',
        shadow: '#120B1D',
      },
    },
    status: {
      success: '#8BFFB0',
      danger: '#FF6B7A',
      info: '#B9A7FF',
    },
    card: {
      red: '#E84A5F',
      green: '#36C47A',
      blue: '#4C8DFF',
      yellow: '#FFC84A',
      wild: '#20172D',
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