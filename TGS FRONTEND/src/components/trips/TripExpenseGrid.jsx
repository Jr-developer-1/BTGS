import { formatIndianCurrency } from '../../utils/formatters';
import React, { useState, useEffect, useRef } from 'react';
import {
    Plus,
    Search,
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
const FALLBACK_INCIDENTAL_TYPES = ['Parking Charges', 'Toll Charges', 'Fuel (Own Vehicle)', 'Luggage Charges', 'Porter Charges', 'Internet / WiFi', 'Others'];

const TRAVEL_STATUSES = ['Completed', 'Cancelled', 'Rescheduled'];
const CAB_VEHICLE_TYPES = ['Sedan', 'SUV', 'MUV', 'Hatchback'];
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


const SearchableLocationSelect = ({ placeholder, options, value, onSelect, error, icon: Icon, disabled, showCode, errorMessage }) => {
    const [search, setSearch] = React.useState('');
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getDisplayName = (l) => {
        if (!l) return '';
        return l.name || l.cluster_name || l.panchayat_name || l.municipality_name || l.corporation_name || l.ward_name || l.village_name || l.town_name || '';
    };

    const filtered = (options || []).filter(l => {
        const dName = getDisplayName(l).toLowerCase();
        const sTerm = (search || '').toLowerCase();
        const codeMatch = (l.code || '').toLowerCase().startsWith(sTerm);
        return dName.startsWith(sTerm) || codeMatch;
    });

    const displayItems = Array.from(new Map(filtered.map(item => {
        const baseName = getDisplayName(item);
        const finalLabel = showCode ? `${baseName}${item.code ? ` - ${item.code}` : ''}` : baseName;
        return [finalLabel, { ...item, _finalLabel: finalLabel }];
    })).values()).sort((a, b) => a._finalLabel.localeCompare(b._finalLabel));

    return (
        <div className={`relative w-full ${disabled ? 'opacity-40 cursor-not-allowed grayscale-[0.5]' : ''}`} ref={dropdownRef} style={{ position: 'relative' }}>
            <div
                className={`input-with-icon select-wrapper group ${error ? 'error-border' : ''} ${isOpen ? 'active shadow-lg' : 'hover:shadow-md'} transition-all duration-300 cursor-pointer overflow-hidden`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                style={{ height: '40px', position: 'relative', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc', display: 'flex', alignItems: 'center' }}
            >
                {Icon && <Icon size={16} style={{ position: 'absolute', left: '12px', color: '#94a3b8' }} />}
                <div className="flex-1 overflow-hidden" style={{ paddingLeft: Icon ? '36px' : '12px', paddingRight: '36px' }}>
                    <div
                        className={`text-sm tracking-tight ${value ? 'font-bold text-slate-800' : 'font-medium text-slate-400 opacity-60'}`}
                        style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontSize: '13px' }}
                    >
                        {value || placeholder}
                    </div>
                </div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}><path d="M1 1l4 4 4-4" /></svg>
                </div>
            </div>

            {isOpen && (
                <div
                    className="absolute top-[108%] left-0 right-0 z-[2000] rounded-lg border border-slate-200 overflow-hidden animate-fade-in"
                    style={{ position: 'absolute', top: '108%', left: 0, right: 0, zIndex: 2000, background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                >
                    <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', background: 'white', position: 'sticky', top: 0 }}>
                        <div style={{ position: 'relative', width: '100%' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                            <input
                                autoFocus
                                style={{ width: '100%', height: '32px', paddingLeft: '32px', paddingRight: '24px', fontSize: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', background: '#f8fafc' }}
                                placeholder="Type to filter..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    if (onSelect) onSelect(e.target.value); // Allow manual update trigger
                                }}
                            />
                            {search && (
                                <button style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setSearch(''); if (onSelect) onSelect(''); }}>
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {search && (
                            <div style={{ padding: '10px 12px', cursor: 'pointer', background: '#f0f9ff', borderBottom: '1px solid #e0f2fe', display: 'flex', alignItems: 'center', gap: '6px' }} className="hover:bg-blue-50" onClick={() => {
                                onSelect(search);
                                setIsOpen(false);
                                setSearch('');
                            }}>
                                <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: '600' }}>Use manual entry:</span>
                                <span style={{ fontSize: '12px', color: '#0369a1', fontWeight: 'bold', fontStyle: 'italic' }}>"{search}"</span>
                            </div>
                        )}
                        {displayItems.length > 0 ? (
                            <div>
                                {displayItems.map(l => (
                                    <div key={l.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="hover:bg-slate-50" onClick={() => {
                                        onSelect(l._finalLabel);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}>
                                        <span style={{ fontSize: '13px', color: '#334155' }}>{l._finalLabel}</span>
                                        {l.cluster_type && (
                                            <span style={{ fontSize: '9px', padding: '2px 6px', background: '#f1f5f9', color: '#64748b', borderRadius: '4px', fontWeight: 'bold' }}>
                                                {l.cluster_type}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
                                No suggestions found.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
};

const TripExpenseGrid = ({
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
    onJobReportClick,
    hasAdditionalLuggage = false
}) => {
    // Master data states
    const [travelModes, setTravelModes] = useState([]);
    const [bookedByOptions, setBookedByOptions] = useState([]);
    const [ticketStatusOptions, setTicketStatusOptions] = useState([]);
    const [quotaTypeOptions, setQuotaTypeOptions] = useState([]);
    const [flightClasses, setFlightClasses] = useState([]);
    const [trainClasses, setTrainClasses] = useState([]);
    const [busSeatTypes, setBusSeatTypes] = useState([]);
    const [intercityCabVehicleTypes, setIntercityCabVehicleTypes] = useState(CAB_VEHICLE_TYPES);
    const [airlines, setAirlines] = useState([]);
    const [busOperators, setBusOperators] = useState([]);
    const [travelProviders, setTravelProviders] = useState([]);
    const [trainProviders, setTrainProviders] = useState([]);
    const [flightProviders, setFlightProviders] = useState([]);
    const [busProviders, setBusProviders] = useState([]);
    const [cabProviders, setCabProviders] = useState([]);

    // Location Search State
    const [locationSuggestions, setLocationSuggestions] = useState([]);
    const [activeSearch, setActiveSearch] = useState(null); // { rowId, field: 'origin'|'destination' }
    const searchTimerRef = useRef(null);

    // Incidental Category Subsets
    const [localIncidentalTypes, setLocalIncidentalTypes] = useState([]);
    const [travelIncidentalTypes, setTravelIncidentalTypes] = useState([]);
    const [generalIncidentalTypes, setGeneralIncidentalTypes] = useState([]);

    // Local Masters
    const [localTravelModes, setLocalTravelModes] = useState([]);
    const [localCarSubTypes, setLocalCarSubTypes] = useState([]);
    const [localBikeSubTypes, setLocalBikeSubTypes] = useState([]);
    const [localAutoSubTypes, setLocalAutoSubTypes] = useState([]);
    const [localProviders, setLocalProviders] = useState([]);

    // Stay Masters
    const [stayTypes, setStayTypes] = useState([]);
    const [roomTypes, setRoomTypes] = useState([]);
    const [stayBookingTypes, setStayBookingTypes] = useState([]);
    const [stayBookingSources, setStayBookingSources] = useState([]);

    // Food Masters
    const [mealCategories, setMealCategories] = useState([]);
    const [mealTypes, setMealTypes] = useState([]);
    const [mealSources, setMealSources] = useState([]);
    const [mealProviders, setMealProviders] = useState([]);

    // Incidental Masters
    const [incidentalTypes, setIncidentalTypes] = useState([]);

    const [rows, setRows] = useState([]);
    const [locationsPool, setLocationsPool] = useState([]);
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
    const [isLocating, setIsLocating] = useState(false);
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
    const [bulkModal, setBulkModal] = useState({ visible: false, file: null, uploading: false });

    useEffect(() => {
        const fetchMasters = async () => {
            try {
                const [
                    modesRes, bookedByRes, classesRes, vehiclesRes,
                    operatorsRes, providersRes, locModesRes, locSubTypesRes, locProvRes,
                    stayTypeRes, roomTypeRes, mealCatRes, mealTypeRes, incTypeRes,
                    ticketStatusRes, quotaTypeRes
                ] = await Promise.all([
                    api.get('/api/travel-mode-masters/'),
                    api.get('/api/booking-type-masters/'),
                    api.get('/api/travel-class-masters/'),
                    api.get('/api/vehicle-masters/'),
                    api.get('/api/operator-masters/'),
                    api.get('/api/provider-masters/'),
                    api.get('/api/local-travel-mode-masters/'),
                    api.get('/api/local-sub-type-masters/'),
                    api.get('/api/local-provider-masters/'),
                    api.get('/api/stay-type-masters/'),
                    api.get('/api/room-type-masters/'),
                    api.get('/api/meal-category-masters/'),
                    api.get('/api/meal-type-masters/'),
                    api.get('/api/incidental-type-masters/'),
                    api.get('/api/ticket-status-masters/'),
                    api.get('/api/quota-type-masters/')
                ]);
                // Populate Travel (Broad fetch + Local exact filtering)
                const modesData = modesRes.data || [];
                setTravelModes(modesData.filter(m => !!m.status).map(m => toTitleCase(m.mode_name)));

                const bookedByData = bookedByRes.data || [];
                setBookedByOptions(bookedByData.filter(m => !!m.status).map(m => toTitleCase(m.booking_type)));

                const classesData = classesRes.data || [];
                setFlightClasses(classesData.filter(m => !!m.status && !!m.is_flight).map(m => toTitleCase(m.class_name)));
                setTrainClasses(classesData.filter(m => !!m.status && !!m.is_train).map(m => toTitleCase(m.class_name)));
                setBusSeatTypes(classesData.filter(m => !!m.status && !!m.is_bus).map(m => toTitleCase(m.class_name)));

                const vehiclesData = vehiclesRes.data || [];
                setIntercityCabVehicleTypes(vehiclesData.filter(m => !!m.status && !!m.is_intercity_cab).map(m => toTitleCase(m.vehicle_name)));

                const operatorsData = operatorsRes.data || [];
                setAirlines(operatorsData.filter(m => !!m.status && !!m.is_flight).map(m => toTitleCase(m.operator_name)));
                setBusOperators(operatorsData.filter(m => !!m.status && !!m.is_bus).map(m => toTitleCase(m.operator_name)));

                const providersData = providersRes.data || [];
                setTravelProviders(providersData.filter(m => !!m.status).map(m => toTitleCase(m.provider_name)));
                setTrainProviders(providersData.filter(m => !!m.status && !!m.is_train).map(m => toTitleCase(m.provider_name)));
                setBusProviders(providersData.filter(m => !!m.status && !!m.is_bus).map(m => toTitleCase(m.provider_name)));
                setCabProviders(providersData.filter(m => !!m.is_intercity_cab).map(m => toTitleCase(m.provider_name)));
                setFlightProviders(providersData.filter(m => !!m.status && !!m.is_flight).map(m => toTitleCase(m.provider_name)));

                if (ticketStatusRes.data?.length > 0) setTicketStatusOptions(ticketStatusRes.data.filter(m => !!m.status));
                if (quotaTypeRes.data?.length > 0) setQuotaTypeOptions(quotaTypeRes.data.filter(m => !!m.status));

                // Populate Local
                const locModesData = locModesRes.data || [];
                setLocalTravelModes((locModesData || []).map(m => toTitleCase(m.mode_name)));

                const locSubTypesData = locSubTypesRes.data || [];
                setLocalCarSubTypes(locSubTypesData.filter(m => !!m.is_car).map(m => toTitleCase(m.sub_type)));
                setLocalBikeSubTypes(locSubTypesData.filter(m => !!m.is_bike).map(m => toTitleCase(m.sub_type)));
                setLocalAutoSubTypes(locSubTypesData.filter(m => !!m.is_auto).map(m => toTitleCase(m.sub_type)));

                const locProvData = locProvRes.data || [];
                setLocalProviders(locProvData || []);

                // Populate Stay
                const stayTypesData = stayTypeRes.data || [];
                setStayTypes(stayTypesData.map(m => toTitleCase(m.stay_type)));
                const roomTypesData = roomTypeRes.data || [];
                setRoomTypes(roomTypesData.map(m => toTitleCase(m.room_type)));

                // Determine incidental subsets
                if (incTypeRes.data?.length > 0) {
                    const allInc = incTypeRes.data || [];
                    setIncidentalTypes(allInc.map(m => toTitleCase(m.expense_type)));
                    setLocalIncidentalTypes(allInc.filter(m => m.category === 'local_conveyance').map(m => toTitleCase(m.expense_type)));
                    setTravelIncidentalTypes(allInc.filter(m => m.category === 'travel_incidental').map(m => toTitleCase(m.expense_type)));
                    setGeneralIncidentalTypes(allInc.filter(m => m.category === 'general_incidental').map(m => toTitleCase(m.expense_type)));
                }

                // Populate Food
                if (mealCatRes.data?.length > 0) setMealCategories(mealCatRes.data.map(m => toTitleCase(m.category_name)));
                if (mealTypeRes.data?.length > 0) setMealTypes(mealTypeRes.data.map(m => toTitleCase(m.meal_type)));

                try {
                    const res = await api.get('/api/geo/hierarchy/');
                    const data = res.data.results || res.data.data || res.data;
                    const hierarchy = Array.isArray(data) ? data : [];

                    const result = [];
                    const CITY_TYPES = ['city', 'metropolitan city', 'metro city', 'metro_city', 'metropolyten city'];
                    const isCityType = (t) => CITY_TYPES.includes((t || '').toLowerCase().trim());

                    const walk = (node) => {
                        if (!node || typeof node !== 'object') return;

                        ['cities', 'metro_polyten_cities'].forEach(key => {
                            const arr = node[key];
                            if (Array.isArray(arr)) {
                                arr.forEach(c => {
                                    if (c && c.name) {
                                        result.push({ id: c.id, name: c.name, code: c.code || '', cluster_type: key === 'metro_polyten_cities' ? 'Metro City' : 'City' });
                                    }
                                    walk(c);
                                });
                            }
                        });

                        ['clusters', 'cluster', 'children'].forEach(key => {
                            const arr = node[key];
                            if (Array.isArray(arr)) {
                                arr.forEach(c => {
                                    if (c && c.name && isCityType(c.type || c.cluster_type)) {
                                        result.push({ id: c.id, name: c.name, code: c.code || '', cluster_type: (c.type || c.cluster_type || '').toLowerCase().includes('metro') ? 'Metro City' : 'City' });
                                    }
                                    walk(c);
                                });
                            }
                        });

                        ['continents', 'countries', 'states', 'districts', 'mandals', 'towns', 'villages', 'locations'].forEach(key => {
                            if (Array.isArray(node[key])) node[key].forEach(walk);
                        });
                    };

                    hierarchy.forEach(walk);

                    const seen = new Set();
                    const finalCities = result.filter(loc => { if (seen.has(loc.name)) return false; seen.add(loc.name); return true; }).sort((a, b) => a.name.localeCompare(b.name));
                    setLocationsPool(finalCities);
                } catch (err) {
                    console.error("Geo hierarchy fetch failed:", err);
                }

            } catch (error) {
                console.error("Failed to fetch masters:", error);
            }
        };
        fetchMasters();

        const fetchStayBookingMasters = async () => {
            try {
                const [bookingTypeRes, bookingSourceRes] = await Promise.all([
                    api.get('/api/stay-booking-type-masters/'),
                    api.get('/api/stay-booking-source-masters/')
                ]);
                setStayBookingTypes((bookingTypeRes.data || []).map(item => toTitleCase(item.booking_type)));
                setStayBookingSources((bookingSourceRes.data || []).map(item => toTitleCase(item.source_name)));
            } catch (error) {
                console.warn('Could not fetch stay booking masters:', error);
            }
        };
        fetchStayBookingMasters();

        const fetchFoodMasters = async () => {
            try {
                const [mealSourceRes, mealProviderRes] = await Promise.all([
                    api.get('/api/meal-source-masters/'),
                    api.get('/api/meal-provider-masters/')
                ]);
                setMealSources((mealSourceRes.data || []).map(item => toTitleCase(item.source_name)));
                setMealProviders((mealProviderRes.data || []).map(item => toTitleCase(item.provider_name)));
            } catch (error) {
                console.warn('Could not fetch food masters:', error);
            }
        };
        fetchFoodMasters();

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

                // Fallback: If my_rate returns null (e.g. state mismatch), fetch general list
                if (Object.keys(rates).length === 0) {
                    const resAll = await api.get('/api/masters/fuel-rate-masters/');
                    if (Array.isArray(resAll.data)) {
                        resAll.data.forEach(item => {
                            if (item.vehicle_type === '2 Wheeler' && !rates['2 Wheeler']) rates['2 Wheeler'] = parseFloat(item.rate_per_km);
                            if (item.vehicle_type === '4 Wheeler' && !rates['4 Wheeler']) rates['4 Wheeler'] = parseFloat(item.rate_per_km);
                        });
                    }
                }

                if (Object.keys(rates).length > 0) setFuelRates(rates);
            } catch (err) {
                console.warn('Could not fetch fuel rates:', err);
            }
        };
        fetchFuelRates();
    }, []);

    // Recalculate row amounts if fuelRates loads after mount (async delay)
    useEffect(() => {
        if (Object.keys(fuelRates).length > 0) {
            setRows(currentRows => currentRows.map(r => {
                if (r.nature === 'Local Travel' && ['Own Car', 'Own Bike'].map(s => s.toLowerCase()).includes(r.details.subType ? r.details.subType.toLowerCase() : '')) {
                    const is4W = r.details.subType && r.details.subType.toLowerCase() === 'own car';
                    const vehicleKey = is4W ? '4 Wheeler' : '2 Wheeler';
                    const rate = fuelRates[vehicleKey];
                    const start = parseFloat(r.details.odoStart || 0);
                    const end = parseFloat(r.details.odoEnd || 0);

                    if (!isNaN(start) && !isNaN(end) && end > start && rate) {
                        const distKm = end - start;
                        const fuelAmt = (distKm * rate).toFixed(2);
                        const newDetails = { ...r.details, fuelAmount: fuelAmt, isAutoCalculated: true };

                        if (newDetails.localIncidentals) {
                            newDetails.localIncidentals = newDetails.localIncidentals.map(inc => {
                                if (inc.type === 'Fuel') return { ...inc, amount: fuelAmt };
                                return inc;
                            });
                        }

                        const tollAmt = parseFloat(newDetails.tollAmount || 0);
                        const itemizedSum = (newDetails.localIncidentals || []).reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                        const totalAmt = (parseFloat(fuelAmt) + tollAmt + itemizedSum).toFixed(2);

                        return { ...r, amount: totalAmt, details: newDetails };
                    }
                }
                return r;
            }));
        }
    }, [fuelRates]);

    // --- DATE RANGE CONSTRAINTS ---
    const getMinDate = () => {
        if (!startDate) return undefined;
        try {
            const d = new Date(startDate);
            d.setDate(d.getDate() - 1);
            return d.toISOString().split('T')[0];
        } catch (e) { return undefined; }
    };

    const getMaxDate = () => {
        if (!endDate) return undefined;
        try {
            const d = new Date(endDate);
            d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
        } catch (e) { return undefined; }
    };

    const minDate = getMinDate();
    const maxDate = getMaxDate();

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

                // Re-map top-level DB columns back into details.
                // These fields were stripped out of `description` JSON during save and stored
                // as dedicated database columns. We must restore them so the UI can display them.
                if (!details.mode && exp.travel_mode) details.mode = exp.travel_mode;
                if (!details.classType && exp.class_type) details.classType = exp.class_type;
                if (!details.pnr && exp.booking_reference) details.pnr = exp.booking_reference;
                if (!details.bookingRef && exp.booking_reference) details.bookingRef = exp.booking_reference;
                if (details.refundable === undefined && exp.refundable_flag !== undefined)
                    details.refundable = exp.refundable_flag ? 'Yes' : 'No';
                if (details.mealIncluded === undefined && exp.meal_included_flag !== undefined)
                    details.mealIncluded = exp.meal_included_flag ? 'Yes' : 'No';
                // vehicle_type maps to subType for Local Travel and vehicleType for Travel (Intercity Car)
                if (!details.subType && !details.vehicleType && exp.vehicle_type) {
                    details.subType = exp.vehicle_type;
                    details.vehicleType = exp.vehicle_type;
                }
                if (!details.odoStart && exp.odo_start != null) details.odoStart = String(exp.odo_start);
                if (!details.odoEnd && exp.odo_end != null) details.odoEnd = String(exp.odo_end);
                if (!details.totalKm && exp.distance != null) details.totalKm = String(exp.distance);
                if (!details.bookedBy && exp.booked_by) details.bookedBy = exp.booked_by;
                if (!details.cancellationDate && exp.cancellation_date) details.cancellationDate = exp.cancellation_date;
                if (!details.refundAmount && exp.refund_amount != null) details.refundAmount = String(exp.refund_amount);
                if (!details.cancellationReason && exp.cancellation_reason) details.cancellationReason = exp.cancellation_reason;
                // travelStatus from cancellation_status top-level column
                if (!details.travelStatus) details.travelStatus = exp.cancellation_status || 'Completed';

                if (!details.auditTrail) details.auditTrail = [];

                // Categorization recovery: If it's "Others" (the fallback) but has incidental-specific fields, it's an Incidental.
                const natureVal = (exp.category === 'Others' && (details.incidentalType || details.incidentalCategory))
                    ? 'Incidental'
                    : (exp.category === 'Others' ? 'Travel' : (exp.category === 'Fuel' ? 'Local Travel' : exp.category));
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
                    timeDetails: details.time || { boardingTime: '', scheduledTime: '', delay: 0, actualTime: '' },
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
                    jobReportFiles: (() => {
                        try {
                            if (exp.jobReportAttachments) {
                                if (typeof exp.jobReportAttachments === 'string' && exp.jobReportAttachments.startsWith('[')) {
                                    return JSON.parse(exp.jobReportAttachments);
                                }
                                return Array.isArray(exp.jobReportAttachments) ? exp.jobReportAttachments : [exp.jobReportAttachments];
                            }
                        } catch (e) { }
                        return [];
                    })(),
                    claim: true,
                    isExpanded: true,
                    isSaved: true
                };
            });
            // Preserve rows that haven't been saved yet when syncing
            setRows(currentRows => {
                const unsavedRows = currentRows.filter(r => !r.isSaved);
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

            // DATE RANGE VALIDATION
            if (minDate && maxDate) {
                if (row.date < minDate || row.date > maxDate) {
                    showToast(`Item #${rowNum}: Selected date (${row.date}) is outside trip range. Only trip dates +/- 1 day grace allowed.`, "error");
                    return false;
                }
                if (row.nature === 'Accommodation') {
                    if (row.details.checkIn && (row.details.checkIn < minDate || row.details.checkIn > maxDate)) {
                        showToast(`Item #${rowNum}: Check-In date is outside trip range.`, "error");
                        return false;
                    }
                    if (row.details.checkOut && (row.details.checkOut < minDate || row.details.checkOut > maxDate)) {
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
            // require bill if any charge present
            if (parseFloat(row.amount) > 0 && row.nature !== 'Incidental' && (!row.bills || row.bills.length === 0)) {
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

            // REMARKS MIN LENGTH
            const remarks = (row.remarks || '').trim();
            if (remarks.length > 0 && remarks.length < 10) {
                showToast(`Item #${rowNum}: Remarks must be at least 10 characters for auditing.`, "error");
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
                const locRegex = /^[A-Za-z0-9 \-\/\(\)\,\.]{2,}$/;
                if (!locRegex.test(origin) || !locRegex.test(destination)) {
                    showToast(`Item #${rowNum}: From/To must be at least 2 characters (alphanumeric, -, /, (, ), ,, .).`, "error");
                    return false;
                }
                // carrier name allowed letters, spaces, numbers and common symbols
                if (row.details.carrier && !/^[A-Za-z0-9 \-\.\&\/\,]+$/.test(row.details.carrier)) {
                    showToast(`Item #${rowNum}: Carrier name may contain letters, numbers, spaces and symbols (-, ., &, /, ,).`, "error");
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
                    if (!alnum.test(ticketNo)) { showToast(`Item #${rowNum}: Ticket Number may only contain letters and numbers.`, "error"); return false; }
                    if (ticketNo.length > 25) { showToast(`Item #${rowNum}: Ticket Number cannot exceed 25 characters.`, "error"); return false; }
                    if (!alnum.test(pnr)) { showToast(`Item #${rowNum}: PNR / Reference may only contain letters and numbers.`, "error"); return false; }
                    if (pnr.length < 3 || pnr.length > 20) { showToast(`Item #${rowNum}: PNR must be 3-20 characters long.`, "error"); return false; }
                } else if (mode === 'Intercity Bus') {
                    if (!row.details.carrier) { setRowError(row.id, 'carrier', 'Bus Operator is mandatory.'); return false; }
                } else if (mode === 'Intercity Cab') {
                    if (!provider) { setRowError(row.id, 'provider', 'Provider / Vendor (Ola/Uber etc) is mandatory.'); return false; }
                    if (!row.timeDetails.boardingTime || !row.timeDetails.actualTime) { setRowError(row.id, 'time', 'Departure and Arrival times are mandatory for Cab.'); return false; }
                }

                if (isSelfBooked) {
                    // travel-specific requirement
                    if (mode === 'Flight' || mode === 'Intercity Bus' || mode === 'Intercity Cab') {
                        // Ticket/Invoice requirements - relaxed to 1 bill
                        if (!row.bills || row.bills.length < 1) {
                            showToast(`Item #${rowNum}: Please upload ${mode === 'Intercity Cab' ? 'Invoice' : 'Ticket/Invoice'} for self-booked ${mode.toLowerCase()}.`, "warning");
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
            } else if (row.nature === 'Local Travel') {
                const { mode, subType, odoStart, odoEnd, origin, destination } = row.details;

                // Prevent during active long distance travel
                const localStart = new Date(row.date + 'T' + (row.timeDetails.boardingTime || '00:00'));
                const localEnd = new Date((row.endDate || row.date) + 'T' + (row.timeDetails.actualTime || '23:59'));
                for (let j = 0; j < rows.length; j++) {
                    const r2 = rows[j];
                    if (r2.nature === 'Travel' && r2.id !== row.id) {
                        const tStart = new Date((r2.details.depDate || r2.date) + 'T' + (r2.timeDetails.boardingTime || '00:00'));
                        const tEnd = new Date((r2.details.arrDate || r2.date) + 'T' + (r2.timeDetails.actualTime || '23:59'));
                        // If local travel date/time overlaps with a long distance journey
                        if (localStart >= tStart && localEnd <= tEnd) {
                            showToast(`Item #${rowNum}: Local Travel overlaps with your ${r2.details.mode} journey (${r2.details.origin} to ${r2.details.destination}).`, "warning");
                        }
                    }
                }

                if (!mode) {
                    showToast(`Item #${rowNum}: Please select a Local Travel Mode.`, "error");
                    return false;
                }
                // SubType is mandatory only for Car, Bike, or Auto modes (case-insensitive)
                const modeLowerCase = mode.toLowerCase();
                const requiresSubType = modeLowerCase.includes('car') || modeLowerCase.includes('bike') || modeLowerCase === 'auto';
                if (requiresSubType && !subType) {
                    showToast(`Item #${rowNum}: Please select a Sub-Type for ${mode}.`, "error");
                    return false;
                }

                if (subType && subType.toLowerCase() === 'ride hailing') {
                    if (!origin || !destination) {
                        showToast(`Item #${rowNum}: Pickup and Drop locations are required for Ride Hailing.`, "error");
                        return false;
                    }
                }

                // date range validation for local travel
                if (row.date && row.endDate) {
                    // optionally block future dates if needed
                    const today = new Date();
                    if (new Date(row.date) > today || new Date(row.endDate) > today) {
                        showToast(`Item #${rowNum}: Travel dates cannot be in the future.`, "error");
                        return false;
                    }
                }

                // location cross-check
                if (origin && destination && origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
                    showToast(`Item #${rowNum}: From and To locations are the same. Please verify.`, "warning");
                    // removed return false to allow different values that might look similar or same-city travel
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
                }

                if (modeLowerCase === 'walk') {
                    if (parseFloat(row.amount) > 0) {
                        showToast(`Item #${rowNum}: Walk mode cannot have an associated cost.`, "error");
                        return false;
                    }
                    if (!origin || !destination) {
                        showToast(`Item #${rowNum}: From and To locations are required for Walk entries.`, "error");
                        return false;
                    }
                }

                if (subType && subType.toLowerCase() === 'own car') {
                    if (!odoStart || !odoEnd) {
                        showToast(`Item #${rowNum}: Both start and end odometer readings are required for Own Car.`, "error");
                        return false;
                    }
                    if (isNaN(parseFloat(odoStart)) || isNaN(parseFloat(odoEnd))) {
                        showToast(`Item #${rowNum}: Odometer readings must be numeric.`, "error");
                        return false;
                    }
                    if (parseFloat(odoEnd) <= parseFloat(odoStart)) {
                        showToast(`Item #${rowNum}: End Odometer should be greater than Start Odometer.`, "error");
                        return false;
                    }
                    // require photos for both start and end readings
                    if (!row.details.odoStartImg || !row.details.odoEndImg) {
                        showToast(`Item #${rowNum}: Please capture both start and end odometer photos.`, "error");
                        if (!row.details.odoStartImg) setRowError(row.id, 'odoStartImg', 'Start odometer photo required.');
                        if (!row.details.odoEndImg) setRowError(row.id, 'odoEndImg', 'End odometer photo required.');
                        return false;
                    }
                } else if (['Self Drive Rental', 'Own Bike'].includes(subType)) {
                    if (odoStart && odoEnd && parseFloat(odoEnd) <= parseFloat(odoStart)) {
                        showToast(`Item #${rowNum}: ODO End must be greater than ODO Start.`, "error");
                        return false;
                    }
                }


            } else if (row.nature === 'Food') {

                const mealSource = normalizeMealSource(row.details.mealSource);
                const isSelfMeal = row.details.mealCategory === 'Self Meal';
                if (!row.date) { showToast(`Item #${rowNum}: Date is required.`, "error"); return false; }
                if (!row.details.mealType) { showToast(`Item #${rowNum}: Please select Meal Type.`, "error"); return false; }
                if (!row.details.mealTime) { showToast(`Item #${rowNum}: Meal Time is required.`, "error"); return false; }

                // MEAL TIME VS TYPE
                const [mHours, mMins] = (row.details.mealTime || '00:00').split(':').map(Number);
                const mealTimeVal = mHours + (mMins / 60);
                if (row.details.mealType === 'Breakfast' && (mealTimeVal < 6 || mealTimeVal > 11)) {
                    showToast(`Item #${rowNum}: Breakfast time should be between 06:00 and 11:00.`, "warning");
                } else if (row.details.mealType === 'Lunch' && (mealTimeVal < 12 || mealTimeVal > 16)) {
                    showToast(`Item #${rowNum}: Lunch time should be between 12:00 and 16:00.`, "warning");
                } else if (row.details.mealType === 'Dinner' && (mealTimeVal < 19)) {
                    showToast(`Item #${rowNum}: Dinner time should be after 19:00.`, "warning");
                }
                if (!row.details.mealCategory) { showToast(`Item #${rowNum}: Please select Meal Category.`, "error"); return false; }
                if (isSelfMeal) {
                    if (!row.details.mealSource) { showToast(`Item #${rowNum}: Please select Meal Source.`, "error"); return false; }
                    if (mealSource === 'online' && (!row.details.provider || !row.details.provider.trim())) { showToast(`Item #${rowNum}: Provider is required for Online meal source.`, "error"); return false; }
                    if (mealSource === 'hotel' && !row.details.hotelName?.trim()) { showToast(`Item #${rowNum}: Hotel Name is required.`, "error"); return false; }
                    if (mealSource === 'restaurant' && !row.details.restaurant?.trim()) { showToast(`Item #${rowNum}: Restaurant Name is required.`, "error"); return false; }
                    if (mealSource === 'online' && !row.details.hotelName?.trim()) { showToast(`Item #${rowNum}: Hotel/Outlet Name is required for Online meal source.`, "error"); return false; }
                    if (!row.amount || parseFloat(row.amount) <= 0) { showToast(`Item #${rowNum}: Amount must be greater than 0 for Self Meal.`, "error"); return false; }
                } else if (parseFloat(row.amount || 0) !== 0) {
                    showToast(`Item #${rowNum}: Amount must be 0 for Client Hosted and Working Meal.`, "error");
                    return false;
                }

                // Cross-row duplicate meal check
                if (['Breakfast', 'Lunch', 'Dinner'].includes(row.details.mealType)) {
                    for (const r2 of rows) {
                        if (r2.id !== row.id && r2.nature === 'Food' && r2.date === row.date && r2.details.mealType === row.details.mealType) {
                            showToast(`Item #${rowNum}: A ${row.details.mealType} entry already exists for ${row.date}. Only one allowed per day.`, "error");
                            return false;
                        }
                    }
                }

                // Check if meal already included in travel booking
                const mealDate = new Date(row.date);
                const isMealIncludedInTravel = rows.some(r2 =>
                    r2.nature === 'Travel' &&
                    r2.details.meal_included_flag &&
                    new Date(r2.details.depDate || r2.date) <= mealDate &&
                    new Date(r2.details.arrDate || r2.date) >= mealDate
                );

                if (isMealIncludedInTravel && ['Breakfast', 'Lunch', 'Dinner'].includes(row.details.mealType)) {
                    showToast(`Item #${rowNum}: ${row.details.mealType} is already included in your travel booking for this date.`, "warning");
                }

            } else if (row.nature === 'Accommodation') {
                const scheduledCheckInDate = row.details.scheduledCheckInDate || row.details.checkIn;
                const scheduledCheckInTime = row.details.scheduledCheckInTime || row.details.checkInTime;
                const scheduledCheckOutDate = row.details.scheduledCheckOutDate || row.details.checkOut;
                const scheduledCheckOutTime = row.details.scheduledCheckOutTime || row.details.checkOutTime;
                const actualCheckInDate = row.details.actualCheckInDate || row.details.checkIn;
                const actualCheckInTime = row.details.actualCheckInTime || row.details.checkInTime;
                const actualCheckOutDate = row.details.actualCheckOutDate || row.details.checkOut;
                const actualCheckOutTime = row.details.actualCheckOutTime || row.details.checkOutTime;

                if (!scheduledCheckInDate || !scheduledCheckInTime || !scheduledCheckOutDate || !scheduledCheckOutTime) {
                    showToast(`Item #${rowNum}: Scheduled check-in and check-out date/time are required.`, "error");
                    return false;
                }
                if (!actualCheckInDate || !actualCheckInTime || !actualCheckOutDate || !actualCheckOutTime) {
                    showToast(`Item #${rowNum}: Actual check-in and check-out date/time are required.`, "error");
                    return false;
                }
                if (!row.details.bookingType) {
                    showToast(`Item #${rowNum}: Please select a Booking Type.`, "error");
                    return false;
                }
                if (!row.details.bookingSource) {
                    showToast(`Item #${rowNum}: Please select a Booking Source.`, "error");
                    return false;
                }
                if (!row.details.accomType) {
                    showToast(`Item #${rowNum}: Please select a Stay Type.`, "error");
                    return false;
                }
                const needsHotelName = ['Hotel Stay', 'Guest House'].includes(row.details.accomType);
                if (needsHotelName && !row.details.hotelName) {
                    showToast(`Item #${rowNum}: Please provide the Hotel/Guest House name.`, "error");
                    return false;
                }
                if (actualCheckInDate && actualCheckOutDate && new Date(actualCheckInDate) > new Date(actualCheckOutDate)) {
                    showToast(`Item #${rowNum}: Actual check-out date cannot be before actual check-in date.`, "error");
                    return false;
                }
                if (!row.amount || parseFloat(row.amount) <= 0) {
                    showToast(`Item #${rowNum}: Amount must be greater than 0.`, "error");
                    return false;
                }

                // STAY DURATION VS COST
                if (actualCheckInDate && actualCheckOutDate) {
                    const diffDays = Math.ceil((new Date(actualCheckOutDate) - new Date(actualCheckInDate)) / (1000 * 60 * 60 * 24));
                    const dailyCost = parseFloat(row.amount) / (diffDays || 1);
                    if (dailyCost < 100) {
                        showToast(`Item #${rowNum}: Daily stay cost seems unusually low (₹${dailyCost.toFixed(2)}). Please verify.`, "warning");
                    }

                    // Overlap check
                    const currentStart = new Date(actualCheckInDate + 'T' + actualCheckInTime);
                    const currentEnd = new Date(actualCheckOutDate + 'T' + actualCheckOutTime);

                    for (const r2 of rows) {
                        if (r2.id !== row.id && r2.nature === 'Accommodation') {
                            const r2In = r2.details.actualCheckInDate || r2.details.checkIn;
                            const r2InT = r2.details.actualCheckInTime || r2.details.checkInTime;
                            const r2Out = r2.details.actualCheckOutDate || r2.details.checkOut;
                            const r2OutT = r2.details.actualCheckOutTime || r2.details.checkOutTime;

                            if (r2In && r2InT && r2Out && r2OutT) {
                                const otherStart = new Date(r2In + 'T' + r2InT);
                                const otherEnd = new Date(r2Out + 'T' + r2OutT);

                                if (currentStart < otherEnd && currentEnd > otherStart) {
                                    showToast(`Item #${rowNum}: Stay period overlaps with item at ${r2In}.`, "error");
                                    return false;
                                }
                            }
                        }
                    }
                }

            } else if (row.nature === 'Incidental') {
                if (!row.date) {
                    showToast(`Item #${rowNum}: Date is mandatory for incidental expenses.`, "error");
                    return false;
                }
                if (!row.details.incidentalTime) {
                    showToast(`Item #${rowNum}: Time is mandatory for incidental expenses.`, "error");
                    return false;
                }
                if (!row.details.incidentalType) {
                    showToast(`Item #${rowNum}: Please select an Incidental Type.`, "error");
                    return false;
                }
                if (!row.details.location || row.details.location.trim().length < 3) {
                    showToast(`Item #${rowNum}: Location must be at least 3 characters.`, "error");
                    return false;
                }
                if (!/^\d+(\.\d{1,2})?$/.test(String(row.amount || '').trim())) {
                    showToast(`Item #${rowNum}: Amount must be a valid number with up to 2 decimal places.`, "error");
                    return false;
                }
                if (parseFloat(row.amount) <= 0) {
                    showToast(`Item #${rowNum}: Amount must be greater than 0.`, "error");
                    return false;
                }
                if (isIncidentalOthersType(row.details.incidentalType)) {
                    const reasonWordCount = countWords(row.details.otherReason);
                    if (reasonWordCount < 1 || reasonWordCount > 6) {
                        showToast(`Item #${rowNum}: Reason must be between 1 and 6 words.`, "error");
                        return false;
                    }
                    const remarksWordCount = countWords(row.details.notes);
                    if (remarksWordCount < 1 || remarksWordCount > 50) {
                        showToast(`Item #${rowNum}: Remarks must be between 1 and 50 words.`, "error");
                        return false;
                    }
                }
                if (row.details.incidentalType === 'Porter Charges' && !hasAdditionalLuggage) {
                    showToast(`Item #${rowNum}: Porter Charges are only allowed if "Additional Luggage" was checked in the Trip Story.`, "error");
                    return false;
                }

                // --- DUPLICATE CHECK ---
                // Only check for duplicates if this row is not yet saved or has been modified
                if (!row.isSaved) {
                    const isDuplicate = rows.some(r => {
                        if (r.id === row.id) return false;
                        if (r.nature !== 'Incidental') return false;

                        const isSameDateTimeType =
                            r.date === row.date &&
                            (r.details?.incidentalTime || "").trim() === (row.details.incidentalTime || "").trim() &&
                            (r.details?.incidentalType || "").trim().toLowerCase() === (row.details.incidentalType || "").trim().toLowerCase();

                        if (!isSameDateTimeType) return false;

                        if (isIncidentalOthersType(row.details.incidentalType)) {
                            return (r.details?.otherReason || "").trim().toLowerCase() === (row.details.otherReason || "").trim().toLowerCase();
                        }

                        return true;
                    });

                    if (isDuplicate) {
                        showToast("Duplicate entry not allowed", "error");
                        return false;
                    }
                }
            }
        }

        // Overlap & Continuity Validations
        const sortedRows = [...rows].sort((a, b) => new Date(a.date + 'T' + (a.timeDetails?.boardingTime || a.details?.mealTime || a.details?.incidentalTime || '00:00')) - new Date(b.date + 'T' + (b.timeDetails?.boardingTime || b.details?.mealTime || b.details?.incidentalTime || '00:00')));

        // BACK-TO-BACK TRAVEL & ODO CONTINUITY
        let lastTravel = null;
        let lastOdoEnd = -1;
        let lastStayEnd = null;

        for (const row of sortedRows) {
            const rowNum = rows.findIndex(r => r.id === row.id) + 1;

            if (row.nature === 'Travel') {
                if (lastTravel) {
                    const lastArr = new Date((lastTravel.details.arrDate || lastTravel.date) + 'T' + (lastTravel.timeDetails.actualTime || '23:59'));
                    const curDep = new Date((row.details.depDate || row.date) + 'T' + (row.timeDetails.boardingTime || '00:00'));
                    if (curDep < lastArr) {
                        showToast(`Back-to-back travel error: Segment starting on ${row.date} begins before previous segment ends.`, "error");
                        return false;
                    }
                }
                lastTravel = row;

                // Night Halt Validation for Intercity Car
                if (row.details.mode === 'Intercity Car' && parseFloat(row.details.nightHaltCharges || 0) > 0) {
                    const dep = new Date((row.details.depDate || row.date) + 'T' + (row.timeDetails.boardingTime || '00:00'));
                    const arr = new Date((row.details.arrDate || row.date) + 'T' + (row.timeDetails.actualTime || '23:59'));
                    const diffHours = (arr - dep) / (1000 * 60 * 60);
                    if (diffHours < 8 && row.details.depDate === row.details.arrDate) {
                        showToast(`Item #${rowNum}: Night Halt charges usually apply for overnight journeys or long durations.`, "warning");
                    }
                }
            }

            if (row.nature === 'Local Travel' && row.details.subType === 'Own Car') {
                const curStart = parseFloat(row.details.odoStart || 0);
                const curEnd = parseFloat(row.details.odoEnd || 0);
                if (lastOdoEnd !== -1 && curStart < lastOdoEnd) {
                    showToast(`ODO Continuity Warning: Start ODO (${curStart}) at row #${rowNum} is less than previous End ODO (${lastOdoEnd}).`, "warning");
                }
                lastOdoEnd = curEnd;
            }

            if (row.nature === 'Accommodation') {
                const curIn = new Date((row.details.actualCheckInDate || row.details.checkIn) + 'T' + (row.details.actualCheckInTime || row.details.checkInTime || '00:00'));
                const curOut = new Date((row.details.actualCheckOutDate || row.details.checkOut) + 'T' + (row.details.actualCheckOutTime || row.details.checkOutTime || '23:59'));
                if (lastStayEnd && curIn < lastStayEnd) {
                    showToast(`Accommodation Overlap: Stay at ${row.details.hotelName} starts before previous stay ends.`, "error");
                    return false;
                }
                lastStayEnd = curOut;
            }
        }

        // Refined Meal overlap validation
        for (const foodRow of rows) {
            if (foodRow.nature === 'Food' && foodRow.details.mealCategory === 'Self Meal') {
                const foodTime = foodRow.details.mealTime;
                const foodDate = foodRow.date;
                if (!foodTime || !foodDate) continue;

                for (const travelRow of rows) {
                    if (travelRow.nature === 'Travel' && travelRow.details.mealIncluded === 'Yes') {
                        const depDate = travelRow.details.depDate || travelRow.date;
                        const arrDate = travelRow.details.arrDate || travelRow.date;
                        const depTime = travelRow.timeDetails?.boardingTime;
                        const arrTime = travelRow.timeDetails?.actualTime;

                        if (depDate && arrDate && depTime && arrTime) {
                            try {
                                const foodStart = new Date(`${foodDate}T${foodTime}`);
                                const travelStart = new Date(`${depDate}T${depTime}`);
                                const travelEnd = new Date(`${arrDate}T${arrTime}`);

                                // If food time falls within travel window where meal was provided
                                if (foodStart >= travelStart && foodStart <= travelEnd) {
                                    showToast(`Item #${rows.indexOf(foodRow) + 1}: Meal duplication! You are claiming "${foodRow.details.mealType}" at ${foodTime} but your ${travelRow.details.mode} journey (${travelRow.details.origin} to ${travelRow.details.destination}) already includes meals for this period.`, "error");
                                    return false;
                                }
                            } catch (e) { console.error("Meal overlap calculate error", e); }
                        }
                    }
                }
            }
        }

        setIsSaving(true);
        try {
            // Include ALL rows for the current category so edits to existing rows are also saved.
            // (Unless it's Final Review, where we save all categories).
            const rowsToSave = activeCategory === 'Final Review'
                ? rows
                : rows.filter(r => r.nature === activeCategory);

            if (rowsToSave.length === 0) {
                setIsSaving(false);
                return true;
            }

            for (const row of rowsToSave) {
                const categoryMap = {
                    'Travel': 'Others',
                    'Local Travel': 'Fuel',
                    'Food': 'Food',
                    'Accommodation': 'Accommodation',
                    'Incidental': 'Incidental'
                };

                const filteredDetails = { ...row.details };
                // Remove redundant fields already captured in top-level payload columns
                [
                    'mode', 'classType', 'pnr', 'bookingRef', 'refundable', 'mealIncluded',
                    'subType', 'vehicleType', 'odoStart', 'odoEnd', 'totalKm',
                    'travelStatus', 'cancellationDate', 'refundAmount', 'cancellationReason', 'bookedBy'
                ].forEach(field => delete filteredDetails[field]);

                if (row.nature === 'Local Travel') {
                    const { mode, subType } = row.details;
                    const modeLower = mode ? mode.toLowerCase() : '';
                    const subTypeLower = subType ? subType.toLowerCase() : '';
                    // Remove fields not applicable for current mode/subtype
                    if (modeLower === 'walk') {
                        delete filteredDetails.toll;
                        delete filteredDetails.parking;
                        delete filteredDetails.fuel;
                        delete filteredDetails.odoStart;
                        delete filteredDetails.odoEnd;
                        delete filteredDetails.totalKm;
                    }
                    if (modeLower === 'public transport') {
                        delete filteredDetails.odoStart;
                        delete filteredDetails.odoEnd;
                        delete filteredDetails.fuel;
                        delete filteredDetails.toll;
                        delete filteredDetails.parking;
                    }
                    if (!['own car', 'self drive rental', 'own bike'].map(s => s.toLowerCase()).includes(subTypeLower)) {
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

                if (row.nature === 'Incidental') {
                    const incidentalInvoices = getIncidentalInvoiceNumbers(row);
                    filteredDetails.invoiceNumbers = incidentalInvoices;
                    filteredDetails.invoiceNo = incidentalInvoices[0] || '';
                }

                if (row.nature === 'Travel') {
                    const travelInvoices = getTravelInvoiceNumbers(row);
                    filteredDetails.travelInvoiceNumbers = travelInvoices;
                    filteredDetails.invoiceNo = travelInvoices[0] || '';
                }

                if (row.nature === 'Local Travel') {
                    const localInvoices = getLocalInvoiceNumbers(row);
                    filteredDetails.localInvoiceNumbers = localInvoices;
                    filteredDetails.invoiceNo = localInvoices[0] || '';
                }

                if (row.nature === 'Food') {
                    const foodInvoices = getFoodInvoiceNumbers(row);
                    filteredDetails.foodInvoiceNumbers = foodInvoices;
                    filteredDetails.invoiceNo = foodInvoices[0] || '';
                }

                if (row.nature === 'Accommodation') {
                    const accommodationInvoices = getAccommodationInvoiceNumbers(row);
                    filteredDetails.accommodationInvoiceNumbers = accommodationInvoices;
                    filteredDetails.invoiceNo = accommodationInvoices[0] || '';
                }

                const payload = {
                    trip: tripId,
                    date: row.date,
                    category: categoryMap[row.nature] || 'Others',
                    amount: parseFloat(row.amount || 0),
                    // New Database Fields
                    travel_mode: row.nature === 'Travel' ? row.details.mode : (row.nature === 'Local Travel' ? row.details.mode : null),
                    class_type: row.nature === 'Travel' ? row.details.classType : null,
                    booking_reference: row.nature === 'Travel' ? (row.details.pnr || row.details.bookingRef) : null,
                    refundable_flag: row.nature === 'Travel' ? row.details.refundable === 'Yes' : false,
                    meal_included_flag: row.nature === 'Travel' ? (row.details.mealIncluded === 'Yes' || row.details.mealIncluded === true) : false,
                    vehicle_type: (row.nature === 'Travel' || row.nature === 'Local Travel') ? (row.details.subType || row.details.vehicleType) : null,
                    odo_start: ((row.nature === 'Travel' || row.nature === 'Local Travel') && row.details.odoStart) ? parseFloat(row.details.odoStart) : null,
                    odo_end: ((row.nature === 'Travel' || row.nature === 'Local Travel') && row.details.odoEnd) ? parseFloat(row.details.odoEnd) : null,
                    distance: (row.nature === 'Travel' || row.nature === 'Local Travel') ? parseFloat(row.details.totalKm || 0) : null,
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
                        time: row.timeDetails
                    }),
                    receipt_image: JSON.stringify(row.bills || []),
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

                // Note: We NO LONGER split incidentals into separate standalone records here.
                // They remain inside the description JSON to prevent "disappearing" from cards.
            }

            showToast("Registry committed successfully!", "success");
            if (onUpdate) onUpdate(true);

            setRows(rows.map(r => ({ ...r, isSaved: true })));
            return true;

        } catch (error) {
            console.error("Save error:", error);
            const errorMsg = error.response?.data?.error || error.response?.data?.message || "Failed to commit registry due to a server error.";
            showToast(errorMsg, "error");
            return false;
        } finally {
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
                auditTrail: [],
                bookedBy: 'Self Booked', // Default
                travelStatus: 'Completed',
                checkInTime: '',
                checkOutTime: '',
                selfies: [], // Added for Local Travel
                localIncidentals: targetNature === 'Local Travel' ? [{ type: '', amount: '' }] : []
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
                        // FRONTEND-ONLY WORKAROUND:
                        // Backend ExpenseViewSet omits 'delete' from allowed methods, causing 405.
                        // However, Expense model supports SoftDelete (is_deleted flag).
                        // We use PATCH to set is_deleted: true, which achieves the same result
                        // as the backend filters out is_deleted=True by default.
                        await api.patch(`/api/expenses/${id}/`, { is_deleted: true });
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

    const countWords = (text) => text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
    const isIncidentalOthersType = (value) => (value || '').trim().toLowerCase() === 'others' || (value || '').trim().toLowerCase() === 'other';
    const normalizeMealSource = (value) => (value || '').trim().toLowerCase();
    const getAccommodationInvoiceNumbers = (row) => {
        const storedInvoices = Array.isArray(row.details?.accommodationInvoiceNumbers)
            ? row.details.accommodationInvoiceNumbers
            : (row.details?.invoiceNo ? [row.details.invoiceNo] : []);
        const billCount = (row.bills || []).length;
        if (billCount === 0) return storedInvoices;
        return Array.from({ length: billCount }, (_, index) => storedInvoices[index] || '');
    };

    const syncAccommodationInvoiceNumbers = (row, billCount) => {
        const currentInvoices = getAccommodationInvoiceNumbers(row);
        return Array.from({ length: billCount }, (_, index) => currentInvoices[index] || '');
    };

    const updateAccommodationInvoiceNumber = (id, index, value) => {
        clearRowError(id, `accommodationInvoiceNumber_${index}`);
        setRows(prevRows => prevRows.map(row => {
            if (row.id === id) {
                const accommodationInvoiceNumbers = getAccommodationInvoiceNumbers(row);
                accommodationInvoiceNumbers[index] = value;
                return {
                    ...row,
                    details: {
                        ...row.details,
                        accommodationInvoiceNumbers,
                        invoiceNo: accommodationInvoiceNumbers[0] || ''
                    },
                    isSaved: false
                };
            }
            return row;
        }));
    };

    const getTravelInvoiceNumbers = (row) => {
        const storedInvoices = Array.isArray(row.details?.travelInvoiceNumbers)
            ? row.details.travelInvoiceNumbers
            : (row.details?.invoiceNo ? [row.details.invoiceNo] : []);
        const billCount = (row.bills || []).length;
        if (billCount === 0) return storedInvoices;
        return Array.from({ length: billCount }, (_, index) => storedInvoices[index] || '');
    };

    const calculateJourneyDuration = (depDate, depTime, arrDate, arrTime) => {
        if (!depDate || !depTime || !arrDate || !arrTime) return "N/A";
        try {
            const start = new Date(`${depDate}T${depTime}`);
            const end = new Date(`${arrDate}T${arrTime}`);
            const diffMs = end - start;
            if (diffMs < 0) return "Invalid (Dep > Arr)";
            const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            return `${diffHrs}h ${diffMins}m`;
        } catch (e) {
            return "Error";
        }
    };

    const syncTravelInvoiceNumbers = (row, billCount) => {
        const currentInvoices = getTravelInvoiceNumbers(row);
        return Array.from({ length: billCount }, (_, index) => currentInvoices[index] || '');
    };

    const updateTravelInvoiceNumber = (id, index, value) => {
        clearRowError(id, `travelInvoiceNumber_${index}`);
        setRows(prevRows => prevRows.map(row => {
            if (row.id === id) {
                const travelInvoiceNumbers = getTravelInvoiceNumbers(row);
                travelInvoiceNumbers[index] = value;
                return {
                    ...row,
                    details: {
                        ...row.details,
                        travelInvoiceNumbers,
                        invoiceNo: travelInvoiceNumbers[0] || ''
                    },
                    isSaved: false
                };
            }
            return row;
        }));
    };

    const getFoodInvoiceNumbers = (row) => {
        const storedInvoices = Array.isArray(row.details?.foodInvoiceNumbers)
            ? row.details.foodInvoiceNumbers
            : (row.details?.invoiceNo ? [row.details.invoiceNo] : []);
        const billCount = (row.bills || []).length;
        if (billCount === 0) return storedInvoices;
        return Array.from({ length: billCount }, (_, index) => storedInvoices[index] || '');
    };

    const syncFoodInvoiceNumbers = (row, billCount) => {
        const currentInvoices = getFoodInvoiceNumbers(row);
        return Array.from({ length: billCount }, (_, index) => currentInvoices[index] || '');
    };

    const updateFoodInvoiceNumber = (id, index, value) => {
        clearRowError(id, `foodInvoiceNumber_${index}`);
        setRows(prevRows => prevRows.map(row => {
            if (row.id === id) {
                const foodInvoiceNumbers = getFoodInvoiceNumbers(row);
                foodInvoiceNumbers[index] = value;
                return {
                    ...row,
                    details: {
                        ...row.details,
                        foodInvoiceNumbers,
                        invoiceNo: foodInvoiceNumbers[0] || ''
                    },
                    isSaved: false
                };
            }
            return row;
        }));
    };

    const getLocalInvoiceNumbers = (row) => {
        const storedInvoices = Array.isArray(row.details?.localInvoiceNumbers)
            ? row.details.localInvoiceNumbers
            : (row.details?.invoiceNo ? [row.details.invoiceNo] : []);
        const billCount = (row.bills || []).length;
        if (billCount === 0) return storedInvoices;
        return Array.from({ length: billCount }, (_, index) => storedInvoices[index] || '');
    };

    const syncLocalInvoiceNumbers = (row, billCount) => {
        const currentInvoices = getLocalInvoiceNumbers(row);
        return Array.from({ length: billCount }, (_, index) => currentInvoices[index] || '');
    };

    const updateLocalInvoiceNumber = (id, index, value) => {
        clearRowError(id, `localInvoiceNumber_${index}`);
        setRows(prevRows => prevRows.map(row => {
            if (row.id === id) {
                const localInvoiceNumbers = getLocalInvoiceNumbers(row);
                localInvoiceNumbers[index] = value;
                return {
                    ...row,
                    details: {
                        ...row.details,
                        localInvoiceNumbers,
                        invoiceNo: localInvoiceNumbers[0] || ''
                    },
                    isSaved: false
                };
            }
            return row;
        }));
    };

    const getIncidentalInvoiceNumbers = (row) => {
        const storedInvoices = Array.isArray(row.details?.invoiceNumbers)
            ? row.details.invoiceNumbers
            : (row.details?.invoiceNo ? [row.details.invoiceNo] : []);
        const billCount = (row.bills || []).length;
        if (billCount === 0) return storedInvoices;
        return Array.from({ length: billCount }, (_, index) => storedInvoices[index] || '');
    };

    const syncIncidentalInvoiceNumbers = (row, billCount) => {
        const currentInvoices = getIncidentalInvoiceNumbers(row);
        return Array.from({ length: billCount }, (_, index) => currentInvoices[index] || '');
    };

    const updateIncidentalInvoiceNumber = (id, index, value) => {
        clearRowError(id, `invoiceNumber_${index}`);
        setRows(prevRows => prevRows.map(row => {
            if (row.id === id) {
                const invoiceNumbers = getIncidentalInvoiceNumbers(row);
                invoiceNumbers[index] = value;
                return {
                    ...row,
                    details: {
                        ...row.details,
                        invoiceNumbers,
                        invoiceNo: invoiceNumbers[0] || ''
                    },
                    isSaved: false
                };
            }
            return row;
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

    const addLocalIncidental = (rowId) => {
        setRows(currentRows => currentRows.map(r => {
            if (r.id === rowId) {
                const currentList = r.details.localIncidentals || [];
                const newList = [...currentList, { type: '', amount: '' }];
                // Recalculate total
                const fuelAmt = parseFloat(r.details.fuelAmount || 0);
                const tollAmt = parseFloat(r.details.tollAmount || 0);
                const itemizedSum = newList.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                const total = (fuelAmt + tollAmt + itemizedSum).toFixed(2);
                return { ...r, amount: total, isSaved: false, details: { ...r.details, localIncidentals: newList } };
            }
            return r;
        }));
    };

    const updateLocalIncidental = (rowId, index, field, value) => {
        setRows(currentRows => currentRows.map(r => {
            if (r.id === rowId) {
                const newList = [...(r.details.localIncidentals || [])];
                newList[index] = { ...newList[index], [field]: value };
                if (field === 'type' && value === 'Fuel') {
                    newList[index].amount = r.details.fuelAmount || '0.00';
                }
                if (field === 'type' && value === 'Toll Charges') {
                    newList[index].amount = r.details.tollAmount || '0.00';
                }
                const fuelAmt = parseFloat(r.details.fuelAmount || 0);
                const tollAmt = parseFloat(r.details.tollAmount || 0);
                const itemizedSum = newList.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                const total = (fuelAmt + tollAmt + itemizedSum).toFixed(2);
                return { ...r, amount: total, isSaved: false, details: { ...r.details, localIncidentals: newList } };
            }
            return r;
        }));
    };

    const deleteLocalIncidental = (rowId, index) => {
        setRows(currentRows => currentRows.map(r => {
            if (r.id === rowId) {
                const newList = (r.details.localIncidentals || []).filter((_, i) => i !== index);
                const fuelAmt = parseFloat(r.details.fuelAmount || 0);
                const tollAmt = parseFloat(r.details.tollAmount || 0);
                const itemizedSum = newList.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                const total = (fuelAmt + tollAmt + itemizedSum).toFixed(2);
                return { ...r, amount: total, isSaved: false, details: { ...r.details, localIncidentals: newList } };
            }
            return r;
        }));
    };

    const addTravelIncidental = (rowId) => {
        setRows(currentRows => currentRows.map(r => {
            if (r.id === rowId) {
                const currentList = r.details.travelIncidentals || [];
                const newList = [...currentList, { type: '', amount: '' }];
                // Recalculate total
                const ticketAmt = parseFloat(r.details.ticketAmount || 0);
                const itemizedSum = newList.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                const total = (ticketAmt + itemizedSum).toFixed(2);
                return { ...r, amount: total, isSaved: false, details: { ...r.details, travelIncidentals: newList } };
            }
            return r;
        }));
    };

    const updateTravelIncidental = (rowId, index, field, value) => {
        setRows(currentRows => currentRows.map(r => {
            if (r.id === rowId) {
                const newList = [...(r.details.travelIncidentals || [])];
                newList[index] = { ...newList[index], [field]: value };
                const ticketAmt = parseFloat(r.details.ticketAmount || 0);
                const itemizedSum = newList.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                const total = (ticketAmt + itemizedSum).toFixed(2);
                return { ...r, amount: total, isSaved: false, details: { ...r.details, travelIncidentals: newList } };
            }
            return r;
        }));
    };

    const deleteTravelIncidental = (rowId, index) => {
        setRows(currentRows => currentRows.map(r => {
            if (r.id === rowId) {
                const newList = (r.details.travelIncidentals || []).filter((_, i) => i !== index);
                const ticketAmt = parseFloat(r.details.ticketAmount || 0);
                const itemizedSum = newList.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                const total = (ticketAmt + itemizedSum).toFixed(2);
                return { ...r, amount: total, isSaved: false, details: { ...r.details, travelIncidentals: newList } };
            }
            return r;
        }));
    };

    const lookupTollAmount = async (rowId, from, to) => {
        try {
            const res = await api.get(`/api/travel-masters/routes/lookup_toll/?source=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travel_mode=4%20Wheeler`);
            if (res.data && res.data.total_toll !== undefined) {
                setRows(currentRows => currentRows.map(r => {
                    if (r.id === rowId) {
                        const fuelAmt = parseFloat(r.details.fuelAmount || 0);
                        const tollAmt = parseFloat(res.data.total_toll);
                        const itemizedSum = (r.details.localIncidentals || []).reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                        const totalAmt = (fuelAmt + tollAmt + itemizedSum).toFixed(2);

                        const updatedIncidentals = (r.details.localIncidentals || []).map(inc => {
                            if (inc.type === 'Toll Charges') return { ...inc, amount: res.data.total_toll };
                            return inc;
                        });

                        return {
                            ...r,
                            amount: totalAmt,
                            details: {
                                ...r.details,
                                tollAmount: res.data.total_toll,
                                tollBreakdown: res.data.gates,
                                isTollAutofilled: res.data.total_toll > 0,
                                localIncidentals: updatedIncidentals
                            }
                        };
                    }
                    return r;
                }));
            }
        } catch (e) { console.error("Toll lookup failed", e); }
    };

    const handleLocationSearch = async (text) => {
        if (!text || text.trim().length < 2) { setLocationSuggestions([]); return; }
        try {
            const res = await api.get(`/api/masters/locations/live_query/?search=${encodeURIComponent(text)}`);
            if (res.data) setLocationSuggestions(res.data);
        } catch (e) { console.error("Search failed", e); }
    };

    const updateDetails = (id, detailField, value) => {
        clearRowError(id, detailField);

        // --- TOLL LOOKUP TRIGGER ---
        const currentRow = rows.find(r => r.id === id);
        if (currentRow && currentRow.nature === 'Local Travel' && ['origin', 'destination', 'mode', 'subType'].includes(detailField)) {
            const from = detailField === 'origin' ? value : (currentRow.details.origin || '');
            const to = detailField === 'destination' ? value : (currentRow.details.destination || '');
            const mode = detailField === 'mode' ? value : (currentRow.details.mode || '');
            const subType = detailField === 'subType' ? value : (currentRow.details.subType || '');

            if (from.trim().length > 2 && to.trim().length > 2 && mode.toLowerCase() === 'car' && ['Own Car', 'Company Car'].map(s => s.toLowerCase()).includes(subType.toLowerCase())) {
                lookupTollAmount(id, from.trim(), to.trim());
            }
        }

        setRows(prevRows => prevRows.map(row => {
            if (row.id === id) {
                let updatedAmount = row.amount;
                let updatedDate = row.date;

                // Rule: If switching to Company Booked, force amount to 0
                if (detailField === 'bookedBy' && value === 'Company Booked' && row.nature === 'Travel') {
                    updatedAmount = '0';
                }

                const newDetails = { ...row.details, [detailField]: value };

                if (row.nature === 'Incidental' && detailField === 'incidentalType' && !isIncidentalOthersType(value)) {
                    newDetails.otherReason = '';
                }

                if (row.nature === 'Food' && detailField === 'mealCategory') {
                    if (value !== 'Self Meal') {
                        newDetails.mealSource = '';
                        newDetails.provider = '';
                        newDetails.hotelName = '';
                        newDetails.restaurant = '';
                        updatedAmount = '0';
                    } else if (!row.amount || parseFloat(row.amount || 0) === 0) {
                        updatedAmount = '';
                    }
                }

                if (row.nature === 'Food' && detailField === 'mealSource') {
                    const normalizedSource = normalizeMealSource(value);
                    if (normalizedSource !== 'online') {
                        newDetails.provider = '';
                    }
                    if (!['hotel', 'online'].includes(normalizedSource)) {
                        newDetails.hotelName = '';
                    }
                    if (normalizedSource !== 'restaurant') {
                        newDetails.restaurant = '';
                    }
                }

                if (detailField === 'odoStart' || detailField === 'odoEnd' || detailField === 'subType') {
                    const start = parseFloat(newDetails.odoStart || 0);
                    const end = parseFloat(newDetails.odoEnd || 0);
                    newDetails.totalKm = end >= start ? (end - start).toFixed(2) : 0;

                    // KM Reimbursement for Own vehicles based on state rates
                    if (row.nature === 'Local Travel' && ['Own Car', 'Own Bike'].includes(newDetails.subType)) {
                        const is4W = newDetails.subType === 'Own Car';
                        const vehicleKey = is4W ? '4 Wheeler' : '2 Wheeler';
                        const rate = fuelRates[vehicleKey];

                        // Only auto-calc if we have a valid distance and a rate
                        if (!isNaN(start) && !isNaN(end) && end > start && rate) {
                            const distKm = end - start;
                            const fuelAmt = (distKm * rate).toFixed(2);
                            newDetails.fuelAmount = fuelAmt; // Save fuel separately
                            newDetails.isAutoCalculated = true;

                            if (newDetails.localIncidentals) {
                                newDetails.localIncidentals = newDetails.localIncidentals.map(inc => {
                                    if (inc.type === 'Fuel') return { ...inc, amount: fuelAmt };
                                    return inc;
                                });
                            }

                            // Include Toll and Incidentals if they exist
                            const tollAmt = parseFloat(newDetails.tollAmount || 0);
                            const itemizedSum = (newDetails.localIncidentals || []).reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                            updatedAmount = (parseFloat(fuelAmt) + tollAmt + itemizedSum).toFixed(2);
                        }
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

                if (['scheduledCheckInDate', 'scheduledCheckOutDate', 'actualCheckInDate', 'actualCheckOutDate'].includes(detailField)) {
                    const checkInDate = newDetails.actualCheckInDate || newDetails.scheduledCheckInDate;
                    const checkOutDate = newDetails.actualCheckOutDate || newDetails.scheduledCheckOutDate;
                    newDetails.checkIn = checkInDate || '';
                    newDetails.checkOut = checkOutDate || '';
                    if (checkInDate) updatedDate = checkInDate;

                    if (checkInDate && checkOutDate) {
                        const start = new Date(checkInDate);
                        const end = new Date(checkOutDate);
                        const diffMs = end - start;
                        newDetails.nights = diffMs >= 0 ? Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24))) : 0;
                    } else {
                        newDetails.nights = 0;
                    }
                }

                if (['scheduledCheckInTime', 'scheduledCheckOutTime', 'actualCheckInTime', 'actualCheckOutTime'].includes(detailField)) {
                    newDetails.checkInTime = newDetails.actualCheckInTime || newDetails.scheduledCheckInTime || '';
                    newDetails.checkOutTime = newDetails.actualCheckOutTime || newDetails.scheduledCheckOutTime || '';
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

                if (row.nature === 'Travel' && newDetails.bookedBy !== 'Company Booked') {
                    const ticketAmt = parseFloat(newDetails.ticketAmount || 0);
                    const itemizedSum = (newDetails.travelIncidentals || []).reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                    updatedAmount = (ticketAmt + itemizedSum).toFixed(2);
                } else if (row.nature === 'Local Travel') {
                    // Only auto-calculate amount if it's an auto-calculated sub-type (Own vehicle, etc.)
                    // Non-auto-calc modes (Auto, PT, Cab) use the manually entered row.amount
                    const isAutoCalc = ['Own Car', 'Company Car', 'Own Bike', 'Self Drive Rental', 'Company Bike'].includes(newDetails.subType);
                    if (isAutoCalc) {
                        const fuelAmt = parseFloat(newDetails.fuelAmount || 0);
                        const tollAmt = parseFloat(newDetails.tollAmount || 0);
                        const itemizedSum = (newDetails.localIncidentals || []).reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                        updatedAmount = (fuelAmt + tollAmt + itemizedSum).toFixed(2);
                    }
                }

                return { ...row, date: updatedDate, details: newDetails, amount: updatedAmount, isSaved: false };
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

                if (timeField === 'boardingTime' || timeField === 'scheduledDepTime') {
                    const scheduled = newTimeDetails.scheduledDepTime;
                    const actual = newTimeDetails.boardingTime;
                    if (scheduled && actual) {
                        try {
                            const [sH, sM] = scheduled.split(':').map(Number);
                            const [aH, aM] = actual.split(':').map(Number);
                            const sDate = new Date();
                            sDate.setHours(sH, sM, 0);
                            const aDate = new Date();
                            aDate.setHours(aH, aM, 0);

                            if (aDate < sDate) aDate.setDate(aDate.getDate() + 1);

                            const diffMin = Math.round((aDate - sDate) / (1000 * 60));
                            newTimeDetails.delay = diffMin >= 0 ? diffMin : 0;
                        } catch (e) { }
                    } else {
                        newTimeDetails.delay = 0;
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
    }; const handleFileUpload = (id, files) => {
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB

        const validFiles = Array.from(files || []).filter(file => {
            if (!ALLOWED_TYPES.includes(file.type)) {
                showToast(`File "${file.name}" is not allowed. Only JPG, PNG, and PDF are permitted.`, "error");
                return false;
            }
            if (file.size > MAX_SIZE) {
                showToast(`File "${file.name}" exceeds the 5MB limit.`, "error");
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) return;

        Promise.all(validFiles.map(file => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ name: file.name, data: reader.result });
            reader.readAsDataURL(file);
        }))).then((newFiles) => {
            setRows(prevRows => {
                const newBillData = newFiles.map(f => f.data);

                return prevRows.map(row => {
                    if (row.id === id) {
                        const currentBills = row.bills || [];
                        // Still prevent duplicates within the SAME row to avoid UI clutter
                        const filteredNewBills = newBillData.filter(data => !currentBills.includes(data));
                        const nextBills = [...currentBills, ...filteredNewBills];

                        if (row.nature === 'Travel') {
                            const travelInvoiceNumbers = syncTravelInvoiceNumbers(row, nextBills.length);
                            return {
                                ...row,
                                bills: nextBills,
                                details: {
                                    ...row.details,
                                    travelInvoiceNumbers,
                                    invoiceNo: travelInvoiceNumbers[0] || ''
                                },
                                isSaved: false
                            };
                        }
                        if (row.nature === 'Local Travel') {
                            const localInvoiceNumbers = syncLocalInvoiceNumbers(row, nextBills.length);
                            return {
                                ...row,
                                bills: nextBills,
                                details: {
                                    ...row.details,
                                    localInvoiceNumbers,
                                    invoiceNo: localInvoiceNumbers[0] || ''
                                },
                                isSaved: false
                            };
                        }
                        if (row.nature === 'Food') {
                            const foodInvoiceNumbers = syncFoodInvoiceNumbers(row, nextBills.length);
                            return {
                                ...row,
                                bills: nextBills,
                                details: {
                                    ...row.details,
                                    foodInvoiceNumbers,
                                    invoiceNo: foodInvoiceNumbers[0] || ''
                                },
                                isSaved: false
                            };
                        }
                        if (row.nature === 'Incidental') {
                            const invoiceNumbers = syncIncidentalInvoiceNumbers(row, nextBills.length);
                            return {
                                ...row,
                                bills: nextBills,
                                details: {
                                    ...row.details,
                                    invoiceNumbers,
                                    invoiceNo: invoiceNumbers[0] || ''
                                },
                                isSaved: false
                            };
                        }
                        if (row.nature === 'Accommodation') {
                            const accommodationInvoiceNumbers = syncAccommodationInvoiceNumbers(row, nextBills.length);
                            return {
                                ...row,
                                bills: nextBills,
                                details: {
                                    ...row.details,
                                    accommodationInvoiceNumbers,
                                    invoiceNo: accommodationInvoiceNumbers[0] || ''
                                },
                                isSaved: false
                            };
                        }
                        return { ...row, bills: nextBills, isSaved: false };
                    }
                    return row;
                });
            });
        });
    };

    const removeBill = (rowId, index) => {
        setRows(prevRows => prevRows.map(row => {
            if (row.id === rowId) {
                const newBills = [...(row.bills || [])];
                newBills.splice(index, 1);
                if (row.nature === 'Travel') {
                    const currentInvoices = getTravelInvoiceNumbers(row);
                    currentInvoices.splice(index, 1);
                    const travelInvoiceNumbers = Array.from({ length: newBills.length }, (_, invoiceIndex) => currentInvoices[invoiceIndex] || '');
                    return {
                        ...row,
                        bills: newBills,
                        details: {
                            ...row.details,
                            travelInvoiceNumbers,
                            invoiceNo: travelInvoiceNumbers[0] || ''
                        },
                        isSaved: false
                    };
                }
                if (row.nature === 'Local Travel') {
                    const currentInvoices = getLocalInvoiceNumbers(row);
                    currentInvoices.splice(index, 1);
                    const localInvoiceNumbers = Array.from({ length: newBills.length }, (_, invoiceIndex) => currentInvoices[invoiceIndex] || '');
                    return {
                        ...row,
                        bills: newBills,
                        details: {
                            ...row.details,
                            localInvoiceNumbers,
                            invoiceNo: localInvoiceNumbers[0] || ''
                        },
                        isSaved: false
                    };
                }
                if (row.nature === 'Food') {
                    const currentInvoices = getFoodInvoiceNumbers(row);
                    currentInvoices.splice(index, 1);
                    const foodInvoiceNumbers = Array.from({ length: newBills.length }, (_, invoiceIndex) => currentInvoices[invoiceIndex] || '');
                    return {
                        ...row,
                        bills: newBills,
                        details: {
                            ...row.details,
                            foodInvoiceNumbers,
                            invoiceNo: foodInvoiceNumbers[0] || ''
                        },
                        isSaved: false
                    };
                }
                if (row.nature === 'Incidental') {
                    const currentInvoices = getIncidentalInvoiceNumbers(row);
                    currentInvoices.splice(index, 1);
                    const invoiceNumbers = Array.from({ length: newBills.length }, (_, invoiceIndex) => currentInvoices[invoiceIndex] || '');
                    return {
                        ...row,
                        bills: newBills,
                        details: {
                            ...row.details,
                            invoiceNumbers,
                            invoiceNo: invoiceNumbers[0] || ''
                        },
                        isSaved: false
                    };
                }
                if (row.nature === 'Accommodation') {
                    const currentInvoices = getAccommodationInvoiceNumbers(row);
                    currentInvoices.splice(index, 1);
                    const accommodationInvoiceNumbers = Array.from({ length: newBills.length }, (_, invoiceIndex) => currentInvoices[invoiceIndex] || '');
                    return {
                        ...row,
                        bills: newBills,
                        details: {
                            ...row.details,
                            accommodationInvoiceNumbers,
                            invoiceNo: accommodationInvoiceNumbers[0] || ''
                        },
                        isSaved: false
                    };
                }
                return { ...row, bills: newBills, isSaved: false };
            }
            return row;
        }));
    };

    const previewBill = (bill) => {
        if (!bill) return;
        const src = (bill.startsWith('data:') || bill.startsWith('http')) ? bill : `data:image/jpeg;base64,${bill}`;
        const newWindow = window.open();
        newWindow.document.write(`<img src="${src}" style="max-width:100%; height:auto;" />`);
    };

    const renderIncidentalCard = (row) => {
        const invoiceNumbers = getIncidentalInvoiceNumbers(row);

        return (
            <tr key={row.id} className="category-row-block incidental-card-row">
                <td>
                    <div className="incidental-entry-shell">
                        <div className="incidental-entry-header">
                            <div className="incidental-entry-title">
                                <Receipt size={16} />
                                <div>
                                    <strong>Incidental Expense Entry</strong>
                                    <span>Card-based entry for cleaner expense capture</span>
                                </div>
                            </div>
                            {!isLocked && (
                                <button className="row-del-btn" onClick={() => deleteRow(row.id)} title="Delete row">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>

                        <div className="incidental-card-grid">
                            <div className="incidental-form-card">
                                <div className="incidental-card-head">
                                    <Calendar size={14} />
                                    <span>Date &amp; Time</span>
                                </div>
                                <div className="incidental-card-body incidental-date-time-stack">
                                    <div className="input-with-label-mini">
                                        <label>Date *</label>
                                        <input type="date" min={minDate} max={maxDate} className="cat-input" value={row.date || ''} onChange={e => updateRow(row.id, 'date', e.target.value)} disabled={isLocked} />
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>Time *</label>
                                        <input type="time" className="cat-input" value={row.details.incidentalTime || ''} onChange={e => updateDetails(row.id, 'incidentalTime', e.target.value)} disabled={isLocked} />
                                    </div>
                                </div>
                            </div>

                            <div className="incidental-form-card">
                                <div className="incidental-card-head">
                                    <MapPin size={14} />
                                    <span>Expense Type &amp; Location</span>
                                </div>
                                <div className="incidental-card-body">
                                    <div className="input-with-label-mini">
                                        <label>Expense Type *</label>
                                        <select className="cat-input" value={row.details.incidentalType || ''} onChange={e => updateDetails(row.id, 'incidentalType', e.target.value)} disabled={isLocked}>
                                            <option value="">Select Type</option>
                                            {generalIncidentalTypes.filter(t => !['Porter Charges', 'Porter'].includes(t) || hasAdditionalLuggage).map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>Location *</label>
                                        <input type="text" className="cat-input" placeholder="Enter expense location" value={row.details.location || ''} onChange={e => updateDetails(row.id, 'location', e.target.value)} disabled={isLocked} />
                                    </div>
                                </div>
                            </div>

                            <div className="incidental-form-card">
                                <div className="incidental-card-head">
                                    <FileText size={14} />
                                    <span>Remarks / Details</span>
                                </div>
                                <div className="incidental-card-body">
                                    {isIncidentalOthersType(row.details.incidentalType) && (
                                        <div className="incidental-others-stack">
                                            <div className="input-with-label-mini">
                                                <label>Reason *</label>
                                                <textarea className="cat-input incidental-textarea" placeholder="Enter the reason" value={row.details.otherReason || ''} onChange={e => updateDetails(row.id, 'otherReason', e.target.value)} disabled={isLocked} />
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Remarks *</label>
                                                <textarea className="cat-input incidental-textarea" placeholder="Enter remarks" value={row.details.notes || ''} onChange={e => updateDetails(row.id, 'notes', e.target.value)} disabled={isLocked} />
                                            </div>
                                        </div>
                                    )}
                                    {!isIncidentalOthersType(row.details.incidentalType) && (
                                        <div className="input-with-label-mini">
                                            <label>Remarks</label>
                                            <input type="text" className="cat-input" placeholder="Add a short note" value={row.details.notes || ''} onChange={e => updateDetails(row.id, 'notes', e.target.value)} disabled={isLocked} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="incidental-form-card incidental-amount-card">
                                <div className="incidental-card-head">
                                    <IndianRupee size={14} />
                                    <span>Expense</span>
                                </div>
                                <div className="incidental-card-body">
                                    <div className="input-with-label-mini">
                                        <label>Amount *</label>
                                        <div className="amount-with-currency">
                                            <span className="currency-symbol">₹</span>
                                            <input
                                                type="text"
                                                className={`cat-input ${errors[row.id]?.amount ? 'error' : ''}`}
                                                placeholder="0.00"
                                                value={row.amount || ''}
                                                onChange={e => {
                                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                                    if (!/^\d*\.?\d{0,2}$/.test(val)) return;
                                                    updateRow(row.id, 'amount', val);
                                                }}
                                                disabled={isLocked}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="incidental-form-card incidental-upload-card">
                                <div className="incidental-card-head">
                                    <Upload size={14} />
                                    <span>Upload</span>
                                </div>
                                <div className="incidental-card-body">
                                    <div className="incidental-upload-top">
                                        {!isLocked && (
                                            <label className="incidental-upload-btn" htmlFor={`f-${row.id}`}>
                                                <Upload size={14} />
                                                <span>Upload Bills</span>
                                            </label>
                                        )}
                                        <input
                                            type="file"
                                            id={`f-${row.id}`}
                                            hidden
                                            multiple
                                            accept="image/*,.pdf"
                                            onChange={e => {
                                                handleFileUpload(row.id, e.target.files);
                                                e.target.value = '';
                                            }}
                                        />
                                        <span className="incidental-upload-count">
                                            {(row.bills || []).length > 0 ? `${(row.bills || []).length} file(s) attached` : 'No files attached'}
                                        </span>
                                    </div>

                                    {(row.bills || []).length > 0 && (
                                        <div className="incidental-upload-list">
                                            {row.bills.map((bill, idx) => (
                                                <div key={idx} className="incidental-upload-item">
                                                    <button type="button" className="incidental-upload-preview" onClick={() => previewBill(bill)}>
                                                        <FileText size={14} />
                                                        <span>Bill {idx + 1}</span>
                                                    </button>
                                                    {!isLocked && (
                                                        <button type="button" className="incidental-upload-remove" onClick={() => removeBill(row.id, idx)}>
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        );
    };

    const renderTravelCard = (row) => {
        const travelInvoiceNumbers = getTravelInvoiceNumbers(row);
        const mode = row.details.mode || '';

        // Filter ticket statuses by travel mode
        const relevantTicketStatuses = (ticketStatusOptions || []).filter(item => {
            if (mode === 'Flight') return !!item.is_flight;
            if (mode === 'Train') return !!item.is_train;
            if (mode === 'Intercity Bus') return !!item.is_bus;
            if (mode === 'Intercity Cab') return !!item.is_intercity_cab;
            return false;
        }).map(item => toTitleCase(item.status_name));
        const providerOptions = mode === 'Flight'
            ? flightProviders
            : mode === 'Train'
                ? trainProviders
                : mode === 'Intercity Bus'
                    ? busProviders
                    : mode === 'Intercity Cab'
                        ? cabProviders
                        : travelProviders;
        const classOptions = mode === 'Flight'
            ? flightClasses
            : mode === 'Train'
                ? trainClasses
                : mode === 'Intercity Bus'
                    ? busSeatTypes
                    : [];
        const journeyNumberLabel = mode === 'Flight' ? 'Flight Number' : mode === 'Train' ? 'Train Number' : 'Journey Number';
        const carrierLabel = mode === 'Train' ? 'Train Name' : mode === 'Intercity Bus' ? 'Bus Operator' : 'Carrier Name';

        return (
            <tr key={row.id} className="category-row-block incidental-card-row">
                <td>
                    <div className="incidental-entry-shell travel-entry-shell">
                        <div className="incidental-entry-header">
                            <div className="incidental-entry-title">
                                <Plane size={16} />
                                <div>
                                    <strong>Long Distance Travel Entry</strong>
                                    <span>Card-based travel entry for cleaner journey capture</span>
                                </div>
                            </div>
                            {!isLocked && (
                                <button className="row-del-btn" onClick={() => deleteRow(row.id)} title="Delete row">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>

                        <div className="incidental-card-grid travel-grid-layout">
                            {/* 1. Mode & Booking */}
                            <div className="incidental-form-card travel-card-mode">
                                <div className="incidental-card-head">
                                    <Receipt size={14} />
                                    <span>Mode &amp; Booking</span>
                                </div>
                                <div className="incidental-card-body">
                                    <div className="input-with-label-mini">
                                        <label>Mode *</label>
                                        <select className="cat-input" value={row.details.mode || ''} onChange={e => {
                                            updateDetails(row.id, 'mode', e.target.value);
                                            updateDetails(row.id, 'provider', '');
                                            updateDetails(row.id, 'classType', '');
                                        }} disabled={isLocked}>
                                            <option value="">Select Mode</option>
                                            {travelModes.map(option => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>Booked By *</label>
                                        <select className="cat-input" value={row.details.bookedBy || 'Self Booked'} onChange={e => {
                                            updateDetails(row.id, 'bookedBy', e.target.value);
                                            if (e.target.value === 'Company Booked') {
                                                updateRow(row.id, 'amount', '0.00');
                                            }
                                        }} disabled={isLocked}>
                                            {bookedByOptions.map(option => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            {/* 2. Booking Details */}
                            <div className="incidental-form-card travel-card-booking">
                                <div className="incidental-card-head">
                                    <Calendar size={14} />
                                    <span>Booking Details</span>
                                </div>
                                <div className="incidental-card-body incidental-date-time-stack">
                                    <div className="input-with-label-mini">
                                        <label>Booking Date *</label>
                                        <input type="date" min={minDate} max={maxDate} className="cat-input" value={row.date || ''} onChange={e => updateRow(row.id, 'date', e.target.value)} disabled={isLocked} />
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>Booking Time</label>
                                        <input type="time" className="cat-input" value={row.details.bookingTime || ''} onChange={e => updateDetails(row.id, 'bookingTime', e.target.value)} disabled={isLocked} />
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>Booking ID {row.details.bookedBy === 'Agent' ? '*' : ''}</label>
                                        <input type="text" className="cat-input" placeholder="Enter Booking ID" value={row.details.bookingId || ''} onChange={e => updateDetails(row.id, 'bookingId', e.target.value)} disabled={isLocked} />
                                    </div>
                                </div>
                            </div>
                            {/* 3. Route Details */}
                            <div className="incidental-form-card travel-card-route">
                                <div className="incidental-card-head">
                                    <MapPin size={14} />
                                    <span>Route Details</span>
                                </div>
                                <div className="incidental-card-body">
                                    <div className="input-with-label-mini">
                                        <label>From *</label>
                                        <SearchableLocationSelect
                                            placeholder="Select Starting Location..."
                                            options={locationsPool}
                                            value={row.details.origin || ''}
                                            onSelect={(val) => updateDetails(row.id, 'origin', val)}
                                            disabled={isLocked}
                                            showCode={true}
                                            icon={MapPin}
                                        />
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>To *</label>
                                        <SearchableLocationSelect
                                            placeholder="Select Final Destination..."
                                            options={locationsPool}
                                            value={row.details.destination || ''}
                                            onSelect={(val) => updateDetails(row.id, 'destination', val)}
                                            disabled={isLocked}
                                            showCode={true}
                                            icon={MapPin}
                                        />
                                    </div>
                                    {['Train', 'Intercity Bus', 'Intercity Cab'].includes(mode) && (
                                        <div className="input-with-label-mini">
                                            <label>Boarding Point</label>
                                            <input type="text" className="cat-input" placeholder="Enter boarding point" value={row.details.boardingPoint || ''} onChange={e => updateDetails(row.id, 'boardingPoint', e.target.value)} disabled={isLocked} />
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* 4. Travel Details (Dynamic) */}
                            <div className="incidental-form-card travel-card-details">
                                <div className="incidental-card-head">
                                    <Plane size={14} />
                                    <span>Travel Details</span>
                                </div>
                                <div className="incidental-card-body">
                                    {mode === 'Intercity Cab' && (
                                        <div className="input-with-label-mini">
                                            <label>Provider / Agent</label>
                                            <select className="cat-input" value={row.details.provider || ''} onChange={e => updateDetails(row.id, 'provider', e.target.value)} disabled={isLocked || providerOptions.length === 0}>
                                                <option value="">{providerOptions.length === 0 ? 'No Providers' : 'Select Provider'}</option>
                                                {providerOptions.map(option => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    {mode === 'Train' && (
                                        <>
                                            <div className="input-with-label-mini">
                                                <label>Train Name</label>
                                                <input type="text" className="cat-input" placeholder="Enter Train Name" value={row.details.carrier || ''} onChange={e => updateDetails(row.id, 'carrier', e.target.value)} disabled={isLocked} />
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Ticket Status</label>
                                                <select className="cat-input" value={row.details.ticketStatus || ''} onChange={e => updateDetails(row.id, 'ticketStatus', e.target.value)} disabled={isLocked}>
                                                    <option value="">Select Status</option>
                                                    {relevantTicketStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Class *</label>
                                                <select className="cat-input" value={row.details.classType || ''} onChange={e => updateDetails(row.id, 'classType', e.target.value)} disabled={isLocked}>
                                                    <option value="">Select Class</option>
                                                    {trainClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Coach & Seat</label>
                                                <input type="text" className="cat-input" placeholder="e.g. B1, 24" value={row.details.seatNumber || ''} onChange={e => updateDetails(row.id, 'seatNumber', e.target.value)} disabled={isLocked} />
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Quota Type</label>
                                                <select className="cat-input" value={row.details.quotaType || ''} onChange={e => updateDetails(row.id, 'quotaType', e.target.value)} disabled={isLocked}>
                                                    <option value="">Select Quota</option>
                                                    {(quotaTypeOptions || []).map(q => <option key={q.id || q.quota_name} value={q.quota_name}>{toTitleCase(q.quota_name)}</option>)}
                                                </select>
                                            </div>
                                        </>
                                    )}
                                    {mode === 'Flight' && (
                                        <>
                                            <div className="input-with-label-mini">
                                                <label>Airline Name</label>
                                                <select className="cat-input" value={row.details.carrier || ''} onChange={e => updateDetails(row.id, 'carrier', e.target.value)} disabled={isLocked || airlines.length === 0}>
                                                    <option value="">{airlines.length === 0 ? 'No Airlines' : 'Select Airline'}</option>
                                                    {airlines.map(option => <option key={option} value={option}>{option}</option>)}
                                                </select>
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Flight Number *</label>
                                                <input type="text" className="cat-input" placeholder="Enter Flight No." value={row.details.travelNo || ''} onChange={e => updateDetails(row.id, 'travelNo', e.target.value)} disabled={isLocked} />
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Class *</label>
                                                <select className="cat-input" value={row.details.classType || ''} onChange={e => updateDetails(row.id, 'classType', e.target.value)} disabled={isLocked}>
                                                    <option value="">Select Class</option>
                                                    {flightClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Ticket Status</label>
                                                <select className="cat-input" value={row.details.ticketStatus || ''} onChange={e => updateDetails(row.id, 'ticketStatus', e.target.value)} disabled={isLocked}>
                                                    <option value="">Select Status</option>
                                                    {relevantTicketStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Seat Number</label>
                                                <input type="text" className="cat-input" placeholder="e.g. 12A" value={row.details.seatNumber || ''} onChange={e => updateDetails(row.id, 'seatNumber', e.target.value)} disabled={isLocked} />
                                            </div>
                                        </>
                                    )}
                                    {mode === 'Intercity Bus' && (
                                        <>
                                            <div className="input-with-label-mini">
                                                <label>Operator Name</label>
                                                <select className="cat-input" value={row.details.carrier || ''} onChange={e => updateDetails(row.id, 'carrier', e.target.value)} disabled={isLocked}>
                                                    <option value="">Select Operator</option>
                                                    {(busOperators || []).map(option => <option key={option} value={option}>{option}</option>)}
                                                </select>
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Bus Type *</label>
                                                <select className="cat-input" value={row.details.classType || ''} onChange={e => updateDetails(row.id, 'classType', e.target.value)} disabled={isLocked}>
                                                    <option value="">Select Type</option>
                                                    {busSeatTypes.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Ticket Status</label>
                                                <select className="cat-input" value={row.details.ticketStatus || ''} onChange={e => updateDetails(row.id, 'ticketStatus', e.target.value)} disabled={isLocked}>
                                                    <option value="">Select Status</option>
                                                    {relevantTicketStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Seat Number</label>
                                                <input type="text" className="cat-input" placeholder="e.g. 15" value={row.details.seatNumber || ''} onChange={e => updateDetails(row.id, 'seatNumber', e.target.value)} disabled={isLocked} />
                                            </div>
                                        </>
                                    )}
                                    {mode === 'Intercity Cab' && (
                                        <>
                                            <div className="input-with-label-mini">
                                                <label>Cab Type</label>
                                                <select className="cat-input" value={row.details.vehicleType || ''} onChange={e => updateDetails(row.id, 'vehicleType', e.target.value)} disabled={isLocked}>
                                                    <option value="">Select Type</option>
                                                    {(intercityCabVehicleTypes || []).map(v => <option key={v} value={v}>{v}</option>)}
                                                </select>
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Ticket Status</label>
                                                <select className="cat-input" value={row.details.ticketStatus || ''} onChange={e => updateDetails(row.id, 'ticketStatus', e.target.value)} disabled={isLocked}>
                                                    <option value="">Select Status</option>
                                                    {relevantTicketStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Driver Name</label>
                                                <input type="text" className="cat-input" placeholder="Enter Driver Name" value={row.details.driverName || ''} onChange={e => updateDetails(row.id, 'driverName', e.target.value)} disabled={isLocked} />
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Vehicle Number</label>
                                                <input type="text" className="cat-input" placeholder="Enter Vehicle No." value={row.details.travelNo || ''} onChange={e => updateDetails(row.id, 'travelNo', e.target.value)} disabled={isLocked} />
                                            </div>
                                        </>
                                    )}
                                    {!['Train', 'Flight', 'Intercity Bus', 'Intercity Cab'].includes(mode) && (
                                        <div className="text-muted" style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>Please select Travel Mode to see details</div>
                                    )}
                                    {['Flight', 'Train'].includes(mode) && (
                                        <div className="input-with-label-mini mt-2" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                                            <input
                                                type="checkbox"
                                                id={`meal-inc-${row.id}`}
                                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                checked={row.details.mealIncluded === 'Yes'}
                                                onChange={e => updateDetails(row.id, 'mealIncluded', e.target.checked ? 'Yes' : 'No')}
                                                disabled={isLocked}
                                            />
                                            <label htmlFor={`meal-inc-${row.id}`} style={{ cursor: 'pointer', fontWeight: '600', color: '#475569', fontSize: '0.75rem' }}>Meal Included in Ticket</label>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* 5. Schedule Details */}
                            <div className="incidental-form-card travel-schedule-card">
                                <div className="incidental-card-head">
                                    <Clock size={14} />
                                    <span>Schedule Details</span>
                                </div>
                                <div className="incidental-card-body travel-schedule-grid">
                                    {/* Row 1: Scheduled */}
                                    <div className="input-with-label-mini">
                                        <label>Sched. Dep. Date *</label>
                                        <input type="date" min={minDate} max={maxDate} className="cat-input" value={row.timeDetails?.scheduledDepDate || ''} onChange={e => updateTimeDetails(row.id, 'scheduledDepDate', e.target.value)} disabled={isLocked} />
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>Sched. Dep. Time *</label>
                                        <input type="time" className="cat-input" value={row.timeDetails?.scheduledDepTime || ''} onChange={e => updateTimeDetails(row.id, 'scheduledDepTime', e.target.value)} disabled={isLocked} />
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>Sched. Arr. Date *</label>
                                        <input type="date" min={minDate} max={maxDate} className="cat-input" value={row.timeDetails?.scheduledArrDate || ''} onChange={e => updateTimeDetails(row.id, 'scheduledArrDate', e.target.value)} disabled={isLocked} />
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>Sched. Arr. Time *</label>
                                        <input type="time" className="cat-input" value={row.timeDetails?.scheduledTime || ''} onChange={e => updateTimeDetails(row.id, 'scheduledTime', e.target.value)} disabled={isLocked} />
                                    </div>

                                    {/* Row 2: Actual */}
                                    <div className="input-with-label-mini">
                                        <label>Actual Dep. Date *</label>
                                        <input type="date" min={minDate} max={maxDate} className="cat-input" value={row.details.depDate || ''} onChange={e => updateDetails(row.id, 'depDate', e.target.value)} disabled={isLocked} />
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>Actual Dep. Time *</label>
                                        <input type="time" className="cat-input" value={row.timeDetails?.boardingTime || ''} onChange={e => updateTimeDetails(row.id, 'boardingTime', e.target.value)} disabled={isLocked} />
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>Actual Arr. Date *</label>
                                        <input type="date" min={minDate} max={maxDate} className="cat-input" value={row.details.arrDate || ''} onChange={e => updateDetails(row.id, 'arrDate', e.target.value)} disabled={isLocked} />
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>Actual Arr. Time *</label>
                                        <input type="time" className="cat-input" value={row.timeDetails?.actualTime || ''} onChange={e => updateTimeDetails(row.id, 'actualTime', e.target.value)} disabled={isLocked} />
                                    </div>

                                    {/* Flight Specifics */}
                                    {mode === 'Flight' && (
                                        <>
                                            <div className="input-with-label-mini">
                                                <label>Check-in Time</label>
                                                <input type="time" className="cat-input" value={row.timeDetails?.checkinTime || ''} onChange={e => updateTimeDetails(row.id, 'checkinTime', e.target.value)} disabled={isLocked} />
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Boarding Time</label>
                                                <input type="time" className="cat-input" value={row.timeDetails?.flightBoardingTime || ''} onChange={e => updateTimeDetails(row.id, 'flightBoardingTime', e.target.value)} disabled={isLocked} />
                                            </div>
                                        </>
                                    )}

                                    {/* Calculations */}
                                    <div className="input-with-label-mini" style={{ gridColumn: mode === 'Flight' ? 'span 1' : 'span 2' }}>
                                        <label>Delay (Mins)</label>
                                        <input type="number" readOnly className="cat-input" value={row.timeDetails?.delay || 0} disabled />
                                    </div>
                                    <div className="input-with-label-mini" style={{ gridColumn: mode === 'Flight' ? 'span 1' : 'span 2' }}>
                                        <label>Journey Duration</label>
                                        <input
                                            type="text"
                                            readOnly
                                            className="cat-input"
                                            style={{ backgroundColor: '#f8fafc', fontWeight: 'bold', color: '#1e293b' }}
                                            value={calculateJourneyDuration(row.details.depDate, row.timeDetails?.boardingTime, row.details.arrDate, row.timeDetails?.actualTime)}
                                            disabled
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 6. Ticket Details */}
                            {mode !== 'Intercity Cab' && (
                                <div className="incidental-form-card travel-card-ticket">
                                    <div className="incidental-card-head">
                                        <Receipt size={14} />
                                        <span>Ticket Details</span>
                                    </div>
                                    <div className="incidental-card-body">
                                        <div className="input-with-label-mini">
                                            <label>Provider / Agent</label>
                                            <select className="cat-input" value={row.details.provider || ''} onChange={e => updateDetails(row.id, 'provider', e.target.value)} disabled={isLocked || providerOptions.length === 0}>
                                                <option value="">{providerOptions.length === 0 ? 'No Providers' : 'Select Provider'}</option>
                                                {providerOptions.map(option => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                        </div>
                                        <div className="input-with-label-mini">
                                            <label>Ticket Number</label>
                                            <input type="text" className="cat-input" placeholder="Enter ticket number" value={row.details.ticketNo || ''} onChange={e => updateDetails(row.id, 'ticketNo', e.target.value)} disabled={isLocked} />
                                        </div>
                                        <div className="input-with-label-mini">
                                            <label>PNR / Reference</label>
                                            <input type="text" className="cat-input" placeholder="Enter PNR" value={row.details.pnr || ''} onChange={e => updateDetails(row.id, 'pnr', e.target.value)} disabled={isLocked} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 7. Expense */}
                            <div className="incidental-form-card incidental-amount-card travel-card-expense">
                                <div className="incidental-card-head">
                                    <IndianRupee size={14} />
                                    <span>Expense</span>
                                </div>
                                <div className="incidental-card-body">
                                    {/* Ticket Amount */}
                                    <div className="input-with-label-mini">
                                        <label>Ticket Amount *</label>
                                        <div className="amount-with-currency">
                                            <span className="currency-symbol">₹</span>
                                            <input
                                                type="text"
                                                className="cat-input"
                                                placeholder="0.00"
                                                value={row.details.ticketAmount || ''}
                                                onChange={e => {
                                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                                    if (val !== '' && !/^\d*\.?\d{0,2}$/.test(val)) return;
                                                    updateDetails(row.id, 'ticketAmount', val);
                                                }}
                                                disabled={isLocked || row.details.bookedBy === 'Company Booked'}
                                            />
                                        </div>
                                    </div>

                                    {/* Itemized List */}
                                    <div style={{ marginTop: '10px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.3px' }}>Incidental Expense</div>
                                        {(row.details.travelIncidentals || []).map((item, idx) => (
                                            <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                                <select className="cat-input" style={{ flex: 2, padding: '5px', fontSize: '12px' }} value={item.type} onChange={e => updateTravelIncidental(row.id, idx, 'type', e.target.value)} disabled={isLocked}>
                                                    <option value="">Select Type</option>
                                                    {travelIncidentalTypes.filter(t => {
                                                        const isDuplicate = (row.details.travelIncidentals || []).some((otherItem, otherIdx) => otherIdx !== idx && otherItem.type === t);
                                                        const isPorterAllowed = !['Porter Charges', 'Porter'].includes(t) || hasAdditionalLuggage;
                                                        return !isDuplicate && isPorterAllowed;
                                                    }).map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                                <input type="number" className="cat-input" style={{ flex: 1, padding: '5px', fontSize: '12px' }} placeholder="Cost" value={item.amount} onChange={e => updateTravelIncidental(row.id, idx, 'amount', e.target.value)} disabled={isLocked} />
                                                {!isLocked && (
                                                    <button onClick={() => deleteTravelIncidental(row.id, idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="Delete item">
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {!isLocked && (
                                            <button onClick={() => addTravelIncidental(row.id)} style={{ padding: '6px', fontSize: '11px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', cursor: 'pointer', width: '100%', color: '#475569', textAlign: 'center' }}>
                                                + Add Item (Lounge, Cloak Room, etc.)
                                            </button>
                                        )}
                                    </div>

                                    {/* Total */}
                                    <div className="input-with-label-mini" style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                                        <label style={{ fontWeight: '700', color: '#334155' }}>Total Amount</label>
                                        <div className="amount-with-currency" style={{ background: '#f1f5f9' }}>
                                            <span className="currency-symbol" style={{ background: '#e2e8f0' }}>₹</span>
                                            <input type="text" className="cat-input" style={{ fontWeight: 'bold', color: '#0f172a' }} value={row.amount || '0.00'} disabled />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="incidental-form-card incidental-upload-card travel-card-upload">
                                <div className="incidental-card-head">
                                    <Upload size={14} />
                                    <span>Upload</span>
                                </div>
                                <div className="incidental-card-body">
                                    <div className="incidental-upload-top">
                                        {!isLocked && (
                                            <label className="incidental-upload-btn" htmlFor={`travel-f-${row.id}`}>
                                                <Upload size={14} />
                                                <span>Upload Bills</span>
                                            </label>
                                        )}
                                        <input
                                            type="file"
                                            id={`travel-f-${row.id}`}
                                            hidden
                                            multiple
                                            accept="image/*,.pdf"
                                            onChange={e => {
                                                handleFileUpload(row.id, e.target.files);
                                                e.target.value = '';
                                            }}
                                        />
                                        <span className="incidental-upload-count">
                                            {(row.bills || []).length > 0 ? `${(row.bills || []).length} file(s) attached` : 'No files attached'}
                                        </span>
                                    </div>

                                    {(row.bills || []).length > 0 && (
                                        <div className="incidental-upload-list">
                                            {row.bills.map((bill, idx) => (
                                                <div key={`bill-${idx}`} className="incidental-upload-item">
                                                    <button type="button" className="incidental-upload-preview" onClick={() => previewBill(bill)}>
                                                        <FileText size={14} />
                                                        <span>File {idx + 1}</span>
                                                    </button>
                                                    {!isLocked && (
                                                        <button type="button" className="incidental-upload-remove" onClick={() => removeBill(row.id, idx)}>
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {row.jobReportFiles && row.jobReportFiles.length > 0 && (
                                        <div className="incidental-upload-list mt-2">
                                            {row.jobReportFiles.map((bill, idx) => (
                                                <div key={`jr-${idx}`} className="incidental-upload-item" style={{ border: '1px solid #3b82f6', background: '#eff6ff' }}>
                                                    <button type="button" className="incidental-upload-preview" onClick={() => previewBill(bill)}>
                                                        <FileText size={14} color="#3b82f6" />
                                                        <span style={{ color: '#1d4ed8', fontWeight: '600' }}>JR Proof {idx + 1}</span>
                                                    </button>
                                                    <span style={{ fontSize: '10px', background: '#3b82f6', color: 'white', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold', marginLeft: 'auto', marginRight: '4px' }}>JR</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        );
    };

    const renderLocalTravelCard = (row) => {
        const localInvoiceNumbers = getLocalInvoiceNumbers(row);
        const showOdoFields = ['Own Car', 'Company Car', 'Own Bike', 'Self Drive Rental'].includes(row.details.subType);
        // Incidental expenses (Toll, Parking, etc.) only apply to personal/company vehicles
        const showIncidentalSection = ['Own Bike', 'Company Bike', 'Own Car', 'Company Car'].includes(row.details.subType);
        // For non-personal-vehicle modes (Auto, PT, Cab, etc.) the amount is entered directly
        const isAmountAutoCalculated = showIncidentalSection;

        return (
            <tr key={row.id} className="category-row-block incidental-card-row">
                <td colSpan={10}>
                    <div className="incidental-entry-shell local-entry-shell">
                        <div className="incidental-entry-header">
                            <div className="incidental-entry-title">
                                <Car size={16} />
                                <div>
                                    <strong>Local Conveyance Entry</strong>
                                    <span>Card-based local travel entry with grouped tracking and billing</span>
                                </div>
                            </div>
                            {!isLocked && (
                                <button className="row-del-btn" onClick={() => deleteRow(row.id)} title="Delete row">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>

                        <div className="incidental-card-grid local-card-grid trip-local-card-grid">
                            {/* 1. Mode & Booking */}
                            <div className="incidental-form-card">
                                <div className="incidental-card-head">
                                    <Receipt size={14} />
                                    <span>Mode &amp; Booking</span>
                                </div>
                                <div className="incidental-card-body">
                                    <div className="input-with-label-mini">
                                        <label>Mode *</label>
                                        <select className="cat-input" value={row.details.mode || ''} onChange={e => {
                                            if (!isFixedLocal) {
                                                updateDetails(row.id, 'mode', e.target.value);
                                                updateDetails(row.id, 'subType', '');
                                            }
                                        }} disabled={isLocked || isFixedLocal}>
                                            <option value="">Select Mode</option>
                                            {localTravelModes.map(option => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                    </div>
                                    {row.details.mode && row.details.mode.toLowerCase() === 'car' && (
                                        <div className="input-with-label-mini">
                                            <label>Type *</label>
                                            <select className="cat-input" value={row.details.subType || ''} onChange={e => updateDetails(row.id, 'subType', e.target.value)} disabled={isLocked || isFixedLocal}>
                                                <option value="">Select Type</option>
                                                {localCarSubTypes.map(option => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    {row.details.mode && row.details.mode.toLowerCase() === 'bike' && (
                                        <div className="input-with-label-mini">
                                            <label>Type *</label>
                                            <select className="cat-input" value={row.details.subType || ''} onChange={e => updateDetails(row.id, 'subType', e.target.value)} disabled={isLocked || isFixedLocal}>
                                                <option value="">Select Type</option>
                                                {localBikeSubTypes.map(option => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    {row.details.mode && row.details.mode.toLowerCase() === 'auto' && (
                                        <div className="input-with-label-mini">
                                            <label>Type *</label>
                                            <select className="cat-input" value={row.details.subType || ''} onChange={e => updateDetails(row.id, 'subType', e.target.value)} disabled={isLocked || isFixedLocal}>
                                                <option value="">Select Type</option>
                                                {localAutoSubTypes.map(option => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {row.details.mode && row.details.mode.toLowerCase() === 'public transport' && (
                                        <div className="input-with-label-mini">
                                            <label>Type *</label>
                                            <select className="cat-input" value={row.details.subType || ''} onChange={e => updateDetails(row.id, 'subType', e.target.value)} disabled={isLocked || isFixedLocal}>
                                                <option value="">Select Type</option>
                                                {localProviders.filter(p => p.is_metro || p.is_bus).map(p => <option key={p.id} value={toTitleCase(p.provider_name)}>{toTitleCase(p.provider_name)}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    {['Pooling', 'Uber', 'Ola', 'Rental', 'App Based Cab'].map(s => s.toLowerCase()).includes(row.details.subType ? row.details.subType.toLowerCase() : '') && (
                                        <div className="input-with-label-mini">
                                            <label>Select Provider</label>
                                            <select className="cat-input" value={row.details.provider || ''} onChange={e => updateDetails(row.id, 'provider', e.target.value)} disabled={isLocked || isFixedLocal}>
                                                <option value="">{localProviders.length === 0 ? 'No Providers' : 'Select Provider'}</option>
                                                {localProviders.filter(p => {
                                                    const modeLC = row.details.mode ? row.details.mode.toLowerCase() : '';
                                                    if (modeLC === 'bike') return p.is_bike;
                                                    if (modeLC === 'car') return p.is_car;
                                                    if (modeLC === 'auto') return p.is_auto;
                                                    return true;
                                                }).map(p => <option key={p.id} value={toTitleCase(p.provider_name)}>{toTitleCase(p.provider_name)}</option>)}
                                            </select>
                                        </div>
                                    )}

                                </div>
                            </div>

                            {/* 2. Location */}
                            <div className="incidental-form-card">
                                <div className="incidental-card-head">
                                    <MapPin size={14} />
                                    <span>Location</span>
                                </div>
                                <div className="incidental-card-body">
                                    <div className="input-with-label-mini">
                                        <label>From Location</label>
                                        <SearchableLocationSelect
                                            placeholder="Select Start Location..."
                                            options={locationsPool}
                                            value={row.details.origin || ''}
                                            onSelect={(val) => updateDetails(row.id, 'origin', val)}
                                            disabled={isLocked}
                                            showCode={true}
                                            icon={MapPin}
                                        />
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>To Location</label>
                                        <SearchableLocationSelect
                                            placeholder="Select Destination..."
                                            options={locationsPool}
                                            value={row.details.destination || ''}
                                            onSelect={(val) => updateDetails(row.id, 'destination', val)}
                                            disabled={isLocked}
                                            showCode={true}
                                            icon={MapPin}
                                        />
                                    </div>
                                    {row.details.tollAmount !== undefined && row.details.tollAmount > 0 && (
                                        <div className="input-with-label-mini mt-2">
                                            <label>Auto-calculated Toll</label>
                                            <div className="cat-input read-only-value" style={{ background: '#f9f9f9', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', fontWeight: 'bold' }}>
                                                ₹{row.details.tollAmount}
                                                <span style={{ color: 'green', fontSize: '0.75rem', marginLeft: '8px' }}>(Fetched from Master)</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 3. Expense */}
                            <div className="incidental-form-card incidental-amount-card">
                                <div className="incidental-card-head">
                                    <IndianRupee size={14} />
                                    <span>Expense</span>
                                </div>
                                <div className="incidental-card-body">
                                    {/* Auto-calculated summaries */}
                                    {parseFloat(row.details.fuelAmount || 0) > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                                            <span style={{ color: '#64748b' }}>Fuel Charges</span>
                                            <span style={{ fontWeight: '600', color: '#334155' }}>₹{row.details.fuelAmount}</span>
                                        </div>
                                    )}
                                    {parseFloat(row.details.tollAmount || 0) > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                                            <span style={{ color: '#64748b' }}>Toll Charges</span>
                                            <span style={{ fontWeight: '600', color: '#334155' }}>₹{row.details.tollAmount}</span>
                                        </div>
                                    )}

                                    {/* Itemized Incidental List — only for personal/company vehicles */}
                                    {showIncidentalSection && (
                                        <div style={{ marginTop: '10px' }}>
                                            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.3px' }}>Incidental Expense</div>
                                            {(row.details.localIncidentals || []).map((item, idx) => (
                                                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                                    <select className="cat-input" style={{ flex: 2, padding: '5px', fontSize: '12px' }} value={item.type} onChange={e => updateLocalIncidental(row.id, idx, 'type', e.target.value)} disabled={isLocked}>
                                                        <option value="">Select Type</option>
                                                        {localIncidentalTypes.filter(t => {
                                                            const isDuplicate = (row.details.localIncidentals || []).some((otherItem, otherIdx) => otherIdx !== idx && otherItem.type === t);
                                                            if (isDuplicate) return false;
                                                            if (t === 'Fuel' && parseFloat(row.details.fuelAmount || 0) > 0) return false;
                                                            if (t === 'Toll Charges' && parseFloat(row.details.tollAmount || 0) > 0) return false;
                                                            return true;
                                                        }).map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                    <input type="number" className="cat-input" style={{ flex: 1, padding: '5px', fontSize: '12px' }} placeholder="Cost" value={item.amount} onChange={e => updateLocalIncidental(row.id, idx, 'amount', e.target.value)} disabled={isLocked} />
                                                    {!isLocked && (
                                                        <button onClick={() => deleteLocalIncidental(row.id, idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="Delete item">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            {!isLocked && (
                                                <button onClick={() => addLocalIncidental(row.id)} style={{ padding: '6px', fontSize: '11px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', cursor: 'pointer', width: '100%', color: '#475569', textAlign: 'center' }}>
                                                    + Add Item (Toll, Parking, etc.)
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Total / Direct Amount entry */}
                                    <div className="input-with-label-mini" style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                                        <label style={{ fontWeight: '700', color: '#334155' }}>
                                            {isAmountAutoCalculated ? 'Total Amount' : 'Amount *'}
                                        </label>
                                        <div className="amount-with-currency" style={{ background: isAmountAutoCalculated ? '#f1f5f9' : 'white' }}>
                                            <span className="currency-symbol" style={{ background: isAmountAutoCalculated ? '#e2e8f0' : '#f1f5f9' }}>₹</span>
                                            <input
                                                type="text"
                                                className="cat-input"
                                                style={{ fontWeight: 'bold', color: '#0f172a' }}
                                                placeholder={isAmountAutoCalculated ? '0.00' : 'Enter amount'}
                                                value={row.amount || ''}
                                                disabled={isLocked || isAmountAutoCalculated}
                                                onChange={isAmountAutoCalculated ? undefined : e => {
                                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                                    updateRow(row.id, 'amount', val);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Date & Time */}
                            <div className="incidental-form-card">
                                <div className="incidental-card-head">
                                    <Calendar size={14} />
                                    <span>Date &amp; Time</span>
                                </div>
                                <div className="incidental-card-body local-date-time-grid">
                                    <div className="input-with-label-mini">
                                        <label>Start Date *</label>
                                        <input type="date" min={minDate} max={maxDate} className="cat-input" value={row.date || ''} onChange={e => updateRow(row.id, 'date', e.target.value)} disabled={isLocked} />
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>End Date *</label>
                                        <input type="date" min={minDate} max={maxDate} className="cat-input" value={row.endDate || row.date || ''} onChange={e => updateRow(row.id, 'endDate', e.target.value)} disabled={isLocked} />
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>Start Time</label>
                                        <input type="time" className="cat-input" value={row.timeDetails?.boardingTime || ''} onChange={e => updateTimeDetails(row.id, 'boardingTime', e.target.value)} disabled={isLocked} />
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>End Time</label>
                                        <input type="time" className="cat-input" value={row.timeDetails?.actualTime || ''} onChange={e => updateTimeDetails(row.id, 'actualTime', e.target.value)} disabled={isLocked} />
                                    </div>
                                </div>
                            </div>

                            {/* 5. Tracking (ODO) */}
                            <div className="incidental-form-card local-tracking-card">
                                <div className="incidental-card-head">
                                    <Camera size={14} />
                                    <span>Tracking (ODO)</span>
                                </div>
                                <div className="incidental-card-body">
                                    {showOdoFields && (
                                        <div className="local-odo-grid">
                                            <div className="input-with-label-mini">
                                                <label>Odometer Start *</label>
                                                <input type="number" className="cat-input" placeholder="0" value={row.details.odoStart || ''} onChange={e => updateDetails(row.id, 'odoStart', e.target.value)} disabled={isLocked} />
                                            </div>
                                            <div className="input-with-label-mini">
                                                <label>Odometer End *</label>
                                                <input type="number" className="cat-input" placeholder="0" value={row.details.odoEnd || ''} onChange={e => updateDetails(row.id, 'odoEnd', e.target.value)} disabled={isLocked} />
                                            </div>
                                            {!isLocked && (
                                                <>
                                                    <button type="button" className="incidental-upload-btn" onClick={() => handleOdoCapture(row.id, 'odoStart')}>
                                                        <Camera size={14} />
                                                        <span>{row.details.odoStartImg ? 'Start ODO Captured' : 'Capture Start ODO'}</span>
                                                    </button>
                                                    <button type="button" className="incidental-upload-btn" onClick={() => handleOdoCapture(row.id, 'odoEnd')}>
                                                        <Camera size={14} />
                                                        <span>{row.details.odoEndImg ? 'End ODO Captured' : 'Capture End ODO'}</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    <div className="input-with-label-mini">
                                        <label>Selfie Proof Upload</label>
                                        <div className="local-selfie-list">
                                            {(row.details.selfies || []).map((selfie, idx) => (
                                                <div key={idx} className="local-selfie-item">
                                                    <button type="button" className="incidental-upload-preview" onClick={() => previewBill(selfie)}>
                                                        <FileText size={14} />
                                                        <span>Selfie {idx + 1}</span>
                                                    </button>
                                                    {!isLocked && (
                                                        <button type="button" className="incidental-upload-remove" onClick={() => removeSelfie(row.id, idx)}>
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        {!isLocked && (
                                            <button type="button" className="incidental-upload-btn" onClick={() => handleSelfieCapture(row.id)}>
                                                <Camera size={14} />
                                                <span>Add Selfie Proof</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 6. Upload */}
                            <div className="incidental-form-card incidental-upload-card">
                                <div className="incidental-card-head">
                                    <Upload size={14} />
                                    <span>Upload</span>
                                </div>
                                <div className="incidental-card-body">
                                    <div className="incidental-upload-top">
                                        {!isLocked && (
                                            <label className="incidental-upload-btn" htmlFor={`local-f-${row.id}`}>
                                                <Upload size={14} />
                                                <span>Upload Bills</span>
                                            </label>
                                        )}
                                        <input
                                            type="file"
                                            id={`local-f-${row.id}`}
                                            hidden
                                            multiple
                                            accept="image/*,.pdf"
                                            onChange={e => {
                                                handleFileUpload(row.id, e.target.files);
                                                e.target.value = '';
                                            }}
                                        />
                                        <span className="incidental-upload-count">
                                            {(row.bills || []).length > 0 ? `${(row.bills || []).length} file(s) attached` : 'No files attached'}
                                        </span>
                                    </div>

                                    {(row.bills || []).length > 0 && (
                                        <div className="incidental-upload-list">
                                            {row.bills.map((bill, idx) => (
                                                <div key={`bill-${idx}`} className="incidental-upload-item">
                                                    <button type="button" className="incidental-upload-preview" onClick={() => previewBill(bill)}>
                                                        <FileText size={14} />
                                                        <span>Bill {idx + 1}</span>
                                                    </button>
                                                    {!isLocked && (
                                                        <button type="button" className="incidental-upload-remove" onClick={() => removeBill(row.id, idx)}>
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {row.jobReportFiles && row.jobReportFiles.length > 0 && (
                                        <div className="incidental-upload-list mt-2">
                                            {row.jobReportFiles.map((bill, idx) => (
                                                <div key={`jr-${idx}`} className="incidental-upload-item" style={{ border: '1px solid #3b82f6', background: '#eff6ff' }}>
                                                    <button type="button" className="incidental-upload-preview" onClick={() => previewBill(bill)}>
                                                        <FileText size={14} color="#3b82f6" />
                                                        <span style={{ color: '#1d4ed8', fontWeight: '600' }}>JR Proof {idx + 1}</span>
                                                    </button>
                                                    <span style={{ fontSize: '10px', background: '#3b82f6', color: 'white', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold', marginLeft: 'auto', marginRight: '4px' }}>JR</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        );
    };

    const renderFoodCard = (row) => {
        const foodInvoiceNumbers = getFoodInvoiceNumbers(row);
        const mealSource = normalizeMealSource(row.details.mealSource);
        const isSelfMeal = row.details.mealCategory === 'Self Meal';
        const showMealSourceFields = isSelfMeal;
        const showProvider = isSelfMeal && mealSource === 'online';
        const showHotelName = isSelfMeal && (mealSource === 'hotel' || mealSource === 'online');
        const showRestaurantName = isSelfMeal && mealSource === 'restaurant';
        const amountDisabled = isLocked || !isSelfMeal;

        // Check if meal already included in travel booking for this date
        const mealDateStr = row.date;
        const isMealIncludedInTravel = rows.some(r2 =>
            r2.nature === 'Travel' &&
            r2.details.meal_included_flag &&
            r2.details.depDate <= mealDateStr &&
            r2.details.arrDate >= mealDateStr
        );

        return (
            <tr key={row.id} className="category-row-block incidental-card-row">
                <td colSpan={100} style={{ padding: '0', border: 'none' }}>
                    <div className="incidental-entry-shell food-entry-shell">
                        <div className="incidental-entry-header">
                            <div className="incidental-entry-title">
                                <Coffee size={16} />
                                <div>
                                    <strong>Food & Refreshment Entry</strong>
                                    <span>Card-based meal entry for cleaner capture</span>
                                </div>
                            </div>
                            {!isLocked && (
                                <button className="row-del-btn" onClick={() => deleteRow(row.id)} title="Delete row">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>

                        <div className="incidental-card-grid food-card-grid">
                            <div className="incidental-form-card">
                                <div className="incidental-card-head">
                                    <Calendar size={14} />
                                    <span>Date &amp; Time</span>
                                </div>
                                <div className="incidental-card-body incidental-date-time-stack">
                                    <div className="input-with-label-mini">
                                        <label>Date *</label>
                                        <input type="date" min={minDate} max={maxDate} className="cat-input" value={row.date || ''} onChange={e => updateRow(row.id, 'date', e.target.value)} disabled={isLocked} />
                                    </div>
                                    <div className="input-with-label-mini">
                                        <label>Time *</label>
                                        <input type="time" className="cat-input" value={row.details.mealTime || ''} onChange={e => updateDetails(row.id, 'mealTime', e.target.value)} disabled={isLocked} />
                                    </div>
                                </div>
                            </div>

                            <div className="incidental-form-card">
                                <div className="incidental-card-head">
                                    <Coffee size={14} />
                                    <span>Meal Info</span>
                                </div>
                                <div className="incidental-card-body">
                                    <div className="input-with-label-mini">
                                        <label>Meal Type *</label>
                                        <select className="cat-input" value={row.details.mealType || ''} onChange={e => updateDetails(row.id, 'mealType', e.target.value)} disabled={isLocked}>
                                            <option value="">Select Meal Type</option>
                                            {mealTypes.map(option => {
                                                const isStandardMeal = ['Breakfast', 'Lunch', 'Dinner'].includes(option);
                                                const isDisabled = isMealIncludedInTravel && isStandardMeal;
                                                return (
                                                    <option key={option} value={option} disabled={isDisabled}>
                                                        {option} {isDisabled ? '(Included in Travel)' : ''}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        {isMealIncludedInTravel && (
                                            <div style={{ fontSize: '0.65rem', color: '#f59e0b', marginTop: '4px', fontWeight: '500' }}>
                                                Note: Standard meals are covered by your travel booking for this date.
                                            </div>
                                        )}
                                    </div>
                                    {row.details.mealType && (
                                        <div className="input-with-label-mini">
                                            <label>Meal Time *</label>
                                            <input type="time" className="cat-input" value={row.details.mealTime || ''} onChange={e => updateDetails(row.id, 'mealTime', e.target.value)} disabled={isLocked} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="incidental-form-card">
                                <div className="incidental-card-head">
                                    <Receipt size={14} />
                                    <span>Meal Category &amp; Source</span>
                                </div>
                                <div className="incidental-card-body">
                                    <div className="input-with-label-mini">
                                        <label>Meal Category *</label>
                                        <select className="cat-input" value={row.details.mealCategory || ''} onChange={e => updateDetails(row.id, 'mealCategory', e.target.value)} disabled={isLocked}>
                                            <option value="">Select Meal Category</option>
                                            {mealCategories.map(option => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                    </div>
                                    {showMealSourceFields && (
                                        <div className="input-with-label-mini">
                                            <label>Meal Source *</label>
                                            <select className="cat-input" value={row.details.mealSource || ''} onChange={e => updateDetails(row.id, 'mealSource', e.target.value)} disabled={isLocked}>
                                                <option value="">Select Meal Source</option>
                                                {mealSources.map(option => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    {showProvider && (
                                        <div className="input-with-label-mini">
                                            <label>Provider *</label>
                                            <select className="cat-input" value={row.details.provider || ''} onChange={e => updateDetails(row.id, 'provider', e.target.value)} disabled={isLocked || mealProviders.length === 0}>
                                                <option value="">{mealProviders.length === 0 ? 'No Provider Masters' : 'Select Provider'}</option>
                                                {mealProviders.map(option => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    {showHotelName && (
                                        <div className="input-with-label-mini">
                                            <label>{mealSource === 'online' ? 'Hotel/Outlet Name *' : 'Hotel Name *'}</label>
                                            <input type="text" className="cat-input" placeholder={mealSource === 'online' ? 'Enter hotel or outlet name' : 'Enter hotel name'} value={row.details.hotelName || ''} onChange={e => updateDetails(row.id, 'hotelName', e.target.value)} disabled={isLocked || (mealSource === 'online' && !row.details.provider)} />
                                        </div>
                                    )}
                                    {showRestaurantName && (
                                        <div className="input-with-label-mini">
                                            <label>Restaurant Name *</label>
                                            <input type="text" className="cat-input" placeholder="Enter restaurant name" value={row.details.restaurant || ''} onChange={e => updateDetails(row.id, 'restaurant', e.target.value)} disabled={isLocked} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="incidental-form-card incidental-amount-card">
                                <div className="incidental-card-head">
                                    <IndianRupee size={14} />
                                    <span>Expense</span>
                                </div>
                                <div className="incidental-card-body">
                                    <div className="input-with-label-mini">
                                        <label>Amount *</label>
                                        <div className="amount-with-currency">
                                            <span className="currency-symbol">₹</span>
                                            <input
                                                type="text"
                                                className="cat-input"
                                                placeholder="0.00"
                                                value={!isSelfMeal ? '0.00' : (row.amount || '')}
                                                onChange={e => {
                                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                                    if (!/^\d*\.?\d{0,2}$/.test(val)) return;
                                                    updateRow(row.id, 'amount', val);
                                                }}
                                                disabled={amountDisabled}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="incidental-form-card incidental-upload-card">
                                <div className="incidental-card-head">
                                    <Upload size={14} />
                                    <span>Upload</span>
                                </div>
                                <div className="incidental-card-body">
                                    <div className="incidental-upload-top">
                                        {!isLocked && (
                                            <label className="incidental-upload-btn" htmlFor={`food-f-${row.id}`}>
                                                <Upload size={14} />
                                                <span>Upload Bills</span>
                                            </label>
                                        )}
                                        <input
                                            type="file"
                                            id={`food-f-${row.id}`}
                                            hidden
                                            multiple
                                            accept="image/*,.pdf"
                                            onChange={e => {
                                                handleFileUpload(row.id, e.target.files);
                                                e.target.value = '';
                                            }}
                                        />
                                        <span className="incidental-upload-count">
                                            {(row.bills || []).length > 0 ? `${(row.bills || []).length} file(s) attached` : 'No files attached'}
                                        </span>
                                    </div>

                                    {(row.bills || []).length > 0 && (
                                        <div className="incidental-upload-list">
                                            {row.bills.map((bill, idx) => (
                                                <div key={`bill-${idx}`} className="incidental-upload-item">
                                                    <button type="button" className="incidental-upload-preview" onClick={() => previewBill(bill)}>
                                                        <FileText size={14} />
                                                        <span>Bill {idx + 1}</span>
                                                    </button>
                                                    {!isLocked && (
                                                        <button type="button" className="incidental-upload-remove" onClick={() => removeBill(row.id, idx)}>
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {row.jobReportFiles && row.jobReportFiles.length > 0 && (
                                        <div className="incidental-upload-list mt-2">
                                            {row.jobReportFiles.map((bill, idx) => (
                                                <div key={`jr-${idx}`} className="incidental-upload-item" style={{ border: '1px solid #3b82f6', background: '#eff6ff' }}>
                                                    <button type="button" className="incidental-upload-preview" onClick={() => previewBill(bill)}>
                                                        <FileText size={14} color="#3b82f6" />
                                                        <span style={{ color: '#1d4ed8', fontWeight: '600' }}>JR Proof {idx + 1}</span>
                                                    </button>
                                                    <span style={{ fontSize: '10px', background: '#3b82f6', color: 'white', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold', marginLeft: 'auto', marginRight: '4px' }}>JR</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        );
    };

    const renderAccommodationCard = (row) => {
        const accommodationInvoiceNumbers = getAccommodationInvoiceNumbers(row);
        // Deleted local fallback
        // Deleted local fallback
        // Deleted local fallback
        // Deleted local fallback
        const numberOfNights = row.details.nights || 0;
        const scheduledCheckInDate = row.details.scheduledCheckInDate || row.details.checkIn || '';
        const scheduledCheckInTime = row.details.scheduledCheckInTime || row.details.checkInTime || '';
        const scheduledCheckOutDate = row.details.scheduledCheckOutDate || row.details.checkOut || '';
        const scheduledCheckOutTime = row.details.scheduledCheckOutTime || row.details.checkOutTime || '';
        const actualCheckInDate = row.details.actualCheckInDate || row.details.checkIn || '';
        const actualCheckInTime = row.details.actualCheckInTime || row.details.checkInTime || '';
        const actualCheckOutDate = row.details.actualCheckOutDate || row.details.checkOut || '';
        const actualCheckOutTime = row.details.actualCheckOutTime || row.details.checkOutTime || '';

        return (
            <tr key={row.id} className="category-row-block incidental-card-row">
                <td>
                    <div className="incidental-entry-shell accommodation-entry-shell">
                        <div className="incidental-entry-header">
                            <div className="incidental-entry-title">
                                <Hotel size={16} />
                                <div>
                                    <strong>Stay & Lodging Entry</strong>
                                    <span>Card-based stay entry with grouped scheduling and billing</span>
                                </div>
                            </div>
                            {!isLocked && (
                                <button className="row-del-btn" onClick={() => deleteRow(row.id)} title="Delete row">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>

                        <div className="accommodation-form-layout">
                            {/* SECTION 1: Stay Timeline */}
                            <div className="accommodation-timeline-section">
                                {/* Scheduled Row */}
                                <div className="timeline-row">
                                    <div className="timeline-label">Scheduled</div>
                                    <div className="timeline-inputs">
                                        <div className="timeline-group">
                                            <span className="group-label">Check-in</span>
                                            <div className="group-fields">
                                                <input type="date" min={minDate} max={maxDate} className="cat-input" value={scheduledCheckInDate || ''} onChange={e => updateDetails(row.id, 'scheduledCheckInDate', e.target.value)} disabled={isLocked} />
                                                <input type="time" className="cat-input" value={scheduledCheckInTime || ''} onChange={e => updateDetails(row.id, 'scheduledCheckInTime', e.target.value)} disabled={isLocked} />
                                            </div>
                                        </div>

                                        <div className="timeline-arrow"><span>→</span></div>

                                        <div className="timeline-group">
                                            <span className="group-label">Check-out</span>
                                            <div className="group-fields">
                                                <input type="date" min={minDate} max={maxDate} className="cat-input" value={scheduledCheckOutDate || ''} onChange={e => updateDetails(row.id, 'scheduledCheckOutDate', e.target.value)} disabled={isLocked} />
                                                <input type="time" className="cat-input" value={scheduledCheckOutTime || ''} onChange={e => updateDetails(row.id, 'scheduledCheckOutTime', e.target.value)} disabled={isLocked} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="timeline-divider"></div>

                                {/* Actual Row */}
                                <div className="timeline-row">
                                    <div className="timeline-label">Actual</div>
                                    <div className="timeline-inputs">
                                        <div className="timeline-group">
                                            <span className="group-label">Check-in</span>
                                            <div className="group-fields">
                                                <input type="date" min={minDate} max={maxDate} className="cat-input" value={actualCheckInDate || ''} onChange={e => updateDetails(row.id, 'actualCheckInDate', e.target.value)} disabled={isLocked} />
                                                <input type="time" className="cat-input" value={actualCheckInTime || ''} onChange={e => updateDetails(row.id, 'actualCheckInTime', e.target.value)} disabled={isLocked} />
                                            </div>
                                        </div>

                                        <div className="timeline-arrow"><span>→</span></div>

                                        <div className="timeline-group">
                                            <span className="group-label">Check-out</span>
                                            <div className="group-fields">
                                                <input type="date" min={minDate} max={maxDate} className="cat-input" value={actualCheckOutDate || ''} onChange={e => updateDetails(row.id, 'actualCheckOutDate', e.target.value)} disabled={isLocked} />
                                                <input type="time" className="cat-input" value={actualCheckOutTime || ''} onChange={e => updateDetails(row.id, 'actualCheckOutTime', e.target.value)} disabled={isLocked} />
                                            </div>
                                        </div>

                                        <div className="accommodation-nights-chip" style={{ marginLeft: 'auto', display: 'flex', gap: '5px', alignItems: 'center', background: '#f8fafc', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '500' }}>Nights:</span>
                                            <strong style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: '700' }}>{numberOfNights}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: Details Columns (3 Columns) */}
                            <div className="accommodation-details-section">
                                {/* 1. Lodging Info */}
                                <div className="details-box">
                                    <div className="details-box-head"><span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Lodging Info</span></div>
                                    <div className="details-box-body" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div className="input-with-label-mini">
                                            <label>Stay Type *</label>
                                            <select className="cat-input" value={row.details.accomType || ''} onChange={e => updateDetails(row.id, 'accomType', e.target.value)} disabled={isLocked}>
                                                <option value="">Select Stay Type</option>
                                                {stayTypes.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        </div>
                                        {['Hotel Stay', 'Guest House'].includes(row.details.accomType) && (
                                            <div className="input-with-label-mini">
                                                <label>{row.details.accomType === 'Guest House' ? 'Guest House Info *' : 'Hotel Name *'}</label>
                                                <input type="text" className="cat-input" value={row.details.hotelName || ''} onChange={e => updateDetails(row.id, 'hotelName', e.target.value)} disabled={isLocked} />
                                            </div>
                                        )}
                                        <div className="input-with-label-mini">
                                            <label>Remarks</label>
                                            <textarea className="cat-input" placeholder="Enter remarks" value={row.details.remarks || ''} onChange={e => updateDetails(row.id, 'remarks', e.target.value)} disabled={isLocked} rows={1} />
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Booking Details */}
                                <div className="details-box">
                                    <div className="details-box-head"><span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Booking Details</span></div>
                                    <div className="details-box-body" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div className="input-with-label-mini">
                                            <label>Booking Type *</label>
                                            <select className="cat-input" value={row.details.bookingType || ''} onChange={e => updateDetails(row.id, 'bookingType', e.target.value)} disabled={isLocked}>
                                                <option value="">Select Booking Type</option>
                                                {stayBookingTypes.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        </div>
                                        {row.details.bookingType !== 'Walkin' && (
                                            <div className="input-with-label-mini mt-1">
                                                <label>Booking Source *</label>
                                                <select className="cat-input" value={row.details.bookingSource || ''} onChange={e => updateDetails(row.id, 'bookingSource', e.target.value)} disabled={isLocked}>
                                                    <option value="">Select Booking Source</option>
                                                    {stayBookingSources.map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        {row.details.bookingType === 'Online Booking' && (
                                            <div className="input-with-label-mini">
                                                <label>Booking ID *</label>
                                                <input type="text" className="cat-input" placeholder="Enter Booking ID" value={row.details.bookingId || ''} onChange={e => updateDetails(row.id, 'bookingId', e.target.value)} disabled={isLocked} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 3. Expense & Upload */}
                                <div className="details-box">
                                    <div className="details-box-head"><span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Expense & Upload</span></div>
                                    <div className="details-box-body" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div className="input-with-label-mini">
                                            <label>Base Amount *</label>
                                            <div className="amount-with-currency">
                                                <span className="currency-symbol">₹</span>
                                                <input
                                                    type="text"
                                                    className="cat-input"
                                                    placeholder="0.00"
                                                    value={row.details.baseAmount ?? row.amount ?? ''}
                                                    disabled={isLocked || row.details.bookingType === 'Company Booking'}
                                                    onChange={e => {
                                                        const val = e.target.value.replace(/[^0-9.]/g, '');
                                                        const base = parseFloat(val) || 0;
                                                        const early = parseFloat(row.details.earlyCheckInCharges) || 0;
                                                        const late = parseFloat(row.details.lateCheckOutCharges) || 0;
                                                        setRows(prev => prev.map(r => r.id === row.id ? {
                                                            ...r,
                                                            amount: String((base + early + late).toFixed(2)),
                                                            details: { ...r.details, baseAmount: val },
                                                            isSaved: false
                                                        } : r));
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <div className="input-with-label-mini" style={{ flex: 1 }}>
                                                <label style={{ fontSize: '0.6rem' }}>Early Chgs</label>
                                                <input
                                                    type="number"
                                                    className="cat-input"
                                                    placeholder="0.00"
                                                    value={row.details.earlyCheckInCharges || ''}
                                                    disabled={isLocked}
                                                    onChange={e => {
                                                        const early = parseFloat(e.target.value) || 0;
                                                        const base = parseFloat(row.details.baseAmount ?? row.amount) || 0;
                                                        const late = parseFloat(row.details.lateCheckOutCharges) || 0;
                                                        setRows(prev => prev.map(r => r.id === row.id ? {
                                                            ...r,
                                                            amount: String((base + early + late).toFixed(2)),
                                                            details: { ...r.details, earlyCheckInCharges: e.target.value },
                                                            isSaved: false
                                                        } : r));
                                                    }}
                                                />
                                            </div>
                                            <div className="input-with-label-mini" style={{ flex: 1 }}>
                                                <label style={{ fontSize: '0.6rem' }}>Late Chgs</label>
                                                <input
                                                    type="number"
                                                    className="cat-input"
                                                    placeholder="0.00"
                                                    value={row.details.lateCheckOutCharges || ''}
                                                    disabled={isLocked}
                                                    onChange={e => {
                                                        const late = parseFloat(e.target.value) || 0;
                                                        const base = parseFloat(row.details.baseAmount ?? row.amount) || 0;
                                                        const early = parseFloat(row.details.earlyCheckInCharges) || 0;
                                                        setRows(prev => prev.map(r => r.id === row.id ? {
                                                            ...r,
                                                            amount: String((base + early + late).toFixed(2)),
                                                            details: { ...r.details, lateCheckOutCharges: e.target.value },
                                                            isSaved: false
                                                        } : r));
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        {/* Auto-calculated total */}
                                        <div className="input-with-label-mini" style={{ paddingTop: '6px', borderTop: '1px dashed #e2e8f0' }}>
                                            <label style={{ fontWeight: 700, color: '#334155' }}>Total Amount</label>
                                            <div className="amount-with-currency" style={{ background: '#f1f5f9' }}>
                                                <span className="currency-symbol" style={{ background: '#e2e8f0' }}>₹</span>
                                                <input type="text" className="cat-input" style={{ fontWeight: 'bold', color: '#0f172a' }} value={row.amount || '0.00'} disabled />
                                            </div>
                                        </div>

                                        <div className="compact-upload-bar" style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            {!isLocked && (
                                                <label className="incidental-upload-btn" htmlFor={`accom-f-${row.id}`} style={{ padding: '4px 8px', fontSize: '0.75rem', gap: '4px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                    <span>Upload</span>
                                                </label>
                                            )}
                                            <input type="file" id={`accom-f-${row.id}`} hidden multiple accept="image/*,.pdf" onChange={e => handleFileUpload(row.id, e.target.files)} />
                                            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                                                {(row.bills || []).length > 0 ? `${(row.bills || []).length} attached` : 'No files'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {(row.bills || []).length > 0 && (
                                <div className="incidental-upload-list">
                                    {row.bills.map((bill, idx) => (
                                        <div key={`bill-${idx}`} className="incidental-upload-item">
                                            <button type="button" className="incidental-upload-preview" onClick={() => previewBill(bill)}>
                                                <FileText size={14} />
                                                <span>Bill {idx + 1}</span>
                                            </button>
                                            {!isLocked && (
                                                <button type="button" className="incidental-upload-remove" onClick={() => removeBill(row.id, idx)}>
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {row.jobReportFiles && row.jobReportFiles.length > 0 && (
                                <div className="incidental-upload-list mt-2">
                                    {row.jobReportFiles.map((bill, idx) => (
                                        <div key={`jr-${idx}`} className="incidental-upload-item" style={{ border: '1px solid #3b82f6', background: '#eff6ff' }}>
                                            <button type="button" className="incidental-upload-preview" onClick={() => previewBill(bill)}>
                                                <FileText size={14} color="#3b82f6" />
                                                <span style={{ color: '#1d4ed8', fontWeight: '600' }}>JR Proof {idx + 1}</span>
                                            </button>
                                            <span style={{ fontSize: '10px', background: '#3b82f6', color: 'white', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold', marginLeft: 'auto', marginRight: '4px' }}>JR</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </td>
            </tr>
        );
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
            setBulkModal({ visible: false, file: null, uploading: false });
            // Let the main window know of update 
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Upload error:', error);
            showToast(error.response?.data?.error || "Error uploading file", "error");
            setBulkModal(prev => ({ ...prev, uploading: false }));
        }
    };

    const isLocked = claimStatus && !['Draft', 'Rejected'].includes(claimStatus);

    const renderCategoryTable = (nature, title, icon) => {
        const categoryRows = displayRows.filter(r => r.nature === nature);

        const gridTemplateColumns = (() => {
            switch (nature) {
                case 'Travel': return '1fr';
                case 'Local Travel': return '1fr';
                case 'Food': return '1fr';
                case 'Accommodation': return '1fr';
                case 'Incidental': return '1fr';
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
                    </div>
                    {!isLocked && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="add-cat-row-btn" onClick={() => addRow(nature)}>
                                <Plus size={14} />
                                <span>Add {title}</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="category-table-wrapper">
                    <table className="category-table">
                        <thead>
                            {nature === 'Travel' && null}
                            {nature === 'Local Travel' && null}
                            {nature === 'Food' && null}
                            {nature === 'Accommodation' && null}
                            {nature === 'Incidental' && (
                                <tr className="category-grid-row" style={{ gridTemplateColumns }}>
                                    <th>Incidental Expense Cards</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {categoryRows.length === 0 ? (
                                <tr className="category-grid-row" style={{ gridTemplateColumns: '1fr' }}>
                                    <td className="empty-cat-row">
                                        No {title.toLowerCase()} recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                (false) ? ( // Card view disabled for TripStory to use Table View instead
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
                                                                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>{nature === 'Local Travel' ? 'Local Conveyance Entry' : 'Travel Entry'}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        {row.details.travelStatus && row.details.travelStatus !== 'Completed' && (
                                                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: row.details.travelStatus === 'Cancelled' ? '#fee2e2' : '#fef3c7', color: row.details.travelStatus === 'Cancelled' ? '#dc2626' : '#d97706' }}>
                                                                                {row.details.travelStatus}
                                                                            </span>
                                                                        )}
                                                                        {!isLocked && (
                                                                            <button type="button" style={{ background: '#fee2e2', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '6px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center' }} onClick={() => deleteRow(row.id)} title="Remove entry">
                                                                                <Trash2 size={15} />
                                                                            </button>
                                                                        )}
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
                                                                            <input type="time" value={row.timeDetails?.boardingTime || ''} onChange={e => updateTimeDetails(row.id, 'boardingTime', e.target.value)} className="cat-input" disabled={isLocked} />
                                                                        </div>
                                                                        <div className="input-with-label-mini">
                                                                            <label>Location</label>
                                                                            <input type="text" placeholder="Start location / Origin" value={row.details.origin || ''} onChange={e => updateDetails(row.id, 'origin', e.target.value)} className="cat-input" disabled={isLocked} />
                                                                        </div>
                                                                        <div className="input-with-label-mini">
                                                                            <label>Odo Reading</label>
                                                                            <input type="number" placeholder="0" value={row.details.odoStart || ''} onChange={e => updateDetails(row.id, 'odoStart', e.target.value)} className="cat-input" disabled={isLocked} />
                                                                        </div>
                                                                        <div className="input-with-label-mini">
                                                                            <label>Odo Photo</label>
                                                                            {!isLocked ? (
                                                                                <button type="button" className="odo-capture-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => handleOdoCapture(row.id, 'odoStart')}>
                                                                                    {row.details.odoStartImg ? <Check size={13} style={{ color: '#16a34a' }} /> : <Camera size={13} />}
                                                                                    <span>{row.details.odoStartImg ? 'Captured' : 'Odo Pic'}</span>
                                                                                </button>
                                                                            ) : (
                                                                                <div style={{ fontSize: '0.7rem', color: row.details.odoStartImg ? '#16a34a' : '#94a3b8' }}>{row.details.odoStartImg ? '✓ Captured' : 'N/A'}</div>
                                                                            )}
                                                                        </div>
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
                                                                        <div className="input-with-label-mini">
                                                                            <label>Odo Reading</label>
                                                                            <input type="number" placeholder="0" value={row.details.odoEnd || ''} onChange={e => updateDetails(row.id, 'odoEnd', e.target.value)} className="cat-input" disabled={isLocked} />
                                                                        </div>
                                                                        <div className="input-with-label-mini">
                                                                            <label>Odo Photo</label>
                                                                            {!isLocked ? (
                                                                                <button type="button" className="odo-capture-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => handleOdoCapture(row.id, 'odoEnd')}>
                                                                                    {row.details.odoEndImg ? <Check size={13} style={{ color: '#16a34a' }} /> : <Camera size={13} />}
                                                                                    <span>{row.details.odoEndImg ? 'Captured' : 'Odo Pic'}</span>
                                                                                </button>
                                                                            ) : (
                                                                                <div style={{ fontSize: '0.7rem', color: row.details.odoEndImg ? '#16a34a' : '#94a3b8' }}>{row.details.odoEndImg ? '✓ Captured' : 'N/A'}</div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* CALC + INLINE JOB REPORT */}
                                                                <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                                                    {/* Calc bar */}
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: jobReportOpen[row.id] || row.details.jobReport ? '1px solid #e2e8f0' : 'none' }}>
                                                                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
                                                                            Calc. Odo Expense:&nbsp;
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
                                                                                            <a key={fi} href={f.data} download={f.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f1f5f9', borderRadius: '8px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, color: '#334155', textDecoration: 'none' }}>
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
                                                                                            showToast('Job report saved to this entry.', 'success');
                                                                                        }}
                                                                                    >
                                                                                        Save
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
                                                                                    <input type="file" id={`f-${row.id}`} hidden onChange={e => { handleFileUpload(row.id, e.target.files); e.target.value = ''; }} accept="image/*,.pdf" />
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
                                            {nature === 'Travel' ? renderTravelCard(row) : nature === 'Local Travel' ? renderLocalTravelCard(row) : nature === 'Incidental' ? renderIncidentalCard(row) : nature === 'Accommodation' ? renderAccommodationCard(row) : nature === 'Food' ? renderFoodCard(row) : (
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
                                                                                <div style={{ flex: 1 }}>
                                                                                    <input type="text" placeholder="From Airport" value={row.details.origin || ''} onChange={e => updateDetails(row.id, 'origin', e.target.value)} style={{ flex: 1 }} />
                                                                                    {errors[row.id]?.origin && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{errors[row.id].origin}</div>}
                                                                                </div>
                                                                                <div style={{ flex: 1 }}>
                                                                                    <input type="text" placeholder="To Airport" value={row.details.destination || ''} onChange={e => updateDetails(row.id, 'destination', e.target.value)} style={{ flex: 1 }} />
                                                                                    {errors[row.id]?.destination && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{errors[row.id].destination}</div>}
                                                                                </div>
                                                                            </div>
                                                                            <div className="field-group mt-1">
                                                                                <div style={{ flex: 1.5 }}>
                                                                                    <select className="cat-input" style={{ width: '100%' }} value={row.details.provider || ''} onChange={e => updateDetails(row.id, 'provider', e.target.value)}>
                                                                                        <option value="">Select Airline</option>
                                                                                        {airlines.map(option => <option key={option} value={option}>{option}</option>)}
                                                                                    </select>
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
                                                                                <input type="text" placeholder="From Location" value={row.details.origin || ''} onChange={e => updateDetails(row.id, 'origin', e.target.value)} style={{ flex: 1 }} />
                                                                                <input type="text" placeholder="To Location" value={row.details.destination || ''} onChange={e => updateDetails(row.id, 'destination', e.target.value)} style={{ flex: 1 }} />
                                                                            </div>
                                                                            <div className="field-group mt-1">
                                                                                <input type="text" placeholder="Provider / Vendor" value={row.details.provider || ''} onChange={e => updateDetails(row.id, 'provider', e.target.value)} style={{ flex: 1.5 }} />

                                                                            </div>
                                                                            <div className="field-group mt-1">
                                                                                <select value={row.details.vehicleType || ''} onChange={e => updateDetails(row.id, 'vehicleType', e.target.value)} style={{ flex: 1.5 }}>
                                                                                    <option value="">Vehicle Type</option>
                                                                                    {CAB_VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                                                                                </select>
                                                                                <input type="text" placeholder="Driver Name" value={row.details.driverName || ''} onChange={e => updateDetails(row.id, 'driverName', e.target.value)} style={{ flex: 1 }} />
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            {/* Default (Train, Intercity Bus, Intercity Car etc.) */}
                                                                            <div className="field-group">
                                                                                <div style={{ flex: 1 }}>
                                                                                    <input type="text" placeholder="From" value={row.details.origin || ''} onChange={e => updateDetails(row.id, 'origin', e.target.value)} style={{ flex: 1 }} />
                                                                                    {errors[row.id]?.origin && <div className="text-danger" style={{ fontSize: '0.65rem' }}>{errors[row.id].origin}</div>}
                                                                                </div>
                                                                                <div style={{ flex: 1 }}>
                                                                                    <input type="text" placeholder="To" value={row.details.destination || ''} onChange={e => updateDetails(row.id, 'destination', e.target.value)} style={{ flex: 1 }} />
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

                                                                    {row.details.mode && row.details.mode.toLowerCase() === 'car' && (
                                                                        <select className="cat-input mt-1" value={row.details.subType || ''} onChange={e => { if (!isFixedLocal) updateDetails(row.id, 'subType', e.target.value); }} disabled={isFixedLocal}>
                                                                            <option value="">Select Sub-Type</option>
                                                                            {localCarSubTypes.map(s => <option key={s} value={s}>{s}</option>)}
                                                                        </select>
                                                                    )}


                                                                    {row.details.mode && row.details.mode.toLowerCase() === 'bike' && (
                                                                        <select className="cat-input mt-1" value={row.details.subType || ''} onChange={e => { if (!isFixedLocal) updateDetails(row.id, 'subType', e.target.value); }} disabled={isFixedLocal}>
                                                                            <option value="">Select Sub-Type</option>
                                                                            {localBikeSubTypes.map(s => <option key={s} value={s}>{s}</option>)}
                                                                        </select>
                                                                    )}
                                                                    {row.details.mode && row.details.mode.toLowerCase() === 'auto' && (
                                                                        <select className="cat-input mt-1" value={row.details.subType || ''} onChange={e => { if (!isFixedLocal) updateDetails(row.id, 'subType', e.target.value); }} disabled={isFixedLocal}>
                                                                            <option value="">Select Sub-Type</option>
                                                                            {localAutoSubTypes.map(s => <option key={s} value={s}>{s}</option>)}
                                                                        </select>
                                                                    )}

                                                                    {row.details.mode && row.details.mode.toLowerCase() === 'public transport' && (
                                                                        <select className="cat-input mt-1" value={row.details.subType || ''} onChange={e => { if (!isFixedLocal) updateDetails(row.id, 'subType', e.target.value); }} disabled={isFixedLocal}>
                                                                            <option value="">Select Sub-Type</option>
                                                                            {localProviders.filter(p => p.is_metro || p.is_bus).map(p => <option key={p.id} value={toTitleCase(p.provider_name)}>{toTitleCase(p.provider_name)}</option>)}
                                                                        </select>
                                                                    )}
                                                                    {['Pooling', 'Uber', 'Ola', 'Rental', 'App Based Cab'].map(s => s.toLowerCase()).includes(row.details.subType ? row.details.subType.toLowerCase() : '') && (
                                                                        <select className="cat-input mt-1" value={row.details.provider || ''} onChange={e => { if (!isFixedLocal) updateDetails(row.id, 'provider', e.target.value); }} disabled={isFixedLocal}>
                                                                            <option value="">Select Provider</option>
                                                                            {localProviders.filter(p => {
                                                                                const modeLC = row.details.mode ? row.details.mode.toLowerCase() : '';
                                                                                if (modeLC === 'bike') return p.is_bike;
                                                                                if (modeLC === 'car') return p.is_car;
                                                                                if (modeLC === 'auto') return p.is_auto;
                                                                                return true;
                                                                            }).map(p => <option key={p.id} value={toTitleCase(p.provider_name)}>{toTitleCase(p.provider_name)}</option>)}
                                                                        </select>
                                                                    )}
                                                                    {!['Own Bike', 'Company Bike', 'Own Car', 'Company Car'].map(s => s.toLowerCase()).includes(row.details.subType ? row.details.subType.toLowerCase() : '') && !['Metro Train', 'Bus', 'Walk'].map(m => m.toLowerCase()).includes(row.details.mode ? row.details.mode.toLowerCase() : '') && (
                                                                        <select className="cat-input mt-1" value={row.details.bookedBy || 'Self Booked'} onChange={e => { if (!isFixedLocal) updateDetails(row.id, 'bookedBy', e.target.value); }} disabled={isFixedLocal}>
                                                                            {bookedByOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                                                        </select>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className="row-fields">
                                                                    <div className="field-group">
                                                                        <input type="text" placeholder="From Location" value={row.details.origin || ''} onChange={e => updateDetails(row.id, 'origin', e.target.value)} style={{ flex: 1 }} />
                                                                        <input type="text" placeholder="To Location" value={row.details.destination || ''} onChange={e => updateDetails(row.id, 'destination', e.target.value)} style={{ flex: 1 }} />
                                                                    </div>
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
                                                                        {['Own Car', 'Company Car', 'Own Bike', 'Self Drive Rental'].includes(row.details.subType) && (
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
                                                                                        />
                                                                                        <button type="button" className="odo-cam-btn" onClick={() => handleOdoCapture(row.id, 'odoStart')}>
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
                                                                                        />
                                                                                        <button type="button" className="odo-cam-btn" onClick={() => handleOdoCapture(row.id, 'odoEnd')}>
                                                                                            {row.details.odoEndImg ? <Check size={12} className="text-success" /> : <Camera size={12} />}
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            </>
                                                                        )}

                                                                        {/* Selfie Capture Section */}
                                                                        <div className="selfie-capture-section">
                                                                            <label className="odo-label" style={{ display: 'block', marginBottom: '8px' }}>Selfie Proofs ({(row.details.selfies || []).length})</label>
                                                                            <div className="selfie-list" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                                {(row.details.selfies || []).map((s, idx) => (
                                                                                    <div key={idx} className="selfie-thumb" style={{ position: 'relative', width: '40px', height: '40px', border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                                                                        <img src={(s.startsWith('data:') || s.startsWith('http')) ? s : `data:image/jpeg;base64,${s}`} alt="selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => previewBill(s)} />
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

                                                    {nature === 'Incidental' && (
                                                        <>
                                                            <td>
                                                                <div className="row-fields">
                                                                    <div className="input-with-label-mini">
                                                                        <label>EXPENSE TYPE</label>
                                                                        <select className="cat-input" value={row.details.incidentalType || ''} onChange={e => updateDetails(row.id, 'incidentalType', e.target.value)}>
                                                                            <option value="">Select Type</option>
                                                                            {incidentalTypes.filter(t => !['Porter Charges', 'Porter'].includes(t) || hasAdditionalLuggage).map(t => (
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
                                                                            {row.details.vehicleType && row.details.vehicleType.toLowerCase() === 'ride hailing' && (
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
                                                                                {row.details.mode && row.details.mode.toLowerCase() === 'public transport' && (
                                                                                    <div className="input-with-label-mini mt-1">
                                                                                        <label>Topup?</label>
                                                                                        <input type="number" value={row.details.smartCardRecharge || ''} onChange={e => updateDetails(row.id, 'smartCardRecharge', e.target.value)} />
                                                                                    </div>
                                                                                )}
                                                                                {row.details.subType && row.details.subType.toLowerCase() === 'ride hailing' && (
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
                                                            <div className="upload-controls-mini">
                                                                {!isLocked && !(row.nature === 'Food' && row.details.mealCategory && row.details.mealCategory !== 'Self Meal') && (
                                                                    <button className="add-bill-btn-mini" onClick={() => document.getElementById(`f-${row.id}`).click()} title="Add Bill">
                                                                        <Plus size={14} />
                                                                        <input type="file" id={`f-${row.id}`} hidden onChange={e => { handleFileUpload(row.id, e.target.files); e.target.value = ''; }} accept="image/*,.pdf" />
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
                                            )}
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
                                                <tr className={r.details.travelStatus && r.details.travelStatus !== 'Completed' ? `status-row-${r.details.travelStatus.toLowerCase().replace(' ', '-')}` : ''}>
                                                    <td className="rev-cat-cell">
                                                        <div className="rev-cat-icon-label">
                                                            {categoryOpt?.icon}
                                                            <span>{r.nature}</span>
                                                        </div>
                                                    </td>
                                                    <td className="mono" style={{ fontSize: '0.75rem' }}>{r.date}</td>
                                                    <td className="rev-desc-cell">
                                                        <div className="rev-main-info">
                                                            {r.nature === 'Travel' && (
                                                                <>
                                                                    <strong>{r.details.mode || 'Travel'}</strong>
                                                                    <span>{r.details.origin} → {r.details.destination}</span>
                                                                </>
                                                            )}
                                                            {r.nature === 'Local Travel' && (
                                                                <>
                                                                    <strong>{r.details.mode || 'Local'} - {r.details.subType || 'No Type'}</strong>
                                                                    <span>{r.details.origin || r.details.fromLocation || 'Start'} → {r.details.destination || r.details.toLocation || 'End'}</span>
                                                                </>
                                                            )}
                                                            {r.nature === 'Food' && (
                                                                <>
                                                                    <strong>{r.details.mealType || 'Meal'}</strong>
                                                                    <span>{r.details.mealCategory || 'Category'} · {r.details.mealSource || 'Source'} · {r.details.hotelName || r.details.restaurant || r.details.provider || 'Provider'}</span>
                                                                </>
                                                            )}
                                                            {r.nature === 'Accommodation' && (
                                                                <>
                                                                    <strong>{r.details.hotelName || r.details.accomType || 'Stay'}</strong>
                                                                    <span>{r.details.bookingType || 'Booking'} · {r.details.bookingSource || 'Source'} · {r.details.nights || 0} Nights</span>
                                                                </>
                                                            )}
                                                            {r.nature === 'Incidental' && (
                                                                <>
                                                                    <strong>{r.details.incidentalType || 'Misc'}</strong>
                                                                    <span>{r.details.notes || 'No notes'}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        {r.isSaved && r.details.travelStatus && r.details.travelStatus !== 'Completed' && (
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
                                                        <div className="rev-bills-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
                                                            {r.bills && r.bills.length > 0 && r.bills.map((b, bidx) => (
                                                                <button key={`bill-${bidx}`} className="rev-bill-preview" title={`View Bill ${bidx + 1}`} onClick={() => previewBill(b)}>
                                                                    <FileText size={14} />
                                                                </button>
                                                            ))}
                                                            {r.jobReportFiles && r.jobReportFiles.length > 0 && r.jobReportFiles.map((b, bidx) => (
                                                                <button
                                                                    key={`jr-${bidx}`}
                                                                    className="rev-bill-preview"
                                                                    title={`View Job Report Attachment ${bidx + 1}`}
                                                                    onClick={() => previewBill(b)}
                                                                    style={{ border: '1.5px solid #3b82f6', background: '#eff6ff', position: 'relative' }}
                                                                >
                                                                    <FileText size={14} color="#3b82f6" />
                                                                    <span style={{ position: 'absolute', top: '-11px', right: '-11px', fontSize: '10px', background: '#3b82f6', color: 'white', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold' }}>JR</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                        {(!r.bills || r.bills.length === 0) && (!r.jobReportFiles || r.jobReportFiles.length === 0) && <span className="no-bill-dash">—</span>}
                                                    </td>
                                                    <td className="text-center">
                                                        {(r.isSaved || r.details.travelStatus !== 'Completed') ? (
                                                            <div className="status-cell-wrapper">
                                                                <select
                                                                    className={`rev-status-select ${r.details.travelStatus && r.details.travelStatus !== 'Completed' ? 'status-' + r.details.travelStatus.toLowerCase().replace(' ', '-') : ''}`}
                                                                    value={r.details.travelStatus || 'Completed'}
                                                                    onChange={e => handleReviewStatusChange(r.id, e.target.value)}
                                                                    disabled={(r.nature === 'Travel' || r.nature === 'Local Travel') && r.details.bookedBy === 'Company Booked'}
                                                                    title={(r.nature === 'Travel' || r.nature === 'Local Travel') && r.details.bookedBy === 'Company Booked' ? "This ticket is booked and paid by the company. Please contact the Travel Desk for any changes." : ""}
                                                                >
                                                                    {availableStatuses.map(s => {
                                                                        const isOwnVehicle = r.details.subType === 'Own Car' || r.details.subType === 'Own Bike';
                                                                        const isDisabled = (isOwnVehicle && (s === 'Cancelled' || s === 'No-Show')) || ((r.nature === 'Travel' || r.nature === 'Local Travel') && r.details.bookedBy === 'Company Booked' && s !== 'Completed');
                                                                        return <option key={s} value={s} disabled={isDisabled}>{s}</option>;
                                                                    })}
                                                                </select>
                                                                {(r.nature === 'Travel' || r.nature === 'Local Travel') && r.details.bookedBy === 'Company Booked' && (
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
                {activeCategory === 'Travel' && renderCategoryTable('Travel', 'Long Distance Travel', <Plane size={18} />)}
                {activeCategory === 'Local Travel' && renderCategoryTable('Local Travel', 'Local Conveyance', <Car size={18} />)}
                {activeCategory === 'Food' && renderCategoryTable('Food', 'Food & Refreshments', <Coffee size={18} />)}
                {activeCategory === 'Accommodation' && renderCategoryTable('Accommodation', 'Stay & Lodging', <Hotel size={18} />)}
                {activeCategory === 'Incidental' && renderCategoryTable('Incidental', 'Incidental Expenses', <Receipt size={18} />)}
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

            {/* Bulk Upload Modal */}
            {bulkModal.visible && (
                <div className="modal-overlay">
                    <div className="modal-body bulk-upload-modal">
                        <button className="modal-close" onClick={() => setBulkModal({ visible: false, file: null, uploading: false })}>
                            <X size={24} />
                        </button>
                        <div className="modal-header">
                            <Upload className="modal-icon text-primary" />
                            <h2>Bulk Activity Upload</h2>
                            <p className="text-secondary">Upload multiple daily local travel logs for this trip via Excel.</p>
                        </div>
                        <div className="modal-content">
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
                                <button className="btn-secondary" onClick={() => setBulkModal({ visible: false, file: null, uploading: false })} style={{ flex: 1, padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}>
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
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                /* 1. The Main Card Container */
                .incidental-entry-shell {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 24px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03) !important;
                }

                /* Card Header (Title and Delete Button) */
                .incidental-entry-header {
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                    margin-bottom: 20px !important;
                    padding-bottom: 12px !important;
                    border-bottom: 2px solid #f1f5f9 !important;
                }

                .incidental-entry-title {
                    display: flex !important;
                    align-items: center !important;
                    gap: 12px !important;
                }

                .incidental-entry-title strong {
                    font-size: 1rem !important;
                    color: #1e293b !important;
                    display: block !important;
                }

                .incidental-entry-title span {
                    font-size: 0.75rem !important;
                    color: #64748b !important;
                }

                /* 2. Individual section boxes inside the card */
                .incidental-form-card {
                    background: #f8fafc !important; /* Subtle grey background */
                    border: 1px solid #e2e8f0 !important;
                    border-radius: 8px !important;
                    display: flex !important;
                    flex-direction: column !important;
                    height: 100% !important;
                    overflow: visible !important; /* Changed from hidden to allow dropdowns to pop out of card */
                }

                /* The header bar for each group (e.g., "LOCATION") */
                .incidental-card-head {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    padding: 8px 12px !important;
                    background: #f1f5f9 !important; /* Darker grey for the header */
                    border-bottom: 1px solid #e2e8f0 !important;
                    border-top-left-radius: 8px !important; /* Explicitly set because overflow is now visible */
                    border-top-right-radius: 8px !important;
                }

                .incidental-card-head span {
                    font-size: 0.68rem !important;
                    font-weight: 800 !important;
                    color: #475569 !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.05em !important;
                }

                /* The content area inside each group */
                .incidental-card-body {
                    padding: 15px !important;
                    flex: 1 !important;
                }

                /* 3. Highlighting the Expense (Blue Accent) */
                .incidental-amount-card {
                    border-left: 4px solid #4f46e5 !important; /* Indigo accent */
                }

                .incidental-amount-card .incidental-card-head {
                    background: #eef2ff !important; /* Very light blue */
                }

                .incidental-amount-card .incidental-card-head span {
                    color: #4338ca !important;
                }

                /* 4. Input & Label Refinement */
                .input-with-label-mini {
                    margin-bottom: 10px !important;
                }

                .input-with-label-mini label {
                    display: block !important;
                    font-size: 0.62rem !important;
                    font-weight: 700 !important;
                    color: #94a3b8 !important;
                    text-transform: uppercase !important;
                    margin-bottom: 4px !important;
                }

                /* Cleaner inputs */
                .cat-input {
                    width: 100% !important;
                    padding: 8px 10px !important;
                    border: 1px solid #cbd5e1 !important;
                    border-radius: 6px !important;
                    font-size: 0.85rem !important;
                    color: #334155 !important;
                    background: white !important;
                    transition: border-color 0.2s !important;
                }

                .cat-input:focus {
                    border-color: #4f46e5 !important;
                    outline: none !important;
                    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1) !important;
                }

                /* Specifically for the Incidental Card Grid */
                .incidental-card-grid {
                    display: grid !important;
                    grid-template-columns: repeat(5, 1fr) !important; 
                    gap: 12px !important;
                    align-items: stretch !important;
                }

                .incidental-textarea {
                    min-height: 40px !important;
                    height: 40px !important;
                }

                .amount-with-currency input {
                    padding: 6px 8px !important;
                }

                /* Specifically for Food & Refreshments to force a single row */
                .food-card-grid {
                    display: grid !important;
                    grid-template-columns: repeat(5, 1fr) !important; 
                    gap: 12px !important;
                    width: 100% !important;
                    align-items: stretch !important;
                }

                .trip-local-card-grid {
                    display: grid !important;
                    grid-template-columns: repeat(3, 1fr) !important;
                    gap: 20px !important;
                    align-items: stretch !important;
                }
                .trip-local-card-grid > :nth-child(1) { grid-column: 1 !important; grid-row: 1 !important; } /* Mode & Booking */
                .trip-local-card-grid > :nth-child(2) { grid-column: 2 !important; grid-row: 1 !important; } /* Location */
                .trip-local-card-grid > :nth-child(3) { grid-column: 3 !important; grid-row: 1 !important; } /* Expense */
                .trip-local-card-grid > :nth-child(4) { grid-column: 1 !important; grid-row: 2 !important; } /* Date & Time */
                .trip-local-card-grid > :nth-child(5) { grid-column: 2 !important; grid-row: 2 !important; } /* Tracking */
                .trip-local-card-grid > :nth-child(6) { grid-column: 3 !important; grid-row: 2 !important; } /* Upload */
                
                @media (max-width: 900px) {
                    .trip-local-card-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .trip-local-card-grid > * {
                        grid-column: auto !important;
                        grid-row: auto !important;
                    }
                }
                /* Structured Form Layout for Accommodation */
                .accommodation-form-layout {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 16px !important;
                    width: 100% !important;
                }

                .accommodation-timeline-section {
                    background: #ffffff !important;
                    border: 1px solid #e2e8f0 !important;
                    border-radius: 8px !important;
                    padding: 10px 14px !important; /* Reduced padding */
                }

                .timeline-row {
                    display: flex !important;
                    align-items: center !important;
                    gap: 12px !important; /* Reduced gap */
                }

                .timeline-label {
                    font-size: 0.7rem !important;
                    font-weight: 700 !important;
                    color: #64748b !important;
                    text-transform: uppercase !important;
                    width: 80px !important; /* Narrower labels */
                    min-width: 80px !important;
                }

                .timeline-inputs {
                    display: flex !important;
                    flex: 1 !important;
                    gap: 16px !important; /* Compact space between groups */
                    align-items: center !important;
                    justify-content: flex-start !important; /* NO STRETCH */
                }

                .timeline-group {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 2px !important; /* Tighter label-to-input */
                }

                .group-label {
                    font-size: 0.63rem !important;
                    font-weight: 600 !important;
                    color: #94a3b8 !important;
                    margin-bottom: 0 !important;
                }

                .group-fields {
                    display: flex !important;
                    gap: 4px !important; /* Reduced date/time gap */
                    align-items: center !important;
                }

                .group-fields input[type="date"] {
                    width: 140px !important; /* Controlled sizes */
                    max-width: 140px !important;
                    padding: 4px 8px !important;
                    font-size: 0.8rem !important;
                }

                .group-fields input[type="time"] {
                    width: 95px !important; /* Controlled sizes */
                    max-width: 95px !important;
                    padding: 4px 8px !important;
                    font-size: 0.8rem !important;
                }

                .timeline-arrow {
                    color: #cbd5e1 !important;
                    display: flex !important;
                    align-items: center !important;
                    padding-top: 10px !important;
                    font-size: 0.8rem !important;
                }

                .timeline-divider {
                    height: 1px !important;
                    background: #f1f5f9 !important;
                    margin: 8px 0 !important; /* Reduced divider gaps */
                }

                .accommodation-details-section {
                    display: grid !important;
                    grid-template-columns: repeat(3, 1fr) !important;
                    gap: 16px !important;
                }

                .details-box {
                    background: #ffffff !important;
                    border: 1px solid #e2e8f0 !important;
                    border-radius: 8px !important;
                    display: flex !important;
                    flex-direction: column !important;
                    overflow: visible !important;
                }

                .details-box-head {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    padding: 8px 12px !important;
                    background: #f8fafc !important;
                    border-bottom: 1px solid #e2e8f0 !important;
                    border-top-left-radius: 8px !important;
                    border-top-right-radius: 8px !important;
                }
               .accommodation-nights-chip {
                    display: flex !important;
                }
                /* Allowed sequential single-row flow grid */

                .trip-travel-card-grid {
                    display: grid !important;
                    grid-template-columns: repeat(4, 1fr) !important;
                    gap: 16px !important;
                    align-items: start !important; /* Fix excessive stretching */
                }

                .travel-grid-layout {
                    display: grid !important;
                    grid-template-columns: repeat(4, 1fr) !important; 
                    gap: 16px !important;
                    align-items: start !important; /* Fix excessive stretching */
                }

                @media (max-width: 1200px) {
                    .travel-grid-layout {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                }

                @media (max-width: 640px) {
                    .travel-grid-layout {
                        grid-template-columns: 1fr !important;
                    }
                }

                .btn-delete-icon {
                    background: #fee2e2;
                    color: #dc2626;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: 0.2s;
                }

                .btn-delete-icon:hover {
                    background: #fecaca;
                }

                .travel-schedule-grid {
                    display: grid !important;
                    grid-template-columns: repeat(2, 1fr) !important;
                    gap: 12px 16px !important;
                }

                @media (max-width: 1200px) {
                    .trip-travel-card-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                }

                @media (max-width: 1024px) {
                    .trip-accommodation-card-grid, .trip-travel-card-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .trip-accommodation-card-grid > *, .trip-travel-card-grid > * {
                        grid-column: auto !important;
                        grid-row: auto !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default TripExpenseGrid;
