import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../api';
import { useAuth } from '../AuthContext';
import '../styles/global.css';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:'', email:'', password:'' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const r = await registerUser(form);
      login(r.data.user, r.data.token);
      navigate('/dashboard');
    } catch (err) { setError(err.response?.data?.message || 'Something went wrong.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="auth-logo">◎</span>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-sub">Start managing subscriptions</p>
        {error && <div className="form-error">{error}</div>}
        <form className="auth-form" onSubmit={handle}>
          {[['name','text','Full Name','Your name'],['email','email','Email Address','you@example.com'],['password','password','Password','Min. 6 characters']].map(([n,t,l,p])=>(
            <div key={n} className="form-group">
              <label className="form-label">{l}</label>
              <input className="form-input" type={t} placeholder={p} value={form[n]} onChange={e=>setForm({...form,[n]:e.target.value})} required />
            </div>
          ))}
          <button className="btn-save" type="submit" disabled={loading} style={{marginTop:'0.5rem'}}>
            {loading ? <span className="spinner-sm"/> : 'Create Account'}
          </button>
        </form>
        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
