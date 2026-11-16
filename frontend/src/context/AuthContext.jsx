import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/endpoints.js';
import { setCsrfToken, setUnauthenticatedHandler } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous
  // Why the user is anonymous: 'initial' | 'expired' | 'signed_out'. Only an expired
  // session returns the next sign-in to the page the user was on.
  const [anonymousReason, setAnonymousReason] = useState('initial');

  const clear = useCallback(
    (reason) => {
      setUser(null);
      setCsrfToken(null);
      setAnonymousReason(reason);
      setStatus('anonymous');
      queryClient.clear();
    },
    [queryClient],
  );

  useEffect(() => {
    setUnauthenticatedHandler(() => clear('expired'));
    authApi
      .me()
      .then((data) => {
        setCsrfToken(data.csrfToken);
        setUser(data.user);
        setStatus('authenticated');
      })
      .catch(() => setStatus('anonymous'));
  }, [clear]);

  const login = useCallback(async (credentials) => {
    const data = await authApi.login(credentials);
    setCsrfToken(data.csrfToken);
    queryClient.clear();
    setUser(data.user);
    setStatus('authenticated');
    return data.user;
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clear('signed_out');
    }
  }, [clear]);

  const value = useMemo(
    () => ({
      user,
      status,
      anonymousReason,
      login,
      logout,
      setUser,
      isAdmin: user?.role === 'admin',
      isStaff: user?.role === 'admin' || user?.role === 'it_support',
      hasRole: (...roles) => roles.includes(user?.role),
    }),
    [user, status, anonymousReason, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
