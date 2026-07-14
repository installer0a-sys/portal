const MAX_LOGS = 100;
const logs = [];

function add(level, message, context = null) {
  const item = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context
  };

  logs.push(item);

  if (logs.length > MAX_LOGS) {
    logs.shift();
  }

  const method =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : console.log;

  method(`[Portal ${level}] ${message}`, context || '');
}

export const logger = {
  info(message, context) {
    add('info', message, context);
  },

  warn(message, context) {
    add('warn', message, context);
  },

  error(message, context) {
    add('error', message, context);
  },

  getLogs() {
    return [...logs];
  },

  clear() {
    logs.length = 0;
  }
};
