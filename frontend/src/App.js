import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { ProtectedRoute } from './components/Shared';
import Login         from './pages/Login';
import Register      from './pages/Register';
import Dashboard     from './pages/Dashboard';
import Customers     from './pages/Customers';
import Products      from './pages/Products';
import Subscriptions from './pages/Subscriptions';
import Reports       from './pages/Reports';
import FYReport      from './pages/FYReport';
import FYExpiryReport from './pages/FYExpiryReport';
import CustomerProfile from './pages/CustomerProfile';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"              element={<Navigate to="/dashboard" replace />} />
          <Route path="/login"         element={<Login />} />
          <Route path="/register"      element={<Register />} />
          <Route path="/dashboard"     element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/customers"     element={<ProtectedRoute><Customers /></ProtectedRoute>} />
          <Route path="/customers/:id" element={<ProtectedRoute><CustomerProfile /></ProtectedRoute>} />
          <Route path="/products"      element={<ProtectedRoute><Products /></ProtectedRoute>} />
          <Route path="/subscriptions" element={<ProtectedRoute><Subscriptions /></ProtectedRoute>} />
          <Route path="/reports"       element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/fy-report"     element={<ProtectedRoute><FYReport /></ProtectedRoute>} />
          <Route path="/fy-expiry"     element={<ProtectedRoute><FYExpiryReport /></ProtectedRoute>} />
          <Route path="*"              element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
