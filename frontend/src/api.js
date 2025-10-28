// ✅ src/api.js
const API_BASE =
  process.env.NODE_ENV === "production"
    ? "https://new-production-ffd2.up.railway.app"
    : "http://localhost:8080";

export const apiFetch = (path, options) =>
  fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
