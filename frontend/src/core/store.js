const state = {
  route: 'dashboard',
  user: null,
  permissions: {},
  networkOnline: navigator.onLine,
  pendingRequests: 0,
  lastError: null,
  appVersion: '0.1.0'
};

const listeners = new Set();

export const store = {
  getState() {
    return { ...state };
  },

  setState(patch) {
    Object.assign(state, patch);

    listeners.forEach((listener) => {
      try {
        listener({ ...state });
      } catch (error) {
        console.error('Store listener error:', error);
      }
    });
  },

  subscribe(listener) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }
};
