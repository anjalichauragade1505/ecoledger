// src/context/AuthContext.jsx
import { createContext, useContext, useState } from 'react';
import { login as apiLogin } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(!!localStorage.getItem('eco_token'));

  const loginAdmin = async (email, password) => {
    const res = await apiLogin(email, password);
    localStorage.setItem('eco_token', res.data.token);
    setIsAdmin(true);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('eco_token');
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ isAdmin, loginAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
