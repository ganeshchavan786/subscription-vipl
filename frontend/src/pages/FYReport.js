import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Toast, useToast } from '../components/Shared';
import { getFYReport } from '../api';
import { fmtDate } from '../utils/dateFormat';

const fmt = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const MONTHS_ORDER = ['APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC','JAN','FEB','MAR'];

export default function FYReport() {
  const [fyData, setFyData]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedFY, setSelectedFY] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [toast, showToast]          = useToast();

  useEffect(() => {
    getFYReport()
      .then(r => {
        const data = r.data.fy_data;
        setFyData(data);
        // Auto-select latest FY
        if (data.length > 0) setSelectedFY(data[data.length - 1]);
      })
      .catch(() => showToast('Failed to load FY report.'))
      .finally(() => setLoading(false));
  }, []);

  const handleFYClick = (fy) => {
    setSelectedFY(fy);
    setSelectedMonth(null);
  };

  const handleMonthClick = (month) => {
    if (month.count === 0) return;
    setSelectedMonth(prev => prev?.month_key === month.month_key ? null : month);
  };

  // Max revenue for bar scaling
  const maxMonthRevenue = selectedFY
    ? Math.max(...selectedFY.months.map(m => m.revenue), 1)
    : 1;

  return (
    <Layout>
      <Toast msg={toast} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Year Report</h1>
          <p className="page-sub">April to March — year-wise subscription & revenue analysis</p>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="loader-wrap"><div className="spinner" /></div>
        ) : fyData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>No data found</h3>
            <p>Add subscriptions with transaction dates to see FY report.</p>
          </div>
        ) : (
          <>
            {/* ── FY CARDS ROW ── */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                Select Financial Year
              </div>
              <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                {fyData.map(fy => {
                  const isSelected = selectedFY?.fy_start === fy.fy_start;
                  return (
                    <div
                      key={fy.fy_start}
                      onClick={() => handleFYClick(fy)}
                      style={{
                        background: isSelected ? 'var(--accent)' : 'var(--surface)',
                        border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 'var(--r-lg)',
                        padding: '1rem 1.25rem',
                        cursor: 'pointer',
                        minWidth: 160,
                        transition: 'all 0.15s',
                        boxShadow: isSelected ? '0 4px 16px rgba(99,91,255,0.3)' : 'var(--shadow-sm)',
                        transform: isSelected ? 'translateY(-2px)' : 'none',
                      }}
                    >
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: '1rem', color: isSelected ? 'white' : 'var(--text)', marginBottom: '0.5rem' }}>
                        {fy.fy_label}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: isSelected ? 'rgba(255,255,255,0.75)' : 'var(--text3)', marginBottom: '0.65rem' }}>
                        APR {fy.fy_start} — MAR {fy.fy_start + 1}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isSelected ? 'white' : 'var(--accent)' }}>
                          {fmt(fy.total_revenue)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text3)' }}>
                          {fy.total_subs} subs · {fy.customer_count} customers
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                          <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--green-dim)', color: isSelected ? 'white' : 'var(--green)' }}>
                            ✅ {fy.active_count}
                          </span>
                          <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: isSelected ? 'rgba(255,255,255,0.15)' : 'var(--surface3)', color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text3)' }}>
                            📋 {fy.expired_count}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── SELECTED FY DETAIL ── */}
            {selectedFY && (
              <>
                {/* FY Summary Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
                  {[
                    { label: 'Total Revenue',    val: fmt(selectedFY.total_revenue),  color: 'var(--accent)', bg: 'var(--accent-dim)' },
                    { label: 'Paid',             val: fmt(selectedFY.paid_revenue),   color: 'var(--green)',  bg: 'var(--green-dim)' },
                    { label: 'Unpaid',           val: fmt(selectedFY.unpaid_revenue), color: 'var(--red)',    bg: 'var(--red-dim)' },
                    { label: 'Subscriptions',    val: selectedFY.total_subs,          color: 'var(--blue)',   bg: 'var(--blue-dim)' },
                    { label: 'Customers',        val: selectedFY.customer_count,      color: 'var(--text)',   bg: 'var(--surface3)' },
                    { label: 'Active',           val: selectedFY.active_count,        color: 'var(--green)',  bg: 'var(--green-dim)' },
                  ].map(s => (
                    <div key={s.label} style={{ background: s.bg, border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '0.85rem 1rem' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color, fontFamily: 'Space Grotesk, sans-serif' }}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* Month Grid */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                    {selectedFY.fy_label} — Monthly Breakdown (click a month to see details)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.5rem' }}>
                    {selectedFY.months.map(month => {
                      const isSelected = selectedMonth?.month_key === month.month_key;
                      const isEmpty = month.count === 0;
                      const barH = isEmpty ? 0 : Math.max(8, Math.round((month.revenue / maxMonthRevenue) * 60));
                      return (
                        <div
                          key={month.month_key}
                          onClick={() => handleMonthClick(month)}
                          style={{
                            background: isSelected ? 'var(--accent)' : isEmpty ? 'var(--surface2)' : 'var(--surface)',
                            border: `1px solid ${isSelected ? 'var(--accent)' : isEmpty ? 'var(--border)' : 'var(--border2)'}`,
                            borderRadius: 'var(--r)',
                            padding: '0.65rem 0.5rem',
                            cursor: isEmpty ? 'default' : 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.15s',
                            opacity: isEmpty ? 0.5 : 1,
                            transform: isSelected ? 'translateY(-2px)' : 'none',
                            boxShadow: isSelected ? '0 4px 12px rgba(99,91,255,0.25)' : 'none',
                          }}
                        >
                          {/* Bar chart */}
                          <div style={{ height: 64, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '0.4rem' }}>
                            <div style={{
                              width: '60%', height: barH,
                              background: isSelected ? 'rgba(255,255,255,0.4)' : 'var(--accent)',
                              borderRadius: '3px 3px 0 0',
                              transition: 'height 0.3s ease',
                              minHeight: isEmpty ? 0 : 4,
                            }} />
                          </div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: isSelected ? 'white' : 'var(--text)', marginBottom: '2px' }}>
                            {month.month_label}
                          </div>
                          {!isEmpty && (
                            <>
                              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: isSelected ? 'rgba(255,255,255,0.85)' : 'var(--accent)' }}>
                                {fmt(month.revenue)}
                              </div>
                              <div style={{ fontSize: '0.6rem', color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text3)', marginTop: '1px' }}>
                                {month.count} sub{month.count !== 1 ? 's' : ''}
                              </div>
                            </>
                          )}
                          {isEmpty && (
                            <div style={{ fontSize: '0.6rem', color: 'var(--text3)' }}>—</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── MONTH DETAIL ── */}
                {selectedMonth && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                    {/* Month header */}
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1rem' }}>
                          {selectedMonth.month_label} {selectedMonth.month_year}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: 2 }}>
                          {selectedMonth.count} subscription{selectedMonth.count !== 1 ? 's' : ''} · {fmt(selectedMonth.revenue)} total
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 5, fontWeight: 600, background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(5,150,105,0.2)' }}>
                          Paid: {fmt(selectedMonth.paid)}
                        </span>
                        <span style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 5, fontWeight: 600, background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.2)' }}>
                          Unpaid: {fmt(selectedMonth.unpaid)}
                        </span>
                        <button onClick={() => setSelectedMonth(null)} style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text2)' }}>
                          ✕ Close
                        </button>
                      </div>
                    </div>

                    {/* Subscriptions table */}
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Customer</th>
                          <th>Product / Service</th>
                          <th>Txn Date</th>
                          <th>Start Date</th>
                          <th>End Date</th>
                          <th>Price</th>
                          <th>Billing</th>
                          <th>Status</th>
                          <th>Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedMonth.subs.map((s, i) => (
                          <tr key={s.id}>
                            <td style={{ color: 'var(--text3)' }}>{i + 1}</td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{s.customer_name}</div>
                              {s.customer_phone && <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{s.customer_phone}</div>}
                            </td>
                            <td>{s.product_name}</td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>{fmtDate(s.transaction_date || s.start_date)}</td>
                            <td style={{ fontSize: '0.82rem' }}>{fmtDate(s.start_date)}</td>
                            <td style={{ fontSize: '0.82rem' }}>{fmtDate(s.end_date)}</td>
                            <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(s.price)}</td>
                            <td>
                              <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>
                                {s.billing_period?.replace('_', '-')}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${s.status === 'active' ? 'badge-green' : s.status === 'expired' ? 'badge-red' : 'badge-gray'}`}>
                                {s.status === 'active' ? '● Active' : s.status === 'expired' ? '✕ Expired' : '◌ ' + s.status}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${s.payment_status === 'paid' ? 'badge-green' : s.payment_status === 'partial' ? 'badge-yellow' : 'badge-red'}`}>
                                {s.payment_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--accent-dim)' }}>
                          <td colSpan={6} style={{ padding: '0.75rem 1rem', fontWeight: 700, textAlign: 'right', color: 'var(--text2)', fontSize: '0.85rem' }}>
                            Total ({selectedMonth.count} subscriptions)
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: 'var(--accent)', fontSize: '0.95rem', fontFamily: 'Space Grotesk, sans-serif' }}>
                            {fmt(selectedMonth.revenue)}
                          </td>
                          <td colSpan={3} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
