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
    Upload
} from 'lucide-react';
import { encodeId, decodeId } from '../utils/idEncoder';
import api from '../api/api';
import { useToast } from '../context/ToastContext.jsx';
import html2canvas from 'html2canvas';
import TripExpenseGrid from '../components/trips/TripExpenseGrid.jsx';
import TripWalletModal from '../components/trips/TripWalletModal';
import ExpenseReportPDF from '../components/trips/ExpenseReportPDF';
import { formatIndianCurrency } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import './TripStory.css';
import './gmail_compose.css';



const TripStory = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();
    const [trip, setTrip] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [auditRemarks, setAuditRemarks] = useState({});

    // Luggage popup state
    const [showLuggagePopup, setShowLuggagePopup] = useState(false);
    const [luggageWeight, setLuggageWeight] = useState('');
    const [luggageRemarks, setLuggageRemarks] = useState('');

    // PDF Export refs and state
    const reportRef = useRef(null);
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);

    // Job Report state
    const [showJobReportModal, setShowJobReportModal] = useState(false);
    const [jobReportDescription, setJobReportDescription] = useState('');
    const [jobReportFile, setJobReportFile] = useState(null);
    const [isSubmittingJobReport, setIsSubmittingJobReport] = useState(false);

    useEffect(() => {
        fetchTripStory();
    }, [id]);

    const fetchTripStory = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const decodedId = decodeId(id);
            const response = await api.get(`/api/trips/${decodedId}/`);
            setTrip(response.data);
        } catch (error) {
            console.error("Failed to fetch trip story:", error);
            showToast("Failed to load trip story", "error");
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    const handleAction = async (action) => {
        if (!trip) return;
        setIsActionLoading(true);
        try {
            const task_id = trip.claim ? `CLAIM-${trip.claim.id}` : `TRIP-${trip.trip_id}`;
            await api.post('/api/approvals/', {
                id: task_id,
                action: action
            });
            showToast(`${action} successful`, "success");
            fetchTripStory();
        } catch (error) {
            showToast(`Failed to ${action}`, "error");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleItemAction = async (itemId, itemStatus) => {
        if (!trip?.claim) return;
        const remarks = auditRemarks[itemId] || "";

        if (itemStatus === 'Rejected' && !remarks.trim()) {
            showToast("Please provide remarks for rejection", "error");
            return;
        }

        try {
            await api.post('/api/approvals/', {
                id: `CLAIM-${trip.claim.id}`,
                action: 'UpdateItem',
                item_id: itemId,
                item_status: itemStatus,
                remarks: remarks
            });

            // Re-fetch to get updated state across all remark fields
            await fetchTripStory();
            showToast(`Item ${itemStatus} updated`, "success");
        } catch (e) {
            showToast("Failed to update item", "error");
        }
    };

    const handleExport = async (format) => {
        if (!trip) return;

        const setter = format === 'pdf' ? setIsExportingPDF : setIsExportingExcel;
        setter(true);
        showToast(`Generating ${format.toUpperCase()} statement...`, "info");

        try {
            const response = await api.get(`/api/trips/${trip.trip_id}/export/${format}/`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Travel_Expense_Statement_${trip.trip_id}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
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
        const file = e.target.files[0];
        if (file) {
            if (file.type !== 'application/pdf') {
                showToast("Please upload only PDF files", "error");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setJobReportFile({
                    name: file.name,
                    data: reader.result
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleJobReportSubmit = async () => {
        if (!jobReportDescription.trim()) {
            showToast("Please enter a description", "error");
            return;
        }

        setIsSubmittingJobReport(true);
        try {
            await api.post('/api/job-reports/', {
                trip: trip.trip_id,
                description: jobReportDescription,
                attachment: jobReportFile?.data || null,
                file_name: jobReportFile?.name || null
            });
            showToast("Job Report saved successfully", "success");
            setShowJobReportModal(false);
            setJobReportDescription('');
            setJobReportFile(null);
            fetchTripStory(); // Refresh to show in grid
        } catch (error) {
            console.error("Failed to save job report:", error);
            showToast("Failed to save job report", "error");
        } finally {
            setIsSubmittingJobReport(false);
        }
    };

    if (isLoading && !trip) {
        return (
            <div className="story-page-loading">
                <div className="spinner"></div>
                <p>Curating Trip Story...</p>
            </div>
        );
    }

    if (!trip) {
        return (
            <div className="story-page-error">
                <h2>Story Not Found</h2>
                <button onClick={() => navigate('/trips')}>Back to My Trips</button>
            </div>
        );
    }

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
                            <div className="hero-divider-v"></div>
                            <div className="trip-id-pill">{trip.trip_id}</div>
                        </div>
                        <h1>Trip Story</h1>
                        <p className="hero-subtitle">{trip.purpose}</p>
                        <div className="hero-badges">
                            <span className={`status-badge ${trip.status?.toLowerCase() || 'pending'}`}>
                                {trip.status}
                            </span>
                        </div>
                    </div>
                    <div className="hero-stat-main">
                        <div className="hero-stat-item">
                            <label>Total Investment</label>
                            <strong>{formatCurrency(trip.total_expenses)}</strong>
                        </div>
                        <div className="hero-stat-divider"></div>
                        <div className="hero-stat-item">
                            <label>Settlement Status</label>
                            <strong style={{ color: trip.wallet_balance < 0 ? '#ef4444' : '#10b981' }}>
                                {trip.wallet_balance < 0 ? `Payable: ${formatCurrency(Math.abs(trip.wallet_balance))}` : `Surplus: ${formatCurrency(trip.wallet_balance)}`}
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
                        <h3>Trip Core Details</h3>
                    </div>
                    <div className="details-grid-4">
                        <div className="detail-card">
                            <MapPin className="icon-orange" size={20} />
                            <div className="detail-info">
                                <label>Route</label>
                                <p>{trip.source} → {trip.destination}</p>
                                {trip.en_route && <span className="sub-detail">via {trip.en_route}</span>}
                            </div>
                        </div>
                        <div className="detail-card">
                            <Calendar className="icon-blue" size={20} />
                            <div className="detail-info">
                                <label>Timeline</label>
                                <p>{formatDate(trip.start_date)} - {formatDate(trip.end_date)}</p>
                            </div>
                        </div>
                        <div className="detail-card">
                            <User className="icon-purple" size={20} />
                            <div className="detail-info">
                                <label>Personnel</label>
                                <p>{trip.user_name || 'N/A'}</p>
                                {trip.composition !== 'Solo' && trip.user_emp_id && trip.user_emp_id !== 'N/A' && (
                                    <span className="sub-detail">{trip.user_emp_id}</span>
                                )}

                                {trip.composition !== 'Solo' && (trip.user_bank_name || trip.user_account_no) && (
                                    <div className="bank-detail-mini mt-2">
                                        {trip.user_bank_name && trip.user_bank_name !== 'N/A' && (
                                            <div className="bank-row">
                                                <span className="bank-label">Bank:</span>
                                                <span className="bank-val">{trip.user_bank_name}</span>
                                            </div>
                                        )}
                                        {trip.user_account_no && trip.user_account_no !== 'N/A' && (
                                            <div className="bank-row">
                                                <span className="bank-label">A/C:</span>
                                                <span className="bank-val">{trip.user_account_no}</span>
                                            </div>
                                        )}
                                        {trip.user_ifsc_code && trip.user_ifsc_code !== 'N/A' && (
                                            <div className="bank-row">
                                                <span className="bank-label">IFSC:</span>
                                                <span className="bank-val">{trip.user_ifsc_code}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {trip.composition !== 'Solo' && trip.members && (
                                    <div className="sub-detail-list mt-3">
                                        <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Team Members</label>
                                        <div className="flex flex-wrap gap-1">
                                            {(() => {
                                                let members = [];
                                                try {
                                                    members = typeof trip.members === 'string' ? JSON.parse(trip.members) : (trip.members || []);
                                                } catch (e) {
                                                    members = Array.isArray(trip.members) ? trip.members : [trip.members];
                                                }

                                                if (Array.isArray(members)) {
                                                    return members.map((member, idx) => {
                                                        const name = typeof member === 'object' ? (member.name || member.employee_name) : member;
                                                        return <span key={idx} className="member-tag-mini">{name}</span>;
                                                    });
                                                }
                                                return <span className="member-tag-mini">{String(trip.members)}</span>;
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
                                <p>{trip.project_code || 'General Activity'}</p>
                            </div>
                        </div>
                        <div className="detail-card">
                            <Briefcase className="icon-magenta" size={20} />
                            <div className="detail-info">
                                <label>Purpose</label>
                                <p>{trip.purpose}</p>
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
                        {['approved', 'hr approved', 'on-going'].includes(trip.status?.toLowerCase()) && (
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
                                <h2>{formatCurrency(trip.total_approved_advance)}</h2>
                            </div>
                            <p className="fin-desc">Funds disbursed by HQ</p>
                        </div>
                        <div className="fin-box warning">
                            <label>Recorded Expenses</label>
                            <div className="val-row">
                                <TrendingUp size={18} />
                                <h2>{formatCurrency(trip.total_expenses)}</h2>
                            </div>
                            <p className="fin-desc">On-field spending</p>
                        </div>
                        <div className="fin-box" style={{ background: 'var(--bg-main)' }}>
                            <label>Wallet Balance</label>
                            <div className="val-row">
                                <Layers size={18} />
                                <h2 style={{ color: trip.wallet_balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                    {formatCurrency(trip.wallet_balance)}
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

                            {(String(user?.id) === String(trip.current_approver) || String(user?.id) === String(trip.claim?.current_approver)) && (
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

                    {(String(user?.id) === String(trip.current_approver) || String(user?.id) === String(trip.claim?.current_approver)) && trip.expenses?.length > 0 && (
                        <div className="audit-grid-container mb-4">
                            <div className="expense-summary-strip">
                                <div className="summary-box">
                                    <span className="label">Total Claimed</span>
                                    <span className="value">₹{trip.expenses.reduce((s, e) => s + parseFloat(e.amount), 0).toLocaleString()}</span>
                                </div>
                                <div className="summary-box approved">
                                    <span className="label">Approved (Net)</span>
                                    <span className="value">₹{trip.expenses.filter(e => e.status !== 'Rejected').reduce((s, e) => s + parseFloat(e.amount), 0).toLocaleString()}</span>
                                </div>
                                <div className="summary-box rejected">
                                    <span className="label">Rejected</span>
                                    <span className="value">₹{trip.expenses.filter(e => e.status === 'Rejected').reduce((s, e) => s + parseFloat(e.amount), 0).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="expense-breakdown-table-wrapper">
                                <table className="breakdown-table audit-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Category</th>
                                            <th>Amount</th>
                                            <th>RM Remarks</th>
                                            <th>HR Remarks</th>
                                            <th>Finance Remarks</th>
                                            <th className="text-center">Verdict</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trip.expenses.map(exp => {
                                            const role = user?.role?.toLowerCase() || '';
                                            const isFinance = role.includes('finance');
                                            const isHR = role.includes('hr');
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
                                                                        return `${d.origin || ''}${d.origin ? ' → ' : ''}${d.destination || d.location || d.hotelName || d.hotel_name || ''}`;
                                                                    } catch (e) { return exp.description; }
                                                                })()
                                                            ) : exp.description}
                                                        </div>
                                                    </td>
                                                    <td className="amount-cell">
                                                        <div className="amount-with-bill">
                                                            ₹{parseFloat(exp.amount).toLocaleString()}
                                                            {exp.receipt_image && (() => {
                                                                let bills = [];
                                                                try {
                                                                    if (typeof exp.receipt_image === 'string' && exp.receipt_image.startsWith('[')) {
                                                                        bills = JSON.parse(exp.receipt_image);
                                                                    } else {
                                                                        bills = [exp.receipt_image];
                                                                    }
                                                                } catch (e) { bills = [exp.receipt_image]; }

                                                                return (
                                                                    <div className="audit-bills-list" style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                                                                        {bills.map((b, idx) => (
                                                                            <button
                                                                                key={idx}
                                                                                className="bill-preview-icon"
                                                                                title={`View Bill ${idx + 1}`}
                                                                                onClick={() => {
                                                                                    const nw = window.open();
                                                                                    const src = (b.startsWith('data:') || b.startsWith('http')) ? b : `data:image/jpeg;base64,${b}`;
                                                                                    nw.document.write(`<img src="${src}" style="max-width:100%;" />`);
                                                                                }}
                                                                            >
                                                                                <FileText size={12} />
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            })()}
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

                    {!(String(user?.id) === String(trip.current_approver) || String(user?.id) === String(trip.claim?.current_approver)) && (
                        // interpret trip_id prefix to decide which natures are allowed.
                        // requests whose ID **starts with 'TRP-' are full travel trips**;
                        // display all categories for them. any other prefix (e.g. ITS-)
                        // denotes a local‑conveyance request and should be filtered to
                        // local travel only.
                        <TripExpenseGrid
                            tripId={trip.trip_id}
                            startDate={trip.start_date}
                            endDate={trip.end_date}
                            initialExpenses={trip.expenses || []}
                            totalAdvance={
                                trip.status === 'Settled'
                                    ? (parseFloat(trip.user_carry_forward || 0) + parseFloat(trip.total_expenses || 0))
                                    : (parseFloat(trip.total_approved_advance || 0) + parseFloat(trip.user_carry_forward || 0))
                            }
                            onUpdate={fetchTripStory}
                            tripStatus={trip.status}
                            claimStatus={trip.claim?.status}
                            allowedNatures={trip.trip_id?.startsWith('TRP-') ? null : ['Local Travel']}
                            // only show bulk button for full travel requests (TRP-)
                            showBulkUpload={trip.trip_id?.startsWith('TRP-')}
                            onJobReportClick={() => setShowJobReportModal(true)}
                            hasAdditionalLuggage={!!luggageWeight}
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
                            <div className={`settle-badge ${trip.claim?.status?.toLowerCase() || 'unsubmitted'}`}>
                                {trip.claim?.status || 'No Claim Filed'}
                            </div>
                        </div>
                        <div className="settle-card">
                            <label>Transferred By</label>
                            <p>{trip.claim?.processed_by?.name || 'Waiting'}</p>
                        </div>
                        <div className="settle-card">
                            <label>Transaction ID</label>
                            <p className="mono">{trip.claim?.transaction_id || 'N/A'}</p>
                        </div>
                        <div className="settle-card">
                            <label>Payout Date</label>
                            <p>{trip.claim?.payment_date ? formatDate(trip.claim.payment_date) : 'N/A'}</p>
                        </div>
                    </div>
                </div>

                {/* SECTION 6: Job Reports Grid */}
                {trip.job_reports?.length > 0 && (
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
                                    {trip.job_reports.map(report => (
                                        <tr key={report.id}>
                                            <td className="mono" style={{ width: '120px' }}>{formatDate(report.created_at)}</td>
                                            <td style={{ width: '150px' }}>{report.user_name}</td>
                                            <td>{report.description}</td>
                                            <td style={{ width: '100px' }}>
                                                {report.attachment ? (
                                                    <button
                                                        className="bill-preview-icon"
                                                        onClick={() => {
                                                            const nw = window.open();
                                                            nw.document.write(`<iframe src="${report.attachment}" style="width:100%; height:100vh; border:none;"></iframe>`);
                                                        }}
                                                    >
                                                        <FileText size={16} />
                                                        <span style={{ marginLeft: '4px', fontSize: '0.75rem' }}>View PDF</span>
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

            {/* PREMIUM EXPORT ACTIONS */}
            <div className="story-footer-actions animate-fade-in" style={{
                padding: '3rem 0',
                borderTop: '2px dashed #e2e8f0',
                marginTop: '3rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.5rem'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem' }}>Finalize & Export</h3>
                    <p style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>Download your trip expense statement in your preferred format.</p>
                </div>

                <div style={{
                    display: 'flex',
                    background: '#f8fafc',
                    padding: '8px',
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    gap: '8px',
                    flexWrap: 'wrap',
                    justifyContent: 'center'
                }}>
                    <button
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${isExportingPDF ? 'bg-slate-200 text-slate-400' : 'bg-white text-slate-700 hover:bg-primary/5 hover:text-primary hover:border-primary border border-transparent hover:shadow-md'}`}
                        onClick={() => handleExport('pdf')}
                        disabled={isExportingPDF}
                    >
                        <FileText size={18} className={isExportingPDF ? '' : 'text-primary'} />
                        <span>{isExportingPDF ? 'Generating PDF...' : 'PDF Statement'}</span>
                    </button>

                    <button
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${isExportingExcel ? 'bg-slate-200 text-slate-400' : 'bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 border border-transparent hover:shadow-md'}`}
                        onClick={() => handleExport('excel')}
                        disabled={isExportingExcel}
                    >
                        <Download size={18} className={isExportingExcel ? '' : 'text-emerald-500'} />
                        <span>{isExportingExcel ? 'Exporting...' : 'Excel Report'}</span>
                    </button>

                    <div style={{ width: '1px', background: '#e2e8f0', margin: '4px 8px' }} />

                    <button
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-50 border border-transparent hover:border-slate-200 hover:shadow-md transition-all"
                        onClick={() => window.print()}
                    >
                        <Printer size={18} className="text-slate-400" />
                        <span>Print</span>
                    </button>

                    <button
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-slate-700 bg-white hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-200 hover:shadow-md transition-all"
                        onClick={() => {
                            if (navigator.share) {
                                navigator.share({
                                    title: `Trip Story - ${trip.trip_id}`,
                                    text: `Check out the expense statement for ${trip.trip_id}`,
                                    url: window.location.href
                                }).catch(console.error);
                            } else {
                                navigator.clipboard.writeText(window.location.href);
                                showToast("Link copied to clipboard!", "success");
                            }
                        }}
                    >
                        <Share2 size={18} className="text-blue-500" />
                        <span>Share</span>
                    </button>
                </div>

                <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                    Statement generated on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>

            <TripWalletModal
                isOpen={showWalletModal}
                onClose={() => setShowWalletModal(false)}
                trip={{ id: trip.trip_id, ...trip }}
                onUpdate={fetchTripStory}
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
                <div className="custom-confirm-overlay">
                    <div className="custom-confirm-modal" style={{ maxWidth: '500px' }}>
                        <div className="modal-content-p" style={{ padding: '1.5rem', textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Add Job Report</h3>
                                <button onClick={() => setShowJobReportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <XCircle size={20} color="#94a3b8" />
                                </button>
                            </div>
                            <div className="field-group mb-4" style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                    Report Description <span style={{ color: 'red' }}>*</span>
                                </label>
                                <textarea
                                    placeholder="Enter your detailed job/activity report here..."
                                    value={jobReportDescription}
                                    onChange={(e) => setJobReportDescription(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', minHeight: '120px', fontSize: '0.9rem', resize: 'vertical' }}
                                />
                            </div>
                            <div className="field-group mb-4" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                    Attach PDF Report
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <label className="upload-btn-styled" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '6px', background: '#f1f5f9', border: '1px dashed #cbd5e1', fontSize: '0.85rem', color: '#475569' }}>
                                        <Upload size={16} />
                                        <span>{jobReportFile ? jobReportFile.name : 'Choose PDF File'}</span>
                                        <input type="file" accept="application/pdf" hidden onChange={handleJobReportFileChange} />
                                    </label>
                                    {jobReportFile && (
                                        <button onClick={() => setJobReportFile(null)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                            <XCircle size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="modal-actions-p" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button className="modal-btn cancel" onClick={() => setShowJobReportModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#475569' }}>Cancel</button>
                                <button className="modal-btn confirm" onClick={handleJobReportSubmit} disabled={isSubmittingJobReport} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: isSubmittingJobReport ? 0.7 : 1 }}>
                                    {isSubmittingJobReport ? 'Saving...' : 'Save Report'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden PDF Template Container */}
            <div style={{ overflow: 'hidden', height: 0, width: 0 }}>
                <ExpenseReportPDF ref={reportRef} trip={trip} />
            </div>
        </div>
    );
};

export default TripStory;
