import React, { useState, useEffect } from 'react';
import {
    Calendar,
    User,
    Search,
    FileText,
    Camera,
    MapPin,
    ArrowRight,
    Filter,
    Download,
    Eye,
    ChevronDown,
    ChevronUp,
    CheckCircle,
    Info,
    LayoutDashboard,
    AlertTriangle,
    Upload,
    Clock
} from 'lucide-react';
import api from '../api/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatIndianCurrency } from '../utils/formatters';
import './JobReport.css';


const JobReport = () => {
    const { showToast } = useToast();
    const { user } = useAuth();
    const [reports, setReports] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        employee: '',
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const [expandedRow, setExpandedRow] = useState(null);
    const [batchesToApprove, setBatchesToApprove] = useState([]);
    const [myOwnBatches, setMyOwnBatches] = useState([]);
    const [teamBatchHistory, setTeamBatchHistory] = useState([]);
    const [expandedBatch, setExpandedBatch] = useState(null);

    useEffect(() => {
        fetchUsers();
        fetchReports();
        fetchBatches();
    }, []);

    const fetchBatches = async () => {
        try {
            const resp = await api.get('/api/bulk-activities/');
            const all = resp.data.results || resp.data || [];

            // 1. Batches pending current user's approval
            const pendingForMe = all.filter(b =>
                b.status === 'Submitted' &&
                String(b.current_approver) === String(user?.id)
            );
            setBatchesToApprove(pendingForMe);

            // 2. Batches submitted BY current user to others
            const submittedByMe = all.filter(b =>
                String(b.user) === String(user?.id)
            );
            setMyOwnBatches(submittedByMe);

            // 3. Team Activity History (Processed by current user OR visible to high roles)
            const role = (user?.role_name || '').toLowerCase();
            const isAdminOrExec = ['admin', 'it-admin', 'superuser', 'coo', 'cfo', 'finance'].some(kw => role.includes(kw));

            const history = all.filter(b => {
                const isProcessedStatus = b.status === 'Approved' || b.status === 'Rejected';
                const wasApprover = String(b.current_approver) === String(user?.id);
                const isNotOwnedByMe = String(b.user) !== String(user?.id);

                return isProcessedStatus && (wasApprover || (isAdminOrExec && isNotOwnedByMe));
            });
            setTeamBatchHistory(history);
        } catch (e) {
            console.error("Failed to fetch batches", e);
        }
    };




    const fetchUsers = async () => {
        try {
            const response = await api.get('/api/users/?all_pages=true');
            setUsers(response.data || []);
        } catch (error) {
            console.error("Failed to fetch users:", error);
        }
    };

    const fetchReports = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/expenses/');
            let data = response.data.results || response.data || [];
            
            if (!Array.isArray(data)) data = [];

            const filtered = data.filter(exp => {
                const matchesEmployee = filters.employee
                    ? (String(exp.trip_user_id) === String(filters.employee) || String(exp.user_id) === String(filters.employee))
                    : true;
                const expDate = (exp.date || '').slice(0, 10);
                const matchesDate = expDate >= filters.startDate && expDate <= filters.endDate;
                return matchesEmployee && matchesDate;
            });

            filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
            setReports(filtered);
        } catch (error) {
            console.error("Failed to fetch reports:", error);
            showToast("Error loading reports", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        fetchReports();
    };

    const parseDescription = (descString) => {
        try {
            return typeof descString === 'string' ? JSON.parse(descString) : (descString || {});
        } catch (e) {
            return {};
        }
    };

    const parseImages = (imgString) => {
        try {
            return typeof imgString === 'string' ? JSON.parse(imgString) : (imgString || []);
        } catch (e) {
            return [];
        }
    };

    const previewImage = (url) => {
        if (!url) return;
        const win = window.open();
        win.document.write(`<img src="${url}" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);" />`);
    };


    const renderBatchData = (batch) => {
        const allowedKeys = ['date', 'start_time', 'reach_time', 'time', 'origin_route', 'destination_route', 'visit_intent', 'mode', 'vehicle', '_status', '_remarks'];
        const rows = batch.data_json || [];
        const headerKeys = rows.length > 0
            ? Object.keys(rows[0]).filter(k => allowedKeys.includes(k.toLowerCase()))
            : [];

        if (!headerKeys.includes('_status') && rows.some(r => r._status)) headerKeys.push('_status');
        if (!headerKeys.includes('_remarks') && rows.some(r => r._remarks)) headerKeys.push('_remarks');

        return (
            <div className="bg-white p-3 rounded border mb-3 overflow-auto shadow-inner" style={{ maxHeight: '400px', background: '#f1f5f9' }}>
                <h6 className="fw-bold border-bottom pb-2 mb-3 text-slate-600">Excel Entries Preview</h6>
                <table className="table table-sm table-hover" style={{ fontSize: '0.75rem' }}>
                    <thead className="table-light">
                        <tr>
                            {headerKeys.map(k => {
                                let title = k.replace(/_/g, ' ').toUpperCase();
                                if (k === '_status') title = 'Row Status';
                                if (k === '_remarks') title = 'Reject Reason';
                                return <th key={k}>{title}</th>;
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rIdx) => (
                            <tr key={rIdx} className={row._status === 'Rejected' ? 'bg-danger text-white' : ''} style={{ backgroundColor: row._status === 'Rejected' ? '#fee2e2' : 'inherit', color: row._status === 'Rejected' ? '#991b1b' : 'inherit' }}>
                                {headerKeys.map(k => {
                                    let display = row[k];
                                    if (k.toLowerCase() === 'mode' && !display) display = 'Bike';
                                    if (k.toLowerCase() === 'vehicle' && !display) display = 'Own Bike';
                                    if (k === '_status' && !display) display = 'OK';
                                    return <td key={k}>{String(display || '-')}</td>;
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {batch.status === 'Rejected' && (
                    <div className="mt-3 p-2 border rounded" style={{ backgroundColor: '#fef2f2', borderColor: '#ef4444', color: '#b91c1c' }}>
                        <strong>Overall Rejection Reason:</strong> {batch.remarks || 'No detailed reason provided'}
                    </div>
                )}
            </div>
        );
    };

    const handleBatchAction = async (batchId, action) => {
        try {
            await api.post(`/api/bulk-activities/${batchId}/${action}/`);
            showToast(`Batch ${action}d successfully.`, "success");
            fetchBatches();
            fetchReports(); // Refresh the grid to show new items
        } catch (error) {
            showToast(`Error: ${error.response?.data?.error || 'Action failed'}`, "error");
        }
    };

    return (
        <div className="job-report-theme">
            <header className="jr-header-premium">
                <div className="jr-brand-group">
                    <div className="jr-icon-box">
                        <FileText size={28} />
                    </div>
                    <div>
                        <h1>Work & Travel Logs</h1>
                    </div>
                </div>
                <div className="jr-header-actions">
                    <button className="jr-action-button outline" onClick={() => window.print()}>
                        <Download size={18} />
                        <span>Save PDF</span>
                    </button>
                </div>
            </header>

            {/* Quick Summary Bar */}
            <div className="jr-summary-strip">
                <div className="jr-summary-card">
                    <div className="jr-summary-icon blue"><Clock size={20} /></div>
                    <div className="jr-summary-info">
                        <span className="jr-summary-label">Total Logs Found</span>
                        <span className="jr-summary-value">{reports.length} Records</span>
                    </div>
                </div>
                <div className="jr-summary-card">
                    <div className="jr-summary-icon red"><MapPin size={20} /></div>
                    <div className="jr-summary-info">
                        <span className="jr-summary-label">Total Distance</span>
                        <span className="jr-summary-value">
                            {reports.reduce((acc, curr) => acc + (parseFloat(curr.distance) || 0), 0).toFixed(1)} KM
                        </span>
                    </div>
                </div>
            </div>

            {/* Pending Requests for Managers */}
            {batchesToApprove.length > 0 && (
                <div className="jr-alert-card primary mb-4">
                    <h3 className="jr-alert-title">
                        <Upload size={18} /> Review Pending Approvals (Group Logs)
                    </h3>
                    <div className="jr-batch-list">
                        {batchesToApprove.map(batch => (
                            <div key={batch.id} className="jr-batch-item">
                                <div className="jr-batch-header">
                                    <div className="jr-batch-info">
                                        <div className="jr-batch-file">
                                            <strong>{batch.user_name}</strong>
                                            <span className="text-muted">submitted</span>
                                            <strong>{batch.file_name}</strong>
                                        </div>
                                        <div className="jr-batch-meta">
                                            <span>Trip: {batch.trip_id_display}</span>
                                            <span className="dot"></span>
                                            <span>Date: {new Date(batch.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="jr-batch-actions">
                                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleBatchAction(batch.id, 'reject')}>Reject</button>
                                        <button className="btn btn-sm btn-success" onClick={() => handleBatchAction(batch.id, 'approve')}>Approve Batch</button>
                                        <button
                                            className="jr-view-batch-btn"
                                            onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
                                        >
                                            {expandedBatch === batch.id ? 'Hide Data' : 'View Data'}
                                            <ChevronDown size={14} style={{ transform: expandedBatch === batch.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                        </button>
                                    </div>
                                </div>
                                {expandedBatch === batch.id && (
                                    <div className="jr-batch-data-expanded">
                                        {renderBatchData(batch)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Shared Activity History */}
            {teamBatchHistory.length > 0 && (
                <div className="jr-alert-card dark mb-4">
                    <h3 className="jr-alert-title">
                        <FileText size={18} /> Team Upload History
                    </h3>
                    <div className="jr-batch-list">
                        {teamBatchHistory.map(batch => (
                            <div key={batch.id} className="jr-batch-item">
                                <div className="jr-batch-header">
                                    <div className="jr-batch-info">
                                        <div className="jr-batch-file">
                                            <strong>{batch.user_name}</strong>
                                            <span className="text-muted">uploaded</span>
                                            <strong>{batch.file_name}</strong>
                                        </div>
                                        <div className="jr-batch-meta">
                                            <span>Trip: {batch.trip_id_display}</span>
                                            <span className="dot"></span>
                                            <span>Processed: {new Date(batch.updated_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="jr-batch-actions">
                                        <span className={`jr-status-tag ${batch.status.toLowerCase()}`}>
                                            {batch.status}
                                        </span>
                                        <button
                                            className="jr-view-batch-btn"
                                            onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
                                        >
                                            {expandedBatch === batch.id ? 'Hide Logs' : 'View Logs'}
                                            <ChevronDown size={14} style={{ transform: expandedBatch === batch.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                        </button>
                                    </div>
                                </div>
                                {expandedBatch === batch.id && (
                                    <div className="jr-batch-data-expanded">
                                        {renderBatchData(batch)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {myOwnBatches.length > 0 && (
                <div className="jr-filter-card mb-4" style={{ borderColor: '#8b0000', backgroundColor: '#fff5f5' }}>
                    <h3 className="h5 fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: '#8b0000' }}>
                        <Clock size={18} /> My Bulk Activity Upload Status
                    </h3>
                    <div className="d-flex flex-column gap-2">
                        <div className="jr-batch-list">
                            {myOwnBatches.map(batch => (
                                <div key={batch.id} className="jr-batch-item">
                                    <div className="jr-batch-header">
                                        <div className="jr-batch-info">
                                            <div className="jr-batch-file">
                                                <FileText size={16} className="text-muted" />
                                                <strong>{batch.file_name}</strong>
                                            </div>
                                            <div className="jr-batch-meta">
                                                <span>Trip: {batch.trip_id_display}</span>
                                                <span className="dot"></span>
                                                <span>Uploaded: {new Date(batch.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <div className="jr-batch-actions">
                                            <span className={`jr-status-tag ${batch.status.toLowerCase()}`}>
                                                {batch.status}
                                            </span>
                                            <button
                                                className="jr-view-batch-btn"
                                                onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
                                            >
                                                {expandedBatch === batch.id ? 'Hide Data' : 'View Entries'}
                                                <ChevronDown size={14} style={{ transform: expandedBatch === batch.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                            </button>
                                        </div>
                                    </div>
                                    {expandedBatch === batch.id && (
                                        <div className="jr-batch-data-expanded">
                                            {renderBatchData(batch)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Modern Search & Filter Bar */}
            <div className="jr-search-panel">
                <div className="jr-search-grid">
                    <div className="jr-search-field">
                        <label>Member Name</label>
                        <div className="jr-input-wrapper">
                            <User size={16} />
                            <select
                                value={filters.employee}
                                onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
                            >
                                <option value="">Global View (All Members)</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.employee_id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="jr-search-field">
                        <label>Start Date</label>
                        <div className="jr-input-wrapper">
                            <Calendar size={16} />
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="jr-search-field">
                        <label>End Date</label>
                        <div className="jr-input-wrapper">
                            <Calendar size={16} />
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="jr-search-actions">
                        <button className="jr-primary-button" onClick={handleSearch} disabled={loading}>
                            {loading ? <div className="jr-spinner-tiny" /> : <Search size={18} />}
                            <span>Show Logs</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="jr-results-wrapper">
                <table className="jr-modern-table">
                    <thead>
                        <tr>
                            <th>Activity Date</th>
                            <th>Member Details</th>
                            <th>Task Overview</th>
                            <th>Travel Progress</th>
                            <th>Photos & Proofs</th>
                            <th style={{ width: '80px' }}>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="text-center py-5">
                                <div className="spinner-border text-primary" role="status"></div>
                                <p className="mt-2 font-bold text-muted">Securing records...</p>
                            </td></tr>
                        ) : reports.length === 0 ? (
                            <tr><td colSpan="6" className="jr-empty">
                                <LayoutDashboard size={48} opacity={0.2} />
                                <h3>No Records Found</h3>
                                <p>Try adjusting your search filters or date range.</p>
                            </td></tr>
                        ) : (
                            reports.map((report) => {
                                const details = parseDescription(report.description);
                                const selfiesArr = Array.isArray(details.selfies) ? details.selfies : [];
                                const isFuel = report.category === 'Fuel';

                                // Safety date format
                                const formatDate = (dateStr) => {
                                    try {
                                        const d = new Date(dateStr);
                                        return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                                    } catch (e) {
                                        return dateStr || 'N/A';
                                    }
                                };

                                // Safety string renderer to simplify complex data
                                const safeRender = (val, fallback = 'N/A') => {
                                    if (val === null || val === undefined) return fallback;
                                    if (typeof val === 'object') {
                                        // If it's a timestamp object, format nicely
                                        if (val.actualTime || val.boardingTime) {
                                            return `${val.actualTime || val.boardingTime} (${val.boardingDate || ''})`;
                                        }
                                        return JSON.stringify(val);
                                    }

                                    // Try to parse if it's a JSON string
                                    if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                                        try {
                                            const parsed = JSON.parse(val);
                                            return safeRender(parsed, fallback);
                                        } catch (e) { return val; }
                                    }
                                    return String(val);
                                };

                                // Constructing a rich job description
                                const rawJobDesc = details.natureOfVisit || details.description || "Field Visit / Activity";
                                const jobDesc = safeRender(rawJobDesc);
                                const statusPillClass = isFuel ? 'fuel' : 'other';

                                return (
                                    <React.Fragment key={report.id}>
                                        <tr className={`jr-row ${expandedRow === report.id ? 'expanded' : ''}`}>
                                            <td className="jr-date-cell">
                                                {formatDate(report.date)}
                                            </td>
                                            <td>
                                                <div className="jr-employee-cell">
                                                    <div className="jr-avatar-mini">{report.user_name?.charAt(0) || 'U'}</div>
                                                    <div className="jr-emp-info">
                                                        <strong>{report.user_name || 'Anonymous User'}</strong>
                                                        <span>{report.user_department || 'General'} • {report.user_designation || 'Staff'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="d-flex flex-column gap-1">
                                                    <span className={`jr-status-pill ${statusPillClass}`}>
                                                        {isFuel ? <MapPin size={12} /> : <FileText size={12} />}
                                                        {isFuel ? 'Local Travel' : report.category}
                                                    </span>
                                                    <strong style={{ fontSize: '0.85rem', color: '#334155' }}>{jobDesc}</strong>
                                                </div>
                                            </td>                                             <td>
                                                {report.odo_start ? (
                                                    <div className="jr-progress-card">
                                                        <div className="jr-progress-flow">
                                                            <div className="jr-val">{Math.round(report.odo_start)}</div>
                                                            <ArrowRight size={14} className="text-secondary" />
                                                            <div className="jr-val">{Math.round(report.odo_end)}</div>
                                                        </div>
                                                        <div className="jr-progress-badge">{report.distance} KM Covered</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted italic opacity-50 small">No Travel Logged</span>
                                                )}
                                            </td>

                                            <td>
                                                <div className="jr-proof-icons">
                                                    {details.odoStartImg && (
                                                        <button className="jr-media-btn" onClick={() => previewImage(details.odoStartImg)} title="Start ODO Image">
                                                            <Camera size={14} />
                                                        </button>
                                                    )}
                                                    {details.odoEndImg && (
                                                        <button className="jr-media-btn" onClick={() => previewImage(details.odoEndImg)} title="End ODO Image">
                                                            <Camera size={14} />
                                                        </button>
                                                    )}
                                                    {selfiesArr.length > 0 && (
                                                        <div className="jr-selfie-count d-flex align-items-center gap-1">
                                                            <User size={10} /> {selfiesArr.length} Photos
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="text-center">
                                                <button
                                                    className="jr-media-btn"
                                                    onClick={() => setExpandedRow(expandedRow === report.id ? null : report.id)}
                                                    style={{ backgroundColor: expandedRow === report.id ? '#8b0000' : 'white', color: expandedRow === report.id ? 'white' : 'var(--text-muted)' }}
                                                >
                                                    {expandedRow === report.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedRow === report.id && (
                                            <tr>
                                                <td colSpan="6" style={{ padding: 0, border: 'none' }}>
                                                    <div className="jr-expanded-card">
                                                        <div className="jr-expanded-grid">
                                                            <div className="jr-info-column">
                                                                <h4><Info size={16} /> Log Details</h4>
                                                                <div className="jr-meta-grid">
                                                                    <div className="jr-meta-item">
                                                                        <label>Travel Method</label>
                                                                        <p>{safeRender(report.travel_mode)}</p>
                                                                    </div>
                                                                    <div className="jr-meta-item">
                                                                        <label>Type of Vehicle</label>
                                                                        <p>{safeRender(report.vehicle_type)}</p>
                                                                    </div>
                                                                    <div className="jr-meta-item full-width">
                                                                        <label>Main Route</label>
                                                                        <p>{(details?.origin || details?.fromLocation || 'N/A')} → {(details?.destination || details?.toLocation || 'N/A')}</p>
                                                                    </div>
                                                                    <div className="jr-meta-item">
                                                                        <label>Reason for Visit</label>
                                                                        <p>{safeRender(details.purpose, 'Official Task')}</p>
                                                                    </div>
                                                                    <div className="jr-meta-item">
                                                                        <label>Time Logged</label>
                                                                        <p>{safeRender(details.time, 'Core Hours')}</p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="jr-media-column">
                                                                <h4><Camera size={16} /> Visual Evidence</h4>
                                                                <div className="jr-media-wall">
                                                                    {details.odoStartImg && (
                                                                        <div className="jr-media-item" onClick={() => previewImage(details.odoStartImg)}>
                                                                            <img src={details.odoStartImg} alt="Start ODO" />
                                                                            <div className="jr-media-label">Start ODO Reading</div>
                                                                        </div>
                                                                    )}
                                                                    {details.odoEndImg && (
                                                                        <div className="jr-media-item" onClick={() => previewImage(details.odoEndImg)}>
                                                                            <img src={details.odoEndImg} alt="End ODO" />
                                                                            <div className="jr-media-label">End ODO Reading</div>
                                                                        </div>
                                                                    )}
                                                                    {selfiesArr.map((s, idx) => (
                                                                        <div key={idx} className="jr-media-item" onClick={() => previewImage(s)}>
                                                                            <img src={s} alt={`selfie-${idx}`} />
                                                                            <div className="jr-media-label">Selfie #{idx + 1}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="jr-remarks-section">
                                                            <h4><FileText size={16} /> Task Outcome & Remarks</h4>
                                                            <div className="jr-remarks-content">
                                                                {safeRender(details.remarks, "No specific remarks provided for this entry.")}
                                                            </div>
                                                        </div>

                                                        <div className="jr-footer-bar">
                                                            <div className="jr-ref-info">
                                                                ID: #{report.id} / Trip: {(report.trip && typeof report.trip === 'object') ? (report.trip.trip_id || 'ID') : (report.trip || 'N/A')}
                                                                <span className="jr-verification-status">
                                                                    <CheckCircle size={12} /> Verified Location
                                                                </span>
                                                            </div>
                                                            <div className="jr-cost-display">
                                                                System Cost: <strong>₹{safeRender(report.amount, '0')}</strong>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
};

export default JobReport;
