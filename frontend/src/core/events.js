const events = new Map();

export const eventBus = {
  on(eventName, handler) {
    if (!events.has(eventName)) {
      events.set(eventName, new Set());
    }

    events.get(eventName).add(handler);

    return () => {
      events.get(eventName)?.delete(handler);
    };
  },

  emit(eventName, payload) {
    events.get(eventName)?.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Event handler error: ${eventName}`, error);
      }
    });
  },

  clear(eventName) {
    if (eventName) {
      events.delete(eventName);
      return;
    }

    events.clear();
  }
};
