import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { encodeId } from '../utils/idEncoder';
import api from '../api/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
    MapPin,
    Search,
    Plus,
    X,
    Edit,
    Trash2,
    ArrowLeft,
    Phone,
    Calendar,
    Save,
    ChevronDown,
    Lock,
    Mail,
    Car,
    CarFront,
    Contact,
    Fuel,
    LocateFixed,
    Shield
} from 'lucide-react';
import Modal from '../components/Modal';

const Fleet = () => {
    const { showToast } = useToast();
    const { user } = useAuth();

    const userRole = (user?.role || 'employee').toLowerCase();
    const isAdmin = userRole === 'admin' || user?.is_superuser || userRole === 'guesthouse_manager';

    const [fleetHubs, setFleetHubs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: null, id: null, title: '', message: '' });
    const [formErrors, setFormErrors] = useState({});
    const hubImageInputRef = useRef(null);

    const validateHubForm = () => {
        const errors = {};
        if (!hubFormData.name || hubFormData.name.length < 3) errors.name = "Hub name is too short (min 3 chars)";
        if (!hubFormData.address || hubFormData.address.length < 10) errors.address = "Address is required (min 10 chars)";
        if (!hubFormData.pincode || !/^\d{6}$/.test(hubFormData.pincode)) errors.pincode = "Invalid 6-digit pincode";
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateItemForm = () => {
        const errors = {};
        if (activeTab === 'vehicles') {
            if (!itemFormData.plate_number || !/^[A-Z]{2}\s\d{2}\s[A-Z]{1,2}\s\d{4}$/.test(itemFormData.plate_number.toUpperCase()) && !/^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/.test(itemFormData.plate_number.toUpperCase())) {
                // errors.plate_number = "Format: XX 00 XX 0000"; // Lax validation for now as some might be different
            }
            if (!itemFormData.plate_number) errors.plate_number = "Plate number is required";
            if (!itemFormData.name) errors.name = "Model name is required";
        } else {
            if (!itemFormData.name || itemFormData.name.length < 3) errors.name = "Name is required";
            if (!itemFormData.phone || !/^\d{10}$/.test(itemFormData.phone)) errors.phone = "Invalid 10-digit phone number";
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Delete handlers for vehicles and drivers
    const handleEditItem = (item) => {
        setEditingItemId(item.id);
        const isVehicle = activeTab === 'vehicles';
        setItemFormData({
            plate_number: item.plate_number || '',
            name: isVehicle ? item.model_name : item.name,
            type: item.vehicle_type || 'sedan',
            fuel_type: item.fuel_type || 'diesel',
            capacity: item.capacity || 4,
            phone: item.phone || '',
            license_number: item.license_number || '',
            status: item.status || 'Available',
            hubId: selectedHub?.id || ''
        });
        setHubSearchQuery('');
        setSuggestedHub(null);
        setShowCreateHubPrompt(false);
        setFormErrors({});
        setShowItemModal(true);
    };

    const handleDeleteItem = (itemId) => {
        const itemType = activeTab === 'vehicles' ? 'Vehicle' : 'Driver';
        setDeleteModal({
            isOpen: true,
            type: activeTab,
            id: itemId,
            title: `Delete ${itemType}?`,
            message: `Are you sure you want to remove this ${itemType.toLowerCase()} from the fleet?`
        });
    };

    const getApiErrorMessage = (error, fallback = 'An error occurred') => {
        const payload = error?.response?.data;
        if (!payload) return error?.message || fallback;
        if (typeof payload === 'string') return payload;
        if (payload.error && typeof payload.error === 'string') return payload.error;
        if (typeof payload === 'object') {
            const firstKey = Object.keys(payload)[0];
            const firstValue = payload[firstKey];
            if (Array.isArray(firstValue) && firstValue.length) return `${firstKey}: ${firstValue[0]}`;
            if (typeof firstValue === 'string') return `${firstKey}: ${firstValue}`;
        }
        return fallback;
    };

    const getGoogleMapsUrl = (hub) => {
        if (!hub) return null;
        const lat = Number(hub.latitude);
        const lng = Number(hub.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        }
        const addressQuery = [hub.address, hub.location, hub.pincode].filter(Boolean).join(', ').trim();
        if (addressQuery) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery)}`;
        return null;
    };

    const openHubInMaps = (hub) => {
        const mapsUrl = getGoogleMapsUrl(hub);
        if (!mapsUrl) {
            showToast('Location not available.', 'warning');
            return;
        }
        window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    };

    const toTitleCase = (value) => {
        if (!value) return '';
        const normalized = String(value).replace(/_/g, ' ').trim().toLowerCase();
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    };

    // Compute real-time occupancy from booking dates
    const getVehicleLiveStatus = (vehicle) => {
        const todayStr = new Date().toISOString().slice(0, 10);

        const fmt = (d) => {
            const [, m, day] = d.slice(0, 10).split('-');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${parseInt(day)} ${months[parseInt(m) - 1]}`;
        };

        // 1. Active booking (today is within the window)
        const activeBooking = (vehicle.bookings || []).find(b =>
            b.start_date && b.end_date &&
            todayStr >= b.start_date.slice(0, 10) &&
            todayStr <= b.end_date.slice(0, 10)
        );
        if (activeBooking) {
            return {
                liveStatus: 'Occupied',
                activePeriod: `${fmt(activeBooking.start_date)} \u2013 ${fmt(activeBooking.end_date)}`,
                requesterName: activeBooking.requester_name || ''
            };
        }

        // 2. Upcoming booking (starts in the future)
        const upcoming = [...(vehicle.bookings || [])]
            .filter(b => b.start_date && b.start_date.slice(0, 10) > todayStr)
            .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
        if (upcoming) {
            return {
                liveStatus: 'Booked',
                activePeriod: `From ${fmt(upcoming.start_date)} \u2013 ${fmt(upcoming.end_date)}`,
                requesterName: upcoming.requester_name || ''
            };
        }

        return { liveStatus: 'Available', activePeriod: null, requesterName: null };
    };

    const normalizeHub = (hub) => ({
        ...hub,
        isActive: hub.is_active,
        vehicles: (hub.vehicles || []).map(v => {
            const { liveStatus, activePeriod, requesterName } = getVehicleLiveStatus(v);
            return {
                ...v,
                name: v.plate_number,
                type: toTitleCase(v.vehicle_type || 'sedan'),
                status: liveStatus,          // live computed status
                activePeriod,
                requesterName
            };
        }),
        drivers: (hub.drivers || []).map(d => ({ ...d, name: d.name }))
    });

    const mapBookingsToEvents = (hub) => {
        const events = [];
        (hub?.vehicles || []).forEach(vehicle => {
            (vehicle.bookings || []).forEach(booking => {
                const startDate = booking.start_date;
                const endDate = booking.end_date;
                events.push({
                    id: booking.id,
                    vehicleId: vehicle.id,
                    plateNumber: vehicle.plate_number,
                    status: booking.booking_type || 'Official',
                    startDate,
                    endDate,
                    details: booking.requester_name || '-',
                    checkIn: new Date(startDate).toLocaleDateString(),
                    checkOut: new Date(endDate).toLocaleDateString(),
                    remarks: booking.remarks || ''
                });
            });
        });
        return events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    };

    const fetchHubs = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/api/fleet/hub/');
            const normalized = response.data.map(normalizeHub);
            setFleetHubs(normalized);
        } catch (err) {
            showToast("Failed to load fleet hubs", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) fetchHubs();
    }, [isAdmin]);

    const [selectedHub, setSelectedHub] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState('vehicles');
    const [fleetRequests, setFleetRequests] = useState([]);

    const fetchFleetRequests = async () => {
        try {
            const response = await api.get('/api/trips/?all=true');
            const trips = Array.isArray(response.data) ? response.data : (response.data.results || []);
            const requests = trips.filter(t =>
                t.accommodation_requests &&
                t.accommodation_requests.includes('Request for Company Vehicle') &&
                !t.has_vehicle_booking
            );
            setFleetRequests(requests);
        } catch (err) { }
    };

    const handleNoVehicleNotify = async (req) => {
        try {
            await api.post('/api/notifications/', {
                title: 'No Vehicle Available',
                message: `No company vehicle is available at your destination (${req.destination}) for trip ${req.trip_id}. Please arrange alternate transport or contact the fleet manager.`,
                type: 'info',
                trip_id: req.trip_id,
                user: req.user
            });

            // Update trip to remove the vehicle request so it doesn't show up again
            const updatedAcc = (req.accommodation_requests || []).filter(item => item !== 'Request for Company Vehicle');
            await api.patch(`/api/trips/${req.trip_id}/`, {
                accommodation_requests: updatedAcc
            });

            showToast(`Employee informed and request cleared`, 'warning');
            fetchFleetRequests();
        } catch (err) {
            showToast('Failed to process request', 'error');
        }
    };

    useEffect(() => {
        if (activeTab === 'requests') fetchFleetRequests();
    }, [activeTab]);

    const [assignModal, setAssignModal] = useState({ open: false, trip: null });
    const [assignForm, setAssignForm] = useState({ vehicleId: '', driverId: '', startDate: '', endDate: '', remarks: '' });
    const [allVehicles, setAllVehicles] = useState([]);
    const [allDrivers, setAllDrivers] = useState([]);

    const openAssignModal = (trip) => {
        const vehicles = fleetHubs.flatMap(h => h.vehicles || []);
        const drivers = fleetHubs.flatMap(h => h.drivers || []);
        setAllVehicles(vehicles);
        setAllDrivers(drivers);
        setAssignForm({ vehicleId: '', driverId: '', startDate: trip.start_date, endDate: trip.end_date, remarks: '' });
        setAssignModal({ open: true, trip });
    };

    const handleAssignVehicle = async () => {
        const { trip } = assignModal;
        if (!assignForm.vehicleId || !assignForm.startDate || !assignForm.endDate) {
            showToast('Please select a vehicle and dates.', 'error');
            return;
        }
        try {
            await api.post(`/api/fleet/vehicles/${assignForm.vehicleId}/bookings/`, {
                trip: trip.trip_id,
                driver: assignForm.driverId || null,
                booking_type: 'Official',
                start_date: assignForm.startDate,
                end_date: assignForm.endDate,
                requester_name: trip.trip_leader,
                remarks: assignForm.remarks
            });
            showToast('Vehicle assigned! Employee notified.', 'success');
            setAssignModal({ open: false, trip: null });
            fetchFleetRequests();
        } catch (err) {
            showToast(getApiErrorMessage(err, 'Failed to assign vehicle'), 'error');
        }
    };

    const [showHubModal, setShowHubModal] = useState(false);
    const [showItemModal, setShowItemModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editingItemId, setEditingItemId] = useState(null);

    const [hubFormData, setHubFormData] = useState({
        name: '', address: '', location: '', pincode: '', isActive: true, latitude: '', longitude: '', image: '', description: ''
    });

    const [itemFormData, setItemFormData] = useState({
        name: '', type: 'sedan', phone: '', status: 'Available', fuel_type: 'diesel', capacity: 4, plate_number: '', license_number: '', hubId: ''
    });

    // Hub transfer state
    const [hubSearchQuery, setHubSearchQuery] = useState('');
    const [suggestedHub, setSuggestedHub] = useState(null);   // matched existing hub
    const [showCreateHubPrompt, setShowCreateHubPrompt] = useState(false);
    const [newHubForTransfer, setNewHubForTransfer] = useState({ name: '', address: '', pincode: '' });

    const handleHubSearch = (query) => {
        setHubSearchQuery(query);
        setShowCreateHubPrompt(false);
        setSuggestedHub(null);
        if (!query.trim()) { setItemFormData(p => ({ ...p, hubId: selectedHub?.id || '' })); return; }
        const match = fleetHubs.find(h => h.name.toLowerCase().includes(query.toLowerCase()));
        if (match) {
            setSuggestedHub(match);
            setItemFormData(p => ({ ...p, hubId: match.id }));
        } else {
            setShowCreateHubPrompt(true);
            setNewHubForTransfer({ name: query, address: '', pincode: '' });
        }
    };

    const handleTransferHubCreate = async () => {
        if (!newHubForTransfer.name || !newHubForTransfer.address || !newHubForTransfer.pincode) {
            showToast('Please fill Hub name, address and pincode.', 'error');
            return;
        }
        try {
            const res = await api.post('/api/fleet/hub/', {
                name: newHubForTransfer.name,
                address: newHubForTransfer.address,
                location: newHubForTransfer.address,
                pincode: newHubForTransfer.pincode,
                is_active: true
            });
            const createdHub = normalizeHub(res.data);
            setFleetHubs(prev => [...prev, createdHub]);
            setSuggestedHub(createdHub);
            setItemFormData(p => ({ ...p, hubId: createdHub.id }));
            setShowCreateHubPrompt(false);
            showToast(`Hub "${createdHub.name}" created!`, 'success');
        } catch (err) {
            showToast(getApiErrorMessage(err, 'Failed to create hub'), 'error');
        }
    };

    const [showBookingModal, setShowBookingModal] = useState(false);
    const [bookingTab, setBookingTab] = useState('Official');
    const [tripSearch, setTripSearch] = useState('');
    const [showTripResults, setShowTripResults] = useState(false);
    const [trips, setTrips] = useState([]);
    const [isLoadingTrips, setIsLoadingTrips] = useState(false);
    const inputRef = useRef(null);

    const [bookingData, setBookingData] = useState({
        vehicleId: '', plateNumber: '', status: 'Confirmed', employeeName: '', tripId: '', checkInDate: '', checkOutDate: '', remarks: ''
    });

    const [currentDate, setCurrentDate] = useState(new Date());
    const realToday = new Date();
    realToday.setHours(0, 0, 0, 0);

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const changeMonth = (offset) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    };

    const handleHubInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setHubFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleEditHub = (hub) => {
        setEditingId(hub.id);
        setHubFormData({
            name: hub.name,
            address: hub.address,
            location: hub.location || '',
            pincode: hub.pincode,
            isActive: hub.isActive,
            latitude: hub.latitude || '',
            longitude: hub.longitude || '',
            image: hub.image || '',
            description: hub.description || ''
        });
        setFormErrors({});
        setShowHubModal(true);
    };

    const handleDeleteHub = (hub) => {
        setDeleteModal({
            isOpen: true,
            type: 'hub',
            id: hub.id,
            title: 'Delete Fleet Hub?',
            message: `Deleting "${hub.name}" will remove all its vehicles and drivers. This action is irreversible.`
        });
    };

    const confirmDelete = async () => {
        const { type, id } = deleteModal;
        try {
            if (type === 'hub') {
                await api.delete(`/api/fleet/hub/${id}/`);
                setFleetHubs(prev => prev.filter(h => h.id !== id));
                showToast('Hub deleted successfully', 'success');
            } else if (type === 'vehicles' || type === 'drivers') {
                const endpoint = type === 'vehicles' ? 'vehicles' : 'drivers';
                await api.delete(`/api/fleet/items/${endpoint}/${id}/`);
                if (selectedHub) {
                    const res = await api.get(`/api/fleet/hub/${selectedHub.id}/`);
                    setSelectedHub(normalizeHub(res.data));
                }
                showToast(`${type === 'vehicles' ? 'Vehicle' : 'Driver'} removed`, 'success');
            }
            setDeleteModal({ isOpen: false });
            fetchHubs();
        } catch (err) {
            showToast(getApiErrorMessage(err, 'Failed to delete'), 'error');
        }
    };

    const handleSaveHub = () => {
        if (!validateHubForm()) return;

        const payload = {
            name: hubFormData.name,
            address: hubFormData.address,
            location: hubFormData.location || hubFormData.address,
            pincode: hubFormData.pincode,
            is_active: hubFormData.isActive,
            latitude: hubFormData.latitude || null,
            longitude: hubFormData.longitude || null,
            image: hubFormData.image || null,
            description: hubFormData.description || ''
        };

        const promise = editingId ? api.put(`/api/fleet/hub/${editingId}/`, payload) : api.post('/api/fleet/hub/', payload);
        promise.then(res => {
            fetchHubs();
            setShowHubModal(false);
            showToast(editingId ? 'Hub updated successfully' : 'New hub created', 'success');
        }).catch(err => showToast(getApiErrorMessage(err), 'error'));
    };

    const handleAddItem = () => {
        setEditingItemId(null);
        setItemFormData({
            name: '',
            type: 'sedan',
            phone: '',
            status: 'Available',
            fuel_type: 'diesel',
            capacity: 4,
            plate_number: '',
            license_number: '',
            hubId: selectedHub?.id || ''
        });
        setFormErrors({});
        setShowItemModal(true);
    };

    const handleSaveItem = async () => {
        if (!validateItemForm()) return;

        const isVehicle = activeTab === 'vehicles';
        const endpoint = isVehicle ? 'vehicles' : 'drivers';
        const targetHubId = itemFormData.hubId || selectedHub?.id;

        const payload = isVehicle ? {
            plate_number: itemFormData.plate_number,
            model_name: itemFormData.name,
            vehicle_type: itemFormData.type,
            fuel_type: itemFormData.fuel_type,
            capacity: parseInt(itemFormData.capacity),
            status: itemFormData.status.toLowerCase(),
            hub: targetHubId
        } : {
            name: itemFormData.name,
            phone: itemFormData.phone,
            license_number: itemFormData.license_number,
            status: itemFormData.status,
            hub: targetHubId
        };

        try {
            const promise = editingItemId
                ? api.put(`/api/fleet/items/${endpoint}/${editingItemId}/`, payload)
                : api.post(`/api/fleet/items/${endpoint}/`, payload);
            await promise;

            showToast(editingItemId ? 'Item updated' : 'Added successfully', 'success');

            if (selectedHub) {
                const res = await api.get(`/api/fleet/hub/${selectedHub.id}/`);
                setSelectedHub(normalizeHub(res.data));
            }
            fetchHubs();
            setShowItemModal(false);
            setHubSearchQuery(''); setSuggestedHub(null); setShowCreateHubPrompt(false);
        } catch (err) {
            showToast(getApiErrorMessage(err), 'error');
        }
    };

    const renderTabContent = () => {
        if (activeTab === 'requests') {
            return (
                <div className="gh-list-section">
                    <div className="gh-sub-header"><h3>Employee Fleet Requests</h3><button className="btn-refresh-pill" onClick={fetchFleetRequests}>REFRESH</button></div>
                    <div className="gh-item-list">
                        {fleetRequests.length > 0 ? fleetRequests.map(req => {
                            // Match destination to a hub by location/address (same as GH pattern)
                            const matchingHub = fleetHubs.find(h =>
                                h.location?.toLowerCase().includes(req.destination?.toLowerCase()) ||
                                h.address?.toLowerCase().includes(req.destination?.toLowerCase()) ||
                                req.destination?.toLowerCase().includes(h.name?.toLowerCase()) ||
                                req.destination?.toLowerCase().includes(h.location?.toLowerCase())
                            );

                            // Check if matching hub has at least 1 available vehicle
                            const hasAvailableVehicle = matchingHub &&
                                (matchingHub.vehicles || []).some(v => (v.status || '').toLowerCase() === 'available');

                            return (
                                <div key={req.trip_id} className="gh-list-item request-card-premium">
                                    <div className="item-info">
                                        <div className="request-header" style={{ marginBottom: '8px' }}>
                                            <span className="trip-id-tag-mini">{req.trip_id}</span>
                                            <span className={`badge ${hasAvailableVehicle ? 'pending' : 'rejected'}`} style={{ fontSize: '10px', padding: '4px 8px' }}>
                                                {hasAvailableVehicle ? 'VEHICLE AVAILABLE' : 'NO VEHICLE FOUND'}
                                            </span>
                                        </div>
                                        <h4 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{req.trip_leader} - {req.purpose}</h4>
                                        <div className="request-meta-grid">
                                            <div className="meta-item"><MapPin size={14} /> <span>Dest: {req.destination}</span></div>
                                            <div className="meta-item"><Calendar size={14} /> <span>{req.start_date} - {req.end_date}</span></div>
                                        </div>
                                        {matchingHub && (
                                            <p className="request-note">Hub: {matchingHub.name} — {matchingHub.address}</p>
                                        )}
                                    </div>
                                    <div className="actions-cell-vertical">
                                        {hasAvailableVehicle ? (
                                            <button className="btn-primary-mini" onClick={() => openAssignModal(req)}>Assign Vehicle</button>
                                        ) : (
                                            <button className="btn-danger-mini" onClick={() => handleNoVehicleNotify(req)}>Inform: No Vehicle at Location</button>
                                        )}
                                    </div>
                                </div>
                            );
                        }) : <div className="empty-state-vsmall mt-4"><p>No active fleet requests.</p></div>}
                    </div>
                </div>
            );
        }

        if (!selectedHub) return null;
        const list = selectedHub[activeTab] || [];
        return (
            <div className="gh-list-section">
                <div className="gh-sub-header">
                    <h3>{toTitleCase(activeTab)} List</h3>
                    <button className="btn-add-item" onClick={handleAddItem}><Plus size={16} /> Add {activeTab === 'vehicles' ? 'Vehicle' : 'Driver'}</button>
                </div>
                <div className="gh-item-list">
                    {list.map(item => {
                        const liveStatusLower = (item.status || 'available').toLowerCase();
                        const badgeClass = liveStatusLower === 'occupied' ? 'rejected'
                            : liveStatusLower === 'booked' ? 'pending'
                                : 'available';
                        return (
                            <div key={item.id} className={`gh-list-item ${activeTab === 'vehicles' && liveStatusLower !== 'available' ? 'occupied-vehicle-card' : ''}`}>
                                <div className="item-info">
                                    <h4>{item.plate_number || item.name} {activeTab === 'vehicles' && `- ${item.model_name}`}</h4>
                                    <div className="item-badges">
                                        <span className={`badge ${activeTab === 'vehicles' ? badgeClass : liveStatusLower}`}>
                                            {item.status || 'Available'}
                                        </span>
                                        {item.vehicle_type && <span className="badge single">{toTitleCase(item.vehicle_type)}</span>}
                                        {item.fuel_type && <span className="badge open">{toTitleCase(item.fuel_type)}</span>}
                                    </div>
                                    {activeTab === 'vehicles' && item.activePeriod && (
                                        <div className="contacts-info" style={{ marginTop: '4px', color: liveStatusLower === 'occupied' ? 'var(--error, #e53e3e)' : 'var(--warning, #d97706)', fontWeight: 500 }}>
                                            <Calendar size={12} />
                                            <span>{item.activePeriod}{item.requesterName ? ` — ${item.requesterName}` : ''}</span>
                                        </div>
                                    )}
                                    {item.phone && <p className="contacts-info"><Phone size={12} /> {item.phone}</p>}
                                </div>
                                <div className="actions-cell">
                                    <button className="icon-btn-small" onClick={() => handleEditItem(item)} title="Edit">
                                        <Edit size={16} />
                                    </button>
                                    <button className="icon-btn-small delete" onClick={() => handleDeleteItem(item.id)} title="Delete">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {list.length === 0 && (
                        <div className="empty-state-card-vsmall">
                            <Shield size={32} className="mb-1" style={{ opacity: 0.3 }} />
                            <p>No {activeTab} available in this hub yet.</p>
                            <button className="btn-secondary-mini mt-1" onClick={handleAddItem}>Add Now</button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (!isAdmin) {
        return (
            <div className="gh-page">
                <div className="premium-card gh-access-denied-card">
                    <Lock size={48} color="var(--primary)" className="mb-1" />
                    <h2>Access Denied</h2>
                    <p>Only Administrators or Fleet Managers can access this system.</p>
                </div>
            </div>
        );
    }

    const filteredHubs = fleetHubs.filter(h => h.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="gh-page animate-fade-in">
            {selectedHub ? (
                <>
                    <div className="gh-details-header">
                        <div className="gh-details-left">
                            <button className="gh-back-btn" onClick={() => setSelectedHub(null)}><ArrowLeft size={16} /> Back</button>
                            <div className="gh-details-title"><h1>{selectedHub.name}</h1><p><MapPin size={14} /> {selectedHub.address}</p></div>
                        </div>
                        <div className="gh-map-preview" onClick={() => openHubInMaps(selectedHub)}>
                            {selectedHub.image ? <img src={selectedHub.image} alt="Hub" /> : <Car size={40} />}
                        </div>
                    </div>
                    <div className="gh-tabs">
                        {[
                            { id: 'vehicles', icon: CarFront, label: 'Vehicles' },
                            { id: 'drivers', icon: Contact, label: 'Drivers' },
                            { id: 'requests', icon: Mail, label: 'Fleet Requests' }
                        ].map(t => (
                            <button key={t.id} className={`gh-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}><t.icon size={16} /> {t.label}</button>
                        ))}
                    </div>
                    {renderTabContent()}
                </>
            ) : (
                <>
                    <div className="gh-header-section">
                        <div className="header-left">
                            <h1 className="welcome-text">Vehicle Management</h1>
                        </div>
                        <button className="btn-primary" onClick={() => { setEditingId(null); setHubFormData({ name: '', address: '', location: '', pincode: '', isActive: true, latitude: '', longitude: '', image: '', description: '' }); setShowHubModal(true); }}>
                            <Plus size={18} /> Add New Vehicle
                        </button>
                    </div>
                    <div className="gh-search-bar premium-card">
                        <Search size={20} className="search-icon" />
                        <input type="text" placeholder="Search hubs by name or location..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                    <div className="gh-grid-list">
                        {filteredHubs.length > 0 ? filteredHubs.map(hub => (
                            <div key={hub.id} className="gh-card-item premium-card cursor-pointer" onClick={() => setSelectedHub(hub)}>
                                <div className="gh-card-map-placeholder">
                                    {hub.image ? <img src={hub.image} alt="Hub" className="gh-card-image" /> : <LocateFixed size={32} className="gh-placeholder-icon" />}
                                    <span className={`status-badge ${hub.isActive ? 'active' : 'inactive'}`}>{hub.isActive ? 'Active' : 'Standby'}</span>

                                    <div className="card-actions-overlay">
                                        <button className="action-circle-btn edit" onClick={(e) => { e.stopPropagation(); handleEditHub(hub); }} title="Edit Hub">
                                            <Edit size={16} />
                                        </button>
                                        <button className="action-circle-btn delete" onClick={(e) => { e.stopPropagation(); handleDeleteHub(hub); }} title="Delete Hub">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="gh-card-details">
                                    <div className="hub-header-row">
                                        <h3>{hub.name}</h3>
                                        <ArrowLeft size={16} className="hub-arrow" style={{ transform: 'rotate(180deg)', opacity: 0.3 }} />
                                    </div>
                                    <div className="hub-meta-info">
                                        {hub.location && <p className="gh-address"><MapPin size={12} /> {hub.location}</p>}
                                        <div className="gh-stats">
                                            <div className="stat-item"><CarFront size={14} /> <span>{hub.vehicles?.length || 0} Vehicles</span></div>
                                            <div className="stat-item"><Contact size={14} /> <span>{hub.drivers?.length || 0} Drivers</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="no-data-full-page animate-fade-in">
                                <div className="no-data-inner">
                                    <div className="no-data-icon-box">
                                        <Shield size={64} />
                                    </div>
                                    <h2>No Vehicles Found</h2>
                                    {/* <p>We couldn't find any vehicle matching your search. Try adjusting your query or click below to create a new hub.</p> */}
                                    <button className="btn-primary" onClick={() => { setEditingId(null); setShowHubModal(true); }}>
                                        <Plus size={18} /> Add New Vehicle
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {showHubModal && (
                <div className="modal-overlay">
                    <div className="modal-content gh-modal premium-card" style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2>{editingId ? 'Edit' : 'Add'} Fleet Hub</h2>
                            <button onClick={() => setShowHubModal(false)} className="close-btn"><X size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid">
                                <div className="form-group full">
                                    <label>Hub Name*</label>
                                    <input className={`input-field ${formErrors.name ? 'error' : ''}`} name="name" value={hubFormData.name} onChange={handleHubInputChange} placeholder="e.g. Hyderabad Main Hub" />
                                    {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                                </div>
                                <div className="form-group full">
                                    <label>Full Address*</label>
                                    <textarea className={`input-field ${formErrors.address ? 'error' : ''}`} name="address" rows={2} value={hubFormData.address} onChange={handleHubInputChange} placeholder="Street address, landmark, city..." />
                                    {formErrors.address && <span className="error-text">{formErrors.address}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Pincode*</label>
                                    <input className={`input-field ${formErrors.pincode ? 'error' : ''}`} name="pincode" value={hubFormData.pincode} onChange={handleHubInputChange} maxLength={6} placeholder="6-digit code" />
                                    {formErrors.pincode && <span className="error-text">{formErrors.pincode}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Status</label>
                                    <div className="toggle-switch-group">
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: hubFormData.isActive ? 'var(--success)' : 'var(--text-muted)' }}>{hubFormData.isActive ? 'Active' : 'Standby'}</span>
                                        <label className="toggle-switch">
                                            <input type="checkbox" name="isActive" checked={hubFormData.isActive} onChange={handleHubInputChange} />
                                            <span className="slider round"></span>
                                        </label>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Latitude (optional)</label>
                                    <input className="input-field" name="latitude" value={hubFormData.latitude} onChange={handleHubInputChange} placeholder="e.g. 17.3850" />
                                </div>
                                <div className="form-group">
                                    <label>Longitude (optional)</label>
                                    <input className="input-field" name="longitude" value={hubFormData.longitude} onChange={handleHubInputChange} placeholder="e.g. 78.4867" />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowHubModal(false)}>Cancel</button>
                            <button className="btn-primary" onClick={handleSaveHub}><Save size={18} /> {editingId ? 'Update Hub' : 'Create Hub'}</button>
                        </div>
                    </div>
                </div>
            )}

            {showItemModal && (
                <div className="modal-overlay">
                    <div className="modal-content gh-modal premium-card">
                        <div className="modal-header"><h2>{editingItemId ? 'Edit' : 'Add'} {activeTab === 'vehicles' ? 'Vehicle' : 'Driver'}</h2><button onClick={() => setShowItemModal(false)} className="close-btn"><X size={20} /></button></div>
                        <div className="modal-body">
                            {activeTab === 'vehicles' ? (
                                <>
                                    <div className="form-group">
                                        <label>Plate Number*</label>
                                        <input className={`input-field ${formErrors.plate_number ? 'error' : ''}`} value={itemFormData.plate_number} onChange={e => setItemFormData({ ...itemFormData, plate_number: e.target.value })} placeholder="e.g. TS 09 EA 1234" />
                                        {formErrors.plate_number && <span className="error-text">{formErrors.plate_number}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label>Model Name*</label>
                                        <input className={`input-field ${formErrors.name ? 'error' : ''}`} value={itemFormData.name} onChange={e => setItemFormData({ ...itemFormData, name: e.target.value })} placeholder="e.g. Toyota Innova" />
                                        {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group" style={{ flex: 1 }}>
                                            <label>Vehicle Type</label>
                                            <select className="input-field" value={itemFormData.type} onChange={e => setItemFormData({ ...itemFormData, type: e.target.value })}>
                                                <option value="sedan">Sedan (4 to 5)</option>
                                                <option value="suv">SUV (6 to 7)</option>
                                                <option value="pickup">Pickup</option>
                                                <option value="ambulance">Ambulance</option>
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ flex: 1 }}>
                                            <label>Fuel Type</label>
                                            <select className="input-field" value={itemFormData.fuel_type} onChange={e => setItemFormData({ ...itemFormData, fuel_type: e.target.value })}>
                                                <option value="diesel">Diesel</option>
                                                <option value="petrol">Petrol</option>
                                                <option value="ev">Electric</option>
                                                <option value="cng">CNG</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group" style={{ flex: 1 }}>
                                            <label>Capacity</label>
                                            <input type="number" className="input-field" value={itemFormData.capacity} onChange={e => setItemFormData({ ...itemFormData, capacity: e.target.value })} min={1} max={20} />
                                        </div>
                                        <div className="form-group" style={{ flex: 1 }}>
                                            <label>Status</label>
                                            <select className="input-field" value={itemFormData.status} onChange={e => setItemFormData({ ...itemFormData, status: e.target.value })}>
                                                <option value="Available">Available</option>
                                                <option value="Maintenance">Maintenance</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Hub / Location Transfer */}
                                    {editingItemId && (
                                        <div className="form-group">
                                            <label>Location / Hub</label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    className="input-field"
                                                    placeholder={`Current: ${selectedHub?.name || 'Unknown'} — type to change`}
                                                    value={hubSearchQuery}
                                                    onChange={e => handleHubSearch(e.target.value)}
                                                />
                                            </div>
                                            {suggestedHub && (
                                                <div className="service-alert info" style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem' }}>
                                                    <MapPin size={14} />
                                                    <p>Will be moved to: <strong>{suggestedHub.name}</strong> — {suggestedHub.address}</p>
                                                </div>
                                            )}
                                            {showCreateHubPrompt && (
                                                <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'var(--bg-secondary, #f8fafc)', borderRadius: '10px', border: '1px dashed var(--primary)' }}>
                                                    <p style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem' }}>No hub found for "{hubSearchQuery}". Create one?</p>
                                                    <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                                        <input className="input-field" placeholder="Hub Name*" value={newHubForTransfer.name} onChange={e => setNewHubForTransfer(p => ({ ...p, name: e.target.value }))} />
                                                    </div>
                                                    <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                                        <input className="input-field" placeholder="Address*" value={newHubForTransfer.address} onChange={e => setNewHubForTransfer(p => ({ ...p, address: e.target.value }))} />
                                                    </div>
                                                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                                        <input className="input-field" placeholder="Pincode*" value={newHubForTransfer.pincode} onChange={e => setNewHubForTransfer(p => ({ ...p, pincode: e.target.value }))} />
                                                    </div>
                                                    <button className="btn-primary" style={{ width: '100%' }} onClick={handleTransferHubCreate}>Create Hub &amp; Transfer Vehicle</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="form-group">
                                        <label>Driver Name*</label>
                                        <input className={`input-field ${formErrors.name ? 'error' : ''}`} value={itemFormData.name} onChange={e => setItemFormData({ ...itemFormData, name: e.target.value })} placeholder="Full Name" />
                                        {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label>Phone*</label>
                                        <input className={`input-field ${formErrors.phone ? 'error' : ''}`} value={itemFormData.phone} onChange={e => setItemFormData({ ...itemFormData, phone: e.target.value })} maxLength={10} placeholder="10-digit mobile" />
                                        {formErrors.phone && <span className="error-text">{formErrors.phone}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label>License Number</label>
                                        <input className="input-field" value={itemFormData.license_number} onChange={e => setItemFormData({ ...itemFormData, license_number: e.target.value })} placeholder="DL Number" />
                                    </div>
                                    <div className="form-group">
                                        <label>Status</label>
                                        <select className="input-field" value={itemFormData.status} onChange={e => setItemFormData({ ...itemFormData, status: e.target.value })}>
                                            <option value="Available">Available</option>
                                            <option value="On Leave">On Leave</option>
                                            <option value="Duty">On Duty</option>
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer"><button className="btn-secondary" onClick={() => setShowItemModal(false)}>Cancel</button><button className="btn-primary" onClick={handleSaveItem}>Save Item</button></div>
                    </div>
                </div>
            )}

            {assignModal.open && (
                <div className="modal-overlay">
                    <div className="modal-content gh-modal premium-card" style={{ maxWidth: '520px' }}>
                        <div className="modal-header">
                            <h2>Assign Vehicle</h2>
                            <button onClick={() => setAssignModal({ open: false, trip: null })} className="close-btn"><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="service-alert info" style={{ marginBottom: '1rem' }}>
                                <Car size={16} />
                                <p><strong>{assignModal.trip?.trip_leader}</strong> — Trip {assignModal.trip?.trip_id} to <strong>{assignModal.trip?.destination}</strong></p>
                            </div>
                            <div className="form-group">
                                <label>Select Vehicle *</label>
                                <select className="input-field" value={assignForm.vehicleId} onChange={e => setAssignForm(p => ({ ...p, vehicleId: e.target.value }))}>
                                    <option value="">-- Choose a vehicle --</option>
                                    {allVehicles.filter(v => (v.status || '').toLowerCase() === 'available').map(v => (
                                        <option key={v.id} value={v.id}>{v.plate_number} — {v.model_name} ({toTitleCase(v.vehicle_type)})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Assign Driver (optional)</label>
                                <select className="input-field" value={assignForm.driverId} onChange={e => setAssignForm(p => ({ ...p, driverId: e.target.value }))}>
                                    <option value="">-- No driver assigned --</option>
                                    {allDrivers.filter(d => (d.availability || '').toLowerCase() === 'available').map(d => (
                                        <option key={d.id} value={d.id}>{d.name} — {d.phone}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="date-row">
                                <div className="form-group">
                                    <label>Start Date *</label>
                                    <input type="date" className="input-field" value={assignForm.startDate} onChange={e => setAssignForm(p => ({ ...p, startDate: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label>End Date *</label>
                                    <input type="date" className="input-field" value={assignForm.endDate} onChange={e => setAssignForm(p => ({ ...p, endDate: e.target.value }))} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Remarks</label>
                                <textarea className="input-field" rows={2} placeholder="Any special instructions..." value={assignForm.remarks} onChange={e => setAssignForm(p => ({ ...p, remarks: e.target.value }))} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setAssignModal({ open: false, trip: null })}>Cancel</button>
                            <button className="btn-primary" onClick={handleAssignVehicle}>Confirm Assignment</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Delete Confirmation Modal */}
            {deleteModal.isOpen && (
                <div className="modal-overlay">
                    <div className="modal-content confirmation-modal premium-card">
                        <div className="confirm-icon"><Trash2 size={40} color="var(--danger)" /></div>
                        <h2>{deleteModal.title}</h2>
                        <p>{deleteModal.message}</p>
                        <div className="confirm-actions">
                            <button className="btn-secondary" onClick={() => setDeleteModal({ isOpen: false })}>Keep It</button>
                            <button className="btn-danger" onClick={confirmDelete}>Yes, Delete</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Fleet;
