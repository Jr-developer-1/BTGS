import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { encodeId } from '../utils/idEncoder';
import api from '../api/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
    Building2,
    MapPin,
    BedDouble,
    ChefHat,
    Search,
    Plus,
    X,
    CheckCircle,
    Edit,
    Trash2,
    ArrowLeft,
    Phone,
    Shirt,
    Calendar,
    User,
    Save,
    ChevronDown,
    MoreHorizontal,
    ChevronLeft,
    ChevronRight,
    Lock,
    Mail
} from 'lucide-react';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';

const GuestHouse = () => {
    const { showToast } = useToast();
    const { user } = useAuth();

    const userRole = (user?.role || 'employee').toLowerCase();
    const isAdmin = userRole === 'admin' || user?.is_superuser;
    const isManager = isAdmin || userRole === 'guesthousemanager';

    const [guestHouses, setGuestHouses] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: null, id: null, title: '', message: '' });
    const ghImageInputRef = useRef(null);

    const getApiErrorMessage = (error, fallback = 'Something went wrong') => {
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

    const getGoogleMapsUrl = (guestHouse) => {
        if (!guestHouse) return null;

        const lat = Number(guestHouse.latitude);
        const lng = Number(guestHouse.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        }

        const addressQuery = [
            guestHouse.address,
            guestHouse.location,
            guestHouse.pincode
        ]
            .filter(Boolean)
            .join(', ')
            .trim();

        if (addressQuery) {
            return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery)}`;
        }

        return null;
    };

    const openGuestHouseInMaps = (guestHouse) => {
        const mapsUrl = getGoogleMapsUrl(guestHouse);
        if (!mapsUrl) {
            showToast('Location not available. Add latitude/longitude or address first.', 'warning');
            return;
        }
        window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    };

    const toTitleCase = (value) => {
        if (!value) return '';
        const normalized = String(value).replace(/_/g, ' ').trim().toLowerCase();
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    };

    const normalizeGuestHouse = (gh) => ({
        ...gh,
        isActive: gh.is_active,
        laundry: (gh.laundries || []).map(l => ({ ...l, name: l.name || 'Laundry Service' })),
        rooms: (gh.rooms || []).map(r => ({
            ...r,
            name: r.number,
            type: toTitleCase(r.room_type || 'single'),
            status: toTitleCase(r.status || 'available')
        })),
        contacts: (gh.contacts || []).map(c => ({ ...c, name: c.label }))
    });

    const mapGuestHouseBookingsToEvents = (gh) => {
        const events = [];
        (gh?.rooms || []).forEach(room => {
            (room.bookings || []).forEach(booking => {
                const startDate = booking.start_date;
                const endDate = booking.end_date;
                events.push({
                    id: booking.id,
                    roomId: room.id,
                    roomNumber: room.number || room.name || room.id,
                    status: booking.booking_type || 'Official',
                    startDate,
                    endDate,
                    details: booking.guest_name || '-',
                    checkIn: new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    checkOut: new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    statusLabel: 'Confirmed',
                    remarks: booking.remarks || ''
                });
            });
        });
        events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        return events;
    };

    const fetchGuestHouses = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/api/guesthouse/');
            const normalized = response.data.map(normalizeGuestHouse);
            setGuestHouses(normalized);
        } catch (err) {
            console.error("Failed to fetch guesthouses:", err);
            showToast("Failed to load guest houses", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const refreshGuestHouseById = async (guestHouseId) => {
        if (!guestHouseId) return;
        try {
            const res = await api.get(`/api/guesthouse/${guestHouseId}`);
            const normalized = normalizeGuestHouse(res.data);
            setGuestHouses(prev => prev.map(gh => gh.id === guestHouseId ? normalized : gh));
            setSelectedGuestHouse(normalized);
        } catch (err) {
            console.error("Refresh failed:", err);
        }
    };

    useEffect(() => {
        fetchGuestHouses();
    }, []);

    const [selectedGuestHouse, setSelectedGuestHouse] = useState(null);
    const [activeBookingRequest, setActiveBookingRequest] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState('rooms');
    const [topLevelView, setTopLevelView] = useState('guesthouses'); // 'guesthouses' or 'requests'

    useEffect(() => {
        if (tabParam === 'requests') {
            setTopLevelView('requests');
            setActiveTab('requests');
        } else if (tabParam) {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

    const [roomRequests, setRoomRequests] = useState([]);

    const fetchRoomRequests = async () => {
        try {
            const response = await api.get('/api/trips/?all=true');
            const trips = Array.isArray(response.data) ? response.data : (response.data.results || []);
            const requests = trips.filter(t =>
                t.accommodation_requests &&
                t.accommodation_requests.includes('Request for Room') &&
                !t.has_gh_booking &&
                ['Manager Approved', 'Approved', 'Under Process'].includes(t.status)
            );
            setRoomRequests(requests);
        } catch (err) {
            console.error("Failed to fetch room requests:", err);
        }
    };

    const handleAssignRoom = async (trip) => {
        try {
            await api.post('/api/notifications/', {
                title: 'Accommodation Confirmed',
                message: `Accommodation has been assigned for your trip ${trip.trip_id} to ${trip.destination}. Check your Trip Story for details.`,
                type: 'accommodation_update',
                trip_id: trip.trip_id,
                user: trip.user
            });
            showToast(`Allocation info sent to ${trip.trip_leader || 'Employee'}`, "success");
            setRoomRequests(prev => prev.filter(r => r.trip_id !== trip.trip_id));
        } catch (err) {
            showToast("Failed to send notification", "error");
        }
    };

    const handleStartBookingFromRequest = (req, gh) => {
        setActiveBookingRequest(req);
        setSelectedGuestHouse(gh);
        setTopLevelView('guesthouses');   // ensure we're in GH detail mode, not request list
        setActiveTab('calendar');          // go straight to the calendar where cells open the booking form
        showToast(`Opened calendar for ${gh.name} — click a room cell to book for ${req.trip_id}.`, 'info');
    };

    const handleRejectRequest = async (trip) => {
        try {
            await api.post('/api/notifications/', {
                title: 'Guest House Not Available',
                message: `No Guest House is available at your destination (${trip.destination}). Please book a hotel or other accommodation through the standard process.`,
                type: 'accommodation_update',
                trip_id: trip.trip_id,
                user: trip.user
            });
            showToast(`Employee informed: No facility in ${trip.destination}`, "warning");
            setRoomRequests(prev => prev.filter(r => r.trip_id !== trip.trip_id));
        } catch (err) {
            showToast("Failed to send notification", "error");
        }
    };

    useEffect(() => {
        if (topLevelView === 'requests' || activeTab === 'requests') {
            fetchRoomRequests();
        }
    }, [activeTab, topLevelView]);

    const [showGHModal, setShowGHModal] = useState(false);
    const [showItemModal, setShowItemModal] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editingItemId, setEditingItemId] = useState(null);
    const [bookingTab, setBookingTab] = useState('Official');
    const [isLoadingTrips, setIsLoadingTrips] = useState(false);

    // --- GEO HIERARCHY STATES ---
    const [fullHierarchy, setFullHierarchy] = useState([]);
    const [geoLoading, setGeoLoading] = useState(false);
    const [geoError, setGeoError] = useState(null);

    const [continents, setContinents] = useState([]);
    const [countries, setCountries] = useState([]);
    const [states, setStates] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [mandals, setMandals] = useState([]);
    const [clusters, setClusters] = useState([]);
    const [visitingLocations, setVisitingLocations] = useState([]);

    const [ghFormData, setGhFormData] = useState({
        name: '',
        address: '',
        location: '',
        pincode: '',
        isActive: true,
        latitude: '',
        longitude: '',
        image: null,
        description: '',
        continent_id: '',
        country_id: '',
        state_id: '',
        district_id: '',
        mandal_id: '',
        cluster_id: '',
        visiting_location_id: ''
    });

    const [itemFormData, setItemFormData] = useState({
        name: '',
        type: 'Single',
        phone: '',
        email: '',
        status: 'Available',
        source: 'In House',
        isActive: true,
        specialty: '',
        label: ''
    });
    const [formErrors, setFormErrors] = useState({});

    const [showBookingModal, setShowBookingModal] = useState(false);
    const [tripSearch, setTripSearch] = useState('');
    const [showTripResults, setShowTripResults] = useState(false);
    const [trips, setTrips] = useState([]);
    const inputRef = useRef(null);

    useEffect(() => {
        const fetchTrips = async () => {
            if (!showTripResults) return;

            setIsLoadingTrips(true);
            try {
                const encodedSearch = tripSearch ? btoa(tripSearch) : '';
                const params = encodedSearch ? { search: encodedSearch } : {};
                const response = await api.get('/api/trips/search/', { params });

                const results = Array.isArray(response.data) ? response.data : (response.data.results || []);
                const mapped = results.map(t => ({
                    id: t.id || t.trip_id,
                    trip_id: t.trip_id,
                    title: t.purpose,
                    employee: t.trip_leader || 'N/A',
                    dept: t.department || 'Admin',
                    startDate: t.start_date,
                    endDate: t.end_date,
                    destination: t.destination,
                    user: t.user
                }));
                setTrips(mapped);
            } catch (err) {
                console.error("Fetch trips error:", err);
            } finally {
                setIsLoadingTrips(false);
            }
        };

        const timer = setTimeout(fetchTrips, 300);
        return () => clearTimeout(timer);
    }, [tripSearch, showTripResults]);

    // --- GEO HIERARCHY LOGIC ---
    const API_URL = "/api/masters/locations/live_hierarchy/";

    const fetchFullHierarchy = async (forceRefetch = false) => {
        if (fullHierarchy.length > 0 && !geoError && !forceRefetch) return;

        setGeoLoading(true);
        setGeoError(null);
        try {
            const res = await api.get(API_URL);
            const data = res.data.results || res.data.data || res.data;
            if (res.data.error) throw new Error(res.data.error);
            setFullHierarchy(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error fetching full hierarchy:", err);
            setGeoError(err.message || "Unable to connect to Geocoding Server.");
        } finally {
            setGeoLoading(false);
        }
    };

    useEffect(() => {
        if (showGHModal) {
            fetchFullHierarchy();
        }
    }, [showGHModal]);

    useEffect(() => {
        if (fullHierarchy.length > 0) {
            setContinents(fullHierarchy.map(c => ({ id: c.id, name: c.name })));
        }
    }, [fullHierarchy]);

    const getFilterName = (val) => {
        if (!val) return '';
        if (typeof val === 'object') return (val.name || '').trim().toLowerCase();
        return String(val).trim().toLowerCase();
    };

    const getChildren = (type, filters) => {
        if (!fullHierarchy || !fullHierarchy.length) return [];
        let data = fullHierarchy;

        if (type === 'continent') return data;

        const continent = data.find(c => (c.name || '').trim().toLowerCase() === getFilterName(filters.continent_name));
        const countries = continent?.children || continent?.countries || [];
        if (type === 'country') return countries;

        const country = countries.find(c => (c.name || '').trim().toLowerCase() === getFilterName(filters.country_name));
        const states = country?.states || country?.state || country?.children || [];
        if (type === 'state') return states;

        const state = states.find(s => (s.name || '').trim().toLowerCase() === getFilterName(filters.state_name));
        const districts = state?.districts || state?.district || state?.children || [];
        if (type === 'district') return districts;

        const district = districts.find(d => (d.name || '').trim().toLowerCase() === getFilterName(filters.district_name));
        const mandals = district?.mandals || district?.mandal || district?.children || [];
        if (type === 'mandal') return mandals;

        const mandal = mandals.find(m => (m.name || '').trim().toLowerCase() === getFilterName(filters.mandal_name));
        const clusters = [
            ...(mandal?.clusters || []),
            ...(mandal?.metro_polyten_cities || []),
            ...(mandal?.cities || []),
            ...(mandal?.towns || []),
            ...(mandal?.villages || []),
            ...(mandal?.children || [])
        ];
        if (type === 'cluster') return clusters;

        const cluster = clusters.find(c => (c.name || '').trim().toLowerCase() === getFilterName(filters.cluster_name));
        const visitingLocations = cluster?.visiting_locations || cluster?.locations || [];
        if (type === 'visitingLocation') return visitingLocations;

        return [];
    };

    useEffect(() => {
        if (!showGHModal) return;

        const filters = {
            continent_name: continents.find(c => c.id === ghFormData.continent_id)?.name,
            country_name: countries.find(c => c.id === ghFormData.country_id)?.name,
            state_name: states.find(s => s.id === ghFormData.state_id)?.name,
            district_name: districts.find(d => d.id === ghFormData.district_id)?.name,
            mandal_name: mandals.find(m => m.id === ghFormData.mandal_id)?.name,
            cluster_name: clusters.find(c => c.id === ghFormData.cluster_id)?.name,
        };

        setCountries(getChildren('country', filters));
        setStates(getChildren('state', filters));
        setDistricts(getChildren('district', filters));
        setMandals(getChildren('mandal', filters));
        setClusters(getChildren('cluster', filters));
        setVisitingLocations(getChildren('visitingLocation', filters));

    }, [
        ghFormData.continent_id,
        ghFormData.country_id,
        ghFormData.state_id,
        ghFormData.district_id,
        ghFormData.mandal_id,
        ghFormData.cluster_id,
        continents,
        fullHierarchy
    ]);

    const dropdownRef = useRef(null);
    useEffect(() => {
        function handleClickOutside(event) {
            if (inputRef.current && !inputRef.current.contains(event.target) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowTripResults(false);
            }
        }
        if (showTripResults) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showTripResults]);

    const [bookingData, setBookingData] = useState({
        roomId: '',
        roomName: '',
        status: 'Confirmed',
        employeeName: '',
        tripId: '',
        checkInDate: '',
        checkInTime: '12:00',
        checkOutDate: '',
        checkOutTime: '12:00',
        remarks: '',
        maintenanceType: 'Painting'
    });

    const [currentDate, setCurrentDate] = useState(new Date());
    const realToday = new Date();
    realToday.setHours(0, 0, 0, 0);

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const changeMonth = (offset) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    };

    const [calendarEvents, setCalendarEvents] = useState([]);

    useEffect(() => {
        if (!selectedGuestHouse) {
            setCalendarEvents([]);
            return;
        }
        setCalendarEvents(mapGuestHouseBookingsToEvents(selectedGuestHouse));
    }, [selectedGuestHouse]);

    const monthlyEvents = calendarEvents.filter(event => {
        const start = new Date(event.startDate);
        const end = new Date(event.endDate);
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        return start <= monthEnd && end >= monthStart;
    });

    const getStatusForDate = (roomId, day) => {
        const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const match = calendarEvents.find(e => {
            if (e.roomId !== roomId) return false;
            return dateStr >= e.startDate && dateStr <= e.endDate;
        });

        if (match) {
            const status = match.status === 'Maintenance' ? 'maintenance' : 'occupied';
            return { status, color: status };
        }
        return { status: 'available', color: 'available' };
    };

    const handleGhInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setGhFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleGhImageChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) { setGhFormData(prev => ({ ...prev, image: '' })); return; }
        if (!file.type.startsWith('image/')) { showToast('Invalid image', 'warning'); return; }
        const r = new FileReader();
        r.onload = () => setGhFormData(prev => ({ ...prev, image: r.result }));
        r.readAsDataURL(file);
    };

    const handleLocationSelect = (type, selectedOpt) => {
        const idMap = {
            continent: 'continent_id',
            country: 'country_id',
            state: 'state_id',
            district: 'district_id',
            mandal: 'mandal_id',
            cluster: 'cluster_id',
            visiting_location: 'visiting_location_id'
        };

        const fieldName = idMap[type];
        const selectedValue = selectedOpt ? (selectedOpt.id || '') : '';

        setGhFormData(prev => {
            const newState = { ...prev, [fieldName]: selectedValue };

            // Cascading reset
            if (type === 'continent') {
                newState.country_id = ''; newState.state_id = ''; newState.district_id = '';
                newState.mandal_id = ''; newState.cluster_id = ''; newState.visiting_location_id = '';
            }
            if (type === 'country') {
                newState.state_id = ''; newState.district_id = ''; newState.mandal_id = '';
                newState.cluster_id = ''; newState.visiting_location_id = '';
            }
            if (type === 'state') {
                newState.district_id = ''; newState.mandal_id = ''; newState.cluster_id = '';
                newState.visiting_location_id = '';
            }
            if (type === 'district') {
                newState.mandal_id = ''; newState.cluster_id = ''; newState.visiting_location_id = '';
            }
            if (type === 'mandal') {
                newState.cluster_id = ''; newState.visiting_location_id = '';
            }
            if (type === 'cluster') {
                newState.visiting_location_id = '';
            }

            // Sync legacy location field if visiting location is selected
            if (type === 'visiting_location' && selectedOpt) {
                newState.location = selectedOpt.name;
            }

            return newState;
        });
    };

    const handleRemoveGhImage = () => {
        setGhFormData(prev => ({ ...prev, image: '' }));
        if (ghImageInputRef.current) ghImageInputRef.current.value = '';
    };

    const handleAddNewGh = () => {
        setGhFormData({
            name: '',
            address: '',
            location: '',
            pincode: '',
            isActive: true,
            latitude: '',
            longitude: '',
            image: '',
            description: '',
            continent_id: '',
            country_id: '',
            state_id: '',
            district_id: '',
            mandal_id: '',
            cluster_id: '',
            visiting_location_id: ''
        });
        setEditingId(null);
        setShowGHModal(true);
    };

    const handleEditGh = (gh) => {
        setGhFormData({
            name: gh.name || '',
            address: gh.address || '',
            location: gh.location || '',
            pincode: gh.pincode || '',
            isActive: gh.isActive ?? true,
            latitude: gh.latitude || '',
            longitude: gh.longitude || '',
            image: gh.image || '',
            description: gh.description || '',
            continent_id: gh.continent_id || '',
            country_id: gh.country_id || '',
            state_id: gh.state_id || '',
            district_id: gh.district_id || '',
            mandal_id: gh.mandal_id || '',
            cluster_id: gh.cluster_id || '',
            visiting_location_id: gh.visiting_location_id || ''
        });
        setEditingId(gh.id);
        setShowGHModal(true);
    };

    const handleDeleteGh = (id) => {
        setDeleteModal({
            isOpen: true,
            type: 'gh',
            id: id,
            title: 'Delete Guest House?',
            message: 'This will permanently delete the guest house and all associated rooms, kitchens, and staff. This action cannot be undone.'
        });
    };

    const prepareGhPayload = (data) => ({
        name: data.name,
        address: data.address,
        location: data.location || data.address || '',
        pincode: data.pincode,
        is_active: data.isActive,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        image: data.image || null,
        description: data.description || '',
        continent_id: data.continent_id,
        country_id: data.country_id,
        state_id: data.state_id,
        district_id: data.district_id,
        mandal_id: data.mandal_id,
        cluster_id: data.cluster_id,
        visiting_location_id: data.visiting_location_id,
        rooms: (data.rooms || []).map(r => ({
            number: r.number || r.name,
            room_type: (r.type || r.room_type || 'single').toLowerCase(),
            status: (r.status || 'available').toLowerCase(),
            notes: r.notes || ''
        })),
        kitchens: (data.kitchens || []).map(k => ({ name: k.name, status: k.status || 'Available', notes: k.notes || '' })),
        cooks: (data.cooks || []).map(c => ({ name: c.name, phone: c.phone, specialty: c.specialty, status: c.status, availability: c.availability, source: c.source })),
        laundries: (data.laundry || []).map(l => ({ name: l.name, phone: l.phone, status: l.status, notes: l.notes })),
        contacts: (data.contacts || []).map(c => ({ label: c.name || c.label, phone: c.phone, email: c.email, is_active: c.isActive !== undefined ? c.isActive : true }))
    });

    const handleSaveGh = () => {
        if (!ghFormData.name || !ghFormData.address || !ghFormData.pincode) return;
        const payload = prepareGhPayload({ ...ghFormData, rooms: editingId ? selectedGuestHouse.rooms : [], kitchens: editingId ? selectedGuestHouse.kitchens : [], cooks: editingId ? selectedGuestHouse.cooks : [], laundry: editingId ? selectedGuestHouse.laundries : [], contacts: editingId ? selectedGuestHouse.contacts : [] });

        if (editingId) {
            api.put(`/api/guesthouse/${encodeId(editingId)}`, payload)
                .then(res => {
                    const updated = normalizeGuestHouse(res.data);
                    setGuestHouses(prev => prev.map(gh => gh.id === editingId ? updated : gh));
                    setSelectedGuestHouse(updated);
                    setShowGHModal(false);
                    showToast('Updated', 'success');
                })
                .catch(err => showToast(getApiErrorMessage(err), 'error'));
        } else {
            api.post('/api/guesthouse/', payload)
                .then(res => {
                    const created = normalizeGuestHouse(res.data);
                    setGuestHouses(prev => [...prev, created]);
                    setShowGHModal(false);
                    showToast('Created', 'success');
                })
                .catch(err => showToast(getApiErrorMessage(err), 'error'));
        }
    };

    const handleCalendarCellClick = (room, day) => {
        const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        clickedDate.setHours(0, 0, 0, 0);
        if (clickedDate.getTime() < realToday.getTime()) return;

        const dateStr = `${clickedDate.getFullYear()}-${String(clickedDate.getMonth() + 1).padStart(2, '0')}-${String(clickedDate.getDate()).padStart(2, '0')}`;
        const existingEvent = calendarEvents.find(e => e.roomId === room.id && dateStr >= e.startDate && dateStr <= e.endDate);

        if (existingEvent) {
            setBookingData({
                roomId: room.id,
                roomName: `${room.name} (${room.type})`,
                status: 'Confirmed',
                employeeName: existingEvent.details || '',
                tripId: existingEvent.trip || '',
                checkInDate: existingEvent.startDate + 'T12:00',
                checkInTime: '12:00',
                checkOutDate: existingEvent.endDate + 'T12:00',
                checkOutTime: '12:00',
                remarks: existingEvent.remarks || '',
                phone: existingEvent.phone || '',
                maintenanceType: existingEvent.status === 'Maintenance' ? existingEvent.details : 'Painting'
            });
            setBookingTab(existingEvent.status === 'Maintenance' ? 'Maintenance' : (existingEvent.status === 'Official' ? 'Official' : 'Personal'));
        } else {
            // Pre-fill from active request if available
            const preFill = activeBookingRequest || {};
            setBookingData({
                roomId: room.id,
                roomName: `${room.name} (${room.type})`,
                status: 'Confirmed',
                employeeName: preFill.trip_leader || '',
                tripId: preFill.trip_id || '',
                checkInDate: (preFill.start_date || dateStr) + 'T12:00',
                checkInTime: '12:00',
                checkOutDate: (preFill.end_date || dateStr) + 'T12:00',
                checkOutTime: '12:00',
                remarks: preFill.purpose || '',
                phone: '',
                maintenanceType: 'Painting'
            });
            setBookingTab('Official');
        }
        setShowBookingModal(true);
    };

    const handleBookingSave = () => {
        if (bookingTab === 'Official') {
            if (!bookingData.tripId) {
                showToast('Please select a trip', 'error');
                return;
            }
            const selectedTrip = trips.find(t => t.id === bookingData.tripId);
            if (selectedTrip) {
                const tripStart = new Date(selectedTrip.startDate);
                const tripEnd = new Date(selectedTrip.endDate);
                tripEnd.setHours(23, 59, 59);

                const checkIn = new Date(bookingData.checkInDate);
                const checkOut = new Date(bookingData.checkOutDate);

                if (checkIn < tripStart || checkOut > tripEnd) {
                    showToast(`Booking dates must be within Trip dates (${selectedTrip.startDate} to ${selectedTrip.endDate})`, 'error');
                    return;
                }
            }
        }

        const payload = {
            start_date: bookingData.checkInDate,
            end_date: bookingData.checkOutDate,
            guest_name: bookingData.employeeName || bookingData.maintenanceType || 'Guest',
            guest_phone: bookingData.guestPhone,
            guest_count: bookingData.guestCount,
            trip: bookingTab === 'Official' ? bookingData.tripId : null,
            booking_type: bookingTab,
            remarks: bookingData.remarks
        };
        api.post(`/api/guesthouse/rooms/${bookingData.roomId}/bookings`, payload)
            .then(async () => {
                // If we were booking for a specific request, let's notify them
                if (activeBookingRequest) {
                    try {
                        await api.post('/api/notifications/', {
                            title: 'Accommodation Confirmed',
                            message: `Guest house room has been booked for your trip ${activeBookingRequest.trip_id} to ${activeBookingRequest.destination} at ${selectedGuestHouse.name}.`,
                            type: 'accommodation_update',
                            trip_id: activeBookingRequest.trip_id,
                            user: activeBookingRequest.user
                        });
                        setActiveBookingRequest(null);
                    } catch (nErr) {
                        console.error("Auto-notify failed:", nErr);
                    }
                }

                refreshGuestHouseById(selectedGuestHouse.id);
                setShowBookingModal(false);
                showToast('Booking saved and employee notified', 'success');
                // Refresh requests tab data
                fetchRoomRequests();
            })
            .catch(err => showToast(err?.response?.data?.error || 'Failed', 'error'));
    };

    const handleAddItem = () => {
        setEditingItemId(null);
        setItemFormData({
            name: '',
            type: 'Single',
            phone: '',
            email: '',
            status: 'Available',
            source: 'In House',
            isActive: true,
            specialty: '',
            label: ''
        });
        setFormErrors({});
        setShowItemModal(true);
    };

    const handleEditItem = (item) => {
        setEditingItemId(item.id);
        setItemFormData({
            name: item.name || item.number || '',
            type: item.type || 'Single',
            phone: item.phone || '',
            email: item.email || '',
            status: activeTab === 'cooks' ? (item.availability || 'Available') : (item.status || 'Available'),
            source: item.source || 'In House',
            isActive: item.isActive !== undefined ? item.isActive : true,
            specialty: item.specialty || '',
            label: item.label || item.name || ''
        });
        setFormErrors({});
        setShowItemModal(true);
    };

    const handleDeleteItem = (itemId) => {
        setDeleteModal({
            isOpen: true,
            type: 'item',
            id: itemId,
            title: `Delete ${toTitleCase(activeTab).slice(0, -1)}?`,
            message: `Are you sure you want to remove this item from the ${activeTab} list?`
        });
    };

    const executeDelete = () => {
        const { type, id } = deleteModal;

        if (type === 'gh') {
            api.delete(`/api/guesthouse/${encodeId(id)}`)
                .then(() => {
                    setGuestHouses(prev => prev.filter(gh => gh.id !== id));
                    if (selectedGuestHouse?.id === id) setSelectedGuestHouse(null);
                    showToast('Guest House deleted', 'success');
                    setDeleteModal({ isOpen: false, type: null, id: null, title: '', message: '' });
                })
                .catch(err => showToast(getApiErrorMessage(err), 'error'));
        } else if (type === 'item') {
            const endpointMap = {
                rooms: 'rooms',
                kitchens: 'kitchens',
                cooks: 'cooks',
                laundry: 'laundries',
                contacts: 'contacts'
            };
            const endpoint = endpointMap[activeTab];

            api.delete(`/api/guesthouse/items/${endpoint}/${id}/`)
                .then(() => {
                    const updatedItems = selectedGuestHouse[activeTab].filter(i => i.id !== id);
                    const updatedGh = { ...selectedGuestHouse, [activeTab]: updatedItems };

                    setGuestHouses(prev => prev.map(gh => gh.id === selectedGuestHouse.id ? updatedGh : gh));
                    setSelectedGuestHouse(updatedGh);
                    showToast('Item removed', 'success');
                    setDeleteModal({ isOpen: false, type: null, id: null, title: '', message: '' });
                })
                .catch(err => showToast(getApiErrorMessage(err), 'error'));
        }
    };

    const handleSaveItem = () => {
        const errors = {};
        if (!itemFormData.name && activeTab !== 'contacts') errors.name = "Required";
        if (activeTab === 'contacts' && !itemFormData.label) errors.label = "Required";
        if (activeTab === 'contacts' && (!itemFormData.phone || !/^\d{10}$/.test(itemFormData.phone))) errors.phone = "Invalid Phone";
        if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

        const payload = {
            ...itemFormData,
            name: itemFormData.name || itemFormData.label,
            number: itemFormData.name,
            room_type: itemFormData.type.toLowerCase(),
            status: itemFormData.status.toLowerCase(),
            availability: itemFormData.status.toLowerCase(),
            source: itemFormData.source,
            label: itemFormData.label || itemFormData.name,
            phone: itemFormData.phone,
            email: itemFormData.email,
            is_active: itemFormData.isActive,
            specialty: itemFormData.specialty,
            guesthouse: selectedGuestHouse.id
        };

        const endpointMap = {
            rooms: 'rooms',
            kitchens: 'kitchens',
            cooks: 'cooks',
            laundry: 'laundries',
            contacts: 'contacts'
        };
        const endpoint = endpointMap[activeTab];

        const promise = editingItemId
            ? api.put(`/api/guesthouse/items/${endpoint}/${editingItemId}/`, payload)
            : api.post(`/api/guesthouse/items/${endpoint}/`, payload);

        promise
            .then(res => {
                const savedItem = res.data;
                const updatedItems = editingItemId
                    ? selectedGuestHouse[activeTab].map(i => i.id === editingItemId ? savedItem : i)
                    : [...(selectedGuestHouse[activeTab] || []), savedItem];

                const updatedGh = { ...selectedGuestHouse, [activeTab]: updatedItems };
                setGuestHouses(prev => prev.map(gh => gh.id === selectedGuestHouse.id ? updatedGh : gh));
                setSelectedGuestHouse(updatedGh);
                setShowItemModal(false);
                showToast('Saved', 'success');
            })
            .catch(err => showToast(getApiErrorMessage(err), 'error'));
    };

    // Unified role-based UI access
    const canManageGH = isAdmin || userRole === 'guesthousemanager';

    const renderTabContent = () => {
        if (activeTab === 'requests') {
            // GH-detail view: show only requests matching this GH's location.
            // Global view (topLevelView==='requests'): show all requests.
            const isInsideGH = !!selectedGuestHouse && topLevelView !== 'requests';

            const destMatchesGH = (req) => {
                if (!selectedGuestHouse) return true;
                const dest = (req.destination || '').toLowerCase();
                const loc = (selectedGuestHouse.location || '').toLowerCase();
                const addr = (selectedGuestHouse.address || '').toLowerCase();
                const name = (selectedGuestHouse.name || '').toLowerCase();
                return (
                    (loc && (loc.includes(dest) || dest.includes(loc))) ||
                    (addr && (addr.includes(dest) || dest.includes(addr))) ||
                    (name && (name.includes(dest) || dest.includes(name)))
                );
            };

            const displayedRequests = isInsideGH
                ? roomRequests.filter(destMatchesGH)
                : roomRequests;

            return (
                <div className="gh-list-section">
                    <div className="gh-sub-header">
                        <h3>
                            Employee Room Requests
                            {isInsideGH && (
                                <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.6rem' }}>
                                    — destination matches <strong>{selectedGuestHouse.location || selectedGuestHouse.address}</strong>
                                </span>
                            )}
                        </h3>
                        <button className="btn-text-only" onClick={fetchRoomRequests}>Refresh</button>
                    </div>
                    <div className="gh-item-list">
                        {displayedRequests.length > 0 ? displayedRequests.map(req => {
                            // In GH-detail view, the matching GH is always the current one.
                            // In global view, find any GH matching the destination.
                            const matchingGH = isInsideGH
                                ? selectedGuestHouse
                                : (guestHouses || []).find(gh =>
                                    gh.location?.toLowerCase().includes(req.destination?.toLowerCase()) ||
                                    gh.address?.toLowerCase().includes(req.destination?.toLowerCase()) ||
                                    req.destination?.toLowerCase().includes(gh.location?.toLowerCase())
                                );

                            return (
                                <div key={req.trip_id} className="gh-list-item request-card-premium">
                                    <div className="item-info">
                                        <div className="request-header">
                                            <div className="request-header-left">
                                                <span className="trip-id-tag-mini">{req.trip_id}</span>
                                                <span className={`badge ${req.status === 'Approved' ? 'success' : 'pending'}`}>
                                                    {req.status}
                                                </span>
                                            </div>
                                            <span className={`badge ${matchingGH ? 'info' : 'rejected'}`}>
                                                {matchingGH ? 'GH Available' : 'No Facility Found'}
                                            </span>
                                        </div>
                                        <h4>{req.trip_leader_name || req.trip_leader} - {req.purpose}</h4>
                                        <div className="request-meta-grid">
                                            <div className="meta-item"><MapPin size={14} /> <span>Dest: {req.destination}</span></div>
                                            <div className="meta-item"><Calendar size={14} /> <span>{req.start_date} - {req.end_date}</span></div>
                                        </div>
                                        <p className="request-note">Requested: Guest House Stay</p>
                                    </div>
                                    <div className="actions-cell-vertical">
                                        {matchingGH ? (
                                            <>
                                                <button
                                                    className="btn-primary-mini"
                                                    onClick={() => handleStartBookingFromRequest(req, matchingGH)}
                                                    title="Open the calendar for this guest house and book a room"
                                                >
                                                    📅 Book Room @ {matchingGH.name}
                                                </button>
                                                <button className="btn-secondary-mini" onClick={() => handleAssignRoom(req)}>
                                                    Quick Notify
                                                </button>
                                            </>
                                        ) : isInsideGH ? (
                                            // Inside a GH but no location match — shouldn't normally show, but handle gracefully
                                            <button className="btn-danger-mini" onClick={() => handleRejectRequest(req)}>
                                                Inform: No GH at Location
                                            </button>
                                        ) : (
                                            // Global view, no auto-matched GH — let admin pick any GH manually
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '180px' }}>
                                                <div className="select-wrapper" style={{ fontSize: '0.8rem' }}>
                                                    <select
                                                        className="input-field"
                                                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', height: 'auto' }}
                                                        defaultValue=""
                                                        id={`gh-select-${req.trip_id}`}
                                                    >
                                                        <option value="" disabled>Select a Guest House…</option>
                                                        {guestHouses.map(gh => (
                                                            <option key={gh.id} value={gh.id}>{gh.name} — {gh.location || gh.address}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <button
                                                    className="btn-primary-mini"
                                                    onClick={() => {
                                                        const select = document.getElementById(`gh-select-${req.trip_id}`);
                                                        const ghId = select?.value;
                                                        if (!ghId) { showToast('Please select a guest house first', 'warning'); return; }
                                                        const chosen = guestHouses.find(g => String(g.id) === String(ghId));
                                                        if (chosen) handleStartBookingFromRequest(req, chosen);
                                                    }}
                                                >
                                                    📅 Book at Selected GH
                                                </button>
                                                <button className="btn-danger-mini" onClick={() => handleRejectRequest(req)}>
                                                    Inform: No GH at Location
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="empty-state-vsmall mt-4" style={{ textAlign: 'center', padding: '2rem' }}>
                                {isInsideGH ? (
                                    <>
                                        <MapPin size={28} style={{ opacity: 0.35, marginBottom: '0.5rem' }} />
                                        <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>No Matching Requests</p>
                                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                            There are no pending room requests whose destination matches this guest house location.
                                        </p>
                                    </>
                                ) : (
                                    <p style={{ color: 'var(--text-muted)' }}>No active room requests at the moment.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (!selectedGuestHouse) return null;
        if (activeTab === 'calendar') {
            return (
                <div className="gh-list-section">
                    <div className="calendar-container">
                        <div className="calendar-controls">
                            <h3>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                            <div className="calendar-nav">
                                <button onClick={() => changeMonth(-1)}>&lt;</button>
                                <button onClick={() => changeMonth(1)}>&gt;</button>
                            </div>
                            <div className="calendar-legend">
                                <span className="legend-item"><span className="dot available"></span> Available</span>
                                <span className="legend-item"><span className="dot occupied"></span> Occupied</span>
                                <span className="legend-item"><span className="dot maintenance"></span> Maintenance</span>
                            </div>
                        </div>
                        <div className="calendar-grid-wrapper">
                            <table className="calendar-table">
                                <thead>
                                    <tr>
                                        <th className="room-col-header">Room</th>
                                        {days.map(d => {
                                            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
                                            const isToday = new Date().toDateString() === date.toDateString();
                                            return (
                                                <th key={d} className={`date-header ${isToday ? 'current-day' : ''}`}>
                                                    <div className="date-num">{d}</div>
                                                    <div className="day-name">{date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}</div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedGuestHouse.rooms.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={days.length + 1}
                                                style={{
                                                    textAlign: 'center',
                                                    padding: '3rem 1rem',
                                                    color: 'var(--text-muted)',
                                                }}
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}><path d="M3 7v13h18V7" /><rect x="8" y="3" width="3" height="4" rx="1" /><rect x="13" y="3" width="3" height="4" rx="1" /><path d="M3 11h18" /></svg>
                                                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>No Rooms Configured</span>
                                                    <span style={{ fontSize: '0.82rem' }}>Add rooms to this guest house to see availability on the calendar.</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        selectedGuestHouse.rooms.map(room => (
                                            <tr key={room.id}>
                                                <td className="room-cell">
                                                    <div className="room-name">{room.name}</div>
                                                    <span className="room-type">{room.type}</span>
                                                </td>
                                                {days.map(d => {
                                                    const { status, color } = getStatusForDate(room.id, d);
                                                    return <td key={d} className={`status-cell ${color}`} onClick={() => handleCalendarCellClick(room, d)}></td>;
                                                })}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="event-log-container">
                            <h3>Monthly Event Log</h3>
                            <table className="event-log-table">
                                <thead>
                                    <tr><th>ROOM</th><th>TYPE</th><th>GUEST</th><th>CHECK-IN</th><th>CHECK-OUT</th><th>STATUS</th></tr>
                                </thead>
                                <tbody>
                                    {monthlyEvents.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="14" x2="8" y2="14" strokeWidth="2" /><line x1="12" y1="14" x2="12" y2="14" strokeWidth="2" /><line x1="16" y1="14" x2="16" y2="14" strokeWidth="2" /></svg>
                                                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>No Bookings This Month</span>
                                                    <span style={{ fontSize: '0.8rem' }}>Click any available date on the calendar above to create a booking.</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        monthlyEvents.map(e => (
                                            <tr key={e.id}>
                                                <td>{e.roomNumber}</td>
                                                <td><span className={`status-pill ${e.status.toLowerCase()}`}>{e.status}</span></td>
                                                <td>{e.details}</td><td>{e.checkIn}</td><td>{e.checkOut}</td><td><span className="status-confirmed"><span className="dot-small"></span>Confirmed</span></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            );
        }

        const list = selectedGuestHouse[activeTab] || [];
        return (
            <div className="gh-list-section">
                <div className="gh-sub-header">
                    <h3>{toTitleCase(activeTab)} List</h3>
                    {canManageGH && <button className="btn-add-item" onClick={handleAddItem}><Plus size={16} /> Add Item</button>}
                </div>
                <div className="gh-item-list">
                    {list.map(item => (
                        <div key={item.id} className="gh-list-item">
                            <div className="item-info">
                                <h4>{item.name || item.number || item.label}</h4>
                                <div className="item-badges">
                                    <span className={`badge ${(item.status || item.availability || 'available').toLowerCase()}`}>{item.status || item.availability || 'Available'}</span>
                                    {item.room_type && <span className="badge single">{toTitleCase(item.room_type)}</span>}
                                    {activeTab === 'cooks' && item.specialty && <span className="badge open">{item.specialty}</span>}
                                </div>
                                {activeTab === 'contacts' && (
                                    <div className="contacts-info">
                                        <p><Phone size={12} /> {item.phone}</p>
                                        {item.email && <p><Mail size={12} /> {item.email}</p>}
                                    </div>
                                )}
                                {activeTab === 'laundry' && (
                                    <div className="contacts-info">
                                        <p><Phone size={12} /> {item.phone}</p>
                                    </div>
                                )}
                            </div>
                            {canManageGH && (
                                <div className="actions-cell">
                                    <button className="icon-btn-small" onClick={() => handleEditItem(item)}><Edit size={16} /></button>
                                    <button className="icon-btn-small delete" onClick={() => handleDeleteItem(item.id)}><Trash2 size={16} /></button>
                                </div>
                            )}
                        </div>
                    ))}
                    {list.length === 0 && <p className="text-muted">No items found.</p>}
                </div>
            </div>
        );
    };

    const filteredGuestHouses = guestHouses.filter(gh => gh.name.toLowerCase().includes(searchQuery.toLowerCase()) || gh.address.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="gh-page animate-fade-in">
            {topLevelView === 'requests' ? (
                <>
                    <div className="gh-header-section">
                        <div className="gh-title-group"><h1>Room Requests</h1><p>Active requests from employees</p></div>
                        <button className="btn-secondary" onClick={() => setTopLevelView('guesthouses')}>View Guest Houses</button>
                    </div>
                    {renderTabContent()}
                </>
            ) : selectedGuestHouse ? (
                <>
                    <div className="gh-details-header">
                        <div className="gh-details-left">
                            <button className="gh-back-btn" onClick={() => setSelectedGuestHouse(null)}><ArrowLeft size={16} /> Back</button>
                            <div className="gh-details-title"><h1>{selectedGuestHouse.name}</h1><p><MapPin size={14} /> {selectedGuestHouse.address}</p></div>
                        </div>
                        <div className="gh-map-preview" onClick={() => openGuestHouseInMaps(selectedGuestHouse)}>
                            {selectedGuestHouse.image ? <img src={selectedGuestHouse.image} alt="GH" /> : <Building2 size={40} />}
                        </div>
                    </div>
                    <div className="gh-tabs">
                        {[
                            { id: 'rooms', icon: BedDouble, label: 'Rooms' },
                            { id: 'kitchens', icon: ChefHat, label: 'Kitchens' },
                            { id: 'cooks', icon: ChefHat, label: 'Cooks' },
                            { id: 'laundry', icon: Shirt, label: 'Laundry' },
                            { id: 'requests', icon: Mail, label: 'Room Requests' },
                            { id: 'contacts', icon: Phone, label: 'Contacts' },
                            { id: 'calendar', icon: Calendar, label: 'Calendar' }
                        ].map(t => (
                            <button key={t.id} className={`gh-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}><t.icon size={16} /> {t.label}</button>
                        ))}
                    </div>
                    {renderTabContent()}
                </>
            ) : (
                <>
                    <div className="gh-header-section">
                        <div className="gh-title-group"><h1>Guest House</h1></div>
                        <div className="header-actions">
                            {canManageGH && (
                                <button className="btn-secondary mr-2" onClick={() => { setTopLevelView('requests'); setActiveTab('requests'); }}>
                                    <Mail size={18} /> View Requests ({roomRequests.length})
                                </button>
                            )}
                            {canManageGH && <button className="btn-primary" onClick={handleAddNewGh}><Plus size={18} /> Add Guest House</button>}
                        </div>
                    </div>
                    <div className="gh-search-bar premium-card">
                        <Search size={20} className="search-icon" /><input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                    <div className="gh-grid-list">
                        {filteredGuestHouses.length > 0 ? (
                            filteredGuestHouses.map(gh => (
                                <div key={gh.id} className="gh-card-item premium-card cursor-pointer" onClick={() => setSelectedGuestHouse(gh)}>
                                    <div className="gh-card-map-placeholder">
                                        {gh.image ? <img src={gh.image} alt="GH" className="gh-card-image" /> : <Building2 size={32} className="gh-placeholder-icon" />}
                                        <span className={`status-badge ${gh.isActive ? 'active' : 'inactive'}`}><span className="status-dot-inline"></span> {gh.isActive ? 'Operational' : 'Standby'}</span>
                                        <div className="card-actions">
                                            <button className="action-icon-btn map" onClick={(e) => { e.stopPropagation(); openGuestHouseInMaps(gh); }}><MapPin size={16} /></button>
                                            {canManageGH && <button className="action-icon-btn edit" onClick={(e) => { e.stopPropagation(); handleEditGh(gh); }}><Edit size={16} /></button>}
                                            {canManageGH && <button className="action-icon-btn delete" onClick={(e) => { e.stopPropagation(); handleDeleteGh(gh.id); }}><Trash2 size={16} /></button>}
                                        </div>
                                    </div>
                                    <div className="gh-card-details">
                                        <h3>{gh.name}</h3>
                                        <p className="gh-address">{gh.location || gh.address}</p>
                                        <div className="gh-stats">
                                            <div className="stat-item">
                                                <BedDouble size={16} />
                                                <span>{gh.rooms?.length || 0} Rooms</span>
                                            </div>
                                            <div className="stat-item">
                                                <ChefHat size={16} />
                                                <span>{gh.kitchens?.length || 0} Kitchens</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state-container gh-empty-state-container">
                                <div className="gh-empty-icon-wrapper">
                                    <Building2 size={40} color="var(--text-light)" />
                                </div>
                                <h3 className="gh-empty-title">No Guest Houses Found</h3>
                                {/* <p className="gh-empty-text">
                                    {searchQuery ? `No results found for "${searchQuery}". Try a different search term.` : "Get started by adding your first guest house location."}
                                </p> */}
                                {searchQuery && <button className="btn-secondary" onClick={() => setSearchQuery('')}>Clear Search</button>}
                                {!searchQuery && <button className="btn-primary" onClick={handleAddNewGh}><Plus size={18} /> Add Guest House</button>}
                            </div>
                        )}
                    </div>
                    {showGHModal && (
                        <div className="modal-overlay">
                            <div className="modal-content gh-modal premium-card gh-modal-large">
                                <div className="modal-header">
                                    <div className="modal-title-group">
                                        <h2>{editingId ? 'Edit' : 'Add'} Guest House</h2>
                                    </div>
                                    <button onClick={() => setShowGHModal(false)} className="close-btn"><X size={24} /></button>
                                </div>
                                <div className="modal-body gh-modal-body-grid">
                                    <div className="form-section gh-form-section-full">
                                        <h4 className="section-title">Basic Information</h4>
                                        <div className="form-grid gh-form-grid-2col">
                                            <div className="form-group gh-form-section-full">
                                                <label>Property Name*</label>
                                                <input className="input-field" name="name" placeholder="e.g. TGS Corporate House - Mumbai" value={ghFormData.name} onChange={handleGhInputChange} />
                                            </div>

                                            <div className="form-group" style={{ zIndex: 20 }}>
                                                <label>Continent</label>
                                                <SearchableSelect
                                                    placeholder="Continent"
                                                    options={continents}
                                                    value={continents.find(c => c.id === ghFormData.continent_id)}
                                                    onChange={(val) => handleLocationSelect('continent', val)}
                                                    loading={geoLoading}
                                                />
                                            </div>
                                            <div className="form-group" style={{ zIndex: 19 }}>
                                                <label>Country</label>
                                                <SearchableSelect
                                                    placeholder="Country"
                                                    options={countries}
                                                    value={countries.find(c => c.id === ghFormData.country_id)}
                                                    onChange={(val) => handleLocationSelect('country', val)}
                                                    disabled={!ghFormData.continent_id}
                                                />
                                            </div>
                                            <div className="form-group" style={{ zIndex: 18 }}>
                                                <label>State</label>
                                                <SearchableSelect
                                                    placeholder="State"
                                                    options={states}
                                                    value={states.find(s => s.id === ghFormData.state_id)}
                                                    onChange={(val) => handleLocationSelect('state', val)}
                                                    disabled={!ghFormData.country_id}
                                                />
                                            </div>
                                            <div className="form-group" style={{ zIndex: 17 }}>
                                                <label>District</label>
                                                <SearchableSelect
                                                    placeholder="District"
                                                    options={districts}
                                                    value={districts.find(d => d.id === ghFormData.district_id)}
                                                    onChange={(val) => handleLocationSelect('district', val)}
                                                    disabled={!ghFormData.state_id}
                                                />
                                            </div>
                                            <div className="form-group" style={{ zIndex: 16 }}>
                                                <label>Mandal</label>
                                                <SearchableSelect
                                                    placeholder="Mandal"
                                                    options={mandals}
                                                    value={mandals.find(m => m.id === ghFormData.mandal_id)}
                                                    onChange={(val) => handleLocationSelect('mandal', val)}
                                                    disabled={!ghFormData.district_id}
                                                />
                                            </div>
                                            <div className="form-group" style={{ zIndex: 15 }}>
                                                <label>City / Cluster</label>
                                                <SearchableSelect
                                                    placeholder="Cluster"
                                                    options={clusters}
                                                    value={clusters.find(c => c.id === ghFormData.cluster_id)}
                                                    onChange={(val) => handleLocationSelect('cluster', val)}
                                                    disabled={!ghFormData.mandal_id}
                                                />
                                            </div>
                                            <div className="form-group" style={{ zIndex: 14 }}>
                                                <label>Visiting Location</label>
                                                <SearchableSelect
                                                    placeholder="Visiting Location"
                                                    options={visitingLocations}
                                                    value={visitingLocations.find(l => l.id === ghFormData.visiting_location_id)}
                                                    onChange={(val) => handleLocationSelect('visiting_location', val)}
                                                    disabled={!ghFormData.cluster_id}
                                                />
                                            </div>
                                            <div className="form-group" style={{ zIndex: 1 }}>
                                                <label>Pincode*</label>
                                                <input className="input-field" name="pincode" placeholder="e.g. 400069" value={ghFormData.pincode} onChange={handleGhInputChange} />
                                            </div>
                                            <div className="form-group gh-form-section-full">
                                                <label>Full Address*</label>
                                                <textarea className="input-field" name="address" rows="2" placeholder="Street, landmark, etc." value={ghFormData.address} onChange={handleGhInputChange}></textarea>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="form-section">
                                        <h4 className="section-title">Location Coordinates</h4>
                                        <div className="form-grid gh-form-grid-1col">
                                            <div className="form-group">
                                                <label>Latitude</label>
                                                <input className="input-field" name="latitude" placeholder="e.g. 19.0760" value={ghFormData.latitude} onChange={handleGhInputChange} />
                                            </div>
                                            <div className="form-group">
                                                <label>Longitude</label>
                                                <input className="input-field" name="longitude" placeholder="e.g. 72.8777" value={ghFormData.longitude} onChange={handleGhInputChange} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="form-section">
                                        <h4 className="section-title">Status & Description</h4>
                                        <div className="form-grid gh-form-grid-1col">
                                            <div className="form-group gh-status-group">
                                                <label>Operational Status</label>
                                                <div className="status-toggle-container">
                                                    <label className="toggle-switch">
                                                        <input type="checkbox" name="isActive" checked={ghFormData.isActive} onChange={handleGhInputChange} />
                                                        <span className="toggle-slider"></span>
                                                    </label>
                                                    <span className={`status-text-label ${ghFormData.isActive ? 'active' : 'inactive'}`}>
                                                        {ghFormData.isActive ? 'Active (Open for bookings)' : 'Inactive (Under maintenance)'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label>Notes / Description</label>
                                                <textarea className="input-field" name="description" rows="2" placeholder="Internal notes..." value={ghFormData.description} onChange={handleGhInputChange}></textarea>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="form-section gh-form-section-full">
                                        <h4 className="section-title">Property Image</h4>
                                        <div className="image-upload-wrapper">
                                            <div className="image-preview-box">
                                                {ghFormData.image ? (
                                                    <div className="preview-container">
                                                        <img src={ghFormData.image} alt="Preview" />
                                                        <button className="remove-btn" onClick={handleRemoveGhImage}><X size={14} /></button>
                                                    </div>
                                                ) : (
                                                    <div className="upload-placeholder" onClick={() => ghImageInputRef.current?.click()}>
                                                        <Building2 size={24} />
                                                        <span>Click to upload image</span>
                                                    </div>
                                                )}
                                            </div>
                                            <input type="file" ref={ghImageInputRef} onChange={handleGhImageChange} className="gh-upload-input" />
                                            <button className="btn-secondary btn-sm" onClick={() => ghImageInputRef.current?.click()}>Choose File</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn-secondary" onClick={() => setShowGHModal(false)}>Cancel</button>
                                    <button className="btn-primary" onClick={handleSaveGh}>
                                        {editingId ? <><Save size={18} /> Update Property</> : <><Plus size={18} /> Create Property</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {showItemModal && (
                <div className="modal-overlay">
                    <div className="modal-content gh-modal premium-card gh-modal-medium">
                        <div className="modal-header">
                            <div>
                                <h2>{editingItemId ? 'Edit' : 'Add'} {activeTab === 'laundry' ? 'Laundry' : toTitleCase(activeTab).slice(0, -1)}</h2>
                                <p className="modal-subtitle">Manage {activeTab} details</p>
                            </div>
                            <button onClick={() => setShowItemModal(false)} className="close-btn"><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid gh-form-grid-1col">
                                {activeTab === 'contacts' ? (
                                    <div className="form-group">
                                        <label>Role / Label*</label>
                                        <input className="input-field" placeholder="e.g. Caretaker, Manager" value={itemFormData.label} onChange={e => setItemFormData({ ...itemFormData, label: e.target.value })} />
                                        {formErrors.label && <span className="error-text">{formErrors.label}</span>}
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label>Name / Number*</label>
                                        <input className="input-field" placeholder={activeTab === 'rooms' ? "e.g. 101, 102" : activeTab === 'laundry' ? "e.g. Express Laundry" : "e.g. Main Kitchen, Chef John"} value={itemFormData.name} onChange={e => setItemFormData({ ...itemFormData, name: e.target.value })} />
                                        {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                                    </div>
                                )}

                                {activeTab === 'rooms' && (
                                    <div className="form-group">
                                        <label>Room Type</label>
                                        <div className="select-wrapper">
                                            <select className="input-field" value={itemFormData.type} onChange={e => setItemFormData({ ...itemFormData, type: e.target.value })}>
                                                <option value="single">Single Bed</option>
                                                <option value="double">Double Bed</option>
                                                <option value="suite">Suite</option>
                                            </select>
                                            <ChevronDown size={16} className="select-icon" />
                                        </div>
                                    </div>
                                )}

                                {(activeTab === 'cooks' || activeTab === 'contacts' || activeTab === 'laundry') && (
                                    <div className="form-group">
                                        <label>Phone Number*</label>
                                        <input className="input-field" placeholder="10-digit mobile number" maxLength={10} value={itemFormData.phone} onChange={e => setItemFormData({ ...itemFormData, phone: e.target.value })} />
                                        {formErrors.phone && <span className="error-text">{formErrors.phone}</span>}
                                    </div>
                                )}

                                {activeTab === 'contacts' && (
                                    <div className="form-group">
                                        <label>Email Address</label>
                                        <input className="input-field" type="email" placeholder="Optional" value={itemFormData.email} onChange={e => setItemFormData({ ...itemFormData, email: e.target.value })} />
                                    </div>
                                )}

                                {activeTab === 'cooks' && (
                                    <div className="form-group">
                                        <label>Specialty</label>
                                        <input className="input-field" placeholder="e.g. North Indian, Continental" value={itemFormData.specialty} onChange={e => setItemFormData({ ...itemFormData, specialty: e.target.value })} />
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>{activeTab === 'cooks' ? 'Current Availability' : 'Status'}</label>
                                    <div className="select-wrapper">
                                        <select className="input-field" value={itemFormData.status} onChange={e => setItemFormData({ ...itemFormData, status: e.target.value })}>
                                            <option value="Available">Available</option>
                                            <option value="Occupied">Occupied / Busy</option>
                                            <option value="Maintenance">Maintenance / Leave</option>
                                        </select>
                                        <ChevronDown size={16} className="select-icon" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowItemModal(false)}>Cancel</button>
                            <button className="btn-primary" onClick={handleSaveItem}>
                                <Save size={18} /> Save {activeTab === 'rooms' ? 'Room' : 'Item'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showBookingModal && ReactDOM.createPortal(
                <div className="modal-overlay">
                    <div className="modal-content booking-modal premium-card">
                        <div className="modal-header"><h2>New Booking</h2><button onClick={() => setShowBookingModal(false)} className="close-btn"><X size={20} /></button></div>
                        <div className="modal-body">
                            <div className="booking-tabs">{['Official', 'Personal', 'Maintenance'].map(t => <button key={t} className={`booking-tab ${bookingTab === t ? 'active' : ''}`} onClick={() => setBookingTab(t)}>{t}</button>)}</div>
                            <div className="booking-form">
                                {bookingTab === 'Official' && (
                                    <div className="form-group">
                                        <label>Search Trip</label>
                                        <div className="select-wrapper gh-select-wrapper-relative" ref={inputRef}>
                                            <div className="gh-search-input-wrapper">
                                                <input
                                                    className="input-field gh-input-pointer"
                                                    value={tripSearch}
                                                    onChange={e => {
                                                        setTripSearch(e.target.value);
                                                        setShowTripResults(true);
                                                    }}
                                                    onClick={() => setShowTripResults(true)}
                                                    onFocus={() => setShowTripResults(true)}
                                                    placeholder="Select or Search Trip..."
                                                    autoComplete="off"
                                                />
                                                <ChevronDown size={16} className="gh-chevron-absolute" />
                                            </div>
                                            {tripSearch && (
                                                <button
                                                    className="clear-search-btn gh-clear-search-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setTripSearch('');
                                                        setBookingData({ ...bookingData, tripId: null });
                                                        setShowTripResults(true);
                                                    }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                        {showTripResults && ReactDOM.createPortal(
                                            <div
                                                ref={dropdownRef}
                                                className="combobox-results gh-combobox-results"
                                            >
                                                {isLoadingTrips ? (
                                                    <div className="gh-combobox-loader">
                                                        <span className="animate-spin gh-spinner">⟳</span> Loading trips...
                                                    </div>
                                                ) : trips.length > 0 ? trips.map(t => (
                                                    <div key={t.id} className="combobox-item gh-combobox-item"
                                                        onClick={() => {
                                                            setTripSearch(`${t.trip_id} - ${t.employee}`);
                                                            setBookingData({
                                                                ...bookingData,
                                                                tripId: t.id,
                                                                employeeName: t.employee,
                                                                checkInDate: t.startDate ? new Date(t.startDate).toISOString().slice(0, 16) : '',
                                                                checkOutDate: t.endDate ? new Date(t.endDate).toISOString().slice(0, 16) : ''
                                                            });
                                                            setShowTripResults(false);
                                                        }}
                                                    >
                                                        <div className="gh-combobox-row">
                                                            <span className="gh-combobox-id">{t.trip_id}</span>
                                                            <span className="gh-combobox-date">{t.startDate}</span>
                                                        </div>
                                                        <div className="gh-combobox-title">{t.title || t.destination}</div>
                                                        <div className="gh-combobox-subtitle">{t.employee}</div>
                                                    </div>
                                                )) : (
                                                    <div className="combobox-no-results gh-combobox-no-results">
                                                        <p className="gh-no-trips-title">No trips found</p>
                                                        <small className="gh-no-trips-subtitle">Try searching by ID, name, or location</small>
                                                    </div>
                                                )}
                                            </div>,
                                            document.body
                                        )}
                                    </div>
                                )}

                                {bookingTab === 'Personal' && (
                                    <>
                                        <div className="form-group">
                                            <label>Guest Name*</label>
                                            <input className="input-field" value={bookingData.employeeName} onChange={e => setBookingData({ ...bookingData, employeeName: e.target.value })} placeholder="Enter guest name" />
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Phone Number*</label>
                                                <input className="input-field" value={bookingData.guestPhone || ''} onChange={e => setBookingData({ ...bookingData, guestPhone: e.target.value })} placeholder="10-digit number" maxLength={10} />
                                            </div>
                                            <div className="form-group">
                                                <label>Guests</label>
                                                <input type="number" min="1" className="input-field" value={bookingData.guestCount || 1} onChange={e => setBookingData({ ...bookingData, guestCount: parseInt(e.target.value) || 1 })} />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {bookingTab === 'Maintenance' && (
                                    <div className="maintenance-fields">
                                        <div className="form-group">
                                            <label>Maintenance Reason / Issue*</label>
                                            <div className="select-wrapper">
                                                <select
                                                    className="input-field"
                                                    value={bookingData.maintenanceType}
                                                    onChange={e => setBookingData({ ...bookingData, maintenanceType: e.target.value })}
                                                >
                                                    <option value="Painting">Painting</option>
                                                    <option value="Plumbing">Plumbing Works</option>
                                                    <option value="Electrical">Electrical Works</option>
                                                    <option value="Cleaning">Deep Cleaning</option>
                                                    <option value="Carpentry">Carpentry</option>
                                                    <option value="Not Available">Not Available (General)</option>
                                                    <option value="Other">Other (Specify in Remarks)</option>
                                                </select>
                                                <ChevronDown size={16} className="select-icon" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Check In</label>
                                        <input
                                            type="datetime-local"
                                            className="input-field"
                                            min={new Date().toISOString().slice(0, 16)}
                                            value={bookingData.checkInDate}
                                            onChange={e => setBookingData({ ...bookingData, checkInDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Check Out</label>
                                        <input
                                            type="datetime-local"
                                            className="input-field"
                                            min={bookingData.checkInDate || new Date().toISOString().slice(0, 16)}
                                            value={bookingData.checkOutDate}
                                            onChange={e => setBookingData({ ...bookingData, checkOutDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="form-group"><label>Remarks</label><textarea className="input-field" value={bookingData.remarks} onChange={e => setBookingData({ ...bookingData, remarks: e.target.value })}></textarea></div>
                            </div>
                        </div>
                        <div className="modal-footer"><button className="btn-secondary" onClick={() => setShowBookingModal(false)}>Cancel</button><button className="confirm-btn" onClick={handleBookingSave}>Confirm</button></div>
                    </div>
                </div>, document.body
            )}

            <Modal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                title={deleteModal.title}
                type="warning"
                actions={
                    <>
                        <button className="btn-secondary" onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}>Cancel</button>
                        <button className="btn-primary btn-danger-custom" onClick={executeDelete}>Confirm Delete</button>
                    </>
                }
            >
                <p>{deleteModal.message}</p>
            </Modal>
        </div>
    );
};

export default GuestHouse;
