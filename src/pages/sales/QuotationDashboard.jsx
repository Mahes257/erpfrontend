import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Ban,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  FileText,
  Handshake,
  IndianRupee,
  PenLine,
  Plus,
  Send,
  TrendingUp
} from 'lucide-react';
import quotationService from '../../services/quotationService';
import SalesStatusBadge from '../../components/SalesTable/SalesStatusBadge';
import { formatDate, formatINR } from '../../utils/leadHelpers';
import { BarChart, DoughnutChart, FunnelChart, LineTrendChart } from '../../components/SalesCharts/SalesMiniCharts';
import './quotation-module.css';

function parseListResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.content)) return response.data.content;
  if (Array.isArray(response?.content)) return response.content;
  return [];
}

function KpiCard({ icon: Icon, label, value, color, onClick }) {    const iconClass = {
      '#3b82f6': 'sky',
      '#f59e0b': 'amber',
      '#d97706': 'amber',
      '#16a34a': 'emerald',
      '#10b981': 'emerald',
      '#059669': 'green',
      '#dc2626': 'red',
      '#ef4444': 'red',
      '#8b5cf6': 'purple',
      '#7c3aed': 'purple',
      '#9ca3af': 'gray',
      '#0284c7': 'sky',
      '#2563eb': 'sky'
    }[String(color || '').toLowerCase()] || 'gray';
  return (
    <button type="button" onClick={onClick} className="qpo-kpi-card">
      <div className={`qpo-kpi-icon ${iconClass}`}>
        <Icon />
      </div>
      <div>
        <div className="qpo-kpi-count">{value}</div>
        <div className="qpo-kpi-label">{label}</div>
      </div>
    </button>
  );
}

function DashStat({ label, value }) {
  return (
    <div className="qpo-dash-card">
      <div className="qpo-dash-stat">{value}</div>
      <div className="qpo-dash-stat-label">{label}</div>
    </div>
  );
}

export default function QuotationDashboard() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    quotationService
      .list({ page: 0, size: 500 })
      .then((res) => {
        if (cancelled) return;
        setRows(parseListResponse(res));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const active = rows.filter((q) => String(q.status || '').toLowerCase() !== 'deleted');
    const total = active.length;
    const counts = {
      draft: 0,
      'pending approval': 0,
      approved: 0,
      sent: 0,
      viewed: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
      converted: 0,
      cancelled: 0,
      negotiation: 0
    };
    let totalValue = 0;
    active.forEach((q) => {
      const s = String(q.status || 'draft').toLowerCase();
      if (counts[s] !== undefined) counts[s]++;
      totalValue += Number(q.grandTotal || q.total || q.amount || 0) || 0;
    });
    const sentBucket = counts.sent + counts.viewed + counts.accepted;
    const convRate = sentBucket > 0 ? Math.round((counts.accepted / sentBucket) * 100) : 0;
    const avgValue = total > 0 ? totalValue / total : 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString();
    const thisMonth = active.filter((q) => (q.quotationDate || q.date || '') >= monthStart).length;
    const thisQuarter = active.filter((q) => (q.quotationDate || q.date || '') >= quarterStart).length;
    const highest = active.reduce((m, q) => Math.max(m, Number(q.grandTotal || q.total || 0) || 0), 0);
    return { total, counts, totalValue, convRate, avgValue, thisMonth, thisQuarter, highest };
  }, [rows]);

  const recent = useMemo(
    () =>
      [...rows]
        .filter((q) => String(q.status || '').toLowerCase() !== 'deleted')
        .sort((a, b) => String(b.quotationDate || b.date || '').localeCompare(String(a.quotationDate || a.date || '')))
        .slice(0, 10),
    [rows]
  );

  const topCustomers = useMemo(() => {
    const map = {};
    rows
      .filter((q) => String(q.status || '').toLowerCase() !== 'deleted')
      .forEach((q) => {
        const name = q.clientName || q.client || 'Unknown';
        if (!map[name]) map[name] = { count: 0, value: 0 };
        map[name].count++;
        map[name].value += Number(q.grandTotal || q.total || 0) || 0;
      });
    return Object.keys(map)
      .map((name) => ({ name, ...map[name] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [rows]);

  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const year = now.getFullYear();
    const monthlyCounts = new Array(12).fill(0);
    const monthlyValues = new Array(12).fill(0);
    rows
      .filter((q) => String(q.status || '').toLowerCase() !== 'deleted')
      .forEach((q) => {
        const d = new Date(q.quotationDate || q.date || q.createdAt);
        if (!Number.isNaN(d.getTime()) && d.getFullYear() === year) {
          monthlyCounts[d.getMonth()]++;
          monthlyValues[d.getMonth()] += Number(q.grandTotal || q.total || 0) || 0;
        }
      });
    const c = stats.counts;
    const statusLabels = ['Draft', 'Pending Approval', 'Approved', 'Sent', 'Viewed', 'Accepted', 'Rejected', 'Expired'];
    const statusData = [c.draft, c['pending approval'], c.approved, c.sent, c.viewed, c.accepted, c.rejected, c.expired];
    const funnelLabels = ['Total', 'Sent', 'Viewed', 'Accepted'];
    const funnelData = [stats.total, c.sent + c.viewed + c.accepted, c.viewed + c.accepted, c.accepted];
    return { months, monthlyCounts, monthlyValues, statusLabels, statusData, funnelLabels, funnelData };
  }, [rows, stats.counts, stats.total]);

  const goList = (filter) => navigate(filter ? `/quotations?status=${filter}` : '/quotations');

  return (
    <div className="qpo-page">
      {/* ===== BREADCRUMB ===== */}
      <div className="qpo-breadcrumb">
        <a onClick={() => navigate('/dashboard')}>Dashboard</a>
        <ChevronDown />
        <a onClick={() => navigate('/quotations')}>Quotations</a>
        <ChevronDown />
        <span>Dashboard</span>
      </div>

      {/* ===== PAGE HEADER ===== */}
      <div className="qpo-page-header">
        <div>
          <h1>
            <BarChart3 /> Quotation Dashboard
          </h1>
          <p className="qpo-page-header-subtitle">Real-time quotation KPIs, status tracking, value analysis and conversions.</p>
        </div>
        <div className="qpo-header-actions">
          <button type="button" className="qpo-btn qpo-btn-ghost" onClick={() => navigate('/quotations')}>
            <FileText /> Quotation List
          </button>
          <button type="button" className="qpo-btn qpo-btn-primary" onClick={() => navigate('/quotations/new')}>
            <Plus /> New Quotation
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ display: 'inline-block', width: 24, height: 24, borderRadius: '50%', border: '2px solid #e5e7eb', borderTopColor: '#0b4a3d', animation: 'qpo-spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* ===== KPI ROW ===== */}
          <div className="qpo-kpi-cards">
            <KpiCard icon={FileText} label="Total Quotations" value={stats.total} color="#3b82f6" onClick={() => goList('')} />
            <KpiCard icon={PenLine} label="Draft" value={stats.counts.draft} color="#f59e0b" onClick={() => goList('draft')} />
            <KpiCard icon={Clock} label="Pending Approval" value={stats.counts['pending approval']} color="#d97706" onClick={() => goList('sent')} />
            <KpiCard icon={CheckCircle2} label="Approved" value={stats.counts.approved} color="#16a34a" onClick={() => goList('accepted')} />
            <KpiCard icon={Send} label="Sent" value={stats.counts.sent} color="#2563eb" onClick={() => goList('sent')} />
            <KpiCard icon={Eye} label="Viewed" value={stats.counts.viewed} color="#0284c7" onClick={() => goList('sent')} />
            <KpiCard icon={Handshake} label="Accepted" value={stats.counts.accepted} color="#059669" onClick={() => goList('accepted')} />
            <KpiCard icon={Ban} label="Rejected" value={stats.counts.rejected} color="#dc2626" onClick={() => goList('rejected')} />
            <KpiCard icon={Clock} label="Expired" value={stats.counts.expired} color="#ef4444" onClick={() => goList('expired')} />
            <KpiCard icon={TrendingUp} label="Conversion Rate" value={`${stats.convRate}%`} color="#8b5cf6" onClick={() => goList('')} />
            <KpiCard icon={IndianRupee} label="Total Value" value={formatINR(stats.totalValue)} color="#059669" onClick={() => goList('')} />
          </div>

          {/* ===== SUMMARY STRIP ===== */}
          <div className="qpo-dash-grid">
            <DashStat label="Average Value" value={formatINR(stats.avgValue)} />
            <DashStat label="This Month" value={stats.thisMonth} />
            <DashStat label="This Quarter" value={stats.thisQuarter} />
            <DashStat label="Highest Value" value={formatINR(stats.highest)} />
          </div>

          {/* ===== CHARTS ===== */}
          <div className="qpo-dash-grid">
            <div className="qpo-dash-card">
              <div className="qpo-dash-card-header"><h3><BarChart3 /> Quotation Trend (This Year)</h3></div>
              <LineTrendChart labels={chartData.months} data={chartData.monthlyCounts} />
            </div>
            <div className="qpo-dash-card">
              <div className="qpo-dash-card-header"><h3><CheckCircle2 /> Status Distribution</h3></div>
              <DoughnutChart labels={chartData.statusLabels} data={chartData.statusData} />
            </div>
            <div className="qpo-dash-card">
              <div className="qpo-dash-card-header"><h3><IndianRupee /> Monthly Value (₹)</h3></div>
              <BarChart labels={chartData.months} data={chartData.monthlyValues} />
            </div>
            <div className="qpo-dash-card">
              <div className="qpo-dash-card-header"><h3><TrendingUp /> Conversion Funnel</h3></div>
              <FunnelChart labels={chartData.funnelLabels} data={chartData.funnelData} />
            </div>
          </div>

          {/* ===== RECENT + TOP CUSTOMERS ===== */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start' }} className="qpo-dash-recent-grid">
            <div className="qpo-table-card" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText style={{ width: 15, height: 15, color: '#0a4f44' }} /> Recent Quotations
                </h3>
                <button type="button" onClick={() => navigate('/quotations')} style={{ fontSize: 12, fontWeight: 600, color: '#0b4a3d', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  View all →
                </button>
              </div>
              <div className="qpo-table-wrap">
                <table className="qpo-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Client</th>
                      <th className="qpo-th-right">Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af' }}>No quotations yet</td>
                      </tr>
                    ) : (
                      recent.map((q) => (
                        <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/quotations/${q.id}/view`)}>
                          <td><span className="qpo-order-link">{q.quotationNo || q.id}</span></td>
                          <td>{q.clientName || '—'}</td>
                          <td className="qpo-th-right"><span className="qpo-amount">{formatINR(q.grandTotal || 0)}</span></td>
                          <td><SalesStatusBadge status={q.status} /></td>
                          <td style={{ color: '#6b7280' }}>{formatDate(q.quotationDate || q.date)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="qpo-view-section">
              <h3><Handshake /> Top Customers</h3>
              {topCustomers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 12, color: '#9ca3af' }}>No data yet</div>
              ) : (
                <div>
                  {topCustomers.map((c) => (
                    <div key={c.name} className="qpo-view-field" style={{ padding: '10px 0' }}>
                      <label>{c.name}</label>
                      <span style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: 12, color: '#0b4a3d', fontWeight: 700 }}>{formatINR(c.value)}</span>
                        <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{c.count} quotation{c.count === 1 ? '' : 's'}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      <style>{`@keyframes qpo-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
