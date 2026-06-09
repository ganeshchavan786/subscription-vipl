import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { Toast, ConfirmModal, useToast } from '../components/Shared';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, addCustomerContact, deleteCustomerContact } from '../api';
import ImportModal from '../components/ImportModal';
import { useNavigate } from 'react-router-dom';

const EMPTY = { name:'', email:'', phone:'', notes:'', phones:[{value:'',label:'Primary'}], emails:[{value:'',label:'Primary'}] };

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
  const navigate = useNavigate();

  const load = useCallback(async (q='') => {
    try { const r = await getCustomers(q); setCustomers(r.data.customers); }
    catch { showToast('Failed to load customers.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setTimeout(() => load(search), 350); return () => clearTimeout(t); }, [search, load]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setFormErr(''); setModal(true); };
  const openEdit = c => {
    const phones = (c.contacts||[]).filter(x=>x.type==='phone').map(x=>({id:x.id,value:x.value,label:x.label||'',is_primary:x.is_primary}));
    const emails = (c.contacts||[]).filter(x=>x.type==='email').map(x=>({id:x.id,value:x.value,label:x.label||'',is_primary:x.is_primary}));
    setEditing(c);
    setForm({
      name:c.name, email:c.email||'', phone:c.phone||'', notes:c.notes||'',
      phones: phones.length>0 ? phones : [{value:c.phone||'',label:'Primary'}],
      emails: emails.length>0 ? emails : [{value:c.email||'',label:'Primary'}],
    });
    setFormErr(''); setModal(true);
  };

  const handleSave = async e => {
    e.preventDefault(); setFormErr(''); setSaving(true);
    try {
      // Primary phone/email for backward compat
      const primaryPhone = form.phones.find(p=>p.value.trim())?.[0]?.value || form.phones[0]?.value || '';
      const primaryEmail = form.emails.find(e=>e.value.trim())?.[0]?.value || form.emails[0]?.value || '';
      const payload = { name: form.name, phone: form.phones[0]?.value||'', email: form.emails[0]?.value||'', notes: form.notes };

      let savedCustomer;
      if (editing) {
        await updateCustomer(editing.id, payload);
        savedCustomer = { id: editing.id };
      } else {
        const r = await createCustomer(payload);
        savedCustomer = r.data.customer;
      }

      // Save contacts
      const cid = savedCustomer.id;
      // Delete old contacts if editing
      if (editing && editing.contacts) {
        for (const c of editing.contacts) {
          await deleteCustomerContact(c.id).catch(()=>{});
        }
      }
      // Add all phones
      for (let i=0; i<form.phones.length; i++) {
        const p = form.phones[i];
        if (p.value.trim()) await addCustomerContact(cid, { type:'phone', value:p.value.trim(), label:p.label||'Primary', is_primary: i===0?1:0 });
      }
      // Add all emails
      for (let i=0; i<form.emails.length; i++) {
        const e = form.emails[i];
        if (e.value.trim()) await addCustomerContact(cid, { type:'email', value:e.value.trim(), label:e.label||'Primary', is_primary: i===0?1:0 });
      }

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
              <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Rating</th><th>Notes</th><th>Actions</th></tr></thead>
              <tbody>
                {customers.map((c,i) => (
                  <tr key={c.id}>
                    <td style={{color:'var(--text2)',width:40}}>{i+1}</td>
                    <td><strong>{c.name}</strong></td>
                    <td style={{color:'var(--text2)'}}>{c.email || '—'}</td>
                    <td style={{color:'var(--text2)'}}>
                      {c.contacts && c.contacts.filter(x=>x.type==='phone').length > 0
                        ? c.contacts.filter(x=>x.type==='phone').map((p,i)=>(
                            <div key={i} style={{fontSize:i>0?'0.75rem':'0.85rem',color:i>0?'var(--text3)':'var(--text2)'}}>
                              {p.value}{p.label?<span style={{fontSize:'0.65rem',color:'var(--text3)',marginLeft:4}}>({p.label})</span>:null}
                            </div>
                          ))
                        : c.phone || '—'
                      }
                    </td>
                    <td>
                      <span className={`badge ${c.rating==='A'?'badge-yellow':c.rating==='B'?'badge-green':c.rating==='C'?'badge-blue':'badge-gray'}`}>
                        {c.rating==='A'?'⭐⭐⭐⭐':c.rating==='B'?'⭐⭐⭐':c.rating==='C'?'⭐⭐':c.rating==='D'?'⭐':'—'}
                        {c.rating ? ` ${c.rating}` : ''}
                      </span>
                    </td>
                    <td style={{color:'var(--text2)',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.notes || '—'}</td>
                    <td><div className="td-actions">
                      <button className="btn-ghost btn-sm" title="Customer Dashboard" onClick={()=>navigate(`/customers/${c.id}`)}>📊</button>
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
                    <input className="form-input" placeholder="Company / Person name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required autoFocus/>
                  </div>

                  {/* Phones */}
                  <div className="form-group">
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.4rem'}}>
                      <label className="form-label" style={{margin:0}}>📞 Phone Numbers</label>
                      <button type="button" className="btn-ghost btn-sm"
                        onClick={()=>setForm(f=>({...f,phones:[...f.phones,{value:'',label:''}]}))}>
                        + Add Phone
                      </button>
                    </div>
                    {form.phones.map((p,i)=>(
                      <div key={i} style={{display:'flex',gap:'0.4rem',marginBottom:'0.4rem',alignItems:'center'}}>
                        <input className="form-input" placeholder="Phone number" style={{flex:2}}
                          value={p.value} onChange={e=>setForm(f=>({...f,phones:f.phones.map((x,j)=>j===i?{...x,value:e.target.value}:x)}))}/>
                        <input className="form-input" placeholder="Label (Primary/Mobile)" style={{flex:1}}
                          value={p.label} onChange={e=>setForm(f=>({...f,phones:f.phones.map((x,j)=>j===i?{...x,label:e.target.value}:x)}))}/>
                        {form.phones.length>1 && (
                          <button type="button" onClick={()=>setForm(f=>({...f,phones:f.phones.filter((_,j)=>j!==i)}))}
                            style={{background:'var(--red-dim)',border:'1px solid rgba(220,38,38,0.2)',color:'var(--red)',borderRadius:6,padding:'0.35rem 0.5rem',cursor:'pointer',flexShrink:0}}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Emails */}
                  <div className="form-group">
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.4rem'}}>
                      <label className="form-label" style={{margin:0}}>📧 Email Addresses</label>
                      <button type="button" className="btn-ghost btn-sm"
                        onClick={()=>setForm(f=>({...f,emails:[...f.emails,{value:'',label:''}]}))}>
                        + Add Email
                      </button>
                    </div>
                    {form.emails.map((e,i)=>(
                      <div key={i} style={{display:'flex',gap:'0.4rem',marginBottom:'0.4rem',alignItems:'center'}}>
                        <input className="form-input" type="email" placeholder="Email address" style={{flex:2}}
                          value={e.value} onChange={ev=>setForm(f=>({...f,emails:f.emails.map((x,j)=>j===i?{...x,value:ev.target.value}:x)}))}/>
                        <input className="form-input" placeholder="Label (Primary/Work)" style={{flex:1}}
                          value={e.label} onChange={ev=>setForm(f=>({...f,emails:f.emails.map((x,j)=>j===i?{...x,label:ev.target.value}:x)}))}/>
                        {form.emails.length>1 && (
                          <button type="button" onClick={()=>setForm(f=>({...f,emails:f.emails.filter((_,j)=>j!==i)}))}
                            style={{background:'var(--red-dim)',border:'1px solid rgba(220,38,38,0.2)',color:'var(--red)',borderRadius:6,padding:'0.35rem 0.5rem',cursor:'pointer',flexShrink:0}}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-textarea" placeholder="Any additional notes..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
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
