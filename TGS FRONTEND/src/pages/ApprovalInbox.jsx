import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { encodeId } from '../utils/idEncoder';
import {
    CheckCircle,
    XCircle,
    HelpCircle,
    PauseCircle,
    AlertTriangle,
    FileText,
    User,
    ArrowRight,
    Loader2,
    IndianRupee,
    ChevronDown,
    ChevronUp,
    Filter,
    ExternalLink,
    Upload,
    Gauge,
    Camera,
    MapPin,
    Clock,
    Navigation,
    Locate,
    Mail,
    Paperclip,
    Download,
    X,
    ClipboardList,
    RotateCcw
} from 'lucide-react';
import api from '../api/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import './ApprovalInbox.css';


const ApprovalInbox = ({ enforceTab = null }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(enforceTab || 'pending');
    const [filterType, setFilterType] = useState('all');
    const [tasks, setTasks] = useState([]);
    const [counts, setCounts] = useState({ total: 0, advances: 0, trips: 0, claims: 0 });
    const [pagination, setPagination] = useState({
        count: 0,
        next: null,
        previous: null,
        currentPage: 1
    });
    const [selectedTask, setSelectedTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [itemRemarks, setItemRemarks] = useState({});
    const [expandedExpenseId, setExpandedExpenseId] = useState(null);
    const [execAmount, setExecAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [receiptFile, setReceiptFile] = useState(null);
    const { user } = useAuth();
    const [batches, setBatches] = useState([]);
    const [expandedBatch, setExpandedBatch] = useState(null);
    const [isTourPlanOpen, setIsTourPlanOpen] = useState(true);
    const [isSpecialRequestsOpen, setIsSpecialRequestsOpen] = useState(true);
    const [viewType, setViewType] = useState('special');
    const [showItemRejectModal, setShowItemRejectModal] = useState(false);
    const [rejectItemId, setRejectItemId] = useState(null);
    const [rejectionItemRemarks, setRejectionItemRemarks] = useState('');
    const [previewImageUrl, setPreviewImageUrl] = useState(null);
    const [batchItemEdits, setBatchItemEdits] = useState({});
    const [selectedJobReport, setSelectedJobReport] = useState(null);
    const [isJobReportModalOpen, setIsJobReportModalOpen] = useState(false);

    const rawRole = user?.role?.toLowerCase() || '';
    const dept = user?.department?.toLowerCase() || '';
    const desig = user?.designation?.toLowerCase() || '';

    // Advanced Detection matching backend
    const isFinanceHead = (dept.includes('finance') && dept.includes('head')) ||
        (desig.includes('finance') && desig.includes('head')) ||
        rawRole === 'cfo';

    const isFinance = dept.includes('finance') || desig.includes('finance') || rawRole === 'finance' || isFinanceHead;
    const isFinanceExec = isFinance && !isFinanceHead;

    useEffect(() => {
        console.log("Current User Role:", rawRole, "Dept:", dept, "Desig:", desig);
    }, [user, rawRole, dept, desig]);

    const fetchCounts = async () => {
        try {
            const resp = await api.get('/api/approvals/count/');
            setCounts(resp.data);
        } catch (e) {
            console.error("Failed to fetch counts");
        }
    };

    const fetchTasks = async (tab = 'pending', type = filterType, page = 1) => {
        try {
            setLoading(true);
            const url = `/api/approvals/?tab=${tab}&type=${type}&page=${page}`;
            const response = await api.get(url);

            const data = response.data.results || response.data || [];
            setTasks(data);

            if (response.data.count !== undefined) {
                setPagination({
                    count: response.data.count,
                    next: response.data.next,
                    previous: response.data.previous,
                    currentPage: page
                });
            }

            if (data.length > 0) {
                const firstTask = data[0];
                setSelectedTask(firstTask);
                // Pre-fill amount for editing if exec
                if (firstTask.details?.executive_approved_amount && parseFloat(firstTask.details.executive_approved_amount) > 0) {
                    setExecAmount(firstTask.details.executive_approved_amount);
                } else {
                    setExecAmount(firstTask.details?.requested_amount || firstTask.cost?.replace('₹', '') || '');
                }
            } else {
                setSelectedTask(null);
            }
        } catch (error) {
            console.error("Failed to fetch approvals:", error);
            showToast("Failed to load approval tasks", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (enforceTab) {
            setActiveTab(enforceTab);
        }
    }, [enforceTab]);

    useEffect(() => {
        fetchTasks(activeTab, filterType);
        fetchCounts();
        fetchBatches();
        // Show breakdown by default for claims
        setShowBreakdown(true);
    }, [activeTab, filterType]);

    const fetchBatches = async () => {
        try {
            const resp = await api.get('/api/bulk-activities/');
            const all = resp.data.results || resp.data || [];
            // Filter to show ONLY batches where the current user is the approver
            const pendingForMe = all.filter(b =>
                ['Submitted', 'Manager Approved', 'Resubmitted'].includes(b.status) &&
                String(b.current_approver) === String(user?.id)
            );
            setBatches(pendingForMe);
        } catch (e) {
            console.error('Failed to fetch batches', e);
        }
    };

    const handleBatchAction = async (batchId, action) => {
        let remarks = "";
        let dataJsonToSave = null;

        const batch = batches.find(b => b.id === batchId);
        const edits = batchItemEdits[batchId] || {};

        // Sync row-level edits for ANY action (approve/reject)
        if (Object.keys(edits).length > 0) {
            dataJsonToSave = (batch.data_json || []).map((row, idx) => {
                // If previously rejected, KEEP it rejected
                if (row._status === 'Rejected') return row;

                if (edits[idx]) {
                    return {
                        ...row,
                        _status: edits[idx].status,
                        _remarks: edits[idx].remarks,
                        _remark_by: user?.name || 'Manager'
                    };
                }
                return row;
            });
        }

        if (action === 'reject') {
            remarks = window.prompt("Please enter the reason for rejection (or leave blank if detailed below):");
            if (remarks === null) return; // User cancelled
            if (!remarks.trim() && Object.keys(edits).length === 0) {
                showToast("Rejection reason is mandatory if no items are marked", "error");
                return;
            }
        }

        try {
            await api.post(`/api/bulk-activities/${batchId}/${action}/`, {
                remarks: remarks || 'Some lines were rejected',
                data_json: dataJsonToSave
            });
            showToast(`Batch ${action}d successfully!`, 'success');
            // remove approved/rejected batch from list and collapse details
            setBatches(prev => prev.filter(b => b.id !== batchId));
            if (expandedBatch === batchId) setExpandedBatch(null);
        } catch (error) {
            showToast(error.response?.data?.error || 'Action failed', 'error');
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
    };

    const handleAction = async (action) => {
        if (!selectedTask) return;

        let remarks = "";
        if (action === 'Reject' || action === 'RejectByFinance') {
            remarks = window.prompt("Please enter the reason for rejection:");
            if (remarks === null) return; // User cancelled
            if (!remarks.trim()) {
                showToast("Rejection reason is mandatory", "error");
                return;
            }
        }

        try {
            const payload = {
                id: selectedTask.id,
                action: action,
                remarks: remarks,
                executive_approved_amount: execAmount,
                payment_mode: paymentMode,
                transaction_id: transactionId,
                receipt_file: receiptFile
            };

            await api.post('/api/approvals/', payload);
            showToast(`Request ${action}ed successfully`, "success");

            // Clear inputs
            setPaymentMode('');
            setTransactionId('');
            setReceiptFile(null);

            fetchTasks(activeTab);
            fetchCounts();
        } catch (error) {
            console.error(`Failed to ${action} task:`, error);
            showToast(error.response?.data?.error || `Failed to ${action} request`, "error");
        }
    };

    const handleItemAction = async (itemId, itemStatus) => {
        if (itemStatus === 'Rejected') {
            setRejectItemId(itemId);
            setRejectionItemRemarks(itemRemarks[itemId] || '');
            setShowItemRejectModal(true);
            return;
        }

        try {
            const remark = itemRemarks[itemId] || '';
            await api.post('/api/approvals/', {
                id: selectedTask.id,
                action: 'UpdateItem',
                item_id: itemId,
                item_status: itemStatus,
                remarks: remark
            });

            const updatedTasks = tasks.map(t => {
                if (t.id === selectedTask.id) {
                    const updatedExpenses = t.details.expenses.map(e =>
                        e.id === itemId ? { ...e, status: itemStatus, finance_remarks: isFinance ? remark : (e.finance_remarks || ""), hr_remarks: isHR ? remark : (e.hr_remarks || ""), rm_remarks: (!isFinance && !isHR) ? remark : (e.rm_remarks || "") } : e
                    );
                    return { ...t, details: { ...t.details, expenses: updatedExpenses } };
                }
                return t;
            });
            setTasks(updatedTasks);
            const currentTask = updatedTasks.find(t => t.id === selectedTask.id);
            setSelectedTask(currentTask);
            showToast(`Item ${itemStatus.toLowerCase()}ed with feedback`, "success");
        } catch (e) {
            showToast("Failed to update item status", "error");
        }
    };

    const confirmItemRejection = async () => {
        if (!rejectionItemRemarks.trim()) {
            showToast("Rejection reason is mandatory", "error");
            return;
        }

        try {
            await api.post('/api/approvals/', {
                id: selectedTask.id,
                action: 'UpdateItem',
                item_id: rejectItemId,
                item_status: 'Rejected',
                remarks: rejectionItemRemarks
            });

            const updatedTasks = tasks.map(t => {
                if (t.id === selectedTask.id) {
                    const updatedExpenses = t.details.expenses.map(e =>
                        e.id === rejectItemId ? {
                            ...e,
                            status: 'Rejected',
                            finance_remarks: isFinance ? rejectionItemRemarks : (e.finance_remarks || ""),
                            hr_remarks: isHR ? rejectionItemRemarks : (e.hr_remarks || ""),
                            rm_remarks: (!isFinance && !isHR) ? rejectionItemRemarks : (e.rm_remarks || "")
                        } : e
                    );
                    return { ...t, details: { ...t.details, expenses: updatedExpenses } };
                }
                return t;
            });
            setTasks(updatedTasks);
            const currentTask = updatedTasks.find(t => t.id === selectedTask.id);
            setSelectedTask(currentTask);

            // Sync the input field as well
            setItemRemarks({ ...itemRemarks, [rejectItemId]: rejectionItemRemarks });

            setShowItemRejectModal(false);
            setRejectItemId(null);
            setRejectionItemRemarks('');
            showToast("Item rejected successfully", "success");
        } catch (e) {
            showToast("Failed to reject item", "error");
        }
    };

    const isHR = dept.includes('hr') || desig.includes('hr') || rawRole === 'hr';
    const getFullUrl = (path) => {
        if (!path) return '';
        let p = String(path).trim();

        // Robust cleaning for common legacy formats
        p = p.replace(/^\[u'/, '').replace(/^u'/, '').replace(/^'/, '');
        p = p.replace(/'\]$/, '').replace(/'$/, '');

        if (p.startsWith('http') || p.startsWith('data:')) return p;

        // NEW: Detect base64 direct strings
        if (p.startsWith('/9j/') || p.length > 500) {
            return `data:image/jpeg;base64,${p}`;
        }

        const backendBase = api.defaults.baseURL || 'http://192.168.1.138:4567';
        return `${backendBase}${p.startsWith('/') ? '' : '/'}${p}`;
    };

    const renderTaskDetail = (task) => {
        if (!task) return null;
        return (
            <div className="task-detail premium-card shadow-lg" style={{ border: '1px solid #e2e8f0' }}>
                <div className="detail-header">
                    <div className="requester-profile">
                        <div className="avatar"> {task.requester?.charAt(0) || '?'} </div>
                        <div>
                            <h3>{task.requester || 'Unknown'}</h3>
                            <p>{task.type} Request</p>
                        </div>
                    </div>
                    <div className={`risk-badge ${activeTab === 'history' ? (task.status?.toLowerCase() || 'pending') : (task.risk?.toLowerCase() || 'low')}`}>
                        {activeTab === 'history' ? `Status: ${task.status || 'Unknown'}` : `Risk Score: ${task.risk || 'Low'}`}
                    </div>
                </div>

                <div className="detail-content">
                    <div className="info-grid">
                        <div className="info-block">
                            <span>Request Type</span>
                            <p>{task.type}</p>
                        </div>
                        {!isFinanceHead && (
                            <div className="info-block">
                                <span>Estimated Cost</span>
                                <p>{task.cost}</p>
                            </div>
                        )}
                        <div className="info-block">
                            <span>Submitted Date</span>
                            <p>{task.date}</p>
                        </div>
                        {isFinance && (
                            <div className="info-block highlight" style={{ minWidth: '220px' }}>
                                <span>Executive Recommendation</span>
                                <p className="text-blue-600 font-bold">₹{task.details?.executive_approved_amount || '0.00'}</p>
                                {task.type === 'Expense Claim' && ((task.details?.total_advance_taken !== undefined && parseFloat(task.details?.total_advance_taken) > 0) || (task.details?.wallet_balance_used !== undefined && parseFloat(task.details?.wallet_balance_used) > 0)) && (
                                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '0.85rem' }}>
                                        {parseFloat(task.details.total_advance_taken || 0) > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                                                <span>Advance Recovered:</span>
                                                <span style={{ color: '#ef4444' }}>-₹{task.details.total_advance_taken}</span>
                                            </div>
                                        )}
                                        {parseFloat(task.details.wallet_balance_used || 0) > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginTop: '2px' }}>
                                                <span>Wallet Adjusted:</span>
                                                <span style={{ color: '#ef4444' }}>-₹{task.details.wallet_balance_used}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#0f172a', marginTop: '6px', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
                                            <span>Net Payout to Bank:</span>
                                            <span style={{ color: '#10b981' }}>
                                                ₹{task.details.net_payout || Math.max(0, parseFloat(task.details.executive_approved_amount || 0) - parseFloat(task.details.total_advance_taken || 0) - parseFloat(task.details.wallet_balance_used || 0)).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="detail-section">
                        <h4>Request Objective</h4>
                        <p className="purpose-text">{task.purpose}</p>
                    </div>

                    {task.type === 'Trip' && task.details && (
                        <>
                            <div className="detail-section">
                                <h4>Trip Itinerary</h4>
                                <div className="trip-itinerary">
                                    <div className="itinerary-point">
                                        <span>From</span>
                                        <strong>{task.details.source}</strong>
                                    </div>
                                    <div className="itinerary-arrow">
                                        <ArrowRight size={24} />
                                    </div>
                                    <div className="itinerary-point">
                                        <span>To</span>
                                        <strong>{task.details.destination}</strong>
                                    </div>
                                </div>
                            </div>
                            <div className="detail-section">
                                <h4>Travel Details</h4>
                                <div className="info-grid">
                                    <div className="info-block">
                                        <span>Travel Mode</span>
                                        <p>{task.details.travel_mode}</p>
                                    </div>
                                    {task.details.vehicle_type && (
                                        <div className="info-block">
                                            <span>Vehicle</span>
                                            <p>{task.details.vehicle_type}</p>
                                        </div>
                                    )}
                                    <div className="info-block">
                                        <span>Composition</span>
                                        <p>{task.details.composition}</p>
                                    </div>
                                    <div className="info-block">
                                        <span>Start Date</span>
                                        <p>{task.details.start_date}</p>
                                    </div>
                                    <div className="info-block">
                                        <span>End Date</span>
                                        <p>{task.details.end_date}</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {task.type === 'Money Top-up / Advance' && task.details && (
                        <div className="detail-section">
                            <h4>Advance Request</h4>
                            <div className="advance-display-container">
                                <div className="advance-amount-display">
                                    <span>Requested Amount</span>
                                    <h2>₹{task.details.requested_amount}</h2>
                                </div>
                                {isFinanceExec && (['PENDING_EXECUTIVE', 'HR Approved', 'REJECTED_BY_HEAD'].includes(task.status)) && (
                                    <div className="exec-amount-editor animate-fade-in">
                                        <label>Set Approved Amount</label>
                                        <div className="amount-input-wrapper">
                                            <span className="currency-prefix">₹</span>
                                            <input
                                                type="number"
                                                value={execAmount}
                                                onChange={(e) => setExecAmount(e.target.value)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="ai-advance-reason-container">
                                <p className="purpose-text"><strong>Reason:</strong> {task.details.reason}</p>
                            </div>
                        </div>
                    )}

                    {task.type === 'Expense Claim' && isFinanceExec && (['HR Approved', 'REJECTED_BY_HEAD', 'PENDING_EXECUTIVE'].includes(task.status)) && (
                        <div className="detail-section animate-fade-in" style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
                                < IndianRupee size={18} className="text-indigo-600" /> Audit Finalization
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '12px' }}>
                                <div className="info-block" style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Claimed Amount</span>
                                    <p style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0f172a', margin: '4px 0 0 0' }}>₹{parseFloat(task.details?.total_amount || 0).toLocaleString()}</p>
                                </div>
                                <div className="exec-amount-editor" style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Total Valid Expense (Gross)</label>
                                    <div className="amount-input-wrapper" style={{ marginTop: '8px', display: 'flex', alignItems: 'center', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '0 12px' }}>
                                        <span className="currency-prefix" style={{ fontWeight: 700, color: '#64748b', marginRight: '4px' }}>₹</span>
                                        <input
                                            type="number"
                                            value={execAmount}
                                            onChange={(e) => setExecAmount(e.target.value)}
                                            placeholder="0.00"
                                            style={{ background: 'transparent', border: 'none', padding: '8px 0', width: '100%', fontWeight: 700, fontSize: '1.1rem', color: '#10b981', outline: 'none' }}
                                        />
                                    </div>
                                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>
                                            <span>Wallet/Advance Deductions:</span>
                                            <span>-₹{(parseFloat(task.details?.total_advance_taken || 0) + parseFloat(task.details?.wallet_balance_used || 0)).toFixed(2)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                                            <span>Net Payout to Bank:</span>
                                            <span style={{ color: '#ef4444' }}>₹{Math.max(0, parseFloat(execAmount || 0) - parseFloat(task.details?.total_advance_taken || 0) - parseFloat(task.details?.wallet_balance_used || 0)).toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '6px' }}>* Enter the total approved expenses. Deductions are handled automatically.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {task.details?.expenses?.length > 0 && (
                        <div className="detail-section">
                            <div className="section-header-row" onClick={() => setShowBreakdown(!showBreakdown)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <IndianRupee size={18} className="text-indigo-600" /> Expense Breakdown
                                </h4>
                                <button className="icon-btn-minimal">
                                    {showBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                            </div>
                            {showBreakdown && (
                                <div className="expense-breakdown-container animate-fade-in">
                                    <div className="expense-breakdown-table-wrapper" style={{ overflowX: 'auto' }}>
                                        <table className="breakdown-table">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Category</th>
                                                    <th>Activity / Route</th>
                                                    <th className="text-right">Amount</th>
                                                    <th className="text-center">Proofs / Attachments</th>
                                                    <th>Audit Remarks</th>
                                                    <th className="text-center w-120">Verdict</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {task.details.expenses.map((exp, index) => {
                                                    let displayDesc = exp.description || "";
                                                    let parsedDetails = {};
                                                    if (displayDesc.startsWith('{')) {
                                                        try {
                                                            parsedDetails = JSON.parse(displayDesc);
                                                            const plannedRoute = `${parsedDetails.plannedOrigin || parsedDetails.origin || ''}${(parsedDetails.plannedOrigin || parsedDetails.origin) ? ' → ' : ''}${parsedDetails.plannedDestination || parsedDetails.destination || parsedDetails.location || parsedDetails.hotelName || parsedDetails.hotel_name || parsedDetails.hotel_location || ''}`;

                                                            const isDeviated = exp.is_deviated || parsedDetails.is_deviated;
                                                            const devReason = exp.deviation_reason || parsedDetails.deviation_reason;
                                                            const actualFrom = parsedDetails.actualFrom || "";
                                                            const actualTo = parsedDetails.actualTo || "";

                                                            let routeText = "";
                                                            if (isDeviated) {
                                                                routeText = `[DEVIATED] ${actualFrom || parsedDetails.origin || 'Start'} → ${actualTo || parsedDetails.destination || 'End'} (Planned: ${plannedRoute})`;
                                                            } else {
                                                                routeText = plannedRoute;
                                                            }

                                                            displayDesc = routeText;
                                                            if (parsedDetails.remarks) displayDesc += ` [Note: ${parsedDetails.remarks}]`;
                                                            if (devReason) displayDesc += ` (Why: ${devReason})`;
                                                        } catch (e) {
                                                            displayDesc = exp.description;
                                                        }
                                                    }

                                                    // Inline job report from new system (stored in description JSON)
                                                    const inlineJobReport = parsedDetails.jobReport || null;
                                                    let inlineJobFiles = parsedDetails.jobReportFiles || [];

                                                    // Map jobReportAttachments from mobile if jobReportFiles is empty
                                                    if ((!inlineJobFiles || inlineJobFiles.length === 0) && parsedDetails.jobReportAttachments) {
                                                        inlineJobFiles = parsedDetails.jobReportAttachments.map(url => ({
                                                            data: url,
                                                            name: url.split('/').pop() || 'attachment'
                                                        }));
                                                    }

                                                    // Legacy job reports matched by date
                                                    const legacyReports = task.details.job_reports?.filter(jr => jr.created_at === exp.date) || [];
                                                    const hasAnyReport = inlineJobReport || legacyReports.length > 0;
                                                    const isExpanded = expandedExpenseId === exp.id;

                                                    // Mapping incidentals for both structured and legacy/simple formats
                                                    const incidentals = parsedDetails.incidentals ||
                                                        ((parsedDetails.incidentalAmount && parseFloat(parsedDetails.incidentalAmount) > 0) ? [{
                                                            category: parsedDetails.incidentalCategory || 'Incidental',
                                                            amount: parsedDetails.incidentalAmount
                                                        }] : []);

                                                    const isDeviated = exp.is_deviated || parsedDetails.is_deviated;
                                                    const devReason = exp.deviation_reason || parsedDetails.deviation_reason;
                                                    const actualFrom = parsedDetails.actualFrom || "";
                                                    const actualTo = parsedDetails.actualTo || "";

                                                    return (
                                                        <React.Fragment key={exp.id || index}>
                                                            <tr
                                                                className={`${exp.status === 'Rejected' ? 'row-rejected' : ''} ${isExpanded ? 'row-expanded-main' : ''} cursor-pointer hover:bg-slate-50 transition-colors`}
                                                                onClick={(e) => {
                                                                    // Don't expand if clicking on buttons or inputs
                                                                    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('details') || e.target.closest('a')) return;
                                                                    setExpandedExpenseId(isExpanded ? null : exp.id);
                                                                }}
                                                            >
                                                                <td className="mono" style={{ whiteSpace: 'nowrap' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <div className={`expand-indicator ${isExpanded ? 'open' : ''}`}>
                                                                            <ChevronDown size={14} />
                                                                        </div>
                                                                        {exp.date}
                                                                    </div>
                                                                </td>
                                                                <td style={{ fontWeight: 600 }}>{exp.category}</td>
                                                                <td style={{ fontSize: '0.85rem', color: '#475569' }}>
                                                                    {displayDesc || <span className="italic text-slate-400">No details</span>}
                                                                </td>
                                                                <td className="text-right mono" style={{ fontWeight: 700 }}>₹{parseFloat(exp.amount).toLocaleString()}</td>
                                                                <td className="text-center">
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                                                                        {/* Regular Receipts */}
                                                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
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
                                                                                    bills = [exp.receipt_image];
                                                                                }
                                                                                return (bills || []).filter(b => b).map((img, idx) => {
                                                                                    const path = (img && typeof img === 'object') ? img.path : img;
                                                                                    const fullUrl = getFullUrl(String(path).trim());
                                                                                    return (
                                                                                        <div key={`receipt-${idx}`} onClick={(e) => { e.stopPropagation(); setPreviewImageUrl(fullUrl); }} title={`View Receipt ${idx + 1}`} style={{ width: '38px', height: '38px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'pointer', position: 'relative' }}>
                                                                                            <img src={fullUrl} alt="Receipt" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/40?text=Err'; }} />
                                                                                        </div>
                                                                                    );
                                                                                });
                                                                            })()}
                                                                            {!exp.receipt_image && !hasAnyReport && (
                                                                                <span className="no-receipt">No Proof</span>
                                                                            )}
                                                                        </div>

                                                                        {/* Inline Job Report (new system) */}
                                                                        {inlineJobReport && (
                                                                            <div style={{ width: '100%', marginTop: '6px' }} onClick={e => e.stopPropagation()}>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setSelectedJobReport({
                                                                                            title: `Job Report - ${exp.date}`,
                                                                                            content: inlineJobReport,
                                                                                            attachments: inlineJobFiles,
                                                                                            employee: task.requester,
                                                                                            type: 'Activity Log',
                                                                                            date: exp.date
                                                                                        });
                                                                                        setIsJobReportModalOpen(true);
                                                                                    }}
                                                                                    className="job-report-trigger-btn"
                                                                                >
                                                                                    <FileText size={14} /> View Job Report
                                                                                </button>
                                                                            </div>
                                                                        )}

                                                                        {/* Legacy job reports matched by date */}
                                                                        {legacyReports.map((jr, idx) => {
                                                                            return (
                                                                                <div key={`jr-${idx}`} style={{ width: '100%', marginTop: '6px' }} onClick={e => e.stopPropagation()}>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setSelectedJobReport({
                                                                                                title: `Legacy Job Report - ${exp.date}`,
                                                                                                content: jr.description,
                                                                                                attachments: jr.attachment ? [{ name: 'Attachment', data: getFullUrl(jr.attachment) }] : [],
                                                                                                employee: task.requester,
                                                                                                type: 'Legacy Activity',
                                                                                                date: exp.date
                                                                                            });
                                                                                            setIsJobReportModalOpen(true);
                                                                                        }}
                                                                                        className="job-report-trigger-btn heritage"
                                                                                    >
                                                                                        <FileText size={14} /> View Legacy Report
                                                                                    </button>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </td>
                                                                <td className="w-200">
                                                                    {activeTab === 'pending' ? (
                                                                        <div className="audit-remarks-input-group" onClick={e => e.stopPropagation()}>
                                                                            <input
                                                                                type="text"
                                                                                className="audit-remark-input"
                                                                                placeholder="Add verification remarks..."
                                                                                value={itemRemarks[exp.id] || ''}
                                                                                onChange={(e) => setItemRemarks({ ...itemRemarks, [exp.id]: e.target.value })}
                                                                            />
                                                                            <div className="past-remarks text-[10px] mt-1 text-slate-400">
                                                                                {exp.rm_remarks && (exp.rm_remarks !== itemRemarks[exp.id]) && <span>RM: {exp.rm_remarks}</span>}
                                                                                {exp.hr_remarks && <span> | HR: {exp.hr_remarks}</span>}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="audit-remarks-static">
                                                                            {exp.finance_remarks && <p className="text-xs"><strong>Fin:</strong> {exp.finance_remarks}</p>}
                                                                            {exp.hr_remarks && <p className="text-xs"><strong>HR:</strong> {exp.hr_remarks}</p>}
                                                                            {exp.rm_remarks && <p className="text-xs"><strong>RM:</strong> {exp.rm_remarks}</p>}
                                                                            {!exp.finance_remarks && !exp.hr_remarks && !exp.rm_remarks && <span className="text-slate-400">No remarks</span>}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="text-center">
                                                                    {activeTab === 'pending' ? (
                                                                        <div className="row-actions" onClick={e => e.stopPropagation()}>
                                                                            <button
                                                                                title="Approve Item"
                                                                                onClick={() => handleItemAction(exp.id, 'Approved')}
                                                                                className={`row-action-btn approve ${exp.status === 'Approved' ? 'active' : ''}`}
                                                                            >
                                                                                <CheckCircle size={14} />
                                                                            </button>
                                                                            <button
                                                                                title="Reject Item"
                                                                                onClick={() => handleItemAction(exp.id, 'Rejected')}
                                                                                className={`row-action-btn reject ${exp.status === 'Rejected' ? 'active' : ''}`}
                                                                            >
                                                                                <XCircle size={14} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <span className={`status-badge-mini ${exp.status?.toLowerCase()}`}>{exp.status}</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr className="expanded-detail-row animate-slide-down">
                                                                    <td colSpan="7" style={{ padding: '0' }}>
                                                                        <div className="expense-expanded-card">
                                                                            <div className="exp-detail-grid">
                                                                                {/* Odometer Section */}
                                                                                {((parsedDetails.odoStart || parsedDetails.odoEnd) || (parsedDetails.odoStartImg || parsedDetails.odoEndImg)) && (
                                                                                    <div className="exp-section">
                                                                                        <h5 className="exp-section-header">
                                                                                            <Gauge size={14} className="text-indigo-600" /> Odometer Readings
                                                                                        </h5>
                                                                                        <div className="exp-card-white">
                                                                                            <div className="odo-pair">
                                                                                                <div className="odo-item">
                                                                                                    <span className="odo-label">Start Reading</span>
                                                                                                    <div className="odo-value">
                                                                                                        <span className="odo-num">{parsedDetails.odoStart || '---'}</span>
                                                                                                        <span className="odo-unit">km</span>
                                                                                                    </div>
                                                                                                    {parsedDetails.odoStartImg && (
                                                                                                        <div className="odo-img-container" onClick={() => setPreviewImageUrl(getFullUrl(parsedDetails.odoStartImg))}>
                                                                                                            <img src={getFullUrl(parsedDetails.odoStartImg)} alt="Start" style={{ width: '100%', height: '80px', objectFit: 'cover' }} />
                                                                                                            <div className="img-overlay-hint">View Photo</div>
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                                <div className="odo-item">
                                                                                                    <span className="odo-label">End Reading</span>
                                                                                                    <div className="odo-value">
                                                                                                        <span className="odo-num">{parsedDetails.odoEnd || '---'}</span>
                                                                                                        <span className="odo-unit">km</span>
                                                                                                    </div>
                                                                                                    {parsedDetails.odoEndImg && (
                                                                                                        <div className="odo-img-container" onClick={() => setPreviewImageUrl(getFullUrl(parsedDetails.odoEndImg))}>
                                                                                                            <img src={getFullUrl(parsedDetails.odoEndImg)} alt="End" style={{ width: '100%', height: '80px', objectFit: 'cover' }} />
                                                                                                            <div className="img-overlay-hint">View Photo</div>
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                            {(parsedDetails.odoStart && parsedDetails.odoEnd) && (
                                                                                                <div className="distance-highlight">
                                                                                                    <span className="distance-label">Calculated Trip Distance:</span>
                                                                                                    <span className="distance-value">{Math.max(0, parseFloat(parsedDetails.odoEnd) - parseFloat(parsedDetails.odoStart))} KM</span>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                {/* Trip Context Section */}
                                                                                <div className="exp-section">
                                                                                    <h5 className="exp-section-header">
                                                                                        <Navigation size={14} className="text-indigo-600" /> Trip Context
                                                                                    </h5>
                                                                                    <div className="exp-card-white">
                                                                                        <div className="context-row">
                                                                                            <div className="context-block">
                                                                                                <span className="context-label">Route / Location</span>
                                                                                                <div className="context-value">
                                                                                                    <MapPin size={14} className="text-red-500" />
                                                                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                                                        <span>{parsedDetails.origin || 'N/A'}</span>
                                                                                                        {parsedDetails.destination && (
                                                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                                                                                                <ArrowRight size={10} /> {parsedDetails.destination}
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="context-block">
                                                                                                <span className="context-label">Travel Mode</span>
                                                                                                <div className="context-value">
                                                                                                    {parsedDetails.mode || 'N/A'} {parsedDetails.subType ? `(${parsedDetails.subType})` : ''}
                                                                                                </div>
                                                                                            </div>
                                                                                            <div style={{ display: 'flex', gap: '16px' }}>
                                                                                                <div className="context-block" style={{ flex: 1 }}>
                                                                                                    <span className="context-label">Start Time</span>
                                                                                                    <div className="context-value">
                                                                                                        <Clock size={13} className="text-slate-400" /> {parsedDetails.time?.boardingTime || 'N/A'}
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div className="context-block" style={{ flex: 1 }}>
                                                                                                    <span className="context-label">End Time</span>
                                                                                                    <div className="context-value">
                                                                                                        <Clock size={13} className="text-slate-400" /> {parsedDetails.time?.actualTime || 'N/A'}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>

                                                                                {/* Deviation Information Section */}
                                                                                {isDeviated && (
                                                                                    <div className="exp-section" style={{ marginTop: '16px' }}>
                                                                                        <h5 className="exp-section-header" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                            <AlertTriangle size={14} /> Deviation Insight
                                                                                        </h5>
                                                                                        <div className="exp-card-white" style={{ borderLeft: '4px solid #ef4444', background: '#fffafb' }}>
                                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                                                                                    <span style={{ color: '#64748b', fontWeight: 600 }}>Planned Strategy:</span>
                                                                                                    <span style={{ fontWeight: 600, color: '#475569' }}>{parsedDetails.plannedOrigin || parsedDetails.origin} → {parsedDetails.plannedDestination || parsedDetails.destination}</span>
                                                                                                </div>
                                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', background: '#fef2f2', padding: '10px', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                                                                                                    <span style={{ color: '#b91c1c', fontWeight: 700 }}>Actual Execution:</span>
                                                                                                    <span style={{ fontWeight: 800, color: '#b91c1c' }}>{actualFrom || 'Not Specified'} → {actualTo || 'Not Specified'}</span>
                                                                                                </div>
                                                                                                {(parsedDetails.visitedPerson || devReason) && (
                                                                                                    <div style={{ fontSize: '0.8rem', padding: '0 4px' }}>
                                                                                                        <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Visited Person/Office:</span>
                                                                                                        <p style={{ fontWeight: 700, color: '#1e293b' }}>{parsedDetails.visitedPerson || '---'}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                                <div style={{ fontSize: '0.8rem', padding: '0 4px', borderTop: '1px dashed #fee2e2', paddingTop: '8px' }}>
                                                                                                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Reason for Deviation:</span>
                                                                                                    <p style={{ fontWeight: 700, color: '#b91c1c', fontStyle: 'italic' }}>"{devReason || 'No specific reason provided'}"</p>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                {/* Incidental Breakdown Section */}
                                                                                {incidentals.length > 0 && (
                                                                                    <div className="exp-section">
                                                                                        <h5 className="exp-section-header">
                                                                                            <ClipboardList size={14} className="text-indigo-600" /> Incidental Breakdown
                                                                                        </h5>
                                                                                        <div className="exp-card-white">
                                                                                            <div className="incidental-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                                                {incidentals.map((inc, iIdx) => (
                                                                                                    <div key={iIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: iIdx === incidentals.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1' }}></div>
                                                                                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{inc.category || 'Other'}</span>
                                                                                                        </div>
                                                                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>₹{parseFloat(inc.amount || 0).toLocaleString()}</span>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                {/* Selfie Proofs Section */}
                                                                                <div className="exp-section">
                                                                                    <h5 className="exp-section-header">
                                                                                        <Camera size={14} className="text-indigo-600" /> Validation Proofs
                                                                                    </h5>
                                                                                    <div className="exp-card-white">
                                                                                        {parsedDetails.selfies && parsedDetails.selfies.length > 0 ? (
                                                                                            <div className="selfie-grid">
                                                                                                {parsedDetails.selfies.map((s, si) => (
                                                                                                    <div key={si} className="selfie-card" onClick={() => setPreviewImageUrl(getFullUrl(s))}>
                                                                                                        <img src={getFullUrl(s)} alt="Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div style={{ textAlign: 'center', padding: '12px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, border: '1px dashed #e2e8f0', borderRadius: '10px' }}>
                                                                                                No face-proof photos available for this segment.
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                {/* Additional Remarks Section */}
                                                                                {(parsedDetails.remarks || parsedDetails.natureOfVisit) && (
                                                                                    <div className="remarks-full-width">
                                                                                        <div className="remarks-bubble">
                                                                                            <span className="context-label" style={{ display: 'block', marginBottom: '8px' }}>Visit Summary & Remarks</span>
                                                                                            <div style={{ fontSize: '0.92rem', color: '#334155', fontWeight: 600, lineHeight: '1.6' }}>
                                                                                                {parsedDetails.natureOfVisit && <div style={{ color: '#6366f1', marginBottom: '4px' }}>{parsedDetails.natureOfVisit}</div>}
                                                                                                {parsedDetails.remarks || 'No additional remarks provided.'}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
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
                                </div>
                            )}
                        </div>
                    )}

                    {/* Job reports are now shown inline within each expense row in the breakdown table above */}

                    {task.details?.odometer && (
                        <div className="detail-section">
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <Gauge size={18} className="text-orange-600" /> Lifecycle Verification (Odo & Photos)
                            </h4>
                            <div className="odo-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                                <div className="odo-card" style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                    <h5 style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Start of Trip</h5>
                                    {task.details.odometer.start_image ? (
                                        <div
                                            className="odo-image-preview"
                                            style={{ width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', position: 'relative', background: '#000', marginBottom: '12px' }}
                                            onClick={() => setPreviewImageUrl(getFullUrl(task.details.odometer.start_image))}
                                        >
                                            <img src={getFullUrl(task.details.odometer.start_image)} alt="Start Odo/Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <div className="image-label" style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>Click to View</div>
                                        </div>
                                    ) : (
                                        <div style={{ height: '140px', background: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '12px', border: '1px dashed #cbd5e1' }}>No Photo Uploaded</div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Odometer Reading</span>
                                        <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>{task.details.odometer.start_reading || 'N/A'} km</span>
                                    </div>
                                </div>

                                <div className="odo-card" style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                    <h5 style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>End of Trip</h5>
                                    {task.details.odometer.end_image ? (
                                        <div
                                            className="odo-image-preview"
                                            style={{ width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', position: 'relative', background: '#000', marginBottom: '12px' }}
                                            onClick={() => setPreviewImageUrl(getFullUrl(task.details.odometer.end_image))}
                                        >
                                            <img src={getFullUrl(task.details.odometer.end_image)} alt="End Odo/Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <div className="image-label" style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>Click to View</div>
                                        </div>
                                    ) : (
                                        <div style={{ height: '140px', background: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '12px', border: '1px dashed #cbd5e1' }}>No Photo Uploaded</div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Odometer Reading</span>
                                        <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>{task.details.odometer.end_reading || 'N/A'} km</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}


                    <div className="detail-section">
                        <h4>Policy Verification</h4>
                        <div className="compliance-item ok">
                            <CheckCircle size={16} />
                            <span>Validated against policy & limits.</span>
                        </div>
                    </div>
                </div>

                {activeTab !== 'history' && (
                    <div className="detail-actions-container">
                        <div className="detail-actions">
                            <button className="action-btn reject" onClick={() => handleAction('Reject')}>
                                <XCircle size={18} /> <span>Reject</span>
                            </button>
                            <button className="action-btn approve" onClick={() => handleAction('Approve')}>
                                <CheckCircle size={18} /> <span>Approve</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const tourPlanClaims = tasks.filter(t => t.is_local);
    const specialRequestTasks = tasks.filter(t => !t.is_local);

    return (
        <div className="approvals-page">
            <div className="page-header" style={enforceTab ? { padding: '0', background: 'transparent', border: 'none' } : {}}>
                {!enforceTab && (
                    <div className="header-row">
                        <div>
                            <h1>Approval Inbox</h1>
                            <p>Review and act on pending requests from your team.</p>
                        </div>
                        <div className="tabs">
                            <button
                                className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                                onClick={() => handleTabChange('pending')}
                            >
                                Pending {counts.total > 0 && <span className="tab-badge">{counts.total}</span>}
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                                onClick={() => handleTabChange('history')}
                            >
                                History
                            </button>
                        </div>
                    </div>
                )}

                <div className="modern-navigation-bar" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="view-type-tabs">
                        <button
                            className={`view-type-btn ${viewType === 'special' ? 'active' : ''}`}
                            onClick={() => setViewType('special')}
                        >
                            Special Requests
                        </button>
                        <button
                            className={`view-type-btn ${viewType === 'monthly' ? 'active' : ''}`}
                            onClick={() => setViewType('monthly')}
                        >
                            Monthly Tour Plan
                        </button>
                    </div>

                    <div className="modern-filter-tabs custom-scrollbar" style={{ overflowX: 'auto', maxWidth: '100%' }}>
                        {[
                            { id: 'all', label: 'All Requests', icon: <Filter size={16} /> },
                            { id: 'trip', label: 'Trips', icon: <Navigation size={16} /> },
                            { id: 'expense', label: 'Expenses', icon: <IndianRupee size={16} /> },
                            { id: 'advance', label: 'Advances', icon: <PauseCircle size={16} /> },
                            { id: 'mileage', label: 'Mileage', icon: <Gauge size={16} /> },
                            { id: 'dispute', label: 'Disputes', icon: <AlertTriangle size={16} /> }
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => setFilterType(type.id)}
                                className={`filter-tab-btn ${filterType === type.id ? 'active' : ''}`}
                            >
                                {type.icon}
                                <span>{type.label}</span>
                                {type.id === 'all' && tasks.length > 0 && (
                                    <span className="tab-count">{tasks.length}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="loading-container">
                    <Loader2 className="animate-spin" size={40} />
                    <p>Loading requests...</p>
                </div>
            ) : (
                <React.Fragment>
                    <div className="approvals-dashboard-container" style={{ width: '100%', marginTop: '20px' }}>
                        {/* Monthly Tour Plan Section */}
                        {viewType === 'monthly' && (
                            <div className="section-monthly-tour" style={{ width: '100%', marginBottom: '32px' }}>
                                <div
                                    onClick={() => setIsTourPlanOpen(!isTourPlanOpen)}
                                    style={{
                                        cursor: 'pointer',
                                        background: 'white',
                                        padding: '16px',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        border: '1px solid #e2e8f0',
                                        marginBottom: '16px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'all 0.3s ease'
                                    }}
                                    className="hover:shadow-md"
                                >
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Upload size={22} className="text-indigo-600" /> Monthly Tour Plan
                                        <span style={{ fontSize: '0.8rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '12px' }}>{batches.length + tourPlanClaims.length}</span>
                                    </h2>
                                    {isTourPlanOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </div>

                                {isTourPlanOpen && (
                                    <div className="animate-fade-in">
                                        {(batches.length > 0 || tourPlanClaims.length > 0) ? (
                                            <div>
                                                {/* Existing Bulk Batches */}
                                                {batches.map(batch => (
                                                    <React.Fragment key={batch.id}>
                                                        <div style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: '10px', padding: '16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{batch.user_name || 'Employee'}</div>
                                                                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>File: {batch.file_name}</div>
                                                                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{(batch.data_json || []).length} daily entries &bull; Submitted for approval</div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                                <button
                                                                    onClick={() => {
                                                                        if (expandedBatch !== batch.id) {
                                                                            if (!batchItemEdits[batch.id]) {
                                                                                setBatchItemEdits(prev => ({ ...prev, [batch.id]: {} }));
                                                                            }
                                                                        }
                                                                        setExpandedBatch(expandedBatch === batch.id ? null : batch.id);
                                                                    }}
                                                                    style={{ padding: '8px 18px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                                                                >
                                                                    {expandedBatch === batch.id ? 'Hide Data' : 'View Data'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleBatchAction(batch.id, 'approve')}
                                                                    style={{ padding: '8px 18px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                                                                >
                                                                    ✓ Approve
                                                                </button>
                                                                <button
                                                                    onClick={() => handleBatchAction(batch.id, 'reject')}
                                                                    style={{ padding: '8px 18px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                                                                >
                                                                    ✕ Reject
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {expandedBatch === batch.id && (
                                                            <div className="premium-card animate-fade-in mb-4 overflow-hidden bg-white border border-slate-200 shadow-xl" style={{ borderRadius: '16px' }}>
                                                                <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                                                                    <h5 className="font-extrabold text-slate-800 flex items-center gap-2">
                                                                        <ClipboardList size={18} className="text-indigo-600" />
                                                                        Audit Daily Activities ({((batch.data_json || []).filter(r => !String(r.date || '').toLowerCase().includes('instruc'))).length} Entries)
                                                                    </h5>
                                                                    {Object.keys(batchItemEdits[batch.id] || {}).filter(k => batchItemEdits[batch.id][k].status === 'Rejected').length > 0 && (
                                                                        <div className="animate-bounce bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold border border-rose-200">
                                                                            {Object.keys(batchItemEdits[batch.id] || {}).filter(k => batchItemEdits[batch.id][k].status === 'Rejected').length} Items marked for rejection
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
                                                                    <table className="w-full text-xs border-collapse" style={{ minWidth: '1000px' }}>
                                                                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                                                                            <tr className="text-slate-500 border-b">
                                                                                {[...new Set(['date', 'mode', 'vehicle', 'origin_route', 'destination_route', 'start_time', 'reach_time', 'visit_intent', 'remarks', 'odo_start', 'odo_end', ...Object.keys(batch.data_json[0])])].filter(k => !k.startsWith('_') && Object.keys(batch.data_json[0]).includes(k)).map(key => {
                                                                                    const map = {
                                                                                        date: 'Date',
                                                                                        start_time: 'Start Time',
                                                                                        reach_time: 'Reach Time',
                                                                                        mode: 'Mode',
                                                                                        origin_route: 'From Location',
                                                                                        destination_route: 'To Location',
                                                                                        odo_start: 'ODO Start',
                                                                                        odo_end: 'ODO End',
                                                                                        vehicle: 'Vehicle',
                                                                                        visit_intent: 'Visit Intent',
                                                                                        remarks: 'Remarks'
                                                                                    };
                                                                                    return (
                                                                                        <th key={key} className="p-2 border text-left">
                                                                                            {map[key] || key.replace(/_/g, ' ')}
                                                                                        </th>
                                                                                    );
                                                                                })}
                                                                                <th className="p-3 border-b text-left" style={{ minWidth: '100px' }}>Audit Status</th>
                                                                                <th className="p-3 border-b text-center" style={{ minWidth: '120px' }}>Action</th>
                                                                                <th className="p-3 border-b text-left" style={{ minWidth: '220px' }}>Rejection Details</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {((batch.data_json || []).map((row, rIdx) => ({ ...row, __idx: rIdx })).filter(r => {
                                                                                const d = String(r.date || '');
                                                                                return d && !d.toLowerCase().includes('instruc');
                                                                            })).map((row, filterIdx) => {
                                                                                const originalIdx = row.__idx;
                                                                                const itemEdit = (batchItemEdits[batch.id] || {})[originalIdx] || {};
                                                                                const isActuallyRejected = row._status === 'Rejected' || itemEdit.status === 'Rejected';

                                                                                return (
                                                                                    <tr key={filterIdx} className={isActuallyRejected ? 'bg-rose-50 border-b' : 'hover:bg-slate-50 border-b'}>
                                                                                        {[...new Set(['date', 'mode', 'vehicle', 'origin_route', 'destination_route', 'start_time', 'reach_time', 'visit_intent', 'remarks', 'odo_start', 'odo_end', ...Object.keys(row)])].filter(k => !k.startsWith('_') && Object.keys(row).includes(k)).map((k, vIdx) => {
                                                                                            const val = row[k];
                                                                                            return (
                                                                                                <td key={vIdx} className={`p-3 border-b ${isActuallyRejected ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                                                                                                    {String(val || '-')}
                                                                                                </td>
                                                                                            );
                                                                                        })}
                                                                                        <td className="p-3 border-b">
                                                                                            {row._status === 'Rejected' ? (
                                                                                                <div className="flex items-center gap-1.5 text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded-md border border-rose-100 w-fit">
                                                                                                    <XCircle size={14} /> Rejected
                                                                                                </div>
                                                                                            ) : itemEdit.status === 'Rejected' ? (
                                                                                                <div className="flex items-center gap-1.5 text-orange-600 font-bold bg-orange-50 px-2 py-1 rounded-md border border-orange-100 w-fit">
                                                                                                    <AlertTriangle size={14} /> Rejection Queued
                                                                                                </div>
                                                                                            ) : (
                                                                                                <div className="flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 w-fit">
                                                                                                    <CheckCircle size={14} /> Validated
                                                                                                </div>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="p-3 border-b text-center">
                                                                                            <button
                                                                                                disabled={row._status === 'Rejected'}
                                                                                                onClick={() => {
                                                                                                    const isRejected = itemEdit.status === 'Rejected';
                                                                                                    setBatchItemEdits(prev => ({
                                                                                                        ...prev,
                                                                                                        [batch.id]: {
                                                                                                            ...(prev[batch.id] || {}),
                                                                                                            [originalIdx]: {
                                                                                                                ...((prev[batch.id] || {})[originalIdx] || {}),
                                                                                                                status: isRejected ? 'Pending' : 'Rejected'
                                                                                                            }
                                                                                                        }
                                                                                                    }));
                                                                                                }}
                                                                                                style={{
                                                                                                    display: 'flex', alignItems: 'center', gap: '6px', margin: '0 auto',
                                                                                                    padding: '6px 12px', borderRadius: '8px', border: '1px solid', fontSize: '0.75rem', fontWeight: 700,
                                                                                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                                                    cursor: row._status === 'Rejected' ? 'not-allowed' : 'pointer',
                                                                                                    backgroundColor: row._status === 'Rejected' ? '#f8fafc' : (itemEdit.status === 'Rejected' ? '#fff' : '#fff'),
                                                                                                    borderColor: row._status === 'Rejected' ? '#e2e8f0' : (itemEdit.status === 'Rejected' ? '#4f46e5' : '#e2e8f0'),
                                                                                                    color: row._status === 'Rejected' ? '#94a3b8' : (itemEdit.status === 'Rejected' ? '#4f46e5' : '#64748b'),
                                                                                                    boxShadow: itemEdit.status === 'Rejected' ? '0 0 10px rgba(79, 70, 229, 0.1)' : 'none'
                                                                                                }}
                                                                                                className="hover:scale-105 active:scale-95"
                                                                                            >
                                                                                                {row._status === 'Rejected' ? (
                                                                                                    <><PauseCircle size={14} /> Locked</>
                                                                                                ) : (itemEdit.status === 'Rejected' ? (
                                                                                                    <><RotateCcw size={14} /> Undo</>
                                                                                                ) : (
                                                                                                    <><XCircle size={14} /> Reject</>
                                                                                                ))}
                                                                                            </button>
                                                                                        </td>
                                                                                        <td className="p-3 border-b">
                                                                                            <div className="flex flex-col gap-1.5 min-w-[180px]">
                                                                                                <input
                                                                                                    type="text"
                                                                                                    placeholder="Explain rejection reason..."
                                                                                                    disabled={row._status === 'Rejected'}
                                                                                                    value={itemEdit.remarks || ''}
                                                                                                    onChange={e => {
                                                                                                        setBatchItemEdits(prev => ({
                                                                                                            ...prev,
                                                                                                            [batch.id]: {
                                                                                                                ...(prev[batch.id] || {}),
                                                                                                                [originalIdx]: {
                                                                                                                    ...((prev[batch.id] || {})[originalIdx] || {}),
                                                                                                                    remarks: e.target.value
                                                                                                                }
                                                                                                            }
                                                                                                        }));
                                                                                                    }}
                                                                                                    style={{
                                                                                                        width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem', outline: 'none',
                                                                                                    }}
                                                                                                />
                                                                                                {row._remarks && (
                                                                                                    <div className="flex items-start gap-2 bg-slate-100 p-2 rounded-lg border border-slate-200 shadow-sm animate-fade-in">
                                                                                                        <div className="mt-0.5 bg-indigo-100 text-indigo-600 p-1 rounded-md"><User size={10} /></div>
                                                                                                        <div style={{ fontSize: '0.7rem', color: '#475569', lineHeight: '1.3' }}>
                                                                                                            <span style={{ fontWeight: 800, color: '#1e293b', display: 'block' }}>{row._remark_by || 'Approver'}</span>
                                                                                                            {row._remarks}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>
                                                                                )
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                                <div className="p-4 bg-slate-50 border-t flex justify-end gap-3 items-center">
                                                                    <p className="text-[10px] text-slate-500 mr-auto flex items-center gap-1.5">
                                                                        <AlertTriangle size={12} className="text-amber-500" />
                                                                        Locked rows were rejected by previous managers and cannot be modified. Rows marked for rejection will not generate expenses.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                                {tourPlanClaims.map(claim => (
                                                    <div
                                                        key={claim.id}
                                                        onClick={() => {
                                                            setSelectedTask(claim);
                                                            // We stay in the monthly view but ensure details area is ready
                                                            // We'll also update the layout below to show details for selected task
                                                        }}
                                                        style={{
                                                            background: selectedTask?.id === claim.id ? '#e0f2fe' : '#f0f9ff',
                                                            border: selectedTask?.id === claim.id ? '2px solid #0369a1' : '1px solid #7dd3fc',
                                                            borderRadius: '10px',
                                                            padding: '16px',
                                                            marginBottom: '12px',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                        className="hover:bg-sky-100"
                                                    >
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0369a1' }}>{claim.requester}</div>
                                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{claim.type}: {claim.purpose}</div>
                                                            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{claim.cost}</div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '10px' }}>Final Approval</span>
                                                            <ArrowRight size={16} className={selectedTask?.id === claim.id ? 'text-sky-700' : 'text-sky-400'} />
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Details Pane for Monthly Selection */}
                                                {selectedTask && tourPlanClaims.some(c => c.id === selectedTask.id) && (
                                                    <div className="task-detail-overlay animate-fade-in" style={{ marginTop: '24px' }}>
                                                        {/* Reusing the detail view structure */}
                                                        {renderTaskDetail(selectedTask)}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="premium-card" style={{ padding: '24px', textAlign: 'center', color: '#64748b', background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                                                <CheckCircle size={28} color="#10b981" style={{ margin: '0 auto 8px' }} />
                                                <p>No pending Monthly Tour Plans.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Special Requests Section */}
                        {viewType === 'special' && (
                            <div className="section-special-requests" style={{ width: '100%' }}>
                                <div
                                    onClick={() => setIsSpecialRequestsOpen(!isSpecialRequestsOpen)}
                                    style={{
                                        cursor: 'pointer',
                                        background: 'white',
                                        padding: '16px',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        border: '1px solid #e2e8f0',
                                        marginBottom: '16px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'all 0.3s ease'
                                    }}
                                    className="hover:shadow-md"
                                >
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <FileText size={22} className="text-indigo-600" /> Special Requests
                                        <span style={{ fontSize: '0.8rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '12px' }}>{specialRequestTasks.length}</span>
                                    </h2>
                                    {isSpecialRequestsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </div>

                                {isSpecialRequestsOpen && (
                                    <div className="animate-fade-in">
                                        {specialRequestTasks.length === 0 ? (
                                            <div className="empty-state-container" style={{ minHeight: 'auto', padding: '20px 0' }}>
                                                <div className="empty-state premium-card" style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                                                    <CheckCircle size={48} color="#10b981" />
                                                    <h3>All caught up!</h3>
                                                    <p>No pending special requests found for your review.</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="approvals-container">
                                                {/* Task List */}
                                                <div className="task-list premium-card">
                                                    <div className="list-search" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <input type="text" placeholder="Search requests..." style={{ border: 'none', background: 'transparent' }} />
                                                    </div>
                                                    <div className="task-items">
                                                        {specialRequestTasks.map(task => (
                                                            <div
                                                                key={task.id}
                                                                className={`task-item ${selectedTask?.id === task.id ? 'active' : ''}`}
                                                                onClick={() => {
                                                                    setSelectedTask(task);
                                                                    const amt = task.details?.executive_approved_amount && parseFloat(task.details.executive_approved_amount) > 0
                                                                        ? task.details.executive_approved_amount
                                                                        : (task.details?.requested_amount || task.cost?.replace(/[₹,]/g, '') || '');
                                                                    setExecAmount(amt);
                                                                }}
                                                            >
                                                                <div className="task-icon">
                                                                    <FileText size={20} />
                                                                </div>
                                                                <div className="task-info">
                                                                    <h4>{task.purpose}</h4>
                                                                    <div className="task-meta">
                                                                        <span className="task-requester">{task.requester}</span>
                                                                        <span className="task-date">• {task.date}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="task-amount">
                                                                    {task.cost}
                                                                    {task.type === 'Expense Claim' && parseFloat(task.details?.total_amount || 0) > parseFloat(task.details?.net_payout || 0) && (
                                                                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'normal', marginTop: '2px' }}>
                                                                            (Adjusted)
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Detailed View */}
                                                {selectedTask && (
                                                    renderTaskDetail(selectedTask)
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </React.Fragment>
            )}
            {/* Rejection Modal for Individual Items */}
            {showItemRejectModal && (
                <div className="custom-confirm-overlay" style={{ zIndex: 2000 }}>
                    <div className="custom-confirm-modal" style={{ maxWidth: '400px' }}>
                        <div className="modal-content-p" style={{ padding: '1.5rem', textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Reject Expense Item</h3>
                                <button onClick={() => setShowItemRejectModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <XCircle size={20} color="#94a3b8" />
                                </button>
                            </div>
                            <div className="field-group mb-3" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                    Rejection Remarks <span style={{ color: 'red' }}>*</span>
                                </label>
                                <textarea
                                    placeholder="Explain why this expense is being rejected..."
                                    value={rejectionItemRemarks}
                                    onChange={(e) => setRejectionItemRemarks(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', minHeight: '100px', fontSize: '0.9rem', resize: 'vertical' }}
                                />
                            </div>
                            <div className="modal-actions-p" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button className="modal-btn cancel" onClick={() => setShowItemRejectModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#475569' }}>Cancel</button>
                                <button className="modal-btn confirm" onClick={confirmItemRejection} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Confirm Rejection</button>
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
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Proof Preview</h3>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => window.open(previewImageUrl, '_blank')}
                                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                                >
                                    <ExternalLink size={16} /> Open in New Tab
                                </button>
                                <button onClick={() => setPreviewImageUrl(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                    <XCircle size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="preview-modal-body" style={{ overflow: 'auto', background: '#f1f5f9', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                            {previewImageUrl.toLowerCase().endsWith('.pdf') ? (
                                <iframe src={previewImageUrl} style={{ width: '80vw', height: '80vh', border: 'none' }} title="PDF Preview" />
                            ) : (
                                <img src={previewImageUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Premium Job Report Modal (Mail Style) */}
            {isJobReportModalOpen && selectedJobReport && (
                <div className="job-report-modal-overlay" onClick={() => setIsJobReportModalOpen(false)}>
                    <div className="job-report-modal-card" onClick={e => e.stopPropagation()}>
                        <div className="jr-modal-header">
                            <div className="jr-modal-title-group">
                                <div className="jr-modal-badge">{selectedJobReport.type}</div>
                                <h3 className="jr-modal-subject">{selectedJobReport.title}</h3>
                            </div>
                            <button className="jr-modal-close" onClick={() => setIsJobReportModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="jr-modal-meta">
                            <div className="jr-sender-info">
                                <div className="jr-avatar">
                                    {(selectedJobReport.employee || 'User').charAt(0).toUpperCase()}
                                </div>
                                <div className="jr-sender-details">
                                    <span className="jr-sender-name">{selectedJobReport.employee}</span>
                                    <span className="jr-sender-email">via Mobile Activity Tracking System</span>
                                </div>
                            </div>
                            <div className="jr-date-info">
                                <Clock size={14} />
                                <span>{selectedJobReport.date}</span>
                            </div>
                        </div>

                        <div className="jr-modal-body">
                            <div className="jr-body-content">
                                {selectedJobReport.content}
                            </div>
                        </div>

                        {selectedJobReport.attachments && selectedJobReport.attachments.length > 0 && (
                            <div className="jr-modal-attachments">
                                <div className="jr-attachments-header">
                                    <Paperclip size={14} />
                                    <span>Attachments ({selectedJobReport.attachments.length})</span>
                                </div>
                                <div className="jr-attachments-list">
                                    {selectedJobReport.attachments.map((file, fIdx) => (
                                        <div key={fIdx} className="jr-attachment-item">
                                            <div className="jr-file-icon">
                                                <FileText size={18} />
                                            </div>
                                            <div className="jr-file-info">
                                                <span className="jr-file-name">{file.name}</span>
                                                <span className="jr-file-size">Proof Document</span>
                                            </div>
                                            <a
                                                href={getFullUrl(file.data)}
                                                download={file.name}
                                                className="jr-download-btn"
                                                onClick={(e) => {
                                                    // Download action
                                                }}
                                            >
                                                <Download size={14} />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="jr-modal-footer">
                            <button className="jr-btn-primary" onClick={() => setIsJobReportModalOpen(false)}>
                                Close Report
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApprovalInbox;
