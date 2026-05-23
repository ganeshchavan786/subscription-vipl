import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loader-wrap"><div className="spinner"/></div>;
  return user ? children : <Navigate to="/login" replace />;
};

export const Toast = ({ msg }) =>
  msg ? <div className="toast">{msg}</div> : null;

export const ConfirmModal = ({ title, message, onConfirm, onCancel }) => (
  <div className="modal-overlay">
    <div className="confirm-card">
      <h3>{title}</h3>
      <p>{message}</p>
      <div className="modal-foot" style={{border:'none',padding:0,justifyContent:'center'}}>
        <button className="btn-cancel" onClick={onCancel}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm}>Yes, Delete</button>
      </div>
    </div>
  </div>
);

export const useToast = () => {
  const [msg, setMsg] = React.useState('');
  const show = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };
  return [msg, show];
};
