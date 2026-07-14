import { CONFIG } from './config.js';

export const versionManager = {
  frontendVersion: CONFIG.version,

  getInfo() {
    return {
      frontend: CONFIG.version,
      basePath: CONFIG.basePath,
      runtimeTimestamp: new Date().toISOString()
    };
  }
};
