import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { Search, Eye, ArrowRight, FileText, User, Box, Activity, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Calendar, RefreshCcw } from 'lucide-react';
import Modal from '../components/Modal';

const AuditLogs = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const [pagination, setPagination] = useState({
        count: 0,
        next: null,
        previous: null,
        currentPage: 1
    });
    const [filters, setFilters] = useState({
        search: '',
        model: '',
        action: '',
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
            if (filters.model) params.model_name = filters.model;
            if (filters.action) params.action = filters.action;
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;

            const response = await api.get('/api/audit-logs/', { params });
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
            console.error("Failed to fetch audit logs:", error);
        } finally {
            setIsLoading(false);
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
            if (filters.model) params.append('model_name', filters.model);
            if (filters.action) params.append('action', filters.action);
            if (filters.startDate) params.append('start_date', filters.startDate);
            if (filters.endDate) params.append('end_date', filters.endDate);

            const response = await api.get(`/api/audit-logs/export-csv/?${params.toString()}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `audit_logs_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
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
            model: '',
            action: '',
            startDate: '',
            endDate: ''
        });
    };

    const formatLogValue = (val) => {
        if (val === null || val === undefined) return <span className="text-muted italic">null</span>;
        if (typeof val === 'boolean') return <span className="font-bold">{val ? 'True' : 'False'}</span>;

        if (Array.isArray(val)) {
            if (val.length === 0) return <span className="text-muted italic">[]</span>;
            return (
                <div className="log-array-wrapper">
                    {val.map((item, i) => (
                        <div key={i} className="log-array-item">
                            <span className="log-index">[{i}]</span>
                            {formatLogValue(item)}
                        </div>
                    ))}
                </div>
            );
        }

        if (typeof val === 'object') {
            if (Object.keys(val).length === 0) return <span className="text-muted italic">{ }</span>;
            return (
                <div className="log-obj-wrapper">
                    {Object.entries(val).map(([k, v]) => (
                        <div key={k} className="log-obj-row">
                            <span className="log-key">{k}:</span>
                            <span className="log-val">{formatLogValue(v)}</span>
                        </div>
                    ))}
                </div>
            );
        }

        return <span>{String(val)}</span>;
    };

    const renderDiff = (details) => {
        if (!details) return <p className="text-muted italic">No meaningful changes recorded.</p>;

        const entries = Object.entries(details);
        if (entries.length === 0) return <p className="text-muted italic">No changes.</p>;

        return (
            <div className="diff-view">
                {entries.map(([field, change]) => (
                    <div key={field} className="diff-item">
                        <span className="diff-field">{field}</span>
                        <div className="diff-values">
                            <div className="diff-old">
                                <span className="diff-label">Old:</span>
                                <div className="diff-content">{formatLogValue(change.old)}</div>
                            </div>
                            <div className="diff-arrow"><ArrowRight size={14} /></div>
                            <div className="diff-new">
                                <span className="diff-label">New:</span>
                                <div className="diff-content">{formatLogValue(change.new)}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const totalPages = pagination.totalPages || Math.ceil(pagination.count / 20);

    return (
        <div className="page-container animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Audit Logs</h1>
                    {/* <p>Comprehensive trail of data changes and activities.</p> */}
                </div>
                <div className="header-actions">
                    <button className="btn-secondary flex items-center gap-2" onClick={handleExport} disabled={isExporting || isLoading}>
                        {isExporting ? <RefreshCcw size={18} className="animate-spin" /> : <Download size={18} />}
                        {isExporting ? 'Exporting...' : 'Export CSV'}
                    </button>
                    <button className="btn-outline flex items-center gap-2" onClick={() => fetchLogs(pagination.currentPage)}>
                        <RefreshCcw size={18} className={isLoading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </header>

            <div className="filters-bar premium-shadow">
                <div className="flex items-center gap-4 px-6 py-4 overflow-x-auto no-scrollbar">
                    <div className="search-box search-box-premium">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search logs..."
                            value={filters.search}
                            onChange={handleSearchChange}
                            className="search-input-premium"
                        />
                    </div>

                    <div className="filter-group whitespace-nowrap">
                        <Calendar size={16} />
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                            className="filter-date"
                        />
                        <span>to</span>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                            className="filter-date"
                        />
                    </div>

                    <select
                        value={filters.action}
                        onChange={e => setFilters(prev => ({ ...prev, action: e.target.value }))}
                        className="filter-select filter-select-premium text-sm py-2 px-3 rounded-xl border-1.5 border-gray-200 focus:border-burgundy outline-none transition-all"
                    >
                        <option value="">All Actions</option>
                        <option value="CREATE">Create</option>
                        <option value="UPDATE">Update</option>
                        <option value="DELETE">Delete</option>
                        <option value="LOGIN">Login</option>
                        <option value="LOGOUT">Logout</option>
                    </select>

                    <button className="text-btn text-xs font-bold uppercase text-slate-400 hover:text-burgundy whitespace-nowrap" onClick={clearFilters}>
                        Clear Filters
                    </button>
                </div>
            </div>

            <div className="table-container premium-shadow">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>User</th>
                            <th>Action</th>
                            <th>Entity</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="5" className="text-center">Loading logs...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan="5" className="text-center">No audit logs found.</td></tr>
                        ) : (
                            logs.map(log => (
                                <tr
                                    key={log.id}
                                    className="hover-row"
                                    onClick={() => setSelectedLog(log)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <td>{format(new Date(log.timestamp), 'MMM dd, HH:mm')}</td>
                                    <td>{log.user_name || 'System'}</td>
                                    <td>
                                        <span className={`status-pill ${log.action.toLowerCase()}`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="text-sm font-semibold">{log.model_name}</div>
                                        <div className="text-xs text-muted truncate max-w-[150px]">{log.object_repr}</div>
                                    </td>
                                    <td><Eye size={16} className="text-muted hover:text-primary" /></td>
                                </tr>
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

            <Modal
                isOpen={!!selectedLog}
                onClose={() => setSelectedLog(null)}
                title="Audit Log Details"
                size="lg"
            >
                {selectedLog && (
                    <div className="log-details-modal-content">
                        <div className="grid grid-cols-3 gap-6 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="detail-group">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">
                                    <Activity size={14} /> Action
                                </label>
                                <p className="font-bold text-slate-800 text-lg">{selectedLog.action}</p>
                                <span className="text-xs font-semibold text-slate-500">{selectedLog.model_name}</span>
                            </div>

                            <div className="detail-group">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">
                                    <Box size={14} /> Object
                                </label>
                                <p className="font-bold text-slate-800">{selectedLog.object_repr}</p>
                                <span className="text-xs text-slate-400">ID: {selectedLog.object_id}</span>
                            </div>

                            <div className="detail-group">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">
                                    <User size={14} /> User
                                </label>
                                <p className="font-bold text-slate-800">{selectedLog.user_name}</p>
                                <span className="text-xs text-slate-400">{selectedLog.ip_address}</span>
                            </div>
                        </div>

                        <div className="detail-group">
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3">
                                <FileText size={16} /> Data Changes
                            </label>
                            {renderDiff(selectedLog.details)}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default AuditLogs;