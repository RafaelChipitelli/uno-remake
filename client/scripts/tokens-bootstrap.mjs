// Mantem o bloco bootstrap de :root em src/style.css em sincronia com a fonte
// unica de cor (src/theme/tokens.ts). `--fix` reescreve; sem flag, so valida.
//
// Por que existe: o bloco :root evita flash de cor antes de
// applyThemeCssVariables() rodar. Sem este guard, ele e uma segunda copia
// manual da paleta que silenciosamente diverge de tokens.ts.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const tokensPath = join(here, '..', 'src', 'theme', 'tokens.ts');
const cssPath = join(here, '..', 'src', 'style.css');

const START = '/* tokens:bootstrap:start */';
const END = '/* tokens:bootstrap:end */';

// CSS var -> caminho em theme.colors. Subconjunto critico para o pre-paint.
const BOOTSTRAP = [
  ['--color-bg-canvas', 'bg.canvas'],
  ['--color-bg-game', 'bg.game'],
  ['--color-surface-panel', 'surface.panel'],
  ['--color-surface-panel-border', 'surface.panelBorder'],
  ['--color-surface-card', 'surface.card'],
  ['--color-surface-card-alt', 'surface.cardAlt'],
  ['--color-text-primary', 'text.primary'],
  ['--color-text-secondary', 'text.secondary'],
  ['--color-text-muted', 'text.muted'],
  ['--color-text-inverse', 'text.inverse'],
  ['--color-text-on-light', 'text.onLight'],
  ['--color-action-primary', 'action.primary.base'],
  ['--color-action-primary-border', 'action.primary.border'],
  ['--color-action-secondary', 'action.secondary.base'],
  ['--color-status-success', 'status.success'],
  ['--color-status-danger', 'status.danger'],
  ['--color-card-red', 'card.red'],
  ['--color-card-green', 'card.green'],
  ['--color-card-blue', 'card.blue'],
  ['--color-card-yellow', 'card.yellow'],
  ['--color-decor-glow-warm', 'decor.glowWarm'],
];

function parseThemeColors(src) {
  const open = src.indexOf('export const theme = {');
  if (open === -1) throw new Error('nao achei `export const theme` em tokens.ts');
  let depth = 0;
  let end = -1;
  for (let i = src.indexOf('{', open); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  const literal = src.slice(src.indexOf('{', open), end);
  // Object literal valido em JS (aspas simples + trailing commas ok).
  const theme = Function(`"use strict"; return (${literal});`)();
  return theme.colors;
}

const resolve = (obj, path) =>
  path.split('.').reduce((acc, key) => acc[key], obj);

function buildBlock(colors) {
  return BOOTSTRAP.map(([cssVar, path]) => {
    const hex = resolve(colors, path);
    if (typeof hex !== 'string') {
      throw new Error(`token ausente para ${cssVar} (${path})`);
    }
    return `  ${cssVar}: ${hex.toLowerCase()};`;
  }).join('\n');
}

const tokensSrc = await readFile(tokensPath, 'utf8');
const css = await readFile(cssPath, 'utf8');
const expected = buildBlock(parseThemeColors(tokensSrc));

const startIdx = css.indexOf(START);
const endIdx = css.indexOf(END);
if (startIdx === -1 || endIdx === -1) {
  throw new Error(`marcadores ${START} / ${END} nao encontrados em style.css`);
}
const current = css.slice(startIdx + START.length, endIdx).replace(/^\n|\n\s*$/g, '');
const fix = process.argv.includes('--fix');

if (current === expected) {
  console.log('tokens bootstrap: OK (style.css em sincronia com tokens.ts)');
  process.exit(0);
}

if (!fix) {
  console.error('tokens bootstrap: DIVERGENTE de tokens.ts.\n');
  console.error('Esperado:\n' + expected + '\n');
  console.error('Rode `npm run tokens:sync` para corrigir.');
  process.exit(1);
}

const next =
  css.slice(0, startIdx + START.length) + '\n' + expected + '\n  ' + css.slice(endIdx);
await writeFile(cssPath, next);
console.log('tokens bootstrap: style.css regenerado a partir de tokens.ts');
