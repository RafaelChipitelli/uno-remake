type ModalButtonTone = 'primary' | 'secondary' | 'danger' | 'ghost';

type ModalButtonConfig<T> = {
  label: string;
  value: T;
  tone?: ModalButtonTone;
};

type BaseModalOptions<T> = {
  title: string;
  message?: string;
  buttons: ModalButtonConfig<T>[];
  withTextInput?: {
    placeholder?: string;
    initialValue?: string;
  };
};

type ModalResult<T> = {
  value: T;
  textInputValue?: string;
};

function createButtonClass(tone: ModalButtonTone | undefined): string {
  const suffix = tone ?? 'primary';
  return `ui-modal-btn ui-modal-btn--${suffix}`;
}

function renderModal<T>(options: BaseModalOptions<T>): Promise<ModalResult<T>> {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'ui-modal-root';

    const overlay = document.createElement('div');
    overlay.className = 'ui-modal-overlay';

    const panel = document.createElement('div');
    panel.className = 'ui-modal-panel';

    const title = document.createElement('h2');
    title.className = 'ui-modal-title';
    title.textContent = options.title;

    panel.appendChild(title);

    if (options.message) {
      const message = document.createElement('p');
      message.className = 'ui-modal-message';
      message.textContent = options.message;
      panel.appendChild(message);
    }

    let textInput: HTMLInputElement | undefined;
    if (options.withTextInput) {
      textInput = document.createElement('input');
      textInput.className = 'ui-modal-input';
      textInput.type = 'text';
      textInput.placeholder = options.withTextInput.placeholder ?? '';
      textInput.value = options.withTextInput.initialValue ?? '';
      panel.appendChild(textInput);
      setTimeout(() => textInput?.focus(), 20);
    }

    const actions = document.createElement('div');
    actions.className = 'ui-modal-actions';

    const close = (result: ModalResult<T>) => {
      root.remove();
      resolve(result);
    };

    options.buttons.forEach((buttonConfig) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = createButtonClass(buttonConfig.tone);
      button.textContent = buttonConfig.label;
      button.addEventListener('click', () => {
        close({
          value: buttonConfig.value,
          textInputValue: textInput?.value,
        });
      });
      actions.appendChild(button);
    });

    panel.appendChild(actions);
    root.append(overlay, panel);
    document.body.appendChild(root);

    if (textInput) {
      textInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          const primaryButton = options.buttons[0];
          if (!primaryButton) return;
          close({
            value: primaryButton.value,
            textInputValue: textInput?.value,
          });
        }
      });
    }
  });
}

export async function askTextInput(options: {
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}): Promise<string | undefined> {
  const result = await renderModal<boolean>({
    title: options.title,
    message: options.message,
    withTextInput: {
      placeholder: options.placeholder,
      initialValue: options.initialValue,
    },
    buttons: [
      { label: options.confirmLabel ?? 'Confirmar', value: true, tone: 'primary' },
      { label: options.cancelLabel ?? 'Cancelar', value: false, tone: 'ghost' },
    ],
  });

  if (!result.value) {
    return undefined;
  }

  return result.textInputValue?.trim();
}

export async function askConfirmation(options: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: ModalButtonTone;
}): Promise<boolean> {
  const result = await renderModal<boolean>({
    title: options.title,
    message: options.message,
    buttons: [
      { label: options.confirmLabel ?? 'Confirmar', value: true, tone: options.confirmTone ?? 'primary' },
      { label: options.cancelLabel ?? 'Cancelar', value: false, tone: 'ghost' },
    ],
  });

  return result.value;
}