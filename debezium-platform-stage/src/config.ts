/* eslint-disable @typescript-eslint/no-explicit-any */
const normalizeBackendUrl = (url: string) => url.replace(/\/+$/, "");

export const getBackendUrl = () => {
    if ((window as any).__ENV__ && (window as any).__ENV__.CONDUCTOR_URL) {
      return normalizeBackendUrl((window as any).__ENV__.CONDUCTOR_URL);
    }
  
    // Fallback to build-time env variable (VITE_ prefix required for Vite)
    return normalizeBackendUrl(import.meta.env.CONDUCTOR_URL || 'http://localhost:8080');
  };