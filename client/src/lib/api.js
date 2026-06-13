const API = import.meta.env.VITE_API_URL || "";

// Absolute URL for a server path — used for file downloads (e.g. the Excel
// export) where we hand the browser a real link instead of fetching JSON.
export function apiUrl(path) {
  return `${API}${path}`;
}

export async function getJSON(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function postJSON(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}
