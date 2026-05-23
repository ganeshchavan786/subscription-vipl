import React, { createContext, useState, useContext, useEffect } from 'react';
const AuthContext = createContext(null);
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = localStorage.getItem('token'), u = localStorage.getItem('user');
    if (t && u) setUser(JSON.parse(u));
    setLoading(false);
  }, []);
  const login = (u, t) => { setUser(u); localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(u)); };
  const logout = () => { setUser(null); localStorage.removeItem('token'); localStorage.removeItem('user'); };
  return <AuthContext.Provider value={{ user, login, logout, loading }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => useContext(AuthContext);
