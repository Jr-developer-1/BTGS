import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { 
    Search, Filter, ShieldCheck, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, 
    ChevronsLeft, ChevronsRight, Download, Calendar, RefreshCcw, Loader2, Clock,
    Plane, UploadCloud, Users, X
} from 'lucide-react';

const getActionBadgeStyle = (action) => {
    const normalized = (action || '').toUpperCase();
    let bg = '#f1f5f9';
    let color = '#475569';
    let border = '#cbd5e1';

    switch (normalized) {
        case 'LOGIN':
            bg = '#ecfdf5'; color = '#065f46'; border = '#a7f3d0';
            break;
        case 'LOGOUT':
            bg = '#f8fafc'; color = '#64748b'; border = '#e2e8f0';
            break;
        case 'CREATE':
            bg = '#f0fdfa'; color = '#0f766e'; border = '#99f6e4';
            break;
        case 'UPDATE':
            bg = '#eef2ff'; color = '#3730a3'; border = '#c7d2fe';
            break;
        case 'DELETE':
        case 'HARD_DELETE':
        case 'REJECT':
        case 'LOGIN_FAILED':
            bg = '#fef2f2'; color = '#991b1b'; border = '#fecaca';
            break;
        case 'APPROVE':
            bg = '#ecfeff'; color = '#0e7490'; border = '#a5f3fc';
            break;
        case 'PAY':
        case 'TRANSFER':
            bg = '#faf5ff'; color = '#6b21a8'; border = '#e9d5ff';
            break;
        case 'SUBMIT':
            bg = '#fffbeb'; color = '#b45309'; border = '#fde68a';
            break;
        case 'VIEW':
            bg = '#eff6ff'; color = '#1d4ed8'; border = '#bfdbfe';
            break;
    }
    
    return {
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        padding: '4px 12px',
        borderRadius: '8px',
        fontSize: '0.7rem',
        fontWeight: 800,
        display: 'inline-flex',
        alignItems: 'center',
        letterSpacing: '0.03em',
        lineHeight: '1.2'
    };
};

const renderActivityDetails = (act) => {
    const details = act.details;
    const action = (act.action || '').toUpperCase();

    if (!details || typeof details !== 'object') {
        return <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>{act.object_repr}</div>;
    }

    if (['LOGIN', 'LOGOUT', 'PAGE_ACCESS', 'APPROVE', 'REJECT', 'PAY', 'TRANSFER'].includes(action)) {
        let note = details.reason || details.remarks || details.note || '';
        return (
            <div style={{ marginTop: '4px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>{act.object_repr}</div>
                {note && <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '2px', fontStyle: 'italic' }}>Note: {note}</div>}
            </div>
        );
    }

    if (action === 'UPDATE') {
        const updates = Object.entries(details).filter(([k]) => k !== 'id' && k !== 'updated_at');
        if (updates.length === 0) {
            return <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>{act.object_repr} (No field changes recorded)</div>;
        }
        return (
            <div style={{ marginTop: '4px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>{act.object_repr}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {updates.map(([key, change]) => {
                        const oldVal = change && typeof change === 'object' ? String(change.old ?? '') : '';
                        const newVal = change && typeof change === 'object' ? String(change.new ?? '') : '';
                        
                        if (key.includes('password') || oldVal.length > 150 || newVal.length > 150) {
                            return (
                                <div key={key} style={{ fontSize: '0.7rem', color: '#4f46e5', fontFamily: 'monospace', fontWeight: 600 }}>
                                    Modified {key}
                                </div>
                            );
                        }
                        
                        return (
                            <div key={key} style={{
                                display: 'inline-flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.75rem',
                                fontFamily: 'monospace',
                                background: '#f5f3ff',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid #ddd6fe',
                                width: 'fit-content',
                                maxWidth: '100%'
                            }}>
                                <span style={{ fontWeight: 700, color: '#4338ca' }}>{key}:</span>
                                <span style={{ textDecoration: 'line-through', color: '#94a3b8', background: '#f1f5f9', padding: '0 4px', borderRadius: '4px', wordBreak: 'break-all' }}>{oldVal || '(empty)'}</span>
                                <span style={{ fontWeight: 800, color: '#6366f1' }}>&rarr;</span>
                                <span style={{ fontWeight: 700, color: '#047857', background: '#ecfdf5', padding: '0 4px', borderRadius: '4px', wordBreak: 'break-all' }}>{newVal || '(empty)'}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    if (action === 'CREATE') {
        const keys = Object.entries(details)
            .filter(([k, v]) => v !== null && v !== '' && k !== 'id' && k !== 'created_at' && k !== 'updated_at')
            .map(([k]) => k);
            
        return (
            <div style={{ marginTop: '4px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>{act.object_repr}</div>
                {keys.length > 0 && (
                    <div style={{ 
                        fontSize: '0.7rem', 
                        color: '#64748b', 
                        marginTop: '6px', 
                        background: '#f8fafc', 
                        padding: '6px 10px', 
                        borderRadius: '6px', 
                        border: '1px solid #e2e8f0',
                        lineHeight: '1.4'
                    }}>
                        <span style={{ fontWeight: 700, color: '#475569' }}>Populated fields:</span> {keys.join(', ')}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>{act.object_repr}</div>
        </div>
    );
};

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

    const [stats, setStats] = useState({
        trips_count: 0,
        batches_count: 0,
        users_count: 0,
        trips: [],
        batches: [],
        users: []
    });
    const [statsLoading, setStatsLoading] = useState(false);
    const [activeModal, setActiveModal] = useState(null);
    const [modalFilters, setModalFilters] = useState({
        startDate: '',
        endDate: '',
        status: 'All'
    });

    useEffect(() => {
        if (activeModal) {
            setModalFilters({
                startDate: filters.startDate,
                endDate: filters.endDate,
                status: 'All'
            });
        }
    }, [activeModal, filters.startDate, filters.endDate]);

    const fetchStats = async () => {
        setStatsLoading(true);
        try {
            const params = {};
            if (filters.search) params.search = filters.search;
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;

            const response = await api.get('/api/login-history/stats/', { params });
            setStats(response.data);
        } catch (error) {
            console.error("Failed to fetch login history stats:", error);
        } finally {
            setStatsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLogs(1);
            fetchStats();
        }, 300);
        return () => clearTimeout(timer);
    }, [filters.search, filters.startDate, filters.endDate]);

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

    const filteredTrips = (stats.trips || []).filter(trip => {
        if (modalFilters.startDate) {
            const start = new Date(modalFilters.startDate);
            start.setHours(0, 0, 0, 0);
            const tripDate = new Date(trip.created_at);
            if (tripDate < start) return false;
        }
        if (modalFilters.endDate) {
            const end = new Date(modalFilters.endDate);
            end.setHours(23, 59, 59, 999);
            const tripDate = new Date(trip.created_at);
            if (tripDate > end) return false;
        }
        if (modalFilters.status && modalFilters.status !== 'All') {
            if (trip.status !== modalFilters.status) return false;
        }
        return true;
    });

    const filteredBatches = (stats.batches || []).filter(batch => {
        if (modalFilters.startDate) {
            const start = new Date(modalFilters.startDate);
            start.setHours(0, 0, 0, 0);
            const batchDate = new Date(batch.created_at);
            if (batchDate < start) return false;
        }
        if (modalFilters.endDate) {
            const end = new Date(modalFilters.endDate);
            end.setHours(23, 59, 59, 999);
            const batchDate = new Date(batch.created_at);
            if (batchDate > end) return false;
        }
        if (modalFilters.status && modalFilters.status !== 'All') {
            if (batch.status !== modalFilters.status) return false;
        }
        return true;
    });

    const filteredUsers = (stats.users || []).filter(userObj => {
        if (modalFilters.startDate) {
            const start = new Date(modalFilters.startDate);
            start.setHours(0, 0, 0, 0);
            const userDate = new Date(userObj.last_login);
            if (userDate < start) return false;
        }
        if (modalFilters.endDate) {
            const end = new Date(modalFilters.endDate);
            end.setHours(23, 59, 59, 999);
            const userDate = new Date(userObj.last_login);
            if (userDate > end) return false;
        }
        return true;
    });

    const handleModalExport = () => {
        let csvContent = "";
        let fileName = "";

        if (activeModal === 'trips') {
            const headers = ["Trip ID", "Created By ID", "Created By Name", "Destination", "Start Date", "End Date", "Status", "Created At"];
            const rows = filteredTrips.map(trip => [
                trip.trip_id,
                trip.user_id,
                trip.user_name,
                trip.destination,
                trip.start_date,
                trip.end_date,
                trip.status,
                format(new Date(trip.created_at), 'yyyy-MM-dd HH:mm:ss')
            ]);
            csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
            fileName = `trips_created_report_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        } else if (activeModal === 'batches') {
            const headers = ["Batch ID", "Uploaded By ID", "Uploaded By Name", "File Name", "Status", "Created At"];
            const rows = filteredBatches.map(batch => [
                batch.id,
                batch.user_id,
                batch.user_name,
                batch.file_name,
                batch.status,
                format(new Date(batch.created_at), 'yyyy-MM-dd HH:mm:ss')
            ]);
            csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
            fileName = `bulk_uploads_report_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        } else if (activeModal === 'users') {
            const headers = ["Employee ID", "Name", "Email", "Logins Count", "Last Active At"];
            const rows = filteredUsers.map(u => [
                u.employee_id,
                u.name,
                u.email || '--',
                u.login_count,
                format(new Date(u.last_login), 'yyyy-MM-dd HH:mm:ss')
            ]);
            csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
            fileName = `unique_users_report_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        }

        if (csvContent) {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

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
                            onClick={() => {
                                fetchLogs(pagination.currentPage);
                                fetchStats();
                            }}
                        >
                            <RefreshCcw size={18} className={isLoading ? 'animate-spin' : ''} />
                            Refresh Data
                        </button>
                    </div>
                </div>
            </div>

            <div className="content-inner-wrapper" style={{ padding: '16px 40px', maxWidth: '1600px', margin: '0 auto' }}>
                {/* Stats Cards Section */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                    gap: '24px', 
                    marginBottom: '24px' 
                }}>
                    {/* Card 1: Trips Created */}
                    <div 
                        onClick={() => setActiveModal('trips')}
                        style={{
                            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                            border: '1px solid #e2e8f0',
                            borderRadius: '20px',
                            padding: '24px',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '20px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                            e.currentTarget.style.borderColor = 'var(--primary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)';
                            e.currentTarget.style.borderColor = '#e2e8f0';
                        }}
                    >
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '16px',
                            backgroundColor: '#e0f2fe',
                            color: '#0284c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <Plane size={28} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Trips Created</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                                {statsLoading ? <Loader2 className="animate-spin" size={24} /> : stats.trips_count}
                            </div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--primary)' }}>Click to view details</div>
                        </div>
                    </div>

                    {/* Card 2: Bulk Uploads (Tour Plans) */}
                    <div 
                        onClick={() => setActiveModal('batches')}
                        style={{
                            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                            border: '1px solid #e2e8f0',
                            borderRadius: '20px',
                            padding: '24px',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '20px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                            e.currentTarget.style.borderColor = 'var(--primary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)';
                            e.currentTarget.style.borderColor = '#e2e8f0';
                        }}
                    >
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '16px',
                            backgroundColor: '#fdf2e9',
                            color: '#ea580c',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <UploadCloud size={28} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Bulk Uploads (Tour Plans)</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                                {statsLoading ? <Loader2 className="animate-spin" size={24} /> : stats.batches_count}
                            </div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--primary)' }}>Click to view details</div>
                        </div>
                    </div>

                    {/* Card 3: Unique Active Users */}
                    <div 
                        onClick={() => setActiveModal('users')}
                        style={{
                            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                            border: '1px solid #e2e8f0',
                            borderRadius: '20px',
                            padding: '24px',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '20px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                            e.currentTarget.style.borderColor = 'var(--primary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)';
                            e.currentTarget.style.borderColor = '#e2e8f0';
                        }}
                    >
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '16px',
                            backgroundColor: '#f0fdf4',
                            color: '#16a34a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <Users size={28} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Unique Active Users</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                                {statsLoading ? <Loader2 className="animate-spin" size={24} /> : stats.users_count}
                            </div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--primary)' }}>Click to view details</div>
                        </div>
                    </div>
                </div>

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
                                            <td colSpan="6" style={{ backgroundColor: '#f8fafc', padding: '20px 40px' }}>
                                                <div style={{ 
                                                    borderLeft: '4px solid #6366f1', 
                                                    paddingLeft: '24px',
                                                    display: 'flex', 
                                                    flexDirection: 'column', 
                                                    gap: '12px'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Clock size={16} style={{ color: '#4f46e5' }} />
                                                        <h4 style={{ 
                                                            margin: 0,
                                                            fontSize: '0.9rem', 
                                                            fontWeight: 800, 
                                                            color: '#1e293b', 
                                                            textTransform: 'uppercase', 
                                                            letterSpacing: '0.05em' 
                                                        }}>Session Activity Timeline</h4>
                                                    </div>
                                                    
                                                    {loadingActivities[log.id] ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', padding: '16px 0', fontSize: '0.85rem' }}>
                                                            <Loader2 size={16} className="animate-spin" />
                                                            <span>Assembling activity logs...</span>
                                                        </div>
                                                    ) : rowActivities[log.id] && rowActivities[log.id].length > 0 ? (
                                                        <div style={{ 
                                                            maxHeight: '280px', 
                                                            overflowY: 'auto', 
                                                            border: '1px solid #e2e8f0', 
                                                            borderRadius: '12px', 
                                                            backgroundColor: '#ffffff',
                                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -2px rgba(0, 0, 0, 0.03)'
                                                        }}>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                                <thead style={{ backgroundColor: '#f1f5f9', position: 'sticky', top: 0, zIndex: 10 }}>
                                                                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                                        <th style={{ padding: '10px 16px', textAlign: 'left', color: '#475569', fontWeight: 700, width: '100px' }}>Timestamp</th>
                                                                        <th style={{ padding: '10px 16px', textAlign: 'left', color: '#475569', fontWeight: 700, width: '120px' }}>Action</th>
                                                                        <th style={{ padding: '10px 16px', textAlign: 'left', color: '#475569', fontWeight: 700 }}>Change Artifact & Context</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {rowActivities[log.id].map((act, idx) => (
                                                                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                            <td style={{ 
                                                                                padding: '12px 16px', 
                                                                                fontSize: '0.75rem', 
                                                                                color: '#64748b', 
                                                                                fontFamily: 'monospace', 
                                                                                verticalAlign: 'top' 
                                                                            }}>
                                                                                {format(new Date(act.timestamp), 'HH:mm:ss')}
                                                                            </td>
                                                                            <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                                                                                <span style={getActionBadgeStyle(act.action)}>
                                                                                    {act.action}
                                                                                </span>
                                                                            </td>
                                                                            <td style={{ padding: '12px 16px', verticalAlign: 'top', maxWidth: '500px' }}>
                                                                                <div style={{ 
                                                                                    fontWeight: 800, 
                                                                                    color: '#0f172a', 
                                                                                    fontSize: '0.7rem', 
                                                                                    textTransform: 'uppercase', 
                                                                                    letterSpacing: '0.04em', 
                                                                                    display: 'flex', 
                                                                                    alignItems: 'center', 
                                                                                    gap: '6px' 
                                                                                }}>
                                                                                    <span style={{ height: '6px', width: '6px', backgroundColor: '#6366f1', borderRadius: '50%' }}></span>
                                                                                    {act.model_name}
                                                                                </div>
                                                                                {renderActivityDetails(act)}
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
            
            {/* Stats Drill-down Modals */}
            {activeModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.3)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <style>{`
                        @keyframes fadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                        @keyframes slideUp {
                            from { transform: translateY(20px); opacity: 0; }
                            to { transform: translateY(0); opacity: 1; }
                        }
                    `}</style>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '24px',
                        width: '90%',
                        maxWidth: '1000px',
                        maxHeight: '80%',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        overflow: 'hidden'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '24px 32px',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                    {activeModal === 'trips' && 'Trips Created Detail'}
                                    {activeModal === 'batches' && 'Bulk Uploads (Tour Plans) Detail'}
                                    {activeModal === 'users' && 'Unique Active Users Detail'}
                                </h2>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
                                    {activeModal === 'trips' && `Showing ${filteredTrips.length} of ${stats.trips.length} trips created`}
                                    {activeModal === 'batches' && `Showing ${filteredBatches.length} of ${stats.batches.length} bulk uploads`}
                                    {activeModal === 'users' && `Showing ${filteredUsers.length} of ${stats.users.length} unique active users`}
                                </p>
                            </div>
                            <button 
                                onClick={() => setActiveModal(null)}
                                style={{
                                    border: 'none',
                                    background: '#f1f5f9',
                                    borderRadius: '50%',
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#64748b',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Filter Bar */}
                        <div style={{
                            padding: '16px 32px',
                            background: '#f8fafc',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '20px',
                            flexWrap: 'wrap'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>From:</span>
                                    <input 
                                        type="date" 
                                        value={modalFilters.startDate}
                                        onChange={(e) => setModalFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                        style={{
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '10px',
                                            padding: '6px 12px',
                                            fontSize: '0.85rem',
                                            color: '#334155',
                                            outline: 'none',
                                            transition: 'border-color 0.2s'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                        onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>To:</span>
                                    <input 
                                        type="date" 
                                        value={modalFilters.endDate}
                                        onChange={(e) => setModalFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                        style={{
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '10px',
                                            padding: '6px 12px',
                                            fontSize: '0.85rem',
                                            color: '#334155',
                                            outline: 'none',
                                            transition: 'border-color 0.2s'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                        onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                                    />
                                </div>
                                {['trips', 'batches'].includes(activeModal) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Status:</span>
                                        <select 
                                            value={modalFilters.status}
                                            onChange={(e) => setModalFilters(prev => ({ ...prev, status: e.target.value }))}
                                            style={{
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '10px',
                                                padding: '6px 12px',
                                                fontSize: '0.85rem',
                                                color: '#334155',
                                                backgroundColor: '#ffffff',
                                                outline: 'none',
                                                transition: 'border-color 0.2s',
                                                cursor: 'pointer'
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                            onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                                        >
                                            {activeModal === 'trips' && ['All', ...new Set((stats.trips || []).map(t => t.status).filter(Boolean))].map(status => (
                                                <option key={status} value={status}>{status}</option>
                                            ))}
                                            {activeModal === 'batches' && ['All', ...new Set((stats.batches || []).map(b => b.status).filter(Boolean))].map(status => (
                                                <option key={status} value={status}>{status}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {(modalFilters.startDate || modalFilters.endDate || modalFilters.status !== 'All') && (
                                    <button
                                        onClick={() => setModalFilters({ startDate: '', endDate: '', status: 'All' })}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--primary)',
                                            fontSize: '0.85rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        Clear Filter
                                    </button>
                                )}
                            </div>
                            <div>
                                <button
                                    onClick={handleModalExport}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 16px',
                                        borderRadius: '10px',
                                        fontWeight: 700,
                                        fontSize: '0.85rem',
                                        background: 'var(--primary)',
                                        color: '#ffffff',
                                        border: 'none',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 6px -1px rgba(0, 128, 128, 0.2)'
                                    }}
                                >
                                    <Download size={16} />
                                    Export CSV
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div style={{
                            padding: '32px',
                            overflowY: 'auto',
                            flex: 1
                        }}>
                            {activeModal === 'trips' && (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>
                                            <th style={{ padding: '12px 16px' }}>Trip ID</th>
                                            <th style={{ padding: '12px 16px' }}>Created By</th>
                                            <th style={{ padding: '12px 16px' }}>Destination</th>
                                            <th style={{ padding: '12px 16px' }}>Travel Dates</th>
                                            <th style={{ padding: '12px 16px' }}>Status</th>
                                            <th style={{ padding: '12px 16px' }}>Created At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTrips.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No trips created in this period.</td>
                                            </tr>
                                        ) : (
                                            filteredTrips.map((trip) => (
                                                <tr key={trip.trip_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '16px 16px', fontWeight: 700, color: 'var(--primary)' }}>{trip.trip_id}</td>
                                                    <td style={{ padding: '16px 16px' }}>
                                                        <div style={{ fontWeight: 600, color: '#334155' }}>{trip.user_name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID: {trip.user_id}</div>
                                                    </td>
                                                    <td style={{ padding: '16px 16px', color: '#475569' }}>{trip.destination}</td>
                                                    <td style={{ padding: '16px 16px', fontSize: '0.8rem', color: '#64748b' }}>
                                                        {trip.start_date} &rarr; {trip.end_date}
                                                    </td>
                                                    <td style={{ padding: '16px 16px' }}>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            background: trip.status === 'Approved' ? '#ecfdf5' : '#fffbeb',
                                                            color: trip.status === 'Approved' ? '#065f46' : '#b45309'
                                                        }}>{trip.status}</span>
                                                    </td>
                                                    <td style={{ padding: '16px 16px', fontSize: '0.8rem', color: '#94a3b8' }}>
                                                        {format(new Date(trip.created_at), 'PPp')}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}

                            {activeModal === 'batches' && (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>
                                            <th style={{ padding: '12px 16px' }}>Batch ID</th>
                                            <th style={{ padding: '12px 16px' }}>Uploaded By</th>
                                            <th style={{ padding: '12px 16px' }}>File Name</th>
                                            <th style={{ padding: '12px 16px' }}>Status</th>
                                            <th style={{ padding: '12px 16px' }}>Created At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredBatches.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No bulk uploads created in this period.</td>
                                            </tr>
                                        ) : (
                                            filteredBatches.map((batch) => (
                                                <tr key={batch.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '16px 16px', fontWeight: 700, color: 'var(--primary)' }}># {batch.id}</td>
                                                    <td style={{ padding: '16px 16px' }}>
                                                        <div style={{ fontWeight: 600, color: '#334155' }}>{batch.user_name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID: {batch.user_id}</div>
                                                    </td>
                                                    <td style={{ padding: '16px 16px', color: '#475569', fontFamily: 'monospace' }}>{batch.file_name}</td>
                                                    <td style={{ padding: '16px 16px' }}>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            background: batch.status === 'Approved' ? '#ecfdf5' : '#fffbeb',
                                                            color: batch.status === 'Approved' ? '#065f46' : '#b45309'
                                                        }}>{batch.status}</span>
                                                    </td>
                                                    <td style={{ padding: '16px 16px', fontSize: '0.8rem', color: '#94a3b8' }}>
                                                        {format(new Date(batch.created_at), 'PPp')}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}

                            {activeModal === 'users' && (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>
                                            <th style={{ padding: '12px 16px' }}>Employee ID</th>
                                            <th style={{ padding: '12px 16px' }}>Name</th>
                                            <th style={{ padding: '12px 16px' }}>Email</th>
                                            <th style={{ padding: '12px 16px' }}>Logins Count</th>
                                            <th style={{ padding: '12px 16px' }}>Last Active At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No unique users found in this period.</td>
                                            </tr>
                                        ) : (
                                            filteredUsers.map((userObj) => (
                                                <tr key={userObj.employee_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '16px 16px', fontWeight: 700, color: 'var(--primary)' }}>{userObj.employee_id}</td>
                                                    <td style={{ padding: '16px 16px', fontWeight: 600, color: '#334155' }}>{userObj.name}</td>
                                                    <td style={{ padding: '16px 16px', color: '#475569' }}>{userObj.email || '--'}</td>
                                                    <td style={{ padding: '16px 16px', fontWeight: 700, color: '#0f172a' }}>
                                                        {userObj.login_count} {userObj.login_count === 1 ? 'session' : 'sessions'}
                                                    </td>
                                                    <td style={{ padding: '16px 16px', fontSize: '0.8rem', color: '#64748b' }}>
                                                        {format(new Date(userObj.last_login), 'PPp')}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '16px 32px',
                            borderTop: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            backgroundColor: '#f8fafc'
                        }}>
                            <button
                                onClick={() => setActiveModal(null)}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '12px',
                                    border: '1px solid #cbd5e1',
                                    background: '#ffffff',
                                    color: '#475569',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                            >
                                Close Detail
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
);
};

export default LoginHistory;