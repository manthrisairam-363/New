// ✅ src/api.js
const API_BASE =
  process.env.NODE_ENV === "production"
    ? ""                        // Or your future prod base URL
    : "http://localhost:8080";  // Your local backend URL for dev

export const apiFetch = (path, options) =>
  fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });