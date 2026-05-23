import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { Toast, ConfirmModal, useToast } from '../components/Shared';
import { getSubscriptions, createSubscription, updateSubscription, deleteSubscription, renewSubscription, getCustomers, getProducts } from '../api';
import { PayBadge } from './Dashboard';
import ImportModal from '../components/ImportModal';

const PERIODS = [
  { value: 'daily',       label: 'Daily',       sub: '1 day'    },
  { value: 'monthly',     label: 'Monthly',     sub: '1 month'  },
  { value: 'quarterly',   label: 'Quarterly',   sub: '3 months' },
  { value: 'half_yearly', label: 'Half-Yearly', sub: '6 months' },
  { value: 'yearly',      label: 'Yearly',      sub: '1 year'   },
];

const STATUS_BADGE = {
  active:    { cls: 'badge-green',  label: '● Active'    },
  expired:   { cls: 'badge-red',    label: '✕ Expired'   },
  cancelled: { cls: 'badge-gray',   label: '◌ Cancelled' },
};

const fmt = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const today = () => new Date().toISOString().split('T')[0];

const calcEnd = (startDate, period) => {
  if (!startDate) return '';
  const d = new Date(startDate);
  switch (period) {
    case 'daily':       d.setDate(d.getDate() + 1); break;
    case 'monthly':     d.setMonth(d.getMonth() + 1); break;
    case 'quarterly':   d.setMonth(d.getMonth() + 3); break;
    case 'half_yearly': d.setMonth(d.getMonth() + 6); break;
    case 'yearly':      d.setFullYear(d.getFullYear() + 1); break;
    default:            d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split('T')[0];
};

const EMPTY_FORM = {
  customer_id: '', product_id: '', price: '', num_users: 1,
  billing_period: 'monthly', start_date: today(),
  auto_renewal: false, payment_status: 'unpaid', notes: '', status: 'active',
  is_user_based: true,
  sub_users: [{ user_name: '', start_date: today(), end_date: '', price: '', description: '' }],
};

export default function Subscriptions() {
  const [subs, setSubs]           = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [modal, setModal]         = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [formErr, setFormErr]     = useState('');
  const [deleteId, setDeleteId]   = useState(null);
  const [toast, showToast]        = useToast();
  const [filters, setFilters]     = useState({ status: '', payment_status: '', search: '' });
  const [expandedId, setExpandedId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async (f = filters) => {
    try {
      const params = {};
      if (f.status)         params.status         = f.status;
      if (f.payment_status) params.payment_status = f.payment_status;
      if (f.search)         params.search         = f.search;
      const r = await getSubscriptions(params);
      setSubs(r.data.subscriptions);
    } catch { showToast('Failed to load subscriptions.'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(() => load(filters), 350); return () => clearTimeout(t); }, [filters]);
  useEffect(() => {
    Promise.all([getCustomers(), getProducts()]).then(([c, p]) => {
      setCustomers(c.data.customers);
      setProducts(p.data.products);
    });
  }, []);

  const handleProductChange = (pid) => {
    const product = products.find(p => p.id === parseInt(pid));
    setForm(f => ({ ...f, product_id: pid, price: product ? product.price : '' }));
  };

  // ── Sub-user helpers ──
  const addSubUser = () => {
    setForm(f => {
      const updated = [...f.sub_users, { user_name: '', start_date: today(), end_date: '', price: '', description: '' }];
      const total = updated.reduce((s, u) => s + (parseFloat(u.price) || 0), 0);
      return { ...f, sub_users: updated, num_users: updated.length, price: total || f.price };
    });
  };

  const removeSubUser = (idx) => {
    setForm(f => {
      const updated = f.sub_users.filter((_, i) => i !== idx);
      const total = updated.reduce((s, u) => s + (parseFloat(u.price) || 0), 0);
      return { ...f, sub_users: updated, num_users: updated.length, price: total };
    });
  };

  const updateSubUser = (idx, key, val) => {
    setForm(f => {
      const updated = f.sub_users.map((u, i) => {
        if (i !== idx) return u;
        const newU = { ...u, [key]: val };
        if (key === 'start_date' && val) {
          newU.end_date = calcEnd(val, f.billing_period);
        }
        return newU;
      });
      // Auto-sum total when price changes
      const total = updated.reduce((s, u) => s + (parseFloat(u.price) || 0), 0);
      return { ...f, sub_users: updated, price: total };
    });
  };

  const handlePeriodChange = (period) => {
    setForm(f => ({
      ...f,
      billing_period: period,
      sub_users: f.sub_users.map(u => ({
        ...u,
        end_date: u.start_date ? calcEnd(u.start_date, period) : '',
      })),
    }));
  };

  const openAdd = () => {
    const initUser = { user_name: '', start_date: today(), end_date: calcEnd(today(), 'monthly') };
    setEditing(null);
    setForm({ ...EMPTY_FORM, sub_users: [initUser] });
    setFormErr(''); setModal(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    const existingUsers = (s.sub_users && s.sub_users.length > 0)
      ? s.sub_users.map(u => ({ user_name: u.user_name, start_date: u.start_date, end_date: u.end_date, price: u.price || '', description: u.description || '' }))
      : [{ user_name: '', start_date: s.start_date, end_date: s.end_date, price: s.price || '', description: '' }];
    setForm({
      customer_id:    String(s.customer_id),
      product_id:     String(s.product_id),
      price:          s.price,
      num_users:      existingUsers.length,
      billing_period: s.billing_period,
      start_date:     s.start_date,
      auto_renewal:   !!s.auto_renewal,
      payment_status: s.payment_status,
      notes:          s.notes || '',
      status:         s.status,
      is_user_based:  s.is_user_based !== 0,
      sub_users:      existingUsers,
    });
    setFormErr(''); setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setFormErr(''); setSaving(true);
    if (!form.customer_id) return (setFormErr('Please select a customer.'), setSaving(false));
    if (!form.product_id)  return (setFormErr('Please select a product/service.'), setSaving(false));
    // Validate sub_users only if user-based
    if (form.is_user_based) {
      for (let i = 0; i < form.sub_users.length; i++) {
        const u = form.sub_users[i];
        if (!u.user_name.trim()) return (setFormErr(`User ${i+1}: Name is required.`), setSaving(false));
        if (!u.start_date)       return (setFormErr(`User ${i+1}: Start date is required.`), setSaving(false));
        if (!u.end_date)         return (setFormErr(`User ${i+1}: End date is required.`), setSaving(false));
      }
    } else {
      if (!form.start_date) return (setFormErr('Start date is required.'), setSaving(false));
    }
    try {
      const payload = {
        ...form,
        price:      parseFloat(form.price) || 0,
        num_users:  form.is_user_based ? form.sub_users.length : 0,
        start_date: form.is_user_based ? (form.sub_users[0]?.start_date || form.start_date) : form.start_date,
        sub_users:  form.is_user_based ? form.sub_users : [],
      };
      if (editing) await updateSubscription(editing.id, payload);
      else         await createSubscription(payload);
      setModal(false);
      showToast(editing ? '✅ Subscription updated!' : '✅ Subscription created!');
      load(filters);
    } catch (err) { setFormErr(err.response?.data?.message || 'Error saving.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await deleteSubscription(deleteId); setDeleteId(null); showToast('🗑️ Deleted.'); load(filters); }
    catch { showToast('Failed to delete.'); setDeleteId(null); }
  };

  const handleRenew = async (id) => {
    try { await renewSubscription(id); showToast('✅ Renewed!'); load(filters); }
    catch { showToast('Failed to renew.'); }
  };

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const f = k => e => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const daysLeft = (endDate) => Math.ceil((new Date(endDate) - new Date()) / (1000*60*60*24));

  return (
    <Layout>
      <Toast msg={toast} />
      {importOpen && <ImportModal type="subscriptions" onClose={() => setImportOpen(false)} onDone={() => { load(); showToast('✅ Subscriptions imported!'); }} />}
      <div className="page-header">
        <div>
          <h1 className="page-title">Subscriptions</h1>
          <p className="page-sub">{subs.length} subscription{subs.length !== 1 ? 's' : ''} found</p>
        </div>
        <div style={{display:'flex', gap:'0.6rem'}}>
          <button className="btn-ghost" onClick={() => setImportOpen(true)}>📥 Import Excel</button>
          <button className="btn-primary" onClick={openAdd}>+ New Subscription</button>
        </div>
      </div>

      <div className="page-body">
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="search-box">
              <input placeholder="Search customer or service..."
                value={filters.search} onChange={e => setFilter('search', e.target.value)} />
            </div>
            <select className="filter-select" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select className="filter-select" value={filters.payment_status} onChange={e => setFilter('payment_status', e.target.value)}>
              <option value="">All Payments</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
            </select>
          </div>
        </div>

        {loading ? <div className="loader-wrap"><div className="spinner" /></div>
        : subs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">♻</div>
            <h3>No subscriptions found</h3>
            <p>Try clearing filters or add a new subscription.</p>
            <button className="btn-primary" onClick={openAdd}>+ New Subscription</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{width:32}}></th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Users</th>
                  <th>Price</th>
                  <th>Billing</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map(s => {
                  const sb = STATUS_BADGE[s.status] || STATUS_BADGE.expired;
                  const isExpanded = expandedId === s.id;
                  const userCount = s.sub_users?.length || s.num_users || 1;
                  return (
                    <React.Fragment key={s.id}>
                      <tr>
                        {/* Expand toggle */}
                        <td style={{textAlign:'center', cursor:'pointer', color:'var(--text3)', fontSize:'0.8rem'}}
                          onClick={() => setExpandedId(isExpanded ? null : s.id)}>
                          {isExpanded ? '▼' : '▶'}
                        </td>
                        <td>
                          <div style={{fontWeight:600}}>{s.customer_name}</div>
                          {s.customer_phone && <div style={{fontSize:'0.72rem',color:'var(--text3)'}}>{s.customer_phone}</div>}
                        </td>
                        <td style={{fontWeight:500}}>{s.product_name}</td>
                        <td>
                          <span className="badge badge-blue" style={{cursor:'pointer'}}
                            onClick={() => setExpandedId(isExpanded ? null : s.id)}>
                            👤 {userCount} {userCount === 1 ? 'User' : 'Users'}
                          </span>
                        </td>
                        <td style={{fontWeight:600, color:'var(--accent)'}}>{fmt(s.price)}</td>
                        <td>
                          <span className="badge badge-purple">
                            {PERIODS.find(p => p.value === s.billing_period)?.label || s.billing_period}
                          </span>
                        </td>
                        <td><span className={`badge ${sb.cls}`}>{sb.label}</span></td>
                        <td><PayBadge status={s.payment_status} /></td>
                        <td>
                          <div className="td-actions">
                            <button className="btn-edit" onClick={() => openEdit(s)}>✏️ Edit</button>
                            {(s.status === 'expired' || s.status === 'cancelled') && (
                              <button className="btn-renew" onClick={() => handleRenew(s.id)}>↻</button>
                            )}
                            <button className="btn-del" onClick={() => setDeleteId(s.id)}>🗑️</button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded user rows */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} style={{padding:0, background:'#f8fafc', borderBottom:'2px solid var(--border)'}}>
                            <div style={{padding:'0.75rem 1.5rem 0.75rem 3rem'}}>
                              {s.is_user_based === 0 ? (
                                // Non-user-based: show contract details
                                <div style={{display:'flex',flexDirection:'column',gap:'0.4rem'}}>
                                  <div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.35rem'}}>
                                    📋 Contract / AMC Details
                                  </div>
                                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1rem'}}>
                                    <div><span style={{fontSize:'0.7rem',color:'var(--text3)',fontWeight:600,textTransform:'uppercase'}}>Start Date</span><div style={{fontWeight:600,marginTop:2}}>{s.start_date}</div></div>
                                    <div><span style={{fontSize:'0.7rem',color:'var(--text3)',fontWeight:600,textTransform:'uppercase'}}>End Date</span><div style={{fontWeight:600,marginTop:2}}>{s.end_date}</div></div>
                                    <div><span style={{fontSize:'0.7rem',color:'var(--text3)',fontWeight:600,textTransform:'uppercase'}}>Price</span><div style={{fontWeight:700,color:'var(--accent)',marginTop:2}}>{fmt(s.price)}</div></div>
                                  </div>
                                  {s.notes && <div style={{marginTop:'0.5rem'}}><span style={{fontSize:'0.7rem',color:'var(--text3)',fontWeight:600,textTransform:'uppercase'}}>Notes</span><div style={{fontSize:'0.85rem',color:'var(--text2)',marginTop:2,whiteSpace:'pre-wrap'}}>{s.notes}</div></div>}
                                </div>
                              ) : (
                                <table style={{width:'100%',borderCollapse:'collapse'}}>
                                <thead>
                                  <tr style={{background:'var(--surface3)'}}>
                                    <th style={thS}>#</th>
                                    <th style={thS}>User Name</th>
                                    <th style={thS}>Start Date</th>
                                    <th style={thS}>End Date</th>
                                    <th style={thS}>Price</th>
                                    <th style={thS}>Days Left</th>
                                    <th style={thS}>Status</th>
                                    <th style={thS}>Description</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(s.sub_users && s.sub_users.length > 0) ? s.sub_users.map((u, i) => {
                                    const dl = daysLeft(u.end_date);
                                    const expired = dl < 0;
                                    const expiringSoon = dl >= 0 && dl <= 7;
                                    return (
                                      <tr key={i} style={{borderBottom:'1px solid var(--border)'}}>
                                        <td style={tdS}>{i+1}</td>
                                        <td style={{...tdS, fontWeight:600}}>{u.user_name}</td>
                                        <td style={tdS}>{u.start_date}</td>
                                        <td style={tdS}>{u.end_date}</td>
                                        <td style={{...tdS, fontWeight:700, color:'var(--accent)'}}>
                                          {u.price ? fmt(u.price) : '—'}
                                        </td>
                                        <td style={tdS}>
                                          {expired
                                            ? <span style={{color:'var(--red)',fontWeight:600}}>Expired</span>
                                            : expiringSoon
                                              ? <span style={{color:'var(--yellow)',fontWeight:600}}>⏳ {dl}d left</span>
                                              : <span style={{color:'var(--green)',fontWeight:600}}>{dl}d left</span>
                                          }
                                        </td>
                                        <td style={tdS}>
                                          {expired
                                            ? <span className="badge badge-red">Expired</span>
                                            : <span className="badge badge-green">Active</span>
                                          }
                                        </td>
                                        <td style={{...tdS, color:'var(--text2)', maxWidth:200, whiteSpace:'pre-wrap', fontSize:'0.78rem'}}>
                                          {u.description || '—'}
                                        </td>
                                      </tr>
                                    );
                                  }) : (
                                    <tr><td colSpan={8} style={{...tdS, color:'var(--text3)', textAlign:'center'}}>No user details added</td></tr>
                                  )}
                                  {/* Total row */}
                                  {s.sub_users && s.sub_users.length > 0 && (
                                    <tr style={{background:'var(--accent-dim)'}}>
                                      <td colSpan={4} style={{...tdS, fontWeight:700, textAlign:'right', color:'var(--text2)'}}>Total</td>
                                      <td style={{...tdS, fontWeight:800, color:'var(--accent)'}}>
                                        {fmt(s.sub_users.reduce((sum, u) => sum + (u.price||0), 0))}
                                      </td>
                                      <td colSpan={3}></td>
                                    </tr>
                                  )}
                                </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal modal-xl">
            <div className="modal-head">
              <h2>{editing ? 'Edit Subscription' : 'New Subscription'}</h2>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {formErr && <div className="form-error">{formErr}</div>}
                <div className="form-grid">

                  {/* Customer + Product */}
                  <div className="form-row-2">
                    <div className="form-group">
                      <label className="form-label">Customer *</label>
                      <select className="form-select" value={form.customer_id} onChange={f('customer_id')} required>
                        <option value="">— Select Customer —</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Service / Product *</label>
                      <select className="form-select" value={form.product_id}
                        onChange={e => handleProductChange(e.target.value)} required>
                        <option value="">— Select Service —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Subscription Type Toggle */}
                  <div style={{
                    display:'flex', alignItems:'center', gap:'1rem',
                    padding:'0.75rem 1rem',
                    background: form.is_user_based ? 'rgba(99,91,255,0.06)' : 'rgba(16,185,129,0.06)',
                    border: `1px solid ${form.is_user_based ? 'rgba(99,91,255,0.2)' : 'rgba(16,185,129,0.2)'}`,
                    borderRadius:'var(--r)'
                  }}>
                    <span style={{fontSize:'1.1rem'}}>{form.is_user_based ? '👤' : '📋'}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600, fontSize:'0.875rem', color:'var(--text)'}}>
                        {form.is_user_based ? 'User-based Subscription' : 'Non-user Subscription (AMC / Contract)'}
                      </div>
                      <div style={{fontSize:'0.75rem', color:'var(--text3)', marginTop:'2px'}}>
                        {form.is_user_based
                          ? 'Each user has their own start date, end date & price (e.g. Tally, Software licenses)'
                          : 'Single contract — no individual users (e.g. AMC, Domain, Hosting, Hardware)'}
                      </div>
                    </div>
                    <label style={{display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer',flexShrink:0}}>
                      <span style={{fontSize:'0.8rem',color:'var(--text2)',fontWeight:500}}>
                        {form.is_user_based ? 'User-based' : 'Non-user'}
                      </span>
                      <div
                        onClick={() => setForm(prev => ({ ...prev, is_user_based: !prev.is_user_based }))}
                        style={{
                          width:40, height:22, borderRadius:11,
                          background: form.is_user_based ? 'var(--accent)' : 'var(--border2)',
                          position:'relative', cursor:'pointer', transition:'background 0.2s',
                          flexShrink:0
                        }}>
                        <div style={{
                          position:'absolute', top:3,
                          left: form.is_user_based ? 21 : 3,
                          width:16, height:16, borderRadius:'50%',
                          background:'white', transition:'left 0.2s',
                          boxShadow:'0 1px 3px rgba(0,0,0,0.2)'
                        }}/>
                      </div>
                    </label>
                  </div>

                  {/* Billing Period */}
                  <div className="form-group">
                    <label className="form-label">Billing Period *</label>
                    <div className="period-pills">
                      {PERIODS.map(p => (
                        <button key={p.value} type="button"
                          className={`period-pill ${form.billing_period === p.value ? 'selected' : ''}`}
                          onClick={() => handlePeriodChange(p.value)}>
                          {p.label} <span style={{opacity:0.55,fontSize:'0.7rem',marginLeft:3}}>({p.sub})</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price + Payment + Status */}
                  <div className="form-row-2">
                    <div className="form-group">
                      <label className="form-label">Total Price (₹) — Auto calculated</label>
                      <input className="form-input" type="number" min="0" step="0.01"
                        placeholder="Auto sum from users below"
                        value={form.price}
                        onChange={f('price')}
                        style={{background:'var(--surface3)', color:'var(--accent)', fontWeight:700}}
                      />
                      <span style={{fontSize:'0.7rem', color:'var(--text3)', marginTop:'2px'}}>
                        Auto-calculated from user prices below. You can also edit manually.
                      </span>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Payment Status</label>
                      <select className="form-select" value={form.payment_status} onChange={f('payment_status')}>
                        <option value="unpaid">Unpaid</option>
                        <option value="paid">Paid</option>
                        <option value="partial">Partial</option>
                      </select>
                    </div>
                  </div>

                  {editing && (
                    <div className="form-group">
                      <label className="form-label">Subscription Status</label>
                      <select className="form-select" value={form.status} onChange={f('status')}>
                        <option value="active">Active</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  )}

                  {/* Auto-renewal */}
                  <div className="form-group">
                    <label className="form-check">
                      <input type="checkbox" checked={form.auto_renewal}
                        onChange={e => setForm(prev => ({ ...prev, auto_renewal: e.target.checked }))} />
                      Enable Auto-Renewal
                    </label>
                  </div>

                  {/* Non-user-based: single start/end date + price + description */}
                  {!form.is_user_based && (
                    <>
                      <div className="form-row-2">
                        <div className="form-group">
                          <label className="form-label">Start Date *</label>
                          <input className="form-input" type="date" value={form.start_date} onChange={f('start_date')} required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">End Date</label>
                          <input className="form-input" type="date"
                            value={form.end_date_override || calcEnd(form.start_date, form.billing_period)}
                            onChange={e => setForm(prev => ({...prev, end_date_override: e.target.value}))}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Description / Notes</label>
                        <textarea className="form-textarea"
                          placeholder="e.g. AMC for 10 computers, includes on-site support, parts not included..."
                          rows={3}
                          value={form.notes} onChange={f('notes')} />
                      </div>
                    </>
                  )}

                  {/* User-based section */}
                  {form.is_user_based && (
                  <div className="form-group">
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.6rem'}}>
                      <label className="form-label" style={{margin:0}}>
                        👤 User-wise Details ({form.sub_users.length} user{form.sub_users.length !== 1 ? 's' : ''})
                      </label>
                      <button type="button" className="btn-ghost btn-sm" onClick={addSubUser}>+ Add User</button>
                    </div>

                    <div style={{display:'flex',flexDirection:'column',gap:'0.65rem'}}>
                      {form.sub_users.map((u, i) => (
                        <div key={i} style={{
                          background:'var(--surface2)',
                          border:'1px solid var(--border)',
                          borderRadius:'var(--r)',
                          overflow:'hidden'
                        }}>
                          {/* User header bar */}
                          <div style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            padding:'0.5rem 0.85rem',
                            background:'var(--surface3)',
                            borderBottom:'1px solid var(--border)'
                          }}>
                            <span style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text2)',textTransform:'uppercase',letterSpacing:'0.07em'}}>
                              👤 User {i+1}
                            </span>
                            <button type="button"
                              style={{background:'var(--red-dim)',border:'1px solid rgba(220,38,38,0.2)',color:'var(--red)',borderRadius:'5px',padding:'2px 8px',cursor:'pointer',fontSize:'0.75rem',fontWeight:600}}
                              onClick={() => removeSubUser(i)}
                              disabled={form.sub_users.length === 1}>
                              ✕ Remove
                            </button>
                          </div>

                          {/* Fields */}
                          <div style={{padding:'0.75rem 0.85rem', display:'flex', flexDirection:'column', gap:'0.6rem'}}>
                            {/* Row 1: Name + Start + End + Price */}
                            <div style={{display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 1fr', gap:'0.6rem'}}>
                              <div className="form-group" style={{margin:0}}>
                                <label className="form-label">Full Name *</label>
                                <input className="form-input" placeholder="e.g. Rahul Sharma"
                                  value={u.user_name}
                                  onChange={e => updateSubUser(i, 'user_name', e.target.value)} />
                              </div>
                              <div className="form-group" style={{margin:0}}>
                                <label className="form-label">Start Date *</label>
                                <input className="form-input" type="date"
                                  value={u.start_date}
                                  onChange={e => updateSubUser(i, 'start_date', e.target.value)} />
                              </div>
                              <div className="form-group" style={{margin:0}}>
                                <label className="form-label">End Date *</label>
                                <input className="form-input" type="date"
                                  value={u.end_date}
                                  onChange={e => updateSubUser(i, 'end_date', e.target.value)} />
                              </div>
                              <div className="form-group" style={{margin:0}}>
                                <label className="form-label">Price (₹)</label>
                                <input className="form-input" type="number" min="0" step="0.01"
                                  placeholder="0"
                                  value={u.price}
                                  onChange={e => updateSubUser(i, 'price', e.target.value)} />
                              </div>
                            </div>

                            {/* Row 2: Description */}
                            <div className="form-group" style={{margin:0}}>
                              <label className="form-label">Description / Notes</label>
                              <textarea className="form-textarea"
                                placeholder="e.g. Tally Prime license, GST module included, Remote access enabled..."
                                rows={2}
                                style={{minHeight:'60px', resize:'vertical'}}
                                value={u.description}
                                onChange={e => updateSubUser(i, 'description', e.target.value)} />
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Total row */}
                      <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:'0.5rem',padding:'0.5rem 0.85rem',background:'var(--accent-dim)',borderRadius:'var(--r)',border:'1px solid rgba(99,91,255,0.15)'}}>
                        <span style={{fontSize:'0.82rem',color:'var(--text2)',fontWeight:500}}>Total Price:</span>
                        <span style={{fontSize:'1.05rem',fontWeight:800,color:'var(--accent)'}}>
                          {new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(
                            form.sub_users.reduce((s,u) => s + (parseFloat(u.price)||0), 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Notes — only for user-based */}
                  {form.is_user_based && (
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-textarea" placeholder="Any additional notes..." value={form.notes} onChange={f('notes')} />
                  </div>
                  )}

                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn-cancel" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? <span className="spinner-sm" /> : (editing ? 'Update Subscription' : 'Create Subscription')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <ConfirmModal
          title="Delete Subscription?"
          message="This will permanently delete the subscription and all user data."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </Layout>
  );
}

// Inline table styles for expanded rows
const thS = { padding:'0.45rem 0.75rem', fontSize:'0.68rem', fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', textAlign:'left', borderBottom:'1px solid var(--border)' };
const tdS = { padding:'0.5rem 0.75rem', fontSize:'0.82rem', color:'var(--text)' };
