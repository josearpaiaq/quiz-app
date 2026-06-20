import { useState, useCallback } from 'react';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const raw = sessionStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ accessToken: string; user: User }>('/auth/login', { email, password });
    sessionStorage.setItem('access_token', data.accessToken);
    sessionStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ accessToken: string; user: User }>('/auth/register', { email, password });
    sessionStorage.setItem('access_token', data.accessToken);
    sessionStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout', {}).catch(() => {});
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('user');
    setUser(null);
  }, []);

  return { user, login, register, logout };
}
