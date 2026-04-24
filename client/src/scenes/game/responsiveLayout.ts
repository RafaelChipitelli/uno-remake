type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export type ResponsiveGameLayout = {
  breakpoint: Breakpoint;
  compact: boolean;
  fontScale: number;
  hudWidth: number;
  hudMargin: number;
  hudPadding: number;
  stagePadding: number;
  handBottomOffset: number;
  tableCardScale: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getResponsiveGameLayout(width: number, height: number): ResponsiveGameLayout {
  const breakpoint: Breakpoint = width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
  const compact = breakpoint !== 'desktop' || height < 720;

  const hudMargin = breakpoint === 'mobile' ? 10 : breakpoint === 'tablet' ? 14 : 24;
  const minStageWidth = breakpoint === 'mobile' ? 240 : 170;
  const maxHudForViewport = width - minStageWidth - hudMargin * 3;
  const baseHudWidth = width * (breakpoint === 'mobile' ? 0.28 : breakpoint === 'tablet' ? 0.33 : 0.28);
  const minHudWidth = breakpoint === 'mobile' ? 96 : 140;
  const hudWidth = clamp(baseHudWidth, minHudWidth, Math.max(minHudWidth + 12, maxHudForViewport));
  const hudPadding = clamp(hudWidth * 0.08, 10, 24);

  const shortestSide = Math.min(width, height);
  const fontScale = clamp(shortestSide / 900, 0.72, 1);

  const stagePadding = clamp(height * 0.16, 84, 150);
  const handBottomOffset = clamp(height * 0.11, 58, 110);
  const tableCardScale = clamp(shortestSide / 760, 0.72, 1);

  return {
    breakpoint,
    compact,
    fontScale,
    hudWidth,
    hudMargin,
    hudPadding,
    stagePadding,
    handBottomOffset,
    tableCardScale,
  };
}