import { createContext, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import server from '../environment';
export const AuthContext = createContext({});
export async function apiRequest(path, {
  method = 'GET',
  body,
  authenticated = false
} = {}) {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (authenticated) headers.Authorization = `Bearer ${localStorage.getItem('token') || ''}`;
  let response;
  try {
    response = await fetch(`${server}/api/v1/users${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    throw new Error('Cannot reach Gatherly. Check your connection and that the backend is running.');
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || 'Request failed. Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}
export function AuthProvider({
  children
}) {
  const [userData, setUserData] = useState(null),
    navigate = useNavigate();
  const authenticatedRequest = useCallback(async (path, options = {}) => {
    try {
      return await apiRequest(path, {
        ...options,
        authenticated: true
      });
    } catch (error) {
      if (error.status === 401) {
        localStorage.removeItem('token');
        setUserData(null);
        navigate('/auth', {
          replace: true
        });
      }
      throw error;
    }
  }, [navigate]);
  const handleRegister = useCallback(async (name, username, password) => (await apiRequest('/register', {
    method: 'POST',
    body: {
      name,
      username,
      password
    }
  })).message, []);
  const handleLogin = useCallback(async (username, password) => {
    const data = await apiRequest('/login', {
      method: 'POST',
      body: {
        username,
        password
      }
    });
    localStorage.setItem('token', data.token);
    setUserData(data.user);
    navigate('/home');
  }, [navigate]);
  const getCurrentUser = useCallback(async () => {
    const user = await authenticatedRequest('/me');
    setUserData(user);
    return user;
  }, [authenticatedRequest]);
  const getHistoryOfUser = useCallback(() => authenticatedRequest('/get_all_activity'), [authenticatedRequest]);
  const addToUserHistory = useCallback(code => authenticatedRequest('/add_to_activity', {
    method: 'POST',
    body: {
      meeting_code: code
    }
  }), [authenticatedRequest]);
  const handleLogout = useCallback(async () => {
    await authenticatedRequest('/logout', {
      method: 'POST'
    });
    localStorage.removeItem('token');
    setUserData(null);
    navigate('/auth', {
      replace: true
    });
  }, [authenticatedRequest, navigate]);
  return <AuthContext.Provider value={{
    userData,
    handleLogin,
    handleRegister,
    getCurrentUser,
    getHistoryOfUser,
    addToUserHistory,
    handleLogout
  }}>{children}</AuthContext.Provider>;
}
