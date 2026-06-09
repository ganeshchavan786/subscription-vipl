import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Toast, useToast } from '../components/Shared';
import { getSmtpSettings, saveSmtpSettings, testSmtpEmail } from '../api';
import { useAuth } from '../AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [toast, showToast] = useToast();
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [testing, setTesting]   = useState(false);
  const [testTo,  setTestTo]    = useState('');
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({
    host:'', port:'587', secure:false, user:'', pass:'',
    from_name:'SubTrack Pro', from_email:'',
    alert_7day:true, alert_1day:true, alert_expiry:true, notify_admin:false,
  });

  useEffect(() => {
    getSmtpSettings()
      .then(r => { setForm(f => ({...f, ...r.data.smtp})); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const f = k => e => setForm(prev => ({...prev, [k]: e.target.type==='checkbox' ? e.target.checked : e.target.value}));

  const handleSave = async e => {
    e.preventDefault(); setSaving(true);
    try {
      await saveSmtpSettings(form);
      showToast('✅ SMTP settings saved!');
    } catch(err) { showToast('❌ ' + (err.response?.data?.message || 'Failed to save.')); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    if (!testTo) { showToast('Enter test email address.'); return; }
    setTesting(true);
    try {
      await testSmtpEmail({ to: testTo });
      showToast('✅ Test email sent! Check your inbox.');
    } catch(err) { showToast('❌ ' + (err.response?.data?.message || 'Failed to send.')); }
    finally { setTesting(false); }
  };

  if (loading) return <Layout><div className="loader-wrap"><div className="spinner"/></div></Layout>;

  return (
    <Layout>
      <Toast msg={toast}/>
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙ Settings</h1>
          <p className="page-sub">Configure email notifications and alert preferences</p>
        </div>
      </div>

      <div className="page-body" style={{maxWidth:680}}>
        <form onSubmit={handleSave}>

          {/* SMTP Config */}
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',marginBottom:'1.25rem',overflow:'hidden',boxShadow:'var(--shadow-sm)'}}>
            <div style={{padding:'1rem 1.25rem',borderBottom:'1px solid var(--border)',background:'var(--surface2)',display:'flex',alignItems:'center',gap:'0.6rem'}}>
              <span style={{fontSize:'1.1rem'}}>📧</span>
              <div>
                <div style={{fontFamily:'Space Grotesk,sans-serif',fontWeight:700,fontSize:'0.95rem'}}>SMTP Email Configuration</div>
                <div style={{fontSize:'0.75rem',color:'var(--text3)',marginTop:1}}>Password stored with AES-256 encryption</div>
              </div>
            </div>
            <div style={{padding:'1.25rem',display:'flex',flexDirection:'column',gap:'1rem'}}>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">SMTP Host *</label>
                  <input className="form-input" placeholder="smtp.gmail.com" value={form.host} onChange={f('host')} required/>
                </div>
                <div className="form-group">
                  <label className="form-label">Port</label>
                  <input className="form-input" type="number" placeholder="587" value={form.port} onChange={f('port')}/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-check">
                  <input type="checkbox" checked={form.secure} onChange={f('secure')}/>
                  Use SSL/TLS (port 465) — uncheck for STARTTLS (port 587)
                </label>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Username / Email *</label>
                  <input className="form-input" type="email" placeholder="your@gmail.com" value={form.user} onChange={f('user')} required/>
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div style={{position:'relative'}}>
                    <input className="form-input" type={showPass?'text':'password'}
                      placeholder={form.pass==='••••••••'?'Saved (leave blank to keep)':'App password'}
                      value={form.pass==='••••••••'?'':form.pass}
                      onChange={f('pass')}
                      style={{paddingRight:'2.5rem'}}/>
                    <button type="button" onClick={()=>setShowPass(v=>!v)}
                      style={{position:'absolute',right:'0.6rem',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:'0.85rem',color:'var(--text3)'}}>
                      {showPass?'🙈':'👁'}
                    </button>
                  </div>
                  {form.pass==='••••••••' && <div style={{fontSize:'0.7rem',color:'var(--text3)',marginTop:2}}>Password saved — leave blank to keep existing</div>}
                </div>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">From Name</label>
                  <input className="form-input" placeholder="SubTrack Pro" value={form.from_name} onChange={f('from_name')}/>
                </div>
                <div className="form-group">
                  <label className="form-label">From Email</label>
                  <input className="form-input" type="email" placeholder="noreply@yourcompany.com" value={form.from_email} onChange={f('from_email')}/>
                </div>
              </div>

              {/* Gmail hint */}
              <div style={{background:'rgba(37,99,235,0.06)',border:'1px solid rgba(37,99,235,0.2)',borderRadius:'var(--r)',padding:'0.75rem 1rem',fontSize:'0.8rem',color:'var(--text2)'}}>
                <strong style={{color:'var(--blue)'}}>💡 Gmail users:</strong> Use App Password (not your Gmail password).
                Go to Google Account → Security → 2-Step Verification → App passwords
                <br/>Host: <code>smtp.gmail.com</code> · Port: <code>587</code> · SSL: OFF
              </div>
            </div>
          </div>

          {/* Alert Settings */}
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',marginBottom:'1.25rem',overflow:'hidden',boxShadow:'var(--shadow-sm)'}}>
            <div style={{padding:'1rem 1.25rem',borderBottom:'1px solid var(--border)',background:'var(--surface2)',display:'flex',alignItems:'center',gap:'0.6rem'}}>
              <span style={{fontSize:'1.1rem'}}>🔔</span>
              <div style={{fontFamily:'Space Grotesk,sans-serif',fontWeight:700,fontSize:'0.95rem'}}>Renewal Alert Settings</div>
            </div>
            <div style={{padding:'1.25rem',display:'flex',flexDirection:'column',gap:'0.75rem'}}>
              <label className="form-check">
                <input type="checkbox" checked={form.alert_7day} onChange={f('alert_7day')}/>
                Send alert <strong>7 days</strong> before subscription expiry
              </label>
              <label className="form-check">
                <input type="checkbox" checked={form.alert_1day} onChange={f('alert_1day')}/>
                Send alert <strong>1 day</strong> before subscription expiry
              </label>
              <label className="form-check">
                <input type="checkbox" checked={form.alert_expiry} onChange={f('alert_expiry')}/>
                Send alert on <strong>expiry day</strong>
              </label>
              <div style={{borderTop:'1px solid var(--border)',paddingTop:'0.75rem',marginTop:'0.25rem'}}>
                <label className="form-check">
                  <input type="checkbox" checked={form.notify_admin} onChange={f('notify_admin')}/>
                  Also send alerts to admin account (<strong>{user?.email}</strong>)
                </label>
              </div>
              <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'0.65rem 0.85rem',fontSize:'0.78rem',color:'var(--text3)'}}>
                📅 Alerts run daily at <strong>9:00 AM</strong> automatically. Customer emails are used from their profile.
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div style={{display:'flex',gap:'0.75rem',marginBottom:'1.25rem'}}>
            <button type="submit" className="btn-save" disabled={saving} style={{flex:1}}>
              {saving ? <span className="spinner-sm"/> : '💾 Save Settings'}
            </button>
          </div>
        </form>

        {/* Test Email */}
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'1.25rem',boxShadow:'var(--shadow-sm)'}}>
          <div style={{fontFamily:'Space Grotesk,sans-serif',fontWeight:700,fontSize:'0.9rem',marginBottom:'0.75rem'}}>📤 Send Test Email</div>
          <div style={{display:'flex',gap:'0.6rem',alignItems:'center'}}>
            <input className="form-input" type="email" placeholder="test@example.com"
              value={testTo} onChange={e=>setTestTo(e.target.value)} style={{flex:1}}/>
            <button type="button" className="btn-primary" onClick={handleTest} disabled={testing}>
              {testing ? <span className="spinner-sm"/> : '📤 Send Test'}
            </button>
          </div>
          <div style={{fontSize:'0.75rem',color:'var(--text3)',marginTop:'0.5rem'}}>
            Save settings first, then send a test email to verify configuration.
          </div>
        </div>
      </div>
    </Layout>
  );
}
