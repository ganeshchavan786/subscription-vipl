import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { getStats, getSubscriptions } from '../api';
import { Toast, useToast } from '../components/Shared';
import { useAuth } from '../AuthContext';
import { fmtDate } from '../utils/dateFormat';

const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);

const PERIOD_LABEL = { daily:'Daily', monthly:'Monthly', quarterly:'Quarterly', half_yearly:'Half-Yearly', yearly:'Yearly' };

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [expiring, setExpiring] = useState([]);
  const [toast, showToast] = useToast();

  useEffect(() => {
    Promise.all([
      getStats(),
      getSubscriptions({ status: 'active' }),
    ]).then(([s, sub]) => {
      setStats(s.data.stats);
      const today = new Date();
      const in7 = new Date(); in7.setDate(in7.getDate()+7);
      const soon = sub.data.subscriptions.filter(s => {
        const end = new Date(s.end_date);
        return end >= today && end <= in7;
      }).slice(0,5);
      setExpiring(soon);
    }).catch(() => showToast('Failed to load dashboard.'));
  }, []);

  const STAT_CARDS = stats ? [
    { label:'Active Subscriptions', val: stats.active,          icon:'♻', cls:'green'  },
    { label:'Monthly Revenue (MRR)',  val: fmt(stats.mrr),       icon:'₹', cls:'accent' },
    { label:'Expiring in 7 Days',    val: stats.expiringSoon,    icon:'⏳', cls:'yellow' },
    { label:'Unpaid Active',         val: stats.unpaidCount,     icon:'⚠', cls:'red'    },
    { label:'Total Customers',       val: stats.totalCustomers,  icon:'👥', cls:'blue'   },
    { label:'Total Products',        val: stats.totalProducts,   icon:'📦', cls:''       },
  ] : [];

  return (
    <Layout>
      <Toast msg={toast}/>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Welcome back, {user?.name}</p>
        </div>
        <Link to="/subscriptions/new" className="btn-primary">+ New Subscription</Link>
      </div>
      <div className="page-body">
        {!stats ? <div className="loader-wrap"><div className="spinner"/></div> : (
          <>
            <div className="stats-grid">
              {STAT_CARDS.map(c => (
                <div key={c.label} className={`stat-card ${c.cls}`}>
                  <div className="stat-card-icon">{c.icon}</div>
                  <div className="stat-card-val">{c.val}</div>
                  <div className="stat-card-lbl">{c.label}</div>
                </div>
              ))}
            </div>

            <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',overflow:'hidden'}}>
              <div style={{padding:'1rem 1.25rem',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <h3 style={{fontFamily:'Syne,sans-serif',fontSize:'0.95rem',fontWeight:700}}>⏳ Expiring Soon</h3>
                <Link to="/subscriptions?status=active" style={{fontSize:'0.8rem',color:'var(--accent2)',textDecoration:'none'}}>View all →</Link>
              </div>
              {expiring.length === 0 ? (
                <div style={{padding:'2rem',textAlign:'center',color:'var(--text2)',fontSize:'0.875rem'}}>No subscriptions expiring in the next 7 days 🎉</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Customer</th><th>Service</th><th>Period</th><th>Ends On</th><th>Payment</th></tr></thead>
                  <tbody>
                    {expiring.map(s => {
                      const daysLeft = Math.ceil((new Date(s.end_date)-new Date())/(1000*60*60*24));
                      return (
                        <tr key={s.id}>
                          <td><strong>{s.customer_name}</strong></td>
                          <td>{s.product_name}</td>
                          <td><span className="badge badge-purple">{PERIOD_LABEL[s.billing_period]}</span></td>
                          <td>
                            <span style={{color:'var(--yellow)',fontWeight:600}}>{fmtDate(s.end_date)}</span>
                            <span style={{color:'var(--text2)',fontSize:'0.78rem',marginLeft:'0.5rem'}}>({daysLeft}d left)</span>
                          </td>
                          <td><PayBadge status={s.payment_status}/></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

export const PayBadge = ({ status }) => {
  const map = { paid:{cls:'badge-green',label:'Paid'}, unpaid:{cls:'badge-red',label:'Unpaid'}, partial:{cls:'badge-yellow',label:'Partial'} };
  const m = map[status] || map.unpaid;
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
};
