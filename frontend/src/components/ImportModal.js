import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import API from '../api';

export default function ImportModal({ type, onClose, onDone }) {
  const [step, setStep]       = useState('upload'); // upload | preview | result
  const [rows, setRows]       = useState([]);
  const [headers, setHeaders] = useState([]);
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');
  const inputRef = useRef();

  const typeLabel = type === 'customers' ? 'Customers' : type === 'products' ? 'Products' : 'Subscriptions';

  const REQUIRED = {
    customers:     ['name'],
    products:      ['name'],
    subscriptions: ['ref','customer_name','product_name','start_date'],
  };

  const COLUMNS = {
    customers:     ['name', 'email', 'phone', 'notes'],
    products:      ['name', 'price', 'quantity', 'description'],
    subscriptions: ['ref','customer_name','product_name','billing_period','price','payment_status','auto_renewal','is_user_based','start_date','notes'],
  };

  // Download sample template
  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/import/template/${type}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${type}_template.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch { setError('Failed to download template.'); }
  };

  // Parse Excel file on select
  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f); setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (data.length === 0) { setError('Excel file is empty.'); return; }
        setHeaders(Object.keys(data[0]));
        setRows(data.slice(0, 100)); // preview max 100
        setStep('preview');
      } catch { setError('Invalid Excel file. Please use .xlsx format.'); }
    };
    reader.readAsArrayBuffer(f);
  };

  // Submit import
  const handleImport = async () => {
    if (!file) return;
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/import/${type}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Import failed.'); setLoading(false); return; }
      setResult(data);
      setStep('result');
      onDone();
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-head">
          <h2>📥 Import {typeLabel} from Excel</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">

          {/* ── STEP 1: UPLOAD ── */}
          {step === 'upload' && (
            <div style={{display:'flex', flexDirection:'column', gap:'1.25rem'}}>

              {/* Instructions */}
              <div style={{background:'var(--blue-dim)', border:'1px solid rgba(37,99,235,0.2)', borderRadius:'var(--r)', padding:'1rem'}}>
                <div style={{fontWeight:600, fontSize:'0.875rem', marginBottom:'0.5rem', color:'var(--blue)'}}>
                  📋 Excel Format Required
                </div>
                <div style={{fontSize:'0.825rem', color:'var(--text2)', lineHeight:1.7}}>
                  {type === 'subscriptions' ? (
                    <>Excel madhe <strong>2 sheets</strong> pahijet:<br/>
                    <strong>Sheet 1 "Subscriptions"</strong> — main subscription data<br/>
                    <strong>Sheet 2 "Subscription_Users"</strong> — user-wise details (user-based sathi)<br/>
                    <span style={{color:'var(--yellow)',fontWeight:600}}>⚠ Customers ani Products aadhi import kara — tyanche naam match karayla lagel</span>
                    </>
                  ) : 'Your Excel file must have these columns in the first row:'}
                </div>
                <div style={{display:'flex', gap:'0.4rem', flexWrap:'wrap', marginTop:'0.5rem'}}>
                  {COLUMNS[type].map(col => (
                    <span key={col} style={{
                      padding:'2px 10px', borderRadius:'5px', fontSize:'0.78rem', fontWeight:600,
                      background: REQUIRED[type].includes(col) ? 'rgba(99,91,255,0.12)' : 'var(--surface3)',
                      color: REQUIRED[type].includes(col) ? 'var(--accent)' : 'var(--text2)',
                      border: `1px solid ${REQUIRED[type].includes(col) ? 'rgba(99,91,255,0.25)' : 'var(--border2)'}`,
                    }}>
                      {col} {REQUIRED[type].includes(col) ? '*' : ''}
                    </span>
                  ))}
                </div>
                <div style={{fontSize:'0.75rem', color:'var(--text3)', marginTop:'0.5rem'}}>* Required columns</div>
              </div>

              {/* Download template */}
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.85rem 1rem', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r)'}}>
                <div>
                  <div style={{fontWeight:600, fontSize:'0.875rem'}}>Download Sample Template</div>
                  <div style={{fontSize:'0.775rem', color:'var(--text3)', marginTop:'2px'}}>Ready-to-fill Excel file with correct columns</div>
                </div>
                <button className="btn-ghost btn-sm" onClick={downloadTemplate}>⬇ Download</button>
              </div>

              {/* File upload area */}
              <div
                onClick={() => inputRef.current.click()}
                style={{
                  border:'2px dashed var(--border2)', borderRadius:'var(--r-lg)',
                  padding:'2.5rem', textAlign:'center', cursor:'pointer',
                  transition:'all 0.15s', background:'var(--surface2)',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}
              >
                <div style={{fontSize:'2rem', marginBottom:'0.75rem'}}>📂</div>
                <div style={{fontWeight:600, fontSize:'0.9rem', marginBottom:'0.35rem'}}>Click to select Excel file</div>
                <div style={{fontSize:'0.8rem', color:'var(--text3)'}}>Supports .xlsx and .xls files</div>
                <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={handleFile} />
              </div>

              {error && <div className="form-error">{error}</div>}
            </div>
          )}

          {/* ── STEP 2: PREVIEW ── */}
          {step === 'preview' && (
            <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <div>
                  <div style={{fontWeight:600}}>{rows.length} rows found in "{file?.name}"</div>
                  <div style={{fontSize:'0.775rem', color:'var(--text3)', marginTop:'2px'}}>Preview of first {Math.min(rows.length, 10)} rows</div>
                </div>
                <button className="btn-ghost btn-sm" onClick={() => { setStep('upload'); setRows([]); setFile(null); inputRef.current && (inputRef.current.value=''); }}>
                  ← Change File
                </button>
              </div>

              {error && <div className="form-error">{error}</div>}

              <div style={{overflowX:'auto', border:'1px solid var(--border)', borderRadius:'var(--r)'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.82rem'}}>
                  <thead>
                    <tr style={{background:'var(--surface2)'}}>
                      <th style={{padding:'0.6rem 0.75rem', textAlign:'left', fontSize:'0.68rem', fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap'}}>#</th>
                      {headers.map(h => (
                        <th key={h} style={{padding:'0.6rem 0.75rem', textAlign:'left', fontSize:'0.68rem', fontWeight:700, color: REQUIRED[type]?.includes(h.toLowerCase()) ? 'var(--accent)' : 'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap'}}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((row, i) => (
                      <tr key={i} style={{borderBottom:'1px solid var(--border)'}}>
                        <td style={{padding:'0.55rem 0.75rem', color:'var(--text3)'}}>{i+1}</td>
                        {headers.map(h => (
                          <td key={h} style={{padding:'0.55rem 0.75rem', color:'var(--text)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                            {String(row[h] || '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 10 && (
                <div style={{fontSize:'0.775rem', color:'var(--text3)', textAlign:'center'}}>
                  ... and {rows.length - 10} more rows
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: RESULT ── */}
          {step === 'result' && result && (
            <div style={{display:'flex', flexDirection:'column', gap:'1rem', textAlign:'center'}}>
              <div style={{fontSize:'2.5rem'}}>✅</div>
              <div style={{fontWeight:700, fontSize:'1.1rem'}}>Import Complete!</div>
              <div style={{display:'flex', gap:'1rem', justifyContent:'center'}}>
                <div style={{padding:'1rem 1.5rem', background:'var(--green-dim)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:'var(--r)', minWidth:100}}>
                  <div style={{fontSize:'1.5rem', fontWeight:800, color:'var(--green)'}}>{result.inserted}</div>
                  <div style={{fontSize:'0.75rem', color:'var(--text2)', marginTop:2}}>Added</div>
                </div>
                <div style={{padding:'1rem 1.5rem', background:'var(--yellow-dim)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'var(--r)', minWidth:100}}>
                  <div style={{fontSize:'1.5rem', fontWeight:800, color:'var(--yellow)'}}>{result.skipped}</div>
                  <div style={{fontSize:'0.75rem', color:'var(--text2)', marginTop:2}}>Skipped</div>
                </div>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div style={{background:'var(--yellow-dim)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'var(--r)', padding:'0.75rem', textAlign:'left', maxHeight:120, overflowY:'auto'}}>
                  <div style={{fontSize:'0.75rem', fontWeight:700, color:'var(--yellow)', marginBottom:'0.35rem'}}>Skipped rows:</div>
                  {result.errors.map((e, i) => <div key={i} style={{fontSize:'0.775rem', color:'var(--text2)'}}>{e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-foot">
          {step === 'result' ? (
            <button className="btn-save" onClick={onClose}>Done</button>
          ) : step === 'preview' ? (
            <>
              <button className="btn-cancel" onClick={onClose}>Cancel</button>
              <button className="btn-save" onClick={handleImport} disabled={loading}>
                {loading ? <span className="spinner-sm"/> : `Import ${rows.length} ${typeLabel}`}
              </button>
            </>
          ) : (
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}
