import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plane,
    Wallet,
    FileText,
    Clock,
    Calendar,
    IndianRupee,
    Filter,
    CheckCircle2,
    XCircle,
    ArrowRight
} from 'lucide-react';
import api from '../api/api';
import { useToast } from '../context/ToastContext.jsx';
import { encodeId } from '../utils/idEncoder';
import { useAuth } from '../context/AuthContext';


const MyRequests = ({ enforceView = null }) => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();

    const [trips, setTrips] = useState([]);
    const [advances, setAdvances] = useState([]);
    const [claims, setClaims] = useState([]);

    const [paginations, setPaginations] = useState({
        trips: { count: 0, currentPage: 1, next: null, previous: null },
        advances: { count: 0, currentPage: 1, next: null, previous: null },
        claims: { count: 0, currentPage: 1, next: null, previous: null }
    });

    const [viewMode, setViewMode] = useState(enforceView || 'active'); // 'active' or 'historical'
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (enforceView) {
            setViewMode(enforceView);
        }
    }, [enforceView]);

    useEffect(() => {
        fetchTrips(1);
        fetchAdvances(1);
    }, [user?.active_position_id]);

    const fetchTrips = async (page = 1) => {
        setIsLoading(true);
        try {
            const [tripsRes, travelsRes] = await Promise.all([
                api.get('/api/trips/', { params: { page } }),
                api.get('/api/travels/', { params: { page } })
            ]);

            const tripsData = tripsRes.data.results || tripsRes.data || [];
            const travelsData = travelsRes.data.results || travelsRes.data || [];

            const mappedTrips = tripsData.map(trip => ({
                id: trip.trip_id,
                title: trip.purpose || 'Travel Request',
                date: `${trip.start_date || 'N/A'} - ${trip.end_date || 'N/A'}`,
                amount: parseFloat((trip.cost_estimate || '0').replace(/[^0-9.]/g, '')),
                status: trip.status || 'Pending',
                type: 'trip',
                raw: trip
            }));

            const mappedTravels = travelsData.map(trip => ({
                id: trip.trip_id,
                title: trip.purpose || 'Travel Request',
                date: `${trip.start_date || 'N/A'} - ${trip.end_date || 'N/A'}`,
                amount: parseFloat((trip.cost_estimate || '0').replace(/[^0-9.]/g, '')),
                status: trip.status || 'Pending',
                type: 'travel',
                raw: trip
            }));

            setTrips([...mappedTrips, ...mappedTravels]);

            setPaginations(prev => ({
                ...prev,
                trips: {
                    count: Math.max(tripsRes.data.count || 0, travelsRes.data.count || 0),
                    currentPage: page,
                    next: tripsRes.data.next || travelsRes.data.next,
                    previous: tripsRes.data.previous || travelsRes.data.previous
                }
            }));

            // Synthetic Claims logic based on paginated trips
            const rawTrips = [...tripsData, ...travelsData];
            const claimsList = [];
            rawTrips.forEach(trip => {
                if (parseFloat(trip.total_expenses) > 0) {
                    claimsList.push({
                        id: `CLM-${trip.trip_id.substring(4)}`,
                        title: `Claim for ${trip.purpose}`,
                        date: new Date(trip.created_at || Date.now()).toLocaleDateString(),
                        amount: parseFloat(trip.total_expenses),
                        status: trip.status === 'Settled' ? 'Settled' : (['Pending Settlement', 'Finance Review'].includes(trip.status) ? 'Processing' : 'Submitted'),
                        type: 'claim',
                        tripRef: trip.trip_id
                    });
                }
            });
            setClaims(claimsList);

        } catch (error) {
            console.error("Error fetching trips:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAdvances = async (page = 1) => {
        try {
            const resp = await api.get('/api/advances/', { params: { page } });
            const data = resp.data.results || resp.data || [];

            const mapped = data.map(adv => ({
                id: `ADV-${adv.id || adv.trip.substring(4)}`,
                title: `Advance for ${adv.trip || 'Trip'}`,
                date: new Date(adv.created_at || Date.now()).toLocaleDateString(),
                amount: parseFloat(adv.requested_amount || 0),
                status: adv.status || 'Pending',
                type: 'advance',
                tripRef: adv.trip
            }));

            setAdvances(mapped);
            setPaginations(prev => ({
                ...prev,
                advances: {
                    count: resp.data.count || 0,
                    currentPage: page,
                    next: resp.data.next,
                    previous: resp.data.previous
                }
            }));
        } catch (e) {
            console.error("Error fetching advances:", e);
        }
    };

    const isActiveStatus = (status) => {
        const s = status.toLowerCase();
        return !['settled', 'rejected', 'cancelled', 'approved'].includes(s);
    };

    const filterData = (dataArray) => {
        return dataArray.filter(item =>
            viewMode === 'active' ? isActiveStatus(item.status) : !isActiveStatus(item.status)
        );
    };

    const displayTrips = filterData(trips);
    const displayAdvances = filterData(advances);
    const displayClaims = filterData(claims);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    const renderCard = (item, icon) => (
        <div key={item.id} className="req-card" onClick={() => {
            if (item.type === 'trip') navigate(`/trip-timeline/${encodeId(item.id)}`);
            if (item.type === 'travel') navigate(`/travel-timeline/${encodeId(item.id)}`);
        }}>
            <div className="card-top-row">
                <span className="req-id">{item.id}</span>
                <span className={`req-status ${item.status.toLowerCase().replace(' ', '-')}`}>{item.status}</span>
            </div>

            <div className="req-main">
                <h4>{item.title}</h4>
                <div className="req-meta">
                    <div className="meta-row">
                        <Calendar size={14} />
                        <span>{item.date}</span>
                    </div>
                </div>
            </div>

            <div className="req-footer">
                <span className="req-date">Last Updated: Today</span>
                <span className="req-amount">
                    {formatCurrency(item.amount)}
                </span>
            </div>

            {item.type === 'trip' && (
                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity right-3 bottom-3 text-primary">
                    <ArrowRight size={16} />
                </div>
            )}
        </div>
    );

    return (
        <div className={`requests-page ${enforceView ? 'pt-0 border-none px-0' : ''}`}>
            {!enforceView && (
                <div className="req-header-top">
                    <div>
                        <h1>My Requests</h1>
                    </div>

                    <div className="req-filters">
                        <button
                            className={`filter-btn ${viewMode === 'active' ? 'active' : ''}`}
                            onClick={() => setViewMode('active')}
                        >
                            <Clock size={16} /> Active Queue
                        </button>
                        <button
                            className={`filter-btn ${viewMode === 'historical' ? 'active' : ''}`}
                            onClick={() => setViewMode('historical')}
                        >
                            <CheckCircle2 size={16} /> Historical / Expired
                        </button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="loading-state h-64 flex flex-col items-center justify-center">
                    <div className="spinner mb-4"></div>
                    <p className="text-muted">Syncing your requests...</p>
                </div>
            ) : (
                <div className="requests-kanban">
                    <div className="kanban-col">
                        <div className="col-header">
                            <div className="col-header-left">
                                <Plane size={18} className="text-primary" />
                                <h3>Journey Trips</h3>
                            </div>
                            <span className="req-count">{displayTrips.length}</span>
                        </div>
                        <div className="col-body">
                            {displayTrips.length === 0 ? (
                                <div className="empty-col">
                                    <FileText size={32} opacity={0.5} />
                                    <p>No {viewMode} trip requests found.</p>
                                </div>
                            ) : (
                                displayTrips.map(trip => renderCard(trip, <Plane size={14} />))
                            )}
                        </div>
                        {paginations.trips.count > 10 && (
                            <div className="col-pagination">
                                <button disabled={!paginations.trips.previous} onClick={() => fetchTrips(paginations.trips.currentPage - 1)}>Prev</button>
                                <span>{paginations.trips.currentPage}</span>
                                <button disabled={!paginations.trips.next} onClick={() => fetchTrips(paginations.trips.currentPage + 1)}>Next</button>
                            </div>
                        )}
                    </div>

                    {/* Advances Column */}
                    <div className="kanban-col">
                        <div className="col-header">
                            <div className="col-header-left">
                                <Wallet size={18} style={{ color: '#10b981' }} />
                                <h3>Advances</h3>
                            </div>
                            <span className="req-count">{paginations.advances.count}</span>
                        </div>
                        <div className="col-body">
                            {displayAdvances.length === 0 ? (
                                <div className="empty-col">
                                    <FileText size={32} opacity={0.5} />
                                    <p>No {viewMode} advance requests found.</p>
                                </div>
                            ) : (
                                displayAdvances.map(adv => renderCard(adv, <Wallet size={14} />))
                            )}
                        </div>
                        {paginations.advances.count > 10 && (
                            <div className="col-pagination">
                                <button disabled={!paginations.advances.previous} onClick={() => fetchAdvances(paginations.advances.currentPage - 1)}>Prev</button>
                                <span>{paginations.advances.currentPage}</span>
                                <button disabled={!paginations.advances.next} onClick={() => fetchAdvances(paginations.advances.currentPage + 1)}>Next</button>
                            </div>
                        )}
                    </div>

                    {/* Claims Column */}
                    <div className="kanban-col">
                        <div className="col-header">
                            <div className="col-header-left">
                                <IndianRupee size={18} style={{ color: '#f59e0b' }} />
                                <h3>Expense Claims</h3>
                            </div>
                            <span className="req-count">{displayClaims.length}</span>
                        </div>
                        <div className="col-body">
                            {displayClaims.length === 0 ? (
                                <div className="empty-col">
                                    <FileText size={32} opacity={0.5} />
                                    <p>No {viewMode} claim requests found.</p>
                                </div>
                            ) : (
                                displayClaims.map(claim => renderCard(claim, <IndianRupee size={14} />))
                            )}
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                .col-pagination {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    background: #f8fafc;
                    border-top: 1px solid #e2e8f0;
                }
                .col-pagination button {
                    padding: 4px 10px;
                    border-radius: 6px;
                    border: 1px solid #cbd5e1;
                    background: white;
                    font-size: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                }
                .col-pagination button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .col-pagination span {
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #475569;
                }
            `}</style>
        </div>
    );
};

export default MyRequests;
