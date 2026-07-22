import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    CheckCircle2,
    Clock,
    MapPin,
    Calendar,
    Briefcase,
    TrendingUp,
    ShieldCheck,
    Gauge,
    Info,
    CreditCard,
    IndianRupee,
    Layers,
    User,
    Award,
    Image,
    Navigation,
    Printer,
    Download,
    Share2,
    LayoutGrid,
    StickyNote,
    Plus,
    CheckCircle,
    XCircle,
    HelpCircle,
    PauseCircle,
    AlertTriangle,
    FileText,
    ArrowRight,
    ExternalLink,
    Upload
} from 'lucide-react';
import { encodeId, decodeId } from '../utils/idEncoder';
import api from '../api/api';
import { useToast } from '../context/ToastContext.jsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useAuth } from '../context/AuthContext';
import TravelExpenseGrid from '../components/trips/TravelExpenseGrid.jsx';
import TripWalletModal from '../components/trips/TripWalletModal';
import ExpenseReportPDF from '../components/trips/ExpenseReportPDF';
import { formatIndianCurrency } from '../utils/formatters';
import './TripStory.css';
import './gmail_compose.css';


const TravelStory = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();
    const [travel, setTravel] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [auditRemarks, setAuditRemarks] = useState({});
    const [dateFilter, setDateFilter] = useState('Last 7 Days');

    // Luggage popup state
    const [showLuggagePopup, setShowLuggagePopup] = useState(false);
    const [luggageWeight, setLuggageWeight] = useState('');
    const [luggageRemarks, setLuggageRemarks] = useState('');

    // PDF Export refs and state
    const reportRef = useRef(null);
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);

    const [showJobReportModal, setShowJobReportModal] = useState(false);
    const [jobReportDescription, setJobReportDescription] = useState('');
    const [jobReportFiles, setJobReportFiles] = useState([]);
    const [isSubmittingJobReport, setIsSubmittingJobReport] = useState(false);
    const jobReportFileInputRef = useRef(null);

    // Rejection Modal state
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectItemId, setRejectItemId] = useState(null);
    const [rejectionRemarks, setRejectionRemarks] = useState('');
    const [previewImageUrl, setPreviewImageUrl] = useState(null);

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatCurrency = (amt) => {
        return `₹${formatIndianCurrency(amt || 0)}`;
    };

    useEffect(() => {
        fetchTravelStory();
    }, [id, dateFilter]);

    const getFullUrl = (path) => {
        if (!path) return '';
        let p = String(path).trim();

        // Robust cleaning for common legacy formats [u'path'] or ['path']
        p = p.replace(/^\[u'/, '').replace(/^u'/, '').replace(/^'/, '');
        p = p.replace(/'\]$/, '').replace(/'$/, '');

        if (p.startsWith('http') || p.startsWith('data:')) return p;
        const backendBase = api.defaults.baseURL || 'http://192.168.1.138:4567';
        return `${backendBase}${p.startsWith('/') ? '' : '/'}${p}`;
    };

    const fetchTravelStory = async () => {
        setIsLoading(true);
        try {
            const decodedId = decodeId(id);
            const endpoint = decodedId.toString().startsWith('ITS-') ? 'travels' : 'trips';

            // Build query params for filtering
            const params = {};
            if (dateFilter !== 'All') {
                const now = new Date();
                const limit = new Date();
                if (dateFilter === 'Today') {
                    params.from_date = now.toISOString().split('T')[0];
                    params.to_date = now.toISOString().split('T')[0];
                } else if (dateFilter === 'Last 7 Days') {
                    limit.setDate(limit.getDate() - 7);
                    params.from_date = limit.toISOString().split('T')[0];
                    params.to_date = now.toISOString().split('T')[0];
                } else if (dateFilter === 'Last 30 Days') {
                    limit.setDate(limit.getDate() - 30);
                    params.from_date = limit.toISOString().split('T')[0];
                    params.to_date = now.toISOString().split('T')[0];
                }
            }

            const response = await api.get(`/api/${endpoint}/${decodedId}/`, { params });
            setTravel(response.data);
        } catch (error) {
            console.error("Failed to fetch travel story:", error);
            showToast("Failed to load travel story", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async (action) => {
        if (!travel) return;
        setIsActionLoading(true);
        try {
            const task_id = travel.claim ? `CLAIM-${travel.claim.id}` : travel.trip_id;
            await api.post('/api/approvals/', {
                id: task_id,
                action: action
            });
            showToast(`${action} successful`, "success");
            fetchTravelStory();
        } catch (error) {
            showToast(`Failed to ${action}`, "error");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleItemAction = async (itemId, itemStatus) => {
        if (!travel?.claim) return;

        if (itemStatus === 'Rejected') {
            setRejectItemId(itemId);
            setRejectionRemarks("");
            setShowRejectModal(true);
            return;
        }

        const remarks = auditRemarks[itemId] || "";

        try {
            await api.post('/api/approvals/', {
                id: `CLAIM-${travel.claim.id}`,
                action: 'UpdateItem',
                item_id: itemId,
                item_status: itemStatus,
                remarks: remarks
            });

            await fetchTravelStory();
            showToast(`Item ${itemStatus} updated`, "success");
        } catch (e) {
            showToast("Failed to update item", "error");
        }
    };

    const confirmRejection = async () => {
        if (!rejectionRemarks.trim()) {
            showToast("Please provide remarks for rejection", "error");
            return;
        }

        try {
            await api.post('/api/approvals/', {
                id: `CLAIM-${travel.claim.id}`,
                action: 'UpdateItem',
                item_id: rejectItemId,
                item_status: 'Rejected',
                remarks: rejectionRemarks
            });

            setShowRejectModal(false);
            setRejectItemId(null);
            setRejectionRemarks("");
            await fetchTravelStory();
            showToast(`Item Rejected updated`, "success");
        } catch (e) {
            showToast("Failed to reject item", "error");
        }
    };

    const handleExport = async (format) => {
        if (!travel) return;

        const setter = format === 'pdf' ? setIsExportingPDF : setIsExportingExcel;
        setter(true);
        showToast(`Generating ${format.toUpperCase()} statement...`, "info");

        try {
            const endpoint = travel.trip_id?.startsWith('ITS-') ? 'travels' : 'trips';
            const response = await api.get(`/api/${endpoint}/${travel.trip_id}/export/${format}/`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Travel_Expense_Statement_${travel.trip_id}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            showToast(`${format.toUpperCase()} downloaded successfully`, "success");
        } catch (error) {
            console.error(`${format.toUpperCase()} export failed:`, error);
            showToast(`Failed to generate ${format.toUpperCase()}`, "error");
        } finally {
            setter(false);
        }
    };

    const handleJobReportFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setJobReportFiles(prev => [...prev, { name: file.name, data: reader.result, type: file.type }]);
            };
            reader.readAsDataURL(file);
        });
        // Reset input so the same file can be re-attached
        if (jobReportFileInputRef.current) jobReportFileInputRef.current.value = '';
    };

    const handleJobReportSubmit = async () => {
        if (!jobReportDescription.trim()) {
            showToast("Please enter a description", "error");
            return;
        }

        setIsSubmittingJobReport(true);
        try {
            await api.post('/api/job-reports/', {
                travel: travel.trip_id,
                description: jobReportDescription,
                attachment: jobReportFiles[0]?.data || null,
                file_name: jobReportFiles[0]?.name || null,
                attachments: jobReportFiles.map(f => ({ data: f.data, name: f.name }))
            });
            showToast("Job Report sent successfully", "success");
            setShowJobReportModal(false);
            setJobReportDescription('');
            setJobReportFiles([]);
            fetchTravelStory();
        } catch (error) {
            console.error("Failed to save job report:", error);
            showToast("Failed to save job report", "error");
        } finally {
            setIsSubmittingJobReport(false);
        }
    };

    if (isLoading) {
        return (
            <div className="story-page-loading">
                <div className="spinner"></div>
                <p>Curating Travel Story...</p>
            </div>
        );
    }

    if (!travel) {
        return (
            <div className="story-page-error">
                <h2>Story Not Found</h2>
                <button onClick={() => navigate('/trips')}>Back to My Travel Stories</button>
            </div>
        );
    }



    return (
        <div className="story-page-container animate-fade-in">
            <header className="story-header report-mode">
                <div className="header-top">
                    <button className="back-btn" onClick={() => navigate('/trips')}>
                        <ChevronLeft size={20} />
                        <span>Back</span>
                    </button>
                    <div className="header-actions-group">
                        <div className="report-seal">
                            <ShieldCheck size={14} />
                            <span>OFFICIAL REPORT</span>
                        </div>
                    </div>
                </div>

                <div className="story-hero">
                    <div className="hero-content">
                        <div className="hero-branding">
                            <img src="/bavya.png" alt="Bavya Logo" className="story-bavya-logo" />
                            <div className="travel-id-label">Travel Record ID</div>
                            <div className="travel-id-pill">{travel.trip_id}</div>
                        </div>
                        <h1>Travel Story</h1>
                        <p className="hero-subtitle">{travel.purpose}</p>
                        <div className="hero-badges">
                            <span className={`status-badge ${travel.status?.toLowerCase() || 'pending'}`}>
                                {travel.status}
                            </span>
                        </div>
                    </div>
                    <div className="hero-stat-main">
                        <div className="hero-stat-item">
                            <label>Total Investment</label>
                            <strong>{formatCurrency(travel.total_expenses)}</strong>
                        </div>
                        <div className="hero-stat-divider"></div>
                        <div className="hero-stat-item">
                            <label>Settlement Status</label>
                            <strong style={{ color: travel.wallet_balance < 0 ? '#ef4444' : '#10b981' }}>
                                {travel.wallet_balance < 0 ? `Payable: ${formatCurrency(Math.abs(travel.wallet_balance))}` : `Surplus: ${formatCurrency(travel.wallet_balance)}`}
                            </strong>
                        </div>
                    </div>
                </div>
            </header>

            <div className="story-grid">
                {/* SECTION 1: Logistics & Meta */}
                <div className="story-section span-2">
                    <div className="section-header">
                        <LayoutGrid size={20} />
                        <h3>Travel Core Details</h3>
                    </div>
                    <div className="details-grid-4">
                        <div className="detail-card">
                            <MapPin className="icon-orange" size={20} />
                            <div className="detail-info">
                                <label>Route</label>
                                <p>
                                    {travel.consider_as_local
                                        ? (travel.user_base_location || travel.source || 'Local')
                                        : `${travel.source} → ${travel.destination}`
                                    }
                                </p>
                                {travel.en_route && <span className="sub-detail">via {travel.en_route}</span>}
                            </div>
                        </div>
                        <div className="detail-card">
                            <Calendar className="icon-blue" size={20} />
                            <div className="detail-info">
                                <label>Timeline</label>
                                <p>{formatDate(travel.start_date)} - {formatDate(travel.end_date)}</p>
                            </div>
                        </div>
                        <div className="detail-card">
                            <User className="icon-purple" size={20} />
                            <div className="detail-info">
                                <label>Personnel</label>
                                <p>{travel.user_name || 'N/A'}</p>
                                {travel.composition !== 'Solo' && travel.user_emp_id && travel.user_emp_id !== 'N/A' && (
                                    <span className="sub-detail">{travel.user_emp_id}</span>
                                )}

                                {travel.composition !== 'Solo' && (travel.user_bank_name || travel.user_account_no) && (
                                    <div className="bank-detail-mini mt-2">
                                        {travel.user_bank_name && travel.user_bank_name !== 'N/A' && (
                                            <div className="bank-row">
                                                <span className="bank-label">Bank:</span>
                                                <span className="bank-val">{travel.user_bank_name}</span>
                                            </div>
                                        )}
                                        {travel.user_account_no && travel.user_account_no !== 'N/A' && (
                                            <div className="bank-row">
                                                <span className="bank-label">A/C:</span>
                                                <span className="bank-val">{travel.user_account_no}</span>
                                            </div>
                                        )}
                                        {travel.user_ifsc_code && travel.user_ifsc_code !== 'N/A' && (
                                            <div className="bank-row">
                                                <span className="bank-label">IFSC:</span>
                                                <span className="bank-val">{travel.user_ifsc_code}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {travel.composition !== 'Solo' && travel.members && (
                                    <div className="sub-detail-list mt-3">
                                        <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Team Members</label>
                                        <div className="flex flex-wrap gap-1">
                                            {(() => {
                                                let members = [];
                                                try {
                                                    members = typeof travel.members === 'string' ? JSON.parse(travel.members) : (travel.members || []);
                                                } catch (e) {
                                                    members = Array.isArray(members) ? members : [members];
                                                }

                                                if (Array.isArray(members)) {
                                                    return members.map((member, idx) => {
                                                        const name = typeof member === 'object' ? (member.name || member.employee_name) : member;
                                                        return <span key={idx} className="member-tag-mini">{name}</span>;
                                                    });
                                                }
                                                return <span className="member-tag-mini">{String(travel.members)}</span>;
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="detail-card">
                            <ShieldCheck className="icon-green" size={20} />
                            <div className="detail-info">
                                <label>Project</label>
                                <p>{travel.project_code || 'General Activity'}</p>
                            </div>
                        </div>
                        <div className="detail-card">
                            <Briefcase className="icon-magenta" size={20} />
                            <div className="detail-info">
                                <label>Visit Purpose</label>
                                <p>{travel.purpose}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SECTION 2: Financial Grid */}
                <div className="story-section span-3">
                    <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <IndianRupee size={20} />
                            <h3>Financial Summary</h3>
                        </div>
                        {['approved', 'hr approved', 'on-going'].includes(travel.status?.toLowerCase()) && (
                            <button
                                className="top-up-btn"
                                onClick={() => setShowWalletModal(true)}
                            >
                                <Plus size={14} /> Request Top-up / Advance
                            </button>
                        )}
                    </div>
                    <div className="finance-grid">
                        <div className="fin-box premium">
                            <label>Approved Advance</label>
                            <div className="val-row">
                                <CreditCard size={18} />
                                <h2>{formatCurrency(travel.total_approved_advance)}</h2>
                            </div>
                            <p className="fin-desc">Funds disbursed by HQ</p>
                        </div>
                        <div className="fin-box warning">
                            <label>Recorded Expenses</label>
                            <div className="val-row">
                                <TrendingUp size={18} />
                                <h2>{formatCurrency(travel.total_expenses)}</h2>
                            </div>
                            <p className="fin-desc">On-field spending</p>
                        </div>
                        <div className="fin-box" style={{ background: 'var(--bg-main)' }}>
                            <label>Wallet Balance</label>
                            <div className="val-row">
                                <Layers size={18} />
                                <h2 style={{ color: travel.wallet_balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                    {formatCurrency(travel.wallet_balance)}
                                </h2>
                            </div>
                            <p className="fin-desc">Current available liquidity</p>
                        </div>
                    </div>
                </div>

                {/* SECTION 4: Dynamic Expense Registry / Audit View */}
                <div className="story-section span-3">
                    <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <StickyNote size={20} />
                            <h3>Detailed Expense Registry</h3>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button
                                style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, border: 'none', background: '#db2777', color: 'white', cursor: 'pointer' }}
                                onClick={() => setShowLuggagePopup(true)}
                            >
                                Additional Luggage
                            </button>

                            {(String(user?.id) === String(travel.current_approver) || String(user?.id) === String(travel.claim?.current_approver)) && (
                                <div className="audit-actions-quick" style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn-sm-audit secondary" onClick={() => navigate('/approvals')}>
                                        <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back to Inbox
                                    </button>
                                    <button className="btn-sm-audit reject" onClick={() => handleAction('Reject')} disabled={isActionLoading}>
                                        <XCircle size={14} /> Reject All
                                    </button>
                                    <button className="btn-sm-audit approve" onClick={() => handleAction('Approve')} disabled={isActionLoading}>
                                        <CheckCircle size={14} /> Final Approve
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {(String(user?.id) === String(travel.current_approver) || String(user?.id) === String(travel.claim?.current_approver)) && travel.expenses?.length > 0 && (
                        <div className="audit-grid-container mb-4">
                            <div className="expense-summary-strip">
                                <div className="summary-box">
                                    <span className="label">Total Claimed</span>
                                    <span className="value">₹{travel.expenses.reduce((s, e) => s + parseFloat(e.amount), 0).toLocaleString()}</span>
                                </div>
                                <div className="summary-box approved">
                                    <span className="label">Approved (Net)</span>
                                    <span className="value">₹{travel.expenses.filter(e => e.status !== 'Rejected').reduce((s, e) => s + parseFloat(e.amount), 0).toLocaleString()}</span>
                                </div>
                                <div className="summary-box rejected">
                                    <span className="label">Rejected</span>
                                    <span className="value">₹{travel.expenses.filter(e => e.status === 'Rejected').reduce((s, e) => s + parseFloat(e.amount), 0).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="expense-breakdown-table-wrapper">
                                <table className="breakdown-table audit-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Category</th>
                                            <th className="text-right">Amount</th>
                                            <th className="text-center">Proofs / Attachments</th>
                                            <th>RM Remarks</th>
                                            <th>HR Remarks</th>
                                            <th>Finance Remarks</th>
                                            <th className="text-center">Verdict</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {travel.expenses.map(exp => {
                                            const dept = user?.department?.toLowerCase() || '';
                                            const desig = user?.designation?.toLowerCase() || '';
                                            const role = user?.role?.toLowerCase() || '';
                                            const isFinance = role.includes('finance') || dept.includes('finance') || desig.includes('finance');
                                            const isHR = role.includes('hr') || dept.includes('hr') || desig.includes('hr') || dept.includes('human resources') || desig.includes('human resources');
                                            const isRM = !isFinance && !isHR;

                                            return (
                                                <tr key={exp.id} className={exp.status === 'Rejected' ? 'row-rejected' : ''}>
                                                    <td className="mono">{exp.date}</td>
                                                    <td>
                                                        <span className="cat-tag">{exp.category}</span>
                                                        <div className="json-desc-clean mt-1">
                                                            {exp.description && exp.description.startsWith('{') ? (
                                                                (() => {
                                                                    try {
                                                                        const d = JSON.parse(exp.description);
                                                                        let loc = `${d.origin || ''}${d.origin ? ' → ' : ''}${d.destination || d.location || d.hotelName || d.hotel_name || ''}`;
                                                                        if (d.isPublicTransport) loc += ` (via ${d.subType || 'others'})`;
                                                                        if (d.remainingRoute) loc += ` [${d.remainingRoute}]`;
                                                                        return (
                                                                            <>
                                                                                {d.is_deviated ? (
                                                                                    <>
                                                                                        <div style={{ color: '#64748b', fontSize: '0.7rem' }}>
                                                                                            <span style={{ fontWeight: 800 }}>Planned:</span> {d.origin} → {d.deviation_target || 'N/A'}
                                                                                        </div>
                                                                                        <div style={{ color: '#0f172a', fontWeight: 600 }}>
                                                                                            <span style={{ fontWeight: 800 }}>Actual:</span> {loc}
                                                                                        </div>
                                                                                        <div className="deviation-reason-mini mt-1" style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                            <span>⚠️ REASON:</span>
                                                                                            <span style={{ fontWeight: 500, color: '#475569' }}>{d.deviation_reason}</span>
                                                                                        </div>
                                                                                    </>
                                                                                ) : (
                                                                                    <div>{loc}</div>
                                                                                )}
                                                                            </>
                                                                        );
                                                                    } catch (e) { return exp.description; }
                                                                })()
                                                            ) : exp.description}
                                                        </div>
                                                    </td>
                                                    <td className="amount-cell text-right">
                                                        ₹{parseFloat(exp.amount).toLocaleString()}
                                                    </td>
                                                    <td className="text-center">
                                                        <div className="audit-bills-list" style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                            {/* Receipts */}
                                                            {(() => {
                                                                let bills = [];
                                                                try {
                                                                    if (Array.isArray(exp.receipt_image)) {
                                                                        bills = exp.receipt_image;
                                                                    } else if (typeof exp.receipt_image === 'string') {
                                                                        if (exp.receipt_image.startsWith('[')) {
                                                                            bills = JSON.parse(exp.receipt_image);
                                                                        } else {
                                                                            bills = exp.receipt_image.split(',').filter(b => b.trim());
                                                                        }
                                                                    }
                                                                } catch (e) {
                                                                    console.error("Error parsing receipts:", e);
                                                                    bills = [exp.receipt_image];
                                                                }

                                                                return (bills || []).filter(b => b).map((b, idx) => {
                                                                    const path = (b && typeof b === 'object') ? b.path : b;
                                                                    const fullUrl = getFullUrl(String(path).trim());
                                                                    return (
                                                                        <div
                                                                            key={`bill-${idx}`}
                                                                            className="receipt-preview-mini"
                                                                            onClick={() => setPreviewImageUrl(fullUrl)}
                                                                            title="View Receipt"
                                                                            style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'pointer', position: 'relative' }}
                                                                        >
                                                                            <img src={fullUrl} alt="Bill" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/40?text=Err'; }} />
                                                                            <div className="preview-overlay" style={{ background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 }}><ExternalLink size={10} color="#fff" /></div>
                                                                        </div>
                                                                    );
                                                                });
                                                            })()}

                                                            {/* Activity Proofs from Job Report (within expense JSON) */}
                                                            {(() => {
                                                                try {
                                                                    const d = JSON.parse(exp.description);
                                                                    if (Array.isArray(d.jobReportAttachments) && d.jobReportAttachments.length > 0) {
                                                                        return d.jobReportAttachments.map((jrAtt, jrIdx) => {
                                                                            const fullUrl = getFullUrl(jrAtt);
                                                                            return (
                                                                                <div
                                                                                    key={`jr-att-${jrIdx}`}
                                                                                    className="receipt-preview-mini activity-proof-mini"
                                                                                    onClick={() => setPreviewImageUrl(fullUrl)}
                                                                                    title="Activity Proof (Job Report)"
                                                                                    style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #4f46e5', cursor: 'pointer', background: '#eef2ff', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                                >
                                                                                    <img src={fullUrl} alt="JR" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                                                                                    <div style={{ position: 'absolute', bottom: 0, right: 0, background: '#4f46e5', color: 'white', fontSize: '7px', padding: '0 2px', borderRadius: '2px 0 0 0' }}>JR</div>
                                                                                </div>
                                                                            );
                                                                        });
                                                                    }
                                                                } catch (e) { }
                                                                return null;
                                                            })()}

                                                            {/* Trip-Level Job Reports / Activity Proofs (Fallback match by date) */}
                                                            {travel.job_reports?.filter(jr => {
                                                                const jrDate = new Date(jr.created_at).toLocaleDateString('en-IN', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric'
                                                                });
                                                                const expDate = new Date(exp.date).toLocaleDateString('en-IN', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric'
                                                                });
                                                                return jrDate === expDate;
                                                            }).map((jr, idx) => {
                                                                const fullUrl = getFullUrl(jr.attachment);
                                                                return (
                                                                    <div
                                                                        key={`jr-${idx}`}
                                                                        className="receipt-preview-mini job-report-mini"
                                                                        onClick={() => setPreviewImageUrl(fullUrl)}
                                                                        title={`Trip Activity Proof: ${jr.description}`}
                                                                        style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #4f46e5', background: '#eef2ff', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                    >
                                                                        <div className="jr-icon-overlay" style={{ fontSize: '9px', fontWeight: 'bold', color: '#4f46e5', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                                            <FileText size={14} />
                                                                            <span>DOC</span>
                                                                        </div>
                                                                        <div className="preview-overlay" style={{ background: 'rgba(79, 70, 229, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 }}><ExternalLink size={10} color="#fff" /></div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                    <td className="remarks-audit-cell">
                                                        {isRM ? (
                                                            <input
                                                                className="audit-remark-input"
                                                                placeholder="Add RM remarks..."
                                                                value={auditRemarks[exp.id] !== undefined ? auditRemarks[exp.id] : (exp.rm_remarks || "")}
                                                                onChange={(e) => setAuditRemarks({ ...auditRemarks, [exp.id]: e.target.value })}
                                                            />
                                                        ) : (
                                                            <span className="static-remark">{exp.rm_remarks || "—"}</span>
                                                        )}
                                                    </td>
                                                    <td className="remarks-audit-cell">
                                                        {isHR ? (
                                                            <input
                                                                className="audit-remark-input"
                                                                placeholder="Add HR remarks..."
                                                                value={auditRemarks[exp.id] !== undefined ? auditRemarks[exp.id] : (exp.hr_remarks || "")}
                                                                onChange={(e) => setAuditRemarks({ ...auditRemarks, [exp.id]: e.target.value })}
                                                            />
                                                        ) : (
                                                            <span className="static-remark">{exp.hr_remarks || "—"}</span>
                                                        )}
                                                    </td>
                                                    <td className="remarks-audit-cell">
                                                        {isFinance ? (
                                                            <input
                                                                className="audit-remark-input"
                                                                placeholder="Add Fin remarks..."
                                                                value={auditRemarks[exp.id] !== undefined ? auditRemarks[exp.id] : (exp.finance_remarks || "")}
                                                                onChange={(e) => setAuditRemarks({ ...auditRemarks, [exp.id]: e.target.value })}
                                                            />
                                                        ) : (
                                                            <span className="static-remark">{exp.finance_remarks || "—"}</span>
                                                        )}
                                                    </td>
                                                    <td className="actions-cell">
                                                        <div className="row-actions">
                                                            <button
                                                                className={`row-action-btn approve ${exp.status === 'Approved' ? 'active' : ''}`}
                                                                onClick={() => handleItemAction(exp.id, 'Approved')}
                                                            >
                                                                <CheckCircle size={14} />
                                                            </button>
                                                            <button
                                                                className={`row-action-btn reject ${exp.status === 'Rejected' ? 'active' : ''}`}
                                                                onClick={() => handleItemAction(exp.id, 'Rejected')}
                                                            >
                                                                <XCircle size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {!(String(user?.id) === String(travel.current_approver) || String(user?.id) === String(travel.claim?.current_approver)) && (
                        /* Only showing Local Travel / Conveyance categories for Travel Stories */
                        <TravelExpenseGrid
                            tripId={travel.trip_id}
                            startDate={travel.start_date}
                            endDate={travel.end_date}
                            initialExpenses={travel.expenses || []}
                            totalAdvance={travel.total_approved_advance || 0}
                            onUpdate={fetchTravelStory}
                            tripStatus={travel.status}
                            claimStatus={travel.claim?.status}
                            allowedNatures={travel?.consider_as_local ? ['Local Travel', 'Daily Allowance'] : ['Travel', 'Local Travel', 'Food', 'Daily Allowance', 'Accommodation', 'Incidental']}
                            dateFilter={dateFilter}
                            onFilterChange={setDateFilter}
                            // only show bulk button for full travel requests (TRP-)
                            showBulkUpload={true}
                            isBulkUpload={travel.is_bulk_upload || (travel.activity_batches && travel.activity_batches.length > 0)}
                            onJobReportClick={() => setShowJobReportModal(true)}
                        />
                    )}
                </div>

                {/* SECTION 5: Approval & Settlement Story */}
                <div className="story-section span-3">
                    <div className="section-header">
                        <CheckCircle2 size={20} />
                        <h3>Settlement & Payout Lifecycle</h3>
                    </div>
                    <div className="settlement-summary-grid">
                        <div className="settle-card">
                            <label>Claim Status</label>
                            <div className={`settle-badge ${travel.claim?.status?.toLowerCase() || 'unsubmitted'}`}>
                                {travel.claim?.status || 'No Claim Filed'}
                            </div>
                        </div>
                        <div className="settle-card">
                            <label>Transferred By</label>
                            <p>{travel.claim?.processed_by?.name || 'Waiting'}</p>
                        </div>
                        <div className="settle-card">
                            <label>Travel Case ID</label>
                            <p className="mono">{travel.claim?.transaction_id || 'N/A'}</p>
                        </div>
                        <div className="settle-card">
                            <label>Payout Date</label>
                            <p>{travel.claim?.payment_date ? formatDate(travel.claim.payment_date) : 'N/A'}</p>
                        </div>
                    </div>
                </div>

                {/* SECTION 6: Job Reports Grid */}
                {travel.job_reports?.length > 0 && (
                    <div className="story-section span-3">
                        <div className="section-header">
                            <FileText size={20} />
                            <h3>Job Reports</h3>
                        </div>
                        <div className="expense-breakdown-table-wrapper">
                            <table className="breakdown-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Submitted By</th>
                                        <th>Description</th>
                                        <th>Attachment</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {travel.job_reports.map(report => (
                                        <tr key={report.id}>
                                            <td className="mono" style={{ width: '120px' }}>{formatDate(report.created_at)}</td>
                                            <td style={{ width: '150px' }}>{report.user_name}</td>
                                            <td>{report.description}</td>
                                            <td style={{ width: '100px' }}>
                                                {report.attachment ? (
                                                    <button
                                                        className="bill-preview-icon"
                                                        onClick={() => setPreviewImageUrl(getFullUrl(report.attachment))}
                                                    >
                                                        <FileText size={16} />
                                                        <span style={{ marginLeft: '4px', fontSize: '0.75rem' }}>View Proof</span>
                                                    </button>
                                                ) : 'N/A'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* REPORT EXPORT ACTIONS AT BOTTOM */}
            <div className="story-footer-actions animate-fade-in" style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '1rem',
                padding: '2rem 0',
                borderTop: '1px solid #e2e8f0',
                marginTop: '2rem'
            }}>
                <button
                    className="btn btn-secondary"
                    style={{ padding: '12px 24px', borderRadius: '12px', display: 'flex', gap: '10px', alignItems: 'center', fontWeight: '700' }}
                    onClick={() => handleExport('pdf')}
                    disabled={isExportingPDF}
                >
                    <FileText size={20} />
                    {isExportingPDF ? 'Generating PDF...' : 'Download PDF Statement'}
                </button>
                <button
                    className="btn btn-secondary"
                    style={{ padding: '12px 24px', borderRadius: '12px', display: 'flex', gap: '10px', alignItems: 'center', fontWeight: '700' }}
                    onClick={() => handleExport('excel')}
                    disabled={isExportingExcel}
                >
                    <Download size={20} />
                    {isExportingExcel ? 'Generating Excel...' : 'Export to Excel'}
                </button>
                <button
                    className="btn btn-outline"
                    style={{ padding: '12px 24px', borderRadius: '12px', display: 'flex', gap: '10px', alignItems: 'center', fontWeight: '700', border: '1px solid #cbd5e1' }}
                    onClick={() => window.print()}
                >
                    <Printer size={20} />
                    <span>Print Summary</span>
                </button>
            </div>

            <TripWalletModal
                isOpen={showWalletModal}
                onClose={() => setShowWalletModal(false)}
                trip={{ id: travel.trip_id, ...travel }}
                onUpdate={fetchTravelStory}
            />

            {showLuggagePopup && (
                <div className="custom-confirm-overlay">
                    <div className="custom-confirm-modal" style={{ maxWidth: '400px' }}>
                        <div className="modal-content-p" style={{ padding: '1.5rem', textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Additional Luggage</h3>
                                <button onClick={() => setShowLuggagePopup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <XCircle size={20} color="#94a3b8" />
                                </button>
                            </div>
                            <div className="field-group mb-3" style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                    Luggage weight (in kg/grams) <span style={{ color: 'red' }}>*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g., 5 kg"
                                    value={luggageWeight}
                                    onChange={(e) => setLuggageWeight(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                                />
                            </div>
                            <div className="field-group mb-3" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                    Remarks <span style={{ color: 'red' }}>*</span>
                                </label>
                                <textarea
                                    placeholder="Add any additional notes..."
                                    value={luggageRemarks}
                                    onChange={(e) => setLuggageRemarks(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', minHeight: '80px', fontSize: '0.9rem', resize: 'vertical' }}
                                />
                            </div>
                            <div className="modal-actions-p" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button className="modal-btn cancel" onClick={() => setShowLuggagePopup(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#475569' }}>Cancel</button>
                                <button className="modal-btn confirm" onClick={() => {
                                    if (!luggageWeight || !luggageRemarks) {
                                        showToast("Please enter both luggage weight and remarks.", "error");
                                        return;
                                    }
                                    setShowLuggagePopup(false);
                                    showToast("Additional Luggage info saved locally.", "success");
                                }} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#db2777', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showJobReportModal && (
                <div className="gmail-compose-overlay" onClick={() => { setShowJobReportModal(false); setJobReportDescription(''); setJobReportFiles([]); }}>
                    <div className="gmail-compose-window" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="gmail-compose-header">
                            <span className="gmail-compose-title">New Job Report</span>
                            <button className="gmail-compose-close" onClick={() => { setShowJobReportModal(false); setJobReportDescription(''); setJobReportFiles([]); }}>
                                <XCircle size={18} />
                            </button>
                        </div>

                        {/* Subject Row - read-only, fixed to ID */}
                        <div className="gmail-compose-subject-row">
                            <span className="gmail-compose-field-label">Subject</span>
                            <span className="gmail-compose-subject-value">{travel?.trip_id} — Job / Activity Report</span>
                        </div>

                        <div className="gmail-compose-divider" />

                        {/* Body */}
                        <textarea
                            className="gmail-compose-body"
                            placeholder="Write your detailed job/activity report here..."
                            value={jobReportDescription}
                            onChange={e => setJobReportDescription(e.target.value)}
                            autoFocus
                        />

                        {/* Attached files row */}
                        {jobReportFiles.length > 0 && (
                            <div className="gmail-attachments-row">
                                {jobReportFiles.map((f, idx) => (
                                    <div key={idx} className="gmail-attachment-chip">
                                        <FileText size={13} />
                                        <span className="gmail-chip-name">{f.name}</span>
                                        <button className="gmail-chip-remove" onClick={() => setJobReportFiles(prev => prev.filter((_, i) => i !== idx))}>
                                            <XCircle size={13} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Bottom toolbar */}
                        <div className="gmail-compose-toolbar">
                            <button
                                className="gmail-send-btn"
                                onClick={handleJobReportSubmit}
                                disabled={isSubmittingJobReport || !jobReportDescription.trim()}
                            >
                                {isSubmittingJobReport ? 'Sending...' : 'Send'}
                                {!isSubmittingJobReport && <span style={{ fontSize: '0.75rem', opacity: 0.8, marginLeft: '4px' }}>▾</span>}
                            </button>

                            <div className="gmail-toolbar-right">
                                {/* Attachment button */}
                                <button
                                    className="gmail-toolbar-icon-btn"
                                    title="Attach files"
                                    onClick={() => jobReportFileInputRef.current?.click()}
                                >
                                    <Upload size={18} />
                                </button>
                                <input
                                    ref={jobReportFileInputRef}
                                    type="file"
                                    accept="image/*,.pdf,.doc,.docx,.xlsx,.xls"
                                    multiple
                                    hidden
                                    onChange={handleJobReportFileChange}
                                />

                                {/* Discard */}
                                <button
                                    className="gmail-toolbar-icon-btn discard"
                                    title="Discard"
                                    onClick={() => { setShowJobReportModal(false); setJobReportDescription(''); setJobReportFiles([]); }}
                                >
                                    <XCircle size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden PDF Template Container */}
            <div style={{ overflow: 'hidden', height: 0, width: 0 }}>
                <ExpenseReportPDF ref={reportRef} trip={travel} />
            </div>

            {/* Rejection Modal */}
            {showRejectModal && (
                <div className="custom-confirm-overlay">
                    <div className="custom-confirm-modal" style={{ maxWidth: '400px' }}>
                        <div className="modal-content-p" style={{ padding: '1.5rem', textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Reject Expense Item</h3>
                                <button onClick={() => setShowRejectModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <XCircle size={20} color="#94a3b8" />
                                </button>
                            </div>
                            <div className="field-group mb-3" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                    Rejection Remarks <span style={{ color: 'red' }}>*</span>
                                </label>
                                <textarea
                                    placeholder="Explain why this expense is being rejected..."
                                    value={rejectionRemarks}
                                    onChange={(e) => setRejectionRemarks(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', minHeight: '100px', fontSize: '0.9rem', resize: 'vertical' }}
                                />
                            </div>
                            <div className="modal-actions-p" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button className="modal-btn cancel" onClick={() => setShowRejectModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#475569' }}>Cancel</button>
                                <button className="modal-btn confirm" onClick={confirmRejection} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Confirm Rejection</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* In-App Image/Document Preview */}
            {previewImageUrl && (
                <div className="custom-confirm-overlay" style={{ zIndex: 3000 }} onClick={() => setPreviewImageUrl(null)}>
                    <div className="preview-modal-container" onClick={e => e.stopPropagation()} style={{
                        position: 'relative',
                        maxWidth: '90vw',
                        maxHeight: '90vh',
                        background: '#fff',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div className="preview-modal-header" style={{
                            padding: '12px 20px',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#f8fafc'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Attachment Preview</h3>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => window.open(previewImageUrl, '_blank')}
                                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                                >
                                    <FileText size={16} /> Open Original
                                </button>
                                <button onClick={() => setPreviewImageUrl(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                    <XCircle size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="preview-modal-body" style={{ overflow: 'auto', background: '#f1f5f9', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                            {previewImageUrl.toLowerCase().endsWith('.pdf') || previewImageUrl.includes('data:application/pdf') ? (
                                <iframe src={previewImageUrl} style={{ width: '80vw', height: '80vh', border: 'none' }} title="PDF Preview" />
                            ) : (
                                <img src={previewImageUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TravelStory;
