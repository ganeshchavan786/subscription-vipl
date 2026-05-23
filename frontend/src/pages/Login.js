import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../api';
import { useAuth } from '../AuthContext';
import '../styles/global.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const r = await loginUser(form);
      login(r.data.user, r.data.token);
      navigate('/dashboard');
    } catch (err) { setError(err.response?.data?.message || 'Something went wrong.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="auth-logo">◎</span>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in to SubTrack Pro</p>
        {error && <div className="form-error">{error}</div>}
        <form className="auth-form" onSubmit={handle}>
          {[['email','email','Email Address','you@example.com'],['password','password','Password','••••••••']].map(([n,t,l,p])=>(
            <div key={n} className="form-group">
              <label className="form-label">{l}</label>
              <input className="form-input" type={t} placeholder={p} value={form[n]} onChange={e=>setForm({...form,[n]:e.target.value})} required />
            </div>
          ))}
          <button className="btn-save" type="submit" disabled={loading} style={{marginTop:'0.5rem'}}>
            {loading ? <span className="spinner-sm"/> : 'Sign In'}
          </button>
        </form>
        <p className="auth-switch">No account? <Link to="/register">Create one</Link></p>
      </div>
    </div>
  );
}
