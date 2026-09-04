const normalizeBackendUrl = (url: string) => url.replace(/\/+$/, "");

export const getBackendUrl = () => {
    const env = (window as unknown as { __ENV__?: { CONDUCTOR_URL?: string } }).__ENV__;
    if (env && env.CONDUCTOR_URL) {
      return normalizeBackendUrl(env.CONDUCTOR_URL);
    }
  
    // Fallback to build-time env variable (VITE_ prefix required for Vite)
    return normalizeBackendUrl(import.meta.env.CONDUCTOR_URL || 'http://localhost:8080');
  };