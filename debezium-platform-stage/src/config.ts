/* eslint-disable @typescript-eslint/no-explicit-any */
export const getBackendUrl = () => {
    if ((window as any).__ENV__ && (window as any).__ENV__.CONDUCTOR_URL) {
      return (window as any).__ENV__.CONDUCTOR_URL;
    }
  
    // Fallback to build-time env variable
    return import.meta.env.CONDUCTOR_URL || 'http://localhost:8080';
  };