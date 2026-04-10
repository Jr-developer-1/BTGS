import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from './ToastContext';
import api from '../api/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const { showToast } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [heartbeatData, setHeartbeatData] = useState({
    notifications: [],
    unread_notification_count: 0,
    approval_counts: { total: 0, trips: 0, advances: 0, claims: 0 },
    due_reminders: []
  });

  const login = async (username, password) => {
    try {
      const response = await api.post('/api/auth/login', {
        employee_id: username,
        password
      });

      const { token, user: userDetails, requires_password_change } = response.data;

      // 1. Validate response structure to prevent "partial login" white pages
      if (!token || !userDetails || typeof userDetails !== 'object') {
          console.error("Invalid login response structure:", response.data);
          throw new Error('CORRUPT_RESPONSE');
      }

      const userData = {
        ...userDetails,
        token: token,
        role: userDetails?.role?.toLowerCase() || 'employee',
        requires_password_change: requires_password_change
      };

      setUser(userData);
      sessionStorage.setItem('tgs_user', JSON.stringify(userData));
      return userData;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
        if (user && user.token) {
            await api.post('/api/auth/logout', {}, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
        }
    } catch (error) {
        console.error('Logout failed:', error);
        showToast('Logout failed on server', 'error');
    } finally {
        setUser(null);
        sessionStorage.removeItem('tgs_user');
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const savedUser = sessionStorage.getItem('tgs_user');
      if (savedUser && savedUser !== 'undefined') {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser && parsedUser.token) {
          try {
            // Verify session with backend
            const response = await api.get('/api/auth/me');
            setUser({
              ...response.data,
              token: parsedUser.token,
              role: response.data.role?.toLowerCase()
            });
          } catch (error) {
            console.error('Session verification failed:', error);
            if (!error.response) {
                // Network error - backend is down
                showToast('Backend server is unreachable. Working in offline mode.', 'warning');
                // We keep the limited session data we have to prevent immediate logout if possible, 
                // but mark as offline or just let subsequent requests fail gracefully.
                setUser(parsedUser); 
            } else {
                sessionStorage.removeItem('tgs_user');
                setUser(null);
            }
          }
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const fetchHeartbeat = async () => {
    if (!user || document.visibilityState !== 'visible') return;
    try {
      const response = await api.get('/api/heartbeat');
      setHeartbeatData(response.data);
    } catch (error) {
      console.error("Heartbeat failed:", error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchHeartbeat();
      const interval = setInterval(fetchHeartbeat, 60000); // 1 minute
      return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, heartbeatData, fetchHeartbeat }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
