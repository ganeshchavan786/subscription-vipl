import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { Toast, ConfirmModal, useToast } from '../components/Shared';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../api';
import ImportModal from '../components/ImportModal';

const EMPTY = { name:'', email:'', phone:'', notes:'' };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formErr, setFormErr] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [toast, showToast] = useToast();
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async (q='') => {
    try { const r = await getCustomers(q); setCustomers(r.data.customers); }
    catch { showToast('Failed to load customers.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setTimeout(() => load(search), 350); return () => clearTimeout(t); }, [search, load]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setFormErr(''); setModal(true); };
  const openEdit = c => { setEditing(c); setForm({ name:c.name, email:c.email||'', phone:c.phone||'', notes:c.notes||'' }); setFormErr(''); setModal(true); };

  const handleSave = async e => {
    e.preventDefault(); setFormErr(''); setSaving(true);
    try {
      if (editing) await updateCustomer(editing.id, form);
      else await createCustomer(form);
      setModal(false);
      showToast(editing ? '✅ Customer updated!' : '✅ Customer added!');
      load(search);
    } catch (err) { setFormErr(err.response?.data?.message || 'Error saving.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await deleteCustomer(deleteId); setDeleteId(null); showToast('🗑️ Customer deleted.'); load(search); }
    catch { showToast('Failed to delete.'); setDeleteId(null); }
  };

  const f = k => e => setForm({...form, [k]: e.target.value});

  return (
    <Layout>
      <Toast msg={toast}/>
      {importOpen && <ImportModal type="customers" onClose={() => setImportOpen(false)} onDone={() => { load(); showToast('✅ Customers imported!'); }} />}
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-sub">{customers.length} total customers</p>
        </div>
        <div style={{display:'flex', gap:'0.6rem'}}>
          <button className="btn-ghost" onClick={() => setImportOpen(true)}>📥 Import Excel</button>
          <button className="btn-primary" onClick={openAdd}>+ Add Customer</button>
        </div>
      </div>
      <div className="page-body">
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="search-box">
              <input placeholder="Search by name, email, phone..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
          </div>
        </div>

        {loading ? <div className="loader-wrap"><div className="spinner"/></div>
        : customers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>{search ? 'No customers found' : 'No customers yet'}</h3>
            <p>{search ? 'Try a different search term.' : 'Add your first customer to get started.'}</p>
            {!search && <button className="btn-primary" onClick={openAdd}>+ Add Customer</button>}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Notes</th><th>Actions</th></tr></thead>
              <tbody>
                {customers.map((c,i) => (
                  <tr key={c.id}>
                    <td style={{color:'var(--text2)',width:40}}>{i+1}</td>
                    <td><strong>{c.name}</strong></td>
                    <td style={{color:'var(--text2)'}}>{c.email || '—'}</td>
                    <td style={{color:'var(--text2)'}}>{c.phone || '—'}</td>
                    <td style={{color:'var(--text2)',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.notes || '—'}</td>
                    <td><div className="td-actions">
                      <button className="btn-edit" onClick={()=>openEdit(c)}>✏️ Edit</button>
                      <button className="btn-del"  onClick={()=>setDeleteId(c.id)}>🗑️</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal modal-md">
            <div className="modal-head">
              <h2>{editing ? 'Edit Customer' : 'Add New Customer'}</h2>
              <button className="modal-close" onClick={()=>setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {formErr && <div className="form-error">{formErr}</div>}
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-input" placeholder="John Doe" value={form.name} onChange={f('name')} required autoFocus/>
                  </div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input className="form-input" type="email" placeholder="john@example.com" value={form.email} onChange={f('email')}/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <input className="form-input" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={f('phone')}/>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-textarea" placeholder="Any additional notes..." value={form.notes} onChange={f('notes')}/>
                  </div>
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn-cancel" onClick={()=>setModal(false)}>Cancel</button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? <span className="spinner-sm"/> : (editing ? 'Update Customer' : 'Add Customer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && <ConfirmModal title="🗑️ Delete Customer?" message="This will also delete all their subscriptions. This cannot be undone." onConfirm={handleDelete} onCancel={()=>setDeleteId(null)}/>}
    </Layout>
  );
}
