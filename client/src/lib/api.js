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
  return sendJSON("POST", path, body);
}

export async function putJSON(path, body) {
  return sendJSON("PUT", path, body);
}

export async function patchJSON(path, body) {
  return sendJSON("PATCH", path, body);
}

export async function del(path) {
  const res = await fetch(`${API}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

// Multipart upload (used for the resume file). Don't set Content-Type — the
// browser adds the multipart boundary for us.
export async function postForm(path, formData) {
  const res = await fetch(`${API}${path}`, { method: "POST", body: formData });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || `Upload failed (${res.status})`);
  }
  return res.json();
}

async function sendJSON(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || `Request failed (${res.status})`);
  }
  return res.json();
}
