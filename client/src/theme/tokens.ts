const hexToNumber = (hex: string): number => Number.parseInt(hex.replace('#', ''), 16);

// Spotify-style "content-first darkness": the UI recedes into a near-black
// neutral cocoon so the four UNO card colors are the only thing that sings.
// The four card hues are deliberately pushed to high-saturation/neon so they
// "explode" off the deep background without polluting the chrome.
export const theme = {
  colors: {
    bg: {
      canvas: '#0B0910',
      game: '#100C18',
    },
    surface: {
      panel: '#1A1626',
      panelBorder: '#2E2742',
      card: '#211B30',
      cardAlt: '#2A2240',
      raised: '#332A4A',
      disabled: '#221E2C',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#C7BEE3',
      muted: '#9A8FBC',
      subtle: '#73698F',
      inverse: '#FFFFFF',
      success: '#DAFFE7',
      onLight: '#1F2937',
    },
    decor: {
      cardBackLeft: '#241C38',
      cardBackRight: '#3A2D5C',
      sparkle: '#C4B4FF',
      glowWarm: '#F4A73A',
      shadowDeep: '#040308',
      overlay: '#000000',
    },
    action: {
      primary: {
        base: '#8B45FF',
        hover: '#9D5CFF',
        border: '#B488FF',
        shadow: '#2A1450',
      },
      secondary: {
        base: '#3F2A66',
        hover: '#4E357E',
        border: '#674C9C',
        shadow: '#160E26',
      },
      danger: {
        base: '#E0455C',
        hover: '#F2596F',
        border: '#FF8294',
        shadow: '#3A1019',
      },
      neutral: {
        base: '#241D34',
        hover: '#2F2645',
        border: '#453959',
        shadow: '#100B19',
      },
    },
    status: {
      success: '#3BE585',
      danger: '#FF5C6E',
      info: '#C4B4FF',
    },
    // The four UNO hues — neon-bright so they detonate against the near-black
    // canvas (Spotify "let the content provide the color").
    card: {
      red: '#E62E4D',
      green: '#1FE07A',
      blue: '#2A77E0',
      yellow: '#FFD21F',
      wild: '#1A1426',
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
      onLight: hexToNumber(theme.colors.text.onLight),
    },
    decor: {
      cardBackLeft: hexToNumber(theme.colors.decor.cardBackLeft),
      cardBackRight: hexToNumber(theme.colors.decor.cardBackRight),
      sparkle: hexToNumber(theme.colors.decor.sparkle),
      glowWarm: hexToNumber(theme.colors.decor.glowWarm),
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

// Mirrors `theme` 1:1 so the DOM lobby / style.css never need hardcoded
// fallbacks to stay in sync with the canvas (Phaser) side.
export const themeCssVariables: Record<string, string> = {
  '--color-bg-canvas': theme.colors.bg.canvas,
  '--color-bg-game': theme.colors.bg.game,
  '--color-surface-panel': theme.colors.surface.panel,
  '--color-surface-panel-border': theme.colors.surface.panelBorder,
  '--color-surface-card': theme.colors.surface.card,
  '--color-surface-card-alt': theme.colors.surface.cardAlt,
  '--color-surface-raised': theme.colors.surface.raised,
  '--color-surface-disabled': theme.colors.surface.disabled,
  '--color-text-primary': theme.colors.text.primary,
  '--color-text-secondary': theme.colors.text.secondary,
  '--color-text-muted': theme.colors.text.muted,
  '--color-text-subtle': theme.colors.text.subtle,
  '--color-text-inverse': theme.colors.text.inverse,
  '--color-text-on-light': theme.colors.text.onLight,
  '--color-decor-glow-warm': theme.colors.decor.glowWarm,
  '--color-action-primary': theme.colors.action.primary.base,
  '--color-action-primary-hover': theme.colors.action.primary.hover,
  '--color-action-primary-border': theme.colors.action.primary.border,
  '--color-action-secondary': theme.colors.action.secondary.base,
  '--color-action-danger': theme.colors.action.danger.base,
  '--color-status-success': theme.colors.status.success,
  '--color-status-danger': theme.colors.status.danger,
  '--color-card-red': theme.colors.card.red,
  '--color-card-green': theme.colors.card.green,
  '--color-card-blue': theme.colors.card.blue,
  '--color-card-yellow': theme.colors.card.yellow,
};

export function applyThemeCssVariables(root: HTMLElement = document.documentElement): void {
  Object.entries(themeCssVariables).forEach(([token, value]) => {
    root.style.setProperty(token, value);
  });
}