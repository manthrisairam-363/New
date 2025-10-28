// src/api.js
const API_BASE =
  process.env.NODE_ENV === "production"
    ? "new-production-f59b.up.railway.app"   // e.g., https://railway.com/project/81254759-2843-4e43-a888-25ee6fec8a33
    : "";                               // proxy will route to http://localhost:5000

export const apiFetch = (path, options) =>
  fetch(`${API_BASE}${path}`, options);
