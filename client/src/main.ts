import { applyThemeCssVariables } from './theme/tokens';
import { mountTitleScreen, type TitleScreenHandle } from './ui/titleScreen';
import { bootGame, setReturnHandler } from './game/boot';
import './style.css';

applyThemeCssVariables();

const root = document.getElementById('app');
if (!root) {
  throw new Error('Elemento #app não encontrado.');
}

let title: TitleScreenHandle | null = null;

function showTitle(): void {
  title = mountTitleScreen(root as HTMLElement, (launch) => {
    title?.destroy();
    title = null;
    void bootGame(launch);
  });
}

setReturnHandler(showTitle);
showTitle();
