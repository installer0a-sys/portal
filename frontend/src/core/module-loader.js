const moduleCache = new Map();

export const moduleLoader = {
  async load(name, loader) {
    if (moduleCache.has(name)) return moduleCache.get(name);

    const promise = Promise.resolve()
      .then(loader)
      .catch((error) => {
        moduleCache.delete(name);
        throw error;
      });

    moduleCache.set(name, promise);
    return promise;
  },

  prefetch(name, loader) {
    if (moduleCache.has(name)) return;
    this.load(name, loader).catch(() => {});
  },

  has(name) {
    return moduleCache.has(name);
  },

  clear(name) {
    if (name) moduleCache.delete(name);
    else moduleCache.clear();
  }
};
