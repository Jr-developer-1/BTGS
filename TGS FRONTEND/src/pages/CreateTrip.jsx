import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext';
import {
    Plane,
    MapPin,
    Calendar,
    Users,
    Award,
    Briefcase,
    Info,
    Plus,
    X,
    Navigation,
    Camera,
    Gauge,
    Hotel,
    Check,
    AlertTriangle,
    User,
    Globe,
    Search,
    Download
} from 'lucide-react';
import { encodeId } from '../utils/idEncoder';

const SearchableLocationSelect = ({ placeholder, options, value, onSelect, error, icon: Icon, disabled, showCode, errorMessage }) => {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Helper to get the correct display name across all cluster variants (Urban/Rural/Corp etc)
    const getDisplayName = (l) => {
        if (!l) return '';
        // In the flat masters list, 'name' typically holds the full administrative name
        // falling back to specific fields if 'name' is empty
        return l.name ||
            l.cluster_name ||
            l.panchayat_name ||
            l.municipality_name ||
            l.corporation_name ||
            l.ward_name ||
            l.village_name ||
            l.town_name ||
            '';
    };

    const filtered = options.filter(l => {
        const dName = getDisplayName(l).toLowerCase();
        const sTerm = (search || '').toLowerCase();
        const codeMatch = (l.code || '').toLowerCase().startsWith(sTerm);
        const typeMatch = (l.cluster_type || '').toLowerCase().startsWith(sTerm) || (l.type || '').toLowerCase().startsWith(sTerm);
        return dName.startsWith(sTerm) || codeMatch || typeMatch;
    });

    // De-duplicate and SORT alphabetically
    const displayItems = Array.from(new Map(filtered.map(item => {
        const baseName = getDisplayName(item);
        const finalLabel = showCode ? `${baseName}${item.code ? ` - ${item.code}` : ''}` : baseName;
        return [finalLabel, { ...item, _finalLabel: finalLabel }];
    })).values()).sort((a, b) => a._finalLabel.localeCompare(b._finalLabel));

    return (
        <div className={`relative w-full ${disabled ? 'opacity-40 cursor-not-allowed grayscale-[0.5]' : ''}`} ref={dropdownRef}>
            <div
                className={`input-with-icon select-wrapper group ${error ? 'error-border' : ''} ${isOpen ? 'active shadow-lg' : 'hover:shadow-md'} transition-all duration-300 cursor-pointer overflow-hidden`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                style={{ height: '48px', position: 'relative' }}
            >
                {Icon && <Icon size={18} className={`field-icon transition-colors duration-300 ${isOpen ? 'text-primary' : 'text-slate-400 group-hover:text-primary'}`} />}
                <div className="flex-1 overflow-hidden" style={{ paddingLeft: Icon ? '40px' : '15px', paddingRight: '40px' }}>
                    <div
                        className={`text-sm tracking-tight transition-all duration-300 ${value ? 'font-bold text-slate-800' : 'font-medium text-slate-400 opacity-60'}`}
                        style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}
                    >
                        {value || placeholder}
                    </div>
                </div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-primary transition-all duration-300" style={{ transform: isOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%) rotate(0deg)' }}>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4 4-4" /></svg>
                </div>
                {isOpen && <div className="absolute bottom-0 left-0 h-0.5 bg-primary animate-pulse" style={{ width: '100%', opacity: 0.3 }} />}
            </div>

            {isOpen && (
                <div
                    className="absolute top-[108%] left-0 right-0 z-[2000] glass rounded-2xl shadow-premium border border-white/40 overflow-hidden animate-fade-in"
                    style={{ transformOrigin: 'top center', minWidth: '260px', background: 'white' }}
                >
                    <div className="p-3 border-b border-slate-100 bg-white sticky top-0 z-[30]">
                        <div style={{ position: 'relative', width: '100%' }}>
                            <Search
                                size={16}
                                style={{
                                    position: 'absolute',
                                    left: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    pointerEvents: 'none',
                                    zIndex: 10,
                                    color: search ? 'var(--primary)' : '#94a3b8'
                                }}
                                className={search ? 'animate-pulse' : ''}
                            />
                            <input
                                autoFocus
                                className="w-full"
                                style={{
                                    height: '40px',
                                    paddingLeft: '40px',
                                    paddingRight: '12px',
                                    fontSize: '13px',
                                    borderRadius: '10px',
                                    border: '1px solid #e2e8f0',
                                    backgroundColor: '#f8fafc',
                                    fontWeight: '600',
                                    outline: 'none',
                                    transition: 'all 0.2s ease'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                placeholder="Type to filter..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <button
                                    style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        padding: '4px',
                                        color: '#cbd5e1'
                                    }}
                                    onClick={(e) => { e.stopPropagation(); setSearch(''); }}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="dropdown-scroll-area custom-scrollbar">
                        {errorMessage ? (
                            <div className="p-8 text-center flex flex-col items-center gap-3">
                                <AlertTriangle size={24} className="text-burgundy animate-bounce" />
                                <p className="text-sm text-burgundy font-bold">{errorMessage}</p>
                            </div>
                        ) : displayItems.length > 0 ? (
                            <div className="py-1">
                                {displayItems.map(l => (
                                    <div key={l.id} className="dropdown-item-premium" onClick={() => {
                                        onSelect(l._finalLabel);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}>
                                        <div className="flex items-center justify-between w-full">
                                            <span className="item-name">{l._finalLabel}</span>
                                            {l.cluster_type && (
                                                <span className="text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400 font-black border border-slate-200/50">
                                                    {l.cluster_type}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-10 text-center flex flex-col items-center gap-3">
                                <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-100">
                                    <Search size={28} />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 font-bold">No matches found</p>
                                    <p className="text-xs text-slate-400 mt-1">Try searching for a different name</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const CreateTrip = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();

    const [formData, setFormData] = useState({
        logisticsType: 'long',
        from: '',
        to: '',
        enRoute: '',
        routePathId: '',
        distance: '',
        considerLocal: false,
        startDate: '',
        endDate: '',
        composition: 'Alone',
        purpose: '',
        travelMode: 'Airways',
        vehicleType: 'Own',
        reportingManager: '',
        members: [],
        tripLeader: 'Self (Creator)',
        accommodationRequests: [],
        project: 'General',
        startOdometer: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [availablePaths, setAvailablePaths] = useState([]);
    const [reportingInfo, setReportingInfo] = useState({ name: 'Loading...', id: null });
    const [newMember, setNewMember] = useState('');
    const [modalState, setModalState] = useState({
        isOpen: false,
        type: 'info',
        title: '',
        message: '',
        actions: null
    });
    const [employees, setEmployees] = useState([]);
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [employeePage, setEmployeePage] = useState(1);
    const [employeeHasMore, setEmployeeHasMore] = useState(true);
    const [employeeError, setEmployeeError] = useState(null);
    const [errors, setErrors] = useState({});
    const [geoError, setGeoError] = useState(null);
    const [policyAccepted, setPolicyAccepted] = useState(false);
    const [policyModal, setPolicyModal] = useState({ isOpen: false, data: null, currentLang: 'en', blobUrls: {} });
    const [locationsPool, setLocationsPool] = useState([]);
    const [fullHierarchy, setFullHierarchy] = useState([]);
    const [sourceFilter, setSourceFilter] = useState({ state: '', district: '', mandal: '', cluster: '' });
    const [destFilter, setDestFilter] = useState({ state: '', district: '', mandal: '', cluster: '' });
    const [sourcePool, setSourcePool] = useState([]);
    const [destPool, setDestPool] = useState([]);

    // ─── Collect City & Metropolitan City nodes from external geo API hierarchy ───
    const longDistanceCities = React.useMemo(() => {
        if (!fullHierarchy || !fullHierarchy.length) return [];
        const result = [];
        const CITY_TYPES = ['city', 'metropolitan city', 'metro city', 'metro_city', 'metropolyten city'];

        const isCityType = (t) => CITY_TYPES.includes((t || '').toLowerCase().trim());

        const walk = (node) => {
            if (!node || typeof node !== 'object') return;

            // Pattern 1: node itself is a cluster/city — check its `type` field
            // (applied when walking children arrays)

            // Pattern 2: direct `cities` or `metro_polyten_cities` child lists
            ['cities', 'metro_polyten_cities'].forEach(key => {
                const arr = node[key];
                if (Array.isArray(arr)) {
                    arr.forEach(c => {
                        if (c && c.name) {
                            result.push({
                                id: c.id,
                                name: c.name,
                                code: c.code || '',
                                cluster_type: key === 'metro_polyten_cities' ? 'Metro City' : 'City'
                            });
                        }
                        walk(c);
                    });
                }
            });

            // Pattern 3: `clusters` / `cluster` / `children` arrays — filter by type field
            ['clusters', 'cluster', 'children'].forEach(key => {
                const arr = node[key];
                if (Array.isArray(arr)) {
                    arr.forEach(c => {
                        if (c && c.name && isCityType(c.type || c.cluster_type)) {
                            result.push({
                                id: c.id,
                                name: c.name,
                                code: c.code || '',
                                cluster_type: (c.type || c.cluster_type || '').toLowerCase().includes('metro')
                                    ? 'Metro City' : 'City'
                            });
                        }
                        walk(c);
                    });
                }
            });

            // Recurse into standard hierarchy levels
            ['continents', 'countries', 'states', 'districts', 'mandals',
                'towns', 'villages', 'locations', 'visiting_locations', 'landmarks'].forEach(key => {
                    const arr = node[key];
                    if (Array.isArray(arr)) arr.forEach(walk);
                });
        };

        fullHierarchy.forEach(walk);

        // De-duplicate by name, sort
        const seen = new Set();
        return result
            .filter(loc => { if (seen.has(loc.name)) return false; seen.add(loc.name); return true; })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [fullHierarchy]);

    // Sync locationsPool when travel type or city list changes
    useEffect(() => {
        if (formData.logisticsType === 'long') {
            setLocationsPool(longDistanceCities);
        } else {
            setLocationsPool([]);
        }
    }, [formData.logisticsType, longDistanceCities]);

    const dropdownRef = useRef(null);

    useEffect(() => {
        const fetchHierarchy = async () => {
            try {
                const res = await api.get('/api/geo/hierarchy/');
                const data = res.data.results || res.data.data || res.data;
                setFullHierarchy(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Failed to fetch full hierarchy", error);
                setGeoError("Failed to load locations from external API.");
            }
        };
        fetchHierarchy();
    }, []);

    const allStates = React.useMemo(() => {
        if (!fullHierarchy || !fullHierarchy.length) return [];
        let states = [];

        // Recursive search for states (Level 3 or type 'state')
        const search = (nodes) => {
            if (!nodes || !Array.isArray(nodes)) return;
            nodes.forEach(node => {
                // If it's a state level or explicitly marked as state
                if (node.level === 3 || node.type?.toLowerCase().includes('state')) {
                    states.push(node);
                } else {
                    const children = node.children || node.countries || node.states || node.states_provinces || [];
                    search(children);
                }
            });
        };

        search(fullHierarchy);

        // Fallback if recursive search failed to find Level 3 nodes
        if (states.length === 0) {
            fullHierarchy.forEach(cont => {
                const countries = cont.children || cont.countries || [];
                countries.forEach(country => {
                    const sList = country.states || country.state || country.children || [];
                    sList.forEach(s => states.push(s));
                });
            });
        }

        return states;
    }, [fullHierarchy]);

    // Helper: getChildren from hierarchy
    const getChildren = (type, filters) => {
        if (!fullHierarchy || !fullHierarchy.length) return [];

        if (type === 'state') return allStates;

        const safeMatch = (name, target) => name?.trim().toLowerCase() === target?.trim().toLowerCase();

        if (type === 'district' && filters.state) {
            const stateObj = allStates.find(s => safeMatch(s.name, filters.state));
            return stateObj?.districts || stateObj?.district || stateObj?.children || [];
        }

        if (type === 'mandal' && filters.district && filters.state) {
            const stateObj = allStates.find(s => safeMatch(s.name, filters.state));
            const districts = stateObj?.districts || stateObj?.district || stateObj?.children || [];
            const districtObj = districts.find(d => safeMatch(d.name, filters.district));
            return districtObj?.mandals || districtObj?.mandal || districtObj?.children || [];
        }

        if (type === 'cluster' && filters.mandal && filters.district && filters.state) {
            const stateObj = allStates.find(s => safeMatch(s.name, filters.state));
            const districts = stateObj?.districts || stateObj?.district || stateObj?.children || [];
            const districtObj = districts.find(d => safeMatch(d.name, filters.district));
            const mandals = districtObj?.mandals || districtObj?.mandal || districtObj?.children || [];
            const mandalObj = mandals.find(m => safeMatch(m.name, filters.mandal));
            return mandalObj?.clusters || mandalObj?.cluster || mandalObj?.children || [];
        }

        return [];
    };

    // Helper: getFinalPoints from hierarchy
    const getFinalPoints = (filters, mode) => {
        if (!fullHierarchy || !fullHierarchy.length) return [];

        const safeMatch = (name, target) => name?.trim().toLowerCase() === target?.trim().toLowerCase();

        const stateObj = allStates.find(s => safeMatch(s.name, filters.state));
        const districts = stateObj?.districts || stateObj?.district || stateObj?.children || [];
        const districtObj = districts.find(d => safeMatch(d.name, filters.district));
        const mandals = districtObj?.mandals || districtObj?.mandal || districtObj?.children || [];
        const mandalObj = mandals.find(m => safeMatch(m.name, filters.mandal));

        if (mode === 'long') {
            return mandalObj ? [{ id: mandalObj.id, name: mandalObj.name, code: mandalObj.code }] : [];
        } else {
            if (!mandalObj) return [];
            const clusters = mandalObj.clusters || mandalObj.cluster || mandalObj.children || [];

            const extractPoints = (c) => {
                return [...(c.visiting_locations || []), ...(c.landmarks || []), ...(c.locations || []), ...(c.children || [])];
            };

            if (filters.cluster) {
                const cluster = clusters.find(c => safeMatch(c.name, filters.cluster));
                return cluster ? extractPoints(cluster) : [];
            } else {
                let allPoints = [];
                clusters.forEach(c => {
                    allPoints = [...allPoints, ...extractPoints(c)];
                });
                return allPoints;
            }
        }
    };

    // Update Source Pool when filter changes
    useEffect(() => {
        if (formData.logisticsType === 'local') {
            setSourcePool(getFinalPoints(sourceFilter, formData.logisticsType));
        }
    }, [sourceFilter, fullHierarchy, formData.logisticsType]);

    // Update Dest Pool when filter changes
    useEffect(() => {
        if (formData.logisticsType === 'local') {
            setDestPool(getFinalPoints(destFilter, formData.logisticsType));
        }
    }, [destFilter, fullHierarchy, formData.logisticsType]);

    // Removed redundant fetchLocations on mount here, as it conflicts with the dashboard data effector.
    // Auto-fetch Vias (En Route) if route exists
    useEffect(() => {
        const fetchVias = async () => {
            if (formData.from && formData.to) {
                try {
                    const srcEnc = encodeURIComponent(formData.from);
                    const destEnc = encodeURIComponent(formData.to);
                    const res = await api.get(`/api/masters/routes/find_paths/?source=${srcEnc}&destination=${destEnc}`);
                    const paths = res.data || [];
                    setAvailablePaths(paths);

                    if (paths.length > 0) {
                        // Auto-select the default or first path
                        const path = paths.find(p => p.is_default) || paths[0];
                        setFormData(prev => ({
                            ...prev,
                            routePathId: path.id,
                            enRoute: (path.via_location_names || []).join(', '),
                            distance: path.distance_km || ''
                        }));
                    } else {
                        setFormData(prev => ({ ...prev, enRoute: '', routePathId: '', distance: '' }));
                    }
                } catch (e) {
                    console.error("Failed to fetch paths", e);
                    setAvailablePaths([]);
                }
            } else {
                setAvailablePaths([]);
                setFormData(prev => ({ ...prev, enRoute: '', routePathId: '', distance: '' }));
            }
        };
        fetchVias();
    }, [formData.from, formData.to]);

    // Helper to normalize IDs for comparison
    const normalizeId = (id) => {
        if (!id) return '';
        return String(id).toLowerCase().trim()
            .replace(/^[a-z]+-?/i, '')
            .replace(/^0+/, '');
    };

    // Helper to parse numeric level
    const parseLevel = (levelVal) => {
        if (levelVal === undefined || levelVal === null) return 99;
        const levelStr = String(levelVal).toLowerCase();

        // Handle descriptive levels
        if (levelStr.includes('head') || levelStr.includes('hq') || levelStr.includes('office')) return 1;
        if (levelStr.includes('region') || levelStr.includes('state') || levelStr.includes('zone')) return 2;
        if (levelStr.includes('branch') || levelStr.includes('facility')) return 3;

        // Extract numbers if present
        const match = levelStr.match(/\d+/);
        return match ? parseInt(match[0]) : 99;
    };

    const setupAuthData = useCallback(async () => {
        if (!user) return;

        const travelerInfo = `${user.name || user.username || 'Self'} (${user.employee_id || 'ID-N/A'})`;

        setFormData(prev => ({
            ...prev,
            tripLeader: travelerInfo
        }));

        try {
            // Fetch only current user's profile from employee API for efficiency
            const empRes = await api.get(`/api/employees/?employee_code=${user.employee_id || user.username}`);
            // Check if results exist (paginated) or flat list
            const employeesData = Array.isArray(empRes.data) ? empRes.data : (empRes.data.results || []);

            const userCodeNormal = normalizeId(user.employee_id || user.username);
            const me = employeesData.find(e => normalizeId(e.employee?.employee_code) === userCodeNormal);

            if (me && me.position?.reporting_to?.length > 0) {
                const managerInfo = me.position.reporting_to[0];
                const managerCode = managerInfo.employee_code || managerInfo.employee_id || managerInfo.id;
                const managerName = managerInfo.name || managerInfo.employee_name || 'Assigned Manager';

                const userRes = await api.get('/api/users/?all_pages=true');
                const systemUsers = Array.isArray(userRes.data) ? userRes.data : (userRes.data.results || []);
                const systemMgr = systemUsers.find(u =>
                    normalizeId(u.employee_id) === normalizeId(managerCode) ||
                    normalizeId(u.username) === normalizeId(managerCode)
                );

                if (systemMgr) {
                    setFormData(prev => ({ ...prev, reportingManager: systemMgr.id }));
                    setReportingInfo({ name: systemMgr.name, id: systemMgr.id, code: managerCode });
                } else {
                    setFormData(prev => ({ ...prev, reportingManager: null }));
                    setReportingInfo({
                        name: `${managerName}`,
                        id: null,
                        code: managerCode,
                        warning: "Manager not registered in system. Approval will be routed automatically."
                    });
                }
            } else {
                setFormData(prev => ({ ...prev, reportingManager: null }));
                setReportingInfo({
                    name: "Routing Automatically",
                    id: null,
                    warning: "No manager defined in HR profile. Approval will be routed to team manager or HR."
                });
            }
        } catch (error) {
            console.error("Failed to detect reporting manager:", error);
            setReportingInfo({ name: 'Error detecting manager', id: null });
        }
    }, [user]);

    useEffect(() => {
        setupAuthData();
    }, [setupAuthData]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const fetchEmployees = async (page = 1, searchQuery = '', append = false) => {
        if (!user) return;
        setLoadingEmployees(true);
        setEmployeeError(null);
        try {
            const requesterCode = user?.employee_id || user?.username || '';
            const response = await api.get(`/api/employees/dropdown/?page=${page}&search=${searchQuery}&requester_code=${requesterCode}`);
            const data = response.data;

            if (data.error) {
                setEmployeeError(data.error);
                if (!append) setEmployees([]);
                return;
            }

            const results = data.results || [];

            // Map backend dropdown results to match frontend expectations
            const mapped = results.map(item => ({
                first_name: item.name || 'N/A',
                employee_id: item.employee_code,
                levelId: item.level || 'N/A',
                designation: item.designation || 'N/A',
                numericLevel: item.numeric_level || 99
            }));

            // Filter based on hierarchy rules
            const userRole = (user?.role || '').toLowerCase();
            const isAdmin = ['admin', 'it-admin', 'superuser', 'it admin', 'system administrator', 'system-admin', 'system setup admin'].includes(userRole);

            // For now, let's keep it simple: if levelId/numericLevel is provided by backend, we filter.
            const userNumericLevel = parseLevel(user?.office_level || 99);

            const filteredByLevel = mapped.filter(emp => {
                if (isAdmin) return true;
                return emp.numericLevel >= userNumericLevel;
            });

            if (append) {
                setEmployees(prev => [...prev, ...filteredByLevel]);
            } else {
                setEmployees(filteredByLevel);
            }

            setEmployeeHasMore(!!data.next);
            setEmployeePage(page);
        } catch (error) {
            console.error("Failed to fetch employees:", error);
            setEmployeeError("Service unavailable. Please try again later.");
        } finally {
            setLoadingEmployees(false);
        }
    };

    // Debounced Search Effect
    useEffect(() => {
        if (!user) return;

        const timeoutId = setTimeout(() => {
            fetchEmployees(1, newMember, false);
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [newMember, user]);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop <= clientHeight + 50 && !loadingEmployees && employeeHasMore) {
            fetchEmployees(employeePage + 1, newMember, true);
        }
    };

    useEffect(() => {
        setFilteredEmployees(employees);
    }, [employees]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'composition' && value === 'Team') {
            const userName = user && (user.first_name && user.last_name)
                ? `${user.first_name} ${user.last_name}`
                : (user?.name || user?.username || user?.employee_id || 'Self (Creator)');

            setFormData(prev => ({ ...prev, composition: value, tripLeader: userName }));
            return;
        }

        if (name === 'logisticsType') {
            setFormData(prev => ({ ...prev, logisticsType: value, from: '', to: '', enRoute: '', considerLocal: value === 'local' }));
            return;
        }

        if (name === 'enRoute' && !/^[a-zA-Z\s,]*$/.test(value)) {
            return;
        }

        const val = name === 'purpose' ? value.toUpperCase() : value;
        const newFormData = { ...formData, [name]: val };
        setFormData(newFormData);

        if (errors[name]) {
            const newErrors = { ...errors };
            delete newErrors[name];
            setErrors(newErrors);
        }

        if (name === 'endDate' && newFormData.startDate && new Date(value) < new Date(newFormData.startDate)) {
            setErrors(prev => ({ ...prev, endDate: "End Date cannot be before Start Date." }));
        }

        if ((name === 'from' || name === 'to') && newFormData.from && newFormData.to && newFormData.from === newFormData.to) {
            setErrors(prev => ({ ...prev, to: "Source and Destination cannot be the same." }));
        }
    };

    const toggleRequest = (item) => {
        setFormData(prev => {
            const current = prev.accommodationRequests;
            const updated = current.includes(item)
                ? current.filter(i => i !== item)
                : [...current, item];
            return { ...prev, accommodationRequests: updated };
        });
    };

    const addMember = (employee) => {
        const memberObj = {
            name: employee.first_name,
            id: employee.employee_id,
            level: employee.levelId,
            designation: employee.designation
        };

        // Prevent duplicates
        if (!formData.members.some(m => m.id === memberObj.id)) {
            setFormData(prev => ({ ...prev, members: [...prev.members, memberObj] }));
            setNewMember('');
            setShowDropdown(false);
            setErrors(prev => ({ ...prev, members: '' }));
        }
    };

    const removeMember = (memberId) => {
        setFormData(prev => ({ ...prev, members: prev.members.filter(m => m.id !== memberId) }));
    };

    const handleViewPolicy = async () => {
        try {
            const res = await api.get('/api/policies/');
            const policies = res.data.results || res.data;
            const latest = policies?.[0];

            if (latest) {
                setPolicyModal({
                    isOpen: true,
                    data: latest,
                    currentLang: 'en'
                });
            } else {
                showToast("No active policy document found.", "info");
            }
        } catch (e) {
            console.error("Failed to fetch policy", e);
            showToast("Failed to load policy document. Please contact admin.", "error");
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.from) newErrors.from = "Origin is required.";
        if (!formData.to) newErrors.to = "Destination is required.";
        if (formData.from && formData.to && formData.from.trim().toLowerCase() === formData.to.trim().toLowerCase()) {
            newErrors.to = "Source and Destination (last point) cannot be the same.";
            newErrors.from = "Source and Destination cannot be the same.";
        }
        if (!formData.startDate) newErrors.startDate = "Start Date is required.";
        if (!formData.endDate) newErrors.endDate = "End Date is required.";
        if (formData.startDate && formData.endDate && new Date(formData.endDate) < new Date(formData.startDate)) {
            newErrors.endDate = "End Date cannot be before Start Date.";
        }
        if (!formData.purpose) newErrors.purpose = "Purpose of trip is required.";

        if (formData.composition === 'Team' && formData.members.length < 1) {
            newErrors.members = "Team travel requires at least 1 additional member.";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            showToast("Please correct the errors in the form.", "error");
            return;
        }

        if (!policyAccepted) {
            showToast("You must accept the travel policy to proceed.", "error");
            return;
        }

        setIsSubmitting(true);

        // Map UI values to Backend values
        const payload = {
            source: formData.from ? formData.from.trim() : '',
            destination: formData.to ? formData.to.trim() : '',
            en_route: formData.enRoute ? formData.enRoute.trim() : '',
            route_path: formData.routePathId || null,
            consider_as_local: formData.considerLocal,
            start_date: formData.startDate,
            end_date: formData.endDate,
            composition: formData.composition === 'Alone' ? 'Solo' : 'Group',
            purpose: formData.purpose ? formData.purpose.trim() : '',
            travel_mode: formData.travelMode,
            vehicle_type: ['2 Wheeler', '3 Wheeler', '4 Wheeler'].includes(formData.travelMode)
                ? (formData.vehicleType === 'Own' ? 'Own' : 'Service')
                : null,
            start_odometer: formData.startOdometer,
            project_code: formData.project,
            reporting_manager: formData.reportingManager,
            members: formData.members.map(m => `${m.name.trim()} (${m.id.trim()}) - ${(m.designation || m.level || '').trim()}`),
            trip_leader: formData.tripLeader,
            accommodation_requests: formData.accommodationRequests
        };

        try {
            const endpoint = payload.consider_as_local ? '/api/travels/' : '/api/trips/';
            const response = await api.post(endpoint, payload);
            const tripId = response.data?.trip_id || 'Unknown';

            setModalState({
                isOpen: true,
                type: 'success',
                title: 'Trip Created Successfully!',
                message: `Your trip request has been submitted. Trip ID: ${tripId}`,
                actions: (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-secondary" onClick={() => navigate('/trips')}>
                            Go to My Trips
                        </button>
                        {/* <button className="btn-primary" onClick={() => navigate(`/${payload.consider_as_local ? 'travel-story' : 'trip-story'}/${encodeId(tripId)}`)}>
                            View {payload.consider_as_local ? 'Travel Story' : 'Trip Story'}
                        </button> */}
                    </div>
                )
            });

        } catch (error) {
            console.error("Error creating trip:", error);
            const errorMessage = error.response?.data?.detail || 'Failed to submit trip request. Please try again.';
            showToast(errorMessage, 'error');
            setModalState({
                isOpen: true,
                type: 'error',
                title: 'Submission Failed',
                message: errorMessage,
                actions: null
            });
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <div className="create-trip-page">
            <div className="page-header">
                <div>
                    <button className="back-btn-simple" onClick={() => navigate('/trips')}>
                        <span className="ct-back-arrow">←</span> Back to Trips
                    </button>
                    <h1>Create New Trip</h1>
                    <p>Provide your travel details to initiate the approval lifecycle.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="trip-form">
                <div className="form-grid">

                    {/* JOURNEY LOGISTICS */}
                    <div className="form-section premium-card">
                        <div className="section-title">
                            <Navigation size={20} className="title-icon" />
                            <h3>Journey Logistics</h3>
                        </div>

                        <div className="input-field" style={{ gridColumn: '1 / -1' }}>
                            <label>Travel Type <span className="required">*</span></label>
                            <select name="logisticsType" value={formData.logisticsType} onChange={handleChange}>
                                <option value="long">Long Distance Travel </option>
                                <option value="local">Local Travel</option>
                            </select>
                        </div>

                        <div className="input-field">
                            <label>Origin (From) <span className="required">*</span></label>
                            {formData.logisticsType === 'local' ? (
                                <div className="drilldown-group bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div className="grid grid-cols-1 gap-2">
                                        <SearchableLocationSelect
                                            placeholder="Select State"
                                            options={getChildren('state', sourceFilter)}
                                            value={sourceFilter.state}
                                            onSelect={(val) => setSourceFilter({ ...sourceFilter, state: val, district: '', mandal: '', cluster: '' })}
                                            errorMessage={geoError}
                                        />
                                        <SearchableLocationSelect
                                            placeholder="Select District"
                                            options={getChildren('district', sourceFilter)}
                                            value={sourceFilter.district}
                                            onSelect={(val) => setSourceFilter({ ...sourceFilter, district: val, mandal: '', cluster: '' })}
                                            disabled={!sourceFilter.state}
                                            errorMessage={geoError}
                                        />
                                        <SearchableLocationSelect
                                            placeholder="Select Mandal"
                                            options={getChildren('mandal', sourceFilter)}
                                            value={sourceFilter.mandal}
                                            onSelect={(val) => setSourceFilter({ ...sourceFilter, mandal: val, cluster: '' })}
                                            disabled={!sourceFilter.district}
                                            errorMessage={geoError}
                                        />
                                        <SearchableLocationSelect
                                            placeholder="Select Cluster (Optional)"
                                            options={getChildren('cluster', sourceFilter)}
                                            value={sourceFilter.cluster}
                                            onSelect={(val) => setSourceFilter({ ...sourceFilter, cluster: val })}
                                            disabled={!sourceFilter.mandal}
                                            errorMessage={geoError}
                                        />
                                        <SearchableLocationSelect
                                            placeholder="Pick Starting Location"
                                            options={sourcePool.filter(opt => opt.name !== formData.to)}
                                            value={formData.from}
                                            onSelect={(val) => handleChange({ target: { name: 'from', value: val } })}
                                            disabled={!sourceFilter.mandal}
                                            error={errors.from}
                                            errorMessage={geoError}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <SearchableLocationSelect
                                    placeholder="Select Starting Location..."
                                    options={locationsPool.filter(opt => opt.name !== formData.to)}
                                    value={formData.from}
                                    onSelect={(val) => handleChange({ target: { name: 'from', value: val } })}
                                    icon={MapPin}
                                    error={errors.from}
                                    showCode={formData.logisticsType === 'long'}
                                    errorMessage={geoError}
                                />
                            )}
                            {errors.from && <span className="error-text">{errors.from}</span>}
                        </div>

                        <div className="input-field">
                            <label>Destination (To) <span className="required">*</span></label>
                            {formData.logisticsType === 'local' ? (
                                <div className="drilldown-group bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div className="grid grid-cols-1 gap-2">
                                        <SearchableLocationSelect
                                            placeholder="Select State"
                                            options={getChildren('state', destFilter)}
                                            value={destFilter.state}
                                            onSelect={(val) => setDestFilter({ ...destFilter, state: val, district: '', mandal: '', cluster: '' })}
                                            errorMessage={geoError}
                                        />
                                        <SearchableLocationSelect
                                            placeholder="Select District"
                                            options={getChildren('district', destFilter)}
                                            value={destFilter.district}
                                            onSelect={(val) => setDestFilter({ ...destFilter, district: val, mandal: '', cluster: '' })}
                                            disabled={!destFilter.state}
                                            errorMessage={geoError}
                                        />
                                        <SearchableLocationSelect
                                            placeholder="Select Mandal"
                                            options={getChildren('mandal', destFilter)}
                                            value={destFilter.mandal}
                                            onSelect={(val) => setDestFilter({ ...destFilter, mandal: val, cluster: '' })}
                                            disabled={!destFilter.district}
                                            errorMessage={geoError}
                                        />
                                        <SearchableLocationSelect
                                            placeholder="Select Cluster (Optional)"
                                            options={getChildren('cluster', destFilter)}
                                            value={destFilter.cluster}
                                            onSelect={(val) => setDestFilter({ ...destFilter, cluster: val })}
                                            disabled={!destFilter.mandal}
                                            errorMessage={geoError}
                                        />
                                        <SearchableLocationSelect
                                            placeholder="Pick Final Destination"
                                            options={destPool.filter(opt => opt.name !== formData.from)}
                                            value={formData.to}
                                            onSelect={(val) => handleChange({ target: { name: 'to', value: val } })}
                                            disabled={!destFilter.mandal}
                                            error={errors.to}
                                            errorMessage={geoError}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <SearchableLocationSelect
                                    placeholder="Select Final Destination..."
                                    options={locationsPool.filter(opt => opt.name !== formData.from)}
                                    value={formData.to}
                                    onSelect={(val) => handleChange({ target: { name: 'to', value: val } })}
                                    icon={MapPin}
                                    error={errors.to}
                                    showCode={formData.logisticsType === 'long'}
                                    errorMessage={geoError}
                                />
                            )}
                            {errors.to && <span className="error-text">{errors.to}</span>}
                        </div>

                        <div className="input-field" style={{ gridColumn: '1 / -1' }}>
                            <label>En Route (Stops)</label>
                            <div className="flex gap-4 items-center">
                                <div className="flex-1">
                                    {availablePaths.length > 0 ? (
                                        <select
                                            name="routePathId"
                                            value={formData.routePathId}
                                            onChange={(e) => {
                                                const pathId = e.target.value;
                                                const selected = availablePaths.find(p => String(p.id) === String(pathId));
                                                if (selected) {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        routePathId: pathId,
                                                        enRoute: (selected.via_location_names || []).join(', '),
                                                        distance: selected.distance_km || ''
                                                    }));
                                                } else {
                                                    setFormData(prev => ({ ...prev, routePathId: '', enRoute: '', distance: '' }));
                                                }
                                            }}
                                            className="professional-input"
                                        >
                                            <option value="">Select Route Path...</option>
                                            {availablePaths.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.path_name} ({(p.via_location_names || []).join(', ') || 'Direct'})
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            name="enRoute"
                                            placeholder="e.g. Hyderabad, Vijayawada (No predefined routes found)"
                                            value={formData.enRoute}
                                            onChange={handleChange}
                                            className="professional-input"
                                        />
                                    )}
                                </div>
                                {formData.distance && (
                                    <div className="distance-badge-premium">
                                        <Gauge size={16} />
                                        <span>{formData.distance} KM</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {formData.logisticsType === 'local' && parseFloat(formData.distance) > 50 && (
                            <div className="ct-alert-card warning animate-fade-in" style={{ gridColumn: '1 / -1', marginTop: '-10px' }}>
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle size={20} className="text-warning" />
                                        <div>
                                            <p className="font-bold text-sm text-slate-700">Distance Exceeds 50 KM</p>
                                            <p className="text-xs text-slate-500">Local travel is typically within 50km. Please confirm if this should be treated as local.</p>
                                        </div>
                                    </div>
                                    <label className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-warning/20 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.considerLocal}
                                            onChange={(e) => setFormData(prev => ({ ...prev, considerLocal: e.target.checked }))}
                                            className="w-5 h-5 rounded text-warning focus:ring-warning"
                                        />
                                        <span className="text-sm font-bold text-slate-700">Consider as Local Travel</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        <div className="date-row">
                            <div className="input-field">
                                <label>From Date <span className="required">*</span></label>
                                <div className={`input-with-icon ${errors.startDate ? 'error-border' : ''}`}>
                                    <Calendar size={18} className="field-icon" />
                                    <input
                                        name="startDate"
                                        type="date"
                                        min={new Date().toISOString().split('T')[0]}
                                        value={formData.startDate}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                {errors.startDate && <span className="error-text">{errors.startDate}</span>}
                            </div>
                            <div className="input-field">
                                <label>To Date <span className="required">*</span></label>
                                <div className={`input-with-icon ${errors.endDate ? 'error-border' : ''}`}>
                                    <Calendar size={18} className="field-icon" />
                                    <input
                                        name="endDate"
                                        type="date"
                                        min={formData.startDate || new Date().toISOString().split('T')[0]}
                                        value={formData.endDate}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                {errors.endDate && <span className="error-text">{errors.endDate}</span>}
                            </div>
                        </div>

                        {/* Travel Mode removed as per user request */}


                    </div>

                    {/* COMPOSITION & PURPOSE */}
                    <div className="form-section premium-card">
                        <div className="section-title">
                            <Users size={20} className="title-icon" />
                            <h3>Composition & Purpose</h3>
                        </div>

                        <div className="input-field">
                            <label>Travel Composition</label>
                            <select name="composition" value={formData.composition} onChange={handleChange}>
                                <option value="Alone">Alone</option>
                                <option value="Team">Team</option>
                            </select>
                        </div>

                        <div className="input-field">
                            <label>{formData.composition === 'Alone' ? 'Traveler (Self)' : 'Trip Leader'}</label>
                            <div className="input-with-icon">
                                {formData.composition === 'Alone' ? <User size={18} className="field-icon" /> : <Award size={18} className="field-icon" />}
                                <input
                                    name="tripLeader"
                                    value={formData.tripLeader}
                                    readOnly
                                    style={{ background: '#f8fafc', cursor: 'not-allowed' }}
                                />
                            </div>
                            {formData.composition === 'Team' && <p className="helper-text">Team trips are lead by the creator by default.</p>}
                        </div>

                        {formData.composition === 'Team' && (
                            <div className="members-section mt-4 mb-4">
                                <label>Additional Team Members <span className="required">*</span></label>
                                <div className="add-member-row relative" ref={dropdownRef}>
                                    <input
                                        placeholder="Search by name or ID..."
                                        value={newMember}
                                        onChange={(e) => setNewMember(e.target.value)}
                                        onFocus={() => setShowDropdown(true)}
                                        className={errors.members ? 'error-border' : ''}
                                    />
                                    {showDropdown && (
                                        <div className="member-dropdown" onScroll={handleScroll}>
                                            {loadingEmployees && employeePage === 1 ? (
                                                <div className="dropdown-info-item">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                                        <span className="animate-pulse">Searching for employees...</span>
                                                    </div>
                                                </div>
                                            ) : employeeError ? (
                                                <div className="dropdown-info-item text-burgundy flex items-center gap-2 font-bold p-4 bg-red-50">
                                                    <AlertTriangle size={16} />
                                                    <span>{employeeError}</span>
                                                </div>
                                            ) : filteredEmployees.length > 0 ? (
                                                <>
                                                    {filteredEmployees.map(emp => (
                                                        <div
                                                            key={emp.employee_id}
                                                            className="dropdown-item"
                                                            onClick={() => addMember(emp)}
                                                        >
                                                            <div className="emp-item-info">
                                                                <span className="emp-name">{emp.first_name}</span>
                                                                <div className="emp-meta">
                                                                    <span className="emp-id-tag">ID: {emp.employee_id}</span>
                                                                    <span className="emp-meta-divider">|</span>
                                                                    <span className="emp-level-tag">{emp.designation}</span>
                                                                    <span className="emp-meta-divider">|</span>
                                                                    <span className="emp-level-tag">Level: {emp.levelId}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {loadingEmployees && (
                                                        <div className="dropdown-info-item p-2 text-center text-xs text-slate-400">
                                                            <span className="animate-pulse italic">Loading more...</span>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="dropdown-info-item">
                                                    <span>No employees found matching your search.</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {errors.members && <span className="error-text">{errors.members}</span>}
                                <div className="members-chips">
                                    {formData.members.map((m, i) => (
                                        <div key={i} className="member-chip-premium">
                                            <div className="chip-content">
                                                <span className="chip-name">{m.name}</span>
                                                <span className="chip-id">{m.id} • {m.designation || m.level}</span>
                                            </div>
                                            <button type="button" className="chip-remove" onClick={() => removeMember(m.id)}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="input-field">
                            <label>Purpose of Trip <span className="required">*</span></label>
                            <textarea
                                name="purpose"
                                className={errors.purpose ? 'error-border' : ''}
                                placeholder="State the business objective..."
                                value={formData.purpose}
                                onChange={handleChange}
                                rows={4}
                            />
                            {errors.purpose && <span className="error-text">{errors.purpose}</span>}
                        </div>
                    </div>

                    {/* LOGISTICS & STAY CHECKLIST */}
                    <div className="form-section premium-card full-width">
                        <div className="section-title">
                            <Hotel size={20} className="title-icon" />
                            <h3>Logistics & Stay Checklist</h3>
                        </div>

                        <div className="checklist-container">
                            {formData.logisticsType === 'long' && (
                                <div
                                    className={`checklist-item ${formData.accommodationRequests.includes('Request for Room') ? 'active' : ''}`}
                                    onClick={() => toggleRequest('Request for Room')}
                                >
                                    <div className="checkbox-box">
                                        {formData.accommodationRequests.includes('Request for Room') && <Check size={16} />}
                                    </div>
                                    <div className="checklist-text">
                                        <label>Request for Room</label>
                                        <p>Forwarded for Guest House / Hotel booking.</p>
                                    </div>
                                </div>
                            )}
                            <div
                                className={`checklist-item ${formData.accommodationRequests.includes('Request for Company Vehicle') ? 'active' : ''}`}
                                onClick={() => toggleRequest('Request for Company Vehicle')}
                            >
                                <div className="checkbox-box">
                                    {formData.accommodationRequests.includes('Request for Company Vehicle') && <Check size={16} />}
                                </div>
                                <div className="checklist-text">
                                    <label>Request for Vehicle</label>
                                    <p>Forwarded to fleet manager for vehicle allocation.</p>
                                </div>
                            </div>

                            {/* Optional: Add more checklist items here in the future */}
                        </div>

                        {formData.accommodationRequests.length > 0 && (
                            <div className="service-alert info full-width ct-alert-margin">
                                <Info size={18} />
                                <p>Selected requests will be visible to your Approving Manager for further forwarding to the booking teams.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="policy-acceptance-section premium-card mt-6">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-6 h-6 rounded border-2 transition-all flex items-center justify-center ${policyAccepted ? 'bg-primary border-primary' : 'border-slate-300 group-hover:border-primary'}`}>
                            {policyAccepted && <Check size={16} className="text-white" />}
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={policyAccepted}
                                onChange={(e) => setPolicyAccepted(e.target.checked)}
                            />
                        </div>
                        <span className="text-slate-700 font-medium">
                            I have read and I accept the <button type="button" className="text-primary hover:underline font-bold" onClick={handleViewPolicy}>Travel Governance Policy</button>
                        </span>
                    </label>
                </div>

                <div className="form-actions">
                    <button
                        type="submit"
                        className={`btn-primary ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Processing...</span>
                            </div>
                        ) : 'Initiate Trip Request'}
                    </button>
                </div>
            </form>

            <Modal
                isOpen={modalState.isOpen}
                onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                title={modalState.title}
                type={modalState.type}
                actions={modalState.actions}
            >
                {modalState.message}
            </Modal>

            <Modal
                isOpen={policyModal.isOpen}
                onClose={() => setPolicyModal(prev => ({ ...prev, isOpen: false }))}
                title={policyModal.data?.title || "Travel Policy"}
                size="xl"
            >
                <div className="policy-modal-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div className="policy-language-tabs mb-2 flex items-center justify-start gap-4 border-b border-slate-100 pb-2">
                        {/* tabs contents ... */}
                        <button
                            className={`lang-tab ${policyModal.currentLang === 'en' ? 'active' : ''}`}
                            style={{
                                minWidth: '120px',
                                border: '1px solid #e2e8f0',
                                background: policyModal.currentLang === 'en' ? '#bb0633' : '#ffffff',
                                color: policyModal.currentLang === 'en' ? '#ffffff' : '#64748b'
                            }}
                            onClick={() => setPolicyModal(prev => ({ ...prev, currentLang: 'en' }))}
                        >
                            English
                        </button>
                        <button
                            className={`lang-tab ${policyModal.currentLang === 'te' ? 'active' : ''}`}
                            style={{
                                minWidth: '120px',
                                border: '1px solid #e2e8f0',
                                background: policyModal.currentLang === 'te' ? '#bb0633' : '#ffffff',
                                color: policyModal.currentLang === 'te' ? '#ffffff' : '#64748b'
                            }}
                            onClick={() => setPolicyModal(prev => ({ ...prev, currentLang: 'te' }))}
                        >
                            Telugu
                        </button>
                        <button
                            className={`lang-tab ${policyModal.currentLang === 'hi' ? 'active' : ''}`}
                            style={{
                                minWidth: '120px',
                                border: '1px solid #e2e8f0',
                                background: policyModal.currentLang === 'hi' ? '#bb0633' : '#ffffff',
                                color: policyModal.currentLang === 'hi' ? '#ffffff' : '#64748b'
                            }}
                            onClick={() => setPolicyModal(prev => ({ ...prev, currentLang: 'hi' }))}
                        >
                            Hindi
                        </button>
                    </div>

                    <div className="policy-content" style={{
                        background: '#ffffff',
                        borderRadius: '4px',
                        border: '1px solid #edf2f7',
                        padding: '0',
                        position: 'relative',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%'
                    }}>
                        {policyModal.data?.[`file_content_${policyModal.currentLang}`] ? (
                            <div className="pdf-deep-clean-container" style={{
                                width: '100%',
                                height: '100%',
                                overflow: 'hidden',
                                position: 'relative',
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                <iframe
                                    src={`${policyModal.data[`file_content_${policyModal.currentLang}`]}#toolbar=0&navpanes=0&scrollbar=0`}
                                    width="100%"
                                    height="calc(100% + 70px)"
                                    frameBorder="0"
                                    style={{
                                        border: 'none',
                                        display: 'block',
                                        marginTop: '-70px',
                                        position: 'relative',
                                        flex: 1
                                    }}
                                    title="Policy Document"
                                />
                            </div>
                        ) : (
                            <div className="p-20 text-center flex flex-col items-center justify-center h-full text-slate-400">
                                <Info size={48} className="mb-4 opacity-20" />
                                <p className="italic text-lg">Content not available in this language.</p>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CreateTrip;