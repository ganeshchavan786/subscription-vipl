import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Toast, useToast } from '../components/Shared';
import { getCustomerProfile } from '../api';
import { fmtDate } from '../utils/dateFormat';

const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n||0);
const RATING_CONFIG = {
  A: { label:'Gold',   stars:'⭐⭐⭐⭐', cls:'badge-yellow', bg:'rgba(245,158,11,0.08)',  border:'rgba(245,158,11,0.3)'  },
  B: { label:'Silver', stars:'⭐⭐⭐',   cls:'badge-green',  bg:'rgba(5,150,105,0.08)',   border:'rgba(5,150,105,0.3)'   },
  C: { label:'Bronze', stars:'⭐⭐',     cls:'badge-blue',   bg:'rgba(37,99,235,0.08)',   border:'rgba(37,99,235,0.3)'   },
  D: { label:'Basic',  stars:'⭐',       cls:'badge-gray',   bg:'rgba(148,163,184,0.08)', border:'rgba(148,163,184,0.3)' },
};

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [selFY, setSelFY]     = useState(null);
  const [toast, showToast]    = useToast();

  useEffect(() => {
    getCustomerProfile(id)
      .then(r => {
        setData(r.data);
        // Auto-select current FY
        const cur = r.data.fyHistory.find(f => f.found) || r.data.fyHistory[r.data.fyHistory.length-1];
        if (cur) setSelFY(cur.fy);
      })
      .catch(() => { showToast('Failed to load profile.'); navigate('/customers'); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Layout><div className="loader-wrap"><div className="spinner"/></div></Layout>;
  if (!data)   return <Layout><div className="empty-state"><div className="empty-icon">❌</div><h3>Customer not found</h3></div></Layout>;

  const { customer, stats, rating, ratingLabel, productHistory, fyHistory, subs } = data;
  const rc = RATING_CONFIG[rating] || RATING_CONFIG.D;

  const selFYData  = fyHistory.find(f => f.fy === selFY);
  const currentFY  = fyHistory[fyHistory.length - 1];

  return (
    <Layout>
      <Toast msg={toast}/>
      <div className="page-header">
        <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
          <button className="btn-ghost btn-sm" onClick={() => navigate('/customers')} style={{flexShrink:0}}>← Back</button>
          <div>
            <h1 className="page-title" style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
              {customer.name}
              <span style={{fontSize:'0.72rem',padding:'3px 10px',borderRadius:5,fontWeight:700,background:rc.bg,color:'var(--text)',border:`1px solid ${rc.border}`}}>
                {rc.stars} {rc.label}
              </span>
            </h1>
            <p className="page-sub">
              {customer.phone && `📞 ${customer.phone}`}
              {customer.email && ` · 📧 ${customer.email}`}
              {stats.firstDate && ` · Customer since ${fmtDate(stats.firstDate)}`}
            </p>
          </div>
        </div>
      </div>

      <div className="page-body" style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>

        {/* ── SUMMARY STATS ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:'0.85rem'}}>
          {[
            { label:'Total Revenue',    val:fmt(stats.totalRevenue),  color:'var(--accent)',  bg:'var(--accent-dim)' },
            { label:'Paid',             val:fmt(stats.paidRevenue),   color:'var(--green)',   bg:'var(--green-dim)'  },
            { label:'Outstanding',      val:fmt(stats.unpaidRevenue), color:stats.unpaidRevenue>0?'var(--red)':'var(--text3)', bg:'var(--red-dim)' },
            { label:'Total Subs',       val:stats.totalSubs,          color:'var(--blue)',    bg:'var(--blue-dim)'   },
            { label:'Active Now',       val:stats.activeCount,        color:'var(--green)',   bg:'var(--green-dim)'  },
            { label:'Products/Services',val:stats.uniqueProducts,     color:'var(--text)',    bg:'var(--surface3)'   },
          ].map(s => (
            <div key={s.label} style={{background:s.bg,border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'0.85rem 1rem'}}>
              <div style={{fontSize:'0.68rem',color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:4}}>{s.label}</div>
              <div style={{fontSize:'1.1rem',fontWeight:800,color:s.color,fontFamily:'Space Grotesk,sans-serif'}}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* ── FY TIMELINE ── */}
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'1.25rem',boxShadow:'var(--shadow-sm)'}}>
          <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.09em',marginBottom:'0.85rem'}}>
            Financial Year History (APR–MAR)
          </div>
          <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap',marginBottom:'1rem'}}>
            {fyHistory.map(f => {
              const isSel = selFY === f.fy;
              const isMissed = !f.found;
              return (
                <div key={f.fy} onClick={() => setSelFY(f.fy)} style={{
                  padding:'0.5rem 0.85rem',borderRadius:'var(--r)',cursor:'pointer',
                  border:`2px solid ${isSel?'var(--accent)':isMissed?'rgba(245,158,11,0.3)':'var(--border)'}`,
                  background:isSel?'var(--accent)':isMissed?'rgba(245,158,11,0.05)':'var(--surface2)',
                  transition:'all 0.15s',transform:isSel?'translateY(-2px)':'none',
                  boxShadow:isSel?'0 4px 12px rgba(99,91,255,0.25)':'none',
                  minWidth:100,textAlign:'center',
                }}>
                  <div style={{fontWeight:700,fontSize:'0.82rem',color:isSel?'white':isMissed?'var(--yellow)':'var(--text)'}}>{f.fy_label}</div>
                  {f.found
                    ? <div style={{fontSize:'0.68rem',color:isSel?'rgba(255,255,255,0.8)':'var(--accent)',fontWeight:600,marginTop:2}}>{fmt(f.revenue)}</div>
                    : <div style={{fontSize:'0.68rem',color:'var(--yellow)',marginTop:2}}>❌ Missing</div>
                  }
                  {f.found && <div style={{fontSize:'0.62rem',color:isSel?'rgba(255,255,255,0.65)':'var(--text3)',marginTop:1}}>{f.count} sub{f.count!==1?'s':''}</div>}
                </div>
              );
            })}
          </div>

          {/* Selected FY detail */}
          {selFYData && (
            <div style={{borderTop:'1px solid var(--border)',paddingTop:'1rem'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem'}}>
                <div style={{fontWeight:700,fontSize:'0.9rem'}}>{selFYData.fy_label} Detail</div>
                <div style={{display:'flex',gap:'0.4rem'}}>
                  <span style={{fontSize:'0.72rem',padding:'2px 8px',borderRadius:5,fontWeight:600,background:'var(--green-dim)',color:'var(--green)',border:'1px solid rgba(5,150,105,0.2)'}}>Paid: {fmt(selFYData.paid)}</span>
                  <span style={{fontSize:'0.72rem',padding:'2px 8px',borderRadius:5,fontWeight:600,background:'var(--red-dim)',color:'var(--red)',border:'1px solid rgba(220,38,38,0.2)'}}>Unpaid: {fmt(selFYData.unpaid)}</span>
                </div>
              </div>
              {selFYData.found ? (
                <table className="data-table">
                  <thead><tr><th>#</th><th>Voucher</th><th>Txn Date</th><th>Product</th><th>Price</th><th>Status</th><th>Payment</th></tr></thead>
                  <tbody>
                    {selFYData.subs.map((s,i) => (
                      <tr key={s.id}>
                        <td style={{color:'var(--text3)'}}>{i+1}</td>
                        <td style={{fontSize:'0.78rem'}}>{s.voucher_no||'—'}</td>
                        <td style={{fontSize:'0.8rem'}}>{fmtDate(s.transaction_date||s.start_date)}</td>
                        <td>{s.product_name}</td>
                        <td style={{fontWeight:700,color:'var(--accent)'}}>{fmt(s.price)}</td>
                        <td><span className={`badge ${s.status==='active'?'badge-green':s.status==='expired'?'badge-red':'badge-gray'}`}>{s.status}</span></td>
                        <td><span className={`badge ${s.payment_status==='paid'?'badge-green':s.payment_status==='partial'?'badge-yellow':'badge-red'}`}>{s.payment_status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{textAlign:'center',padding:'1.5rem',color:'var(--yellow)',background:'rgba(245,158,11,0.05)',borderRadius:'var(--r)',border:'1px solid rgba(245,158,11,0.2)'}}>
                  ❌ No subscriptions in {selFYData.fy_label}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── PRODUCT-WISE HISTORY ── */}
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'1.25rem',boxShadow:'var(--shadow-sm)'}}>
          <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.09em',marginBottom:'0.85rem'}}>
            Product-wise Renewal History
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            {productHistory.map(prod => (
              <div key={prod.product_id} style={{border:'1px solid var(--border)',borderRadius:'var(--r)',overflow:'hidden'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.65rem 1rem',background:'var(--surface2)'}}>
                  <div style={{fontWeight:600,fontSize:'0.875rem'}}>📦 {prod.product_name}</div>
                  <div style={{display:'flex',gap:'0.4rem'}}>
                    <span style={{fontSize:'0.72rem',padding:'2px 8px',borderRadius:5,fontWeight:600,background:'var(--accent-dim)',color:'var(--accent)',border:'1px solid rgba(99,91,255,0.2)'}}>{fmt(prod.total_revenue)}</span>
                    {prod.missed_fys > 0 && <span style={{fontSize:'0.72rem',padding:'2px 8px',borderRadius:5,fontWeight:600,background:'var(--yellow-dim)',color:'var(--yellow)',border:'1px solid rgba(245,158,11,0.2)'}}>❌ {prod.missed_fys} missed</span>}
                    <span style={{fontSize:'0.72rem',padding:'2px 8px',borderRadius:5,fontWeight:600,background:'var(--green-dim)',color:'var(--green)',border:'1px solid rgba(5,150,105,0.2)'}}>✅ {prod.active_fys} yrs</span>
                  </div>
                </div>
                <div style={{padding:'0.65rem 1rem',display:'flex',flexDirection:'column',gap:'0.35rem'}}>
                  {prod.timeline.map(t => {
                    const isMissed = !t.found;
                    return (
                      <div key={t.fy} style={{display:'grid',gridTemplateColumns:'80px 1fr auto auto',alignItems:'center',gap:'0.75rem',padding:'0.35rem 0.5rem',borderRadius:6,background:isMissed?'rgba(245,158,11,0.04)':t.status==='active'?'rgba(5,150,105,0.04)':'transparent',border:`1px solid ${isMissed?'rgba(245,158,11,0.15)':'var(--border)'}`,}}>
                        <div style={{fontWeight:600,fontSize:'0.78rem',color:isMissed?'var(--yellow)':'var(--text)'}}>{t.fy_label}</div>
                        <div style={{height:7,borderRadius:4,background:'var(--border)',overflow:'hidden'}}>
                          <div style={{height:'100%',borderRadius:4,width:isMissed?'0%':'100%',background:t.status==='active'?'var(--green)':isMissed?'transparent':'var(--blue)',transition:'width 0.3s'}}/>
                        </div>
                        <div style={{fontSize:'0.75rem',fontWeight:600,color:isMissed?'var(--text3)':'var(--accent)',whiteSpace:'nowrap',minWidth:70,textAlign:'right'}}>{isMissed?'—':fmt(t.revenue)}</div>
                        <div style={{fontSize:'0.65rem',fontWeight:700,padding:'1px 7px',borderRadius:4,whiteSpace:'nowrap',background:isMissed?'var(--yellow-dim)':t.status==='active'?'var(--green-dim)':'var(--blue-dim)',color:isMissed?'var(--yellow)':t.status==='active'?'var(--green)':'var(--blue)',border:`1px solid ${isMissed?'rgba(245,158,11,0.2)':'transparent'}`}}>
                          {isMissed?'❌ Missed':t.status==='active'?'✅ Active':'📋 Done'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </Layout>
  );
}
