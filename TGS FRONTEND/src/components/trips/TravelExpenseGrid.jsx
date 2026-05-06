import { formatIndianCurrency } from '../../utils/formatters';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Plus,
    Trash2,
    Upload,
    Check,
    X,
    ChevronDown,
    ChevronUp,
    Clock,
    Camera,
    FileText,
    Calendar,
    MapPin,
    Car,
    Plane,
    Coffee,
    Hotel,
    AlertCircle,
    CheckCircle2,
    Info,
    Receipt,
    Navigation,
    Home,
    IndianRupee,
    AlertTriangle,
    RotateCcw,
    XCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';
import { useToast } from '../../context/ToastContext';


const NATURE_OPTIONS = [
    { value: 'Travel', label: 'Travel', icon: <Plane size={14} /> },
    { value: 'Local Travel', label: 'Local Travel', icon: <Car size={14} /> },
    { value: 'Food', label: 'Food & Refreshments', icon: <Coffee size={14} /> },
    { value: 'Accommodation', label: 'Accommodation', icon: <Hotel size={14} /> },
    { value: 'Incidental', label: 'Incidental Expenses', icon: <Receipt size={14} /> },
    { value: 'Review', label: 'Final Review', icon: <CheckCircle2 size={14} /> }
];

// Constants below are used as fallbacks if Master API fails or is empty
const FALLBACK_TRAVEL_MODES = ['Flight', 'Train', 'Intercity Bus', 'Intercity Cab'];
const FALLBACK_BOOKED_BY_OPTIONS = ['Self Booked', 'Company Booked'];
const FALLBACK_LOCAL_TRAVEL_MODES = ['Car / Cab', 'Bike', 'Public Transport'];
const FALLBACK_LOCAL_CAR_SUBTYPES = ['Own Car', 'Company Car', 'Rented Car (With Driver)', 'Self Drive Rental', 'Ride Hailing', 'Pool Vehicle'];
const FALLBACK_LOCAL_BIKE_SUBTYPES = ['Own Bike', 'Rental Bike', 'Ride Bike'];
const FALLBACK_LOCAL_PT_SUBTYPES = ['Auto', 'Metro', 'Local Bus'];
const FALLBACK_ACCOM_TYPES = ['Hotel Stay', 'Bavya Guest House', 'Client Provided', 'Self Stay', 'No Stay'];
const FALLBACK_ROOM_TYPES = ['Standard', 'Deluxe', 'Executive', 'Suite', 'Guest House'];
const FALLBACK_FLIGHT_CLASSES = ['Economy', 'Premium Economy', 'Business', 'First'];
const FALLBACK_TRAIN_CLASSES = ['Sleeper', '3AC', '2AC', '1AC', 'Chair Car', 'General'];
const FALLBACK_BUS_SEAT_TYPES = ['Sleeper', 'Semi Sleeper', 'AC', 'Non-AC', 'Volvo', 'Seater'];
const FALLBACK_INCIDENTAL_TYPES = ['Parking Charges', 'Toll Charges', 'Luggage Charges', 'Porter Charges', 'Internet / WiFi', 'Others'];

const TRAVEL_STATUSES = ['Completed', 'Cancelled', 'Rescheduled'];
const LOCAL_TRAVEL_STATUSES = ['Completed', 'Cancelled', 'No-Show'];

const MOCK_DATA = [
    {
        id: 'mock-1',
        date: '2026-02-24',
        nature: 'Travel',
        details: { origin: 'Mumbai', destination: 'Delhi', mode: 'Airways', provider: 'IndiGo (6E-201)' },
        timeDetails: { boardingTime: '08:00', scheduledTime: '08:30', delay: 45, actualTime: '09:15' },
        amount: '6500',
        remarks: 'Direct flight for Client Kick-off',
        claim: true,
        isExpanded: true
    },
    {
        id: 'mock-2',
        date: '2026-02-24',
        nature: 'Local Travel',
        details: { location: 'Airport to Hotel', mode: 'Taxi', vehicleType: 'Service', provider: 'Uber Premier' },
        timeDetails: { boardingTime: '', scheduledTime: '', delay: 0, actualTime: '' },
        amount: '850',
        remarks: 'Airport transfer',
        claim: true,
        isExpanded: true
    },
    {
        id: 'mock-3',
        date: '2026-02-24',
        nature: 'Local Travel',
        details: { location: 'Hotel to Client Office', mode: 'Car', vehicleType: 'Own', odoStart: '12400', odoEnd: '12425' },
        timeDetails: { boardingTime: '', scheduledTime: '', delay: 0, actualTime: '' },
        amount: '500',
        remarks: 'Personal Car for local commute',
        claim: true,
        isExpanded: true
    },
    {
        id: 'mock-4',
        date: '2026-02-24',
        nature: 'Food',
        details: { mealType: 'Lunch', restaurant: 'The Imperial Grill', persons: '3', invoiceNo: 'INV-9021' },
        timeDetails: { boardingTime: '', scheduledTime: '', delay: 0, actualTime: '' },
        amount: '2800',
        remarks: 'Team lunch with client partners',
        claim: true,
        isExpanded: true
    },
    {
        id: 'mock-5',
        date: '2026-02-24',
        nature: 'Accommodation',
        details: { city: 'New Delhi', hotelName: 'ITC Maurya', roomType: 'Executive', checkIn: '2026-02-24', checkOut: '2026-02-26', nights: 2 },
        timeDetails: { boardingTime: '', scheduledTime: '', delay: 0, actualTime: '' },
        amount: '18500',
        remarks: '2 nights corporate stay',
        claim: true,
        isExpanded: true
    }
];

const TravelExpenseGrid = ({
    tripId,
    startDate,
    endDate,
    initialExpenses = [],
    totalAdvance = 0,
    onUpdate,
    tripStatus,
    claimStatus,
    // array of allowed nature values (e.g. ['Local Travel']); if null all are allowed
    allowedNatures = null,
    // whether to show the bulk upload button (default true)
    showBulkUpload = true,
    isBulkUpload = false,
    onJobReportClick,
    dateFilter = 'Last 7 Days',
    onFilterChange
}) => {
    // Master data states
    const [travelModes, setTravelModes] = useState(FALLBACK_TRAVEL_MODES);
    const [bookedByOptions, setBookedByOptions] = useState(FALLBACK_BOOKED_BY_OPTIONS);
    const [flightClasses, setFlightClasses] = useState(FALLBACK_FLIGHT_CLASSES);
    const [trainClasses, setTrainClasses] = useState(FALLBACK_TRAIN_CLASSES);
    const [busSeatTypes, setBusSeatTypes] = useState(FALLBACK_BUS_SEAT_TYPES);
    const [intercityCabVehicleTypes, setIntercityCabVehicleTypes] = useState(['Sedan', 'SUV', 'MUV', 'Hatchback']);
    const [airlines, setAirlines] = useState([]);
    const [busOperators, setBusOperators] = useState([]);
    const [travelProviders, setTravelProviders] = useState([]);
    const [trainProviders, setTrainProviders] = useState([]);
    const [busProviders, setBusProviders] = useState([]);
    const [cabProviders, setCabProviders] = useState([]);

    // Local Masters
    const [localTravelModes, setLocalTravelModes] = useState(FALLBACK_LOCAL_TRAVEL_MODES);
    const [localCarSubTypes, setLocalCarSubTypes] = useState(FALLBACK_LOCAL_CAR_SUBTYPES);
    const [localBikeSubTypes, setLocalBikeSubTypes] = useState(FALLBACK_LOCAL_BIKE_SUBTYPES);
    const [localProviders, setLocalProviders] = useState([]);

    // Stay Masters
    const [stayTypes, setStayTypes] = useState(FALLBACK_ACCOM_TYPES);
    const [roomTypes, setRoomTypes] = useState(FALLBACK_ROOM_TYPES);

    // Food Masters
    const [mealCategories, setMealCategories] = useState(['Self Meal', 'Working Meal', 'Client Hosted']);
    const [mealTypes, setMealTypes] = useState([]);

    // Incidental Masters
    const [incidentalTypes, setIncidentalTypes] = useState(FALLBACK_INCIDENTAL_TYPES);

    const [rows, setRows] = useState([]);
    // when trip id doesn't start with TRP, entries are treated as bike/self-booked and locked
    const isFixedLocal = tripId && !tripId.toLowerCase().startsWith('trp');
    const [errors, setErrors] = useState({}); // { rowId: { fieldKey: message } }
    const enabledNatures = allowedNatures || NATURE_OPTIONS.map(o => o.value);
    const [activeCategory, setActiveCategory] = useState(enabledNatures[0] || 'Travel'); // default to first allowed
    const isLocalOnly = enabledNatures.length === 1 && enabledNatures[0] === 'Local Travel';
    // rows filtered to allowed natures for display/calculations
    const displayRows = allowedNatures ? rows.filter(r => allowedNatures.includes(r.nature)) : rows;
    const prevCategoryRef = useRef('Travel'); // keep last known category across syncs
    const [isSaving, setIsSaving] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deviationModal, setDeviationModal] = useState({ show: false, rowId: null, reason: '', target: '', actualFrom: '', actualTo: '' });
    const [isLocating, setIsLocating] = useState(false);
    const [carryingLuggage, setCarryingLuggage] = useState(false);
    const [luggageWeight, setLuggageWeight] = useState('');
    const { showToast, confirm } = useToast();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const activeRowRef = useRef(null);
    const activeFieldRef = useRef(null);
    const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: null, type: 'warning' });
    const [reviewFilter, setReviewFilter] = useState('All');
    const [focusedInput, setFocusedInput] = useState(null); // { rowId: string, field: 'amount' }
    const [jobReportDraft, setJobReportDraft] = useState({}); // { rowId: draftText }
    const [jobReportOpen, setJobReportOpen] = useState({}); // { rowId: bool } — composer open/viewing

    // Fuel Rate State: { '2 Wheeler': 8.5, '4 Wheeler': 12.0 }
    const [fuelRates, setFuelRates] = useState({});

    // Bulk Upload State
    const [bulkModal, setBulkModal] = useState({ visible: false, file: null, uploading: false, activeTab: 'upload' });
    const [processedBatchIds, setProcessedBatchIds] = useState([]); // Track batches handled in this session
    const [bulkHistory, setBulkHistory] = useState([]);
    const [resubmitModal, setResubmitModal] = useState({ visible: false, batchId: null, rows: [], submitting: false });

    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    useEffect(() => {
        const fetchMasters = async () => {
            // Determine which categories of masters we actually need
            const needsTravel = !allowedNatures || allowedNatures.some(n => ['Travel'].includes(n));
            const needsLocal = !allowedNatures || allowedNatures.some(n => ['Local Travel'].includes(n));
            const needsFood = !allowedNatures || allowedNatures.some(n => ['Food'].includes(n));
            const needsStay = !allowedNatures || allowedNatures.some(n => ['Accommodation'].includes(n));
            const needsIncidental = !allowedNatures || allowedNatures.some(n => ['Incidental'].includes(n));

            // Helper to fetch and set state if successful
            const safeFetch = async (url, setter, mapper) => {
                try {
                    const res = await api.get(url);
                    if (res.data && res.data.length > 0) {
                        const data = mapper ? res.data.map(mapper) : res.data;
                        setter(data);
                    }
                } catch (e) {
                    // Fail silently to avoid cluttering console for non-critical masters
                    console.warn(`Optional master fetch failed: ${url}`);
                }
            };

            const tasks = [];

            if (needsTravel) {
                tasks.push(safeFetch('/api/travel-mode-masters/', setTravelModes, m => m.status ? m.mode_name : null));
                tasks.push(safeFetch('/api/booking-type-masters/', setBookedByOptions, m => m.status ? m.booking_type : null));
                tasks.push(safeFetch('/api/flight-class-masters/', setFlightClasses, m => m.status ? m.class_name : null));
                tasks.push(safeFetch('/api/train-class-masters/', setTrainClasses, m => m.status ? m.class_name : null));
                tasks.push(safeFetch('/api/bus-type-masters/', setBusSeatTypes, m => m.status ? m.bus_type : null));
                tasks.push(safeFetch('/api/intercity-cab-vehicle-masters/', setIntercityCabVehicleTypes, m => m.status ? m.vehicle_type : null));
                tasks.push(safeFetch('/api/airline-masters/', setAirlines, m => m.status ? m.airline_name : null));
                tasks.push(safeFetch('/api/bus-operator-masters/', setBusOperators, m => m.status ? m.operator_name : null));
                tasks.push(safeFetch('/api/travel-provider-masters/', setTravelProviders, m => m.status ? m.provider_name : null));
                tasks.push(safeFetch('/api/train-provider-masters/', setTrainProviders, m => m.status ? m.provider_name : null));
                tasks.push(safeFetch('/api/bus-provider-masters/', setBusProviders, m => m.status ? m.provider_name : null));
                tasks.push(safeFetch('/api/intercity-cab-provider-masters/', setCabProviders, m => m.provider_name));
            }

            if (needsLocal) {
                tasks.push(safeFetch('/api/local-travel-mode-masters/', setLocalTravelModes, m => m.status ? m.mode_name : null));
                tasks.push(safeFetch('/api/local-car-subtype-masters/', setLocalCarSubTypes, m => m.status ? m.sub_type : null));
                tasks.push(safeFetch('/api/local-bike-subtype-masters/', setLocalBikeSubTypes, m => m.status ? m.sub_type : null));
                tasks.push(safeFetch('/api/local-provider-masters/', setLocalProviders, m => m.status ? m.provider_name : null));
            }

            if (needsStay) {
                tasks.push(safeFetch('/api/stay-type-masters/', setStayTypes, m => m.status ? m.stay_type : null));
                tasks.push(safeFetch('/api/room-type-masters/', setRoomTypes, m => m.status ? m.room_type : null));
            }

            if (needsFood) {
                tasks.push(safeFetch('/api/meal-category-masters/', setMealCategories, m => m.status ? m.category_name : null));
                tasks.push(safeFetch('/api/meal-type-masters/', setMealTypes, m => m.status ? m.meal_type : null));
            }

            if (needsIncidental) {
                tasks.push(safeFetch('/api/incidental-type-masters/', setIncidentalTypes, m => m.status ? m.expense_type : null));
            }

            await Promise.allSettled(tasks);
        };
        fetchMasters();

        // Fetch fuel rates for 2 Wheeler and 4 Wheeler for current user's state
        const fetchFuelRates = async () => {
            try {
                const [rate2W, rate4W] = await Promise.all([
                    api.get('/api/masters/fuel-rate-masters/my_rate/?vehicle_type=2 Wheeler'),
                    api.get('/api/masters/fuel-rate-masters/my_rate/?vehicle_type=4 Wheeler')
                ]);
                const rates = {};
                if (rate2W.data?.rate_per_km) rates['2 Wheeler'] = parseFloat(rate2W.data.rate_per_km);
                if (rate4W.data?.rate_per_km) rates['4 Wheeler'] = parseFloat(rate4W.data.rate_per_km);
                if (Object.keys(rates).length > 0) setFuelRates(rates);
            } catch (err) {
                console.warn('Could not fetch fuel rates:', err);
            }
        };
        fetchFuelRates();
        fetchBulkHistory();
    }, [tripId]);

    const fetchBulkHistory = async () => {
        if (!tripId) return;
        try {
            const res = await api.get(`/api/bulk-activities/?trip_id=${tripId}`);
            // Handle both plain array and paginated { results: [...] } responses
            const data = res.data;
            if (Array.isArray(data)) {
                setBulkHistory(data);
            } else if (data && Array.isArray(data.results)) {
                setBulkHistory(data.results);
            } else {
                setBulkHistory([]);
            }
        } catch (err) {
            console.error("Failed to fetch bulk history:", err);
            setBulkHistory([]);
        }
    };

    // --- DATE RANGE CONSTRAINTS (Helper to avoid timezone shifts) ---
    const toYMD = (date) => {
        if (!date || isNaN(date.getTime())) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const parseSafeDate = (dStr) => {
        if (!dStr) return null;
        // Handle common formats: YYYY-MM-DD or DD-MM-YYYY
        if (typeof dStr === 'string' && dStr.includes('-')) {
            const parts = dStr.split('-');
            if (parts[0].length === 4) return new Date(parts[0], parts[1] - 1, parts[2]); // YYYY-MM-DD
            if (parts[2].length === 4) return new Date(parts[2], parts[1] - 1, parts[0]); // DD-MM-YYYY
        }
        return new Date(dStr);
    };

    const getMinDate = () => {
        if (!startDate) return undefined;
        try {
            const d = parseSafeDate(startDate);
            if (!d) return undefined;
            d.setDate(d.getDate() - 1);
            return toYMD(d);
        } catch (e) { return undefined; }
    };

    const getMaxDate = () => {
        if (!endDate) return undefined;
        try {
            const d = parseSafeDate(endDate);
            if (!d) return undefined;
            d.setDate(d.getDate() + 2); // Increased grace to 2 days
            return toYMD(d);
        } catch (e) { return undefined; }
    };

    const minDate = getMinDate();
    const maxDate = getMaxDate();

    const getFullUrl = (path) => {
        if (!path) return '';
        let p = String(path).trim();

        // Robust cleaning for common legacy formats
        p = p.replace(/^\[u'/, '').replace(/^u'/, '').replace(/^'/, '');
        p = p.replace(/'\]$/, '').replace(/'$/, '');

        if (p.startsWith('http') || p.startsWith('data:')) return p;

        // Detect base64 direct strings
        if (p.startsWith('/9j/') || p.length > 500) {
            return `data:image/jpeg;base64,${p}`;
        }

        const backendBase = api.defaults.baseURL || 'http://192.168.1.138:4567';
        return `${backendBase}${p.startsWith('/') ? '' : '/'}${p}`;
    };

    const isTripApproved = ['approved', 'hr approved', 'on-going'].includes(tripStatus?.toLowerCase());

    const isSameDayTrip = () => {
        return rows.some(r => r.nature === 'Travel' && r.details.mode === 'Intercity Car' && r.date === (r.endDate || r.date));
    };

    useEffect(() => {
        // restore the category after syncing with server data, but only if
        // the previously active category is still permitted (e.g. when the
        // grid is restricted to local conveyance we shouldn't switch back to
        // Travel which may be disallowed).
        if (prevCategoryRef.current && enabledNatures.includes(prevCategoryRef.current)) {
            setActiveCategory(prevCategoryRef.current);
        }

        if (initialExpenses && initialExpenses.length > 0) {
            const syncedRows = initialExpenses.map(exp => {
                let details = { description: exp.description || '' };
                try {
                    if (typeof exp.description === 'string' && exp.description.startsWith('{')) {
                        details = JSON.parse(exp.description);
                    }
                } catch (e) { }

                if (!details.auditTrail) details.auditTrail = [];
                if (!details.travelStatus) details.travelStatus = 'Completed';

                // Map bulk/deviation flags from backend record
                if (exp.from_bulk_upload) details.from_bulk_upload = true;
                if (exp.is_deviated) {
                    details.is_deviated = true;
                    details.deviation_reason = exp.deviation_reason || details.deviation_reason;
                    details.visitedPerson = exp.deviation_target || details.visitedPerson;
                    // Preference for explicit actualFrom/To if they exist in description, 
                    // otherwise check if backend top-level fields exist (if any)
                    details.actualFrom = details.actualFrom || details.origin;
                    details.actualTo = details.actualTo || details.destination;
                }
                if (exp.cancellation_status) details.travelStatus = exp.cancellation_status;

                // Map jobReportAttachments from mobile to jobReportFiles for web UI
                if (details.jobReportAttachments && !details.jobReportFiles) {
                    details.jobReportFiles = details.jobReportAttachments.map(url => ({
                        data: url,
                        name: url.split('/').pop() || 'attachment'
                    }));
                }

                const natureVal = exp.category === 'Others' ? 'Travel' : (exp.category === 'Fuel' ? 'Local Travel' : exp.category);

                // Initialize timeDetails with robust fallbacks for different data sources (mobile/web/bulk)
                const timeDetails = details.time || {
                    boardingTime: details.startTime || details.start_time || '',
                    scheduledTime: '',
                    delay: 0,
                    actualTime: details.endTime || details.reach_time || ''
                };

                // enforce fixed fields for non-TRP trip ids and local travel entries
                if (isFixedLocal && natureVal === 'Local Travel') {
                    details.mode = 'Bike';
                    details.subType = 'Own Bike';
                    details.bookedBy = 'Self Booked';
                }
                return {
                    id: exp.id || Math.random().toString(36).substr(2, 9),
                    date: exp.date || new Date().toISOString().split('T')[0],
                    nature: natureVal,
                    details: details,
                    timeDetails: timeDetails,
                    amount: exp.amount || '',
                    remarks: details.remarks || exp.remarks || '',
                    bills: (() => {
                        try {
                            if (typeof exp.receipt_image === 'string' && exp.receipt_image.startsWith('[')) {
                                return JSON.parse(exp.receipt_image);
                            }
                        } catch (e) { }
                        return exp.receipt_image ? [exp.receipt_image] : [];
                    })(),
                    claim: true,
                    isExpanded: true,
                    isSaved: true
                };
            });
            // Preserve rows that haven't been saved yet when syncing
            setRows(currentRows => {
                const syncedIds = new Set(syncedRows.map(r => r.id));
                // Filter currentRows to keep only those that:
                // 1. Are not yet saved (isSaved: false)
                // 2. Are not already present in the new syncedRows (by ID)
                // 3. Do not match any syncedRow by content (for new entries that got a real ID from backend)
                const unsavedRows = currentRows.filter(r => {
                    if (r.isSaved) return false;
                    if (syncedIds.has(r.id)) return false;

                    // Special case for newly created rows that just got a real ID in backend
                    // but still have a temporary random ID in local state.
                    const isAlreadyInBackend = syncedRows.some(sr =>
                        sr.date === r.date &&
                        sr.nature === r.nature &&
                        Math.abs(parseFloat(sr.amount || 0) - parseFloat(r.amount || 0)) < 0.01 &&
                        sr.details.origin === r.details.origin &&
                        sr.details.destination === r.details.destination
                    );
                    return !isAlreadyInBackend;
                });
                return [...syncedRows, ...unsavedRows];
            });
        }
    }, [initialExpenses]);

    // ensure activeCategory stays valid if allowedNatures changes
    useEffect(() => {
        if (!enabledNatures.includes(activeCategory)) {
            setActiveCategory(enabledNatures[0] || activeCategory);
        }
    }, [enabledNatures]);

    // keep ref up to date whenever user switches tabs
    useEffect(() => {
        prevCategoryRef.current = activeCategory;
    }, [activeCategory]);

    const saveRegistry = async () => {
        setErrors({}); // clear previous inline errors
        if (rows.length === 0) {
            showToast("No expenses to save", "info");
            return false;
        }

        // --- DUPLICATE ENTRY CHECK ---
        const entrySet = new Set();
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            let key = '';
            if (row.nature === 'Travel') {
                key = `Travel|${row.date}|${row.details.mode}|${row.details.origin}|${row.details.destination}|${row.details.pnr || ''}`;
            } else if (row.nature === 'Local Travel') {
                key = `Local|${row.date}|${row.details.mode || ''}|${row.details.subType || ''}|${row.details.origin || ''}|${row.details.destination || ''}`;
            } else if (row.nature === 'Food') {
                key = `Food|${row.date}|${row.details.mealType}|${row.details.restaurant}`;
            } else if (row.nature === 'Accommodation') {
                key = `Hotel|${row.date}|${row.details.hotelName}|${row.details.city}`;
            } else if (row.nature === 'Incidental') {
                key = `Incidental|${row.date}|${row.details.incidentalType}`;
            } else {
                key = `Other|${row.nature}|${row.date}|${row.amount}|${row.remarks}`;
            }

            if (entrySet.has(key)) {
                showToast(`Duplicate entry detected at row #${i + 1}. Please remove or modify unique details like PNR or Route.`, "error");
                return false;
            }
            entrySet.add(key);
        }

        // --- PRE-FLIGHT VALIDATION ---
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 1;

            // --- TAB-AWARE VALIDATION ---
            // If we are not in the 'Review' tab, only validate rows that belong to the active category.
            // This prevents hidden, incomplete rows in other tabs from blocking the save of the current tab.
            if (activeCategory !== 'Review' && row.nature !== activeCategory) {
                continue;
            }

            // DATE RANGE VALIDATION (using robust Date comparison)
            if (minDate && maxDate) {
                const rowDateObj = parseSafeDate(row.date);
                const minDateObj = parseSafeDate(minDate);
                const maxDateObj = parseSafeDate(maxDate);

                if (rowDateObj && minDateObj && maxDateObj) {
                    const rowTime = rowDateObj.getTime();
                    if (rowTime < minDateObj.getTime() || rowTime > maxDateObj.getTime()) {
                        showToast(`Item #${rowNum}: Selected date (${row.date}) is outside trip range. Only trip dates +/- 2 days grace allowed.`, "error");
                        return false;
                    }
                }

                if (row.nature === 'Accommodation') {
                    const checkInObj = parseSafeDate(row.details.checkIn);
                    const checkOutObj = parseSafeDate(row.details.checkOut);

                    if (checkInObj && (checkInObj.getTime() < minDateObj.getTime() || checkInObj.getTime() > maxDateObj.getTime())) {
                        showToast(`Item #${rowNum}: Check-In date is outside trip range.`, "error");
                        return false;
                    }
                    if (checkOutObj && (checkOutObj.getTime() < minDateObj.getTime() || checkOutObj.getTime() > maxDateObj.getTime())) {
                        showToast(`Item #${rowNum}: Check-Out date is outside trip range.`, "error");
                        return false;
                    }
                }
            }

            // AMOUNT
            if (row.amount === '' || row.amount === null || row.amount === undefined || isNaN(parseFloat(row.amount))) {
                showToast(`Item #${rowNum}: Please enter a valid numeric amount.`, "error");
                return false;
            }
            // require bill if any charge present (Exempt Odometer-based Local Travel as they use Odo photos)
            const isOdoLocal = row.nature === 'Local Travel' && (row.details.subType === 'Own Car' || row.details.subType === 'Own Bike');
            const isIncidental = row.nature === 'Incidental';
            if (parseFloat(row.amount) > 0 && !isOdoLocal && !isIncidental && (!row.bills || row.bills.length === 0)) {
                showToast(`Item #${rowNum}: Please upload a bill as amount is entered.`, "error");
                return false;
            }
            const amt = parseFloat(row.amount);
            if (amt < 0) {
                showToast(`Item #${rowNum}: Amount cannot be negative.`, "error");
                return false;
            }
            // two decimal places
            if (!/^\d+(\.\d{1,2})?$/.test(String(row.amount))) {
                showToast(`Item #${rowNum}: Amount can have at most two decimal places.`, "error");
                return false;
            }
            // TODO: compare against company policy limit if available


            if (row.nature === 'Travel') {
                const { mode, origin, destination, travelStatus, bookedBy, provider, ticketNo, pnr, travelNo, depDate, arrDate } = row.details;
                const isSelfBooked = bookedBy !== 'Company Booked';

                // Booking date must always be present
                if (!row.date) {
                    showToast(`Item #${rowNum}: Booking Date is required.`, "error");
                    return false;
                }

                // COMMON MANDATORY FIELDS
                if (!mode) {
                    showToast(`Item #${rowNum}: Please select a Travel Mode.`, "error");
                    return false;
                }

                // origin/destination validations
                if (!origin || !destination) {
                    showToast(`Item #${rowNum}: Origin and Destination are required for Travel entries.`, "error");
                    return false;
                }
                if (origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
                    showToast(`Item #${rowNum}: Origin and Destination cannot be the same.`, "error");
                    return false;
                }
                const locRegex = /^[A-Za-z ]{2,}$/;
                if (!locRegex.test(origin) || !locRegex.test(destination)) {
                    showToast(`Item #${rowNum}: From/To must be at least 2 alphabetic characters.`, "error");
                    return false;
                }
                // invoice number validation (alphanumeric, max 30)
                if (row.details.invoiceNo) {
                    const inv = row.details.invoiceNo;
                    if (!/^[A-Za-z0-9]+$/.test(inv)) {
                        showToast(`Item #${rowNum}: Invoice Number may only be alphanumeric.`, "error");
                        return false;
                    }
                    if (inv.length > 30) {
                        showToast(`Item #${rowNum}: Invoice Number cannot exceed 30 characters.`, "error");
                        return false;
                    }
                }
                // carrier name allowed letters and spaces
                if (row.details.carrier && !/^[A-Za-z ]+$/.test(row.details.carrier)) {
                    showToast(`Item #${rowNum}: Carrier name may only contain letters and spaces.`, "error");
                    return false;
                }

                // universal date order checks
                const bookDateObj = new Date(row.date);
                const depDateObj = new Date(depDate || row.date);
                const arrDateObj = new Date(arrDate || row.date);
                if (depDateObj < bookDateObj) {
                    setRowError(row.id, 'depDate', 'Departure Date cannot be before Booking Date.');
                    return false;
                }
                if (arrDateObj < depDateObj) {
                    setRowError(row.id, 'arrDate', 'Arrival Date cannot be before Departure Date.');
                    return false;
                }

                // time order check (if both times provided)
                if (row.timeDetails.boardingTime && row.timeDetails.actualTime) {
                    if (row.timeDetails.boardingTime >= row.timeDetails.actualTime) {
                        showToast(`Item #${rowNum}: Arrival time must be later than Departure time.`, "error");
                        return false;
                    }
                }

                // 5-minute increment check
                if (row.timeDetails.boardingTime) {
                    const m = parseInt(row.timeDetails.boardingTime.split(':')[1]);
                    if (m % 5 !== 0) {
                        showToast(`Item #${rowNum}: Departure time must be in 5-minute increments (e.g. ${row.timeDetails.boardingTime.split(':')[0]}:${Math.round(m / 5) * 5}).`, "error");
                        return false;
                    }
                }
                if (row.timeDetails.actualTime) {
                    const m = parseInt(row.timeDetails.actualTime.split(':')[1]);
                    if (m % 5 !== 0) {
                        showToast(`Item #${rowNum}: Arrival time must be in 5-minute increments (e.g. ${row.timeDetails.actualTime.split(':')[0]}:${Math.round(m / 5) * 5}).`, "error");
                        return false;
                    }
                }

                if (mode === 'Flight') {
                    if (!provider) { setRowError(row.id, 'provider', 'Airline Name is mandatory.'); return false; }
                    if (!ticketNo) { setRowError(row.id, 'ticketNo', 'Ticket Number is mandatory.'); return false; }
                    if (!pnr) { setRowError(row.id, 'pnr', 'PNR is mandatory.'); return false; }
                    if (!row.details.classType) { setRowError(row.id, 'classType', 'Class is mandatory for Flight.'); return false; }
                    if (!travelNo) { setRowError(row.id, 'travelNo', 'Flight Number is mandatory.'); return false; }
                    if (!row.timeDetails.boardingTime || !row.timeDetails.actualTime) { setRowError(row.id, 'time', 'Departure and Arrival times are mandatory.'); return false; }
                    // format/length validations
                    const alnum = /^[A-Za-z0-9]+$/;
                    if (!alnum.test(ticketNo)) { setRowError(row.id, 'ticketNo', 'Ticket Number may only contain letters and numbers.'); return false; }
                    if (ticketNo.length > 25) { setRowError(row.id, 'ticketNo', 'Ticket Number cannot exceed 25 characters.'); return false; }
                    if (!alnum.test(pnr)) { setRowError(row.id, 'pnr', 'PNR may only contain letters and numbers.'); return false; }
                    if (pnr.length < 5 || pnr.length > 15) { setRowError(row.id, 'pnr', 'PNR must be 5-15 characters long.'); return false; }
                } else if (mode === 'Train') {
                    if (!ticketNo) { setRowError(row.id, 'ticketNo', 'Ticket Number is mandatory for Train.'); return false; }
                    if (!pnr) { setRowError(row.id, 'pnr', 'PNR is mandatory for Train.'); return false; }
                    if (!row.details.carrier) { setRowError(row.id, 'carrier', 'Train Name is mandatory.'); return false; }
                    if (!row.details.classType) { setRowError(row.id, 'classType', 'Class is mandatory for Train.'); return false; }
                    const alnum = /^[A-Za-z0-9]+$/;
                    if (!alnum.test(ticketNo)) { setRowError(row.id, 'ticketNo', 'Ticket Number may only contain letters and numbers.'); return false; }
                    if (ticketNo.length > 25) { setRowError(row.id, 'ticketNo', 'Ticket Number cannot exceed 25 characters.'); return false; }
                    if (!alnum.test(pnr)) { setRowError(row.id, 'pnr', 'PNR may only contain letters and numbers.'); return false; }
                    if (pnr.length < 5 || pnr.length > 15) { setRowError(row.id, 'pnr', 'PNR must be 5-15 characters long.'); return false; }
                } else if (mode === 'Intercity Bus') {
                    if (!row.details.carrier) { setRowError(row.id, 'carrier', 'Bus Operator is mandatory.'); return false; }
                } else if (mode === 'Intercity Cab') {
                    if (!provider) { setRowError(row.id, 'provider', 'Provider / Vendor (Ola/Uber etc) is mandatory.'); return false; }
                    if (!row.timeDetails.boardingTime || !row.timeDetails.actualTime) { setRowError(row.id, 'time', 'Departure and Arrival times are mandatory for Cab.'); return false; }
                }

                if (isSelfBooked) {
                    // travel-specific requirement
                    if (row.nature === 'Travel') {
                        if (row.amount === '' || row.amount <= 0) {
                            showToast(`${row.nature} Item #${rowNum}: Total Amount is mandatory for Self Booked.`, "error");
                            return false;
                        }
                    }
                    // local travel also needs positive amount when self-booked
                    if (row.nature === 'Local Travel') {
                        if (row.amount === '' || row.amount <= 0) {
                            showToast(`${row.nature} Item #${rowNum}: Total Amount is mandatory for Self Booked.`, "error");
                            return false;
                        }
                    }
                    if (mode === 'Flight' || mode === 'Intercity Bus' || mode === 'Intercity Cab') {
                        // Ticket/Invoice requirements
                        if (!row.bills || row.bills.length < (mode === 'Intercity Cab' ? 1 : 2)) {
                            showToast(`Item #${rowNum}: Please upload ${mode === 'Intercity Cab' ? 'Invoice' : 'Ticket and Invoice'} for self-booked ${mode.toLowerCase()}.`, "warning");
                        }
                    }
                }

                // Cancellation/No-Show Logic
                if (travelStatus === 'Cancelled') {
                    const charges = parseFloat(row.details.cancellationCharges || 0);
                    const refund = parseFloat(row.details.refundAmount || 0);
                    const baseFare = parseFloat(row.details.baseFare || 0);
                    if (baseFare > 0 && (charges + refund > baseFare + 0.5)) {
                        showToast(`Item #${rowNum}: Sum of Charges and Refund exceeds original Ticket Amount.`, "error");
                        return false;
                    }
                    if (!row.details.cancellationReason || row.details.cancellationReason.trim().length < 3) {
                        showToast(`Item #${rowNum}: Please provide a valid cancellation reason.`, "error");
                        return false;
                    }
                }

                // Upload Validation
                if (isSelfBooked || mode !== 'Flight') {
                    if (!row.bills || row.bills.length === 0) {
                        showToast(`Item #${rowNum}: Please upload your ticket/invoice. This is mandatory for all travel.`, "error");
                        return false;
                    }
                }
            }

            if (row.nature === 'Local Travel') {
                const { mode, subType, odoStart, odoEnd, origin, destination } = row.details;

                // Prevent during active long distance travel
                const localStart = new Date(row.date + 'T' + (row.timeDetails.boardingTime || '00:00'));
                const localEnd = new Date((row.endDate || row.date) + 'T' + (row.timeDetails.actualTime || '23:59'));
                for (let j = 0; j < rows.length; j++) {
                    const other = rows[j];
                    if (other.nature === 'Travel') {
                        if (other.details.depDate && other.details.arrDate) {
                            const dep = new Date(other.details.depDate + 'T' + (other.timeDetails.boardingTime || '00:00'));
                            const arr = new Date(other.details.arrDate + 'T' + (other.timeDetails.actualTime || '23:59'));
                            if (localStart >= dep && localStart <= arr) {
                                showToast(`Item #${rowNum}: Cannot record local conveyance during active long-distance travel period.`, "error");
                                return false;
                            }
                        }
                    }
                }

                if (!mode) {
                    showToast(`Item #${rowNum}: Please select a Mode for Local Travel.`, "error");
                    return false;
                }

                if (mode !== 'Walk' && !subType) {
                    showToast(`Item #${rowNum}: Please select a Sub-Type for ${mode}.`, "error");
                    return false;
                }

                // date range validation for local travel
                if (row.date && row.endDate) {
                    if (new Date(row.date) > new Date(row.endDate)) {
                        showToast(`Item #${rowNum}: End Date should be after Start Date.`, "error");
                        return false;
                    }
                    // optionally block future dates if needed
                    const today = new Date();
                    if (new Date(row.date) > today || new Date(row.endDate) > today) {
                        showToast(`Item #${rowNum}: Travel dates cannot be in the future.`, "error");
                        return false;
                    }
                }

                // location cross-check
                if (origin && destination && origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
                    showToast(`Item #${rowNum}: From and To locations cannot be the same.`, "error");
                    return false;
                }
                // time validations for local travel
                if ((row.timeDetails.boardingTime && !row.timeDetails.actualTime) || (!row.timeDetails.boardingTime && row.timeDetails.actualTime)) {
                    showToast(`Item #${rowNum}: Both start and end times are required for Local Travel.`, "error");
                    return false;
                }
                if (row.timeDetails.boardingTime && row.timeDetails.actualTime) {
                    if (row.timeDetails.boardingTime >= row.timeDetails.actualTime) {
                        showToast(`Item #${rowNum}: End Time must be greater than Start Time.`, "error");
                        return false;
                    }
                    // 5-minute increment check
                    const m1 = parseInt(row.timeDetails.boardingTime.split(':')[1]);
                    const m2 = parseInt(row.timeDetails.actualTime.split(':')[1]);
                    if (m1 % 5 !== 0 || m2 % 5 !== 0) {
                        showToast(`Item #${rowNum}: Times must be in 5-minute increments.`, "error");
                        return false;
                    }
                }

                if (mode === 'Walk') {
                    if (parseFloat(row.amount) > 0) {
                        showToast(`Item #${rowNum}: Walk mode cannot have an associated cost.`, "error");
                        return false;
                    }
                    if (!origin || !destination) {
                        showToast(`Item #${rowNum}: From and To locations are required for Walk entries.`, "error");
                        return false;
                    }
                }

                const odoDrivenSubtypes = ['Own Car', 'Own Bike', 'Self Drive Rental', 'Company Car'];
                if (odoDrivenSubtypes.includes(subType)) {
                    // Conditional Validation: If reading exists, photo MUST exist
                    if (odoStart && !row.details.odoStartImg) {
                        showToast(`Item #${rowNum}: Start Odometer photo is required since reading is entered.`, "error");
                        setRowError(row.id, 'odoStartImg', 'Photo required');
                        return false;
                    }
                    if (odoEnd && !row.details.odoEndImg) {
                        showToast(`Item #${rowNum}: End Odometer photo is required since reading is entered.`, "error");
                        setRowError(row.id, 'odoEndImg', 'Photo required');
                        return false;
                    }

                    // Value validation
                    if (odoStart && isNaN(parseFloat(odoStart))) {
                        showToast(`Item #${rowNum}: Start Odometer must be numeric.`, "error");
                        return false;
                    }
                    if (odoEnd && isNaN(parseFloat(odoEnd))) {
                        showToast(`Item #${rowNum}: End Odometer must be numeric.`, "error");
                        return false;
                    }

                    // Comparison only if both are present
                    if (odoStart && odoEnd && parseFloat(odoEnd) <= parseFloat(odoStart)) {
                        showToast(`Item #${rowNum}: End Odometer must be greater than Start Odometer.`, "error");
                        setRowError(row.id, 'odoEnd', 'Must be > Start');
                        return false;
                    }
                }
            }

            if (row.nature === 'Food') {
                if (!row.details.mealCategory) {
                    showToast(`Item #${rowNum}: Please select Meal Category.`, "error");
                    return false;
                }

                // meal time mandatory regardless of category
                if (!row.details.mealTime) { showToast(`Item #${rowNum}: Meal Time is required.`, "error"); return false; }
                if (row.details.mealCategory === 'Self Meal') {
                    if (!row.details.mealType) { showToast(`Item #${rowNum}: Please select Meal Type.`, "error"); return false; }
                    if (!row.details.restaurant) { showToast(`Item #${rowNum}: Restaurant / Hotel Name is required.`, "error"); return false; }
                    if (!row.details.purpose) { showToast(`Item #${rowNum}: Address is required.`, "error"); return false; }
                    if (!row.details.invoiceNo) { showToast(`Item #${rowNum}: Invoice Number is required.`, "error"); return false; }
                    if (!row.amount || parseFloat(row.amount) <= 0) { showToast(`Item #${rowNum}: Amount must be > 0 for Self Meal.`, "error"); return false; }
                    if (!row.bills || row.bills.length === 0) { showToast(`Item #${rowNum}: Bill upload is mandatory for Self Meal.`, "error"); return false; }

                    const sameDaySelfMeals = rows.filter(r => r.nature === 'Food' && r.date === row.date && r.details.mealCategory === 'Self Meal' && r.details.mealType === row.details.mealType);
                    if (sameDaySelfMeals.length > 1 && ['Breakfast', 'Lunch', 'Dinner'].includes(row.details.mealType)) {
                        showToast(`Item #${rowNum}: Only one ${row.details.mealType} per day is allowed.`, "error");
                        return false;
                    }
                }
            }

            if (row.nature === 'Accommodation') {
                if (!row.details.accomType) {
                    showToast(`Item #${rowNum}: Please select an Accommodation Type.`, "error");
                    return false;
                }
                if (!['No Stay', 'Self Stay'].includes(row.details.accomType) && !row.details.hotelName) {
                    showToast(`Item #${rowNum}: Please provide the Hotel/Guest House name.`, "error");
                    return false;
                }
                if (!['No Stay'].includes(row.details.accomType) && (!row.details.checkIn || !row.details.checkOut)) {
                    showToast(`Item #${rowNum}: Check-In and Check-Out dates are required for stays.`, "error");
                    return false;
                }
                if (row.details.checkIn && row.details.checkOut && new Date(row.details.checkIn) > new Date(row.details.checkOut)) {
                    showToast(`Item #${rowNum}: Check-Out date cannot be before Check-In date.`, "error");
                    return false;
                }
                if (row.details.checkIn && !row.details.checkInTime) {
                    showToast(`Item #${rowNum}: Check-In time is required for stays.`, "error");
                    return false;
                }
                if (row.details.checkOut && !row.details.checkOutTime) {
                    showToast(`Item #${rowNum}: Check-Out time is required for stays.`, "error");
                    return false;
                }
            }

            if (row.nature === 'Incidental') {
                if (!row.details.incidentalType) {
                    showToast(`Item #${rowNum}: Please select an Incidental Type.`, "error");
                    return false;
                }
                if (!row.details.location) {
                    showToast(`Item #${rowNum}: Location is mandatory for incidental expenses.`, "error");
                    return false;
                }
                if (parseFloat(row.amount) <= 0) {
                    showToast(`Item #${rowNum}: Amount must be greater than 0.`, "error");
                    return false;
                }
                // Incidental bill upload is no longer mandatory
                // if (!row.bills || row.bills.length === 0) {
                //     showToast(`Item #${rowNum}: Bill upload is mandatory for incidental expenses.`, "error");
                //     return false;
                // }
                if (row.details.incidentalType === 'Others') {
                    if (!row.details.otherReason) {
                        showToast(`Item #${rowNum}: Reason is required for 'Others' expense type.`, "error");
                        return false;
                    }
                    if (!row.details.description) {
                        showToast(`Item #${rowNum}: Description is required for 'Others' expense type.`, "error");
                        return false;
                    }
                }
            }
        }

        // Overlap Validation (Simplified: check if multiple travel segments have same start date)
        const travelRows = rows.filter(r => r.nature === 'Travel');
        const dates = travelRows.map(r => r.date);
        const hasOverlap = new Set(dates).size !== dates.length;
        if (hasOverlap) {
            // Further check could be done for time, but date level is a good start as per "No overlapping segments"
            const confirmOverlap = await confirm("Warning: Overlapping travel segments detected on the same date. Continue?");
            if (!confirmOverlap) return false;
        }

        // Meal overlap validation
        for (const row of rows) {
            if (row.nature === 'Food') {
                const hasMealBenefit = rows.some(r => r.nature === 'Travel' && r.date === row.date && r.details.mealIncluded);
                if (hasMealBenefit) {
                    const confirmMeal = await confirm(`Warning: You marked "Meal Included" for travel on ${row.date}. Separate meal claims for this day might be blocked. Continue?`);
                    if (!confirmMeal) return false;
                }
            }
        }

        setIsSaving(true);
        try {
            const newRows = rows.filter(r => !r.isSaved);

            if (newRows.length === 0) {
                setIsSaving(false);
                return true;
            }

            for (const row of newRows) {
                const categoryMap = {
                    'Travel': 'Others',
                    'Local Travel': 'Fuel',
                    'Food': 'Food',
                    'Accommodation': 'Accommodation',
                    'Incidental': 'Incidental'
                };

                const filteredDetails = { ...row.details };
                if (row.details.isPublicTransport) {
                    filteredDetails.mode = 'Public Transport';
                    filteredDetails.vehicleType = row.details.remainingRoute;
                    filteredDetails.subType = row.details.remainingRoute;
                }
                if (row.nature === 'Local Travel') {
                    const { mode, subType } = row.details;
                    // Remove fields not applicable for current mode/subtype
                    if (mode === 'Walk') {
                        delete filteredDetails.toll;
                        delete filteredDetails.parking;
                        delete filteredDetails.fuel;
                        delete filteredDetails.odoStart;
                        delete filteredDetails.odoEnd;
                        delete filteredDetails.totalKm;
                    }
                    if (mode === 'Public Transport') {
                        delete filteredDetails.odoStart;
                        delete filteredDetails.odoEnd;
                        delete filteredDetails.fuel;
                        delete filteredDetails.toll;
                        delete filteredDetails.parking;
                    }
                    if (!['Own Car', 'Self Drive Rental', 'Own Bike'].includes(subType)) {
                        delete filteredDetails.odoStart;
                        delete filteredDetails.odoEnd;
                    }
                }

                if (row.nature === 'Travel' && row.details.mode === 'Intercity Car') {
                    const { vehicleType } = row.details;
                    if (!['Own Car', 'Self Drive Rental'].includes(vehicleType)) {
                        delete filteredDetails.odoStart;
                        delete filteredDetails.odoEnd;
                    }
                    if (vehicleType === 'Company Car' && !row.details.driverName) {
                        delete filteredDetails.driverAllowance;
                    }
                    if (row.details.nightTravel !== 'Yes') {
                        delete filteredDetails.nightHaltCharges;
                    }
                    delete filteredDetails.travelStatus;
                }

                const payload = {
                    trip: tripId,
                    date: row.date,
                    category: categoryMap[row.nature] || 'Others',
                    amount: parseFloat(row.amount || 0),
                    // New Database Fields
                    travel_mode: row.details.isPublicTransport ? 'Public Transport' : (row.nature === 'Travel' ? row.details.mode : (row.nature === 'Local Travel' ? row.details.mode : null)),
                    class_type: row.nature === 'Travel' ? row.details.classType : null,
                    booking_reference: row.nature === 'Travel' ? (row.details.pnr || row.details.bookingRef) : null,
                    refundable_flag: row.nature === 'Travel' ? row.details.refundable === 'Yes' : false,
                    meal_included_flag: row.nature === 'Travel' ? row.details.mealIncluded === true : false,
                    vehicle_type: row.details.isPublicTransport ? row.details.remainingRoute : ((row.nature === 'Travel' || row.nature === 'Local Travel') ? (row.details.subType || row.details.vehicleType) : null),
                    odo_start: ((row.nature === 'Travel' || row.nature === 'Local Travel') && row.details.odoStart && !row.details.isPublicTransport) ? parseFloat(row.details.odoStart) : null,
                    odo_end: ((row.nature === 'Travel' || row.nature === 'Local Travel') && row.details.odoEnd && !row.details.isPublicTransport) ? parseFloat(row.details.odoEnd) : null,
                    distance: (row.nature === 'Travel' || row.nature === 'Local Travel') ? (row.details.isPublicTransport ? 0 : parseFloat(row.details.totalKm || 0)) : null,
                    cancellation_status: row.nature === 'Travel' ? (row.details.travelStatus || 'Completed') : null,
                    cancellation_date: row.nature === 'Travel' ? row.details.cancellationDate : null,
                    refund_amount: row.nature === 'Travel' ? parseFloat(row.details.refundAmount || 0) : null,
                    cancellation_reason: row.nature === 'Travel' ? row.details.cancellationReason : null,
                    booked_by: row.nature === 'Travel' ? row.details.bookedBy : null,
                    reimbursement_eligible: row.nature === 'Travel' ? (row.details.bookedBy === 'Self Booked') : true,
                    // description and image always part of payload
                    description: JSON.stringify({
                        ...filteredDetails,
                        remarks: row.remarks ? row.remarks.trim() : '',
                        time: row.timeDetails,
                        natureOfVisit: row.details.natureOfVisit ? row.details.natureOfVisit.trim() : ''
                    }),
                    receipt_image: JSON.stringify(row.bills || []),
                    is_deviated: !!row.details.is_deviated,
                    deviation_reason: row.details.deviation_reason || null,
                    deviation_target: row.details.visitedPerson || row.details.deviation_target || null,
                    planned_origin: row.details.plannedOrigin || null,
                    planned_destination: row.details.plannedDestination || null,
                };

                // enforce fixed values for local rows when trip id not starting with TRP
                if (isFixedLocal && row.nature === 'Local Travel') {
                    payload.travel_mode = 'Bike';
                    payload.vehicle_type = 'Own Bike';
                    payload.booked_by = 'Self Booked';
                    payload.reimbursement_eligible = true;
                }

                if (!isNaN(Number(row.id))) {
                    await api.patch(`/api/expenses/${row.id}/`, payload);
                } else {
                    const res = await api.post('/api/expenses/', payload);
                    if (res.data && res.data.id) {
                        row.id = res.data.id; // Update the ID to the real database ID
                    }
                }

                // If incidental expense added, create a separate record to ensure accurate accounting
                if (row.nature === 'Local Travel' && row.details.incidentalAmount && parseFloat(row.details.incidentalAmount) > 0 && !row.isSaved) {
                    try {
                        await api.post('/api/expenses/', {
                            trip: tripId,
                            date: row.date,
                            category: 'Incidental',
                            amount: parseFloat(row.details.incidentalAmount),
                            description: JSON.stringify({
                                incidentalType: row.details.incidentalCategory || 'Misc',
                                notes: `Added during local travel: ${row.details.origin || 'Start'} to ${row.details.destination || 'End'}`
                            }),
                            receipt_image: row.details.incidentalBill ? JSON.stringify([row.details.incidentalBill]) : '[]',
                        });
                        row.details.incidentalAmount = ''; // Clear it so it won't duplicate if saved again
                        row.details.incidentalBill = '';
                        row.details.incidentalCategory = '';
                    } catch (e) {
                        console.error("Failed to save incidental cost:", e);
                    }
                }
            }

            showToast("Registry committed successfully!", "success");
            if (onUpdate) onUpdate();

            setRows(rows.map(r => ({ ...r, isSaved: true })));
            return true;

        } catch (error) {
            console.error("Save error:", error);
            const errorMsg = error.response?.data?.error || error.response?.data?.message || "Failed to commit registry due to a server error.";
            showToast(errorMsg, "error");
            return false;
        } finally {
            setIsSaving(true);
            setTimeout(() => setIsSaving(false), 500);
        }
    };

    const handleClaim = async () => {
        if (rows.length === 0) {
            showToast("Cannot submit a claim with no expenses", "error");
            return;
        }

        const hasUnsaved = rows.some(r => !r.isSaved);
        if (hasUnsaved) {
            setConfirmDialog({
                show: true,
                title: 'Unsaved Changes',
                message: 'You have unsaved changes. These will be saved automatically before submission. Continue?',
                type: 'warning',
                onConfirm: async () => {
                    setConfirmDialog(prev => ({ ...prev, show: false }));
                    const saved = await saveRegistry();
                    if (saved) await submitFinalClaim();
                }
            });
            return;
        }

        await submitFinalClaim();
    };

    const submitFinalClaim = async () => {
        if (!isTripApproved) {
            showToast("Trip must be approved before filing claim", "warning");
            return;
        }

        const ledgerTotal = rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

        setConfirmDialog({
            show: true,
            title: 'Submit Final Claim',
            message: `Are you sure you want to submit the final claim for ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(ledgerTotal)}? This will lock the registry for approval.`,
            type: 'primary',
            onConfirm: async () => {
                setIsSubmitting(true);
                try {
                    await api.post('/api/claims/', {
                        trip: tripId,
                        total_amount: ledgerTotal,
                        status: 'Submitted',
                        submitted_at: new Date().toISOString()
                    });

                    showToast("Claim submitted successfully!", "success");
                    if (onUpdate) onUpdate();
                } catch (error) {
                    console.error("Claim submission error:", error);
                    showToast(error.response?.data?.error || "Failed to submit claim", "error");
                } finally {
                    setIsSubmitting(false);
                    setConfirmDialog({ show: false, title: '', message: '', onConfirm: null, type: 'warning' });
                }
            }
        });
    };

    const seedMockData = () => {
        setRows(MOCK_DATA);
    };

    const addRow = (nature = '') => {
        const targetNature = nature || activeCategory;
        const newRow = {
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            nature: targetNature,
            remarks: '',
            details: {
                segmentId: `SEG-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                auditTrail: [],
                bookedBy: 'Self Booked', // Default
                travelStatus: 'Completed',
                checkInTime: '',
                checkOutTime: '',
                selfies: [] // Added for Local Travel
            },
            timeDetails: {
                boardingDate: new Date().toISOString().split('T')[0],
                boardingTime: '',
                checkInTime: '',
                scheduledTime: '',
                delay: 0,
                actualTime: ''
            },
            amount: '',
            bills: [],
            claim: true,
            isExpanded: true
        };
        if (isFixedLocal && targetNature === 'Local Travel') {
            newRow.details.mode = 'Bike';
            newRow.details.subType = 'Own Bike';
            newRow.details.bookedBy = 'Self Booked';
        }
        setRows(prevRows => [...prevRows, newRow]);
    };

    const deleteRow = async (id) => {
        const row = rows.find(r => r.id === id);
        if (!row) return;

        // If it's already saved in DB, we need to delete it from server
        if (row.isSaved) {
            setConfirmDialog({
                show: true,
                title: 'Confirm Deletion',
                message: 'This entry is already saved. Are you sure you want to permanently delete it from the registry?',
                type: 'danger',
                onConfirm: async () => {
                    try {
                        await api.delete(`/api/expenses/${id}/`);
                        showToast("Entry removed from registry", "success");
                        setRows(prevRows => prevRows.filter(r => r.id !== id));
                        if (onUpdate) onUpdate();
                    } catch (error) {
                        console.error("Failed to delete expense:", error);
                        showToast("Failed to delete entry from server", "error");
                    } finally {
                        setConfirmDialog(prev => ({ ...prev, show: false }));
                    }
                }
            });
            return;
        }

        setRows(prevRows => prevRows.filter(row => row.id !== id));
    };

    const clearRowError = (id, key) => {
        setErrors(prev => {
            const copy = { ...prev };
            if (copy[id]) {
                delete copy[id][key];
                if (Object.keys(copy[id]).length === 0) delete copy[id];
            }
            return copy;
        });
    };

    const setRowError = (id, key, msg) => {
        setErrors(prev => ({
            ...prev,
            [id]: { ...(prev[id] || {}), [key]: msg }
        }));
    };

    const updateRow = (id, field, value) => {
        // clear error for this field
        clearRowError(id, field);
        setRows(prevRows => prevRows.map(row => {
            if (row.id === id) {
                // Rule: If Company Booked Travel, Amount must be 0 and is non-editable
                if (field === 'amount' && row.nature === 'Travel' && row.details.bookedBy === 'Company Booked') {
                    return { ...row, amount: '0' };
                }

                let finalValue = value;
                // Alphanumeric/Numeric sanitization for specific fields
                if (field === 'amount') {
                    finalValue = value.replace(/[^0-9.]/g, '');
                    // Ensure only one decimal point
                    const parts = finalValue.split('.');
                    if (parts.length > 2) finalValue = parts[0] + '.' + parts.slice(1).join('');
                }

                const updatedRow = { ...row, [field]: finalValue, isSaved: false };
                if (field === 'nature') {
                    updatedRow.details = { bookedBy: 'Self Booked' };
                    updatedRow.timeDetails = { boardingTime: '', scheduledTime: '', delay: 0, actualTime: '' };
                }
                return updatedRow;
            }
            return row;
        }));
    };

    const updateDetails = (id, detailField, value) => {
        clearRowError(id, detailField);
        setRows(prevRows => prevRows.map(row => {
            if (row.id === id) {
                let updatedAmount = row.amount;

                // Rule: If switching to Company Booked, force amount to 0
                if (detailField === 'bookedBy' && value === 'Company Booked' && row.nature === 'Travel') {
                    updatedAmount = '0';
                }

                const newDetails = { ...row.details, [detailField]: value };

                if (detailField === 'odoStart' || detailField === 'odoEnd' || detailField === 'subType' || detailField === 'isPublicTransport') {
                    const start = parseFloat(newDetails.odoStart || 0);
                    const end = parseFloat(newDetails.odoEnd || 0);
                    newDetails.totalKm = end >= start ? (end - start).toFixed(2) : 0;

                    const isOther = newDetails.isPublicTransport || newDetails.mode === 'Public Transport';

                    // KM Reimbursement for Own vehicles based on state rates
                    if (!isOther && row.nature === 'Local Travel' && ['Own Car', 'Own Bike'].includes(newDetails.subType)) {
                        const is4W = newDetails.subType === 'Own Car';
                        const vehicleKey = is4W ? '4 Wheeler' : '2 Wheeler';
                        const rate = fuelRates[vehicleKey];

                        // Only auto-calc if we have a valid distance and a rate
                        if (!isNaN(start) && !isNaN(end) && end > start && rate) {
                            const distKm = end - start;
                            updatedAmount = (distKm * rate).toFixed(2);
                            newDetails.isAutoCalculated = true;
                        }
                    } else if (isOther) {
                        // If switching to "Others", we stop auto-calculating from ODO
                        newDetails.isAutoCalculated = false;
                        // We preserve current amount if it was manually edited, but if it was 0 we might want to prompt for fare
                    }
                }

                if (detailField === 'checkIn' || detailField === 'checkOut') {
                    if (newDetails.checkIn && newDetails.checkOut) {
                        const start = new Date(newDetails.checkIn);
                        const end = new Date(newDetails.checkOut);
                        const diffTime = Math.abs(end - start);
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        newDetails.nights = diffDays;
                    }
                }

                if (detailField === 'startTime' || detailField === 'endTime' || detailField === 'nightTravel') {
                    if (row.nature === 'Travel' && row.details.mode === 'Intercity Car') {
                        if (newDetails.startTime && newDetails.endTime) {
                            const [sH, sM] = newDetails.startTime.split(':').map(Number);
                            const [eH, eM] = newDetails.endTime.split(':').map(Number);
                            let durationHours = (eH - sH) + (eM - sM) / 60;
                            if (durationHours < 0) durationHours += 24; // Cross-day

                            if (newDetails.nightTravel === 'Yes' && durationHours > 8) {
                                // Potentially auto-fill or just enable flag
                                newDetails.haltEligible = true;
                            } else {
                                newDetails.haltEligible = false;
                                newDetails.nightHaltCharges = 0;
                            }
                        }
                    }
                }

                if (detailField === 'bookedBy' && row.nature === 'Travel') {
                    if (value === 'Company Booked') {
                        newDetails.reimbursement_eligible = false;
                        updatedAmount = '0';
                    } else {
                        newDetails.reimbursement_eligible = true;
                    }
                }

                return { ...row, details: newDetails, amount: updatedAmount, isSaved: false };
            }
            return row;
        }));
    };

    const updateTimeDetails = (id, timeField, value) => {
        setRows(prevRows => prevRows.map(row => {
            if (row.id === id) {
                const newTimeDetails = { ...row.timeDetails, [timeField]: value };
                if (timeField === 'scheduledTime' || timeField === 'actualTime') {
                    const scheduled = newTimeDetails.scheduledTime;
                    const actual = newTimeDetails.actualTime;
                    if (scheduled && actual) {
                        try {
                            const [sH, sM] = scheduled.split(':').map(Number);
                            const [aH, aM] = actual.split(':').map(Number);
                            const sDate = new Date();
                            sDate.setHours(sH, sM, 0);
                            const aDate = new Date();
                            aDate.setHours(aH, aM, 0);

                            // Handle next day arrival if actual < scheduled
                            if (aDate < sDate) aDate.setDate(aDate.getDate() + 1);

                            const diffMin = Math.round((aDate - sDate) / (1000 * 60));
                            if (diffMin >= 0) newTimeDetails.delay = diffMin;
                        } catch (e) { }
                    }
                }
                return { ...row, timeDetails: newTimeDetails, isSaved: false };
            }
            return row;
        }));
    };

    const handleOdoCapture = (id, field) => {
        activeRowRef.current = id;
        activeFieldRef.current = field;
        fileInputRef.current?.click();
    };

    const handleReviewStatusChange = (id, newStatus) => {
        setRows(prevRows => prevRows.map(row => {
            if (row.id === id) {
                // RULE: Company Booked cannot be Cancelled or Rescheduled by employee
                if (row.nature === 'Travel' && row.details.bookedBy === 'Company Booked') {
                    showToast("This ticket is booked and paid by the company. Please contact the Travel Desk for any changes.", "warning");
                    return row;
                }

                const oldStatus = row.details.travelStatus || 'Completed';
                if (oldStatus === newStatus) return row;

                const timestamp = new Date();
                const logEntry = `[${timestamp}] Status changed from ${oldStatus} to ${newStatus}`;
                const newAuditTrail = [...(row.details.auditTrail || []), logEntry];

                const newDetails = {
                    ...row.details,
                    travelStatus: newStatus,
                    auditTrail: newAuditTrail
                };

                let newAmount = row.amount;
                // Logic-driven amount recalculation
                if (newStatus === 'Cancelled' || newStatus === 'No-Show') {
                    // Preserve original amount as baseFare before switching if we don't have it yet
                    // or if we're moving from a status where 'amount' was the full price
                    if (oldStatus === 'Completed' || oldStatus === 'Rescheduled') {
                        newDetails.baseFare = row.amount;
                    }
                    newAmount = newStatus === 'Cancelled' ? (row.details.cancellationCharges || 0) : (row.details.noShowCharges || 0);
                } else if (oldStatus === 'Cancelled' || oldStatus === 'No-Show') {
                    // Reverting back to Completed or Rescheduled
                    newAmount = row.details.baseFare || row.amount;
                }

                return { ...row, details: newDetails, amount: newAmount, isSaved: false };
            }
            return row;
        }));
    };

    const handleOdoFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            captureLocation();
            const reader = new FileReader();
            reader.onloadend = () => {
                const id = activeRowRef.current;
                const field = activeFieldRef.current;

                if (field === 'selfie') {
                    setRows(prevRows => prevRows.map(row => {
                        if (row.id === id) {
                            const currentSelfies = row.details.selfies || [];
                            return {
                                ...row,
                                details: {
                                    ...row.details,
                                    selfies: [...currentSelfies, reader.result]
                                },
                                isSaved: false
                            };
                        }
                        return row;
                    }));
                    showToast("Selfie captured successfully", "success");
                } else {
                    updateDetails(id, `${field}Img`, reader.result);
                    showToast("Odometer photo captured", "success");
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const captureLocation = () => {
        if (!navigator.geolocation) return;
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const id = activeRowRef.current;
                const field = activeFieldRef.current;
                updateDetails(id, `${field}Lat`, pos.coords.latitude);
                updateDetails(id, `${field}Long`, pos.coords.longitude);
                setIsLocating(false);
            },
            () => setIsLocating(false),
            { enableHighAccuracy: true }
        );
    };

    const handleFileUpload = (id, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setRows(prevRows => prevRows.map(row => {
                if (row.id === id) {
                    const currentBills = row.bills || [];
                    return { ...row, bills: [...currentBills, reader.result], isSaved: false };
                }
                return row;
            }));
        };
        reader.readAsDataURL(file);
    };

    const removeBill = (rowId, index) => {
        setRows(prevRows => prevRows.map(row => {
            if (row.id === rowId) {
                const newBills = [...(row.bills || [])];
                newBills.splice(index, 1);
                return { ...row, bills: newBills, isSaved: false };
            }
            return row;
        }));
    };

    const previewBill = (bill) => {
        if (!bill) return;
        const url = getFullUrl(bill);
        const win = window.open();
        if (win) {
            win.document.write(`
                <html>
                  <head>
                    <title>Bill Preview</title>
                    <style>
                      body { margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#1e293b; color:white; font-family:sans-serif; }
                      img { max-width:95vw; max-height:95vh; box-shadow:0 10px 25px rgba(0,0,0,0.5); object-fit:contain; }
                      iframe { width:100vw; height:100vh; border:none; background:white; }
                      .nav { position:fixed; top:20px; right:20px; background:rgba(0,0,0,0.6); padding:10px 20px; border-radius:30px; }
                      a { color:#60a5fa; text-decoration:none; font-weight:bold; }
                    </style>
                  </head>
                  <body>
                    <div class="nav"><a href="${url}" target="_blank">Open in New Tab</a></div>
                    ${url.toLowerCase().includes('.pdf') || url.startsWith('data:application/pdf')
                    ? `<iframe src="${url}"></iframe>`
                    : `<img src="${url}" onerror="this.src='https://placehold.co/600x400?text=Preview+Not+Available'" />`
                }
                  </body>
                </html>
            `);
            win.document.close();
        }
    };

    const handleSelfieCapture = (id) => {
        activeRowRef.current = id;
        activeFieldRef.current = 'selfie';
        fileInputRef.current?.click();
    };

    const removeSelfie = (rowId, index) => {
        setRows(prevRows => prevRows.map(row => {
            if (row.id === rowId) {
                const newSelfies = [...(row.details.selfies || [])];
                newSelfies.splice(index, 1);
                return { ...row, details: { ...row.details, selfies: newSelfies }, isSaved: false };
            }
            return row;
        }));
    };

    // --- BULK UPLOAD HANDLERS ---
    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get('/api/bulk-activities/template/', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'bulk_local_travel_template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (error) {
            console.error('Download error:', error);
            showToast("Failed to download template. Please try again.", "error");
        }
    };

    const handleBulkUpload = async () => {
        if (!bulkModal.file) {
            showToast("Please select a file first", "error");
            return;
        }

        setBulkModal(prev => ({ ...prev, uploading: true }));
        const formData = new FormData();
        formData.append('file', bulkModal.file);
        formData.append('trip_id', tripId);

        try {
            await api.post('/api/bulk-activities/upload/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showToast("Bulk activities submitted for batch approval successfully!", "success");
            setBulkModal({ visible: false, file: null, uploading: false, activeTab: 'upload' });
            fetchBulkHistory();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Upload error:', error);
            showToast(error.response?.data?.error || "Error uploading file", "error");
            setBulkModal(prev => ({ ...prev, uploading: false }));
        }
    };

    const handleResubmit = async () => {
        if (resubmitModal.rows.length === 0) {
            showToast("No rows to resubmit", "warning");
            return;
        }

        setResubmitModal(prev => ({ ...prev, submitting: true }));
        try {
            const resubmitPayload = {
                trip_id: tripId,
                data_json: resubmitModal.rows,
                parent_batch_id: resubmitModal.batchId
            };
            await api.post('/api/bulk-activities/upload/', resubmitPayload, {
                headers: { 'Content-Type': 'application/json' }
            });

            showToast("Batch resubmitted successfully!", "success");
            setResubmitModal({ visible: false, batchId: null, rows: [], submitting: false });

            // Add to processed tracking to avoid showing "Resolve & Resubmit" again for this batch
            if (resubmitModal.batchId) {
                setProcessedBatchIds(prev => [...prev, resubmitModal.batchId]);
            }

            fetchBulkHistory();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Resubmit error:', error);
            showToast(error.response?.data?.error || "Failed to resubmit", "error");
            setResubmitModal(prev => ({ ...prev, submitting: false }));
        }
    };

    const startResubmission = (batch) => {
        const rejectedRows = (batch.data_json || []).filter(r => r._status === 'Rejected');
        if (rejectedRows.length === 0) {
            showToast("No rejected rows found in this batch", "info");
            return;
        }
        setResubmitModal({
            visible: true,
            batchId: batch.id,
            rows: rejectedRows.map(r => ({ ...r, _status: 'Resubmitted' })),
            submitting: false
        });
        setBulkModal(prev => ({ ...prev, visible: false }));
    };

    const updateResubmitRow = (idx, field, val) => {
        setResubmitModal(prev => {
            const newRows = [...prev.rows];
            newRows[idx] = { ...newRows[idx], [field]: val };
            return { ...prev, rows: newRows };
        });
    };

    const isLocked = claimStatus && !['Draft', 'Rejected'].includes(claimStatus);

    const CategoryTable = ({ nature, title, icon }) => {
        const categoryRows = (() => {
            let filtered = displayRows.filter(r => r.nature === nature);

            if (nature === 'Local Travel') {
                const limit = new Date();
                const now = new Date();

                if (dateFilter === 'Today') {
                    const today = toYMD(now);
                    filtered = filtered.filter(r => (r.date || 'Pending') === today);
                } else if (dateFilter === 'Last 7 Days') {
                    limit.setDate(limit.getDate() - 7);
                    const limitStr = toYMD(limit);
                    const todayStrLocal = toYMD(now);
                    if (limitStr) {
                        filtered = filtered.filter(r => {
                            const d = r.date || 'Pending';
                            return d >= limitStr && d <= todayStrLocal;
                        });
                    }
                } else if (dateFilter === 'Last 30 Days') {
                    limit.setDate(limit.getDate() - 30);
                    const limitStr = toYMD(limit);
                    const todayStrLocal = toYMD(now);
                    if (limitStr) {
                        filtered = filtered.filter(r => {
                            const d = r.date || 'Pending';
                            return d >= limitStr && d <= todayStrLocal;
                        });
                    }
                }
            }
            return filtered;
        })();

        const gridTemplateColumns = (() => {
            switch (nature) {
                case 'Travel': return '1fr';
                case 'Local Travel': return '1fr';
                case 'Food': return '140px 80px 180px 1fr 180px 100px 50px';
                case 'Accommodation': return '220px 220px 1fr 180px 100px 50px';
                case 'Incidental': return '140px 220px 1fr 180px 100px 50px';
                default: return '1fr';
            }
        })();

        return (
            <div className={`category-section-container ${nature.toLowerCase().replace(' ', '-')} ${isLocked ? 'is-locked' : ''}`}>
                <div className="category-section-header">
                    <div className="cat-title">
                        {icon}
                        <h4>{title}</h4>
                        <span className="cat-count">{categoryRows.length} Items</span>

                        {nature === 'Incidental' && (
                            <div className="header-actions-extra ml-4" style={{ marginLeft: '2rem', display: 'flex', alignItems: 'center' }}>
                                <label className="toggle-switch-mini">
                                    <input type="checkbox" checked={carryingLuggage} onChange={e => setCarryingLuggage(e.target.checked)} />
                                    <span className="slider-mini"></span>
                                    <span className="label-text" style={{ marginLeft: '8px', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Carrying Luggage</span>
                                </label>
                            </div>
                        )}
                    </div>
                    {!isLocked && (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            {nature === 'Local Travel' && (
                                <div className="date-filter-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '4px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <Calendar size={14} style={{ color: '#4f46e5' }} />
                                    <select
                                        value={dateFilter}
                                        onChange={e => {
                                            if (onFilterChange) onFilterChange(e.target.value);
                                            else setDateFilter && setDateFilter(e.target.value);
                                        }}
                                        style={{ border: 'none', background: 'transparent', fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', cursor: 'pointer', outline: 'none' }}
                                    >
                                        <option value="Today">Today</option>
                                        <option value="Last 7 Days">Last 7 Days</option>
                                        <option value="Last 30 Days">Last 30 Days</option>
                                        <option value="All">All Records</option>
                                    </select>
                                </div>
                            )}
                            {showBulkUpload && nature === 'Local Travel' && (
                                <button className="add-cat-row-btn" style={{ background: '#10b981', color: 'white', borderColor: '#10b981' }} onClick={() => setBulkModal(prev => ({ ...prev, visible: true, activeTab: 'history', hideUpload: true }))}>
                                    <RotateCcw size={14} />
                                    <span>Bulk Upload Rejections</span>
                                </button>
                            )}
                            {!isBulkUpload && (
                                <button className="add-cat-row-btn" onClick={() => addRow(nature)}>
                                    <Plus size={14} />
                                    <span>Add {title}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="category-table-wrapper">
                    <table className="category-table">
                        <thead>
                            <tr className="category-grid-row" style={{ gridTemplateColumns: '1fr' }}>
                                <th style={{ paddingLeft: '1rem' }}>{(nature === 'Local Travel' || nature === 'Travel') ? `${title} Journey Logs` : `${title} Records`}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categoryRows.length === 0 ? (
                                <tr className="category-grid-row" style={{ gridTemplateColumns: '1fr' }}>
                                    <td className="empty-cat-row">
                                        No {title.toLowerCase()} recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                (nature === 'Travel' || nature === 'Local Travel') ? (
                                    (() => {
                                        const grouped = categoryRows.reduce((acc, r) => {
                                            const d = r.date || 'Pending';
                                            if (!acc[d]) acc[d] = [];
                                            acc[d].push(r);
                                            return acc;
                                        }, {});
                                        const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
                                        return sortedDates.map(date => (
                                            <React.Fragment key={date}>
                                                <tr className="date-group-header-row">
                                                    <td colSpan="1">
                                                        <div className="date-group-header">
                                                            <Calendar size={18} />
                                                            <span>{date === 'Pending' ? 'Date Not Set' : new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {grouped[date].map(row => (
                                                    <tr key={row.id} className="category-row-block">
                                                        <td style={{ padding: '0' }}>
                                                            <div style={{ margin: '0.5rem 0.75rem 1rem', padding: '1rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                                                                {/* CARD HEADER */}
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '2px solid #f1f5f9' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <div style={{ width: '8px', height: '28px', background: 'linear-gradient(135deg, #4f46e5, #0ea5e9)', borderRadius: '4px' }} />
                                                                        <div>
                                                                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location &amp; Odometer Logs</div>
                                                                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                {nature === 'Local Travel' ? 'Local Conveyance Entry' : 'Travel Entry'}
                                                                                {(isFixedLocal || row.details.from_bulk_upload) && (
                                                                                    <span style={{ color: '#4f46e5', fontWeight: 800, background: '#eef2ff', border: '1px solid #e0e7ff', padding: '1px 6px', borderRadius: '4px', fontSize: '0.6rem' }}>PLANNED STOP</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        {row.details.travelStatus && row.details.travelStatus !== 'Completed' && (
                                                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: row.details.travelStatus === 'Cancelled' ? '#fee2e2' : '#fef3c7', color: row.details.travelStatus === 'Cancelled' ? '#dc2626' : '#d97706' }}>
                                                                                {row.details.travelStatus}
                                                                            </span>
                                                                        )}
                                                                        {!isLocked && (
                                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                                {/* DEVIATE/NOT VISITED buttons for planned/bulk uploads */}
                                                                                {(isFixedLocal || row.details.from_bulk_upload) && !row.is_deviated && (
                                                                                    <>
                                                                                        <button
                                                                                            type="button"
                                                                                            style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#d97706', padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                                            onClick={() => setDeviationModal({
                                                                                                show: true,
                                                                                                rowId: row.id,
                                                                                                reason: '',
                                                                                                target: '',
                                                                                                actualFrom: row.details.origin || '',
                                                                                                actualTo: row.details.destination || ''
                                                                                            })}
                                                                                        >
                                                                                            <AlertTriangle size={12} /> DEVIATE
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626', padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                                            onClick={() => setDeviationModal({ show: true, rowId: row.id, reason: '', target: '', isNotVisited: true })}
                                                                                        >
                                                                                            <X size={12} /> NOT VISITED
                                                                                        </button>
                                                                                    </>
                                                                                )}
                                                                                <button type="button" style={{ background: '#fee2e2', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '6px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center' }} onClick={() => deleteRow(row.id)} title="Remove entry">
                                                                                    <Trash2 size={15} />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {/* TOGGLE FOR VEHICLE vs OTHERS (Card Layout) */}
                                                                <div style={{ padding: '0 14px', marginBottom: '10px' }}>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateDetails(row.id, 'isPublicTransport', false)}
                                                                            style={{ padding: '8px', borderRadius: '6px', border: 'none', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', background: !row.details.isPublicTransport ? 'white' : 'transparent', color: !row.details.isPublicTransport ? '#1e293b' : '#64748b', boxShadow: !row.details.isPublicTransport ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                                                                        >
                                                                            VEHICLE (ODOMETER)
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateDetails(row.id, 'isPublicTransport', true)}
                                                                            style={{ padding: '8px', borderRadius: '6px', border: 'none', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', background: row.details.isPublicTransport ? 'white' : 'transparent', color: row.details.isPublicTransport ? '#1e293b' : '#64748b', boxShadow: row.details.isPublicTransport ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                                                                        >
                                                                            OTHERS (BUS/AUTO)
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* START ROW */}
                                                                <div style={{ background: '#f8faff', borderRadius: '10px', padding: '12px 14px' }}>
                                                                    <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>▶ Start</div>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '150px 110px 1fr 110px 110px', gap: '12px', alignItems: 'end' }}>
                                                                        <div className="input-with-label-mini">
                                                                            <label>Date</label>
                                                                            <input type="date" min={minDate} max={maxDate} value={row.date} onChange={e => updateRow(row.id, 'date', e.target.value)} className="cat-input" disabled={isLocked} />
                                                                        </div>
                                                                        <div className="input-with-label-mini">
                                                                            <label>Time</label>
                                                                            <input type="time" step={300} value={row.timeDetails?.boardingTime || ''} onChange={e => updateTimeDetails(row.id, 'boardingTime', e.target.value)} className="cat-input" disabled={isLocked} />
                                                                        </div>
                                                                        <div className="input-with-label-mini">
                                                                            <label>Location</label>
                                                                            <input type="text" placeholder="Start location / Origin" value={row.details.origin || ''} onChange={e => updateDetails(row.id, 'origin', e.target.value)} className="cat-input" disabled={isLocked} />
                                                                        </div>
                                                                        {!row.details.isPublicTransport ? (
                                                                            <div className="input-with-label-mini">
                                                                                <label>Odo Reading</label>
                                                                                <input type="number" placeholder="0" value={row.details.odoStart || ''} onChange={e => updateDetails(row.id, 'odoStart', e.target.value)} className="cat-input" disabled={isLocked || row.date !== todayStr} />
                                                                            </div>
                                                                        ) : (
                                                                            <div className="input-with-label-mini" style={{ gridColumn: 'span 2' }}>
                                                                                <label style={{ color: '#4f46e5' }}>Fare Paid (₹)</label>
                                                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                                                    <input type="number" placeholder="0.00" value={row.amount || ''} onChange={e => updateRow(row.id, 'amount', e.target.value)} className="cat-input" style={{ borderColor: '#4f46e5', fontWeight: 700, flex: 1 }} disabled={isLocked} />
                                                                                    {!isLocked && (
                                                                                        <button type="button" className="upload-bill-btn" style={{ height: '34px', padding: '0 10px' }} onClick={() => document.getElementById(`f-pt-${row.id}`).click()}>
                                                                                            <Upload size={14} />
                                                                                        </button>
                                                                                    )}
                                                                                    <input type="file" id={`f-pt-${row.id}`} hidden onChange={e => handleFileUpload(row.id, e.target.files[0])} accept="image/*,.pdf" />
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {!row.details.isPublicTransport && (
                                                                            <div className="input-with-label-mini">
                                                                                <label>Odo Photo</label>
                                                                                {(!isLocked && row.date === todayStr) ? (
                                                                                    <button type="button" className="odo-capture-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => handleOdoCapture(row.id, 'odoStart')}>
                                                                                        {row.details.odoStartImg ? <Check size={13} style={{ color: '#16a34a' }} /> : <Camera size={13} />}
                                                                                        <span>{row.details.odoStartImg ? 'Captured' : 'Odo Pic'}</span>
                                                                                    </button>
                                                                                ) : (
                                                                                    <div style={{ fontSize: '0.7rem', color: row.details.odoStartImg ? '#16a34a' : '#94a3b8' }}>{row.details.odoStartImg ? '✓ Captured' : 'N/A'}</div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* END ROW */}
                                                                <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '12px 14px' }}>
                                                                    <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>■ End</div>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '150px 110px 1fr 110px 110px', gap: '12px', alignItems: 'end' }}>
                                                                        <div className="input-with-label-mini">
                                                                            <label>Date</label>
                                                                            <input type="date" min={minDate} max={maxDate} value={row.details.endDate || row.date} onChange={e => updateDetails(row.id, 'endDate', e.target.value)} className="cat-input" disabled={isLocked} />
                                                                        </div>
                                                                        <div className="input-with-label-mini">
                                                                            <label>Time</label>
                                                                            <input type="time" value={row.timeDetails?.actualTime || ''} onChange={e => updateTimeDetails(row.id, 'actualTime', e.target.value)} className="cat-input" disabled={isLocked} />
                                                                        </div>
                                                                        <div className="input-with-label-mini">
                                                                            <label>Location</label>
                                                                            <input type="text" placeholder="End location / Destination" value={row.details.destination || ''} onChange={e => updateDetails(row.id, 'destination', e.target.value)} className="cat-input" disabled={isLocked} />
                                                                        </div>
                                                                        {!row.details.isPublicTransport ? (
                                                                            <div className="input-with-label-mini">
                                                                                <label>Odo Reading</label>
                                                                                <input type="number" placeholder="0" value={row.details.odoEnd || ''} onChange={e => updateDetails(row.id, 'odoEnd', e.target.value)} className="cat-input" disabled={isLocked || row.date !== todayStr} />
                                                                            </div>
                                                                        ) : (
                                                                            <div className="input-with-label-mini" style={{ gridColumn: 'span 2' }}>
                                                                                <label>Type / Public Mode</label>
                                                                                <select
                                                                                    className="cat-input"
                                                                                    value={row.details.remainingRoute || 'Auto'}
                                                                                    onChange={e => updateDetails(row.id, 'remainingRoute', e.target.value)}
                                                                                    disabled={isLocked}
                                                                                >
                                                                                    <option value="Auto">Auto</option>
                                                                                    <option value="Bus">Bus</option>
                                                                                    <option value="Taxi">Taxi</option>
                                                                                    <option value="Metro">Metro</option>
                                                                                    <option value="Rickshaw">Rickshaw</option>
                                                                                    <option value="Other">Other</option>
                                                                                </select>
                                                                            </div>
                                                                        )}
                                                                        {!row.details.isPublicTransport && (
                                                                            <div className="input-with-label-mini">
                                                                                <label>Odo Photo</label>
                                                                                {(!isLocked && row.date === todayStr) ? (
                                                                                    <button type="button" className="odo-capture-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => handleOdoCapture(row.id, 'odoEnd')}>
                                                                                        {row.details.odoEndImg ? <Check size={13} style={{ color: '#16a34a' }} /> : <Camera size={13} />}
                                                                                        <span>{row.details.odoEndImg ? 'Captured' : 'Odo Pic'}</span>
                                                                                    </button>
                                                                                ) : (
                                                                                    <div style={{ fontSize: '0.7rem', color: row.details.odoEndImg ? '#16a34a' : '#94a3b8' }}>{row.details.odoEndImg ? '✓ Captured' : 'N/A'}</div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* CALC + INLINE JOB REPORT */}
                                                                <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                                                    {/* Calc bar */}
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: jobReportOpen[row.id] || row.details.jobReport ? '1px solid #e2e8f0' : 'none' }}>
                                                                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
                                                                            {row.details.isPublicTransport ? 'Calculated Fare claim : ' : 'Calc. Odo claim : '} &nbsp;
                                                                            <span style={{ color: '#4f46e5', fontWeight: 800, fontSize: '0.9rem' }}>₹{formatIndianCurrency(parseFloat(row.amount || 0).toFixed(2))}</span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                            {row.details.jobReport && !jobReportOpen[row.id] && (
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '20px', padding: '4px 12px' }}>
                                                                                    <FileText size={13} style={{ color: '#16a34a' }} />
                                                                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#15803d' }}>Job Report Saved</span>
                                                                                </div>
                                                                            )}
                                                                            {!isLocked && (
                                                                                <button
                                                                                    type="button"
                                                                                    className="job-report-btn"
                                                                                    style={{ background: row.details.jobReport ? '#f0fdf4' : undefined, color: row.details.jobReport ? '#15803d' : undefined, border: row.details.jobReport ? '1px solid #bbf7d0' : undefined }}
                                                                                    onClick={() => {
                                                                                        setJobReportOpen(prev => ({ ...prev, [row.id]: !prev[row.id] }));
                                                                                        if (!jobReportOpen[row.id]) {
                                                                                            setJobReportDraft(prev => ({
                                                                                                ...prev,
                                                                                                [row.id]: row.details.jobReport || '',
                                                                                                [`${row.id}_files`]: row.details.jobReportFiles || []
                                                                                            }));
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    <FileText size={14} />
                                                                                    {row.details.jobReport ? (jobReportOpen[row.id] ? 'Close Report' : 'Edit Report') : (jobReportOpen[row.id] ? 'Close' : 'Write Job Report')}
                                                                                </button>
                                                                            )}
                                                                            {isLocked && row.details.jobReport && (
                                                                                <button
                                                                                    type="button"
                                                                                    className="job-report-btn"
                                                                                    onClick={() => setJobReportOpen(prev => ({ ...prev, [row.id]: !prev[row.id] }))}
                                                                                >
                                                                                    <FileText size={14} />
                                                                                    {jobReportOpen[row.id] ? 'Hide Report' : 'View Job Report'}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Inline composer / viewer */}
                                                                    {jobReportOpen[row.id] && (
                                                                        isLocked ? (
                                                                            /* ── VIEW MODE ── */
                                                                            <div style={{ borderTop: '1px solid #e2e8f0', background: 'white' }}>
                                                                                <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                                                                                    <span style={{ color: '#94a3b8', marginRight: '8px' }}>Subject</span>
                                                                                    {tripId} — Job / Activity Report
                                                                                </div>
                                                                                <div style={{ padding: '16px', fontSize: '0.88rem', color: '#1e293b', lineHeight: 1.7, whiteSpace: 'pre-wrap', minHeight: '80px' }}>
                                                                                    {row.details.jobReport}
                                                                                </div>
                                                                                {row.details.jobReportFiles && row.details.jobReportFiles.length > 0 && (
                                                                                    <div style={{ padding: '8px 16px 12px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                                        {row.details.jobReportFiles.map((f, fi) => (
                                                                                            <a key={fi} href={getFullUrl(f.data)} download={f.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f1f5f9', borderRadius: '8px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, color: '#334155', textDecoration: 'none' }}>
                                                                                                <FileText size={13} /> {f.name}
                                                                                            </a>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            /* ── COMPOSE MODE — email-style ── */
                                                                            <div style={{ borderTop: '1px solid #e2e8f0', background: 'white', borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px' }}>
                                                                                {/* Dark header */}
                                                                                <div style={{ background: '#1e293b', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>
                                                                                        {row.details.jobReport ? 'Edit Job Report' : 'New Job Report'}
                                                                                    </span>
                                                                                    <button type="button" onClick={() => setJobReportOpen(prev => ({ ...prev, [row.id]: false }))} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                        <X size={14} />
                                                                                    </button>
                                                                                </div>

                                                                                {/* Subject line */}
                                                                                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f1f5f9', gap: '10px' }}>
                                                                                    <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 500, minWidth: '55px' }}>Subject</span>
                                                                                    <span style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 500 }}>
                                                                                        {tripId} — Job / Activity Report
                                                                                    </span>
                                                                                </div>

                                                                                {/* Body */}
                                                                                <textarea
                                                                                    rows={7}
                                                                                    style={{ width: '100%', border: 'none', borderBottom: '1px solid #f1f5f9', padding: '14px 16px', fontSize: '0.88rem', color: '#1e293b', resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.7, background: 'white', display: 'block', boxSizing: 'border-box' }}
                                                                                    placeholder="Write your detailed job/activity report here..."
                                                                                    value={jobReportDraft[row.id] ?? row.details.jobReport ?? ''}
                                                                                    onChange={e => setJobReportDraft(prev => ({ ...prev, [row.id]: e.target.value }))}
                                                                                    autoFocus
                                                                                />

                                                                                {/* Attached files preview */}
                                                                                {(jobReportDraft[`${row.id}_files`] || []).length > 0 && (
                                                                                    <div style={{ padding: '6px 16px', display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid #f1f5f9' }}>
                                                                                        {(jobReportDraft[`${row.id}_files`] || []).map((f, fi) => (
                                                                                            <div key={fi} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f1f5f9', borderRadius: '8px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
                                                                                                <FileText size={13} /> {f.name}
                                                                                                <button type="button" onClick={() => { setJobReportDraft(prev => { const files = (prev[`${row.id}_files`] || []).filter((_, i) => i !== fi); return { ...prev, [`${row.id}_files`]: files }; }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, marginLeft: '2px', lineHeight: 1 }}>
                                                                                                    <X size={11} />
                                                                                                </button>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}

                                                                                {/* Bottom bar */}
                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#f8fafc', borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px' }}>
                                                                                    {/* Send button */}
                                                                                    <button
                                                                                        type="button"
                                                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '22px', border: 'none', background: 'linear-gradient(135deg, #4f83cc, #6ba3e0)', fontSize: '0.85rem', fontWeight: 700, color: 'white', cursor: 'pointer', boxShadow: '0 2px 6px rgba(79,131,204,0.4)' }}
                                                                                        onClick={() => {
                                                                                            const text = jobReportDraft[row.id] ?? '';
                                                                                            const files = jobReportDraft[`${row.id}_files`] ?? [];
                                                                                            updateDetails(row.id, 'jobReport', text);
                                                                                            updateDetails(row.id, 'jobReportFiles', files);
                                                                                            setJobReportOpen(prev => ({ ...prev, [row.id]: false }));
                                                                                            showToast('Job report applied to entry. Click "Commit Registry" to save permanently.', 'success');
                                                                                        }}
                                                                                    >
                                                                                        Apply to Entry
                                                                                        <ChevronDown size={15} />
                                                                                    </button>

                                                                                    {/* Right: Attach + Discard */}
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                                        {/* Attach file */}
                                                                                        <button type="button" title="Attach file" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', padding: '4px' }}
                                                                                            onClick={() => document.getElementById(`jr-file-${row.id}`).click()}>
                                                                                            <Upload size={17} />
                                                                                        </button>
                                                                                        <input type="file" id={`jr-file-${row.id}`} hidden multiple accept="image/*,.pdf,.doc,.docx"
                                                                                            onChange={e => {
                                                                                                const validFiles = Array.from(e.target.files).filter(file => {
                                                                                                    if (file.size > 10 * 1024 * 1024) {
                                                                                                        showToast(`File "${file.name}" is too large (max 10MB). Converting huge PDFs to base64 can crash the page.`, 'error');
                                                                                                        return false;
                                                                                                    }
                                                                                                    return true;
                                                                                                });

                                                                                                const newFilesPromises = validFiles.map(file => {
                                                                                                    return new Promise(resolve => {
                                                                                                        const reader = new FileReader();
                                                                                                        reader.onload = ev => resolve({ name: file.name, data: ev.target.result });
                                                                                                        reader.readAsDataURL(file);
                                                                                                    });
                                                                                                });
                                                                                                Promise.all(newFilesPromises).then(resolved => {
                                                                                                    setJobReportDraft(prev => ({ ...prev, [`${row.id}_files`]: [...(prev[`${row.id}_files`] || []), ...resolved] }));
                                                                                                });
                                                                                                if (e.target) e.target.value = '';
                                                                                            }}
                                                                                        />
                                                                                        {/* Discard */}
                                                                                        <button type="button" title="Discard" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', padding: '4px' }}
                                                                                            onClick={() => {
                                                                                                setJobReportOpen(prev => ({ ...prev, [row.id]: false }));
                                                                                                setJobReportDraft(prev => { const n = { ...prev }; delete n[row.id]; delete n[`${row.id}_files`]; return n; });
                                                                                            }}>
                                                                                            <X size={17} />
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>

                                                                {/* INCIDENTAL + DAY TOTAL */}
                                                                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
                                                                    <div style={{ flex: 1, minWidth: '300px' }}>
                                                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Incidental Expenses (Optional)</div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                                            <select className="cat-input" style={{ width: '175px', flexShrink: 0 }} value={row.details.incidentalCategory || ''} onChange={e => updateDetails(row.id, 'incidentalCategory', e.target.value)} disabled={isLocked}>
                                                                                <option value="">Select Category</option>
                                                                                {incidentalTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                                            </select>
                                                                            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#f8fafc', height: '34px', flexShrink: 0 }}>
                                                                                <span style={{ padding: '0 10px', fontSize: '0.85rem', color: '#94a3b8', borderRight: '1px solid #e2e8f0', lineHeight: '34px' }}>₹</span>
                                                                                <input type="number" placeholder="Cost" style={{ border: 'none', background: 'transparent', width: '90px', padding: '0 10px', fontSize: '0.85rem', outline: 'none', height: '100%' }} value={row.details.incidentalAmount || ''} onChange={e => updateDetails(row.id, 'incidentalAmount', e.target.value)} disabled={isLocked} />
                                                                            </div>
                                                                            {!isLocked && (
                                                                                <>
                                                                                    <button type="button" className="upload-bill-btn" onClick={() => document.getElementById(`f-${row.id}`).click()}>
                                                                                        <Upload size={13} /> Upload Bill
                                                                                    </button>
                                                                                    <input type="file" id={`f-${row.id}`} hidden onChange={e => handleFileUpload(row.id, e.target.files[0])} accept="image/*,.pdf" />
                                                                                </>
                                                                            )}
                                                                            {(row.bills || []).length > 0 && (
                                                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                                    {row.bills.map((b, i) => (
                                                                                        <div key={i} style={{ position: 'relative', display: 'inline-flex', cursor: 'pointer', background: '#e0f2fe', borderRadius: '6px', padding: '4px 8px', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#0369a1', fontWeight: 600 }} onClick={() => previewBill(b)}>
                                                                                            <FileText size={12} /> Bill {i + 1}
                                                                                            {!isLocked && (
                                                                                                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0, lineHeight: 1, marginLeft: '2px' }} onClick={e => { e.stopPropagation(); removeBill(row.id, i); }}>
                                                                                                    <X size={10} />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ background: 'linear-gradient(135deg, #4f46e5, #0ea5e9)', borderRadius: '12px', padding: '10px 20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                                                                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Day Total</span>
                                                                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white', lineHeight: 1.1 }}>
                                                                            ₹{formatIndianCurrency((parseFloat(row.amount || 0) + parseFloat(row.details.incidentalAmount || 0)).toFixed(2))}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ));
                                    })()
                                ) : (
                                    categoryRows.map(row => (
                                        <React.Fragment key={row.id}>
                                            <tr className={`category-row category-grid-row ${row.details.travelStatus && row.details.travelStatus !== 'Completed' ? 'status-row-' + row.details.travelStatus.toLowerCase() : ''}`} style={{ gridTemplateColumns }}>
                                                {/* DATE COLUMN */}
                                                <td>
                                                    {nature === 'Travel' ? (
                                                        <div className="row-fields">
                                                            <div className="input-with-label-mini">
                                                                <label>BOOKING DATE & TIME</label>
                                                                <div className="field-group">
                                                                    <input type="date" min={minDate} max={maxDate} value={row.date} onChange={e => updateRow(row.id, 'date', e.target.value)} style={{ flex: 1.5 }} />
                                                                    <input type="time" value={row.details.bookingTime || ''} onChange={e => updateDetails(row.id, 'bookingTime', e.target.value)} style={{ flex: 1 }} />
                                                                </div>
                                                                {errors[row.id]?.date && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{errors[row.id].date}</div>}
                                                            </div>
                                                            {['Flight', 'Train', 'Intercity Bus', 'Intercity Cab'].includes(row.details.mode) && row.date && row.details.depDate && new Date(row.date) > new Date(row.details.depDate) && (
                                                                <div className="text-danger" style={{ fontSize: '0.55rem', fontWeight: 700, marginTop: '2px', textTransform: 'uppercase' }}>⚠️ Booking Date &gt; Departure Date</div>
                                                            )}
                                                            {['Flight', 'Train', 'Intercity Bus', 'Intercity Cab'].includes(row.details.mode) && row.details.depDate && row.details.arrDate && new Date(row.details.depDate) > new Date(row.details.arrDate) && (
                                                                <div className="text-danger" style={{ fontSize: '0.55rem', fontWeight: 700, marginTop: '2px', textTransform: 'uppercase' }}>⚠️ Dep Date &gt; Arr Date</div>
                                                            )}
                                                        </div>
                                                    ) : nature === 'Accommodation' ? (
                                                        <div className="field-group">
                                                            <div className="input-with-label-mini">
                                                                <label>CHECK-IN</label>
                                                                <input type="date" min={minDate} max={maxDate} value={row.details.checkIn || ''} onChange={e => updateDetails(row.id, 'checkIn', e.target.value)} />
                                                                <input type="time" value={row.details.checkInTime || ''} onChange={e => updateDetails(row.id, 'checkInTime', e.target.value)} />
                                                            </div>
                                                            <div className="input-with-label-mini">
                                                                <label>CHECK-OUT</label>
                                                                <input type="date" min={minDate} max={maxDate} value={row.details.checkOut || ''} onChange={e => updateDetails(row.id, 'checkOut', e.target.value)} />
                                                                <input type="time" value={row.details.checkOutTime || ''} onChange={e => updateDetails(row.id, 'checkOutTime', e.target.value)} />
                                                            </div>
                                                        </div>
                                                    ) : nature === 'Local Travel' ? (
                                                        <div className="field-group">
                                                            <div className="input-with-label-mini">
                                                                <label>START DATE</label>
                                                                <input type="date" value={row.date} onChange={e => updateRow(row.id, 'date', e.target.value)} />
                                                            </div>
                                                            <div className="input-with-label-mini">
                                                                <label>END DATE</label>
                                                                <input type="date" min={minDate} max={maxDate} value={row.endDate || row.date} onChange={e => updateRow(row.id, 'endDate', e.target.value)} />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <input type="date" min={minDate} max={maxDate} className="cat-input" value={row.date} onChange={e => updateRow(row.id, 'date', e.target.value)} />
                                                    )}
                                                </td>

                                                {/* NATURE SPECIFIC DETAILS */}
                                                {nature === 'Travel' && (
                                                    <>
                                                        {/* TRAVEL MODE COLUMN (Matches Header: Travel Mode) */}
                                                        <td>
                                                            <div className="row-fields">
                                                                <div style={{ flex: 1 }}>
                                                                    <select className="cat-input" value={row.details.mode || ''} onChange={e => {
                                                                        updateDetails(row.id, 'mode', e.target.value);
                                                                        if (e.target.value === 'Intercity Cab') {
                                                                            updateDetails(row.id, 'cancellationDate', null);
                                                                            updateDetails(row.id, 'refundAmount', 0);
                                                                        }
                                                                    }}>
                                                                        <option value="">Mode</option>
                                                                        {travelModes.map(m => <option key={m} value={m}>{m}</option>)}
                                                                    </select>
                                                                    {errors[row.id]?.mode && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{errors[row.id].mode}</div>}
                                                                </div>
                                                                <select className="cat-input mt-1" value={row.details.bookedBy || 'Self Booked'} onChange={e => updateDetails(row.id, 'bookedBy', e.target.value)}>
                                                                    {bookedByOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                                                </select>
                                                            </div>
                                                        </td>


                                                        {/* ROUTE & CARRIER INFO (Matches Header: Route & Carrier Info) */}
                                                        <td>
                                                            <div className="row-fields">
                                                                {row.details.mode === 'Flight' ? (
                                                                    <>
                                                                        <div className="field-group">
                                                                            <div style={{ flex: 1, position: 'relative' }}>
                                                                                <input
                                                                                    type="text"
                                                                                    placeholder="From Airport"
                                                                                    value={row.details.origin || ''}
                                                                                    onChange={e => updateDetails(row.id, 'origin', e.target.value)}
                                                                                    disabled={isFixedLocal && !row.is_deviated}
                                                                                    style={{ width: '100%', paddingRight: (isFixedLocal && !row.is_deviated) ? '70px' : '8px' }}
                                                                                />
                                                                                {isFixedLocal && !row.is_deviated && (
                                                                                    <button
                                                                                        className="deviate-mini-btn"
                                                                                        onClick={() => setDeviationModal({ show: true, rowId: row.id, reason: '' })}
                                                                                        style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.65rem', padding: '2px 6px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                                                                                    >
                                                                                        <AlertTriangle size={10} /> Deviate
                                                                                    </button>
                                                                                )}
                                                                                {errors[row.id]?.origin && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{errors[row.id].origin}</div>}
                                                                            </div>
                                                                            <div style={{ flex: 1 }}>
                                                                                <input
                                                                                    type="text"
                                                                                    placeholder="To Airport"
                                                                                    value={row.details.destination || ''}
                                                                                    onChange={e => updateDetails(row.id, 'destination', e.target.value)}
                                                                                    disabled={isFixedLocal && !row.is_deviated}
                                                                                    style={{ width: '100%' }}
                                                                                />
                                                                                {errors[row.id]?.destination && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{errors[row.id].destination}</div>}
                                                                            </div>
                                                                        </div>
                                                                        <div className="field-group mt-1">
                                                                            <div style={{ flex: 1.5 }}>
                                                                                <input type="text" placeholder="Airline Name" value={row.details.provider || ''} onChange={e => updateDetails(row.id, 'provider', e.target.value)} style={{ flex: 1.5 }} />
                                                                                {errors[row.id]?.provider && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{errors[row.id].provider}</div>}
                                                                            </div>
                                                                            <div style={{ flex: 1 }}>
                                                                                <input type="text" placeholder="Flight No." value={row.details.travelNo || ''} onChange={e => updateDetails(row.id, 'travelNo', e.target.value)} style={{ flex: 1 }} />
                                                                                {errors[row.id]?.travelNo && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{errors[row.id].travelNo}</div>}
                                                                            </div>
                                                                        </div>
                                                                        <div className="field-group mt-1">
                                                                            <div style={{ flex: 1.5 }}>
                                                                                <input type="text" placeholder="Ticket Number" value={row.details.ticketNo || ''} onChange={e => updateDetails(row.id, 'ticketNo', e.target.value)} style={{ flex: 1.5 }} />
                                                                                {errors[row.id]?.ticketNo && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{errors[row.id].ticketNo}</div>}
                                                                            </div>
                                                                            <div style={{ flex: 1 }}>
                                                                                <input type="text" placeholder="PNR" value={row.details.pnr || ''} onChange={e => updateDetails(row.id, 'pnr', e.target.value)} style={{ flex: 1 }} />
                                                                                {errors[row.id]?.pnr && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{errors[row.id].pnr}</div>}
                                                                            </div>
                                                                        </div>
                                                                        <div className="field-group mt-1">
                                                                            <select style={{ width: '100%' }} value={row.details.classType || ''} onChange={e => updateDetails(row.id, 'classType', e.target.value)}>
                                                                                <option value="">Travel Class</option>
                                                                                {flightClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                                                            </select>
                                                                        </div>
                                                                    </>
                                                                ) : row.details.mode === 'Intercity Cab' ? (
                                                                    <>
                                                                        <div className="field-group">
                                                                            <input type="text" placeholder="From Location" value={row.details.origin || ''} onChange={e => updateDetails(row.id, 'origin', e.target.value)} style={{ flex: 1 }} disabled={isFixedLocal && !row.is_deviated} />
                                                                            <input type="text" placeholder="To Location" value={row.details.destination || ''} onChange={e => updateDetails(row.id, 'destination', e.target.value)} style={{ flex: 1 }} disabled={isFixedLocal && !row.is_deviated} />
                                                                        </div>
                                                                        <div className="field-group mt-1">
                                                                            <input type="text" placeholder="Provider / Vendor" value={row.details.provider || ''} onChange={e => updateDetails(row.id, 'provider', e.target.value)} style={{ flex: 1.5 }} />

                                                                        </div>
                                                                        <div className="field-group mt-1">
                                                                            <select value={row.details.vehicleType || ''} onChange={e => updateDetails(row.id, 'vehicleType', e.target.value)} style={{ flex: 1.5 }}>
                                                                                <option value="">Vehicle Type</option>
                                                                                {intercityCabVehicleTypes.map(v => <option key={v} value={v}>{v}</option>)}
                                                                            </select>
                                                                            <input type="text" placeholder="Driver Name" value={row.details.driverName || ''} onChange={e => updateDetails(row.id, 'driverName', e.target.value)} style={{ flex: 1 }} />
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        {/* Default (Train, Intercity Bus, Intercity Car etc.) */}
                                                                        <div className="field-group">
                                                                            <div style={{ flex: 1 }}>
                                                                                <input type="text" placeholder="From" value={row.details.origin || ''} onChange={e => updateDetails(row.id, 'origin', e.target.value)} style={{ flex: 1 }} disabled={isFixedLocal && !row.is_deviated} />
                                                                                {errors[row.id]?.origin && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{errors[row.id].origin}</div>}
                                                                            </div>
                                                                            <div style={{ flex: 1 }}>
                                                                                <input type="text" placeholder="To" value={row.details.destination || ''} onChange={e => updateDetails(row.id, 'destination', e.target.value)} style={{ flex: 1 }} disabled={isFixedLocal && !row.is_deviated} />
                                                                                {errors[row.id]?.destination && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{errors[row.id].destination}</div>}
                                                                            </div>
                                                                            {row.details.mode === 'Intercity Bus' && (
                                                                                <input type="text" placeholder="Boarding Point" value={row.details.boardingPoint || ''} onChange={e => updateDetails(row.id, 'boardingPoint', e.target.value)} style={{ flex: 1 }} className="ml-1" />
                                                                            )}
                                                                        </div>
                                                                        <div className="field-group mt-1">
                                                                            <input type="text" placeholder={row.details.mode === 'Intercity Bus' ? "Provider / Agent" : "Provider/Agent"} value={row.details.provider || ''} onChange={e => updateDetails(row.id, 'provider', e.target.value)} style={{ flex: 1.5 }} />

                                                                        </div>
                                                                        <div className="field-group mt-1">
                                                                            <input type="text" placeholder="Ticket No." value={row.details.ticketNo || ''} onChange={e => updateDetails(row.id, 'ticketNo', e.target.value)} style={{ flex: 1.5 }} />
                                                                            <input type="text" placeholder="PNR / Ref" value={row.details.pnr || ''} onChange={e => updateDetails(row.id, 'pnr', e.target.value)} style={{ flex: 1 }} />
                                                                        </div>
                                                                        <div className="field-group mt-1">
                                                                            <input type="text" placeholder={row.details.mode === 'Train' ? "Train Name" : (row.details.mode === 'Intercity Bus' ? "Bus Operator" : "Carrier Name")} value={row.details.carrier || ''} onChange={e => updateDetails(row.id, 'carrier', e.target.value)} style={{ flex: 1 }} />
                                                                            {row.details.mode === 'Train' && (
                                                                                <input type="text" placeholder="Tr No." style={{ width: '60px' }} value={row.details.travelNo || row.details.trainNo || ''} onChange={e => { updateDetails(row.id, 'travelNo', e.target.value); updateDetails(row.id, 'trainNo', e.target.value); }} />
                                                                            )}
                                                                        </div>
                                                                        <div className="field-group mt-1">
                                                                            <select value={row.details.classType || ''} onChange={e => updateDetails(row.id, 'classType', e.target.value)}>
                                                                                <option value="">{row.details.mode === 'Intercity Bus' ? 'Bus Type' : 'Cls'}</option>
                                                                                {row.details.mode === 'Train' && trainClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                                                                {row.details.mode === 'Intercity Bus' && busSeatTypes.map(c => <option key={c} value={c}>{c}</option>)}
                                                                            </select>
                                                                            {row.details.mode === 'Train' && (
                                                                                <label className="checkbox-item mini ml-2" style={{ whiteSpace: 'nowrap' }}>
                                                                                    <input type="checkbox" checked={row.details.isTatkal === true} onChange={e => updateDetails(row.id, 'isTatkal', e.target.checked)} />
                                                                                    <span>Tatkal?</span>
                                                                                </label>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                )}
                                                                {row.is_deviated && (
                                                                    <div className="deviation-indicator mt-1" style={{ fontSize: '0.7rem', color: '#dc2626', background: '#fff5f5', padding: '4px 8px', borderRadius: '4px', border: '1px solid #feb2b2', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                        <Info size={10} />
                                                                        <strong>Deviated:</strong> {row.deviation_target ? `${row.deviation_target} - ` : ''}{row.deviation_reason}
                                                                        <button
                                                                            onClick={() => {
                                                                                confirm({
                                                                                    title: "Remove Deviation?",
                                                                                    message: "Reset route to planned path?",
                                                                                    onConfirm: () => {
                                                                                        setRows(prev => prev.map(r => {
                                                                                            if (r.id === row.id) {
                                                                                                return {
                                                                                                    ...r,
                                                                                                    is_deviated: false,
                                                                                                    deviation_reason: '',
                                                                                                    deviation_target: '',
                                                                                                    isSaved: false
                                                                                                };
                                                                                            }
                                                                                            return r;
                                                                                        }));
                                                                                    }
                                                                                });
                                                                            }}
                                                                            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.65rem', padding: '0 4px', fontWeight: 700 }}
                                                                        >
                                                                            RESET
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* JOURNEY SCHEDULE COLUMN */}
                                                        <td>
                                                            <div className="time-fields quad">
                                                                {/* add departure/arrival dates here */}
                                                                <div className="field-group">
                                                                    <div className="input-with-label-mini">
                                                                        <label>DEP. DATE</label>
                                                                        <input type="date" min={minDate} max={maxDate} value={row.details.depDate || row.date} onChange={e => updateDetails(row.id, 'depDate', e.target.value)} />
                                                                        {errors[row.id]?.depDate && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{errors[row.id].depDate}</div>}
                                                                    </div>
                                                                    <div className="input-with-label-mini">
                                                                        <label>ARR. DATE</label>
                                                                        <input type="date" min={minDate} max={maxDate} value={row.details.arrDate || row.date} onChange={e => updateDetails(row.id, 'arrDate', e.target.value)} />
                                                                        {errors[row.id]?.arrDate && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{errors[row.id].arrDate}</div>}
                                                                    </div>
                                                                </div>
                                                                {['Flight', 'Intercity Bus', 'Intercity Cab'].includes(row.details.mode) ? (
                                                                    <>
                                                                        <div className="time-row-pair">
                                                                            <div className="input-with-label-mini">
                                                                                <label>DEP. TIME</label>
                                                                                <input type="time" value={row.timeDetails.boardingTime || ''} onChange={e => updateTimeDetails(row.id, 'boardingTime', e.target.value)} />
                                                                            </div>
                                                                            <div className="input-with-label-mini">
                                                                                <label>ARR. TIME</label>
                                                                                <input type="time" value={row.timeDetails.actualTime || ''} onChange={e => updateTimeDetails(row.id, 'actualTime', e.target.value)} />
                                                                            </div>
                                                                        </div>
                                                                        {row.details.mode === 'Flight' && (
                                                                            <div className="time-row mt-1" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <label className="checkbox-item mini">
                                                                                    <input type="checkbox" checked={row.details.mealIncluded === 'Yes' || row.details.mealIncluded === true} onChange={e => updateDetails(row.id, 'mealIncluded', e.target.checked ? 'Yes' : 'No')} />
                                                                                    <span>Meal?</span>
                                                                                </label>
                                                                                <label className="checkbox-item mini">
                                                                                    <input type="checkbox" checked={row.details.excessBaggage === 'Yes' || row.details.excessBaggage === true} onChange={e => updateDetails(row.id, 'excessBaggage', e.target.checked ? 'Yes' : 'No')} />
                                                                                    <span>Baggage?</span>
                                                                                </label>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    // Standard Journey / Train
                                                                    <>
                                                                        <div className="time-row-pair">
                                                                            <div className="input-with-label-mini">
                                                                                <label>{row.details.mode === 'Train' ? 'DEP. TIME' : 'TIME'}</label>
                                                                                <input type="time" value={row.timeDetails.boardingTime || ''} onChange={e => updateTimeDetails(row.id, 'boardingTime', e.target.value)} />
                                                                            </div>
                                                                            <div className="input-with-label-mini">
                                                                                <label>{row.details.mode === 'Train' ? 'ARR. TIME' : 'SCHEDULED'}</label>
                                                                                <input type="time" value={row.timeDetails.actualTime || ''} onChange={e => updateTimeDetails(row.id, 'actualTime', e.target.value)} />
                                                                            </div>
                                                                        </div>
                                                                        {row.details.mode === 'Train' && (
                                                                            <>
                                                                                <div className="time-row">
                                                                                    <label>Delay (Min)</label>
                                                                                    <input type="number" readOnly value={row.timeDetails.delay || 0} style={{ width: '60px' }} />
                                                                                </div>
                                                                                <div className="time-row mt-1" style={{ gridColumn: '1 / -1' }}>
                                                                                    <label className="checkbox-item mini">
                                                                                        <input type="checkbox" checked={row.details.mealIncluded === 'Yes' || row.details.mealIncluded === true} onChange={e => updateDetails(row.id, 'mealIncluded', e.target.checked ? 'Yes' : 'No')} />
                                                                                        <span>Meal Provided?</span>
                                                                                    </label>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </>
                                                )}

                                                {nature === 'Local Travel' && (
                                                    <>
                                                        {/* MODE & SUBTYPE COLUMN */}
                                                        <td>
                                                            <div className="row-fields">
                                                                <select className="cat-input" value={row.details.mode || ''} onChange={e => { if (!isFixedLocal) { updateDetails(row.id, 'mode', e.target.value); updateDetails(row.id, 'subType', ''); } }} disabled={isFixedLocal}>
                                                                    <option value="">Select Mode</option>
                                                                    {localTravelModes.map(m => <option key={m} value={m}>{m}</option>)}
                                                                </select>

                                                                {row.details.mode === 'Car / Cab' && (
                                                                    <select className="cat-input mt-1" value={row.details.subType || ''} onChange={e => { if (!isFixedLocal) updateDetails(row.id, 'subType', e.target.value); }} disabled={isFixedLocal}>
                                                                        <option value="">Select Sub-Type</option>
                                                                        {localCarSubTypes.map(s => <option key={s} value={s}>{s}</option>)}
                                                                    </select>
                                                                )}

                                                                {row.details.mode === 'Bike' && (
                                                                    <select className="cat-input mt-1" value={row.details.subType || ''} onChange={e => { if (!isFixedLocal) updateDetails(row.id, 'subType', e.target.value); }} disabled={isFixedLocal}>
                                                                        <option value="">Select Sub-Type</option>
                                                                        {localBikeSubTypes.map(s => <option key={s} value={s}>{s}</option>)}
                                                                    </select>
                                                                )}

                                                                {row.details.mode === 'Public Transport' && (
                                                                    <select className="cat-input mt-1" value={row.details.subType || ''} onChange={e => { if (!isFixedLocal) updateDetails(row.id, 'subType', e.target.value); }} disabled={isFixedLocal}>
                                                                        <option value="">Select Sub-Type</option>
                                                                        {localProviders.map(s => <option key={s} value={s}>{s}</option>)}
                                                                    </select>
                                                                )}
                                                                <select className="cat-input mt-1" value={row.details.bookedBy || 'Self Booked'} onChange={e => { if (!isFixedLocal) updateDetails(row.id, 'bookedBy', e.target.value); }} disabled={isFixedLocal}>
                                                                    {bookedByOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                                                </select>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="row-fields">
                                                                <div className="field-group" style={{ position: 'relative' }}>
                                                                    <div style={{ flex: 1, position: 'relative' }}>
                                                                        <input
                                                                            type="text"
                                                                            placeholder="From Location"
                                                                            value={row.details.origin || ''}
                                                                            onChange={e => updateDetails(row.id, 'origin', e.target.value)}
                                                                            disabled={isFixedLocal && !row.is_deviated}
                                                                            style={{ width: '100%', paddingRight: isFixedLocal ? '80px' : '8px' }}
                                                                        />
                                                                        {isFixedLocal && !row.is_deviated && (
                                                                            <button
                                                                                className="deviate-mini-btn"
                                                                                onClick={() => setDeviationModal({
                                                                                    show: true,
                                                                                    rowId: row.id,
                                                                                    reason: '',
                                                                                    actualFrom: row.details.origin || '',
                                                                                    actualTo: row.details.destination || ''
                                                                                })}
                                                                                title="Report deviation from planned route"
                                                                            >
                                                                                <AlertTriangle size={12} /> Deviate
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="To Location"
                                                                        value={row.details.destination || ''}
                                                                        onChange={e => updateDetails(row.id, 'destination', e.target.value)}
                                                                        disabled={isFixedLocal && !row.is_deviated}
                                                                        style={{ flex: 1 }}
                                                                    />
                                                                </div>
                                                                {row.is_deviated && (
                                                                    <div className="deviation-indicator" title={row.deviation_reason}>
                                                                        <Info size={10} />
                                                                        <strong>Deviated:</strong> {row.deviation_target ? `${row.deviation_target} - ` : ''}{row.deviation_reason}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        {/* TIME & TRACKING COLUMN */}
                                                        <td>
                                                            <div className="time-fields quad">
                                                                <div className="time-row">
                                                                    <label>Start Time</label>
                                                                    <input type="time" value={row.timeDetails.boardingTime || ''} onChange={e => updateTimeDetails(row.id, 'boardingTime', e.target.value)} />
                                                                </div>
                                                                <div className="time-row">
                                                                    <label>End Time</label>
                                                                    <input type="time" value={row.timeDetails.actualTime || ''} onChange={e => updateTimeDetails(row.id, 'actualTime', e.target.value)} />
                                                                </div>

                                                                <div className="odo-tracking mt-2" style={{ gridColumn: '1 / -1' }}>
                                                                    {/* TOGGLE FOR VEHICLE vs OTHERS */}
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#f1f5f9', borderRadius: '8px', padding: '3px', marginBottom: '12px' }}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateDetails(row.id, 'isPublicTransport', false)}
                                                                            style={{ padding: '6px', borderRadius: '6px', border: 'none', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', background: !row.details.isPublicTransport ? 'white' : 'transparent', color: !row.details.isPublicTransport ? '#1e293b' : '#64748b', boxShadow: !row.details.isPublicTransport ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                                                                        >
                                                                            VEHICLE (ODOMETER)
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateDetails(row.id, 'isPublicTransport', true)}
                                                                            style={{ padding: '6px', borderRadius: '6px', border: 'none', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', background: row.details.isPublicTransport ? 'white' : 'transparent', color: row.details.isPublicTransport ? '#1e293b' : '#64748b', boxShadow: row.details.isPublicTransport ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                                                                        >
                                                                            OTHERS (BUS/AUTO)
                                                                        </button>
                                                                    </div>

                                                                    {!row.details.isPublicTransport && ['Own Car', 'Company Car', 'Own Bike', 'Self Drive Rental'].includes(row.details.subType) && (
                                                                        <>
                                                                            {(() => {
                                                                                const is4W = row.details.subType.includes('Car');
                                                                                const rate = fuelRates[is4W ? '4 Wheeler' : '2 Wheeler'];
                                                                                return (
                                                                                    <div className="mb-1" style={{ fontSize: '0.6rem', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}>
                                                                                        {rate ? (
                                                                                            <span className="text-success" style={{ fontWeight: 600 }}>(₹{rate}/km rate active)</span>
                                                                                        ) : (
                                                                                            <span className="text-muted italic">(Loading local rates...)</span>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                            <div className="odo-row mb-2">
                                                                                <span className="odo-label">Start</span>
                                                                                <div style={{ display: 'flex', alignItems: 'center', position: 'relative', width: '100%' }}>
                                                                                    <input
                                                                                        type="number"
                                                                                        placeholder="0"
                                                                                        value={row.details.odoStart || ''}
                                                                                        onChange={e => updateDetails(row.id, 'odoStart', e.target.value)}
                                                                                        className={errors[row.id]?.odoStart ? 'error' : ''}
                                                                                        style={{ paddingRight: '50px', width: '100%' }}
                                                                                        disabled={isLocked || row.date !== todayStr}
                                                                                    />
                                                                                    <button type="button" className="odo-cam-btn" onClick={() => handleOdoCapture(row.id, 'odoStart')} disabled={isLocked || row.date !== todayStr}>
                                                                                        {row.details.odoStartImg ? <Check size={12} className="text-success" /> : <Camera size={12} />}
                                                                                    </button>
                                                                                </div>
                                                                                <span className="odo-label">End</span>
                                                                                <div style={{ display: 'flex', alignItems: 'center', position: 'relative', width: '100%' }}>
                                                                                    <input
                                                                                        type="number"
                                                                                        placeholder="0"
                                                                                        value={row.details.odoEnd || ''}
                                                                                        onChange={e => updateDetails(row.id, 'odoEnd', e.target.value)}
                                                                                        className={errors[row.id]?.odoEnd ? 'error' : ''}
                                                                                        style={{ paddingRight: '50px', width: '100%' }}
                                                                                        disabled={isLocked || row.date !== todayStr}
                                                                                    />
                                                                                    <button type="button" className="odo-cam-btn" onClick={() => handleOdoCapture(row.id, 'odoEnd')} disabled={isLocked || row.date !== todayStr}>
                                                                                        {row.details.odoEndImg ? <Check size={12} className="text-success" /> : <Camera size={12} />}
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </>
                                                                    )}

                                                                    {(row.details.isPublicTransport || row.details.mode === 'Public Transport') && (
                                                                        <div className="pt-details mt-2" style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                                                <div style={{ flex: 1, minWidth: '150px' }}>
                                                                                    <label className="odo-label" style={{ display: 'block', marginBottom: '6px', fontSize: '0.65rem' }}>Type / Public Mode</label>
                                                                                    <select
                                                                                        className="cat-input"
                                                                                        style={{ width: '100%', fontSize: '0.8rem', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                                                                        value={row.details.remainingRoute || 'Auto'}
                                                                                        onChange={e => updateDetails(row.id, 'remainingRoute', e.target.value)}
                                                                                        disabled={isLocked}
                                                                                    >
                                                                                        <option value="Auto">Auto</option>
                                                                                        <option value="Bus">Bus</option>
                                                                                        <option value="Taxi">Taxi</option>
                                                                                        <option value="Metro">Metro</option>
                                                                                        <option value="Rickshaw">Rickshaw</option>
                                                                                        <option value="Other">Other</option>
                                                                                    </select>
                                                                                </div>
                                                                                <div style={{ width: '160px' }}>
                                                                                    <label className="odo-label" style={{ display: 'block', marginBottom: '6px', fontSize: '0.65rem', color: '#4f46e5', fontWeight: 800 }}>Fare Amount (₹)</label>
                                                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                                                        <input
                                                                                            type="number"
                                                                                            placeholder="0.00"
                                                                                            value={row.amount || ''}
                                                                                            onChange={e => updateRow(row.id, 'amount', e.target.value)}
                                                                                            style={{ width: '100%', fontSize: '0.85rem', fontWeight: 700, padding: '8px', borderRadius: '6px', border: '1px solid #4f46e5', background: '#f5f3ff' }}
                                                                                            disabled={isLocked}
                                                                                        />
                                                                                        {!isLocked && (
                                                                                            <button type="button" className="upload-bill-btn" style={{ padding: '0 10px', height: '36px' }} onClick={() => document.getElementById(`f-pt-t-${row.id}`).click()}>
                                                                                                <Upload size={14} />
                                                                                            </button>
                                                                                        )}
                                                                                        <input type="file" id={`f-pt-t-${row.id}`} hidden onChange={e => handleFileUpload(row.id, e.target.files[0])} accept="image/*,.pdf" />
                                                                                    </div>
                                                                                </div>
                                                                                {(row.bills || []).length > 0 && (
                                                                                    <div style={{ width: '100%', marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                                                        {row.bills.map((b, i) => (
                                                                                            <div key={i} style={{ position: 'relative', display: 'inline-flex', cursor: 'pointer', background: '#e0f2fe', borderRadius: '6px', padding: '4px 8px', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#0369a1', fontWeight: 600 }} onClick={() => previewBill(b)}>
                                                                                                <FileText size={12} /> Bill {i + 1}
                                                                                                {!isLocked && (
                                                                                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0, lineHeight: 1, marginLeft: '2px' }} onClick={e => { e.stopPropagation(); removeBill(row.id, i); }}>
                                                                                                        <X size={10} />
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '8px', fontStyle: 'italic' }}>* Manual entry mode: Odometer calculations are disabled.</p>
                                                                        </div>
                                                                    )}

                                                                    {/* Selfie Capture Section */}
                                                                    <div className="selfie-capture-section">
                                                                        <label className="odo-label" style={{ display: 'block', marginBottom: '8px' }}>Selfie Proofs ({(row.details.selfies || []).length})</label>
                                                                        <div className="selfie-list" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                            {(row.details.selfies || []).map((s, idx) => (
                                                                                <div key={idx} className="selfie-thumb" style={{ position: 'relative', width: '40px', height: '40px', border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                                                                    <img src={s} alt="selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => previewBill(s)} />
                                                                                    <button onClick={() => removeSelfie(row.id, idx)} style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(239, 68, 68, 0.8)', color: 'white', border: 'none', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                                                        <X size={10} />
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                            <button className="add-selfie-btn" onClick={() => handleSelfieCapture(row.id)} style={{ width: '40px', height: '40px', border: '1px dashed #cbd5e1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b' }}>
                                                                                <Camera size={16} />
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                </div>
                                                            </div>
                                                        </td>
                                                    </>
                                                )}

                                                {nature === 'Food' && (
                                                    <>
                                                        <td>
                                                            <input type="date" min={minDate} max={maxDate} className="cat-input" value={row.date} onChange={e => updateRow(row.id, 'date', e.target.value)} />
                                                        </td>
                                                        <td>
                                                            <input type="time" className="cat-input" value={row.details.mealTime || ''} onChange={e => updateDetails(row.id, 'mealTime', e.target.value)} />
                                                        </td>
                                                        <td>
                                                            <div className="row-fields">
                                                                <select className="cat-input" value={row.details.mealCategory || ''} onChange={e => {
                                                                    const val = e.target.value;
                                                                    updateDetails(row.id, 'mealCategory', val);
                                                                    updateDetails(row.id, 'mealType', '');
                                                                    if (val && val !== 'Self Meal') {
                                                                        updateRow(row.id, 'amount', 0);
                                                                        updateDetails(row.id, 'restaurant', '');
                                                                        updateDetails(row.id, 'purpose', '');
                                                                        updateDetails(row.id, 'invoiceNo', '');
                                                                        updateRow(row.id, 'bills', []);
                                                                    }
                                                                }}>
                                                                    <option value="">Meal Category</option>
                                                                    {mealCategories.map(m => <option key={m} value={m}>{m}</option>)}
                                                                </select>
                                                                {row.details.mealCategory && (
                                                                    <>
                                                                        <select className="cat-input mt-1" value={row.details.mealType || ''} onChange={e => updateDetails(row.id, 'mealType', e.target.value)} disabled={row.details.mealCategory !== 'Self Meal'}>
                                                                            <option value="">Meal Type</option>
                                                                            {row.details.mealCategory === 'Self Meal' && mealTypes.map(m => <option key={m} value={m}>{m}</option>)}
                                                                            {row.details.mealCategory === 'Working Meal' && mealTypes.map(m => <option key={m} value={m}>{m}</option>)}
                                                                            {row.details.mealCategory === 'Client Hosted' && mealTypes.map(m => <option key={m} value={m}>{m}</option>)}
                                                                        </select>
                                                                        {row.details.mealCategory === 'Self Meal' && (
                                                                            <div className="input-with-label-mini mt-1">
                                                                                <label>MEAL TIME</label>
                                                                                <input type="time" value={row.details.mealTime || ''} onChange={e => updateDetails(row.id, 'mealTime', e.target.value)} />
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {(row.details.mealCategory === 'Working Meal' || row.details.mealCategory === 'Client Hosted') && (
                                                                    <div className="input-with-label-mini mt-1">
                                                                        <label>PERSONS (PAX)</label>
                                                                        <input type="number" value={row.details.persons || ''} onChange={e => updateDetails(row.id, 'persons', e.target.value)} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="row-fields">
                                                                <div className="input-with-label-mini">
                                                                    <label>RESTAURANT / HOTEL NAME</label>
                                                                    <input type="text" placeholder="Hotel Name" value={row.details.restaurant || ''} onChange={e => updateDetails(row.id, 'restaurant', e.target.value)} disabled={row.details.mealCategory && row.details.mealCategory !== 'Self Meal'} />
                                                                </div>
                                                                <div className="field-group mt-1">
                                                                    <div className="input-with-label-mini" style={{ flex: 2 }}>
                                                                        <label>ADDRESS</label>
                                                                        <input type="text" placeholder="Location Address" value={row.details.purpose || ''} onChange={e => updateDetails(row.id, 'purpose', e.target.value)} disabled={row.details.mealCategory && row.details.mealCategory !== 'Self Meal'} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </>
                                                )}

                                                {nature === 'Accommodation' && (
                                                    <>
                                                        <td>
                                                            <div className="row-fields">
                                                                <select
                                                                    className={`cat-input mb-1 ${isSameDayTrip() ? "opacity-50" : ""}`}
                                                                    value={row.details.accomType || ''}
                                                                    onChange={e => updateDetails(row.id, 'accomType', e.target.value)}
                                                                    disabled={isSameDayTrip()}
                                                                >
                                                                    <option value="">Stay Type</option>
                                                                    {stayTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                                </select>
                                                                <input
                                                                    type="text"
                                                                    className={`cat-input ${isSameDayTrip() ? "opacity-50" : ""}`}
                                                                    placeholder="Hotel Name"
                                                                    value={row.details.hotelName || ''}
                                                                    onChange={e => updateDetails(row.id, 'hotelName', e.target.value)}
                                                                    disabled={isSameDayTrip()}
                                                                />
                                                                <div className="field-group mt-1">
                                                                    {(!row.details.accomType || !['No Stay', 'Self Stay', 'Client Provided'].includes(row.details.accomType)) && (
                                                                        <select
                                                                            value={row.details.roomType || ''}
                                                                            onChange={e => updateDetails(row.id, 'roomType', e.target.value)}
                                                                            disabled={isSameDayTrip()}
                                                                            className={isSameDayTrip() ? "opacity-50" : ""}
                                                                        >
                                                                            <option value="">Room</option>
                                                                            {roomTypes.map(r => <option key={r} value={r}>{r}</option>)}
                                                                        </select>
                                                                    )}
                                                                    <div className="nights-badge ml-auto">{row.details.nights || 0}N</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="row-fields">
                                                                <input type="text" className="cat-input mb-1" placeholder="City" value={row.details.city || ''} onChange={e => updateDetails(row.id, 'city', e.target.value)} />
                                                                <div className="field-group mt-1">
                                                                    <input type="text" className="cat-input" placeholder="Purpose" value={row.details.purpose || ''} onChange={e => updateDetails(row.id, 'purpose', e.target.value)} style={{ flex: 1 }} />
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </>
                                                )}

                                                {nature === 'Incidental' && (
                                                    <>
                                                        <td>
                                                            <div className="row-fields">
                                                                <div className="input-with-label-mini">
                                                                    <label>EXPENSE TYPE</label>
                                                                    <select className="cat-input" value={row.details.incidentalType || ''} onChange={e => updateDetails(row.id, 'incidentalType', e.target.value)}>
                                                                        <option value="">Select Type</option>
                                                                        {incidentalTypes.filter(t => t !== 'Porter Charges' || carryingLuggage).map(t => (
                                                                            <option key={t} value={t}>{t}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="input-with-label-mini mt-1">
                                                                    <label>LOCATION</label>
                                                                    <input type="text" placeholder="Where occurred" value={row.details.location || ''} onChange={e => updateDetails(row.id, 'location', e.target.value)} />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="row-fields">
                                                                {row.details.incidentalType === 'Others' ? (
                                                                    <>
                                                                        <div className="input-with-label-mini">
                                                                            <label>REASON FOR OTHERS</label>
                                                                            <input type="text" placeholder="Mandatory reason" value={row.details.otherReason || ''} onChange={e => updateDetails(row.id, 'otherReason', e.target.value)} />
                                                                        </div>
                                                                        <div className="input-with-label-mini mt-1">
                                                                            <label>DESCRIPTION</label>
                                                                            <textarea className="cat-input" placeholder="Detailed explanation" value={row.details.description || ''} onChange={e => updateDetails(row.id, 'description', e.target.value)} style={{ minHeight: '60px' }} />
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div className="input-with-label-mini">
                                                                        <label>REMARKS / DETAILS</label>
                                                                        <input type="text" placeholder="Additional info" value={row.details.notes || ''} onChange={e => updateDetails(row.id, 'notes', e.target.value)} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </>
                                                )}

                                                {/* COMMON COLUMNS */}
                                                <td className="cost-col">
                                                    <div className="amount-input-box">
                                                        <div className="input-with-label-mini">
                                                            <div className="amount-with-currency">
                                                                <span className="currency-symbol">₹</span>
                                                                <input
                                                                    type="text"
                                                                    className={errors[row.id]?.amount ? 'error' : ''}
                                                                    placeholder={(row.nature === 'Travel' || row.nature === 'Local Travel') && row.details.bookedBy === 'Company Booked' ? "Company Paid" : (row.nature === 'Food' && row.details.mealCategory && row.details.mealCategory !== 'Self Meal' ? "N/A" : "")}
                                                                    value={(() => {
                                                                        const rawVal = (row.details.travelStatus === 'Cancelled' || row.details.travelStatus === 'No-Show') ? (row.details.baseFare || row.amount || '') : (row.amount || '');
                                                                        if (focusedInput?.rowId === row.id) return rawVal;
                                                                        return rawVal ? formatIndianCurrency(rawVal) : '';
                                                                    })()}
                                                                    onFocus={() => setFocusedInput({ rowId: row.id, field: 'amount' })}
                                                                    onBlur={() => setFocusedInput(null)}
                                                                    onChange={e => {
                                                                        const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                        if (val.split('.').length > 2) return;
                                                                        updateRow(row.id, 'amount', val);
                                                                        if (row.details.isAutoCalculated) {
                                                                            updateDetails(row.id, 'isAutoCalculated', false);
                                                                        }
                                                                    }}
                                                                    disabled={row.details.travelStatus === 'Cancelled' || row.details.travelStatus === 'No-Show' || ((row.nature === 'Travel' || row.nature === 'Local Travel') && row.details.bookedBy === 'Company Booked') || (row.nature === 'Food' && row.details.mealCategory && row.details.mealCategory !== 'Self Meal')}
                                                                />
                                                                {row.details.isAutoCalculated && (
                                                                    <div className="text-success" style={{ fontSize: '0.6rem', fontWeight: 700, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                                        <Info size={10} /> Auto-Calculated
                                                                    </div>
                                                                )}
                                                                {errors[row.id]?.amount && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{errors[row.id].amount}</div>}
                                                            </div>
                                                        </div>

                                                        {row.nature === 'Accommodation' && (
                                                            <div className="field-group mt-1">
                                                                <div className="input-with-label-mini">
                                                                    <label>Early Chk-In</label>
                                                                    <input type="number" value={row.details.earlyCheckInCharges || ''} onChange={e => updateDetails(row.id, 'earlyCheckInCharges', e.target.value)} disabled={isSameDayTrip()} />
                                                                </div>
                                                                <div className="input-with-label-mini">
                                                                    <label>Late Chk-Out</label>
                                                                    <input type="number" value={row.details.lateCheckOutCharges || ''} onChange={e => updateDetails(row.id, 'lateCheckOutCharges', e.target.value)} disabled={isSameDayTrip()} />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {row.nature === 'Travel' && (row.details.mode === 'Flight' || row.details.mode === 'Intercity Bus' || row.details.mode === 'Train' || row.details.mode === 'Intercity Cab') && null}

                                                        {row.nature === 'Travel' && row.details.mode === 'Intercity Car' && (
                                                            <div className="car-costs mt-1">
                                                                {row.details.travelStatus !== 'Cancelled' && row.details.travelStatus !== 'No-Show' ? (
                                                                    <>
                                                                        {(['Rental Car (With Driver)', 'Self Drive Rental'].includes(row.details.vehicleType)) && (
                                                                            <div className="input-with-label-mini mt-1">
                                                                                <label>Rental Chg</label>
                                                                                <input type="number" value={row.details.rentalCharge || ''} onChange={e => updateDetails(row.id, 'rentalCharge', e.target.value)} />
                                                                            </div>
                                                                        )}
                                                                        {row.details.vehicleType === 'Company Car' && (
                                                                            <div className="field-group mt-1 px-1">
                                                                                <label className="checkbox-item mini">
                                                                                    <input type="checkbox" checked={row.details.driverProvided || false} onChange={e => updateDetails(row.id, 'driverProvided', e.target.checked)} />
                                                                                    <span>Driver?</span>
                                                                                </label>
                                                                                {row.details.driverProvided && (
                                                                                    <div className="input-with-label-mini ml-auto">
                                                                                        <label>Allow.</label>
                                                                                        <input type="number" value={row.details.driverAllowance || ''} onChange={e => updateDetails(row.id, 'driverAllowance', e.target.value)} />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        {row.details.vehicleType === 'Ride Hailing' && (
                                                                            <div className="field-group mt-1 px-1">
                                                                                <label className="checkbox-item mini">
                                                                                    <input type="checkbox" checked={row.details.includeToll || false} onChange={e => updateDetails(row.id, 'includeToll', e.target.checked)} />
                                                                                    <span>Incl. Toll?</span>
                                                                                </label>
                                                                            </div>
                                                                        )}
                                                                        {row.details.nightTravel === 'Yes' && (
                                                                            <div className="input-with-label-mini mt-1">
                                                                                <label>Night Halt</label>
                                                                                <input
                                                                                    type="number"
                                                                                    value={row.details.nightHaltCharges || ''}
                                                                                    onChange={e => updateDetails(row.id, 'nightHaltCharges', e.target.value)}
                                                                                    disabled={!row.details.haltEligible}
                                                                                    className={!row.details.haltEligible ? 'btn-disabled' : ''}
                                                                                    title={!row.details.haltEligible ? "Requires Night Travel = Yes and Duration > 8h" : ""}
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                ) : <div className="cat-notice text-danger" style={{ fontSize: '0.65rem', fontWeight: '700' }}>Cancelled / No-Show Info Hidden</div>}
                                                            </div>
                                                        )}

                                                        {row.nature === 'Local Travel' && (
                                                            <div className="local-costs mt-1">
                                                                {row.details.mode === 'Walk' ? (
                                                                    <div className="no-cost-badge">No Cost (Walk)</div>
                                                                ) : (
                                                                    row.details.travelStatus !== 'Cancelled' && row.details.travelStatus !== 'No-Show' ? (
                                                                        <>
                                                                            {row.details.subType === 'Company Car' && (
                                                                                <div className="field-group mt-1 px-1">
                                                                                    <label className="checkbox-item mini">
                                                                                        <input type="checkbox" checked={row.details.driverProvided || false} onChange={e => updateDetails(row.id, 'driverProvided', e.target.checked)} />
                                                                                        <span>Driver?</span>
                                                                                    </label>
                                                                                    {row.details.driverProvided && (
                                                                                        <div className="input-with-label-mini ml-auto">
                                                                                            <label>Allow.</label>
                                                                                            <input type="number" value={row.details.driverAllowance || ''} onChange={e => updateDetails(row.id, 'driverAllowance', e.target.value)} />
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            {row.details.mode === 'Public Transport' && (
                                                                                <div className="input-with-label-mini mt-1">
                                                                                    <label>Topup?</label>
                                                                                    <input type="number" value={row.details.smartCardRecharge || ''} onChange={e => updateDetails(row.id, 'smartCardRecharge', e.target.value)} />
                                                                                </div>
                                                                            )}
                                                                            {row.details.subType === 'Ride Hailing' && (
                                                                                <div className="field-group mt-1 px-1">
                                                                                    <label className="checkbox-item mini">
                                                                                        <input type="checkbox" checked={row.details.includeToll || false} onChange={e => updateDetails(row.id, 'includeToll', e.target.checked)} />
                                                                                        <span>Incl. Toll?</span>
                                                                                    </label>
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    ) : <div className="cat-notice text-danger" style={{ fontSize: '0.65rem', fontWeight: '700' }}>Cancelled / No-Show Info Hidden</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="bills-collection-zone custom-upload">
                                                        {row.nature === 'Travel' && ['Flight', 'Train', 'Intercity Bus', 'Intercity Cab'].includes(row.details.mode) && row.details.bookedBy === 'Company Booked' && (
                                                            <div className="company-paid-notice">
                                                                <CheckCircle2 size={12} className="text-secondary" />
                                                                <span>Booked & paid by company. No reimbursement.</span>
                                                            </div>
                                                        )}
                                                        {(row.bills || []).map((b, idx) => (
                                                            <div key={idx} className="bill-thumbnail-mini">
                                                                <div className="thumb-preview" onClick={() => previewBill(b)}>
                                                                    <FileText size={14} />
                                                                </div>
                                                                {!isLocked && (
                                                                    <button className="remove-bill-dot" onClick={() => removeBill(row.id, idx)}>
                                                                        <X size={10} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {/* JOB REPORT ACTIVITY PROOFS */}
                                                        {(row.details.jobReportFiles || []).map((f, idx) => (
                                                            <div key={`jr-${idx}`} className="bill-thumbnail-mini" style={{ border: '2px solid #3b82f6', borderRadius: '4px' }}>
                                                                <div className="thumb-preview jr-attachment-preview" onClick={() => previewBill(f.data)} style={{ position: 'relative' }}>
                                                                    <FileText size={14} style={{ color: '#3b82f6' }} />
                                                                    <span style={{ position: 'absolute', top: '-12px', left: '-5px', fontSize: '0.6rem', color: '#1d4ed8', fontWeight: 800, background: '#dbeafe', padding: '0 3px', border: '1px solid #3b82f6', borderRadius: '2px', transform: 'scale(0.85)' }}>JR</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <div className="upload-controls-mini">
                                                            {!isLocked && !(row.nature === 'Food' && row.details.mealCategory && row.details.mealCategory !== 'Self Meal') && (
                                                                <button className="add-bill-btn-mini" onClick={() => document.getElementById(`f-${row.id}`).click()} title="Add Bill">
                                                                    <Plus size={14} />
                                                                    <input type="file" id={`f-${row.id}`} hidden onChange={e => handleFileUpload(row.id, e.target.files[0])} accept="image/*,.pdf" />
                                                                </button>
                                                            )}
                                                            {(row.bills || []).length === 0 && (
                                                                row.nature === 'Travel' && (row.details.mode === 'Intercity Bus' || row.details.mode === 'Intercity Cab' || row.details.mode === 'Flight') ? (
                                                                    <div className="travel-upload-hint">
                                                                        {['Flight', 'Intercity Bus'].includes(row.details.mode) && <span className="upload-req-label">Upload Ticket</span>}
                                                                        <span className="upload-req-label">Upload Invoice</span>
                                                                    </div>
                                                                ) : <span className="no-bill-hint">No Bills</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="actions-col">
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                                                        {!isLocked && (
                                                            <button className="row-del-btn" onClick={() => deleteRow(row.id)} title="Delete row">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    ))
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderReviewSummary = () => {
        const total = rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const savedCount = rows.filter(r => r.isSaved).length;
        const unsavedCount = rows.length - savedCount;

        return (
            <div className="review-summary-container">
                <div className="review-header-box">
                    <div className="review-title">
                        <CheckCircle2 size={24} className="text-primary" />
                        <div>
                            <h4>Master Journey Ledger (Final Audit)</h4>
                            <p>Verify your complete trip story across all expense heads</p>
                        </div>
                    </div>
                    <div className="review-filter-actions">
                        <div className="filter-control">
                            <label>Filter Nature:</label>
                            <select
                                className="rev-filter-select"
                                value={reviewFilter}
                                onChange={(e) => setReviewFilter(e.target.value)}
                            >
                                <option value="All">All Categories</option>
                                {NATURE_OPTIONS.filter(o => o.value !== 'Review').map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="review-master-table-wrapper mt-4">
                    <table className="review-master-table">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Date</th>
                                <th>Activity / Route Details</th>
                                <th className="text-right">Amount</th>
                                <th className="text-center">Receipt</th>
                                <th className="text-center">Status</th>
                                {!isLocked && <th className="text-center">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={isLocked ? 6 : 7} className="empty-review">No entries found for review</td>
                                </tr>
                            ) : (
                                (() => {
                                    const filtered = reviewFilter === 'All' ? rows : rows.filter(r => r.nature === reviewFilter);
                                    if (filtered.length === 0) {
                                        return <tr><td colSpan={isLocked ? 6 : 7} className="empty-review">No entries found for {reviewFilter}</td></tr>;
                                    }
                                    return filtered.map(r => {
                                        const categoryOpt = NATURE_OPTIONS.find(o => o.value === r.nature);
                                        const availableStatuses = r.nature === 'Travel' ? TRAVEL_STATUSES : (r.nature === 'Local Travel' ? LOCAL_TRAVEL_STATUSES : ['Completed']);

                                        return (
                                            <React.Fragment key={r.id}>
                                                <tr className={r.details?.travelStatus && r.details?.travelStatus !== 'Completed' ? `status-row-${r.details.travelStatus.toLowerCase().replace(' ', '-')}` : ''}>
                                                    <td className="rev-cat-cell">
                                                        <div className="rev-cat-icon-label">
                                                            {categoryOpt?.icon || <IndianRupee size={14} />}
                                                            <span>{r.nature || 'Unknown'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="mono" style={{ fontSize: '0.75rem' }}>{r.date}</td>
                                                    <td className="rev-desc-cell">
                                                        <div className="rev-main-info">
                                                            {r.nature === 'Travel' && (
                                                                <>
                                                                    <strong>{r.details?.mode || 'Travel'}</strong>
                                                                    <span>{r.details?.origin || ''} → {r.details?.destination || ''}</span>
                                                                </>
                                                            )}
                                                            {r.nature === 'Local Travel' && (
                                                                <>
                                                                    <strong>{r.details?.mode || 'Local'} - {r.details?.subType || 'No Type'}</strong>
                                                                    <span>{(r.details?.origin || r.details?.fromLocation) || 'Starting point'} → {(r.details?.destination || r.details?.toLocation) || 'Ending point'}</span>
                                                                </>
                                                            )}
                                                            {r.nature === 'Food' && (
                                                                <>
                                                                    <strong>{r.details?.mealType || 'Meal'}</strong>
                                                                    <span>{r.details?.restaurant || 'Refreshments'}</span>
                                                                </>
                                                            )}
                                                            {r.nature === 'Accommodation' && (
                                                                <>
                                                                    <strong>{r.details?.hotelName || 'Stay'}</strong>
                                                                    <span>{r.details?.city || 'City not specified'} ({r.details?.nights || 0} Nights)</span>
                                                                </>
                                                            )}
                                                            {r.nature === 'Incidental' && (
                                                                <>
                                                                    <strong>{r.details?.incidentalType || 'Misc'}</strong>
                                                                    <span>{r.details?.notes || 'No description'}</span>
                                                                </>
                                                            )}
                                                            {(!r.nature || !['Travel', 'Local Travel', 'Food', 'Accommodation', 'Incidental'].includes(r.nature)) && (
                                                                <span>{r.remarks || 'No details'}</span>
                                                            )}
                                                        </div>
                                                        {r.isSaved && r.details?.travelStatus && r.details?.travelStatus !== 'Completed' && (
                                                            <div className={`rev-status-tag ${r.details.travelStatus.toLowerCase().replace(' ', '-')}`}>
                                                                {r.details.travelStatus}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="rev-amount-cell text-right">
                                                        <div className="amount-stack">
                                                            <span className="main-amt">₹{formatIndianCurrency(parseFloat(r.amount || 0))}</span>
                                                            {r.details.travelStatus === 'Cancelled' && (
                                                                <>
                                                                    <span className="amt-note">CANCELLATION ONLY</span>
                                                                    {r.details.baseFare && <span className="amt-note strikethrough" style={{ opacity: 0.6, fontSize: '0.65rem' }}>Original: ₹{formatIndianCurrency(parseFloat(r.details.baseFare))}</span>}
                                                                </>
                                                            )}
                                                            {r.details.travelStatus === 'No-Show' && (
                                                                <>
                                                                    <span className="amt-note">NO-SHOW ONLY</span>
                                                                    {r.details.baseFare && <span className="amt-note strikethrough" style={{ opacity: 0.6, fontSize: '0.65rem' }}>Original: ₹{formatIndianCurrency(parseFloat(r.details.baseFare))}</span>}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="text-center">
                                                        {(r.bills && r.bills.length > 0) || (r.details?.jobReportFiles && r.details.jobReportFiles.length > 0) ? (
                                                            <div className="rev-bills-list">
                                                                {(r.bills || []).map((b, bidx) => (
                                                                    <button key={bidx} className="rev-bill-preview" title={`View Bill ${bidx + 1}`} onClick={() => previewBill(b)}>
                                                                        <FileText size={14} />
                                                                    </button>
                                                                ))}
                                                                {(r.details?.jobReportFiles || []).map((f, fidx) => (
                                                                    <button key={`jr-${fidx}`} className="rev-bill-preview jr-attachment-badge" title={`Job Report Attachment ${fidx + 1}`} onClick={() => previewBill(f.data)} style={{ position: 'relative', border: '2px solid #3b82f6' }}>
                                                                        <FileText size={14} style={{ color: '#3b82f6' }} />
                                                                        <span style={{ position: 'absolute', top: '-8px', right: '-8px', fontSize: '0.55rem', color: '#1d4ed8', fontWeight: 900, background: '#dbeafe', padding: '0 2px', border: '1px solid #3b82f6', borderRadius: '2px', lineHeight: 1 }}>JR</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        ) : <span className="no-bill-dash">—</span>}
                                                    </td>
                                                    <td className="text-center">
                                                        {(r.isSaved || r.details?.travelStatus !== 'Completed') ? (
                                                            <div className="status-cell-wrapper">
                                                                <select
                                                                    className={`rev-status-select ${r.details?.travelStatus && r.details?.travelStatus !== 'Completed' ? 'status-' + r.details.travelStatus.toLowerCase().replace(' ', '-') : ''}`}
                                                                    value={r.details?.travelStatus || 'Completed'}
                                                                    onChange={e => handleReviewStatusChange(r.id, e.target.value)}
                                                                    disabled={(r.nature === 'Travel' || r.nature === 'Local Travel') && r.details?.bookedBy === 'Company Booked'}
                                                                    title={(r.nature === 'Travel' || r.nature === 'Local Travel') && r.details?.bookedBy === 'Company Booked' ? "This ticket is booked and paid by the company. Please contact the Travel Desk for any changes." : ""}
                                                                >
                                                                    {availableStatuses.map(s => {
                                                                        const isOwnVehicle = r.details?.subType === 'Own Car' || r.details?.subType === 'Own Bike';
                                                                        const isDisabled = (isOwnVehicle && (s === 'Cancelled' || s === 'No-Show')) || ((r.nature === 'Travel' || r.nature === 'Local Travel') && r.details?.bookedBy === 'Company Booked' && s !== 'Completed');
                                                                        return <option key={s} value={s} disabled={isDisabled}>{s}</option>;
                                                                    })}
                                                                </select>
                                                                {(r.nature === 'Travel' || r.nature === 'Local Travel') && r.details?.bookedBy === 'Company Booked' && (
                                                                    <div className="company-booked-msg" style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '2px', fontStyle: 'italic' }}>
                                                                        Contact Travel Desk for changes
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="rev-stat-dot pending" title="Draft - Commit Registry to enable status changes">
                                                                <Clock size={10} />
                                                            </div>
                                                        )}
                                                    </td>
                                                    {!isLocked && (
                                                        <td className="text-center">
                                                            <button className="row-del-btn" onClick={() => deleteRow(r.id)} title="Remove this record">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                                {r.details.travelStatus && r.details.travelStatus !== 'Completed' && (
                                                    <tr className="rev-status-extension">
                                                        <td colSpan={isLocked ? 7 : 8}>
                                                            <div className="rev-extension-panel">
                                                                {r.details.travelStatus === 'Cancelled' && (
                                                                    <div className="panel-grid-3">
                                                                        <div className="p-field">
                                                                            <label>Cancel Date</label>
                                                                            <input type="date" min={minDate} max={maxDate} value={r.details.cancellationDate || ''} onChange={e => updateDetails(r.id, 'cancellationDate', e.target.value)} />
                                                                        </div>
                                                                        <div className="p-field">
                                                                            <label>Charges</label>
                                                                            <input type="number"
                                                                                value={r.details.cancellationCharges || ''}
                                                                                onChange={e => {
                                                                                    updateDetails(r.id, 'cancellationCharges', e.target.value);
                                                                                    updateRow(r.id, 'amount', e.target.value); // Sync claim amount
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <div className="p-field">
                                                                            <label>Refund</label>
                                                                            <input type="number" value={r.details.refundAmount || ''} onChange={e => updateDetails(r.id, 'refundAmount', e.target.value)} />
                                                                        </div>
                                                                        <div className="p-field full">
                                                                            <label>Cancel Reason (Mandatory)</label>
                                                                            <textarea value={r.details.cancellationReason || ''} onChange={e => updateDetails(r.id, 'cancellationReason', e.target.value)} placeholder="Why was this cancelled?" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {r.details.travelStatus === 'Rescheduled' && (
                                                                    <div className="panel-grid-3">
                                                                        <div className="p-field">
                                                                            <label>New Travel Date</label>
                                                                            <input type="date" min={minDate} max={maxDate} value={r.details.newTravelDate || ''} onChange={e => updateDetails(r.id, 'newTravelDate', e.target.value)} />
                                                                        </div>
                                                                        <div className="p-field">
                                                                            <label>Reschedule Fee</label>
                                                                            <input type="number" value={r.details.rescheduleCharges || ''} onChange={e => updateDetails(r.id, 'rescheduleCharges', e.target.value)} />
                                                                        </div>
                                                                        <div className="p-field">
                                                                            <label>New Ref/PNR</label>
                                                                            <input type="text" value={r.details.newBookingRef || ''} onChange={e => updateDetails(r.id, 'newBookingRef', e.target.value)} />
                                                                        </div>
                                                                        <div className="p-field full">
                                                                            <label>Reason</label>
                                                                            <textarea value={r.details.rescheduleReason || ''} onChange={e => updateDetails(r.id, 'rescheduleReason', e.target.value)} placeholder="Reason for rescheduling..." />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {r.details.travelStatus === 'No-Show' && (
                                                                    <div className="panel-grid-2">
                                                                        <div className="p-field">
                                                                            <label>No-Show Charges</label>
                                                                            <input type="number"
                                                                                value={r.details.noShowCharges || ''}
                                                                                onChange={e => {
                                                                                    updateDetails(r.id, 'noShowCharges', e.target.value);
                                                                                    updateRow(r.id, 'amount', e.target.value); // Sync claim amount
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <div className="p-field">
                                                                            <label>Reason</label>
                                                                            <textarea value={r.details.noShowReason || ''} onChange={e => updateDetails(r.id, 'noShowReason', e.target.value)} placeholder="Reason for no-show..." />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div className="rev-audit-trail mt-2">
                                                                    <div className="trail-label"><RotateCcw size={12} /> Status Audit History</div>
                                                                    <ul className="trail-list">
                                                                        {r.details.auditTrail?.map((log, i) => <li key={i}>{log}</li>)}
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    });
                                })()
                            )}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot>
                                <tr>
                                    <td colSpan="3" className="text-right">
                                        <strong>{reviewFilter === 'All' ? 'Grand Total Ledger' : `${reviewFilter} Sub-Total`}</strong>
                                    </td>
                                    <td className="text-right">
                                        <strong>₹{formatIndianCurrency((reviewFilter === 'All'
                                            ? rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0)
                                            : rows.filter(r => r.nature === reviewFilter).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0)
                                        ))}</strong>
                                    </td>
                                    <td colSpan="3"></td>
                                </tr>
                                {reviewFilter !== 'All' && (
                                    <tr className="grand-total-static">
                                        <td colSpan="3" className="text-right"><span className="text-muted">Grand Total (All)</span></td>
                                        <td className="text-right">₹{formatIndianCurrency(rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0))}</td>
                                        <td colSpan="3"></td>
                                    </tr>
                                )}
                            </tfoot>
                        )}
                    </table>
                </div>

                {unsavedCount > 0 && (
                    <div className="review-warning-banner mt-3">
                        <AlertCircle size={16} />
                        <span>You have <strong>{unsavedCount}</strong> uncommitted items. Please click "Commit Registry" before final submission.</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={`smart-grid-container categorized ${isLocked ? 'registry-locked' : ''}`}>
            <div className="grid-master-header">
                <div className="m-left">
                    <div className="registry-title-row">
                        <h3>{isLocked ? 'Finalized Journey Ledger' : 'Dynamic Journey Ledger'}</h3>
                        {!isLocked && (
                            <div className="luggage-toggle-zone">
                                <label className="luggage-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={carryingLuggage}
                                        onChange={(e) => {
                                            setCarryingLuggage(e.target.checked);
                                            if (!e.target.checked) setLuggageWeight('');
                                        }}
                                    />
                                    <span>Carrying Luggage?</span>
                                </label>
                                {carryingLuggage && (
                                    <div className="weight-input-mini animate-pop-in">
                                        <label>Weight (Kg)</label>
                                        <input
                                            type="number"
                                            value={luggageWeight}
                                            onChange={(e) => setLuggageWeight(e.target.value)}
                                            placeholder="00"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    {!isLocalOnly && (
                        <>
                            <div className="category-tabs-selector mt-2">
                                {NATURE_OPTIONS.filter(opt => enabledNatures.includes(opt.value)).map(opt => (
                                    <button
                                        key={opt.value}
                                        className={`cat-tab-btn ${activeCategory === opt.value ? 'active' : ''}`}
                                        onClick={() => setActiveCategory(opt.value)}
                                    >
                                        {opt.icon}
                                        <span>{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="active-nature-display">
                                <span className="nature-label">Nature of Transaction:</span>
                                <span className="nature-value">{activeCategory}</span>
                            </div>
                        </>
                    )}
                </div>
                <div className="m-right">
                    <div className="master-stats">
                        <div className="m-stat">
                            <label>Items</label>
                            <strong>{displayRows.length}</strong>
                        </div>
                        <div className="m-stat">
                            <label>Ledger Total</label>
                            <strong>₹{formatIndianCurrency(displayRows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0))}</strong>
                        </div>
                        <div className="m-stat primary">
                            <label>Projected Wallet</label>
                            <strong style={{ color: (totalAdvance - displayRows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0)) >= 0 ? '#10b981' : '#ef4444' }}>
                                ₹{formatIndianCurrency((totalAdvance - displayRows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0)))}
                            </strong>
                        </div>
                    </div>
                </div>
            </div>

            <div className="categorized-sections-grid single-mode">
                {activeCategory === 'Travel' && CategoryTable({ nature: "Travel", title: "Long Distance Travel", icon: <Plane size={18} /> })}
                {activeCategory === 'Local Travel' && CategoryTable({ nature: "Local Travel", title: "Local Conveyance", icon: <Car size={18} /> })}
                {activeCategory === 'Food' && CategoryTable({ nature: "Food", title: "Food & Refreshments", icon: <Coffee size={18} /> })}
                {activeCategory === 'Accommodation' && CategoryTable({ nature: "Accommodation", title: "Stay & Lodging", icon: <Hotel size={18} /> })}
                {activeCategory === 'Incidental' && CategoryTable({ nature: "Incidental", title: "Incidental Expenses", icon: <Receipt size={18} /> })}
                {activeCategory === 'Review' && renderReviewSummary()}
            </div>

            {/* Hidden Input for Odometer Camera */}
            <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                hidden
                onChange={handleOdoFileChange}
            />

            {confirmDialog.show && (
                <div className="custom-confirm-overlay">
                    <div className="custom-confirm-modal">
                        <div className={`modal-status-bar ${confirmDialog.type}`}></div>
                        <div className="modal-content-p">
                            <div className="modal-icon-h">
                                {confirmDialog.type === 'danger' ? <XCircle size={32} color="#ef4444" /> :
                                    confirmDialog.type === 'warning' ? <AlertTriangle size={32} color="#f59e0b" /> :
                                        <Info size={32} color="#3b82f6" />}
                            </div>
                            <h3>{confirmDialog.title}</h3>
                            <p>{confirmDialog.message}</p>
                            <div className="modal-actions-p">
                                <button className="modal-btn cancel" onClick={() => setConfirmDialog({ ...confirmDialog, show: false })}>Cancel</button>
                                <button className={`modal-btn confirm ${confirmDialog.type}`} onClick={confirmDialog.onConfirm}>Confirm Action</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="grid-master-footer">
                <div className="legend">
                    <div className="l-item"><div className="grid-dot t"></div> Travel</div>
                    <div className="l-item"><div className="grid-dot l"></div> Local</div>
                    <div className="l-item"><div className="grid-dot f"></div> Food</div>
                    <div className="l-item"><div className="grid-dot a"></div> Stay</div>
                </div>
                {!isLocked && (
                    <div className="review-action-footer">
                        {/* Always show Commit/Save button on every tab to allow incremental saving */}
                        <button
                            className={`master-save-btn ${(isSaving || (rows.length > 0 && rows.every(r => r.isSaved))) ? 'loading btn-disabled' : ''}`}
                            onClick={saveRegistry}
                            disabled={isSaving || isSubmitting || (rows.length > 0 && rows.every(r => r.isSaved))}
                        >
                            {isSaving ? <Clock className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                            <span>{isSaving ? 'Saving Progress...' : (rows.length > 0 && rows.every(r => r.isSaved) ? 'Saved' : 'Commit Registry')}</span>
                        </button>

                        {activeCategory === 'Review' ? (
                            <div className="review-submit-group">
                                <button
                                    className={`master-claim-btn ${isSubmitting ? 'loading' : ''} ${(!rows.every(r => r.isSaved) || !isTripApproved) ? 'btn-disabled' : ''}`}
                                    onClick={handleClaim}
                                    disabled={isSaving || isSubmitting || !rows.every(r => r.isSaved) || rows.length === 0 || !isTripApproved}
                                    title={!isTripApproved ? "Wait for Trip Approval to submit claim" : (!rows.every(r => r.isSaved) ? "Please Commit Registry first" : "")}
                                >
                                    {isSubmitting ? <Clock className="animate-spin" size={18} /> : <IndianRupee size={18} />}
                                    <span>{isSubmitting ? 'Finalizing...' : 'Submit Full Claim'}</span>
                                </button>
                                {!isTripApproved && (
                                    <div className="status-lock-hint">
                                        <AlertTriangle size={14} />
                                        <span>Submission locked until Trip is Approved</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                className="master-claim-btn secondary"
                                onClick={() => setActiveCategory('Review')}
                            >
                                <Navigation size={18} />
                                <span>Go to Final Review</span>
                            </button>
                        )}
                    </div>
                )}
                {isLocked && (
                    <div className="lock-status-notice">
                        <CheckCircle2 size={16} />
                        <span>Claim Reference: {tripId} Submitted for Review</span>
                    </div>
                )}
            </div>

            {/* Deviation Reason Modal */}
            {deviationModal.show && (
                <div className="custom-confirm-overlay">
                    <div className="custom-confirm-modal" style={{ maxWidth: '400px' }}>
                        <div className="modal-status-bar warning"></div>
                        <div className="modal-content-p">
                            <h3>{deviationModal.isNotVisited ? 'Mark as Not Visited' : 'Report Travel Deviation'}</h3>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                                {deviationModal.isNotVisited
                                    ? 'Please provide a reason for not visiting this planned location. This entry will be marked as cancelled and the amount will be set to zero.'
                                    : 'Please enter the reason for deviating from the planned route. This requires approval.'}
                            </p>
                            <textarea
                                className="cat-input mt-3"
                                style={{ width: '100%', height: '80px', padding: '10px' }}
                                placeholder={deviationModal.isNotVisited ? "Enter cancellation reason (e.g., Client unavailable, Appointment postponed)..." : "Enter deviation reason (e.g., Client changed meeting location, Emergency detour etc.)"}
                                value={deviationModal.reason}
                                onChange={e => setDeviationModal(p => ({ ...p, reason: e.target.value }))}
                            />
                            {!deviationModal.isNotVisited && (
                                <>
                                    <input
                                        type="text"
                                        className="cat-input mt-2"
                                        style={{ width: '100%', padding: '10px' }}
                                        placeholder="Visited Person / Office"
                                        value={deviationModal.target}
                                        onChange={e => setDeviationModal(p => ({ ...p, target: e.target.value }))}
                                    />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <input
                                            type="text"
                                            className="cat-input mt-2"
                                            style={{ width: '100%', padding: '10px' }}
                                            placeholder="Actual From (Location)"
                                            value={deviationModal.actualFrom}
                                            onChange={e => setDeviationModal(p => ({ ...p, actualFrom: e.target.value }))}
                                        />
                                        <input
                                            type="text"
                                            className="cat-input mt-2"
                                            style={{ width: '100%', padding: '10px' }}
                                            placeholder="Actual To (Location)"
                                            value={deviationModal.actualTo}
                                            onChange={e => setDeviationModal(p => ({ ...p, actualTo: e.target.value }))}
                                        />
                                    </div>
                                </>
                            )}
                            <div className="modal-actions-p mt-3">
                                <button className="modal-btn cancel" onClick={() => setDeviationModal({ show: false, rowId: null, reason: '', target: '', actualFrom: '', actualTo: '' })}>Cancel</button>

                                {!deviationModal.isNotVisited && (
                                    <button
                                        className="modal-btn confirm warning"
                                        disabled={!deviationModal.reason.trim()}
                                        onClick={() => {
                                            setRows(prev => prev.map(r => {
                                                if (r.id === deviationModal.rowId) {
                                                    return {
                                                        ...r,
                                                        is_deviated: true,
                                                        deviation_reason: deviationModal.reason,
                                                        details: {
                                                            ...r.details,
                                                            is_deviated: true,
                                                            // Preserve original as planned if not already done
                                                            plannedOrigin: r.details.plannedOrigin || r.details.origin,
                                                            plannedDestination: r.details.plannedDestination || r.details.destination,
                                                            // Update display locations to actuals
                                                            origin: deviationModal.actualFrom,
                                                            destination: deviationModal.actualTo,
                                                            // Store explicit actuals for audit
                                                            actualFrom: deviationModal.actualFrom,
                                                            actualTo: deviationModal.actualTo,
                                                            visitedPerson: deviationModal.target
                                                        },
                                                        isSaved: false
                                                    };
                                                }
                                                return r;
                                            }));
                                            setDeviationModal({ show: false, rowId: null, reason: '', target: '', actualFrom: '', actualTo: '' });
                                            showToast("Deviation recorded. Locations updated.", "success");
                                        }}
                                    >
                                        Confirm Deviation
                                    </button>
                                )}

                                {deviationModal.isNotVisited && (
                                    <button
                                        className="modal-btn confirm danger"
                                        disabled={!deviationModal.reason.trim()}
                                        onClick={() => {
                                            setRows(prev => prev.map(r => {
                                                if (r.id === deviationModal.rowId) {
                                                    return {
                                                        ...r,
                                                        is_deviated: true,
                                                        deviation_reason: `[Cancelled/Skip] ${deviationModal.reason}`,
                                                        amount: '0',
                                                        details: {
                                                            ...r.details,
                                                            is_deviated: true,
                                                            travelStatus: 'Cancelled',
                                                            cancellationReason: deviationModal.reason,
                                                            cancellationDate: r.date,
                                                            isNotVisited: true
                                                        },
                                                        isSaved: false
                                                    };
                                                }
                                                return r;
                                            }));
                                            setDeviationModal({ show: false, rowId: null, reason: '', target: '' });
                                            showToast("Visit marked as Not Visited.", "warning");
                                        }}
                                    >
                                        Confirm Not Visited
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Upload Modal */}
            {bulkModal.visible && (
                <div className="modal-overlay">
                    <div className="modal-body bulk-upload-modal" style={{ maxWidth: '700px' }}>
                        <button className="modal-close" onClick={() => setBulkModal({ visible: false, file: null, uploading: false, activeTab: 'upload' })}>
                            <X size={24} />
                        </button>
                        <div className="modal-header">
                            {bulkModal.hideUpload ? <AlertTriangle className="modal-icon text-warning" /> : <Upload className="modal-icon text-primary" />}
                            <h2>{bulkModal.hideUpload ? 'Local Rejection Manager' : 'Bulk Activity Center'}</h2>
                            <p className="text-secondary">{bulkModal.hideUpload ? 'Review and resolve rejected local travel activities' : `Manage your mass local activities for ${tripId}`}</p>
                        </div>

                        {!bulkModal.hideUpload && (
                            <div className="bulk-modal-tabs">
                                <button className={`bulk-tab-btn ${bulkModal.activeTab === 'upload' ? 'active' : ''}`} onClick={() => setBulkModal(p => ({ ...p, activeTab: 'upload' }))}>
                                    <Plus size={16} /> New Upload
                                </button>
                                <button className={`bulk-tab-btn ${bulkModal.activeTab === 'history' ? 'active' : ''}`} onClick={() => setBulkModal(p => ({ ...p, activeTab: 'history' }))}>
                                    <Clock size={16} /> History ({bulkHistory.length})
                                </button>
                            </div>
                        )}

                        <div className="modal-content mt-4">
                            {bulkModal.activeTab === 'upload' ? (
                                <>
                                    <div className="upload-steps">
                                        <div className="step-card">
                                            <div className="step-number">1</div>
                                            <div className="step-details">
                                                <h4>Download Template</h4>
                                                <p>Get the standard Excel format for daily entries.</p>
                                                <button className="btn-outline-primary mt-2" onClick={handleDownloadTemplate} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '4px', border: '1px solid #3b82f6', color: '#3b82f6', background: 'transparent', cursor: 'pointer' }}>
                                                    <FileText size={18} /> Download Excel
                                                </button>
                                            </div>
                                        </div>
                                        <div className="step-card mt-3">
                                            <div className="step-number">2</div>
                                            <div className="step-details">
                                                <h4>Upload Filled File</h4>
                                                <p>Select your completed template for this trip.</p>
                                                <div className="file-upload-wrapper mt-2">
                                                    <input
                                                        type="file"
                                                        accept=".xlsx, .xls"
                                                        id="bulkFile"
                                                        onChange={(e) => setBulkModal(prev => ({ ...prev, file: e.target.files[0] }))}
                                                        style={{ display: 'none' }}
                                                    />
                                                    <label htmlFor="bulkFile" className={`file-upload-label ${bulkModal.file ? 'has-file' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '20px', border: '2px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer', background: bulkModal.file ? '#f0fdf4' : '#f8fafc', color: bulkModal.file ? '#166534' : '#64748b' }}>
                                                        <Upload size={24} />
                                                        <span>{bulkModal.file ? bulkModal.file.name : 'Click to Browse File'}</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="modal-actions mt-4" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                        <button className="btn-secondary" onClick={() => setBulkModal({ visible: false, file: null, uploading: false, activeTab: 'upload' })} style={{ flex: 1, padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}>
                                            Cancel
                                        </button>
                                        <button
                                            className={`btn-primary ${(!bulkModal.file || bulkModal.uploading) ? 'btn-disabled' : ''}`}
                                            onClick={handleBulkUpload}
                                            disabled={!bulkModal.file || bulkModal.uploading}
                                            style={{ flex: 1, padding: '10px', background: 'var(--magenta)', color: 'white', border: 'none', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: (!bulkModal.file || bulkModal.uploading) ? 'not-allowed' : 'pointer', opacity: (!bulkModal.file || bulkModal.uploading) ? 0.6 : 1 }}
                                        >
                                            {bulkModal.uploading ? (
                                                <><Clock className="animate-spin" size={18} /> Uploading...</>
                                            ) : (
                                                <>Submit for Approval</>
                                            )}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="bulk-history-view">
                                    {(() => {
                                        const displayHistory = bulkModal.hideUpload
                                            ? bulkHistory.filter(batch =>
                                                batch.status !== 'Resolved' &&
                                                (batch.data_json || []).some(r => r._status === 'Rejected')
                                            )
                                            : bulkHistory;

                                        if (displayHistory.length === 0) {
                                            return (
                                                <div className="empty-history text-center py-8">
                                                    {bulkModal.hideUpload ? <CheckCircle2 size={40} className="text-success mx-auto mb-2" /> : <Clock size={40} className="text-muted mx-auto mb-2" />}
                                                    <p className="text-muted">{bulkModal.hideUpload ? 'No active rejections found. All items are approved or pending.' : 'No upload history found for this trip.'}</p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {displayHistory.map((batch, batchIdx) => {
                                                    // Null-safe guards to prevent crashes from missing API fields
                                                    const batchStatus = batch.status || 'Unknown';
                                                    const statusSlug = batchStatus.toLowerCase().replace(/ /g, '-');
                                                    const rejectedCount = Array.isArray(batch.data_json)
                                                        ? batch.data_json.filter(r => r && r._status === 'Rejected').length
                                                        : 0;
                                                    const createdAtDisplay = batch.created_at
                                                        ? (() => { try { return new Date(batch.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return 'Unknown date'; } })()
                                                        : 'Unknown date';
                                                    return (
                                                        <div key={batch.id ?? batchIdx} className={`history-item status-${statusSlug}`} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                            <div className="item-main" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <div className="item-info" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                    <div style={{ background: '#f3f4f6', padding: '8px', borderRadius: '8px' }}>
                                                                        <FileText size={18} className="text-primary" />
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>{batch.file_name || 'Batch Upload'}</div>
                                                                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{createdAtDisplay}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="item-status">
                                                                    <span className={`status-badge ${statusSlug}`} style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>{batchStatus}</span>
                                                                </div>
                                                            </div>
                                                            {rejectedCount > 0 && !processedBatchIds.includes(batch.id) && (
                                                                <div className="item-alert" style={{ marginTop: '12px', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '8px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <div className="alert-text" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9a3412', fontSize: '0.8rem', fontWeight: 500 }}>
                                                                        <AlertTriangle size={16} />
                                                                        <span>{rejectedCount} items were rejected from this batch.</span>
                                                                    </div>
                                                                    <button className="resolve-btn" onClick={() => startResubmission(batch)} style={{ background: '#f97316', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Resolve & Resubmit</button>
                                                                </div>
                                                            )}
                                                            {batch.remarks && (
                                                                <div className="item-remark" style={{ marginTop: '8px', fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <Info size={14} />
                                                                    <span>{batch.remarks}</span>
                                                                </div>
                                                            )}
                                                            {processedBatchIds.includes(batch.id) && (
                                                                <div className="processed-tag" style={{ marginTop: '12px', background: '#f0fdf4', color: '#166534', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                    <Check size={12} /> ALREADY RESUBMITTED
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Resubmission Modal */}
            {resubmitModal.visible && (
                <div className="modal-overlay">
                    <div style={{ position: 'relative', width: '1100px', maxWidth: '98%', maxWeight: '90vh', background: 'white !important', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)', zIndex: 1000 }}>
                        <button onClick={() => setResubmitModal({ visible: false, batchId: null, rows: [], submitting: false })} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', zIndex: 10 }}>
                            <X size={24} />
                        </button>
                        <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', background: 'white !important' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <RotateCcw size={24} className="text-warning" />
                                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Resolve Rejections</h2>
                            </div>
                            <p style={{ margin: '4px 0 0 36px', color: '#64748b', fontSize: '0.9rem' }}>Correct the rejected entries below and submit them as a new batch.</p>
                        </div>
                        <div style={{ padding: '24px', background: '#f8fafc !important', flex: 1, overflowY: 'auto' }}>
                            <div style={{ width: '100% !important', background: 'white !important', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
                                <table style={{ width: '100% !important', minWidth: '1050px', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
                                    <thead>
                                        <tr style={{ background: '#f1f5f9' }}>
                                            <th style={{ padding: '16px', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '16%' }}>Date</th>
                                            <th style={{ padding: '16px', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '22%' }}>Route Correction</th>
                                            <th style={{ padding: '16px', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '16%' }}>Vehicle Info</th>
                                            <th style={{ padding: '16px', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '12%' }}>Time</th>
                                            <th style={{ padding: '16px', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '12%' }}>Odo/Distance</th>
                                            <th style={{ padding: '16px', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '22%' }}>Rejection Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {resubmitModal.rows.map((row, idx) => {
                                            const d = new Date(row.date || new Date());
                                            const minDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
                                            const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
                                            return (
                                                <tr key={idx} style={{ background: 'white', borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                                                        <input type="date" value={row.date} min={minDay} max={maxDay} onChange={e => updateResubmitRow(idx, 'date', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none', background: '#fff' }} />
                                                    </td>
                                                    <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                                                        <div className="route-edit" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', width: '30px' }}>FROM</span>
                                                                <input type="text" placeholder="Origin" value={row.origin_route} onChange={e => updateResubmitRow(idx, 'origin_route', e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', width: '30px' }}>TO</span>
                                                                <input type="text" placeholder="Destination" value={row.destination_route} onChange={e => updateResubmitRow(idx, 'destination_route', e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <Car size={14} className="text-primary" />
                                                                {row.mode || 'N/A'}
                                                            </div>
                                                            <div style={{ fontSize: '0.72rem', color: '#64748b', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Purpose: {row.visit_intent || 'Field Visit'}</div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            <div style={{ position: 'relative' }}>
                                                                <span style={{ fontSize: '0.6rem', position: 'absolute', top: '-4px', left: '6px', background: 'white', padding: '0 2px', color: '#94a3b8' }}>START</span>
                                                                <input type="time" value={row.start_time} onChange={e => updateResubmitRow(idx, 'start_time', e.target.value)} style={{ width: '100%', padding: '8px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }} />
                                                            </div>
                                                            <div style={{ position: 'relative' }}>
                                                                <span style={{ fontSize: '0.6rem', position: 'absolute', top: '-4px', left: '6px', background: 'white', padding: '0 2px', color: '#94a3b8' }}>REACH</span>
                                                                <input type="time" value={row.reach_time} onChange={e => updateResubmitRow(idx, 'reach_time', e.target.value)} style={{ width: '100%', padding: '8px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }} />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <MapPin size={14} style={{ color: '#64748b' }} />
                                                                {row.odo_start} – {row.odo_end}
                                                            </div>
                                                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <Clock size={12} /> Distance Locked
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="rejection-reason" style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                                                        <div className="reason-bubble" style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '12px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 500, lineHeight: 1.5, position: 'relative', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                                            <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', opacity: 0.7 }}>Rejection Remark</div>
                                                            {row._remarks || "No remark provided"}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', padding: '20px', borderTop: '1px solid #e2e8f0' }}>
                            <button className="btn-secondary" onClick={() => setResubmitModal({ visible: false, batchId: null, rows: [], submitting: false })}>Cancel</button>
                            <button
                                className={`btn-primary ${resubmitModal.submitting ? 'loading' : ''}`}
                                onClick={handleResubmit}
                                disabled={resubmitModal.submitting}
                                style={{ background: 'var(--magenta)', color: 'white', padding: '10px 24px', borderRadius: '6px', border: 'none', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                {resubmitModal.submitting ? <Clock className="animate-spin" size={18} /> : <RotateCcw size={18} />}
                                Resubmit {resubmitModal.rows.length} Items
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TravelExpenseGrid;
