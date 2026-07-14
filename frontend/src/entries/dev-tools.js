import {
  developerConsole
} from '../core/developer-console.js';
import {
  Portal
} from '../sdk/portal-sdk.js';
import {
  installEventBridge
} from '../core/event-bridge.js';
import {
  installCommandBridge
} from '../core/command-bridge.js';

let installed = false;

function handleKeyboard(event) {
  if (event.key === 'Escape') {
    if (
      developerConsole.isOpen()
    ) {
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
    developerConsole.toggle(
      'system'
    );
  }

  if (key === 'l') {
    event.preventDefault();
    developerConsole.open(
      'logs'
    );
  }

  if (key === 'q') {
    event.preventDefault();
    developerConsole.open(
      'queue'
    );
  }

  if (key === 'u') {
    event.preventDefault();

    Portal.commands
      .run(
        'portal.update.check',
        {
          notify: true
        },
        {
          source:
            'keyboard'
        }
      )
      .catch(() => {});
  }
}

function handleCoreTestClick(
  event
) {
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

  developerConsole.open(
    'system'
  );
}

function handleUpdateClick(
  event
) {
  const trigger =
    event.target?.closest?.(
      '#check-update'
    );

  if (!trigger) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  trigger.disabled = true;

  Portal.commands
    .run(
      'portal.update.check',
      {
        notify: true
      },
      {
        source:
          'update-button'
      }
    )
    .finally(() => {
      trigger.disabled = false;
    });
}

export function installDevTools() {
  if (installed) {
    return;
  }

  installed = true;

  installEventBridge();
  installCommandBridge();

  document.addEventListener(
    'keydown',
    handleKeyboard
  );

  document.addEventListener(
    'click',
    handleCoreTestClick,
    true
  );

  document.addEventListener(
    'click',
    handleUpdateClick,
    true
  );

  Portal.devConsole =
    developerConsole;

  window.Portal =
    Portal;
}

installDevTools();
