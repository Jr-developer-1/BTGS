import React, { useState, useEffect } from 'react';
import {
    IndianRupee,
    Upload,
    AlertCircle,
    AlertTriangle,
    CheckCircle,
    Car,
    Hotel,
    Coffee,
    Fuel,
    MoreHorizontal,
    Clock,
    Info
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { encodeId } from '../utils/idEncoder';
import api from '../api/api';
import { useToast } from '../context/ToastContext.jsx';
import { useEligibility } from '../utils/useEligibility';

const ExpenseEntry = () => {
    const location = useLocation();
    const [trips, setTrips] = useState([]);
    const [selectedTripId, setSelectedTripId] = useState(location.state?.tripId || '');
    const [expenses, setExpenses] = useState([]);
    const [isLoadingTrips, setIsLoadingTrips] = useState(true);
    const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
    const [isCapturingBill, setIsCapturingBill] = useState(false);

    // Soft-warning eligibility
    const { checkTravel, checkAccommodation, checkDA, getEntitlementNote, eligibility } = useEligibility();

    const [formData, setFormData] = useState({
        category: 'Food',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        receipt_image: ''
    });

    useEffect(() => {
        const fetchTrips = async () => {
            try {
                const response = await api.get('/api/trips/');
                const filtered = response.data.filter(trip =>
                    ['Approved', 'On-Going', 'Completed'].includes(trip.status)
                );
                setTrips(filtered);
            } catch (error) {
                console.error("Failed to fetch trips:", error);
                showToast("Failed to load active trips", "error");
            } finally {
                setIsLoadingTrips(false);
            }
        };
        fetchTrips();
    }, []);

    useEffect(() => {
        if (selectedTripId) {
            fetchExpenses(selectedTripId);
        } else {
            setExpenses([]);
        }
    }, [selectedTripId]);

    const fetchExpenses = async (tripId) => {
        setIsLoadingExpenses(true);
        try {
            const response = await api.get(`/api/expenses/?trip_id=${encodeId(tripId)}`);
            setExpenses(response.data);
        } catch (error) {
            console.error("Failed to fetch expenses:", error);
            showToast("Failed to load expenses for this trip", "error");
        } finally {
            setIsLoadingExpenses(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setIsCapturingBill(true);
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, receipt_image: reader.result }));
                setIsCapturingBill(false);
                showToast("Receipt captured successfully", "success");
            };
            reader.readAsDataURL(file);
        }
    };

    const categories = [
        { id: 'Food', name: 'Food & Refreshments', icon: <Coffee size={18} /> },
        { id: 'Fuel', name: 'Fuel / Mileage', icon: <Fuel size={18} /> },
        { id: 'Accommodation', name: 'Hotel & Stay', icon: <Hotel size={18} /> },
        { id: 'Toll', name: 'Toll & Parking', icon: <Car size={18} /> },
        { id: 'Others', name: 'Miscellaneous', icon: <MoreHorizontal size={18} /> },
    ];

    const handleAddExpense = async (e) => {
        e.preventDefault();

        if (!selectedTripId) {
            showToast("Please select an active trip first", "error");
            return;
        }

        if (!formData.receipt_image) {
            showToast("Please upload a receipt for verification", "error");
            return;
        }

        try {
            const payload = {
                ...formData,
                trip: selectedTripId
            };
            const response = await api.post('/api/expenses/', payload);
            setExpenses([response.data, ...expenses]);
            setFormData({
                category: 'Food',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                description: '',
                receipt_image: ''
            });
            showToast("Expense recorded successfully", "success");
        } catch (error) {
            console.error("Failed to add expense:", error);
            showToast("Failed to save expense record", "error");
        }
    };

    const handleSubmitAll = async () => {
        if (expenses.length === 0) return;

        try {
            const total = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
            await api.post('/api/claims/', {
                trip: selectedTripId,
                total_amount: total,
                status: 'Submitted',
                submitted_at: new Date().toISOString()
            });

            showToast("Claim generated and submitted successfully!", "success");
            setExpenses([]);
            setSelectedTripId('');
        } catch (error) {
            console.error("Failed to submit claim:", error);
            showToast("Failed to submit claiming request", "error");
        }
    };

    return (
        <div className="expense-entry-page">
            <div className="page-header">
                <h1>Expense Entry</h1>
                <p>Record your trip expenses and upload supporting documents.</p>
            </div>

            <div className="expense-content">
                {/* Form Section */}
                <div className="expense-form-section premium-card">
                    {isLoadingTrips ? (
                        <div className="loading-state-p">
                            <div className="spinner"></div>
                            <p>Loading journey details...</p>
                        </div>
                    ) : trips.length === 0 ? (
                        <div className="locked-state-premium">
                            <div className="lock-icon-wrapper">
                                <Clock size={48} className="animate-pulse" />
                            </div>
                            <h3>Entry Locked</h3>
                            <p>No <strong>Approved</strong> journeys found. You can only record expenses for trips that have been officially authorized.</p>
                            <button className="btn-secondary" onClick={() => window.location.href = '/trips'}>View My Trips</button>
                        </div>
                    ) : (
                        <>
                            <h3>Add New Expense</h3>
                            <form onSubmit={handleAddExpense} className="expense-form">
                                <div className="input-field">
                                    <label>Link to Active Trip <span className="required">*</span></label>
                                    <select
                                        value={selectedTripId}
                                        onChange={(e) => setSelectedTripId(e.target.value)}
                                        className="trip-selector-premium"
                                    >
                                        <option value="">Select a journey...</option>
                                        {trips.map(trip => (
                                            <option key={trip.trip_id} value={trip.trip_id}>
                                                {trip.trip_id} - {trip.purpose} ({trip.source} → {trip.destination})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="input-row">
                                    <div className="input-field">
                                        <label>Category</label>
                                        <select
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            style={{
                                                borderColor: (() => {
                                                    const tw = checkTravel(formData.category);
                                                    return tw.warn ? '#f59e0b' : undefined;
                                                })()
                                            }}
                                        >
                                            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                        </select>
                                        {/* Soft warning: travel mode not entitled */}
                                        {(() => {
                                            const note = getEntitlementNote(formData.category);
                                            return note ? (
                                                <div style={{
                                                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                                                    background: '#fffbeb', border: '1px solid #fcd34d',
                                                    borderRadius: '8px', padding: '8px 12px', marginTop: '6px',
                                                    fontSize: '0.78rem', color: '#92400e', lineHeight: 1.4
                                                }}>
                                                    <AlertTriangle size={14} style={{ marginTop: '1px', flexShrink: 0, color: '#f59e0b' }} />
                                                    <span>{note}</span>
                                                </div>
                                            ) : null;
                                        })()} 

                                    </div>

                                    <div className="input-field">
                                        <label>Amount (₹)</label>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={formData.amount}
                                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                            required
                                            style={{
                                                borderColor: (() => {
                                                    if (formData.category === 'Accommodation') {
                                                        const ck = checkAccommodation(formData.amount, 'Others');
                                                        return ck.warn ? '#f59e0b' : undefined;
                                                    }
                                                    return undefined;
                                                })()
                                            }}
                                        />
                                        {/* Accommodation soft warning */}
                                        {formData.category === 'Accommodation' && formData.amount && (() => {
                                            const ck = checkAccommodation(formData.amount, 'Others');
                                            return ck.warn ? (
                                                <div style={{
                                                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                                                    background: '#fffbeb', border: '1px solid #fcd34d',
                                                    borderRadius: '8px', padding: '8px 12px', marginTop: '6px',
                                                    fontSize: '0.78rem', color: '#92400e', lineHeight: 1.4
                                                }}>
                                                    <AlertTriangle size={14} style={{ marginTop: '1px', flexShrink: 0, color: '#f59e0b' }} />
                                                    <span>⚠ Accommodation limit for your cadre: ₹{ck.limit?.toLocaleString()}. Excess will be reviewed by HR.</span>
                                                </div>
                                            ) : null;
                                        })()}

                                    </div>
                                </div>

                                <div className="input-field">
                                    <label>Expense Date</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="input-field">
                                    <label>Description / Remarks</label>
                                    <textarea
                                        placeholder="State the nature of this expense..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={2}
                                    />
                                </div>

                                <div className={`upload-panel-premium ${formData.receipt_image ? 'uploaded' : ''}`} onClick={() => document.getElementById('receipt-upload').click()}>
                                    <input
                                        id="receipt-upload"
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="ee-hidden"
                                        onChange={handleFileChange}
                                    />
                                    <div className="upload-progress-bubble">
                                        {isCapturingBill ? <div className="spinner"></div> : (formData.receipt_image ? <CheckCircle size={24} /> : <Upload size={24} />)}
                                    </div>
                                    <div className="upload-text">
                                        <strong>{formData.receipt_image ? 'Receipt Captured' : (isCapturingBill ? 'Processing...' : 'Capture Bill/Receipt')}</strong>
                                        <p>{formData.receipt_image ? 'Image verified' : 'Mandatory for reimbursement'}</p>
                                    </div>
                                </div>

                                <div className="eligibility-box">
                                    <div className="eligibility-info">
                                        {eligibility?.cadre ? (
                                            <>
                                                <Info size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
                                                <span>Your entitlement cadre: <strong>{eligibility.cadre}</strong>. Expenses outside your policy are allowed but flagged for HR review.</span>
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle size={16} />
                                                <span>Subject to policy limits and manager approval.</span>
                                            </>
                                        )}
                                    </div>
                                </div>


                                <button type="submit" className="btn-primary full-btn" disabled={isCapturingBill}>Add to Claim</button>
                            </form>
                        </>
                    )}
                </div>

                {/* List Section */}
                <div className="expense-list-section">
                    <div className="list-card premium-card">
                        <div className="list-header">
                            <h3>Current Items in Draft</h3>
                            <div className="total-badge">
                                Total: ₹{expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0).toLocaleString()}
                            </div>
                        </div>

                        <div className="expense-items scrollbar-hide">
                            {isLoadingExpenses ? (
                                <div className="loading-state-vsmall">
                                    <div className="spinner"></div>
                                    <p>Loading expenses...</p>
                                </div>
                            ) : expenses.length > 0 ? (
                                expenses.map(exp => (
                                    <div key={exp.id} className="expense-item-row">
                                        <div className="item-icon">
                                            {categories.find(c => c.id === exp.category)?.icon || <IndianRupee size={18} />}
                                        </div>
                                        <div className="item-main">
                                            <div className="item-id-badge">{exp.category}</div>
                                            <h4>{exp.description || 'No description'}</h4>
                                            <span>{exp.date}</span>
                                        </div>
                                        <div className="item-amount">
                                            <p>₹{parseFloat(exp.amount).toLocaleString()}</p>
                                        </div>
                                        <div className="item-status">
                                            <CheckCircle size={16} color="#10b981" />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-msg">
                                    <Clock size={40} strokeWidth={1} />
                                    <p>{selectedTripId ? 'No expenses recorded for this trip.' : 'Select a trip to view or add expenses.'}</p>
                                </div>
                            )}
                        </div>

                        <div className="list-actions">
                            <button
                                className="btn-primary-glow"
                                onClick={handleSubmitAll}
                                disabled={expenses.length === 0 || isLoadingExpenses}
                            >
                                Submit Full Claim for Review
                            </button>
                        </div>
                    </div>
                </div>
            </div>


        </div>
    );
};

export default ExpenseEntry;
