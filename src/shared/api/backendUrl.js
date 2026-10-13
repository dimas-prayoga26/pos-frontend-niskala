// Local API, uploads and Socket.IO use the same host as the page via Vite's proxy.
// A separate production API can still be configured with VITE_BACKEND_URL.
export const backendBaseUrl = (
  import.meta.env.VITE_BACKEND_URL || window.location.origin
).replace(/\/+$/, "");
