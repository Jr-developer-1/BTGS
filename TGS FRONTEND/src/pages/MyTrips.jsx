import React, { useState, useEffect } from 'react';
import {
    Plane,
    Search,
    Filter,
    MapPin,
    Calendar,
    ArrowRight,
    ChevronRight,
    MoreVertical,
    X,
    CheckCircle2,
    Clock,
    CreditCard,
    Gauge,
    History,
    Camera,
    Briefcase,
    Info,
    Hotel,
    Bed,
    Check,
    Users,
    IndianRupee,
    TrendingUp,
    User,
    FileDown,
    Sheet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useToast } from '../context/ToastContext.jsx';

import { encodeId } from '../utils/idEncoder';
import { useAuth } from '../context/AuthContext';

const MyTrips = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();
    const [exportingId, setExportingId] = useState(null);
    const [filter, setFilter] = useState('All Status');
    const [typeFilter, setTypeFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [trips, setTrips] = useState([]);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [odoData, setOdoData] = useState({ start: '', end: '', startPhoto: false, endPhoto: false });
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeMenu, setActiveMenu] = useState(null);
    const [modalTrip, setModalTrip] = useState(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActiveMenu(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const toggleMenu = (e, tripId) => {
        e.stopPropagation();
        setActiveMenu(activeMenu === tripId ? null : tripId);
    };

    useEffect(() => {
        if (selectedTrip) {
            setOdoData({
                start: selectedTrip.startOdometer || '',
                end: selectedTrip.endOdometer || '',
                startPhoto: !!selectedTrip.startOdoPhoto,
                endPhoto: !!selectedTrip.endOdoPhoto
            });
        }
    }, [selectedTrip]);

    const handleOdoChange = (e) => {
        const { name, value } = e.target;
        setOdoData(prev => ({ ...prev, [name]: value }));
    };

    const capturePhoto = (type) => {
        setOdoData(prev => ({ ...prev, [`${type}Photo`]: true }));
        showToast(`${type === 'start' ? 'Starting' : 'Ending'} Odometer Photo Captured Successfully!`, 'success');
    };

    const saveMileage = () => {
        if (!odoData.start || !odoData.end) {
            showToast('Please enter both starting and ending readings.', 'warning');
            return;
        }
        if (Number(odoData.end) < Number(odoData.start)) {
            showToast('Ending reading cannot be less than starting reading.', 'error');
            return;
        }
        if (!odoData.startPhoto || !odoData.endPhoto) {
            showToast('Photo verification is mandatory for both readings.', 'warning');
            return;
        }

        setIsSaving(true);

        // Update local state and sessionStorage
        const updatedTrips = trips.map(t => {
            if (t.id === selectedTrip.id) {
                return {
                    ...t,
                    startOdometer: odoData.start,
                    endOdometer: odoData.end,
                    startOdoPhoto: true,
                    endOdoPhoto: true,
                    mileageVerified: true
                };
            }
            return t;
        });

        setTimeout(() => {
            setTrips(updatedTrips);
            sessionStorage.setItem('user_trips', JSON.stringify(updatedTrips.filter(t => !['TRP-2024-001', 'TRP-2024-002', 'TRP-2024-003'].includes(t.id))));
            setIsSaving(false);
            showToast('Mileage telemetry has been verified and committed to the trip records.', 'success');
        }, 1000);
    };

    const downloadExport = async (tripId, format) => {
        setExportingId(`${tripId}-${format}`);
        try {
            const response = await api.get(
                `/api/trips/${tripId}/export/${format}/`,
                { responseType: 'blob' }
            );
            const blob = new Blob([response.data], {
                type: format === 'pdf'
                    ? 'application/pdf'
                    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `expense_statement_${tripId}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast(`${format.toUpperCase()} downloaded successfully!`, 'success');
        } catch (e) {
            console.error('Export error:', e);
            showToast(`Failed to download ${format.toUpperCase()}: ${e.message}`, 'error');
        } finally {
            setExportingId(null);
        }
    };

    const [pagination, setPagination] = useState({
        count: 0,
        next: null,
        previous: null,
        currentPage: 1
    });

    const fetchTrips = async (page = 1) => {
        setIsLoading(true);
        try {
            const [tripsRes, travelsRes] = await Promise.all([
                api.get('/api/trips/', { params: { search: searchTerm, page: page } }),
                api.get('/api/travels/', { params: { search: searchTerm, page: page } })
            ]);

            // Since we are combining two paginated sources, we normally would need complex logic.
            // However, most users primarily use one or the other. For now, we'll merge the results
            // and use the larger pagination count.
            const tripsData = tripsRes.data.results || tripsRes.data || [];
            const travelsData = travelsRes.data.results || travelsRes.data || [];

            const allData = [...tripsData, ...travelsData].sort((a, b) => {
                const getPriority = (status) => {
                    const s = (status || '').toLowerCase();
                    // Priority 1: Actionable / Pending Approval / Resubmitted / Claim Submitted
                    if (s.includes('pending') || s === 'approved' || s === 'manager approved' || s === 'hr approved' || s === 'resubmitted' || s === 'claim submitted') return 1;
                    // Priority 3: Finalized / Settled
                    if (['settled', 'paid', 'transferred', 'completed & settled'].some(term => s.includes(term))) return 3;
                    // Priority 2: Everything else
                    return 2;
                };
                const pA = getPriority(a.status);
                const pB = getPriority(b.status);
                if (pA !== pB) return pA - pB;
                // Secondary sort: Newest first within same priority
                return new Date(b.created_at) - new Date(a.created_at);
            });

            // Update pagination state - calculate next/previous based on merged count
            const totalCount = Math.max(tripsRes.data.count || 0, travelsRes.data.count || 0);
            const itemsPerPage = allData.length || 10;
            const hasMore = (page * itemsPerPage) < totalCount;

            if (tripsRes.data.count !== undefined) {
                setPagination({
                    count: totalCount,
                    next: hasMore ? `page=${page + 1}` : null,
                    previous: page > 1 ? `page=${page - 1}` : null,
                    currentPage: page
                });
            }

            const parseJsonField = (field) => {
                if (!field) return [];
                if (Array.isArray(field)) return field;
                if (typeof field === 'string') {
                    try {
                        return JSON.parse(field);
                    } catch (e) {
                        console.warn("Failed to parse JSON field:", field);
                        return [];
                    }
                }
                return [];
            };

            if (!Array.isArray(allData)) {
                console.warn("Expected array from APIs, got:", allData);
                setTrips([]);
                return;
            }

            const mappedTrips = allData.filter(t => t !== null && t !== undefined).map(trip => ({
                id: trip.trip_id,
                userName: trip.user_name || 'N/A',
                userEmpId: trip.user_emp_id || 'N/A',
                purpose: trip.purpose || 'No Purpose Specified',
                destination: trip.destination || 'TBD',
                dates: `${trip.start_date || 'N/A'} - ${trip.end_date || 'N/A'}`,
                status: trip.status || 'Pending',
                cost: trip.cost_estimate || '0',
                from: trip.source || 'N/A',
                to: trip.destination || 'N/A',
                travelMode: trip.travel_mode || '',
                composition: trip.composition,
                tripLeader: trip.trip_leader,
                enRoute: trip.en_route,
                project: trip.project_code || 'General',
                considerAsLocal: trip.consider_as_local,
                isBulkUpload: trip.is_bulk_upload,
                accommodationRequests: parseJsonField(trip.accommodation_requests),
                vehicleType: trip.vehicle_type,
                members: parseJsonField(trip.members),
                lifecycleEvents: parseJsonField(trip.lifecycle_events),
                advances: trip.advances || [],
                odometer: trip.odometer,
                totalApprovedAdvance: trip.total_approved_advance || 0,
                totalExpenses: trip.total_expenses || 0,
                walletBalance: trip.wallet_balance || 0,
                reportingManager: trip.reporting_manager_name || 'N/A'
            }));
            setTrips(mappedTrips);
        } catch (error) {
            console.error("Failed to fetch trips:", error);
            showToast(`Failed to load trips: ${error.message || 'Unknown error'}`, "error");
        } finally {
            setIsLoading(false);
        }
    };

    const getDisplayStatus = (backendStatus) => {
        if (!backendStatus) return 'Pending';
        const s = backendStatus.toLowerCase();

        // 1. Settled / Paid / Completed
        if (['settled', 'completed', 'paid', 'transferred'].includes(s)) {
            return 'Settled';
        }

        // 2. Approved / Mid-lifecycle
        if (['approved', 'claim submitted', 'manager approved', 'hr approved', 'under process', 'partially completed', 'forwarded'].includes(s)) {
            return 'Approved';
        }

        // 3. Resubmitted
        if (s === 'resubmitted') {
            return 'Resubmitted';
        }

        // 4. Pending Approval / Submitted
        if (['pending', 'submitted', 'draft', 'pending_hr', 'pending_executive', 'pending_head', 'pending_final_release'].includes(s)) {
            return 'Pending';
        }

        // Fallbacks
        if (s.includes('pending')) return 'Pending';
        if (s.includes('reject')) return 'Rejected';

        return 'Approved'; // Default fallback to Approved
    };

    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            fetchTrips();
        }, 500);

        return () => clearTimeout(debounceTimer);
    }, [searchTerm]);

    const filteredTrips = trips.filter(t => {
        // Exclude any trips that resolve to "Pending" display status
        const displayStatus = getDisplayStatus(t.status);
        if (displayStatus === 'Pending') return false;

        const matchesStatus = filter === 'All Status' || t.status === filter;
        const matchesType = typeFilter === 'All' ||
            (typeFilter === 'Trip' && !t.considerAsLocal) ||
            (typeFilter === 'Travel' && t.considerAsLocal);
        return matchesStatus && matchesType;
    });

    return (
        <div className="trips-page">
            <div className="page-header">
                <div>
                    <h1>My Trips & Tour Plans</h1>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '12px' }}>
                    {(typeFilter === 'All' || typeFilter === 'Trip') && (user?.role_permissions?.can_create_trip !== false) && (
                        <button className="btn-primary" onClick={() => navigate('/create-trip')}>
                            <Plane size={18} style={{ marginRight: '8px' }} />
                            New Trip Request
                        </button>
                    )}
                    {(() => {
                        const canCreateTourPlan = user?.role_permissions?.can_create_tour_plan;

                        return (typeFilter === 'All' || typeFilter === 'Travel') && canCreateTourPlan && (
                            <button className="btn-primary" style={{ backgroundColor: 'white', color: 'var(--magenta)', border: '1px solid var(--magenta)' }} onClick={() => navigate('/travel-creation')}>
                                <Briefcase size={18} style={{ marginRight: '8px' }} />
                                New Tour Plan
                            </button>
                        );
                    })()}
                </div>
            </div>

            <div className="trips-toolbar premium-card">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search by Trip ID or Purpose..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="filter-group">
                    <Briefcase size={18} />
                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                        <option>All</option>
                        <option>Trip</option>
                        <option>Travel</option>
                    </select>
                </div>
            </div>

            <div className="trips-grid">
                {isLoading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading your trips...</p>
                    </div>
                ) : filteredTrips.length === 0 ? (
                    <div className="no-trips-state">
                        <div className="empty-icon"><Plane size={48} /></div>
                        <h3>No Trips Found</h3>
                        <p>You haven't created any trips yet, or no trips match your filter.</p>
                        <button className="btn-primary" onClick={() => navigate('/create-trip')}>Create New Trip</button>
                    </div>
                ) : (
                    filteredTrips.map(trip => (
                        <div key={trip.id} className={`trip-card premium-card ${['settled', 'completed', 'paid', 'transferred'].includes(trip.status?.toLowerCase()) ? 'completed-blocked' : ''} ${trip.considerAsLocal ? 'travel-card' : ''}`}>
                            {['settled', 'completed', 'paid', 'transferred'].includes(trip.status?.toLowerCase()) && (
                                <div className="settled-overlay">
                                    <div className="settled-badge">
                                        <CheckCircle2 size={20} />
                                        <span>JOURNEY COMPLETED & SETTLED</span>
                                    </div>
                                </div>
                            )}
                            <div className="card-top">
                                <div className={`status-pill ${getDisplayStatus(trip.status).toLowerCase() === 'resubmitted' ? 'pending' : getDisplayStatus(trip.status).toLowerCase()}`}>
                                    {getDisplayStatus(trip.status)}
                                </div>
                                <span className="trip-card-id">{trip.id}</span>
                            </div>

                            <div className="card-body">
                                <div className="trip-icon">
                                    {trip.considerAsLocal ? <Briefcase size={24} /> : <Plane size={24} />}
                                </div>
                                <div className="trip-main">
                                    <h3>{trip.purpose}</h3>
                                    <div className="trip-meta">
                                        <div className="meta-item">
                                            <User size={14} /> <span>{trip.userName} ({trip.userEmpId})</span>
                                        </div>
                                        <div className="meta-item">
                                            <MapPin size={14} /> <span>{trip.from} → {trip.to}</span>
                                        </div>
                                        <div className="meta-item">
                                            <Calendar size={14} /> <span>{trip.dates}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="card-footer-extended">
                                <div className="cost-info">
                                    <span>Estimated Cost</span>
                                    <p>{trip.cost}</p>
                                </div>
                                <div className="card-actions-v">
                                    {!trip.considerAsLocal && (
                                        <>
                                            <button
                                                className="view-details-btn-v secondary"
                                                onClick={() => setSelectedTrip(trip)}
                                            >
                                                <span>View Details</span>
                                                <ArrowRight size={16} />
                                            </button>

                                            <button
                                                className="view-details-btn-v"
                                                onClick={() => navigate(`/trip-timeline/${encodeId(trip.id)}`)}
                                            >
                                                <span>View Trip Timeline</span>
                                                <ChevronRight size={16} />
                                            </button>
                                        </>
                                    )}

                                    {trip.status?.toLowerCase() !== 'draft' && trip.status?.toLowerCase() !== 'cancelled' && (
                                        <button
                                            className="view-details-btn-v"
                                            style={{ color: 'var(--magenta)' }}
                                            onClick={() => navigate(`/${(trip.considerAsLocal && trip.isBulkUpload) ? 'travel-story' : 'trip-story'}/${encodeId(trip.id)}`)}
                                        >
                                            <span>View {(trip.considerAsLocal && trip.isBulkUpload) ? 'Travel Story' : 'Trip Story'}</span>
                                            <TrendingUp size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )))}
            </div>

            {/* Pagination Controls */}
            {pagination.count > 10 && (
                <div className="pagination-footer premium-card">
                    <div className="pagination-info">
                        Showing <strong>{trips.length}</strong> of <strong>{pagination.count}</strong> records
                    </div>
                    <div className="pagination-actions">
                        <button
                            className="page-btn"
                            disabled={!pagination.previous || isLoading}
                            onClick={() => fetchTrips(pagination.currentPage - 1)}
                        >
                            Previous
                        </button>
                        <span className="page-indicator">Page {pagination.currentPage}</span>
                        <button
                            className="page-btn"
                            disabled={!pagination.next || isLoading}
                            onClick={() => fetchTrips(pagination.currentPage + 1)}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Sub-Feature Modals */}
            {
                selectedTrip && (
                    <div className="modal-overlay" onClick={() => setSelectedTrip(null)}>
                        <div className="details-modal glass animate-fade-in" onClick={e => e.stopPropagation()}>
                            <div className="modal-header-premium">
                                <div className="header-left-content">
                                    <div className="trip-badge-id">{selectedTrip.id}</div>
                                    <h2>Trip Summary</h2>
                                </div>
                                <button className="modal-close-icon" onClick={() => setSelectedTrip(null)}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="modal-body-scroll-premium">
                                <div className="trip-primary-meta">
                                    <div className="p-meta-box">
                                        <div className="p-meta-icon"><Briefcase size={20} /></div>
                                        <div className="p-meta-text">
                                            <label>Trip Objective</label>
                                            <p>{selectedTrip.purpose}</p>
                                        </div>
                                    </div>
                                    <div className="p-meta-box">
                                        <div className="p-meta-icon"><MapPin size={20} /></div>
                                        <div className="p-meta-text">
                                            <label>Journal Route</label>
                                            <p>{selectedTrip.from} → {selectedTrip.to}</p>
                                        </div>
                                    </div>
                                    <div className="p-meta-box Personnel-box">
                                        <div className="p-meta-icon"><Users size={20} /></div>
                                        <div className="p-meta-text">
                                            <label>Personnel</label>
                                            <p>{selectedTrip.composition === 'Solo' ? 'Alone' : 'Team'} Travel</p>
                                            {selectedTrip.composition !== 'Solo' && selectedTrip.members && selectedTrip.members.length > 0 && (
                                                <div className="modal-members-list mt-1">
                                                    {selectedTrip.members.map((m, idx) => (
                                                        <span key={idx} className="member-tag-mini">{m}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="details-info-grid">
                                    <div className="info-tile">
                                        <label>Current Status</label>
                                        <div className={`status-tag ${getDisplayStatus(selectedTrip.status).toLowerCase() === 'resubmitted' ? 'pending' : getDisplayStatus(selectedTrip.status).toLowerCase()}`}>
                                            {getDisplayStatus(selectedTrip.status)}
                                        </div>
                                    </div>
                                    <div className="info-tile">
                                        <label>Travel Dates</label>
                                        <p>{selectedTrip.dates}</p>
                                    </div>
                                    <div className="info-tile">
                                        <label>Travel Mode</label>
                                        <p><strong>{selectedTrip.travelMode}</strong></p>
                                    </div>
                                    <div className="info-tile budget-tile">
                                        <label>Estimated Budget</label>
                                        <p className="budget-val">{selectedTrip.cost}</p>
                                    </div>
                                </div>

                                {selectedTrip.odometer && (
                                    <div className="summary-section-p">
                                        <div className="summary-header-p">
                                            <Gauge size={20} />
                                            <h4>Journey Telemetry</h4>
                                        </div>
                                        <div className="summary-content-p grid-2-p">
                                            <div className="summary-tile">
                                                <label>Start Reading</label>
                                                <strong>{selectedTrip.odometer.start_odo_reading} KM</strong>
                                            </div>
                                            {selectedTrip.odometer.end_odo_reading ? (
                                                <>
                                                    <div className="summary-tile">
                                                        <label>End Reading</label>
                                                        <strong>{selectedTrip.odometer.end_odo_reading} KM</strong>
                                                    </div>
                                                    <div className="summary-tile total-tile-p">
                                                        <label>Total Journey Distance</label>
                                                        <div className="total-val-p">{parseFloat(selectedTrip.odometer.end_odo_reading) - parseFloat(selectedTrip.odometer.start_odo_reading)} KM</div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="summary-tile pending-tile-p">
                                                    <label>Arrival Reading</label>
                                                    <p>Pending Trip Completion</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer-premium" style={{ justifyContent: 'center' }}>
                                <button className="modal-dismiss-btn" onClick={() => setSelectedTrip(null)} style={{ border: '1px solid #e2e8f0' }}>
                                    Return to Overview
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            <style>{`
                .travel-card {
                    border-top: 3px solid #06b6d4 !important;
                }
                .travel-card .trip-icon {
                    background: #ecfeff !important;
                    color: #0891b2 !important;
                }
                .trip-card.completed-blocked {
                    position: relative;
                    opacity: 0.85;
                    pointer-events: none;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                }
                .settled-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(255, 255, 255, 0.4);
                    backdrop-filter: grayscale(1);
                    z-index: 5;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 20px;
                }
                .settled-badge {
                    background: #0f172a;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 30px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 11px;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                    box-shadow: 0 10px 20px rgba(0,0,0,0.1);
                    transform: rotate(-5deg);
                }
                .pagination-footer {
                    margin-top: 30px;
                    padding: 15px 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                }
                .pagination-info {
                    color: var(--text-muted);
                    font-size: 0.9rem;
                }
                .pagination-actions {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                .page-btn {
                    padding: 8px 20px;
                    border-radius: 10px;
                    border: 1px solid #e2e8f0;
                    background: white;
                    color: var(--text-main);
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .page-btn:hover:not(:disabled) {
                    background: #f8fafc;
                    border-color: var(--primary);
                    color: var(--primary);
                }
                .page-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .page-indicator {
                    font-weight: 700;
                    color: var(--text-main);
                    font-size: 0.9rem;
                }
            `}</style>
        </div>
    );
};

export default MyTrips;