import React, { useState, useEffect, useRef } from 'react';
import {
    X,
    IndianRupee,
    FileText,
    Send,
    CheckCircle2,
    Clock,
    Plus,
    History,
    ArrowUpCircle,
    ArrowDownCircle,
    Info,
    AlertCircle,
    Camera,
    Tag,
    MapPin,
    Receipt
} from 'lucide-react';
import { encodeId } from '../../utils/idEncoder';
import api from '../../api/api';
import { useToast } from '../../context/ToastContext.jsx';
import { formatIndianCurrency } from '../../utils/formatters';
import { ArrowLeft } from 'lucide-react';

const TripWalletModal = ({ isOpen, onClose, trip, onUpdate }) => {
    const { showToast } = useToast();
    const [view, setView] = useState('overview'); // 'overview', 'request_advance', 'add_expense'
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tripData, setTripData] = useState(trip);
    const fileInputRef = useRef(null);

    const getMinDate = () => {
        if (!trip?.start_date) return undefined;
        try {
            const d = new Date(trip.start_date);
            d.setDate(d.getDate() - 1);
            return d.toISOString().split('T')[0];
        } catch (e) { return undefined; }
    };

    const getMaxDate = () => {
        if (!trip?.end_date) return undefined;
        try {
            const d = new Date(trip.end_date);
            d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
        } catch (e) { return undefined; }
    };

    const minDate = getMinDate();
    const maxDate = getMaxDate();

    // Form states
    const [advanceForm, setAdvanceForm] = useState({ amount: '', purpose: '' });
    const [expenseForm, setExpenseForm] = useState({
        category: 'Food',
        date: (() => {
            const today = new Date().toISOString().split('T')[0];
            if (minDate && maxDate) {
                if (today >= minDate && today <= maxDate) return today;
                return trip?.start_date || today;
            }
            return today;
        })(),
        amount: '',
        description: '',
        receipt_image: '',
        latitude: null,
        longitude: null
    });
    const [isLocating, setIsLocating] = useState(false);
    const [focusedInput, setFocusedInput] = useState(null); // 'advance_amount' or 'expense_amount'

    const categories = [
        { id: 'Food', label: 'Food & Refreshments' },
        { id: 'Fuel', label: 'Fuel / Mileage' },
        { id: 'Accommodation', label: 'Hotel & Stay' },
        { id: 'Toll', label: 'Toll & Parking' },
        { id: 'Others', label: 'Miscellaneous' }
    ];

    useEffect(() => {
        if (isOpen && trip) {
            refreshTripData();
        } else if (!isOpen) {
            setAdvanceForm({ amount: '', purpose: '' });
            setView('overview');
        }
    }, [isOpen, trip]);

    const refreshTripData = async () => {
        setIsLoading(true);
        try {
            const response = await api.get(`/api/trips/${encodeId(trip.id)}/`);
            setTripData(response.data);
        } catch (error) {
            console.error("Failed to refresh trip data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRequestAdvance = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/api/advances/', {
                requested_amount: parseFloat(advanceForm.amount) || 0,
                purpose: advanceForm.purpose,
                trip: trip.id,
                status: 'Submitted',
                submitted_at: new Date().toISOString()
            });
            showToast("Advance request submitted!", "success");
            setAdvanceForm({ amount: '', purpose: '' });
            setView('overview');
            refreshTripData();
            if (onUpdate) onUpdate();
            if (onClose) onClose();
        } catch (error) {
            showToast("Failed to submit request", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();

        const isBulkUpload = trip.is_bulk_upload || (trip.activity_batches && trip.activity_batches.length > 0);
        if (isBulkUpload) {
            showToast("Manual expense submissions are disabled for bulk-uploaded trips.", "error");
            return;
        }

        if (!expenseForm.receipt_image) {
            showToast("Physical receipt capture is mandatory!", "error");
            return;
        }

        // DATE RANGE VALIDATION
        if (minDate && maxDate) {
            if (expenseForm.date < minDate || expenseForm.date > maxDate) {
                showToast(`Expense date must be between ${minDate} and ${maxDate} (Trip dates +/- 1 day grace).`, "error");
                return;
            }
        }
        if (!expenseForm.latitude) {
            showToast("Location capture is mandatory!", "error");
            captureLocation();
            return;
        }

        setIsSubmitting(true);
        try {
            await api.post('/api/expenses/', {
                ...expenseForm,
                amount: parseFloat(expenseForm.amount) || 0,
                trip: trip.id
            });
            showToast("Expense recorded!", "success");
            setExpenseForm({
                category: 'Food',
                date: new Date().toISOString().split('T')[0],
                amount: '',
                description: '',
                receipt_image: '',
                latitude: null,
                longitude: null
            });
            setView('overview');
            refreshTripData();
            if (onUpdate) onUpdate();
        } catch (error) {
            showToast("Failed to record expense", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const captureLocation = () => {
        if (!navigator.geolocation) {
            showToast("GPS not supported. Using office fallback.", "info");
            setExpenseForm(prev => ({ ...prev, latitude: 17.3850, longitude: 78.4867 }));
            return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setExpenseForm(prev => ({
                    ...prev,
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude
                }));
                setIsLocating(false);
                showToast("Location verified", "success");
            },
            () => {
                setIsLocating(false);
                // Fallback for testing on non-HTTPS or local environments
                showToast("GPS blocked. Using HQ fallback coordinates.", "warning");
                setExpenseForm(prev => ({
                    ...prev,
                    latitude: 17.3850, // Default HQ Lat
                    longitude: 78.4867 // Default HQ Long
                }));
            }
        );
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            captureLocation();
            const reader = new FileReader();
            reader.onloadend = () => setExpenseForm(prev => ({ ...prev, receipt_image: reader.result }));
            reader.readAsDataURL(file);
        }
    };

    if (!isOpen) return null;

    const balance = parseFloat(tripData?.wallet_balance || 0);
    const minBalance = 500;
    const isLowBalance = balance < minBalance;

    return (
        <div className="modal-overlay">
            <div className="wallet-modal glass animate-fade-in" onClick={e => e.stopPropagation()}>
                <div className="modal-header-premium">
                    <div className="header-left-content">
                        <div className="trip-badge-id">{trip.id}</div>
                        <h2>Trip Advance & Top-up</h2>
                    </div>
                    <button className="modal-close-icon" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="modal-body-scroll-premium">
                    {!(trip.status?.toLowerCase() === 'approved' ||
                        trip.status?.toLowerCase() === 'hr approved' ||
                        trip.status?.toLowerCase() === 'on-going' ||
                        trip.status?.toLowerCase() === 'completed') ? (
                        <div className="wallet-locked-state">
                            <Clock size={48} className="animate-pulse" />
                            <h3>Wallet Locked</h3>
                            <p>Funds and expense entry will be enabled once the trip is <strong>Approved</strong>.</p>
                        </div>
                    ) : isLoading ? (
                        <div className="wallet-loading-state"><div className="spinner"></div><p>Syncing wallet...</p></div>
                    ) : view === 'overview' ? (
                        <div className="wallet-overview">
                            {/* Balance Card */}
                            <div className={`balance-card ${isLowBalance ? 'low' : 'ok'}`}>
                                <div className="balance-info">
                                    <label>Available Trip Balance</label>
                                    <div className="balance-amount">₹{formatIndianCurrency(balance)}</div>
                                    <div className="balance-status">
                                        {isLowBalance ? (
                                            <><AlertCircle size={14} /> Low Balance Alert! Top up recommended.</>
                                        ) : (
                                            <><CheckCircle2 size={14} /> Balance is healthy</>
                                        )}
                                    </div>
                                </div>
                                <div className="balance-stats">
                                    <div className="stat-item">
                                        <ArrowUpCircle size={16} />
                                        <div>
                                            <label>Total Advances</label>
                                            <p>+ ₹{formatIndianCurrency(tripData?.total_approved_advance || 0)}</p>
                                        </div>
                                    </div>
                                    <div className="stat-item">
                                        <ArrowDownCircle size={16} />
                                        <div>
                                            <label>Total Spent</label>
                                            <p>- ₹{formatIndianCurrency(tripData?.total_expenses || 0)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="wallet-actions">
                                <button className="btn-primary-wallet primary" style={{ width: '100%' }} onClick={() => setView('request_advance')}>
                                    <IndianRupee size={18} />
                                    <span>Request New Advance / Top Up</span>
                                </button>
                            </div>

                            {/* Recent Activity */}
                            <div className="activity-section">
                                <div className="section-header">
                                    <h3>Trip Activity</h3>
                                    <History size={16} />
                                </div>
                                <div className="activity-list">
                                    {/* Combining advances and expenses for activity feed */}
                                    {[...(tripData?.advances || []), ...(tripData?.expenses || [])]
                                        .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
                                        .map((item, idx) => (
                                            <div key={idx} className="activity-item">
                                                <div className={`act-icon ${item.requested_amount ? 'income' : 'expense'}`}>
                                                    {item.requested_amount ? <ArrowUpCircle size={16} /> : <Tag size={16} />}
                                                </div>
                                                <div className="act-details">
                                                    <strong>{item.requested_amount ? `Advance: ${item.purpose}` : item.category}</strong>
                                                    <span>{item.date || new Date(item.created_at).toLocaleDateString()}</span>
                                                    <div className={`act-status ${(item.status || 'Recorded').toLowerCase()}`}>
                                                        {item.status || 'Recorded'}
                                                    </div>
                                                </div>
                                                <div className={`act-amount ${item.requested_amount ? 'income' : 'expense'}`}>
                                                    {item.requested_amount ? '+' : '-'} ₹{formatIndianCurrency(item.requested_amount || item.amount)}
                                                </div>
                                            </div>
                                        ))
                                    }
                                    {(!tripData?.advances?.length && !tripData?.expenses?.length) && (
                                        <div className="empty-activity">No transactions recorded yet.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : view === 'request_advance' ? (
                        <div className="request-advance-view">
                            <div className="view-header">
                                <button className="back-btn" onClick={() => setView('overview')}><ArrowLeft size={18} /></button>
                                <h3>Request New Advance / Top Up</h3>
                            </div>
                            <form className="wallet-form" onSubmit={handleRequestAdvance}>
                                <div className="form-group-p">
                                    <label>Amount (INR)</label>
                                    <div className="input-with-icon-p">
                                        <IndianRupee size={18} />
                                        <input
                                            type="text"
                                            value={focusedInput === 'advance_amount' ? advanceForm.amount : (advanceForm.amount ? formatIndianCurrency(advanceForm.amount) : '')}
                                            onFocus={() => setFocusedInput('advance_amount')}
                                            onBlur={() => setFocusedInput(null)}
                                            onChange={e => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                if (val.split('.').length > 2) return;
                                                setAdvanceForm({ ...advanceForm, amount: val });
                                            }}
                                            placeholder="Enter amount"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group-p">
                                    <label>Purpose / Description</label>
                                    <textarea
                                        value={advanceForm.purpose}
                                        onChange={e => setAdvanceForm({ ...advanceForm, purpose: e.target.value })}
                                        placeholder="Why do you need this top up?"
                                        rows="4"
                                        required
                                    />
                                </div>
                                <div className="form-actions-p">
                                    <button type="submit" className="btn-wallet-submit" disabled={isSubmitting}>
                                        {isSubmitting ? <div className="spinner-mini" /> : <Send size={18} />}
                                        <span>Submit Request</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="add-expense-view">
                            <div className="view-header">
                                <button className="back-btn" onClick={() => setView('overview')}><ArrowLeft size={18} /></button>
                                <h3>Record Expense</h3>
                            </div>
                            <form className="wallet-form" onSubmit={handleAddExpense}>
                                <div className="form-grid-p">
                                    <div className="form-group-p">
                                        <label>Category</label>
                                        <select
                                            value={expenseForm.category}
                                            onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                                        >
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group-p">
                                        <label>Date</label>
                                        <input
                                            type="date"
                                            min={minDate}
                                            max={maxDate}
                                            value={expenseForm.date}
                                            onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group-p">
                                    <label>Amount (INR)</label>
                                    <div className="input-with-icon-p">
                                        <IndianRupee size={18} />
                                        <input
                                            type="text"
                                            value={focusedInput === 'expense_amount' ? expenseForm.amount : (expenseForm.amount ? formatIndianCurrency(expenseForm.amount) : '')}
                                            onFocus={() => setFocusedInput('expense_amount')}
                                            onBlur={() => setFocusedInput(null)}
                                            onChange={e => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                if (val.split('.').length > 2) return;
                                                setExpenseForm({ ...expenseForm, amount: val });
                                            }}
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group-p">
                                    <label>Description</label>
                                    <textarea
                                        value={expenseForm.description}
                                        onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                                        placeholder="What was this for?"
                                        rows="2"
                                    />
                                </div>

                                <div className="receipt-area-p" onClick={() => fileInputRef.current.click()}>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        onChange={handleFileChange}
                                    />
                                    {expenseForm.receipt_image ? (
                                        <div className="receipt-preview-p">
                                            <img src={expenseForm.receipt_image} alt="Receipt" />
                                            <div className="receipt-overlay-p"><Camera size={20} /> Retake</div>
                                        </div>
                                    ) : (
                                        <div className="receipt-placeholder-p">
                                            <Camera size={32} />
                                            <p>Capture Physical Receipt</p>
                                            <span>Mandatory for verification</span>
                                        </div>
                                    )}
                                </div>

                                <div className="location-status-p">
                                    {isLocating ? (
                                        <div className="loc-badge waiting"><Clock size={12} /> Verifying Location...</div>
                                    ) : expenseForm.latitude ? (
                                        <div className="loc-badge ok"><MapPin size={12} /> Location Verified</div>
                                    ) : (
                                        <div className="loc-badge warn"><AlertCircle size={12} /> GPS Required</div>
                                    )}
                                </div>

                                <div className="form-actions-p">
                                    <button type="submit" className="btn-wallet-submit" disabled={isSubmitting || isLocating || (trip.is_bulk_upload || (trip.activity_batches && trip.activity_batches.length > 0))}>
                                        {isSubmitting ? <div className="spinner-mini" /> : <CheckCircle2 size={18} />}
                                        <span>Record Expense</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>


        </div>
    );
};

export default TripWalletModal;
