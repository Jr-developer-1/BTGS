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

    // Form states
    const [transferData, setTransferData] = useState({
        payment_mode: 'NEFT',
        transaction_id: '',
        payment_date: new Date().toISOString().split('T')[0],
        remarks: ''
    });
    const [rejectReason, setRejectReason] = useState('');

    const fetchFinanceData = async () => {
        try {
            setLoading(true);
            const resp = await api.get(`/api/approvals/?tab=${activeTab}&source=hub`);
            const rawData = resp.data.results || resp.data || [];
            const data = rawData.map(item => ({
                id: item.id,
                trip: item.details?.trip_id || 'N/A',
                employee: item.requester,
                amount: item.cost,
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
    }, [activeTab]);

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
        if (transferData.payment_mode !== 'Cash' && !transferData.transaction_id) {
            showToast("Transaction ID is required", "warning");
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
                    {/* <p>Manage employee trips, expenses, and payments.</p> */}
                </div>
                <div className="header-actions">
                    <button className="btn-secondary" onClick={() => fetchFinanceData()}>
                        <Clock size={18} />
                        Refresh List
                    </button>
                    <button className="btn-primary" onClick={() => navigate('/settlement')}>
                        <Zap size={18} />
                        Settlement Runs
                    </button>
                </div>
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
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="8" className="fd-empty-cell">Loading transactions...</td></tr>
                            ) : filteredRecords.length > 0 ? (
                                filteredRecords.map(rec => (
                                    <tr key={rec.id}>
                                        <td><span className="id-badge-fims">{rec.id}</span></td>
                                        <td><span className="trip-ref">{rec.trip}</span></td>
                                        <td>{rec.employee}</td>
                                        <td>{rec.date}</td>
                                        <td>{rec.type}</td>
                                        <td className="amt-cell">{rec.amount}</td>
                                        <td>
                                            <div className={`status-pill ${rec.status.toLowerCase().replace(/ /g, '-')}`}>
                                                {rec.status}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="finance-actions">
                                                {activeTab === 'pending' && (
                                                    <button className="f-icon-btn process" onClick={() => handleUnderProcess(rec.id)} title="Mark as Processing">
                                                        <Clock size={16} />
                                                    </button>
                                                )}
                                                {activeTab === 'rejected' && (
                                                    <button className="f-icon-btn process" onClick={() => handleUnreject(rec.id)} title="Mark Unreject">
                                                        <RotateCcw size={16} />
                                                    </button>
                                                )}
                                                {(activeTab !== 'completed' && activeTab !== 'rejected') && (
                                                    <button className="f-icon-btn transfer" onClick={() => openTransfer(rec)} title="Record Transfer">
                                                        <IndianRupee size={16} />
                                                    </button>
                                                )}
                                                {(activeTab !== 'completed' && activeTab !== 'rejected') && (
                                                    <button className="f-icon-btn reject" onClick={() => openReject(rec)} title="Reject">
                                                        <XCircle size={16} />
                                                    </button>
                                                )}
                                                {activeTab === 'completed' && (
                                                    <button className="f-icon-btn process" onClick={() => openTransfer(rec)} title="View Details">
                                                        <Search size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
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
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Transfer Modal */}
            <Modal
                isOpen={isTransferModalOpen}
                onClose={() => setIsTransferModalOpen(false)}
                title={activeTab === 'completed' ? "Transfer Details" : "Fund Transfer Details"}
                type="success"
                actions={
                    <div className="modal-actions-grid">
                        <button className="btn-secondary" onClick={() => setIsTransferModalOpen(false)}>
                            {activeTab === 'completed' ? "Close" : "Cancel"}
                        </button>
                        {activeTab !== 'completed' && (
                            <button className="btn-primary" onClick={handleTransfer}>
                                <Send size={18} /> Confirm Transfer
                            </button>
                        )}
                    </div>
                }
            >
                <div className="transfer-form">
                    <div className="form-summary-row">
                        <div className="summary-item">
                            <label>Transfer To</label>
                            <p>{selectedRecord?.employee}</p>
                        </div>
                        <div className="summary-item">
                            <label>Amount</label>
                            <p className="highlight-text">{selectedRecord?.amount}</p>
                        </div>
                    </div>

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
        </div>
    );
};

export default FinanceDashboard;
