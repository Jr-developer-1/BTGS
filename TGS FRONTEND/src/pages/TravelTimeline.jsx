import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    CheckCircle2,
    Clock,
    MapPin,
    Briefcase,
    Plane,
    TrendingUp,
    ShieldCheck,
    FileText,
    CreditCard,
    Gauge,
    XCircle,
    Users,
    UserCheck,
    IndianRupee,
    AlertCircle
} from 'lucide-react';
import { decodeId, encodeId } from '../utils/idEncoder';
import api from '../api/api';
import { useToast } from '../context/ToastContext.jsx';
import './TravelTimeline.css';

const TravelTimeline = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [trip, setTrip] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (id) {
            fetchTripDetails();
        }
    }, [id]);

    const fetchTripDetails = async () => {
        setIsLoading(true);
        try {
            const decodedId = decodeId(id);
            const response = await api.get(`/api/travels/${decodedId}/`);
            setTrip(response.data);
        } catch (error) {
            console.error("Failed to fetch travel details:", error);
            showToast("Failed to load travel details", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const parseJsonField = (field) => {
        if (!field) return [];
        if (Array.isArray(field)) return field;
        if (typeof field === 'string') {
            try { return JSON.parse(field); } catch (e) { return []; }
        }
        return [];
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Build the complete timeline steps:
    //  1.  COMPLETED STEPS  – derived from lifecycle_events (history)
    //  2.  CURRENT STEP     – the active approver right now (if not closed)
    //  3.  PENDING STEPS    – remaining managers up the chain + HR + Finance + Final
    // ─────────────────────────────────────────────────────────────────────────
    const lifecycleSteps = (() => {
        if (!trip) return [];

        const recordedEvents = parseJsonField(trip.lifecycle_events) || [];
        const isClosed = ['Approved', 'Settled', 'Rejected'].includes(trip.status);
        const isRejected = trip.status === 'Rejected';
        const approvalChain = trip.approval_chain || [];
        const steps = [];

        // ── STEP 1: Request Sent (Initiator) ───────────────────────────────
        const initEvent = recordedEvents[0];
        steps.push({
            title: 'Request Sent',
            subtitle: trip.user_name || 'Requester',
            role: 'Request Initiator',
            status: 'completed',
            date: initEvent?.date
                ? new Date(initEvent.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : new Date(trip.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            description: '',
            icon: <FileText size={20} />,
        });

        if (approvalChain && approvalChain.length > 0) {
            // ── NEW LOGIC: Use approval_chain for the sequence ──────────────
            approvalChain.forEach((person, index) => {
                const nameLower = (person.name || '').toLowerCase();
                
                // ── DETERMINISTIC STATUS TRACKING ──
                // Use direct index comparison for mathematically sound tracking, 
                // supporting consecutive steps held by the same user.
                let status = 'pending';
                
                if (isClosed) {
                    if (isRejected) {
                        // If rejected at level N, then level N is rejected, < N are completed, > N are pending
                        if (index < (trip.hierarchy_level - 1)) {
                            status = 'completed';
                        } else if (index === (trip.hierarchy_level - 1)) {
                            status = 'rejected';
                        }
                    } else {
                        // Overall Approved/Settled/Completed: All managerial steps are finished
                        status = 'completed';
                    }
                } else {
                    // Ongoing approval chain
                    const currentStepIdx = Math.max(0, (trip.hierarchy_level || 1) - 1);
                    if (index < currentStepIdx) {
                        status = 'completed';
                    } else if (index === currentStepIdx) {
                        status = 'current';
                    }
                }

                let date = 'Pending';
                let description = '';
                let icon = <Clock size={20} />;

                if (status === 'completed') {
                    // Search history records to find completed timestamp
                    const approvalEvent = recordedEvents.find(e => 
                        (e.title || '').toLowerCase().includes(`approved by ${nameLower}`) ||
                        (e.description || '').toLowerCase().includes(`approved by ${nameLower}`)
                    );
                    date = approvalEvent?.date 
                        ? new Date(approvalEvent.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) 
                        : 'Completed';
                    icon = <CheckCircle2 size={20} />;
                } else if (status === 'current') {
                    date = 'Action Required';
                    icon = <Clock size={20} />;
                } else if (status === 'rejected') {
                    date = 'Rejected';
                    icon = <XCircle size={20} />;
                }

                steps.push({
                    title: person.name,
                    subtitle: person.designation || '',
                    role: person.role === 'HR' ? 'HR Verification' : 'Manager Approval',
                    status,
                    date,
                    description,
                    icon: person.role === 'HR' ? <ShieldCheck size={20} /> : <UserCheck size={20} />,
                });
            });
        } else {
            // ── LEGACY LOGIC: Fallback for old records ─────────────────────
            recordedEvents.slice(1).forEach((event) => {
                const titleLower = (event.title || '').toLowerCase();
                const descLower = (event.description || '').toLowerCase();

                let icon = <CheckCircle2 size={20} />;
                let role = 'Manager Approval';
                let eventStatus = 'completed';
                let displayTitle = event.title || 'Approved';
                let displayDesc = event.description || '';

                if (titleLower.includes('rejected') || descLower.includes('rejected by')) {
                    icon = <XCircle size={20} />;
                    role = 'Rejected';
                    eventStatus = 'rejected';
                } else if (titleLower.startsWith('hr approved by') || titleLower.includes('hr verification') || titleLower.includes('ticket booking')) {
                    icon = <ShieldCheck size={20} />;
                    role = 'HR Verification';
                    const hrMatch = (event.title || '').match(/HR Approved by (.+)/i);
                    displayTitle = hrMatch ? `HR Approved by ${hrMatch[1].trim()}` : 'HR Verified';
                } else if (titleLower.startsWith('forwarded to')) {
                    icon = <Users size={20} />;
                    role = 'Escalated';
                    displayTitle = event.title;
                } else if (titleLower.startsWith('approved by')) {
                    icon = <UserCheck size={20} />;
                    role = 'Manager Approval';
                    displayTitle = event.title;
                } else if (titleLower.includes('management approval')) {
                    const nameMatch = (event.description || '').match(/approved by ([A-Za-z\s.]+?)(?:\.|,|and|$)/i);
                    const approverName = nameMatch ? nameMatch[1].trim() : '';
                    icon = <UserCheck size={20} />;
                    role = 'Manager Approval';
                    displayTitle = approverName ? `Approved by ${approverName}` : 'Manager Approved';
                }

                steps.push({
                    title: displayTitle,
                    subtitle: '',
                    role,
                    status: eventStatus,
                    date: event.date ? new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Completed',
                    description: '',
                    icon,
                });
            });

            if (!isClosed) {
                const currentApproverName = trip.current_approver_name || 'Approving Manager';
                steps.push({
                    title: currentApproverName,
                    role: 'Manager Approval',
                    status: 'current',
                    date: 'Action Required',
                    description: '',
                    icon: <Clock size={20} />,
                });
            }
        }

        // ── FINAL STEP: Success/Approval ──────────────────────────────────
        if (trip.status === 'Approved' || trip.status === 'Settled' || trip.status === 'Completed') {
            steps.push({
                title: 'Final Approval',
                role: 'Success',
                status: 'completed',
                date: 'Success',
                description: '',
                icon: <CheckCircle2 size={20} />,
            });
        } else if (trip.status === 'Rejected') {
            steps.push({
                title: 'Rejected',
                subtitle: trip.rejected_by || '',
                role: 'Rejected',
                status: 'rejected',
                date: 'Rejected',
                description: '',
                icon: <XCircle size={20} />,
            });
        } else {
            steps.push({
                title: 'Final Approval',
                role: 'Endpoint',
                status: 'pending',
                date: 'Endpoint',
                description: '',
                icon: <CheckCircle2 size={20} />,
            });
        }

        return steps;
    })();

    useEffect(() => {
        if (trip && trip.trip_id) {
            const encoded = encodeId(trip.trip_id);
            if (id === trip.trip_id && id !== encoded) {
                navigate(`/travel-timeline/${encoded}`, { replace: true });
            }
        }
    }, [trip, id, navigate]);

    if (isLoading) {
        return (
            <div className="timeline-page-loading">
                <div className="spinner"></div>
                <p>Loading Travel Timeline...</p>
            </div>
        );
    }

    if (!trip) {
        return (
            <div className="timeline-page-error">
                <h2>Travel Not Found</h2>
                <button onClick={() => navigate('/trips')}>Back to Trips</button>
            </div>
        );
    }

    // ── Status colour map ──
    const statusColors = {
        'Pending':          '#f59e0b',
        'Forwarded':        '#3b82f6',
        'Manager Approved': '#8b5cf6',
        'HR Approved':      '#14b8a6',
        'Approved':         '#10b981',
        'Rejected':         '#ef4444',
        'Settled':          '#6366f1',
    };
    const headerColor = statusColors[trip.status] || '#4f46e5';

    const nodeColors = ['#f59e0b', '#4f46e5', '#ec4899', '#10b981', '#3b82f6', '#14b8a6', '#8b5cf6', '#f97316', '#84cc16'];

    return (
        <div className="timeline-page-container animate-fade-in">
            <header className="timeline-header">
                <button className="back-btn" onClick={() => navigate('/trips')}>
                    <ChevronLeft size={24} />
                    <span>Back to Trips</span>
                </button>
                <div className="header-main">
                    <div className="trip-id-badge">{trip.trip_id}</div>
                    <h1>Approval Timeline</h1>
                    <p>{trip.purpose}{trip.destination ? ` • ${trip.destination}` : ''}</p>
                </div>
                <div className="header-stats">
                    <div className="h-stat">
                        <label>Status</label>
                        <span className={`status-pill ${trip.status?.toLowerCase()}`} style={{ backgroundColor: headerColor }}>{trip.status}</span>
                    </div>
                    <div className="h-stat">
                        <label>Travel Dates</label>
                        <div className="date-display-styled">
                            <span className="date-start">{trip.start_date}</span>
                            <span className="date-separator">to</span>
                            <span className="date-end">{trip.end_date}</span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="timeline-layout" style={{ gridTemplateColumns: '1fr' }}>
                <main className="timeline-content-main">
                    <div className="timeline-zigzag-wrapper">
                        <div className="timeline-zigzag-container">
                            <div className="zigzag-line-main"></div>
                            {lifecycleSteps.map((step, index) => {
                                const isEven = index % 2 === 0;
                                const themeColor = step.status === 'rejected'
                                    ? '#ef4444'
                                    : step.status === 'pending'
                                        ? '#cbd5e1'
                                        : nodeColors[index % nodeColors.length];

                                return (
                                    <div key={index} className={`zigzag-node ${step.status}`}>
                                        <div className="zigzag-column">
                                            {isEven ? (
                                                <>
                                                    <div className="zigzag-section top-section align-bottom">
                                                        <div className="node-date-box">{step.date}</div>
                                                        <div className="node-text">
                                                            <h4>{step.title}</h4>
                                                            {step.subtitle && <span>{step.subtitle}</span>}
                                                            <div className="zigzag-status-badge" style={{ 
                                                                background: step.status === 'completed' ? `${themeColor}15` : 
                                                                           step.status === 'current' ? '#fee2e2' : '#f1f5f9',
                                                                color: step.status === 'completed' ? themeColor : 
                                                                       step.status === 'current' ? '#ef4444' : '#64748b'
                                                            }}>
                                                                {step.role}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="zigzag-center">
                                                        <div className="node-icon-circle" style={{ backgroundColor: themeColor }}>{step.icon}</div>
                                                    </div>
                                                    <div className="zigzag-section bottom-section align-top"></div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="zigzag-section top-section align-bottom"></div>
                                                    <div className="zigzag-center">
                                                        <div className="node-icon-circle" style={{ backgroundColor: themeColor }}>{step.icon}</div>
                                                    </div>
                                                    <div className="zigzag-section bottom-section align-top">
                                                        <div className="node-text">
                                                            <div className="zigzag-status-badge" style={{ 
                                                                background: step.status === 'completed' ? `${themeColor}15` : 
                                                                           step.status === 'current' ? '#fee2e2' : '#f1f5f9',
                                                                color: step.status === 'completed' ? themeColor : 
                                                                       step.status === 'current' ? '#ef4444' : '#64748b'
                                                            }}>
                                                                {step.role}
                                                            </div>
                                                            <h4>{step.title}</h4>
                                                            {step.subtitle && <span>{step.subtitle}</span>}
                                                        </div>
                                                        <div className="node-date-box">{step.date}</div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {lifecycleSteps.some(step => step.status === 'current') && (
                        <div className="active-action-box" style={{ margin: '0 2rem' }}>
                            <div className="action-info">
                                <Plane size={20} />
                                <span>This is your current stage. Please complete the necessary steps to proceed.</span>
                            </div>
                            <button className="btn-action-primary" onClick={() => navigate('/trips')}>
                                Go to Actions
                            </button>
                        </div>
                    )}

                    {trip.status === 'Rejected' && trip.rejection_reason && (
                        <div style={{
                            margin: '1rem 2rem',
                            padding: '1rem 1.5rem',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '12px',
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'flex-start',
                        }}>
                            <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div>
                                <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: '4px' }}>Rejection Reason</div>
                                <div style={{ color: '#7f1d1d', fontSize: '0.85rem' }}>{trip.rejection_reason}</div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default TravelTimeline;
