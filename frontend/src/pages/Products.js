import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { Toast, ConfirmModal, useToast } from '../components/Shared';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../api';
import ImportModal from '../components/ImportModal';

const EMPTY = { name:'', price:'', quantity:'', description:'' };
const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);

export default function Products() {
  const [products, setProducts] = useState([]);
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
    try { const r = await getProducts(q); setProducts(r.data.products); }
    catch { showToast('Failed to load products.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setTimeout(()=>load(search),350); return ()=>clearTimeout(t); }, [search, load]);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setFormErr(''); setModal(true); };
  const openEdit = p  => { setEditing(p); setForm({name:p.name,price:p.price,quantity:p.quantity,description:p.description||''}); setFormErr(''); setModal(true); };

  const handleSave = async e => {
    e.preventDefault(); setFormErr(''); setSaving(true);
    const payload = { ...form, price: parseFloat(form.price)||0, quantity: parseInt(form.quantity)||0 };
    try {
      if (editing) await updateProduct(editing.id, payload);
      else await createProduct(payload);
      setModal(false);
      showToast(editing ? '✅ Product updated!' : '✅ Product added!');
      load(search);
    } catch (err) { setFormErr(err.response?.data?.message||'Error saving.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await deleteProduct(deleteId); setDeleteId(null); showToast('🗑️ Product deleted.'); load(search); }
    catch { showToast('Failed to delete.'); setDeleteId(null); }
  };

  const f = k => e => setForm({...form,[k]:e.target.value});

  return (
    <Layout>
      <Toast msg={toast}/>
      {importOpen && <ImportModal type="products" onClose={() => setImportOpen(false)} onDone={() => { load(); showToast('✅ Products imported!'); }} />}
      <div className="page-header">
        <div>
          <h1 className="page-title">Products &amp; Services</h1>
          <p className="page-sub">{products.length} total items</p>
        </div>
        <div style={{display:'flex', gap:'0.6rem'}}>
          <button className="btn-ghost" onClick={() => setImportOpen(true)}>📥 Import Excel</button>
          <button className="btn-primary" onClick={openAdd}>+ Add Product</button>
        </div>
      </div>
      <div className="page-body">
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="search-box">
              <input placeholder="Search products..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
          </div>
        </div>

        {loading ? <div className="loader-wrap"><div className="spinner"/></div>
        : products.length===0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h3>{search?'No products found':'No products yet'}</h3>
            <p>{search?'Try a different keyword.':'Add the services you offer.'}</p>
            {!search && <button className="btn-primary" onClick={openAdd}>+ Add Product</button>}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>#</th><th>Name</th><th>Base Price</th><th>Stock</th><th>Description</th><th>Actions</th></tr></thead>
              <tbody>
                {products.map((p,i) => (
                  <tr key={p.id}>
                    <td style={{color:'var(--text2)',width:40}}>{i+1}</td>
                    <td><strong>{p.name}</strong></td>
                    <td style={{color:'var(--accent2)',fontFamily:'Syne,sans-serif',fontWeight:700}}>{fmt(p.price)}</td>
                    <td>
                      <span className={`badge ${p.quantity===0?'badge-red':p.quantity<5?'badge-yellow':'badge-green'}`}>
                        {p.quantity===0?'Out of Stock':p.quantity}
                      </span>
                    </td>
                    <td style={{color:'var(--text2)',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.description||'—'}</td>
                    <td><div className="td-actions">
                      <button className="btn-edit" onClick={()=>openEdit(p)}>✏️ Edit</button>
                      <button className="btn-del"  onClick={()=>setDeleteId(p.id)}>🗑️</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal modal-md">
            <div className="modal-head">
              <h2>{editing?'Edit Product':'Add New Product'}</h2>
              <button className="modal-close" onClick={()=>setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {formErr && <div className="form-error">{formErr}</div>}
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Product / Service Name *</label>
                    <input className="form-input" placeholder="e.g. Premium Support Plan" value={form.name} onChange={f('name')} required autoFocus/>
                  </div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label className="form-label">Base Price (₹)</label>
                      <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={form.price} onChange={f('price')}/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Stock / Quantity</label>
                      <input className="form-input" type="number" min="0" placeholder="0" value={form.quantity} onChange={f('quantity')}/>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea className="form-textarea" placeholder="Brief description of this product or service..." value={form.description} onChange={f('description')}/>
                  </div>
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn-cancel" onClick={()=>setModal(false)}>Cancel</button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving?<span className="spinner-sm"/>:(editing?'Update Product':'Add Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && <ConfirmModal title="🗑️ Delete Product?" message="This will also remove this product from all subscriptions. Cannot be undone." onConfirm={handleDelete} onCancel={()=>setDeleteId(null)}/>}
    </Layout>
  );
}
