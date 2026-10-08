// In the phone app there is no dev proxy,
// so the user types the server address once.
// It is stored on the device.

export const isNative = () =>
  !!window.Capacitor?.isNativePlatform?.();

export const getServer = () =>
  localStorage.getItem('rvs_server') || '';

const compute = () => {
  const server = getServer();

  if (server) {
    return `${server.replace(/\/+$/, '')}/api`;
  }

  return import.meta.env.VITE_API_URL || '/api';
};

let BASE = compute();

export function setServer(url) {
  const v = url.trim();

  if (v) {
    localStorage.setItem(
      'rvs_server',
      v.startsWith('http') ? v : `http://${v}`
    );
  } else {
    localStorage.removeItem('rvs_server');
  }

  BASE = compute();
}

const get = (key) =>
  localStorage.getItem(key);

// ===============================
// Refresh Token
// ===============================

async function refresh() {
  const refreshToken = get('rvs_refresh');

  if (!refreshToken) {
    return false;
  }

  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken,
      }),
    });

    if (!res.ok) {
      return false;
    }

    const data = await res.json();

    localStorage.setItem(
      'rvs_access',
      data.accessToken
    );

    localStorage.setItem(
      'rvs_refresh',
      data.refreshToken
    );

    return true;
  } catch {
    return false;
  }
}

// ===============================
// Main API
// ===============================

export async function api(
  path,
  {
    method = 'GET',
    body,
    retry = true,
  } = {}
) {
  let res;

  try {
    const accessToken = get('rvs_access');

    const headers = {
      'Content-Type': 'application/json',
    };

    // Only send Authorization when token exists.
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body
        ? JSON.stringify(body)
        : undefined,
    });
  } catch (error) {
    console.error('API NETWORK ERROR:', error);

    throw new Error(
      'Network error. Check your connection.'
    );
  }

  // ===============================
  // Token expired
  // ===============================

  if (
    res.status === 401 &&
    retry &&
    (await refresh())
  ) {
    return api(path, {
      method,
      body,
      retry: false,
    });
  }

  // ===============================
  // Response
  // ===============================

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error ||
        `Request failed (${res.status})`
    );
  }

  return data;
}

// ===============================
// File URL
// ===============================

export const fileUrl = (u) => {
  if (/^https?:/.test(u)) {
    return u;
  }

  return (
    BASE.replace(/\/api$/, '') +
    u
  );
};

// ===============================
// Upload
// ===============================

export async function upload(path, form) {
  await api('/auth/me');

  let res;

  try {
    const accessToken = get('rvs_access');

    const headers = {};

    if (accessToken) {
      headers.Authorization =
        `Bearer ${accessToken}`;
    }

    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers,
      body: form,
    });
  } catch (error) {
    console.error(
      'UPLOAD NETWORK ERROR:',
      error
    );

    throw new Error(
      'Network error. Upload failed.'
    );
  }

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error || 'Upload failed'
    );
  }

  return data;
}