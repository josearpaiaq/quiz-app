const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

async function parseError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    const msg = json.message;
    return Array.isArray(msg) ? msg.join('\n') : (msg ?? text);
  } catch {
    return text;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem('access_token');
  const isFormData = options?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' });

  if (res.status === 401) {
    const refreshed = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (refreshed.ok) {
      const data = await refreshed.json();
      sessionStorage.setItem('access_token', data.accessToken);
      headers['Authorization'] = `Bearer ${data.accessToken}`;
      const retry = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' });
      if (!retry.ok) throw new Error(await parseError(retry));
      return retry.json();
    } else {
      sessionStorage.removeItem('access_token');
      throw new Error('Unauthorized');
    }
  }

  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  postForm: <T>(path: string, body: FormData) =>
    request<T>(path, { method: 'POST', body }),
  get: <T>(path: string) => request<T>(path),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
