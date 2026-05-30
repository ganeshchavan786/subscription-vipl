import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Toast, useToast } from '../components/Shared';
import { getRenewalHistory, getAtRisk, getCustomers, getProducts } from '../api';
import { fmtDate } from '../utils/dateFormat';

const fmt = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const TABS = [
  { id: 'history',  label: '📅 Renewal History' },
  { id: 'atrisk',   label: '⚠️ At-Risk Customers' },
];

export default function Reports() {
  const [tab, setTab]           = useState('history');
  const [report, setReport]     = useState([]);
  const [atRisk, setAtRisk]     = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [filterCust, setFilterCust] = useState('');
  const [filterProd, setFilterProd] = useState('');
  const [search, setSearch]     = useState('');
  const [toast, showToast]      = useToast();

  useEffect(() => {
    Promise.all([getCustomers(), getProducts()]).then(([c, p]) => {
      setCustomers(c.data.customers);
      setProducts(p.data.products);
    });
  }, []);

  useEffect(() => {
    if (tab === 'history') loadHistory();
    if (tab === 'atrisk')  loadAtRisk();
  }, [tab]);

  // Auto-load when filters change
  useEffect(() => {
    if (tab === 'history') {
      const t = setTimeout(() => loadHistory(), 300);
      return () => clearTimeout(t);
    }
  }, [filterCust, filterProd]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterCust) params.customer_id = filterCust;
      if (filterProd) params.product_id  = filterProd;
      const r = await getRenewalHistory(params);
      setReport(r.data.report);
    } catch { showToast('Failed to load report.'); }
    finally { setLoading(false); }
  };

  const loadAtRisk = async () => {
    setLoading(true);
    try {
      const r = await getAtRisk();
      setAtRisk(r.data.at_risk);
    } catch { showToast('Failed to load at-risk data.'); }
    finally { setLoading(false); }
  };

  // Live search filter on frontend
  const filteredReport = report.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.customer_name.toLowerCase().includes(q) ||
      r.product_name.toLowerCase().includes(q) ||
      (r.customer_phone && r.customer_phone.includes(q))
    );
  });

  // At-risk search
  const filteredAtRisk = atRisk.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.customer_name?.toLowerCase().includes(q) ||
      r.product_name?.toLowerCase().includes(q) ||
      (r.customer_phone && r.customer_phone.includes(q))
    );
  });

  return (
    <Layout>
      <Toast msg={toast} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">Year-wise renewal tracking & customer insights</p>
        </div>
      </div>

      <div className="page-body">

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); }} style={{
              padding: '0.6rem 1.1rem', border: 'none', background: 'none',
              cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
              color: tab === t.id ? 'var(--accent)' : 'var(--text2)',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-1px', transition: 'all 0.15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── RENEWAL HISTORY TAB ── */}
        {tab === 'history' && (
          <>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="search-box">
                <input placeholder="Search customer, product, phone..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="filter-select" value={filterCust} onChange={e => setFilterCust(e.target.value)}>
                <option value="">All Customers</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="filter-select" value={filterProd} onChange={e => setFilterProd(e.target.value)}>
                <option value="">All Products</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {(search || filterCust || filterProd) && (
                <button className="btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterCust(''); setFilterProd(''); }}>
                  ✕ Clear
                </button>
              )}
              <span style={{ fontSize: '0.8rem', color: 'var(--text3)', alignSelf: 'center' }}>
                {filteredReport.length} result{filteredReport.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? <div className="loader-wrap"><div className="spinner" /></div>
            : filteredReport.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📅</div>
                <h3>No renewal data found</h3>
                <p>Add subscriptions with past dates to see year-wise history.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredReport.map((r, i) => (
                  <RenewalCard key={i} data={r} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── AT-RISK TAB ── */}
        {tab === 'atrisk' && (
          <>
            {/* Search for at-risk */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="search-box">
                <input placeholder="Search customer or product..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {search && (
                <button className="btn-ghost btn-sm" onClick={() => setSearch('')}>✕ Clear</button>
              )}
              {filteredAtRisk.length > 0 && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
                  {filteredAtRisk.length} result{filteredAtRisk.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {loading ? <div className="loader-wrap"><div className="spinner" /></div>
            : filteredAtRisk.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <h3>No at-risk customers</h3>
                <p>All customers who were active last year have renewed this year.</p>
              </div>
            ) : (
              <>
                <div style={{
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: 'var(--r)', padding: '0.75rem 1rem', marginBottom: '1rem',
                  fontSize: '0.875rem', color: 'var(--yellow)', fontWeight: 500,
                }}>
                  ⚠️ {filteredAtRisk.length} customer-product combination{filteredAtRisk.length > 1 ? 's' : ''} active last year but not yet renewed this year
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Customer</th>
                        <th>Product</th>
                        <th>Last Price</th>
                        <th>Last End Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAtRisk.map((r, i) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--text3)' }}>{i + 1}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{r.customer_name}</div>
                            {r.customer_phone && <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{r.customer_phone}</div>}
                          </td>
                          <td>{r.product_name}</td>
                          <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(r.last_price)}</td>
                          <td>
                            <span style={{ color: 'var(--red)', fontWeight: 500 }}>{fmtDate(r.last_end_date)}</span>
                          </td>
                          <td>
                            <a href="/subscriptions" style={{
                              background: 'var(--accent-dim)', border: '1px solid rgba(99,91,255,0.2)',
                              color: 'var(--accent)', borderRadius: '6px', padding: '0.28rem 0.65rem',
                              fontSize: '0.775rem', fontWeight: 600, textDecoration: 'none',
                            }}>
                              + Renew Now
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

// ── Renewal Card Component ──
function RenewalCard({ data }) {
  const [expanded, setExpanded] = useState(false);
  const thisYear = new Date().getFullYear();

  const statusColor = {
    active:    'var(--green)',
    expired:   'var(--red)',
    cancelled: 'var(--text3)',
    missed:    'var(--yellow)',
  };

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      {/* Card Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.25rem', cursor: 'pointer',
        background: expanded ? 'var(--surface2)' : 'var(--surface)',
        borderBottom: expanded ? '1px solid var(--border)' : 'none',
      }} onClick={() => setExpanded(e => !e)}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
          {/* Status dot */}
          <div style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: data.is_active ? 'var(--green)' : 'var(--red)',
            boxShadow: data.is_active ? '0 0 6px var(--green)' : 'none',
          }} />

          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>
              {data.customer_name}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: 1 }}>
              {data.product_name}
              {data.customer_phone && ` · ${data.customer_phone}`}
            </div>
          </div>
        </div>

        {/* Stats pills */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 5, fontWeight: 600, background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.2)' }}>
            ✅ {data.active_years} yr{data.active_years !== 1 ? 's' : ''}
          </span>
          {data.missed_years > 0 && (
            <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 5, fontWeight: 600, background: 'var(--yellow-dim)', color: 'var(--yellow)', border: '1px solid rgba(245,158,11,0.2)' }}>
              ❌ {data.missed_years} missed
            </span>
          )}
          <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 5, fontWeight: 600, background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(99,91,255,0.2)' }}>
            {fmt(data.total_revenue)}
          </span>
          <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 5, fontWeight: 600, background: 'var(--surface3)', color: 'var(--text2)', border: '1px solid var(--border2)' }}>
            Since {data.first_year}
          </span>
          <span style={{ color: 'var(--text3)', fontSize: '0.85rem', marginLeft: 4 }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Expanded year timeline */}
      {expanded && (
        <div style={{ padding: '1rem 1.25rem' }}>

          {/* Summary row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'First Subscription', val: data.first_year, color: 'var(--blue)' },
              { label: 'Active Years',        val: data.active_years, color: 'var(--green)' },
              { label: 'Missed Years',        val: data.missed_years, color: data.missed_years > 0 ? 'var(--yellow)' : 'var(--text3)' },
              { label: 'Current Streak',      val: `${data.streak} yr${data.streak !== 1 ? 's' : ''}`, color: 'var(--accent)' },
              { label: 'Total Revenue',       val: fmt(data.total_revenue), color: 'var(--accent)' },
              { label: 'Status',              val: data.is_active ? 'Active' : 'Inactive', color: data.is_active ? 'var(--green)' : 'var(--red)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '0.65rem 0.85rem' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Year-wise timeline */}
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>
            Year-wise Timeline
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {data.all_years.map(year => {
              const entry = data.year_map[year];
              const isMissed = !entry.found;
              const isThisYear = year === thisYear;
              return (
                <div key={year} style={{
                  display: 'grid', gridTemplateColumns: '60px 1fr auto auto',
                  alignItems: 'center', gap: '0.75rem',
                  padding: '0.55rem 0.85rem',
                  background: isMissed ? 'rgba(245,158,11,0.05)' : isThisYear ? 'rgba(99,91,255,0.05)' : 'var(--surface2)',
                  border: `1px solid ${isMissed ? 'rgba(245,158,11,0.2)' : isThisYear ? 'rgba(99,91,255,0.2)' : 'var(--border)'}`,
                  borderRadius: 8,
                }}>
                  {/* Year */}
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: isThisYear ? 'var(--accent)' : 'var(--text)' }}>
                    {year} {isThisYear && <span style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>NOW</span>}
                  </div>

                  {/* Bar */}
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: isMissed ? '0%' : '100%',
                      background: entry.status === 'active' ? 'var(--green)'
                        : entry.status === 'expired' ? 'var(--blue)'
                        : entry.status === 'cancelled' ? 'var(--text3)'
                        : 'transparent',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>

                  {/* Price */}
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: isMissed ? 'var(--text3)' : 'var(--accent)', whiteSpace: 'nowrap' }}>
                    {isMissed ? '—' : fmt(entry.price)}
                  </div>

                  {/* Status badge */}
                  <div style={{
                    fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                    background: isMissed ? 'var(--yellow-dim)'
                      : entry.status === 'active' ? 'var(--green-dim)'
                      : entry.status === 'expired' ? 'var(--blue-dim)'
                      : 'var(--surface3)',
                    color: isMissed ? 'var(--yellow)'
                      : entry.status === 'active' ? 'var(--green)'
                      : entry.status === 'expired' ? 'var(--blue)'
                      : 'var(--text3)',
                    border: `1px solid ${isMissed ? 'rgba(245,158,11,0.2)' : 'transparent'}`,
                    whiteSpace: 'nowrap',
                  }}>
                    {isMissed ? '❌ Missed'
                      : entry.status === 'active' ? '✅ Active'
                      : entry.status === 'expired' ? '📋 Done'
                      : '◌ Cancelled'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
