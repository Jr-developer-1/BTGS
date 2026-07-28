import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import {
    BarChart2, Users, UserCheck, TrendingDown, TrendingUp,
    Calendar, Search, RefreshCw, Download, FileText,
    ChevronUp, ChevronDown, IndianRupee, Percent, Clock, CheckCircle, XCircle
} from 'lucide-react';

/* ─── helpers ──────────────────────────────────────────────── */
const fmt = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (a, b) => b ? ((a / b) * 100).toFixed(1) : '0.0';

const KPI = ({ icon: Icon, label, value, sub, color }) => (
    <div style={{
        background: '#fff', borderRadius: 10, padding: '10px 12px',
        border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,.05)',
        display: 'flex', alignItems: 'center', gap: 10, minWidth: 0
    }}>
        <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <Icon size={16} color={color} />
        </div>
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
            {sub && <div style={{ fontSize: '0.58rem', color: '#94a3b8', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
        </div>
    </div>
);

const SortTh = ({ label, field, sort, setSort }) => {
    const active = sort.field === field;
    return (
        <th
            onClick={() => setSort(s => ({ field, dir: s.field === field && s.dir === 'asc' ? 'desc' : 'asc' }))}
            style={{ cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', padding: '6px 10px', background: '#f8fafc', fontSize: '0.68rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em' }}
        >
            {label} {active ? (sort.dir === 'asc' ? <ChevronUp size={10} style={{ display: 'inline' }} /> : <ChevronDown size={10} style={{ display: 'inline' }} />) : null}
        </th>
    );
};

/* ─── progress bar ─────────────────────────────────────────── */
const Bar = ({ value, max, color }) => (
    <div style={{ background: '#f1f5f9', borderRadius: 6, height: 6, width: '100%', overflow: 'hidden', minWidth: 80 }}>
        <div style={{ height: '100%', borderRadius: 6, background: color, width: `${Math.min(100, (value / (max || 1)) * 100)}%`, transition: 'width .4s' }} />
    </div>
);

/* ─── main component ───────────────────────────────────────── */
export default function ClaimReport() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const role = (user?.role || '').toLowerCase();
    const dept = (user?.department || '').toLowerCase();
    const desig = (user?.designation || '').toLowerCase();
    const isHR = dept.includes('hr') || desig.includes('hr') || role === 'hr' || dept.includes('human resource');
    const isFinance = dept.includes('finance') || desig.includes('finance') || role === 'finance';
    const isAdmin = role.includes('admin') || role.includes('superuser');

    useEffect(() => {
        if (!isHR && !isFinance && !isAdmin) navigate('/');
    }, [isHR, isFinance, isAdmin, navigate]);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('employee');
    const [filters, setFilters] = useState({ from_date: '', to_date: '', employee: '' });
    const [empSort, setEmpSort] = useState({ field: 'total_submitted', dir: 'desc' });
    const [apprSort, setApprSort] = useState({ field: 'total_processed', dir: 'desc' });
    const [search, setSearch] = useState('');
    const [expandedEmployee, setExpandedEmployee] = useState(null); // employee_code of expanded row
    const [expandedApprover, setExpandedApprover] = useState(null); // approver_code of expanded row

    const load = useCallback(async (f = filters) => {
        setLoading(true);
        try {
            const params = {};
            if (f.from_date) params.from_date = f.from_date;
            if (f.to_date)   params.to_date   = f.to_date;
            if (f.employee)  params.employee   = f.employee;
            const resp = await api.get('/api/reports/claims/', { params });
            setData(resp.data);
        } catch (err) {
            showToast(err?.response?.data?.error || 'Failed to load report', 'error');
        } finally {
            setLoading(false);
        }
    }, [filters, showToast]);

    const handleExport = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.from_date) params.from_date = filters.from_date;
            if (filters.to_date)   params.to_date   = filters.to_date;
            if (filters.employee)  params.employee   = filters.employee;

            const response = await api.get('/api/reports/claims/export/', {
                params,
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Claims_Reconciliation_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            showToast('Excel report exported successfully', 'success');
        } catch (err) {
            showToast('Failed to export Excel report', 'error');
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => { load(); }, []);

    const sorted = (arr = [], sortState) => {
        return [...arr].sort((a, b) => {
            const v = (x) => typeof x[sortState.field] === 'string' ? x[sortState.field].toLowerCase() : (x[sortState.field] || 0);
            return sortState.dir === 'asc' ? (v(a) > v(b) ? 1 : -1) : (v(a) < v(b) ? 1 : -1);
        });
    };

    const empRows = sorted(
        (data?.by_employee || []).filter(r =>
            !search || r.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
            r.department?.toLowerCase().includes(search.toLowerCase())
        ),
        empSort
    );

    const apprRows = sorted(
        (data?.by_approver || []).filter(r =>
            !search || r.approver_name?.toLowerCase().includes(search.toLowerCase())
        ),
        apprSort
    );

    const s = data?.summary || {};
    const maxSub = Math.max(...(data?.by_employee || []).map(r => r.total_submitted), 1);
    const maxProc = Math.max(...(data?.by_approver || []).map(r => r.total_processed), 1);

    const tabStyle = (tab) => ({
        padding: '5px 14px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
        border: 'none', cursor: 'pointer', transition: 'all .15s',
        background: activeTab === tab ? '#bb0633' : '#f1f5f9',
        color: activeTab === tab ? '#fff' : '#64748b'
    });

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '20px 24px', fontFamily: "'Inter', sans-serif" }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#bb0633,#db2777)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BarChart2 size={18} color="#fff" />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>Claim Reconciliation Report</h1>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Submitted vs Approved amounts — Employee & Approver view</p>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleExport} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                        <Download size={13} /> Download Excel
                    </button>
                    <button onClick={() => load()} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 14px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 3 }}>From Date</label>
                    <input type="date" value={filters.from_date} onChange={e => setFilters(f => ({ ...f, from_date: e.target.value }))}
                        style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.75rem', outline: 'none' }} />
                </div>
                <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 3 }}>To Date</label>
                    <input type="date" value={filters.to_date} onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))}
                        style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.75rem', outline: 'none' }} />
                </div>
                <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 3 }}>Employee Filter</label>
                    <input type="text" placeholder="Name or code…" value={filters.employee} onChange={e => setFilters(f => ({ ...f, employee: e.target.value }))}
                        style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.75rem', outline: 'none', minWidth: 150 }} />
                </div>
                <button onClick={() => load(filters)} style={{ padding: '6px 12px', borderRadius: 6, background: '#bb0633', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Search size={13} /> Apply
                </button>
                <button onClick={() => { setFilters({ from_date: '', to_date: '', employee: '' }); load({ from_date: '', to_date: '', employee: '' }); }}
                    style={{ padding: '6px 12px', borderRadius: 6, background: '#f1f5f9', color: '#64748b', border: 'none', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>
                    Clear
                </button>
            </div>

            {/* KPI Cards */}
            {data && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 10, marginBottom: 20 }}>
                    <KPI icon={FileText} label="Total Claims" value={s.total_claims} color="#bb0633" />
                    <KPI icon={IndianRupee} label="Total Submitted" value={`₹${fmt(s.total_submitted)}`} color="#3b82f6" />
                    <KPI icon={TrendingUp} label="Over Eligibility" value={`₹${fmt(s.total_over_eligibility)}`} color="#bb0633" sub="Applied over limit" />
                    <KPI icon={CheckCircle} label="Total Approved" value={`₹${fmt(s.total_approved)}`} color="#10b981" sub={`Approval rate: ${s.approval_rate}%`} />
                    <KPI icon={TrendingDown} label="Cost Savings" value={`₹${fmt(s.savings)}`} color="#f59e0b" sub="Submitted − Approved" />
                    <KPI icon={Clock} label="Pending" value={s.pending_count} color="#f59e0b" />
                    <KPI icon={CheckCircle} label="Settled" value={s.approved_count} color="#10b981" />
                    <KPI icon={XCircle} label="Rejected" value={s.rejected_count} color="#ef4444" />
                </div>
            )}


            {/* Tabs + Search */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button style={tabStyle('employee')} onClick={() => { setActiveTab('employee'); setExpandedEmployee(null); }}><Users size={13} style={{ display: 'inline', marginRight: 4 }} />By Employee</button>
                    <button style={tabStyle('approver')} onClick={() => { setActiveTab('approver'); setExpandedEmployee(null); }}><UserCheck size={13} style={{ display: 'inline', marginRight: 4 }} />By Approver</button>
                </div>
                <div style={{ position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input type="text" placeholder="Search table…" value={search} onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: 26, padding: '5px 10px 5px 26px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.75rem', outline: 'none', minWidth: 180 }} />
                </div>
            </div>

            {/* Table */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                        <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
                        <p>Loading report…</p>
                    </div>
                ) : activeTab === 'employee' ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '6px 10px', background: '#f8fafc', fontSize: '0.68rem', fontWeight: 700, color: '#475569', textAlign: 'left', textTransform: 'uppercase' }}>#</th>
                                    <SortTh label="Employee" field="employee_name" sort={empSort} setSort={setEmpSort} />
                                    <SortTh label="Dept" field="department" sort={empSort} setSort={setEmpSort} />
                                    <SortTh label="Claims" field="total_claims" sort={empSort} setSort={setEmpSort} />
                                    <SortTh label="Submitted (₹)" field="total_submitted" sort={empSort} setSort={setEmpSort} />
                                    <SortTh label="Over Limit (₹)" field="total_over_eligibility" sort={empSort} setSort={setEmpSort} />
                                    <SortTh label="Approved (₹)" field="total_approved" sort={empSort} setSort={setEmpSort} />
                                    <th style={{ padding: '6px 10px', background: '#f8fafc', fontSize: '0.68rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Approval %</th>
                                    <SortTh label="Pending" field="pending_count" sort={empSort} setSort={setEmpSort} />
                                    <SortTh label="Settled" field="approved_count" sort={empSort} setSort={setEmpSort} />
                                    <SortTh label="Rejected" field="rejected_count" sort={empSort} setSort={setEmpSort} />
                                    <th style={{ padding: '6px 10px', background: '#f8fafc', width: 28 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {empRows.length === 0 ? (
                                    <tr><td colSpan={12} style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: '0.82rem' }}>No data found</td></tr>
                                ) : empRows.map((r, i) => {
                                    const approvalPct = parseFloat(pct(r.total_approved, r.total_submitted));
                                    const isExpanded = expandedEmployee === r.employee_code;
                                    return (
                                        <React.Fragment key={r.employee_code}>
                                        <tr
                                            style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer', background: isExpanded ? '#f8fafc' : '' }}
                                            onClick={() => setExpandedEmployee(isExpanded ? null : r.employee_code)}
                                            onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#f8fafc'; }}
                                            onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = ''; }}
                                        >
                                            <td style={{ padding: '8px 10px 8px 14px', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600 }}>{i + 1}</td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.78rem' }}>{r.employee_name}</div>
                                                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 1 }}>{r.employee_code}</div>
                                                <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 1 }}>{r.designation}</div>
                                            </td>
                                            <td style={{ padding: '8px 10px', fontSize: '0.75rem', color: '#475569' }}>{r.department || '—'}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 5, fontWeight: 700, fontSize: '0.75rem', border: '1px solid #e2e8f0' }}>{r.total_claims}</span>
                                            </td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <div style={{ fontWeight: 700, color: '#3b82f6', fontSize: '0.78rem' }}>₹{fmt(r.total_submitted)}</div>
                                                <div style={{ marginTop: 4 }}><Bar value={r.total_submitted} max={maxSub} color="#3b82f6" /></div>
                                            </td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <div style={{ fontWeight: 700, color: r.total_over_eligibility > 0 ? '#bb0633' : '#64748b', fontSize: '0.78rem' }}>₹{fmt(r.total_over_eligibility)}</div>
                                                <div style={{ marginTop: 4 }}><Bar value={r.total_over_eligibility} max={maxSub} color="#bb0633" /></div>
                                            </td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <div style={{ fontWeight: 700, color: '#10b981', fontSize: '0.78rem' }}>₹{fmt(r.total_approved)}</div>
                                                <div style={{ marginTop: 4 }}><Bar value={r.total_approved} max={maxSub} color="#10b981" /></div>
                                            </td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <span style={{ fontWeight: 800, fontSize: '0.78rem', color: approvalPct >= 90 ? '#10b981' : approvalPct >= 70 ? '#f59e0b' : '#ef4444' }}>{approvalPct}%</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 700 }}>{r.pending_count}</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                <span style={{ background: '#ecfdf5', color: '#065f46', padding: '2px 6px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 700 }}>{r.approved_count}</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                <span style={{ background: '#fef2f2', color: '#991b1b', padding: '2px 6px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 700 }}>{r.rejected_count}</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                {isExpanded ? <ChevronUp size={14} color="#bb0633" /> : <ChevronDown size={14} color="#94a3b8" />}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={12} style={{ padding: '8px 12px', background: '#f8fafc' }}>
                                                    <div style={{
                                                        background: '#fff',
                                                        borderRadius: 8,
                                                        border: '1px solid #e2e8f0',
                                                        boxShadow: '0 2px 4px -1px rgba(0,0,0,0.03), 0 1px 2px -1px rgba(0,0,0,0.02)',
                                                        overflow: 'hidden',
                                                        padding: '8px 10px'
                                                    }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            📋 Individual Claims — {r.employee_name}
                                                        </div>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                                                            <thead>
                                                                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                                                                    {['#','Trip','Route','Trip Date','Submitted (₹)','Over Limit (₹)','Approved (₹)','Status','Filed On'].map(h => (
                                                                        <th key={h} style={{ padding: '5px 6px', textAlign: 'left', fontWeight: 650, color: '#475569', whiteSpace: 'nowrap' }}>{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {(r.claims || []).map((c, ci) => {
                                                                    const st = (c.status || '').toLowerCase();
                                                                    const stColor = st.includes('paid') || st.includes('complet') || st.includes('transfer') ? { bg: '#ecfdf5', fg: '#065f46' }
                                                                        : st.includes('reject') ? { bg: '#fef2f2', fg: '#991b1b' }
                                                                        : { bg: '#fef3c7', fg: '#b45309' };
                                                                    return (
                                                                        <tr key={c.claim_id} style={{ borderBottom: '1px solid #e2e8f0', background: ci % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                                                            <td style={{ padding: '5px 6px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{ci + 1}</td>
                                                                            <td style={{ padding: '5px 6px', color: '#475569', whiteSpace: 'nowrap' }}>{c.trip_id || '—'}</td>
                                                                            <td style={{ padding: '5px 6px', color: '#334155', whiteSpace: 'nowrap' }}>{c.source} → {c.destination}</td>
                                                                            <td style={{ padding: '5px 6px', color: '#475569', whiteSpace: 'nowrap' }}>{c.start_date || '—'}</td>
                                                                            <td style={{ padding: '5px 6px', fontWeight: 700, color: '#3b82f6', whiteSpace: 'nowrap' }}>₹{fmt(c.submitted)}</td>
                                                                            <td style={{ padding: '5px 6px', fontWeight: 700, color: c.over_eligibility > 0 ? '#bb0633' : '#64748b', whiteSpace: 'nowrap' }}>₹{fmt(c.over_eligibility)}</td>
                                                                            <td style={{ padding: '5px 6px', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>₹{fmt(c.approved)}</td>
                                                                            <td style={{ padding: '5px 6px' }}><span style={{ background: stColor.bg, color: stColor.fg, padding: '2px 5px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>{c.status}</span></td>
                                                                            <td style={{ padding: '5px 6px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{c.created_at}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
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
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '6px 10px', background: '#f8fafc', fontSize: '0.68rem', fontWeight: 700, color: '#475569', textAlign: 'left', textTransform: 'uppercase' }}>#</th>
                                    <SortTh label="Approver" field="approver_name" sort={apprSort} setSort={setApprSort} />
                                    <SortTh label="Dept" field="approver_dept" sort={apprSort} setSort={setApprSort} />
                                    <SortTh label="Claims Processed" field="total_processed" sort={apprSort} setSort={setApprSort} />
                                    <SortTh label="Total Submitted (₹)" field="total_submitted_amount" sort={apprSort} setSort={setApprSort} />
                                    <SortTh label="Total Approved (₹)" field="total_approved_amount" sort={apprSort} setSort={setApprSort} />
                                    <th style={{ padding: '6px 10px', background: '#f8fafc', fontSize: '0.68rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Approval %</th>
                                    <SortTh label="Approved" field="approved_count" sort={apprSort} setSort={setApprSort} />
                                    <SortTh label="Rejected" field="rejected_count" sort={apprSort} setSort={setApprSort} />
                                    <th style={{ padding: '6px 10px', background: '#f8fafc', width: 28 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {apprRows.length === 0 ? (
                                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: '0.82rem' }}>No approver data found</td></tr>
                                ) : apprRows.map((r, i) => {
                                    const approvalPct = parseFloat(pct(r.total_approved_amount, r.total_submitted_amount));
                                    const isExpanded = expandedApprover === r.approver_code;
                                    return (
                                        <React.Fragment key={r.approver_code}>
                                        <tr style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer', background: isExpanded ? '#f8fafc' : '' }}
                                            onClick={() => setExpandedApprover(isExpanded ? null : r.approver_code)}
                                            onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#f8fafc'; }}
                                            onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = ''; }}
                                        >
                                            <td style={{ padding: '8px 10px 8px 14px', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600 }}>{i + 1}</td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.78rem' }}>{r.approver_name}</div>
                                                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 1 }}>{r.approver_code}</div>
                                            </td>
                                            <td style={{ padding: '8px 10px', fontSize: '0.75rem', color: '#475569' }}>{r.approver_dept || '—'}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                <div style={{ fontWeight: 700, color: '#bb0633', fontSize: '0.82rem' }}>{r.total_processed}</div>
                                                <div style={{ marginTop: 4 }}><Bar value={r.total_processed} max={maxProc} color="#bb0633" /></div>
                                            </td>
                                            <td style={{ padding: '8px 10px', fontWeight: 700, color: '#3b82f6', fontSize: '0.78rem' }}>₹{fmt(r.total_submitted_amount)}</td>
                                            <td style={{ padding: '8px 10px', fontWeight: 700, color: '#10b981', fontSize: '0.78rem' }}>₹{fmt(r.total_approved_amount)}</td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <span style={{ fontWeight: 800, fontSize: '0.78rem', color: approvalPct >= 90 ? '#10b981' : approvalPct >= 70 ? '#f59e0b' : '#ef4444' }}>{approvalPct}%</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                <span style={{ background: '#ecfdf5', color: '#065f46', padding: '2px 6px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 700 }}>{r.approved_count}</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                <span style={{ background: '#fef2f2', color: '#991b1b', padding: '2px 6px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 700 }}>{r.rejected_count}</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                {isExpanded ? <ChevronUp size={14} color="#bb0633" /> : <ChevronDown size={14} color="#94a3b8" />}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={10} style={{ padding: '8px 12px', background: '#f8fafc' }}>
                                                    <div style={{
                                                        background: '#fff',
                                                        borderRadius: 8,
                                                        border: '1px solid #e2e8f0',
                                                        boxShadow: '0 2px 4px -1px rgba(0,0,0,0.03), 0 1px 2px -1px rgba(0,0,0,0.02)',
                                                        overflow: 'hidden',
                                                        padding: '8px 10px'
                                                    }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            📋 Individual Claims — {r.approver_name}
                                                        </div>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                                                            <thead>
                                                                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                                                                    {['#','Employee','Trip','Route','Trip Date','Submitted (₹)','Approved (₹)','Status','Filed On'].map(h => (
                                                                        <th key={h} style={{ padding: '5px 6px', textAlign: 'left', fontWeight: 650, color: '#475569', whiteSpace: 'nowrap' }}>{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {(r.claims || []).map((c, ci) => {
                                                                    const st = (c.status || '').toLowerCase();
                                                                    const stColor = st.includes('paid') || st.includes('complet') || st.includes('transfer') ? { bg: '#ecfdf5', fg: '#065f46' }
                                                                        : st.includes('reject') ? { bg: '#fef2f2', fg: '#991b1b' }
                                                                        : { bg: '#fef3c7', fg: '#b45309' };
                                                                    return (
                                                                        <tr key={c.claim_id} style={{ borderBottom: '1px solid #e2e8f0', background: ci % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                                                            <td style={{ padding: '5px 6px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{ci + 1}</td>
                                                                            <td style={{ padding: '5px 6px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>{c.employee_name}</td>
                                                                            <td style={{ padding: '5px 6px', color: '#475569', whiteSpace: 'nowrap' }}>{c.trip_id || '—'}</td>
                                                                            <td style={{ padding: '5px 6px', color: '#334155', whiteSpace: 'nowrap' }}>{c.source} → {c.destination}</td>
                                                                            <td style={{ padding: '5px 6px', color: '#475569', whiteSpace: 'nowrap' }}>{c.start_date || '—'}</td>
                                                                            <td style={{ padding: '5px 6px', fontWeight: 700, color: '#3b82f6', whiteSpace: 'nowrap' }}>₹{fmt(c.submitted)}</td>
                                                                            <td style={{ padding: '5px 6px', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>₹{fmt(c.approved)}</td>
                                                                            <td style={{ padding: '5px 6px' }}><span style={{ background: stColor.bg, color: stColor.fg, padding: '2px 5px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>{c.status}</span></td>
                                                                            <td style={{ padding: '5px 6px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{c.created_at}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
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

            <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
        </div>
    );
}
