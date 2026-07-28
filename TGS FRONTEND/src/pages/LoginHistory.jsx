import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext.jsx';
import { format } from 'date-fns';
import { 
    Search, Filter, ShieldCheck, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, 
    ChevronsLeft, ChevronsRight, Download, Calendar, RefreshCcw, Loader2, Clock,
    Plane, UploadCloud, Users, X, FileText
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

const getBatchStatusStyle = (status) => {
    switch (status) {
        case 'Approved':
            return { background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' };
        case 'Rejected':
            return { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' };
        case 'Submitted':
        case 'Resubmitted':
            return { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' };
        case 'Not Submitted':
            return { background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1' };
        default:
            return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
    }
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
    const { showToast } = useToast();
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [expandedRow, setExpandedRow] = useState(null);
    const [expandedBatch, setExpandedBatch] = useState(null);
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
        endDate: '',
        project: 'All'
    });

    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(false);

    const fetchProjects = async () => {
        setProjectsLoading(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s max
        try {
            const response = await api.get('/api/masters/jurisdictions/projects/', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const data = response.data.results || response.data;
            const list = Array.isArray(data) ? data : [];
            setProjects(list);
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
                console.warn('Projects fetch timed out — dropdown will populate on next load');
            } else {
                console.error("Failed to fetch projects for filter:", error);
            }
        } finally {
            setProjectsLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

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
        status: 'All',
        selectedRoles: []
    });
    const [rolesDropdownOpen, setRolesDropdownOpen] = useState(false);
    const [rolesSearch, setRolesSearch] = useState('');
    const rolesDropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (rolesDropdownRef.current && !rolesDropdownRef.current.contains(event.target)) {
                setRolesDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const uniqueRoles = useMemo(() => {
        if (activeModal === 'trips') {
            return [...new Set((stats.trips || []).map(t => t.user_role || t.user_designation).filter(Boolean))].sort();
        }
        if (activeModal === 'batches') {
            return [...new Set((stats.batches || []).map(b => b.user_role || b.user_designation).filter(Boolean))].sort();
        }
        return [];
    }, [activeModal, stats]);

    useEffect(() => {
        if (activeModal) {
            setModalFilters({
                startDate: filters.startDate,
                endDate: filters.endDate,
                status: 'All',
                selectedRoles: []
            });
            setRolesSearch('');
            setRolesDropdownOpen(false);
        }
    }, [activeModal, filters.startDate, filters.endDate]);

    const fetchStats = async () => {
        setStatsLoading(true);
        try {
            const params = {};
            if (filters.search) params.search = filters.search;
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;
            if (filters.project && filters.project !== 'All') params.project_code = filters.project;

            const response = await api.get('/api/login-history/stats/', { params });
            setStats(response.data);
        } catch (error) {
            console.error("Failed to fetch login history stats:", error);
        } finally {
            setStatsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(async () => {
            // If a project is selected, pre-check whether employee cache is warm
            if (filters.project && filters.project !== 'All') {
                try {
                    const statusRes = await api.get('/api/login-history/cache-status/');
                    if (!statusRes.data.cache_warm) {
                        showToast(
                            'Employee data is syncing from HR system. Project filter results may be incomplete — please refresh in a moment.',
                            'warning'
                        );
                    }
                } catch (_) { /* non-critical */ }
            }
            fetchLogs(1);
            fetchStats();
        }, 300);
        return () => clearTimeout(timer);
    }, [filters.search, filters.startDate, filters.endDate, filters.project]);

    const fetchLogs = async (page = 1) => {
        setIsLoading(true);
        try {
            const params = { page };
            if (filters.search) params.search = filters.search;
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;
            if (filters.project && filters.project !== 'All') params.project_code = filters.project;

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
            if (filters.project && filters.project !== 'All') params.append('project_code', filters.project);

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
            endDate: '',
            project: 'All'
        });
    };

    const totalPages = pagination.totalPages || Math.ceil(pagination.count / 20);

    const filteredTrips = (stats.trips || []).filter(trip => {
        if (trip.is_bulk_upload) return false;
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
        if (modalFilters.selectedRoles && modalFilters.selectedRoles.length > 0) {
            if (!modalFilters.selectedRoles.includes(trip.user_role || trip.user_designation)) return false;
        }
        return true;
    });

    const filteredBatches = (stats.batches || []).filter(batch => {
        if (batch.status === 'Not Submitted') {
            if (modalFilters.status && modalFilters.status !== 'All') {
                if (batch.status !== modalFilters.status) return false;
            }
            if (modalFilters.selectedRoles && modalFilters.selectedRoles.length > 0) {
                if (!modalFilters.selectedRoles.includes(batch.user_role || batch.user_designation)) return false;
            }
            return true;
        }
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
        if (modalFilters.selectedRoles && modalFilters.selectedRoles.length > 0) {
            if (!modalFilters.selectedRoles.includes(batch.user_role || batch.user_designation)) return false;
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
            const headers = [
                "Trip ID", 
                "Employee ID", 
                "Employee Name", 
                "Designation", 
                "Position Code", 
                "Source", 
                "Destination", 
                "Start Date", 
                "End Date", 
                "Status", 
                "Waiting For Approver", 
                "Rejected By", 
                "Rejection Reason", 
                "Created At"
            ];
            const rows = filteredTrips.map(trip => [
                trip.trip_id,
                trip.user_id,
                trip.user_name,
                trip.user_designation || '',
                trip.user_position_code || '',
                trip.source || '',
                trip.destination || '',
                trip.start_date,
                trip.end_date,
                trip.status,
                !['Approved', 'Rejected', 'Completed'].includes(trip.status) ? (trip.current_approver_name || '') : '',
                trip.status === 'Rejected' ? (trip.rejected_by || '') : '',
                trip.status === 'Rejected' ? (trip.rejection_reason || '') : '',
                trip.created_at ? format(new Date(trip.created_at), 'yyyy-MM-dd HH:mm:ss') : 'null'
            ]);
            csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
            fileName = `trips_created_report_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        } else if (activeModal === 'batches') {
            const headers = [
                "Employee ID", 
                "Employee Name", 
                "Designation", 
                "Position Code", 
                "Travel ID", 
                "Status", 
                "Waiting For Approver", 
                "Rejected By", 
                "Rejection Reason", 
                "Created At"
            ];
            const rows = filteredBatches.map(batch => [
                batch.user_id,
                batch.user_name,
                batch.user_designation || '',
                batch.user_position_code || '',
                batch.trip_id || '',
                batch.status,
                ['Submitted', 'Resubmitted', 'Pending', 'Forwarded'].includes(batch.status) ? (batch.current_approver_name || '') : '',
                batch.status === 'Rejected' ? (batch.rejected_by || '') : '',
                batch.status === 'Rejected' ? (batch.rejection_reason || '') : '',
                batch.created_at ? format(new Date(batch.created_at), 'yyyy-MM-dd HH:mm:ss') : 'null'
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

    const handleSingleBatchExport = (batch, exportType = 'final', e) => {
        if (e) {
            e.stopPropagation(); // Prevent toggling the expanded row on button click
        }
        
        const isOriginal = exportType === 'original';
        const rowsSource = isOriginal ? (batch.original_rows || batch.rows) : batch.rows;
        if (!rowsSource || rowsSource.length === 0) return;
        
        let headers, rows;
        if (isOriginal) {
            headers = ["Date", "Mode", "Vehicle", "Origin Route", "Destination Route", "Start Time", "Reach Time", "Visit Intent", "Remarks"];
            rows = rowsSource.map(row => [
                row.date || row.Date || '',
                row.mode || '',
                row.vehicle || '',
                row.origin_route || '',
                row.destination_route || '',
                row.start_time || '',
                row.reach_time || '',
                row.visit_intent || '',
                row.remarks || ''
            ]);
        } else {
            headers = ["Date", "Mode", "Vehicle", "Origin Route", "Destination Route", "Odometer Start", "Odometer End", "Start Time", "Reach Time", "Visit Intent", "Remarks", "Is Deviated", "Deviation Reason", "Planned Origin", "Planned Destination", "Is Not Visited", "Actual Mode", "Actual Vehicle Subtype"];
            rows = rowsSource.map(row => [
                row.date || row.Date || '',
                row.mode || '',
                row.vehicle || '',
                row.origin_route || '',
                row.destination_route || '',
                row.odo_start !== undefined ? row.odo_start : '',
                row.odo_end !== undefined ? row.odo_end : '',
                row.start_time || '',
                row.reach_time || '',
                row.visit_intent || '',
                row.remarks || '',
                row.is_deviated ? 'Yes' : 'No',
                row.deviation_reason || '',
                row.planned_origin || '',
                row.planned_destination || '',
                row.is_not_visited ? 'Yes' : 'No',
                row.actual_mode || '',
                row.actual_vehicle || ''
            ]);
        }
        
        const csvContent = [headers, ...rows].map(rowItems => rowItems.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        
        const suffix = isOriginal ? 'original_plan' : 'final_claim';
        link.setAttribute("download", `bulk_upload_${batch.user_id}_${batch.id}_${suffix}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
    };

    const handleDownloadTripPDF = async (tripId, e) => {
        if (e) {
            e.stopPropagation(); // Prevent toggling the expanded row
        }
        if (!tripId) return;
        
        try {
            const endpoint = tripId.startsWith('ITS-') ? 'travels' : 'trips';
            const response = await api.get(`/api/${endpoint}/${tripId}/export/pdf/`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Travel_Expense_Statement_${tripId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("PDF export failed:", error);
            alert("Failed to download Trip PDF statement.");
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
                                {statsLoading ? (
                                    <Loader2 className="animate-spin" size={24} />
                                ) : (
                                    `${stats.batches_count} / ${new Set((stats.batches || []).map(b => b.user_id).filter(Boolean)).size}`
                                )}
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
                    gap: '20px',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, flexWrap: 'wrap' }}>
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

                        <div className="filter-group" style={{ 
                            background: 'white', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '14px',
                            padding: '10px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <ShieldCheck size={18} className="text-primary" />
                            {projectsLoading ? (
                                <span style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>Loading projects...</span>
                            ) : (
                                <select
                                    value={filters.project}
                                    onChange={e => setFilters(prev => ({ ...prev, project: e.target.value }))}
                                    style={{
                                        border: 'none',
                                        outline: 'none',
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        color: 'var(--text-main)',
                                        backgroundColor: 'transparent',
                                        cursor: 'pointer',
                                        minWidth: '150px'
                                    }}
                                >
                                    <option value="All">All Projects</option>
                                    <option value="General">General (Global Default)</option>
                                    {projects.map(proj => (
                                        <option key={proj.code} value={proj.code}>
                                            {proj.name} ({proj.code})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    <button 
                        className="text-btn" 
                        style={{ 
                            fontWeight: 800, 
                            fontSize: '0.75rem', 
                            textTransform: 'uppercase', 
                            color: '#94a3b8', 
                            letterSpacing: '0.05em',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                        }}
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
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                                        {log.user_designation && <span>{log.user_designation}</span>}
                                                        {!log.user_designation && <span style={{ color: '#cbd5e1' }}>{log.user_email}</span>}
                                                    </div>
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
                                    <>
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

                                        <div ref={rolesDropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Roles:</span>
                                            <button
                                                type="button"
                                                onClick={() => setRolesDropdownOpen(!rolesDropdownOpen)}
                                                style={{
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '10px',
                                                    padding: '6px 12px',
                                                    fontSize: '0.85rem',
                                                    color: '#334155',
                                                    backgroundColor: '#ffffff',
                                                    outline: 'none',
                                                    transition: 'border-color 0.2s',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '8px',
                                                    minWidth: '130px',
                                                    maxWidth: '200px',
                                                    textAlign: 'left'
                                                }}
                                                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                                onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                                            >
                                                <span style={{ 
                                                    overflow: 'hidden', 
                                                    textOverflow: 'ellipsis', 
                                                    whiteSpace: 'nowrap',
                                                    flex: 1
                                                }}>
                                                    {modalFilters.selectedRoles.length === 0 
                                                        ? 'All Roles' 
                                                        : `${modalFilters.selectedRoles.length} Selected`}
                                                </span>
                                                <ChevronDown size={14} style={{ color: '#64748b', flexShrink: 0 }} />
                                            </button>

                                            {rolesDropdownOpen && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '100%',
                                                    left: '48px',
                                                    marginTop: '4px',
                                                    width: '280px',
                                                    maxHeight: '300px',
                                                    backgroundColor: '#ffffff',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '10px',
                                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                                    zIndex: 1000,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    padding: '8px'
                                                }}>
                                                    <div style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: '6px',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '6px',
                                                        padding: '4px 8px',
                                                        marginBottom: '8px'
                                                    }}>
                                                        <Search size={14} style={{ color: '#94a3b8' }} />
                                                        <input
                                                            type="text"
                                                            placeholder="Search roles..."
                                                            value={rolesSearch}
                                                            onChange={(e) => setRolesSearch(e.target.value)}
                                                            style={{
                                                                border: 'none',
                                                                outline: 'none',
                                                                fontSize: '0.8rem',
                                                                width: '100%',
                                                                color: '#334155'
                                                            }}
                                                        />
                                                    </div>
                                                    <div style={{ 
                                                        overflowY: 'auto', 
                                                        flex: 1, 
                                                        display: 'flex', 
                                                        flexDirection: 'column', 
                                                        gap: '2px',
                                                        maxHeight: '180px',
                                                        paddingRight: '4px'
                                                    }}>
                                                        {uniqueRoles.filter(role => 
                                                            role.toLowerCase().includes(rolesSearch.toLowerCase())
                                                        ).length === 0 ? (
                                                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '8px', textAlign: 'center' }}>
                                                                No roles found
                                                            </div>
                                                        ) : (
                                                            uniqueRoles.filter(role => 
                                                                role.toLowerCase().includes(rolesSearch.toLowerCase())
                                                            ).map(role => {
                                                                const isChecked = modalFilters.selectedRoles.includes(role);
                                                                return (
                                                                    <label 
                                                                        key={role} 
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '8px',
                                                                            padding: '6px 8px',
                                                                            borderRadius: '6px',
                                                                            cursor: 'pointer',
                                                                            fontSize: '0.8rem',
                                                                            color: '#334155',
                                                                            transition: 'background-color 0.15s',
                                                                            backgroundColor: isChecked ? '#f1f5f9' : 'transparent'
                                                                        }}
                                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isChecked ? '#e2e8f0' : '#f8fafc'}
                                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isChecked ? '#f1f5f9' : 'transparent'}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isChecked}
                                                                            onChange={() => {
                                                                                setModalFilters(prev => {
                                                                                    const nextRoles = prev.selectedRoles.includes(role)
                                                                                        ? prev.selectedRoles.filter(r => r !== role)
                                                                                        : [...prev.selectedRoles, role];
                                                                                    return { ...prev, selectedRoles: nextRoles };
                                                                                });
                                                                            }}
                                                                            style={{
                                                                                accentColor: 'var(--primary)',
                                                                                cursor: 'pointer'
                                                                            }}
                                                                        />
                                                                        <span style={{ 
                                                                            overflow: 'hidden', 
                                                                            textOverflow: 'ellipsis', 
                                                                            whiteSpace: 'nowrap' 
                                                                        }} title={role}>
                                                                            {role}
                                                                        </span>
                                                                    </label>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                    {modalFilters.selectedRoles.length > 0 && (
                                                        <div style={{ 
                                                            borderTop: '1px solid #f1f5f9', 
                                                            paddingTop: '6px', 
                                                            marginTop: '6px',
                                                            display: 'flex',
                                                            justifyContent: 'flex-end'
                                                        }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => setModalFilters(prev => ({ ...prev, selectedRoles: [] }))}
                                                                style={{
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    color: 'var(--primary)',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer',
                                                                    padding: '2px 6px'
                                                                }}
                                                            >
                                                                Reset Selection
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                                {(modalFilters.startDate || modalFilters.endDate || modalFilters.status !== 'All' || modalFilters.selectedRoles.length > 0) && (
                                    <button
                                        onClick={() => setModalFilters({ startDate: '', endDate: '', status: 'All', selectedRoles: [] })}
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
                                            <th style={{ padding: '12px 16px' }}>Source</th>
                                            <th style={{ padding: '12px 16px' }}>Destination</th>
                                            <th style={{ padding: '12px 16px' }}>Travel Dates</th>
                                            <th style={{ padding: '12px 16px' }}>Status</th>
                                            <th style={{ padding: '12px 16px' }}>Created At</th>
                                            <th style={{ padding: '12px 16px' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTrips.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No trips created in this period.</td>
                                            </tr>
                                        ) : (
                                            filteredTrips.map((trip) => (
                                                <tr key={trip.trip_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '16px 16px', fontWeight: 700, color: 'var(--primary)' }}>{trip.trip_id}</td>
                                                    <td style={{ padding: '16px 16px' }}>
                                                        <div style={{ fontWeight: 700, color: '#334155' }}>{trip.user_name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{trip.user_id}</div>
                                                        {trip.user_designation && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{trip.user_designation}</span>
                                                            </div>
                                                        )}
                                                        {trip.user_position_code && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                                                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{trip.user_position_code}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '16px 16px', color: '#475569' }}>{trip.source || '—'}</td>
                                                    <td style={{ padding: '16px 16px', color: '#475569' }}>{trip.destination || '—'}</td>
                                                    <td style={{ padding: '16px 16px', fontSize: '0.8rem', color: '#64748b' }}>
                                                        {trip.start_date} &rarr; {trip.end_date}
                                                    </td>
                                                    <td style={{ padding: '16px 16px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <span style={{
                                                                padding: '4px 8px',
                                                                borderRadius: '6px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 700,
                                                                width: 'fit-content',
                                                                background: trip.status === 'Approved' ? '#ecfdf5' : trip.status === 'Rejected' ? '#fef2f2' : '#fffbeb',
                                                                color: trip.status === 'Approved' ? '#065f46' : trip.status === 'Rejected' ? '#991b1b' : '#b45309'
                                                            }}>{trip.status === 'Resolved' ? 'Revised' : (['Submitted', 'Resubmitted'].includes(trip.status) ? 'Pending' : trip.status)}</span>
                                                            
                                                            {/* Rejection tracking */}
                                                            {trip.status === 'Rejected' && trip.rejected_by && (
                                                                <div style={{ fontSize: '0.72rem', color: '#b91c1c', marginTop: '2px', fontWeight: 600, lineHeight: 1.3 }}>
                                                                    Rejected by: {trip.rejected_by}
                                                                    {trip.rejection_reason && (
                                                                        <span style={{ display: 'block', fontWeight: 400, color: '#ef4444', fontStyle: 'italic', marginTop: '1px' }}>
                                                                            Reason: {trip.rejection_reason}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Pending tracking */}
                                                            {!['Approved', 'Rejected', 'Completed', 'Settled'].includes(trip.status) && trip.current_approver_name && (
                                                                <div style={{ fontSize: '0.72rem', color: '#4338ca', marginTop: '2px', fontWeight: 600 }}>
                                                                    Waiting for: {trip.current_approver_name}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 16px', fontSize: '0.8rem', color: '#94a3b8' }}>
                                                        {format(new Date(trip.created_at), 'PPp')}
                                                    </td>
                                                    <td style={{ padding: '16px 16px' }}>
                                                        <button
                                                            onClick={(e) => handleDownloadTripPDF(trip.trip_id, e)}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                padding: '6px 12px',
                                                                borderRadius: '6px',
                                                                fontWeight: 700,
                                                                fontSize: '0.72rem',
                                                                background: '#ef4444',
                                                                color: '#ffffff',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                boxShadow: '0 2px 4px rgba(239, 68, 68, 0.15)',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                                                        >
                                                            <FileText size={12} />
                                                            PDF
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}                            {activeModal === 'batches' && (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>
                                            <th style={{ width: '40px' }}></th>
                                            <th style={{ padding: '12px 16px' }}>Uploaded By</th>
                                            <th style={{ padding: '12px 16px' }}>Travel ID</th>
                                            <th style={{ padding: '12px 16px' }}>File / Details</th>
                                            <th style={{ padding: '12px 16px' }}>Status</th>
                                            <th style={{ padding: '12px 16px' }}>Created At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredBatches.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No bulk uploads created in this period.</td>
                                            </tr>
                                        ) : (
                                            filteredBatches.map((batch) => (
                                                <React.Fragment key={batch.id}>
                                                    <tr 
                                                        onClick={() => batch.status !== 'Not Submitted' && setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
                                                        style={{ borderBottom: '1px solid #f1f5f9', cursor: batch.status === 'Not Submitted' ? 'default' : 'pointer', transition: 'background-color 0.2s' }}
                                                        onMouseEnter={(e) => batch.status !== 'Not Submitted' && (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                                        onMouseLeave={(e) => batch.status !== 'Not Submitted' && (e.currentTarget.style.backgroundColor = 'transparent')}
                                                    >
                                                        <td style={{ padding: '16px 16px', textAlign: 'center' }}>
                                                            {batch.status !== 'Not Submitted' && (
                                                                <div style={{ 
                                                                    width: '24px', 
                                                                    height: '24px', 
                                                                    borderRadius: '6px', 
                                                                    background: expandedBatch === batch.id ? 'var(--primary-light)' : '#f1f5f9',
                                                                    color: expandedBatch === batch.id ? 'var(--primary)' : '#94a3b8',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    margin: '0 auto'
                                                                }}>
                                                                    {expandedBatch === batch.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '16px 16px' }}>
                                                            <div style={{ fontWeight: 700, color: '#334155' }}>{batch.user_name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{batch.user_id}</div>
                                                            {batch.user_designation && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{batch.user_designation}</span>
                                                                </div>
                                                            )}
                                                            {batch.status !== 'Not Submitted' && batch.user_position_code && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                                                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{batch.user_position_code}</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '16px 16px' }}>
                                                            {batch.trip_id
                                                                ? <span style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>{batch.trip_id}</span>
                                                                : <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.8rem' }}>—</span>
                                                            }
                                                        </td>
                                                        <td style={{ padding: '16px 16px' }}>
                                                            {batch.status === 'Not Submitted' ? (
                                                                <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.8rem' }}>—</span>
                                                            ) : (
                                                                <>
                                                                    <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.85rem' }}>{batch.file_name}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#8e9aa8', marginTop: '2px' }}>
                                                                        {batch.row_count || 0} activity rows uploaded
                                                                    </div>
                                                                </>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '16px 16px' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <span style={{
                                                                    padding: '4px 8px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 700,
                                                                    width: 'fit-content',
                                                                    ...getBatchStatusStyle(batch.status)
                                                                }}>{['Submitted', 'Resubmitted'].includes(batch.status) ? 'Pending' : (batch.status === 'Resolved' ? 'Revised' : batch.status)}</span>
                                                                
                                                                {/* Rejection tracking */}
                                                                {batch.status === 'Rejected' && batch.rejected_by && (
                                                                    <div style={{ fontSize: '0.72rem', color: '#b91c1c', marginTop: '2px', fontWeight: 600, lineHeight: 1.3 }}>
                                                                        Rejected by: {batch.rejected_by}
                                                                        {batch.rejection_reason && (
                                                                            <span style={{ display: 'block', fontWeight: 400, color: '#ef4444', fontStyle: 'italic', marginTop: '1px' }}>
                                                                                Reason: {batch.rejection_reason}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Pending tracking */}
                                                                {['Submitted', 'Resubmitted', 'Pending', 'Forwarded'].includes(batch.status) && batch.current_approver_name && (
                                                                    <div style={{ fontSize: '0.72rem', color: '#4338ca', marginTop: '2px', fontWeight: 600 }}>
                                                                        Waiting for: {batch.current_approver_name}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '16px 16px', fontSize: '0.8rem', color: '#94a3b8' }}>
                                                            {batch.created_at ? format(new Date(batch.created_at), 'PPp') : '—'}
                                                        </td>
                                                    </tr>
                                                    {expandedBatch === batch.id && (
                                                        <tr>
                                                            <td colSpan="6" style={{ backgroundColor: '#f8fafc', padding: '20px 32px' }}>
                                                                <div style={{ 
                                                                    borderLeft: '4px solid var(--primary)', 
                                                                    paddingLeft: '20px',
                                                                    display: 'flex', 
                                                                    flexDirection: 'column', 
                                                                    gap: '12px'
                                                                }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' }}>
                                                                        <h4 style={{ 
                                                                            margin: 0,
                                                                            fontSize: '0.85rem', 
                                                                            fontWeight: 800, 
                                                                            color: '#1e293b', 
                                                                            textTransform: 'uppercase', 
                                                                            letterSpacing: '0.05em' 
                                                                        }}>Uploaded Rows Detail</h4>
                                                                        {batch.rows && batch.rows.length > 0 && (
                                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                                <button
                                                                                    onClick={(e) => handleSingleBatchExport(batch, 'original', e)}
                                                                                    style={{
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        gap: '6px',
                                                                                        padding: '6px 12px',
                                                                                        borderRadius: '8px',
                                                                                        fontWeight: 700,
                                                                                        fontSize: '0.75rem',
                                                                                        background: '#64748b', // Slate for original
                                                                                        color: '#ffffff',
                                                                                        border: 'none',
                                                                                        cursor: 'pointer',
                                                                                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                                                                        transition: 'all 0.2s'
                                                                                    }}
                                                                                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                                                                                    onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                                                                                >
                                                                                    <Download size={14} />
                                                                                    Download Original Plan
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => handleSingleBatchExport(batch, 'final', e)}
                                                                                    style={{
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        gap: '6px',
                                                                                        padding: '6px 12px',
                                                                                        borderRadius: '8px',
                                                                                        fontWeight: 700,
                                                                                        fontSize: '0.75rem',
                                                                                        background: 'var(--primary)', // Primary color for final claim
                                                                                        color: '#ffffff',
                                                                                        border: 'none',
                                                                                        cursor: 'pointer',
                                                                                        boxShadow: '0 2px 4px rgba(0, 128, 128, 0.15)',
                                                                                        transition: 'all 0.2s'
                                                                                    }}
                                                                                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                                                                                    onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                                                                                >
                                                                                    <Download size={14} />
                                                                                    Download Final Claim
                                                                                </button>
                                                                                {batch.trip_id && (
                                                                                    <button
                                                                                        onClick={(e) => handleDownloadTripPDF(batch.trip_id, e)}
                                                                                        style={{
                                                                                            display: 'flex',
                                                                                            alignItems: 'center',
                                                                                            gap: '6px',
                                                                                            padding: '6px 12px',
                                                                                            borderRadius: '8px',
                                                                                            fontWeight: 700,
                                                                                            fontSize: '0.75rem',
                                                                                            background: '#ef4444', // Red for PDF
                                                                                            color: '#ffffff',
                                                                                            border: 'none',
                                                                                            cursor: 'pointer',
                                                                                            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.15)',
                                                                                            transition: 'all 0.2s'
                                                                                        }}
                                                                                        onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                                                                                        onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                                                                                    >
                                                                                        <FileText size={14} />
                                                                                        Download Trip PDF
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    {!batch.rows || batch.rows.length === 0 ? (
                                                                        <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                                                                            No data rows found in this batch.
                                                                        </div>
                                                                    ) : (
                                                                        <div style={{ 
                                                                            maxHeight: '300px', 
                                                                            overflowY: 'auto', 
                                                                            border: '1px solid #e2e8f0', 
                                                                            borderRadius: '12px', 
                                                                            backgroundColor: '#ffffff',
                                                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)'
                                                                        }}>
                                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                                                                <thead style={{ backgroundColor: '#f1f5f9', position: 'sticky', top: 0, zIndex: 10 }}>
                                                                                    <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 700 }}>
                                                                                        <th style={{ padding: '10px 12px' }}>Date</th>
                                                                                        <th style={{ padding: '10px 12px' }}>Mode</th>
                                                                                        <th style={{ padding: '10px 12px' }}>Vehicle</th>
                                                                                        <th style={{ padding: '10px 12px' }}>Route (From &rarr; To)</th>
                                                                                        <th style={{ padding: '10px 12px' }}>Odometer</th>
                                                                                        <th style={{ padding: '10px 12px' }}>Timings</th>
                                                                                        <th style={{ padding: '10px 12px' }}>Visit Intent</th>
                                                                                        <th style={{ padding: '10px 12px' }}>Remarks</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {batch.rows.map((row, rIdx) => (
                                                                                        <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                                                                                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.date || row.Date || '—'}</td>
                                                                                            <td style={{ padding: '10px 12px' }}>
                                                                                                {(() => {
                                                                                                    const plannedMode = row.mode || '—';
                                                                                                    const actualMode = row.actual_mode || '';
                                                                                                    const modeChanged = actualMode && plannedMode && actualMode.trim().toLowerCase() !== plannedMode.trim().toLowerCase();
                                                                                                    if (modeChanged) {
                                                                                                        return (
                                                                                                            <div>
                                                                                                                <span style={{ fontWeight: 600, color: '#f97316' }}>{actualMode}</span>
                                                                                                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Planned: {plannedMode}</div>
                                                                                                            </div>
                                                                                                        );
                                                                                                    }
                                                                                                    return plannedMode;
                                                                                                })()}
                                                                                            </td>
                                                                                            <td style={{ padding: '10px 12px' }}>
                                                                                                {(() => {
                                                                                                    const plannedVehicle = row.vehicle || '—';
                                                                                                    const actualVehicle = row.actual_vehicle || '';
                                                                                                    const vehicleChanged = actualVehicle && plannedVehicle && actualVehicle.trim().toLowerCase() !== plannedVehicle.trim().toLowerCase();
                                                                                                    if (vehicleChanged) {
                                                                                                        return (
                                                                                                            <div>
                                                                                                                <span style={{ fontWeight: 600, color: '#f97316' }}>{actualVehicle}</span>
                                                                                                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Planned: {plannedVehicle}</div>
                                                                                                            </div>
                                                                                                        );
                                                                                                    }
                                                                                                    return plannedVehicle;
                                                                                                })()}
                                                                                            </td>
                                                                                            <td style={{ padding: '10px 12px' }}>
                                                                                                {(() => {
                                                                                                    const isDev = row.is_deviated === true;
                                                                                                    const isNotVis = row.is_not_visited === true;
                                                                                                    const origin = row.origin_route || '—';
                                                                                                    const destination = row.destination_route || '—';
                                                                                                    const plannedOrigin = row.planned_origin || '';
                                                                                                    const plannedDest = row.planned_destination || '';
                                                                                                    
                                                                                                    if (isNotVis) {
                                                                                                        return (
                                                                                                            <div>
                                                                                                                <span style={{ 
                                                                                                                    color: '#ef4444', 
                                                                                                                    fontWeight: 700, 
                                                                                                                    fontSize: '0.7rem', 
                                                                                                                    backgroundColor: '#fef2f2', 
                                                                                                                    padding: '2px 6px', 
                                                                                                                    borderRadius: '4px',
                                                                                                                    marginRight: '6px'
                                                                                                                }}>NOT VISITED</span>
                                                                                                                <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>
                                                                                                                    {origin} &rarr; {destination}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                        );
                                                                                                    }
                                                                                                    
                                                                                                    if (isDev) {
                                                                                                        return (
                                                                                                            <div>
                                                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                                                                                                    <span style={{ 
                                                                                                                        color: '#f97316', 
                                                                                                                        fontWeight: 700, 
                                                                                                                        fontSize: '0.7rem', 
                                                                                                                        backgroundColor: '#fff7ed', 
                                                                                                                        padding: '2px 6px', 
                                                                                                                        borderRadius: '4px',
                                                                                                                        marginRight: '4px'
                                                                                                                    }}>DEVIATED</span>
                                                                                                                    <span style={{ fontWeight: 600 }}>{origin} &rarr; {destination}</span>
                                                                                                                </div>
                                                                                                                {(plannedOrigin || plannedDest) && (
                                                                                                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                                                                                        Planned: {plannedOrigin || '—'} &rarr; {plannedDest || '—'}
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {row.deviation_reason && (
                                                                                                                    <div style={{ fontSize: '0.7rem', color: '#f97316', fontStyle: 'italic', marginTop: '2px' }}>
                                                                                                                        Reason: {row.deviation_reason}
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </div>
                                                                                                        );
                                                                                                    }
                                                                                                    
                                                                                                    return <span>{origin} &rarr; {destination}</span>;
                                                                                                })()}
                                                                                            </td>
                                                                                            <td style={{ padding: '10px 12px' }}>
                                                                                                {row.odo_start !== undefined || row.odo_end !== undefined ? `${row.odo_start || 0} - ${row.odo_end || 0}` : '—'}
                                                                                            </td>
                                                                                            <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: '#64748b' }}>
                                                                                                {row.start_time || '—'} - {row.reach_time || '—'}
                                                                                            </td>
                                                                                            <td style={{ padding: '10px 12px' }}>{row.visit_intent || '—'}</td>
                                                                                            <td style={{ padding: '10px 12px', fontStyle: 'italic', fontSize: '0.75rem', color: '#64748b' }}>{row.remarks || '—'}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
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