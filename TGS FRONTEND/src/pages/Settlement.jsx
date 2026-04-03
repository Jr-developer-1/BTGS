import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/api';
import { useToast } from '../context/ToastContext';
import {
    CheckCircle,
    ArrowRightLeft,
    Wallet,
    IndianRupee,
    Download,
    ShieldCheck,
    ArrowLeft,
    Search,
    Clock,
    User,
    AlertCircle,
    FileText,
    TrendingUp
} from 'lucide-react';

const Settlement = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { showToast } = useToast();
    const tripId = searchParams.get('trip_id');

    const [loading, setLoading] = useState(false);
    const [isSettling, setIsSettling] = useState(false);
    const [isSettled, setIsSettled] = useState(false);
    const [data, setData] = useState(null);
    const [allTrips, setAllTrips] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchSettlementData = async (tid) => {
        try {
            setLoading(true);
            const resp = await api.get(`/api/settlement/?trip_id=${tid}`);
            setData(resp.data);
            setIsSettled(resp.data.summary.status === 'Settled');
        } catch (e) {
            console.error("Failed to fetch settlement data:", e);
            showToast("Failed to load settlement details", "error");
        } finally {
            setLoading(false);
        }
    };

    const fetchAllTrips = async () => {
        try {
            setLoading(true);
            const resp = await api.get('/api/settlement/');
            setAllTrips(resp.data);
        } catch (e) {
            console.error("Failed to fetch trips for settlement:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tripId) {
            fetchSettlementData(tripId);
        } else {
            fetchAllTrips();
        }
    }, [tripId]);

    const handleSettle = async () => {
        if (!tripId) return;
        try {
            setIsSettling(true);
            await api.post('/api/settlement/', { trip_id: tripId });
            setIsSettled(true);
            showToast("Trip accounts finalized and settled successfully", "success");
            fetchSettlementData(tripId);
        } catch (e) {
            console.error("Settlement failed:", e);
            showToast("Settlement failed. Please try again.", "error");
        } finally {
            setIsSettling(false);
        }
    };

    const filteredTrips = allTrips.filter(t => 
        t.trip_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.employee.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.destination.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!tripId) {
        return (
            <div className="settlement-page">
                <div className="page-header">
                    <div>
                        <button className="back-btn-minimal" onClick={() => navigate('/finance')}>
                            <ArrowLeft size={16} />
                            <span>Back to Finance Dashboard</span>
                        </button>
                        <h1>Settlements</h1>
                    </div>
                    <p>Select a trip to review and process final payments.</p>
                </div>

                <div className="settlement-selection premium-card">
                    <div className="selection-header">
                        <div className="search-fims-wrapper" style={{ width: '400px' }}>
                            <Search size={16} className="search-icon-fims" />
                            <input
                                type="text"
                                placeholder="Search Trip ID, Employee or Destination..."
                                className="search-fims"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="records-table-wrapper" style={{ marginTop: '1.5rem' }}>
                        <table className="fims-table">
                            <thead>
                                <tr>
                                    <th>Trip ID</th>
                                    <th>Employee</th>
                                    <th>Destination</th>
                                    <th>Advance</th>
                                    <th>Claims</th>
                                    <th>Net Balance</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="8" className="fd-empty-cell">Loading pending settlements...</td></tr>
                                ) : filteredTrips.length > 0 ? (
                                    filteredTrips.map(t => (
                                        <tr key={t.trip_id}>
                                            <td><span className="id-badge-fims">{t.trip_id}</span></td>
                                            <td>{t.employee}</td>
                                            <td>{t.destination}</td>
                                            <td>₹{t.advance.toLocaleString()}</td>
                                            <td>₹{t.claim.toLocaleString()}</td>
                                            <td className={t.balance < 0 ? 'neg-amt' : 'pos-amt'}>
                                                {t.balance < 0 ? '-' : '+'}₹{Math.abs(t.balance).toLocaleString()}
                                            </td>
                                            <td>
                                                <div className={`status-pill ${t.status.toLowerCase().replace(/ /g, '-')}`}>
                                                    {t.status}
                                                </div>
                                            </td>
                                            <td>
                                                <button 
                                                    className="btn-minimal-action"
                                                    onClick={() => navigate(`/settlement?trip_id=${t.trip_id}`)}
                                                >
                                                    Process Payment
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="8" className="fd-empty-cell">No trips found awaiting settlement.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    if (loading && !data) {
        return <div className="loading-container-fims"><div className="spinner"></div><p>Loading records...</p></div>;
    }

    if (!data) return <div className="error-container-fims">Data not found</div>;

    const { summary, breakdown, trip } = data;

    return (
        <div className="settlement-page">
            <div className="page-header">
                <div>
                    <button className="back-btn-minimal" onClick={() => navigate('/settlement')}>
                        <ArrowLeft size={16} />
                        <span>Back to Settlements</span>
                    </button>
                    <h1>Settlement Details: {trip.id}</h1>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700, color: 'var(--burgundy)' }}>{trip.employee}</p>
                    <p>{trip.destination}</p>
                </div>
            </div>

            <div className="settlement-container">
                <div className="settlement-main premium-card">
                    <div className="summary-banner">
                        <div className="banner-item">
                            <span>Advances Paid</span>
                            <h3>₹{summary.advance.toLocaleString()}</h3>
                        </div>
                        <div className="banner-divider">
                            <TrendingUp size={24} className={summary.balance < 0 ? 'recoverable' : 'payable'} />
                        </div>
                        <div className="banner-item">
                            <span>Total Claimed</span>
                            <h3>₹{summary.claimTotal.toLocaleString()}</h3>
                        </div>
                    </div>

                    <div className="settlement-result">
                        <div className="result-info">
                            <p>Final Balance</p>
                            <h2 className={summary.balance < 0 ? 'recoverable' : 'payable'}>
                                {summary.balance < 0 ? '-' : ''}₹{Math.abs(summary.balance).toLocaleString()}
                            </h2>
                            <span className="balance-label">
                                {summary.balance < 0 ? 'Recovery Amount' : 'Net Reimbursement'}
                            </span>
                        </div>

                        {!isSettled ? (
                            <button 
                                className="btn-primary settle-btn" 
                                onClick={handleSettle}
                                disabled={isSettling}
                            >
                                {isSettling ? 'Processing...' : 'Finalize & Settle'}
                            </button>
                        ) : (
                            <div className="settled-status-premium">
                                <ShieldCheck size={28} color="#22c55e" />
                                <div className="status-txt">
                                    <span className="label">STATUS</span>
                                    <span className="value">PAID & CLOSED</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="breakdown-area premium-card">
                    <div className="section-header-br">
                        <h3>Recent Transactions</h3>
                        <Clock size={18} />
                    </div>
                    
                    <div className="breakdown-list">
                        {breakdown.length > 0 ? breakdown.map((item, idx) => (
                            <div key={idx} className="breakdown-item-premium">
                                <div className={`item-icon-p ${item.is_negative ? 'neg' : 'pos'}`}>
                                    {item.type === 'Advance' ? <Wallet size={18} /> : <FileText size={18} />}
                                </div>
                                <div className="item-txt-p">
                                    <p>{item.description}</p>
                                    <div className="meta">
                                        <span className="date">{item.date}</span>
                                        <span className="ref-id">{item.id}</span>
                                    </div>
                                </div>
                                <div className={`item-amt-p ${item.is_negative ? 'negative' : 'positive'}`}>
                                    {item.is_negative ? '-' : '+'}₹{Math.abs(item.amount).toLocaleString()}
                                </div>
                            </div>
                        )) : (
                            <div className="empty-breakdown">No transactions recorded for this trip.</div>
                        )}
                    </div>

                    <div className="settlement-footer-actions">
                         <button className="btn-secondary full-btn" onClick={() => window.print()}>
                            <Download size={18} />
                            <span>Download Settlement Statement</span>
                        </button>
                    </div>
                </div>
            </div>
            
        </div>
    );
};

export default Settlement;
