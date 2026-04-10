import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { 
    Search, Filter, ShieldCheck, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, 
    ChevronsLeft, ChevronsRight, Download, Calendar, RefreshCcw, Loader2, Clock
} from 'lucide-react';

const LoginHistory = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [expandedRow, setExpandedRow] = useState(null);
    const [rowActivities, setRowActivities] = useState({});
    const [loadingActivities, setLoadingActivities] = useState({});
    const [pagination, setPagination] = useState({
        count: 0,
        next: null,
        previous: null,
        currentPage: 1
    });
    const [filters, setFilters] = useState({
        search: '',
        startDate: '',
        endDate: ''
    });

    useEffect(() => {
        fetchLogs(1);
    }, [filters]);

    const fetchLogs = async (page = 1) => {
        setIsLoading(true);
        try {
            const params = { page };
            if (filters.search) params.search = filters.search;
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;

            const response = await api.get('/api/login-history/', { params });
            const data = response.data;

            if (data.results) {
                setLogs(data.results);
                setPagination({
                    count: data.count,
                    next: data.next,
                    previous: data.previous,
                    currentPage: page,
                    totalPages: data.total_pages || Math.ceil(data.count / 20)
                });
            } else {
                setLogs(data);
                setPagination({
                    count: data.length,
                    next: null,
                    previous: null,
                    currentPage: 1,
                    totalPages: 1
                });
            }
        } catch (error) {
            console.error("Failed to fetch login history:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchActivities = async (historyId) => {
        if (rowActivities[historyId]) return;
        
        setLoadingActivities(prev => ({ ...prev, [historyId]: true }));
        try {
            const response = await api.get(`/api/login-history/${historyId}/activities/`);
            setRowActivities(prev => ({ ...prev, [historyId]: response.data }));
        } catch (error) {
            console.error("Failed to fetch activities:", error);
        } finally {
            setLoadingActivities(prev => ({ ...prev, [historyId]: false }));
        }
    };

    const toggleRow = (historyId) => {
        if (expandedRow === historyId) {
            setExpandedRow(null);
        } else {
            setExpandedRow(historyId);
            fetchActivities(historyId);
        }
    };

    const handleSearchChange = (e) => {
        setFilters(prev => ({ ...prev, search: e.target.value }));
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const params = new URLSearchParams();
            if (filters.search) params.append('search', filters.search);
            if (filters.startDate) params.append('start_date', filters.startDate);
            if (filters.endDate) params.append('end_date', filters.endDate);

            const response = await api.get(`/api/login-history/export-csv/?${params.toString()}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `login_history_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Export failed:", error);
            showToast("Failed to export logs. Please try again.", "error");
        } finally {
            setIsExporting(false);
        }
    };

    const clearFilters = () => {
        setFilters({
            search: '',
            startDate: '',
            endDate: ''
        });
    };

    const totalPages = pagination.totalPages || Math.ceil(pagination.count / 20);

    return (
        <div className="login-history-module animate-fade-in" style={{ padding: '0', background: 'transparent' }}>
            <div className="master-page-header" style={{ padding: '20px 40px 0 40px', background: 'transparent', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px', letterSpacing: '-0.02em' }}>Login History</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>Monitor and track system access and user sessions.</p>
                    </div>
                    <div className="header-actions" style={{ display: 'flex', gap: '12px' }}>
                        <button 
                            className="tab-switcher-btn" 
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                padding: '12px 24px', 
                                borderRadius: '14px', 
                                fontWeight: 700, 
                                background: 'white', 
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                color: 'var(--text-main)'
                            }}
                            onClick={handleExport} 
                            disabled={isExporting || isLoading}
                        >
                            {isExporting ? <RefreshCcw size={18} className="animate-spin" /> : <Download size={18} className="text-primary" />}
                            {isExporting ? 'Exporting...' : 'Export CSV'}
                        </button>
                        <button 
                            className="tab-switcher-btn active"
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                padding: '12px 24px', 
                                borderRadius: '14px', 
                                fontWeight: 700, 
                                background: 'var(--primary)', 
                                color: 'white',
                                border: 'none',
                                boxShadow: '0 10px 15px -3px rgba(0, 128, 128, 0.3)'
                            }}
                            onClick={() => fetchLogs(pagination.currentPage)}
                        >
                            <RefreshCcw size={18} className={isLoading ? 'animate-spin' : ''} />
                            Refresh Data
                        </button>
                    </div>
                </div>
            </div>

            <div className="content-inner-wrapper" style={{ padding: '16px 40px', maxWidth: '1600px', margin: '0 auto' }}>
                <div className="filters-bar glass" style={{ 
                    background: 'rgba(255, 255, 255, 0.6)', 
                    padding: '24px', 
                    borderRadius: '20px', 
                    marginBottom: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '20px'
                }}>
                    <div className="flex items-center gap-6" style={{ flex: 1 }}>
                        <div className="search-box search-box-premium" style={{ 
                            background: 'white', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '14px',
                            padding: '12px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            flex: 1,
                            maxWidth: '400px'
                        }}>
                            <Search size={20} className="text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by user ID, Name or IP..."
                                value={filters.search}
                                onChange={handleSearchChange}
                                style={{ border: 'none', outline: 'none', width: '100%', fontWeight: 500, color: 'var(--text-main)' }}
                            />
                        </div>

                        <div className="filter-group" style={{ 
                            background: 'white', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '14px',
                            padding: '10px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <Calendar size={18} className="text-primary" />
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                style={{ border: 'none', outline: 'none', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}
                            />
                            <span style={{ fontWeight: 800, color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase' }}>To</span>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                style={{ border: 'none', outline: 'none', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}
                            />
                        </div>
                    </div>

                    <button 
                        className="text-btn" 
                        style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}
                        onClick={clearFilters}
                    >
                        Clear All Filters
                    </button>
                </div>

                <div className="table-container premium-card custom-scrollbar" style={{ marginBottom: '32px', overflow: 'auto', borderRadius: '20px' }}>
                    <table className="data-table">
                        <thead>
                            <tr style={{ background: 'rgba(241, 245, 249, 0.5)' }}>
                                <th className="w-10"></th>
                                <th style={{ padding: '20px 24px', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>User Details</th>
                                <th style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Network Context</th>
                                <th style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Access Timestamp</th>
                                <th style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Termination</th>
                                <th style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Session Life</th>
                            </tr>
                        </thead>
                        <tbody>
                        {isLoading ? (
                            <tr><td colSpan="6" className="text-center">Loading logs...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan="6" className="text-center">No login history found.</td></tr>
                        ) : (
                            logs.map(log => (
                                <React.Fragment key={log.id}>
                                    <tr 
                                        onClick={() => toggleRow(log.id)} 
                                        className={`premium-row ${expandedRow === log.id ? 'active' : ''}`}
                                        style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                                    >
                                        <td className="text-center">
                                            <div style={{ 
                                                width: '28px', 
                                                height: '28px', 
                                                borderRadius: '8px', 
                                                background: expandedRow === log.id ? 'var(--primary-light)' : '#f1f5f9',
                                                color: expandedRow === log.id ? 'var(--primary)' : '#94a3b8',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto'
                                            }}>
                                                {expandedRow === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div className="flex items-center gap-4">
                                                <div className="avatar" style={{ 
                                                    width: '40px', 
                                                    height: '40px', 
                                                    borderRadius: '12px', 
                                                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                                                    color: 'white',
                                                    fontWeight: 800,
                                                    fontSize: '1.1rem',
                                                    boxShadow: '0 4px 10px rgba(0, 128, 128, 0.2)'
                                                }}>
                                                    {log.user_name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>{log.user_name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{log.user_email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck size={14} className="text-teal-500" />
                                                <span style={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>{log.ip_address || 'Internal Network'}</span>
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>{format(new Date(log.login_time), 'PPp')}</td>
                                        <td>
                                            {log.logout_time ? (
                                                <span style={{ fontWeight: 600, color: '#94a3b8', fontSize: '0.85rem' }}>{format(new Date(log.logout_time), 'PPp')}</span>
                                            ) : (
                                                <div className="flex items-center gap-2" style={{ color: '#10b981', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    <div className="pulse-glow" style={{ width: '8px', height: '8px' }}></div>
                                                    Active Session
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            {log.logout_time ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--text-main)' }}>
                                                    <Clock size={14} className="text-slate-400" />
                                                    {(() => {
                                                        const diff = new Date(log.logout_time) - new Date(log.login_time);
                                                        const minutes = Math.floor(diff / 60000);
                                                        const hours = Math.floor(minutes / 60);
                                                        return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
                                                    })()}
                                                </div>
                                            ) : (
                                                <span className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 500 }}>Ongoing...</span>
                                            )}
                                        </td>
                                    </tr>
                                    {expandedRow === log.id && (
                                        <tr>
                                            <td colSpan="6" className="bg-gray-50 p-4">
                                                <div className="pl-10">
                                                    <h4 className="font-bold text-sm mb-2">Session Activity</h4>
                                                    {loadingActivities[log.id] ? (
                                                        <div className="flex items-center gap-2 text-muted py-4">
                                                            <Loader2 size={16} className="animate-spin" />
                                                            <span>Loading activities...</span>
                                                        </div>
                                                    ) : rowActivities[log.id] && rowActivities[log.id].length > 0 ? (
                                                        <div className="max-h-60 overflow-y-auto border rounded bg-white">
                                                            <table className="w-full text-sm">
                                                                <thead className="bg-gray-100 sticky top-0">
                                                                    <tr>
                                                                        <th className="p-2 text-left">Time</th>
                                                                        <th className="p-2 text-left">Action</th>
                                                                        <th className="p-2 text-left">Details</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {rowActivities[log.id].map((act, idx) => (
                                                                        <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                                                            <td className="p-2 text-xs text-muted font-mono whitespace-nowrap">
                                                                                {format(new Date(act.timestamp), 'HH:mm:ss')}
                                                                            </td>
                                                                            <td className="p-2">
                                                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${act.action === 'VIEW' ? 'bg-blue-100 text-blue-800' :
                                                                                    act.action === 'LOGIN' ? 'bg-green-100 text-green-800' :
                                                                                        act.action === 'LOGOUT' ? 'bg-gray-100 text-gray-800' :
                                                                                            'bg-yellow-100 text-yellow-800'
                                                                                    }`}>
                                                                                    {act.action}
                                                                                </span>
                                                                            </td>
                                                                            <td className="p-2">
                                                                                <div className="font-medium text-gray-900">{act.model_name}</div>
                                                                                <div className="text-xs text-muted truncate max-w-lg" title={act.object_repr}>
                                                                                    {act.object_repr}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        <div className="text-muted text-sm italic">No activity recorded for this session.</div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {pagination.count > 0 && (
                <div className="pagination-bar">
                    <div className="pagination-info">
                        Showing {logs.length} of {pagination.count} records (Page {pagination.currentPage} of {totalPages})
                    </div>
                    <div className="pagination-controls">
                        <button
                            className="pagination-btn"
                            onClick={() => fetchLogs(1)}
                            disabled={pagination.currentPage === 1 || isLoading}
                            title="First Page"
                        >
                            <ChevronsLeft size={18} />
                        </button>
                        <button
                            className="pagination-btn"
                            onClick={() => fetchLogs(pagination.currentPage - 1)}
                            disabled={!pagination.previous || isLoading}
                            title="Previous Page"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="page-number">{pagination.currentPage}</div>
                        <button
                            className="pagination-btn"
                            onClick={() => fetchLogs(pagination.currentPage + 1)}
                            disabled={!pagination.next || isLoading}
                            title="Next Page"
                        >
                            <ChevronRight size={18} />
                        </button>
                        <button
                            className="pagination-btn"
                            onClick={() => fetchLogs(totalPages)}
                            disabled={pagination.currentPage === totalPages || isLoading}
                            title="Last Page"
                        >
                            <ChevronsRight size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
);
};

export default LoginHistory;