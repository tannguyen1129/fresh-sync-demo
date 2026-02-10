'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

// Define minimal user type based on backend response
interface User {
  id: string;
  email: string;
  name: string;
  role: 'PORT_OPERATOR' | 'LOGISTICS_COORDINATOR' | 'TRUCK_DRIVER' | 'PORT_AUTHORITY' | 'ADMIN';
  companyId: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load User on Mount
  useEffect(() => {
    const initAuth = async () => {
      const token = Cookies.get('accessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data);
      } catch (error) {
        Cookies.remove('accessToken');
        Cookies.remove('refreshToken');
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      
      // Store tokens (Demo: Cookie or LocalStorage)
      Cookies.set('accessToken', data.accessToken, { expires: 1/24 }); // 1 hour
      Cookies.set('refreshToken', data.refreshToken, { expires: 7 });

      // Fetch user profile immediately
      const meResponse = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${data.accessToken}` }
      });
      
      const userData = meResponse.data;
      setUser(userData);

      // Redirect based on Role
      switch (userData.role) {
        case 'PORT_OPERATOR': router.push('/operator/dashboard'); break;
        case 'LOGISTICS_COORDINATOR': router.push('/business/dashboard'); break;
        case 'TRUCK_DRIVER': router.push('/driver/dashboard'); break;
        case 'PORT_AUTHORITY': router.push('/authority/dashboard'); break;
        default: router.push('/');
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};