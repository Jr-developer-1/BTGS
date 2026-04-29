import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import {
    Users,
    Clock,
    CheckCircle,
    AlertCircle,
    BarChart3,
    TrendingUp,
    IndianRupee,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    FileDown,
    UploadCloud,
    FileText,
    Zap,
    XCircle,
    Send,
    RotateCcw
} from 'lucide-react';
import '../finance_styles.css';

const FinanceDashboard = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'processing', 'completed'
    const [stats, setStats] = useState([
        { title: 'To Review', value: '0', icon: <Clock color="#f59e0b" />, trend: '0%', isUp: true },
        { title: 'Paid Today', value: '₹0', icon: <CheckCircle color="#22c55e" />, trend: '0%', isUp: true },
        { title: 'Issues / Disputes', value: '0', icon: <AlertCircle color="#ef4444" />, trend: '0%', isUp: false },
        { title: 'Avg. Review Time', value: '0h', icon: <TrendingUp color="#3b82f6" />, trend: '0%', isUp: false },
    ]);
    const { showToast } = useToast();

    // Modal states
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importLoading, setImportLoading] = useState(false);

    // Form states
    const [transferData, setTransferData] = useState({
        payment_mode: 'NEFT',
        transaction_id: '',
        payment_date: new Date().toISOString().split('T')[0],
        remarks: ''
    });
    const [rejectReason, setRejectReason] = useState('');

    // Auto-reset forms when modals are closed
    useEffect(() => {
        if (!isTransferModalOpen) {
            setTransferData({
                payment_mode: 'NEFT',
                transaction_id: '',
                payment_date: new Date().toISOString().split('T')[0],
                remarks: ''
            });
        }
    }, [isTransferModalOpen]);

    useEffect(() => {
        if (!isRejectModalOpen) {
            setRejectReason('');
        }
    }, [isRejectModalOpen]);

    const fetchStats = async () => {
        try {
            // Get pending count
            const pendingResp = await api.get('/api/approvals/?tab=pending&source=hub');
            const pendingCount = (pendingResp.data.results || pendingResp.data || []).length;

            // Get paid today count and amount
            const today = new Date().toISOString().split('T')[0];
            const paidResp = await api.get(`/api/approvals/?tab=completed&source=hub&date=${today}`);
            const paidData = paidResp.data.results || paidResp.data || [];
            const paidTotal = paidData.reduce((sum, item) => {
                const amt = item.details?.executive_approved_amount || item.cost || 0;
                return sum + parseFloat(String(amt).replace(/[^\d.-]/g, '') || 0);
            }, 0);

            // Get disputes count
            const disputeResp = await api.get('/api/approvals/?tab=pending&source=hub&is_disputed=true');
            const disputeCount = (disputeResp.data.results || disputeResp.data || []).length;

            setStats(prev => [
                { ...prev[0], value: pendingCount.toString() },
                { ...prev[1], value: `₹${paidTotal.toLocaleString()}` },
                { ...prev[2], value: disputeCount.toString() },
                { ...prev[3], value: '2.4h' } // Dummy for now
            ]);
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    };

    const fetchFinanceData = async () => {
        try {
            setLoading(true);
            const resp = await api.get(`/api/approvals/?tab=${activeTab}&source=hub`);
            const rawData = resp.data.results || resp.data || [];
            const data = rawData.map(item => ({
                id: item.id,
                trip: item.details?.trip_id || 'N/A',
                employee: item.requester,
                amount: (item.details?.executive_approved_amount && parseFloat(item.details.executive_approved_amount) > 0)
                    ? `₹${parseFloat(item.details.executive_approved_amount).toLocaleString()}`
                    : item.cost,
                type: item.type,
                status: item.status,
                date: item.date,
                raw: item // Keep raw data for modal
            }));
            setRecords(data);

            if (activeTab === 'pending') {
                setStats(prev => {
                    const updated = [...prev];
                    updated[0].value = data.length.toString();
                    return updated;
                });
            }
        } catch (e) {
            console.error("Failed to fetch finance records:", e);
            showToast("Failed to load records", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFinanceData();
        fetchStats();
    }, [activeTab]);

    const handleExport = async (tabOverride = null) => {
        const targetTab = tabOverride || activeTab;
        try {
            showToast("Generating export...", "info");
            const response = await api.get(`/api/finance/export/?tab=${targetTab}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Finance_Export_${targetTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            // Since responseType is 'blob', the error data is also a Blob
            if (e.response && e.response.data instanceof Blob) {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const json = JSON.parse(reader.result);
                        showToast(json.error || "Export failed", "error");
                    } catch (err) {
                        showToast("Export failed", "error");
                    }
                };
                reader.readAsText(e.response.data);
            } else {
                showToast(e.response?.data?.error || "Export failed", "error");
            }
        }
    };

    const handleImport = async () => {
        if (!importFile) {
            showToast("Please select a file", "warning");
            return;
        }
        try {
            setImportLoading(true);
            const formData = new FormData();
            formData.append('file', importFile);
            const resp = await api.post('/api/finance/import/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showToast(resp.data.message || "Import successful", "success");
            if (resp.data.errors && resp.data.errors.length > 0) {
                console.warn("Import warning:", resp.data.errors);
            }
            setIsImportModalOpen(false);
            setImportFile(null);
            fetchFinanceData();
        } catch (e) {
            showToast(e.response?.data?.error || "Import failed", "error");
        } finally {
            setImportLoading(false);
        }
    };

    const filteredRecords = records.filter(rec =>
        rec.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.trip.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleUnderProcess = async (id) => {
        setRecords(prev => prev.filter(rec => rec.id !== id));
        try {
            await api.post('/api/approvals/', { id, action: 'UnderProcess' });
            showToast("Marked as Under Process", "success");
            fetchFinanceData();
        } catch (e) {
            showToast("Action failed", "error");
        }
    };
    const handleTransfer = async () => {
        if (!selectedRecord) return;

        const amtVal = parseFloat(selectedRecord?.amount?.replace(/[^\d.]/g, '') || 0);
        const advVal = parseFloat(selectedRecord?.raw?.details?.total_advance_taken || 0);
        const walletVal = parseFloat(selectedRecord?.raw?.details?.wallet_balance_used || 0);
        const netToPay = amtVal - advVal - walletVal;

        if (netToPay > 0 && transferData.payment_mode !== 'Cash' && !transferData.transaction_id) {
            showToast("Transaction ID is required for payouts", "warning");
            return;
        }

        const recordId = selectedRecord.id;
        setRecords(prev => prev.filter(rec => rec.id !== recordId));

        try {
            await api.post('/api/approvals/', {
                id: recordId,
                action: 'Transfer',
                ...transferData
            });
            showToast("Funds transferred successfully", "success");
            setIsTransferModalOpen(false);

            // Allow DB a moment to sync before refresh
            setTimeout(async () => {
                await fetchFinanceData();
            }, 300);
        } catch (e) {
            showToast("Transfer recording failed", "error");
        }
    };

    const handleReject = async () => {
        if (!rejectReason) {
            showToast("Rejection reason is required", "warning");
            return;
        }
        try {
            await api.post('/api/approvals/', {
                id: selectedRecord.id,
                action: 'RejectByFinance',
                remarks: rejectReason
            });
            showToast("Request rejected by Finance", "success");
            setIsRejectModalOpen(false);
            fetchFinanceData();
        } catch (e) {
            showToast("Rejection failed", "error");
        }
    };

    const handleUnreject = async (id) => {
        try {
            await api.post('/api/approvals/', { id, action: 'Unreject' });
            showToast("Request unrejected and returned to queue", "success");
            fetchFinanceData();
        } catch (e) {
            showToast("Action failed", "error");
        }
    };

    const openTransfer = (rec) => {
        setSelectedRecord(rec);
        setIsTransferModalOpen(true);
    };

    const openReject = (rec) => {
        setSelectedRecord(rec);
        setIsRejectModalOpen(true);
    };

    return (
        <div className="finance-dashboard">
            <div className="page-header">
                <div>
                    <h1>Finance Dashboard</h1>
                </div>
                <div className="header-actions">
                    <button className="btn-secondary" onClick={() => setIsImportModalOpen(true)}>
                        <UploadCloud size={18} />
                        Bulk Operations
                    </button>
                    <button className="btn-secondary" onClick={() => fetchFinanceData()}>
                        <RotateCcw size={18} />
                        Refresh
                    </button>
                    <button className="btn-primary" onClick={() => navigate('/settlement')}>
                        <Zap size={18} />
                        Settlements
                    </button>
                </div>55
            </div>

            <div className="stats-grid">
                {stats.map((stat, idx) => (
                    <div key={idx} className="stat-card premium-card">
                        <div className="stat-icon-wrapper">{stat.icon}</div>
                        <div className="stat-data">
                            <span>{stat.title}</span>
                            <h3>{stat.value}</h3>
                            <div className={`stat-trend ${stat.isUp ? 'pos' : 'neg'}`}>
                                {stat.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                {stat.trend} vs last week
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="master-records-section premium-card">
                <div className="section-header">
                    <div className="title-area">
                        <BarChart3 size={20} />
                        <h3>Recent Finance Requests</h3>
                    </div>
                    <div className="filter-group">
                        <div className="search-fims-wrapper">
                            <Search size={16} className="search-icon-fims" />
                            <input
                                type="text"
                                placeholder="Search ID, Trip, or Employee..."
                                className="search-fims"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Status Tabs */}
                <div className="fims-tabs">
                    <button
                        className={`fims-tab ${activeTab === 'pending' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pending')}
                    >
                        <Clock size={16} />
                        Needs Action
                    </button>
                    <button
                        className={`fims-tab ${activeTab === 'processing' ? 'active' : ''}`}
                        onClick={() => setActiveTab('processing')}
                    >
                        <Zap size={16} />
                        In Progress
                    </button>
                    <button
                        className={`fims-tab ${activeTab === 'completed' ? 'active' : ''}`}
                        onClick={() => setActiveTab('completed')}
                    >
                        <CheckCircle size={16} />
                        Paid
                    </button>
                    <button
                        className={`fims-tab ${activeTab === 'rejected' ? 'active' : ''}`}
                        onClick={() => setActiveTab('rejected')}
                    >
                        <AlertCircle size={16} />
                        Rejected
                    </button>
                </div>

                <div className="records-table-wrapper">
                    <table className="fims-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Trip</th>
                                <th>Employee</th>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="8" className="fd-empty-cell">Retrieving records...</td></tr>
                            ) : filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="fd-empty-cell">
                                        <div className="empty-state-fims">
                                            <AlertCircle size={32} opacity={0.3} style={{ marginBottom: '10px' }} />
                                            <p>
                                                {activeTab === 'pending' ? 'No pending requests found.' :
                                                    activeTab === 'processing' ? 'No transactions are currently in progress.' :
                                                        activeTab === 'completed' ? 'No completed payments found.' :
                                                            'No rejected requests found.'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map((rec) => (
                                    <tr key={rec.id}>
                                        <td className="id-cell">{rec.id}</td>
                                        <td className="trip-cell">{rec.trip}</td>
                                        <td>{rec.employee}</td>
                                        <td>{rec.date}</td>
                                        <td><span className="type-badge">{rec.type}</span></td>
                                        <td className="amt-cell">{rec.amount}</td>
                                        <td>
                                            <span className={`status-pill ${rec.status?.toLowerCase().replace(/_/g, '-')}`}>
                                                {rec.status?.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div className="action-row-btns">
                                                {activeTab === 'pending' && (
                                                    <button className="mini-action-btn orange" onClick={() => handleUnderProcess(rec.id)} title="Mark Under Process">
                                                        <RotateCcw size={14} />
                                                    </button>
                                                )}
                                                {activeTab === 'rejected' && (
                                                    <button className="mini-action-btn blue" onClick={() => handleUnreject(rec.id)} title="Unreject to Queue">
                                                        <RotateCcw size={14} />
                                                    </button>
                                                )}
                                                {(activeTab === 'pending' || activeTab === 'processing') && (
                                                    <>
                                                        <button className="mini-action-btn green" onClick={() => openTransfer(rec)} title="Transfer/Pay">
                                                            <IndianRupee size={15} />
                                                        </button>
                                                        <button className="mini-action-btn red" onClick={() => openReject(rec)} title="Reject">
                                                            <XCircle size={15} />
                                                        </button>
                                                    </>
                                                )}
                                                {activeTab === 'completed' && (
                                                    <button className="mini-action-btn blue" onClick={() => openTransfer(rec)} title="View Details">
                                                        <Search size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Transfer Modal */}
            <Modal
                isOpen={isTransferModalOpen}
                onClose={() => setIsTransferModalOpen(false)}
                closeOnOverlayClick={false}
                title={activeTab === 'completed' ? "Transfer Details" : "Fund Transfer Details"}
                type="success"
                actions={
                    <div className="modal-actions-grid">
                        <button className="btn-secondary" onClick={() => setIsTransferModalOpen(false)}>
                            {activeTab === 'completed' ? "Close" : "Cancel"}
                        </button>
                        {activeTab !== 'completed' && (
                            <button className="btn-primary" onClick={handleTransfer}>
                                <Send size={18} />
                                {(parseFloat(selectedRecord?.amount?.replace(/[^\d.]/g, '') || 0) - parseFloat(selectedRecord?.raw?.details?.total_advance_taken || 0)) > 0
                                    ? " Confirm Transfer"
                                    : " Confirm Reconciliation"}
                            </button>
                        )}
                    </div>
                }
            >
                <div className="transfer-form" onClick={(e) => e.stopPropagation()}>
                    <div className="form-summary-row">
                        <div className="summary-item">
                            <label>Transfer To</label>
                            <p>{selectedRecord?.employee}</p>
                        </div>
                        <div className="summary-item">
                            <label>Amount</label>
                            <div className="amount-payout-wrapper">
                                <p className="highlight-text">{selectedRecord?.amount}</p>
                                {selectedRecord?.type === 'Expense Claim' && ((selectedRecord?.raw?.details?.total_advance_taken && parseFloat(selectedRecord.raw.details.total_advance_taken) > 0) || (selectedRecord?.raw?.details?.wallet_balance_used && parseFloat(selectedRecord.raw.details.wallet_balance_used) > 0)) && (
                                    <div className="payout-breakdown-mini" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '0.85rem' }}>
                                        {parseFloat(selectedRecord.raw.details.total_advance_taken || 0) > 0 && (
                                            <div className="breakdown-row sub" style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                                                <span>Advance Recovery:</span>
                                                <span>-₹{parseFloat(selectedRecord.raw.details.total_advance_taken).toLocaleString()}</span>
                                            </div>
                                        )}
                                        {parseFloat(selectedRecord.raw.details.wallet_balance_used || 0) > 0 && (
                                            <div className="breakdown-row sub" style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', marginTop: '4px' }}>
                                                <span>Wallet Adjustment:</span>
                                                <span>-₹{parseFloat(selectedRecord.raw.details.wallet_balance_used).toLocaleString()}</span>
                                            </div>
                                        )}
                                        <div className="breakdown-row net" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#10b981', marginTop: '6px', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
                                            <span>Net Payout to Bank:</span>
                                            <span>₹{Math.max(0, parseFloat(selectedRecord?.amount?.replace(/[^\d.]/g, '') || 0) - parseFloat(selectedRecord.raw.details.total_advance_taken || 0) - parseFloat(selectedRecord.raw.details.wallet_balance_used || 0)).toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {(activeTab === 'completed' || (parseFloat(selectedRecord?.amount?.replace(/[^\d.]/g, '') || 0) - parseFloat(selectedRecord?.raw?.details?.total_advance_taken || 0) - parseFloat(selectedRecord?.raw?.details?.wallet_balance_used || 0)) > 0) ? (
                        <>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label className="form-label">Mode of Payment</label>
                                    <select
                                        className="form-input"
                                        value={activeTab === 'completed' ? selectedRecord?.raw.payment_mode : transferData.payment_mode}
                                        onChange={(e) => setTransferData({ ...transferData, payment_mode: e.target.value })}
                                        disabled={activeTab === 'completed'}
                                    >
                                        <option value="NEFT">NEFT</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Cash">Cash</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Transfer Date</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={activeTab === 'completed' ? (selectedRecord?.raw.details?.payment_date?.split('T')[0] || '') : transferData.payment_date}
                                        onChange={(e) => setTransferData({ ...transferData, payment_date: e.target.value })}
                                        disabled={activeTab === 'completed'}
                                    />
                                </div>
                            </div>

                            {(activeTab === 'completed' ? selectedRecord?.raw.payment_mode : transferData.payment_mode) !== 'Cash' && (
                                <div className="form-group">
                                    <label className="form-label">Transaction ID / Reference</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Enter NEFT Ref or UPI ID"
                                        value={activeTab === 'completed' ? selectedRecord?.raw.transaction_id : transferData.transaction_id}
                                        onChange={(e) => setTransferData({ ...transferData, transaction_id: e.target.value })}
                                        disabled={activeTab === 'completed'}
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="reconciliation-alert" style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '12px', border: '1px solid #bbf7d0', marginBottom: '1.5rem', color: '#166534', fontSize: '0.9rem' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontWeight: 'bold', marginBottom: '4px' }}>
                                <CheckCircle size={18} /> Fully Adjusted from Advance
                            </div>
                            This claim is completely covered by the employee's existing advance balance. No bank transfer is required.
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Remarks</label>
                        <textarea
                            className="form-input"
                            placeholder="Add payment notes..."
                            value={activeTab === 'completed' ? selectedRecord?.raw.finance_remarks : transferData.remarks}
                            onChange={(e) => setTransferData({ ...transferData, remarks: e.target.value })}
                            disabled={activeTab === 'completed'}
                        />
                    </div>
                </div>
            </Modal>

            {/* Reject Modal */}
            <Modal
                isOpen={isRejectModalOpen}
                onClose={() => setIsRejectModalOpen(false)}
                closeOnOverlayClick={false}
                title="Reject Financial Request"
                type="error"
                actions={
                    <div className="modal-actions-grid">
                        <button className="btn-secondary" onClick={() => setIsRejectModalOpen(false)}>Cancel</button>
                        <button className="btn-danger-primary" onClick={handleReject}>Reject Request</button>
                    </div>
                }
            >
                <div className="reject-form">
                    <p className="warning-text">Are you sure you want to reject this {selectedRecord?.type} for {selectedRecord?.employee}?</p>
                    <div className="form-group mt-4">
                        <label className="form-label">Reason for Rejection</label>
                        <textarea
                            className="form-input"
                            placeholder="Enter specific reason for rejection..."
                            rows="4"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                        />
                    </div>
                </div>
            </Modal>

            {/* Bulk Operations Modal */}
            <Modal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                closeOnOverlayClick={false}
                title="Bulk Operations Hub"
                type="info"
                actions={
                    <div className="modal-actions-grid" style={{ padding: '0 24px 24px' }}>
                        <button className="btn-secondary" onClick={() => setIsImportModalOpen(false)} style={{ borderRadius: '12px', fontWeight: '600' }}>Close</button>
                        <button 
                            className="btn-primary" 
                            onClick={handleImport} 
                            disabled={importLoading || !importFile}
                            style={{ 
                                borderRadius: '12px', 
                                fontWeight: '700',
                                background: (importLoading || !importFile) ? '#e2e8f0' : 'linear-gradient(135deg, #BB0633 0%, #800020 100%)',
                                boxShadow: (!importLoading && importFile) ? '0 4px 12px rgba(187, 6, 51, 0.2)' : 'none',
                                color: (importLoading || !importFile) ? '#94a3b8' : '#fff'
                            }}
                        >
                            {importLoading ? "Processing..." : "Submit Updates"}
                        </button>
                    </div>
                }
            >
                <div className="bulk-ops-enhanced" style={{ padding: '8px 24px' }}>
                    <div className="bulk-step-card" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ background: '#BB063315', padding: '10px', borderRadius: '12px' }}>
                                <FileDown size={22} color="#BB0633" />
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#0f172a' }}>Step 1: Download Templates</h4>
                                {/* <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>Get updated ledger with dropdown validation</p> */}
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="btn-secondary flex-1" onClick={() => handleExport('pending')} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', height: '48px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Clock size={18} color="#f59e0b" />
                                <span style={{ fontWeight: '600' }}>Export Pending</span>
                            </button>
                            <button className="btn-secondary flex-1" onClick={() => handleExport('completed')} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', height: '48px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <CheckCircle size={18} color="#10b981" />
                                <span style={{ fontWeight: '600' }}>Export Paid</span>
                            </button>
                        </div>
                    </div>

                    <div className="bulk-step-card" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ background: '#BB063315', padding: '10px', borderRadius: '12px' }}>
                                <UploadCloud size={22} color="#BB0633" />
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#0f172a' }}>Step 2: Upload Updated File</h4>
                                {/* <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>Upload edited Excel to process bulk status changes</p> */}
                            </div>
                        </div>

                        <div 
                            className="dropzone-enhanced" 
                            style={{ 
                                border: '2px dashed #cbd5e1', 
                                borderRadius: '16px', 
                                padding: '32px 20px', 
                                textAlign: 'center', 
                                transition: 'all 0.3s', 
                                background: importFile ? '#f0fdf4' : '#f8fafc',
                                cursor: 'pointer',
                                borderColor: importFile ? '#22c55e' : '#cbd5e1'
                            }}
                        >
                            <input 
                                type="file" 
                                accept=".xlsx, .xls"
                                id="bulk-import-input-enh"
                                onChange={(e) => setImportFile(e.target.files[0])}
                                style={{ display: 'none' }}
                            />
                            <label htmlFor="bulk-import-input-enh" style={{ cursor: 'pointer', display: 'block' }}>
                                <div style={{ 
                                    width: '56px', 
                                    height: '56px', 
                                    background: importFile ? '#22c55e15' : '#fff', 
                                    borderRadius: '50%', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    margin: '0 auto 12px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                }}>
                                    {importFile ? <CheckCircle size={28} color="#22c55e" /> : <FileText size={28} color="#94a3b8" />}
                                </div>
                                <p style={{ fontWeight: '700', color: '#1e293b', margin: 0, fontSize: '0.95rem' }}>
                                    {importFile ? importFile.name : "Select Excel Spreadsheet"}
                                </p>
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>
                                    {importFile ? `${(importFile.size / 1024).toFixed(1)} KB ready` : "Drag & drop or browse files"}
                                </p>
                            </label>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default FinanceDashboard;
