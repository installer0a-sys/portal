import {
  developerConsole
} from '../core/developer-console.js';
import {
  Portal
} from '../sdk/portal-sdk.js';

let installed = false;

function handleKeyboard(event) {
  if (event.key === 'Escape') {
    if (developerConsole.isOpen()) {
      event.preventDefault();
      developerConsole.close();
    }

    return;
  }

  if (
    !event.ctrlKey ||
    !event.shiftKey
  ) {
    return;
  }

  const key =
    String(event.key || '')
      .toLowerCase();

  if (key === 'd') {
    event.preventDefault();
    developerConsole.toggle('system');
  }

  if (key === 'l') {
    event.preventDefault();
    developerConsole.open('logs');
  }

  if (key === 'q') {
    event.preventDefault();
    developerConsole.open('queue');
  }
}

function handleCoreTestClick(event) {
  const trigger =
    event.target?.closest?.(
      '#open-core-test'
    );

  if (!trigger) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  developerConsole.open('system');
}

export function installDevTools() {
  if (installed) {
    return;
  }

  installed = true;

  document.addEventListener(
    'keydown',
    handleKeyboard
  );

  document.addEventListener(
    'click',
    handleCoreTestClick,
    true
  );

  Portal.devConsole =
    developerConsole;

  window.Portal =
    Portal;
}

installDevTools();
