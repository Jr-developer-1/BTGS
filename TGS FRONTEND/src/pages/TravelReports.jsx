import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext.jsx';
import { format } from 'date-fns';
import { 
    Search, Filter, ShieldCheck, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, 
    ChevronsLeft, ChevronsRight, Download, Calendar, RefreshCcw, Loader2, Clock,
    Plane, UploadCloud, Users, X, FileText, Plus, Trash2, UserPlus, Settings, BarChart3
} from 'lucide-react';

const getStatusTranslation = (status) => {
    if (!status) return '—';
    if (['Submitted', 'Forwarded', 'Manager Approved', 'ManagerApproved', 'Senior Manager Approved', 'Director Approved', 'Claim Forwarded', 'Claim Approved by Manager', 'HR Approved', 'Approved by HR', 'Finance Approved', 'Approved by Finance', 'Waiting for Payment', 'Payment Pending'].includes(status)) {
        return 'Pending';
    }
    if (['Approved', 'Completed', 'Settled', 'Claim Approved', 'Claim Settled', 'Claim Processed'].includes(status)) {
        return 'Approved';
    }
    if (status === 'Resolved') return 'Revised';
    if (status === 'Resubmitted') return 'Resubmitted';
    if (status === 'Rejected') return 'Rejected';
    if (status === 'Claim Submitted') return 'Claim Submitted';
    if (status === 'Claim Resubmitted') return 'Claim Resubmitted';
    if (status === 'Claim Rejected') return 'Claim Rejected';
    return status;
};

const getStatusStyle = (status) => {
    const translated = getStatusTranslation(status);
    switch (translated) {
        case 'Approved':
            return { background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' };
        case 'Revised':
            return { background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' };
        case 'Resubmitted':
            return { background: '#f5f3ff', color: '#5b21b6', border: '1px solid #ddd6fe' };
        case 'Rejected':
            return { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' };
        case 'Pending':
            return { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' };
        case 'Not Submitted':
            return { background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1' };
        case 'Claim Submitted':
            return { background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' };
        case 'Claim Resubmitted':
            return { background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff' };
        case 'Claim Rejected':
            return { background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3' };
        default:
            return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
    }
};

const MonthYearPicker = ({ value, onChange, placeholder = "Select Month", style = {} }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tempYear, setTempYear] = useState(new Date().getFullYear());
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const years = [];
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 2010; y--) {
        years.push(y);
    }

    let currentLabel = placeholder;
    if (value) {
        const [start] = value.split('|');
        const d = new Date(start);
        if (!isNaN(d.getTime())) {
            currentLabel = d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
        }
    }

    const months = [
        { name: 'January', short: 'Jan', index: 0 },
        { name: 'February', short: 'Feb', index: 1 },
        { name: 'March', short: 'Mar', index: 2 },
        { name: 'April', short: 'Apr', index: 3 },
        { name: 'May', short: 'May', index: 4 },
        { name: 'June', short: 'Jun', index: 5 },
        { name: 'July', short: 'Jul', index: 6 },
        { name: 'August', short: 'Aug', index: 7 },
        { name: 'September', short: 'Sep', index: 8 },
        { name: 'October', short: 'Oct', index: 9 },
        { name: 'November', short: 'Nov', index: 10 },
        { name: 'December', short: 'Dec', index: 11 }
    ];

    const handleSelectMonth = (monthIndex) => {
        const startStr = `${tempYear}-${String(monthIndex + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(tempYear, monthIndex + 1, 0).getDate();
        const endStr = `${tempYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        onChange(`${startStr}|${endStr}`);
        setIsOpen(false);
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block', width: '100%', minWidth: '180px' }}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    background: 'white',
                    fontSize: '0.9rem',
                    color: '#334155',
                    outline: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                    ...style
                }}
            >
                <span>{currentLabel}</span>
                <ChevronDown size={16} style={{ color: '#64748b', flexShrink: 0 }} />
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '8px',
                    width: '320px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '16px',
                    gap: '12px'
                }}>
                    <div style={{
                        display: 'flex',
                        gap: '6px',
                        overflowX: 'auto',
                        paddingBottom: '8px',
                        borderBottom: '1px solid #f1f5f9',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                    }}>
                        {years.map(y => {
                            const isSelected = tempYear === y;
                            return (
                                <button
                                    key={y}
                                    type="button"
                                    onClick={() => setTempYear(y)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        border: isSelected ? '1px solid var(--primary)' : '1px solid #e2e8f0',
                                        backgroundColor: isSelected ? 'var(--primary)' : '#ffffff',
                                        color: isSelected ? '#ffffff' : '#475569',
                                        cursor: 'pointer',
                                        flexShrink: 0
                                    }}
                                >
                                    {y}
                                </button>
                            );
                        })}
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '8px'
                    }}>
                        {months.map(m => {
                            const startStr = `${tempYear}-${String(m.index + 1).padStart(2, '0')}-01`;
                            const lastDay = new Date(tempYear, m.index + 1, 0).getDate();
                            const endStr = `${tempYear}-${String(m.index + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                            const isSelected = value === `${startStr}|${endStr}`;

                            return (
                                <button
                                    key={m.index}
                                    type="button"
                                    onClick={() => handleSelectMonth(m.index)}
                                    style={{
                                        padding: '10px',
                                        borderRadius: '8px',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                                        backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                                        color: isSelected ? 'var(--primary)' : '#334155',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    {m.short}
                                </button>
                            );
                        })}
                    </div>

                    {value && (
                        <button
                            type="button"
                            onClick={() => {
                                onChange('');
                                setIsOpen(false);
                            }}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                marginTop: '4px'
                            }}
                        >
                            Clear Month Filter
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const TravelReports = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'access'
    
    // Stats Dashboard States
    const [stats, setStats] = useState({
        trips_count: 0,
        batches_count: 0,
        users_count: 0,
        trips: [],
        batches: [],
        users: []
    });
    const [statsLoading, setStatsLoading] = useState(false);
    const [activeModal, setActiveModal] = useState(null);
    const [expandedBatch, setExpandedBatch] = useState(null);
    const detailsRef = useRef(null);

    useEffect(() => {
        if (activeModal && detailsRef.current) {
            detailsRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [activeModal]);
    
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        project: 'All'
    });

    const [modalFilters, setModalFilters] = useState({
        startDate: '',
        endDate: '',
        status: 'All',
        role: 'All',
        selectedRoles: []
    });

    const monthOptions = useMemo(() => {
        const options = [];
        const date = new Date();
        for (let i = 0; i < 120; i++) {
            const m = date.getMonth();
            const y = date.getFullYear();
            const monthName = date.toLocaleString('default', { month: 'long' });
            const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(y, m + 1, 0).getDate();
            const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            options.push({
                label: `${monthName} ${y}`,
                value: `${startStr}|${endStr}`
            });
            date.setMonth(m - 1);
        }
        return options;
    }, []);

    const [selectedMonth, setSelectedMonth] = useState('');

    useEffect(() => {
        const currentVal = `${filters.startDate}|${filters.endDate}`;
        const match = monthOptions.find(opt => opt.value === currentVal);
        if (match) {
            setSelectedMonth(match.value);
        } else {
            setSelectedMonth('');
        }
    }, [filters.startDate, filters.endDate, monthOptions]);

    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(false);

    // Roles filtering inside stats modals
    const [rolesDropdownOpen, setRolesDropdownOpen] = useState(false);
    const [rolesSearch, setRolesSearch] = useState('');
    const rolesDropdownRef = useRef(null);

    // Access Control States
    const [accessRules, setAccessRules] = useState([]);
    const [accessRulesLoading, setAccessRulesLoading] = useState(false);
    
    // Profile Search / Grant Access States
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [grantType, setGrantType] = useState('employee'); // 'employee' or 'position'
    const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);

    // Check user privileged role
    const rawRole = user?.role?.toLowerCase() || 'employee';
    const dept = user?.department?.toLowerCase() || '';
    const desig = user?.designation?.toLowerCase() || '';
    
    let userRole = rawRole;
    if (rawRole === 'admin') userRole = 'admin';
    else if (dept.includes('finance') || desig.includes('finance') || rawRole.includes('finance')) userRole = 'finance';
    else if (dept.includes('hr') || desig.includes('hr') || rawRole === 'hr') userRole = 'hr';
    else if (dept.includes('cfo') || desig.includes('cfo') || rawRole === 'cfo') userRole = 'cfo';

    const isAdmin = userRole === 'admin';

    // Click outside handler for roles dropdown
    useEffect(() => {
        function handleClickOutside(event) {
            if (rolesDropdownRef.current && !rolesDropdownRef.current.contains(event.target)) {
                setRolesDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Projects list fetching
    const fetchProjects = async () => {
        setProjectsLoading(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await api.get('/api/masters/jurisdictions/projects/', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const data = response.data.results || response.data;
            const list = Array.isArray(data) ? data : [];
            setProjects(list);
        } catch (error) {
            clearTimeout(timeoutId);
            console.error("Failed to fetch projects for filter:", error);
        } finally {
            setProjectsLoading(false);
        }
    };

    // Stats fetching
    const fetchStats = async () => {
        setStatsLoading(true);
        try {
            const params = {};
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;
            if (filters.project && filters.project !== 'All') params.project_code = filters.project;

            const response = await api.get('/api/login-history/stats/', { params });
            setStats(response.data);
        } catch (error) {
            console.error("Failed to fetch statistics:", error);
            showToast("Failed to fetch statistics dashboard.", "error");
        } finally {
            setStatsLoading(false);
        }
    };

    // Access control rules fetching
    const fetchAccessRules = async () => {
        if (!isAdmin) return;
        setAccessRulesLoading(true);
        try {
            const response = await api.get('/api/report-access/');
            const data = response.data.results || response.data;
            setAccessRules(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch report access rules:", error);
            showToast("Failed to load access control list.", "error");
        } finally {
            setAccessRulesLoading(false);
        }
    };

    // Search profile fetching
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const response = await api.get('/api/report-access/search-profiles/', {
                    params: { q: searchQuery }
                });
                const data = response.data.results || response.data;
                setSearchResults(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Failed to search profiles:", error);
            } finally {
                setSearchLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        fetchProjects();
        fetchStats();
    }, [filters.startDate, filters.endDate, filters.project]);

    useEffect(() => {
        if (activeTab === 'access') {
            fetchAccessRules();
        }
    }, [activeTab]);

    // Synchronize modal filters on open
    useEffect(() => {
        if (activeModal) {
            setModalFilters({
                startDate: filters.startDate,
                endDate: filters.endDate,
                status: 'All',
                role: 'All',
                selectedRoles: []
            });
            setExpandedBatch(null);
            setRolesSearch('');
            setRolesDropdownOpen(false);
        }
    }, [activeModal, filters.startDate, filters.endDate]);

    // Unique roles listing inside modals
    const uniqueRoles = useMemo(() => {
        const roles = new Set();
        const list = activeModal === 'trips' ? stats.trips : (activeModal === 'batches' ? stats.batches : []);
        (list || []).forEach(item => {
            if (item.user_role) roles.add(item.user_role);
        });
        return [...roles].sort();
    }, [activeModal, stats]);

    // Local filtering within modals
    const filteredTrips = (stats.trips || []).filter(trip => {
        if (trip.is_bulk_upload) return false;
        if (modalFilters.startDate) {
            const start = new Date(modalFilters.startDate);
            start.setHours(0, 0, 0, 0);
            const tripDate = new Date(trip.start_date || trip.created_at);
            if (tripDate < start) return false;
        }
        if (modalFilters.endDate) {
            const end = new Date(modalFilters.endDate);
            end.setHours(23, 59, 59, 999);
            const tripDate = new Date(trip.start_date || trip.created_at);
            if (tripDate > end) return false;
        }
        if (modalFilters.status && modalFilters.status !== 'All') {
            const mappedStatus = getStatusTranslation(trip.status);
            if (mappedStatus !== modalFilters.status) return false;
        }
        if (modalFilters.selectedRoles && modalFilters.selectedRoles.length > 0) {
            const hasMatch = modalFilters.selectedRoles.some(r => 
                (trip.user_role && trip.user_role === r) || 
                (!trip.user_role && trip.user_designation && trip.user_designation.startsWith(r))
            );
            if (!hasMatch) return false;
        }
        return true;
    });

    const filteredBatches = (stats.batches || []).filter(batch => {
        if (batch.status === 'Not Submitted') {
            if (modalFilters.status && modalFilters.status !== 'All') {
                const mappedStatus = getStatusTranslation(batch.status);
                if (mappedStatus !== modalFilters.status) return false;
            }
            if (modalFilters.selectedRoles && modalFilters.selectedRoles.length > 0) {
                const hasMatch = modalFilters.selectedRoles.some(r => 
                    (batch.user_role && batch.user_role === r) || 
                    (!batch.user_role && batch.user_designation && batch.user_designation.startsWith(r))
                );
                if (!hasMatch) return false;
            }
            return true;
        }
        if (modalFilters.startDate) {
            const start = new Date(modalFilters.startDate);
            start.setHours(0, 0, 0, 0);
            const batchDate = new Date(batch.trip_start_date || batch.created_at);
            if (batchDate < start) return false;
        }
        if (modalFilters.endDate) {
            const end = new Date(modalFilters.endDate);
            end.setHours(23, 59, 59, 999);
            const batchDate = new Date(batch.trip_start_date || batch.created_at);
            if (batchDate > end) return false;
        }
        if (modalFilters.status && modalFilters.status !== 'All') {
            const mappedStatus = getStatusTranslation(batch.status);
            if (mappedStatus !== modalFilters.status) return false;
        }
        if (modalFilters.selectedRoles && modalFilters.selectedRoles.length > 0) {
            const hasMatch = modalFilters.selectedRoles.some(r => 
                (batch.user_role && batch.user_role === r) || 
                (!batch.user_role && batch.user_designation && batch.user_designation.startsWith(r))
            );
            if (!hasMatch) return false;
        }
        return true;
    });

    const totalTripsCount = useMemo(() => {
        if (!modalFilters.selectedRoles || modalFilters.selectedRoles.length === 0) {
            return stats.trips?.length || 0;
        }
        return (stats.trips || []).filter(trip => 
            modalFilters.selectedRoles.some(r => 
                (trip.user_role && trip.user_role === r) || 
                (!trip.user_role && trip.user_designation && trip.user_designation.startsWith(r))
            )
        ).length;
    }, [stats.trips, modalFilters.selectedRoles]);

    const totalBatchesCount = useMemo(() => {
        if (!modalFilters.selectedRoles || modalFilters.selectedRoles.length === 0) {
            return stats.batches?.length || 0;
        }
        return (stats.batches || []).filter(batch => 
            modalFilters.selectedRoles.some(r => 
                (batch.user_role && batch.user_role === r) || 
                (!batch.user_role && batch.user_designation && batch.user_designation.startsWith(r))
            )
        ).length;
    }, [stats.batches, modalFilters.selectedRoles]);

    const totalEmployees = useMemo(() => {
        const list = activeModal === 'trips' ? stats.trips : (activeModal === 'batches' ? stats.batches : []);
        if (!list) return 0;
        
        const baseFiltered = list.filter(item => {
            if (activeModal === 'trips' && item.is_bulk_upload) return false;
            return true;
        });

        const targetList = (modalFilters.selectedRoles && modalFilters.selectedRoles.length > 0)
            ? baseFiltered.filter(item => 
                modalFilters.selectedRoles.some(r => 
                    (item.user_role && item.user_role === r) || 
                    (!item.user_role && item.user_designation && item.user_designation.startsWith(r))
                )
              )
            : baseFiltered;

        const uniqueUserIds = new Set(targetList.map(item => item.user_id || item.employee_id).filter(Boolean));
        return uniqueUserIds.size;
    }, [activeModal, stats, modalFilters.selectedRoles]);

    const statusCounts = useMemo(() => {
        const list = activeModal === 'trips' ? stats.trips : (activeModal === 'batches' ? stats.batches : []);
        const counts = {
            Pending: 0,
            Approved: 0,
            Resubmitted: 0,
            Revised: 0,
            'Not Submitted': 0,
            Rejected: 0,
            'Claim Submitted': 0,
            'Claim Resubmitted': 0,
            'Claim Rejected': 0
        };

        if (!list || activeModal === 'users') return counts;

        const filteredForCounts = list.filter(item => {
            if (activeModal === 'trips' && item.is_bulk_upload) return false;

            if (item.status === 'Not Submitted') {
                if (modalFilters.selectedRoles && modalFilters.selectedRoles.length > 0) {
                    const hasMatch = modalFilters.selectedRoles.some(r => 
                        (item.user_role && item.user_role === r) || 
                        (!item.user_role && item.user_designation && item.user_designation.startsWith(r))
                    );
                    if (!hasMatch) return false;
                }
                return true;
            }

            const itemDateStr = item.start_date || item.trip_start_date || item.created_at;
            if (modalFilters.startDate) {
                const start = new Date(modalFilters.startDate);
                start.setHours(0, 0, 0, 0);
                const itemDate = new Date(itemDateStr);
                if (isNaN(itemDate.getTime()) || itemDate < start) return false;
            }
            if (modalFilters.endDate) {
                const end = new Date(modalFilters.endDate);
                end.setHours(23, 59, 59, 999);
                const itemDate = new Date(itemDateStr);
                if (isNaN(itemDate.getTime()) || itemDate > end) return false;
            }
            if (modalFilters.selectedRoles && modalFilters.selectedRoles.length > 0) {
                const hasMatch = modalFilters.selectedRoles.some(r => 
                    (item.user_role && item.user_role === r) || 
                    (!item.user_role && item.user_designation && item.user_designation.startsWith(r))
                );
                if (!hasMatch) return false;
            }
            return true;
        });

        filteredForCounts.forEach(item => {
            const translated = getStatusTranslation(item.status);
            if (counts[translated] !== undefined) {
                counts[translated]++;
            }
        });

        return counts;
    }, [activeModal, stats, modalFilters.startDate, modalFilters.endDate, modalFilters.selectedRoles]);

    const filteredUsers = (stats.users || []).filter(userObj => {
        if (!userObj) return false;
        
        if (modalFilters.startDate) {
            const start = new Date(modalFilters.startDate);
            start.setHours(0, 0, 0, 0);
            if (!userObj.last_login) return false;
            const userDate = new Date(userObj.last_login);
            if (isNaN(userDate.getTime()) || userDate < start) return false;
        }
        if (modalFilters.endDate) {
            const end = new Date(modalFilters.endDate);
            end.setHours(23, 59, 59, 999);
            if (!userObj.last_login) return false;
            const userDate = new Date(userObj.last_login);
            if (isNaN(userDate.getTime()) || userDate > end) return false;
        }
        if (modalFilters.role && modalFilters.role !== 'All') {
            if (userObj.designation !== modalFilters.role) return false;
        }
        return true;
    });

    // CSV Export
    const handleModalExport = () => {
        let csvContent = "";
        let fileName = "";

        if (activeModal === 'trips') {
            const headers = [
                "Trip ID", "Employee ID", "Employee Name", "Designation", 
                "Position Code", "Source", "Destination", "Start Date", 
                "End Date", "Status", "Waiting For Approver", "Rejected By", 
                "Rejection Reason", "Created At"
            ];
            const rows = filteredTrips.map(trip => [
                trip.trip_id,
                trip.user_id,
                trip.user_name,
                trip.user_designation || '',
                trip.user_position_code || '',
                trip.source || '',
                trip.destination || '',
                trip.start_date,
                trip.end_date,
                trip.status,
                !['Approved', 'Rejected', 'Completed'].includes(trip.status) ? (trip.current_approver_name || '') : '',
                trip.status === 'Rejected' ? (trip.rejected_by || '') : '',
                trip.status === 'Rejected' ? (trip.rejection_reason || '') : '',
                trip.created_at ? format(new Date(trip.created_at), 'yyyy-MM-dd HH:mm:ss') : 'null'
            ]);
            csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
            fileName = `trips_created_report_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        } else if (activeModal === 'batches') {
            const headers = [
                "Employee ID", "Employee Name", "Designation", "Position Code", 
                "Travel ID", "Status", "Waiting For Approver", "Rejected By", 
                "Rejection Reason", "Created At"
            ];
            const rows = filteredBatches.map(batch => [
                batch.user_id,
                batch.user_name,
                batch.user_designation || '',
                batch.user_position_code || '',
                batch.trip_id || '',
                batch.status,
                ['Submitted', 'Resubmitted', 'Pending', 'Forwarded'].includes(batch.status) ? (batch.current_approver_name || '') : '',
                batch.status === 'Rejected' ? (batch.rejected_by || '') : '',
                batch.status === 'Rejected' ? (batch.rejection_reason || '') : '',
                batch.created_at ? format(new Date(batch.created_at), 'yyyy-MM-dd HH:mm:ss') : 'null'
            ]);
            csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
            fileName = `bulk_uploads_report_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        } else if (activeModal === 'users') {
            const headers = ["Employee ID", "Name", "Email", "Logins Count", "Last Active At"];
            const rows = filteredUsers.map(u => [
                u.employee_id,
                u.name,
                u.email || '--',
                u.login_count,
                format(new Date(u.last_login), 'yyyy-MM-dd HH:mm:ss')
            ]);
            csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
            fileName = `unique_users_report_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        }

        if (csvContent) {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleSingleBatchExport = (batch, exportType = 'final', e) => {
        if (e) {
            e.stopPropagation();
        }
        
        const isOriginal = exportType === 'original';
        const rowsSource = isOriginal ? (batch.original_rows || batch.rows) : batch.rows;
        if (!rowsSource || rowsSource.length === 0) return;
        
        let headers, rows;
        if (isOriginal) {
            headers = ["Date", "Mode", "Vehicle", "Origin Route", "Destination Route", "Start Time", "Reach Time", "Visit Intent", "Remarks"];
            rows = rowsSource.map(row => [
                row.date || row.Date || '',
                row.mode || '',
                row.vehicle || '',
                row.origin_route || '',
                row.destination_route || '',
                row.start_time || '',
                row.reach_time || '',
                row.visit_intent || '',
                row.remarks || ''
            ]);
        } else {
            headers = ["Date", "Mode", "Vehicle", "Origin Route", "Destination Route", "Odometer Start", "Odometer End", "Start Time", "Reach Time", "Visit Intent", "Remarks", "Is Deviated", "Deviation Reason", "Planned Origin", "Planned Destination", "Is Not Visited", "Actual Mode", "Actual Vehicle Subtype"];
            rows = rowsSource.map(row => [
                row.date || row.Date || '',
                row.mode || '',
                row.vehicle || '',
                row.origin_route || '',
                row.destination_route || '',
                row.odo_start !== undefined ? row.odo_start : '',
                row.odo_end !== undefined ? row.odo_end : '',
                row.start_time || '',
                row.reach_time || '',
                row.visit_intent || '',
                row.remarks || '',
                row.is_deviated ? 'Yes' : 'No',
                row.deviation_reason || '',
                row.planned_origin || '',
                row.planned_destination || '',
                row.is_not_visited ? 'Yes' : 'No',
                row.actual_mode || '',
                row.actual_vehicle || ''
            ]);
        }
        
        const csvContent = [headers, ...rows].map(rowItems => rowItems.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        
        const suffix = isOriginal ? 'original_plan' : 'final_claim';
        link.setAttribute("download", `bulk_upload_${batch.user_id}_${batch.id}_${suffix}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleViewBatchDetails = (batch) => {
        if (!batch || batch.status === 'Not Submitted') return;
        setExpandedBatch(prev => prev === batch.id ? null : batch.id);
    };

    // PDF Download helper
    const handleDownloadTripPDF = async (tripId, e) => {
        if (e) {
            e.stopPropagation();
        }
        if (!tripId) return;
        
        try {
            const endpoint = tripId.startsWith('ITS-') ? 'travels' : 'trips';
            const response = await api.get(`/api/${endpoint}/${tripId}/export/pdf/`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Travel_Expense_Statement_${tripId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("PDF export failed:", error);
            showToast("Failed to download Trip PDF statement.", "error");
        }
    };

    // Grant report access
    const handleGrantAccess = async () => {
        if (!selectedProfile) return;
        try {
            const targetId = grantType === 'employee' ? selectedProfile.employee_code : selectedProfile.position_code;
            const targetName = grantType === 'employee' ? selectedProfile.employee_name : selectedProfile.position_name;

            if (!targetId) {
                showToast("Invalid profile selection code.", "error");
                return;
            }

            await api.post('/api/report-access/', {
                access_type: grantType,
                target_id: targetId,
                target_name: targetName,
                employee_code: selectedProfile.employee_code,
                employee_name: selectedProfile.employee_name,
                position_code: selectedProfile.position_code,
                position_name: selectedProfile.position_name,
                can_view_reports: true
            });

            showToast(`Successfully granted report access to ${grantType}: ${targetName}`, "success");
            setIsGrantModalOpen(false);
            setSelectedProfile(null);
            setSearchQuery('');
            setSearchResults([]);
            fetchAccessRules();
        } catch (error) {
            console.error("Failed to grant access:", error);
            const errMsg = error.response?.data?.non_field_errors?.[0] || error.response?.data?.target_id?.[0] || "Failed to grant report access configuration.";
            showToast(errMsg, "error");
        }
    };

    // Revoke report access
    const handleRevokeAccess = async (ruleId, targetName) => {
        if (!window.confirm(`Are you sure you want to revoke reports access for ${targetName}?`)) {
            return;
        }

        try {
            await api.delete(`/api/report-access/${ruleId}/`);
            showToast(`Revoked access for ${targetName}`, "success");
            fetchAccessRules();
        } catch (error) {
            console.error("Failed to revoke access:", error);
            showToast("Failed to revoke report access configuration.", "error");
        }
    };

    return (
        <div style={{ padding: '0', background: 'transparent' }} className="animate-fade-in">
            {/* Header section */}
            <div className="master-page-header" style={{ padding: '20px 40px 0 40px', background: 'transparent', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                            Trip and Travel Reports
                        </h1>
                        {/* <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>
                            Review global trip statistics, bulk uploads, and user activity dashboard.
                        </p> */}
                    </div>

                    {/* Navigation Tabs */}
                    <div style={{ display: 'flex', gap: '12px', background: '#f1f5f9', padding: '6px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            style={{
                                padding: '10px 20px',
                                borderRadius: '10px',
                                fontSize: '0.9rem',
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: activeTab === 'dashboard' ? '#ffffff' : 'transparent',
                                color: activeTab === 'dashboard' ? 'var(--primary)' : '#64748b',
                                boxShadow: activeTab === 'dashboard' ? '0 4px 6px -1px rgba(0, 0, 0, 0.05)' : 'none'
                            }}
                        >
                            Reports Dashboard
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('access')}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    background: activeTab === 'access' ? '#ffffff' : 'transparent',
                                    color: activeTab === 'access' ? 'var(--primary)' : '#64748b',
                                    boxShadow: activeTab === 'access' ? '0 4px 6px -1px rgba(0, 0, 0, 0.05)' : 'none'
                                }}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <ShieldCheck size={16} />
                                    Access Control
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main content body */}
            <div style={{ padding: '30px 40px' }}>
                {activeTab === 'dashboard' ? (
                    <>
                        {/* Stats Dashboard Grid */}
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                            gap: '24px', 
                            marginBottom: '24px' 
                        }}>
                            {/* Card 1: Trips Created */}
                            <div 
                                onClick={() => setActiveModal('trips')}
                                style={{
                                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '20px',
                                    padding: '24px',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '20px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-5px)';
                                    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                                    e.currentTarget.style.borderColor = 'var(--primary)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)';
                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                }}
                            >
                                <div style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '16px',
                                    backgroundColor: '#e0f2fe',
                                    color: '#0284c7',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <Plane size={28} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Trips Created</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                                        {statsLoading ? <Loader2 className="animate-spin" size={24} /> : stats.trips_count}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--primary)' }}>Click to view details</div>
                                </div>
                            </div>

                            {/* Card 2: Bulk Uploads (Tour Plans) */}
                            <div 
                                onClick={() => setActiveModal('batches')}
                                style={{
                                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '20px',
                                    padding: '24px',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '20px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-5px)';
                                    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                                    e.currentTarget.style.borderColor = 'var(--primary)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)';
                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                }}
                            >
                                <div style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '16px',
                                    backgroundColor: '#fdf2e9',
                                    color: '#ea580c',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <UploadCloud size={28} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Bulk Uploads (Tour Plans)</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                                        {statsLoading ? (
                                            <Loader2 className="animate-spin" size={24} />
                                        ) : (
                                            `${stats.batches_count} / ${new Set((stats.batches || []).map(b => b.user_id).filter(Boolean)).size}`
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--primary)' }}>Click to view details</div>
                                </div>
                            </div>

                            {/* Card 3: Unique Active Users */}
                            <div 
                                onClick={() => setActiveModal('users')}
                                style={{
                                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '20px',
                                    padding: '24px',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '20px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-5px)';
                                    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                                    e.currentTarget.style.borderColor = 'var(--primary)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)';
                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                }}
                            >
                                <div style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '16px',
                                    backgroundColor: '#f0fdf4',
                                    color: '#16a34a',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <Users size={28} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Unique Active Users</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                                        {statsLoading ? <Loader2 className="animate-spin" size={24} /> : stats.users_count}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--primary)' }}>Click to view details</div>
                                </div>
                            </div>
                        </div>

                        {/* Filter Bar */}
                        <div className="filters-bar glass" style={{ 
                            background: 'rgba(255, 255, 255, 0.6)', 
                            padding: '24px', 
                            borderRadius: '24px', 
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.05)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex',
                            gap: '20px',
                            alignItems: 'flex-end',
                            flexWrap: 'wrap',
                            marginBottom: '24px'
                        }}>
                            {/* Month Filter */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '200px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                    <Calendar size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                                    Month Filter
                                </label>
                                <MonthYearPicker
                                    value={selectedMonth}
                                    placeholder="Select Month (Custom Range)"
                                    onChange={(val) => {
                                        setSelectedMonth(val);
                                        if (val) {
                                            const [start, end] = val.split('|');
                                            setFilters(prev => ({
                                                ...prev,
                                                startDate: start,
                                                endDate: end
                                            }));
                                        } else {
                                            setFilters(prev => ({
                                                ...prev,
                                                startDate: '',
                                                endDate: ''
                                            }));
                                        }
                                    }}
                                />
                            </div>

                            {/* Start Date */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '200px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                    <Calendar size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                                    Start Date
                                </label>
                                <input 
                                    type="date"
                                    value={filters.startDate}
                                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: '1px solid #cbd5e1',
                                        background: 'white',
                                        fontSize: '0.9rem',
                                        color: '#334155',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* End Date */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '200px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                    <Calendar size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                                    End Date
                                </label>
                                <input 
                                    type="date"
                                    value={filters.endDate}
                                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: '1px solid #cbd5e1',
                                        background: 'white',
                                        fontSize: '0.9rem',
                                        color: '#334155',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Project Dropdown */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1.5, minWidth: '250px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>Project Filter</label>
                                <select 
                                    value={filters.project}
                                    onChange={(e) => setFilters(prev => ({ ...prev, project: e.target.value }))}
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: '1px solid #cbd5e1',
                                        background: 'white',
                                        fontSize: '0.9rem',
                                        color: '#334155',
                                        outline: 'none'
                                    }}
                                >
                                    <option value="All">All Projects</option>
                                    {projectsLoading ? (
                                        <option disabled>Loading projects...</option>
                                    ) : (
                                        projects.map(proj => (
                                            <option key={proj.code} value={proj.code}>
                                                {proj.name} ({proj.code})
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {/* Reset Button */}
                            <button
                                onClick={() => {
                                    setFilters({ startDate: '', endDate: '', project: 'All' });
                                    setSelectedMonth('');
                                }}
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '12px',
                                    background: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    color: '#475569',
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    height: '46px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                            >
                                <RefreshCcw size={16} />
                                Reset Filters
                            </button>
                        </div>

                        {/* Inline Statistics Details at the bottom */}
                        <div ref={detailsRef} style={{ scrollMarginTop: '20px' }}>
                            {!activeModal ? (
                                <div style={{
                                    padding: '40px',
                                    background: '#ffffff',
                                    borderRadius: '24px',
                                    border: '1px solid #e2e8f0',
                                    textAlign: 'center',
                                    color: '#64748b'
                                }}>
                                    <BarChart3 size={48} style={{ color: 'var(--primary)', marginBottom: '16px', opacity: 0.6 }} />
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                                        Select a Stat Stack Card Above
                                    </h3>
                                    <p style={{ fontSize: '0.95rem', maxWidth: '500px', margin: '0 auto', lineHeight: '1.5' }}>
                                        Click on the Trips, Bulk Uploads, or Active Users card to open the detailed interactive reports and download raw data.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Status Count Dashboard Panel */}
                                    {['trips', 'batches'].includes(activeModal) && (
                                        <div style={{
                                            display: 'flex',
                                            gap: '12px',
                                            flexWrap: 'wrap',
                                            alignItems: 'center'
                                        }}>
                                            {/* Total Employees Card */}
                                            <div 
                                                style={{
                                                    padding: '10px 16px',
                                                    borderRadius: '12px',
                                                    backgroundColor: '#ffffff',
                                                    border: '1px solid #e2e8f0',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    color: '#334155',
                                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
                                                }}
                                            >
                                                <Users size={16} style={{ color: 'var(--primary)' }} />
                                                <span>Total Employees:</span>
                                                <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
                                                    {totalEmployees}
                                                </span>
                                            </div>

                                            {/* Status Count Cards */}
                                            {Object.entries(statusCounts)
                                                .filter(([statusName, count]) => {
                                                    if (activeModal === 'trips' && statusName === 'Not Submitted') {
                                                        return false;
                                                    }
                                                    return count > 0;
                                                })
                                                .map(([statusName, count]) => {
                                                    const style = getStatusStyle(statusName);
                                                    const isSelected = modalFilters.status === statusName;
                                                    return (
                                                        <button
                                                            key={statusName}
                                                            onClick={() => setModalFilters(prev => ({
                                                                ...prev,
                                                                status: isSelected ? 'All' : statusName
                                                            }))}
                                                            style={{
                                                                padding: '10px 16px',
                                                                borderRadius: '12px',
                                                                backgroundColor: isSelected ? style.background : '#ffffff',
                                                                border: isSelected ? style.border : '1px solid #e2e8f0',
                                                                color: style.color,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                outline: 'none',
                                                                boxShadow: isSelected ? '0 4px 6px -1px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(0, 0, 0, 0.02)',
                                                                transform: isSelected ? 'scale(1.02)' : 'none'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (!isSelected) {
                                                                    e.currentTarget.style.backgroundColor = style.background;
                                                                    e.currentTarget.style.borderColor = style.border;
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (!isSelected) {
                                                                    e.currentTarget.style.backgroundColor = '#ffffff';
                                                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                                                }
                                                            }}
                                                        >
                                                            <span style={{
                                                                width: '8px',
                                                                height: '8px',
                                                                borderRadius: '50%',
                                                                backgroundColor: style.color
                                                            }} />
                                                            <span>{statusName}:</span>
                                                            <span style={{ fontSize: '1rem', fontWeight: 800 }}>{count}</span>
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    )}

                                    <div style={{
                                        backgroundColor: '#ffffff',
                                        borderRadius: '24px',
                                        border: '1px solid #e2e8f0',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
                                        overflow: 'hidden'
                                    }}>
                                    {/* Header */}
                                    <div style={{
                                        padding: '24px 32px',
                                        borderBottom: '1px solid #f1f5f9',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div>
                                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                                {activeModal === 'trips' && 'Trips Created Detail'}
                                                {activeModal === 'batches' && 'Bulk Uploads (Tour Plans) Detail'}
                                                {activeModal === 'users' && 'Unique Active Users Detail'}
                                            </h2>
                                            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
                                                {activeModal === 'trips' && `Showing ${filteredTrips.length} of ${totalTripsCount} trips created`}
                                                {activeModal === 'batches' && `Showing ${filteredBatches.length} of ${totalBatchesCount} bulk uploads`}
                                                {activeModal === 'users' && `Showing ${filteredUsers.length} of ${stats.users.length} unique active users`}
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => setActiveModal(null)}
                                            style={{
                                                border: 'none',
                                                background: '#f1f5f9',
                                                borderRadius: '50%',
                                                width: '36px',
                                                height: '36px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                color: '#64748b',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    {/* Filter Bar */}
                                    <div style={{
                                        padding: '16px 32px',
                                        background: '#f8fafc',
                                        borderBottom: '1px solid #e2e8f0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '20px',
                                        flexWrap: 'wrap'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Month:</span>
                                                <MonthYearPicker
                                                    value={selectedMonth}
                                                    placeholder="Select Month"
                                                    style={{
                                                        padding: '6px 12px',
                                                        borderRadius: '10px',
                                                        fontSize: '0.85rem'
                                                    }}
                                                    onChange={(val) => {
                                                        setSelectedMonth(val);
                                                        if (val) {
                                                            const [start, end] = val.split('|');
                                                            setModalFilters(prev => ({ ...prev, startDate: start, endDate: end }));
                                                            setFilters(prev => ({ ...prev, startDate: start, endDate: end }));
                                                        } else {
                                                            setModalFilters(prev => ({ ...prev, startDate: '', endDate: '' }));
                                                            setFilters(prev => ({ ...prev, startDate: '', endDate: '' }));
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>From:</span>
                                                <input 
                                                    type="date" 
                                                    value={modalFilters.startDate}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setModalFilters(prev => ({ ...prev, startDate: val }));
                                                        setFilters(prev => ({ ...prev, startDate: val }));
                                                    }}
                                                    style={{
                                                        border: '1px solid #cbd5e1',
                                                        borderRadius: '10px',
                                                        padding: '6px 12px',
                                                        fontSize: '0.85rem',
                                                        color: '#334155'
                                                    }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>To:</span>
                                                <input 
                                                    type="date" 
                                                    value={modalFilters.endDate}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setModalFilters(prev => ({ ...prev, endDate: val }));
                                                        setFilters(prev => ({ ...prev, endDate: val }));
                                                    }}
                                                    style={{
                                                        border: '1px solid #cbd5e1',
                                                        borderRadius: '10px',
                                                        padding: '6px 12px',
                                                        fontSize: '0.85rem',
                                                        color: '#334155'
                                                    }}
                                                />
                                            </div>

                                            {['trips', 'batches'].includes(activeModal) && (
                                                <>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Status:</span>
                                                        <select 
                                                            value={modalFilters.status}
                                                            onChange={(e) => setModalFilters(prev => ({ ...prev, status: e.target.value }))}
                                                            style={{
                                                                border: '1px solid #cbd5e1',
                                                                borderRadius: '10px',
                                                                padding: '6px 12px',
                                                                fontSize: '0.85rem',
                                                                color: '#334155',
                                                                background: 'white'
                                                            }}
                                                        >
                                                            <option value="All">All Statuses</option>
                                                            {Object.entries(statusCounts)
                                                                .filter(([statusName, count]) => {
                                                                    if (activeModal === 'trips' && statusName === 'Not Submitted') {
                                                                        return false;
                                                                    }
                                                                    return count > 0;
                                                                })
                                                                .map(([statusName]) => (
                                                                    <option key={statusName} value={statusName}>{statusName}</option>
                                                                ))
                                                            }
                                                        </select>
                                                    </div>

                                                    <div ref={rolesDropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Roles:</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setRolesDropdownOpen(!rolesDropdownOpen)}
                                                            style={{
                                                                border: '1px solid #cbd5e1',
                                                                borderRadius: '10px',
                                                                padding: '6px 12px',
                                                                fontSize: '0.85rem',
                                                                color: '#334155',
                                                                backgroundColor: '#ffffff',
                                                                outline: 'none',
                                                                transition: 'border-color 0.2s',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                gap: '8px',
                                                                minWidth: '130px',
                                                                maxWidth: '200px',
                                                                textAlign: 'left'
                                                            }}
                                                            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                                            onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                                                        >
                                                            <span style={{ 
                                                                overflow: 'hidden', 
                                                                textOverflow: 'ellipsis', 
                                                                whiteSpace: 'nowrap',
                                                                flex: 1
                                                            }}>
                                                                {modalFilters.selectedRoles.length === 0 
                                                                    ? 'All Roles' 
                                                                    : `${modalFilters.selectedRoles.length} Selected`}
                                                            </span>
                                                            <ChevronDown size={14} style={{ color: '#64748b', flexShrink: 0 }} />
                                                        </button>

                                                        {rolesDropdownOpen && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '100%',
                                                                left: '48px',
                                                                marginTop: '4px',
                                                                width: '280px',
                                                                maxHeight: '300px',
                                                                backgroundColor: '#ffffff',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: '10px',
                                                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                                                zIndex: 1000,
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                padding: '8px'
                                                            }}>
                                                                <div style={{ 
                                                                    display: 'flex', 
                                                                    alignItems: 'center', 
                                                                    gap: '6px',
                                                                    border: '1px solid #e2e8f0',
                                                                    borderRadius: '6px',
                                                                    padding: '4px 8px',
                                                                    marginBottom: '8px'
                                                                }}>
                                                                    <Search size={14} style={{ color: '#94a3b8' }} />
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Search roles..."
                                                                        value={rolesSearch}
                                                                        onChange={(e) => setRolesSearch(e.target.value)}
                                                                        style={{
                                                                            border: 'none',
                                                                            outline: 'none',
                                                                            fontSize: '0.8rem',
                                                                            width: '100%',
                                                                            color: '#334155'
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div style={{ 
                                                                    overflowY: 'auto', 
                                                                    flex: 1, 
                                                                    display: 'flex', 
                                                                    flexDirection: 'column', 
                                                                    gap: '2px',
                                                                    maxHeight: '180px',
                                                                    paddingRight: '4px'
                                                                }}>
                                                                    {uniqueRoles.filter(role => 
                                                                        role.toLowerCase().includes(rolesSearch.toLowerCase())
                                                                    ).length === 0 ? (
                                                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '8px', textAlign: 'center' }}>
                                                                            No roles found
                                                                        </div>
                                                                    ) : (
                                                                        uniqueRoles.filter(role => 
                                                                            role.toLowerCase().includes(rolesSearch.toLowerCase())
                                                                        ).map(role => {
                                                                            const isChecked = modalFilters.selectedRoles.includes(role);
                                                                            return (
                                                                                <label 
                                                                                    key={role} 
                                                                                    style={{
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        gap: '8px',
                                                                                        padding: '6px 8px',
                                                                                        borderRadius: '6px',
                                                                                        cursor: 'pointer',
                                                                                        fontSize: '0.8rem',
                                                                                        color: '#334155',
                                                                                        transition: 'background-color 0.15s',
                                                                                        backgroundColor: isChecked ? '#f1f5f9' : 'transparent'
                                                                                    }}
                                                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isChecked ? '#e2e8f0' : '#f8fafc'}
                                                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isChecked ? '#f1f5f9' : 'transparent'}
                                                                                >
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={isChecked}
                                                                                        onChange={() => {
                                                                                            setModalFilters(prev => {
                                                                                                const nextRoles = prev.selectedRoles.includes(role)
                                                                                                    ? prev.selectedRoles.filter(r => r !== role)
                                                                                                    : [...prev.selectedRoles, role];
                                                                                                return { ...prev, selectedRoles: nextRoles };
                                                                                            });
                                                                                        }}
                                                                                        style={{
                                                                                            accentColor: 'var(--primary)',
                                                                                            cursor: 'pointer'
                                                                                        }}
                                                                                    />
                                                                                    <span style={{ 
                                                                                        overflow: 'hidden', 
                                                                                        textOverflow: 'ellipsis', 
                                                                                        whiteSpace: 'nowrap' 
                                                                                    }}>{role}</span>
                                                                                </label>
                                                                            );
                                                                        })
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}

                                            {activeModal === 'users' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Designations:</span>
                                                    <select 
                                                        value={modalFilters.role}
                                                        onChange={(e) => setModalFilters(prev => ({ ...prev, role: e.target.value }))}
                                                        style={{
                                                            border: '1px solid #cbd5e1',
                                                            borderRadius: '10px',
                                                            padding: '6px 12px',
                                                            fontSize: '0.85rem',
                                                            color: '#334155',
                                                            background: 'white'
                                                        }}
                                                    >
                                                        <option value="All">All Designations</option>
                                                        {['All', ...new Set((stats.users || []).map(u => u.designation).filter(Boolean))].map(role => (
                                                            role !== 'All' && <option key={role} value={role}>{role}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>

                                        <button 
                                            onClick={handleModalExport}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '8px 16px',
                                                borderRadius: '10px',
                                                background: 'var(--primary)',
                                                color: '#ffffff',
                                                border: 'none',
                                                fontWeight: 700,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Download size={14} />
                                            Export CSV
                                        </button>
                                    </div>


                                    {/* Table Content */}
                                    <div style={{
                                        padding: '24px 32px',
                                        overflowY: 'auto',
                                        maxHeight: '600px'
                                    }}>
                                        {activeModal === 'trips' && (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>
                                                        <th style={{ padding: '12px 16px' }}>Trip ID</th>
                                                        <th style={{ padding: '12px 16px' }}>Created By</th>
                                                        <th style={{ padding: '12px 16px' }}>Source</th>
                                                        <th style={{ padding: '12px 16px' }}>Destination</th>
                                                        <th style={{ padding: '12px 16px' }}>Travel Dates</th>
                                                        <th style={{ padding: '12px 16px' }}>Status</th>
                                                        <th style={{ padding: '12px 16px' }}>Created At</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredTrips.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                                                                No trips match the selected criteria.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        filteredTrips.map(trip => (
                                                            <tr key={trip.trip_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                <td style={{ padding: '16px 16px' }}>
                                                                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>{trip.trip_id}</span>
                                                                </td>
                                                                <td style={{ padding: '16px 16px' }}>
                                                                    <div style={{ fontWeight: 700, color: '#334155' }}>{trip.user_name}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{trip.user_id}</div>
                                                                    {trip.user_designation && (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{trip.user_designation}</span>
                                                                        </div>
                                                                    )}
                                                                    {trip.user_position_code && (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                                                                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{trip.user_position_code}</span>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '16px 16px', color: '#475569', fontWeight: 600 }}>{trip.source}</td>
                                                                <td style={{ padding: '16px 16px', color: '#475569', fontWeight: 600 }}>{trip.destination}</td>
                                                                <td style={{ padding: '16px 16px', color: '#334155' }}>
                                                                    <div style={{ fontWeight: 600 }}>
                                                                        {trip.start_date ? format(new Date(trip.start_date), 'MMM dd, yyyy') : '—'}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                                                        to {trip.end_date ? format(new Date(trip.end_date), 'MMM dd, yyyy') : '—'}
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '16px 16px' }}>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                        <span style={{
                                                                            padding: '4px 8px',
                                                                            borderRadius: '6px',
                                                                            fontSize: '0.75rem',
                                                                            fontWeight: 700,
                                                                            display: 'inline-block',
                                                                            width: 'fit-content',
                                                                            ...getStatusStyle(trip.status)
                                                                        }}>{getStatusTranslation(trip.status)}</span>
                                                                        {['Pending', 'Submitted', 'Resubmitted', 'Forwarded', 'Manager Approved', 'Claim Submitted', 'Claim Resubmitted', 'PENDING_HR', 'PENDING_EXECUTIVE', 'PENDING_HEAD', 'PENDING_FINAL_RELEASE'].includes(trip.status) && trip.current_approver_name && (
                                                                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Waiting for: {trip.current_approver_name}</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '16px 16px', fontSize: '0.8rem', color: '#64748b' }}>
                                                                    {trip.created_at ? format(new Date(trip.created_at), 'PPp') : '—'}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        )}

                                        {activeModal === 'batches' && (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>
                                                        <th style={{ padding: '12px 16px' }}>Uploaded By</th>
                                                        <th style={{ padding: '12px 16px' }}>Travel Month</th>
                                                        <th style={{ padding: '12px 16px' }}>Trip ID</th>
                                                        <th style={{ padding: '12px 16px' }}>File Name</th>
                                                        <th style={{ padding: '12px 16px' }}>Status</th>
                                                        <th style={{ padding: '12px 16px' }}>Uploaded At</th>
                                                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredBatches.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                                                                No bulk upload batches match the selected criteria.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        filteredBatches.map(batch => (
                                                            <React.Fragment key={batch.id}>
                                                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                    <td style={{ padding: '16px 16px' }}>
                                                                        <div style={{ fontWeight: 700, color: '#334155' }}>{batch.user_name}</div>
                                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{batch.user_id}</div>
                                                                        {batch.user_designation && (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{batch.user_designation}</span>
                                                                            </div>
                                                                        )}
                                                                        {batch.user_position_code && (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                                                                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{batch.user_position_code}</span>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td style={{ padding: '16px 16px' }}>
                                                                        {batch.trip_start_date ? (
                                                                            <span style={{
                                                                                display: 'inline-block',
                                                                                padding: '4px 10px',
                                                                                borderRadius: '8px',
                                                                                background: '#eff6ff',
                                                                                color: '#2563eb',
                                                                                fontWeight: 700,
                                                                                fontSize: '0.8rem'
                                                                            }}>
                                                                                {format(new Date(batch.trip_start_date), 'MMMM yyyy')}
                                                                            </span>
                                                                        ) : (
                                                                            <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.8rem' }}>—</span>
                                                                        )}
                                                                    </td>
                                                                    <td style={{ padding: '16px 16px' }}>
                                                                        {batch.trip_id
                                                                            ? <span style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>{batch.trip_id}</span>
                                                                            : <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.8rem' }}>—</span>
                                                                        }
                                                                    </td>
                                                                    <td style={{ padding: '16px 16px', color: '#475569', fontWeight: 500 }}>{batch.file_name}</td>
                                                                    <td style={{ padding: '16px 16px' }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                            <span style={{
                                                                                padding: '4px 8px',
                                                                                borderRadius: '6px',
                                                                                fontSize: '0.75rem',
                                                                                fontWeight: 700,
                                                                                display: 'inline-block',
                                                                                width: 'fit-content',
                                                                                ...getStatusStyle(batch.status)
                                                                            }}>{getStatusTranslation(batch.status)}</span>
                                                                            {['Pending', 'Submitted', 'Resubmitted', 'Forwarded', 'Manager Approved', 'Claim Submitted', 'Claim Resubmitted', 'PENDING_HR', 'PENDING_EXECUTIVE', 'PENDING_HEAD', 'PENDING_FINAL_RELEASE'].includes(batch.status) && batch.current_approver_name && (
                                                                                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Waiting for: {batch.current_approver_name}</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ padding: '16px 16px', fontSize: '0.8rem', color: '#64748b' }}>
                                                                        {batch.created_at ? format(new Date(batch.created_at), 'PPp') : '—'}
                                                                    </td>
                                                                    <td style={{ padding: '16px 16px', textAlign: 'right' }}>
                                                                        {batch.status !== 'Not Submitted' && (
                                                                            <button 
                                                                                onClick={() => handleViewBatchDetails(batch)}
                                                                                style={{
                                                                                    border: 'none',
                                                                                    background: expandedBatch === batch.id ? 'var(--primary)' : '#f1f5f9',
                                                                                    color: expandedBatch === batch.id ? '#ffffff' : 'var(--primary)',
                                                                                    padding: '6px 12px',
                                                                                    borderRadius: '8px',
                                                                                    fontWeight: 700,
                                                                                    fontSize: '0.8rem',
                                                                                    cursor: 'pointer',
                                                                                    transition: 'all 0.2s',
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '4px'
                                                                                }}
                                                                                onMouseEnter={(e) => {
                                                                                    if (expandedBatch !== batch.id) {
                                                                                        e.currentTarget.style.background = '#e2e8f0';
                                                                                    }
                                                                                }}
                                                                                onMouseLeave={(e) => {
                                                                                    if (expandedBatch !== batch.id) {
                                                                                        e.currentTarget.style.background = '#f1f5f9';
                                                                                    }
                                                                                }}
                                                                            >
                                                                                {expandedBatch === batch.id ? 'Hide Details' : 'View Details'}
                                                                                {expandedBatch === batch.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                                {expandedBatch === batch.id && (
                                                                    <tr>
                                                                        <td colSpan="6" style={{ backgroundColor: '#f8fafc', padding: '20px 32px' }}>
                                                                            <div style={{ 
                                                                                borderLeft: '4px solid var(--primary)', 
                                                                                paddingLeft: '20px',
                                                                                display: 'flex', 
                                                                                flexDirection: 'column', 
                                                                                gap: '12px'
                                                                            }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' }}>
                                                                                    <h4 style={{ 
                                                                                        margin: 0,
                                                                                        fontSize: '0.85rem', 
                                                                                        fontWeight: 800, 
                                                                                        color: '#1e293b', 
                                                                                        textTransform: 'uppercase', 
                                                                                        letterSpacing: '0.05em' 
                                                                                    }}>Uploaded Rows Detail</h4>
                                                                                    {batch.rows && batch.rows.length > 0 && (
                                                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                                                            <button
                                                                                                onClick={(e) => handleSingleBatchExport(batch, 'original', e)}
                                                                                                style={{
                                                                                                    display: 'flex',
                                                                                                    alignItems: 'center',
                                                                                                    gap: '6px',
                                                                                                    padding: '6px 12px',
                                                                                                    borderRadius: '8px',
                                                                                                    fontWeight: 700,
                                                                                                    fontSize: '0.75rem',
                                                                                                    background: '#64748b',
                                                                                                    color: '#ffffff',
                                                                                                    border: 'none',
                                                                                                    cursor: 'pointer',
                                                                                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                                                                                    transition: 'all 0.2s'
                                                                                                }}
                                                                                                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                                                                                                onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                                                                                            >
                                                                                                <Download size={14} />
                                                                                                Download Original Plan
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={(e) => handleSingleBatchExport(batch, 'final', e)}
                                                                                                style={{
                                                                                                    display: 'flex',
                                                                                                    alignItems: 'center',
                                                                                                    gap: '6px',
                                                                                                    padding: '6px 12px',
                                                                                                    borderRadius: '8px',
                                                                                                    fontWeight: 700,
                                                                                                    fontSize: '0.75rem',
                                                                                                    background: 'var(--primary)',
                                                                                                    color: '#ffffff',
                                                                                                    border: 'none',
                                                                                                    cursor: 'pointer',
                                                                                                    boxShadow: '0 2px 4px rgba(0, 128, 128, 0.15)',
                                                                                                    transition: 'all 0.2s'
                                                                                                }}
                                                                                                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                                                                                                onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                                                                                            >
                                                                                                <Download size={14} />
                                                                                                Download Final Claim
                                                                                            </button>
                                                                                            {batch.trip_id && (
                                                                                                <button
                                                                                                    onClick={(e) => handleDownloadTripPDF(batch.trip_id, e)}
                                                                                                    style={{
                                                                                                        display: 'flex',
                                                                                                        alignItems: 'center',
                                                                                                        gap: '6px',
                                                                                                        padding: '6px 12px',
                                                                                                        borderRadius: '8px',
                                                                                                        fontWeight: 700,
                                                                                                        fontSize: '0.75rem',
                                                                                                        background: '#ef4444',
                                                                                                        color: '#ffffff',
                                                                                                        border: 'none',
                                                                                                        cursor: 'pointer',
                                                                                                        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.15)',
                                                                                                        transition: 'all 0.2s'
                                                                                                    }}
                                                                                                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                                                                                                    onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                                                                                                >
                                                                                                    <FileText size={14} />
                                                                                                    Download Trip PDF
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                
                                                                                {!batch.rows || batch.rows.length === 0 ? (
                                                                                    <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                                                                                        No data rows found in this batch.
                                                                                    </div>
                                                                                ) : (
                                                                                    <div style={{ 
                                                                                        maxHeight: '300px', 
                                                                                        overflowY: 'auto', 
                                                                                        border: '1px solid #e2e8f0', 
                                                                                        borderRadius: '12px', 
                                                                                        backgroundColor: '#ffffff',
                                                                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)'
                                                                                    }}>
                                                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                                                                            <thead style={{ backgroundColor: '#f1f5f9', position: 'sticky', top: 0, zIndex: 10 }}>
                                                                                                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 700 }}>
                                                                                                    <th style={{ padding: '10px 12px' }}>Date</th>
                                                                                                    <th style={{ padding: '10px 12px' }}>Mode</th>
                                                                                                    <th style={{ padding: '10px 12px' }}>Vehicle</th>
                                                                                                    <th style={{ padding: '10px 12px' }}>Route (From &rarr; To)</th>
                                                                                                    <th style={{ padding: '10px 12px' }}>Odometer</th>
                                                                                                    <th style={{ padding: '10px 12px' }}>Timings</th>
                                                                                                    <th style={{ padding: '10px 12px' }}>Visit Intent</th>
                                                                                                    <th style={{ padding: '10px 12px' }}>Remarks</th>
                                                                                                </tr>
                                                                                            </thead>
                                                                                            <tbody>
                                                                                                {batch.rows.map((row, rIdx) => (
                                                                                                    <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                                                                                                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.date || row.Date || '—'}</td>
                                                                                                        <td style={{ padding: '10px 12px' }}>
                                                                                                            {(() => {
                                                                                                                const plannedMode = row.mode || '—';
                                                                                                                const actualMode = row.actual_mode || '';
                                                                                                                const modeChanged = actualMode && plannedMode && actualMode.trim().toLowerCase() !== plannedMode.trim().toLowerCase();
                                                                                                                if (modeChanged) {
                                                                                                                    return (
                                                                                                                        <div>
                                                                                                                            <span style={{ fontWeight: 600, color: '#f97316' }}>{actualMode}</span>
                                                                                                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Planned: {plannedMode}</div>
                                                                                                                        </div>
                                                                                                                    );
                                                                                                                }
                                                                                                                return plannedMode;
                                                                                                            })()}
                                                                                                        </td>
                                                                                                        <td style={{ padding: '10px 12px' }}>
                                                                                                            {(() => {
                                                                                                                const plannedVehicle = row.vehicle || '—';
                                                                                                                const actualVehicle = row.actual_vehicle || '';
                                                                                                                const vehicleChanged = actualVehicle && plannedVehicle && actualVehicle.trim().toLowerCase() !== plannedVehicle.trim().toLowerCase();
                                                                                                                if (vehicleChanged) {
                                                                                                                    return (
                                                                                                                        <div>
                                                                                                                            <span style={{ fontWeight: 600, color: '#f97316' }}>{actualVehicle}</span>
                                                                                                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Planned: {plannedVehicle}</div>
                                                                                                                        </div>
                                                                                                                    );
                                                                                                                }
                                                                                                                return plannedVehicle;
                                                                                                            })()}
                                                                                                        </td>
                                                                                                        <td style={{ padding: '10px 12px' }}>
                                                                                                            {(() => {
                                                                                                                const origin = row.origin_route || '—';
                                                                                                                const destination = row.destination_route || '—';
                                                                                                                return (
                                                                                                                    <div>
                                                                                                                        <span style={{ fontWeight: 600 }}>{origin} &rarr; {destination}</span>
                                                                                                                    </div>
                                                                                                                );
                                                                                                            })()}
                                                                                                        </td>
                                                                                                        <td style={{ padding: '10px 12px' }}>
                                                                                                            {row.odo_start !== undefined ? (
                                                                                                                <div>
                                                                                                                    <div>Start: {row.odo_start}</div>
                                                                                                                    <div>End: {row.odo_end !== undefined ? row.odo_end : '—'}</div>
                                                                                                                </div>
                                                                                                            ) : '—'}
                                                                                                        </td>
                                                                                                        <td style={{ padding: '10px 12px' }}>
                                                                                                            <div>Start: {row.start_time || '—'}</div>
                                                                                                            <div>Reach: {row.reach_time || '—'}</div>
                                                                                                        </td>
                                                                                                        <td style={{ padding: '10px 12px' }}>{row.visit_intent || '—'}</td>
                                                                                                        <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: '#64748b' }}>{row.remarks || '—'}</td>
                                                                                                    </tr>
                                                                                                ))}
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        )}

                                        {activeModal === 'users' && (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>
                                                        <th style={{ padding: '12px 16px' }}>User Name</th>
                                                        <th style={{ padding: '12px 16px' }}>Email</th>
                                                        <th style={{ padding: '12px 16px' }}>Designation / Position</th>
                                                        <th style={{ padding: '12px 16px', textAlign: 'center' }}>Total Logins</th>
                                                        <th style={{ padding: '12px 16px' }}>Last Login</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredUsers.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                                                                No active users match the selected criteria.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        filteredUsers.map(u => (
                                                            <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                <td style={{ padding: '16px 16px', fontWeight: 700, color: '#334155' }}>{u.name}</td>
                                                                <td style={{ padding: '16px 16px', color: '#475569' }}>{u.email || '—'}</td>
                                                                <td style={{ padding: '16px 16px' }}>
                                                                    <div style={{ color: '#475569', fontWeight: 600 }}>{u.designation || '—'}</div>
                                                                    {u.position_code && (
                                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>Pos Code: {u.position_code}</div>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '16px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>
                                                                    {u.login_count}
                                                                </td>
                                                                <td style={{ padding: '16px 16px', fontSize: '0.8rem', color: '#64748b' }}>
                                                                    {u.last_login ? format(new Date(u.last_login), 'PPp') : '—'}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        </div>
                    </>
                ) : (
                    // Access Control View (Admin only)
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {/* Left Side: Grant Access Form */}
                        <div style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '24px',
                            padding: '24px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                        }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <UserPlus size={20} style={{ color: 'var(--primary)' }} />
                                Grant Report Access
                            </h2>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 20px 0' }}>
                                Search employees or positions to assign viewing permissions for this page.
                            </p>

                            {/* Profile Search Input */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Search Employee / Position</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        placeholder="Type name, employee code or position name..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px 12px 42px',
                                            borderRadius: '12px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.9rem',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                    <Search size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: '#94a3b8' }} />
                                    {searchLoading && <Loader2 size={18} className="animate-spin" style={{ position: 'absolute', right: '14px', top: '14px', color: 'var(--primary)' }} />}
                                </div>

                                {/* Dropdown Search Results */}
                                {searchResults.length > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '74px',
                                        left: 0,
                                        right: 0,
                                        background: '#ffffff',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '14px',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                        zIndex: 100,
                                        maxHeight: '300px',
                                        overflowY: 'auto',
                                        padding: '8px 0'
                                    }}>
                                        {searchResults.map((profile, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => {
                                                    setSelectedProfile(profile);
                                                    setIsGrantModalOpen(true);
                                                    setSearchResults([]);
                                                }}
                                                style={{
                                                    padding: '12px 16px',
                                                    cursor: 'pointer',
                                                    transition: 'background 0.2s',
                                                    borderBottom: idx < searchResults.length - 1 ? '1px solid #f1f5f9' : 'none'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                                                    {profile.employee_name} ({profile.employee_code})
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                                                    {profile.position_name} [{profile.position_code}]
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Side: Active Permissions Table */}
                        <div style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '24px',
                            padding: '24px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                        }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ShieldCheck size={20} style={{ color: 'var(--primary)' }} />
                                Active Report Access Configurations
                            </h2>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 20px 0' }}>
                                List of employees and positions currently allowed to access this reports page.
                            </p>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>
                                            <th style={{ padding: '12px 16px' }}>Access Type</th>
                                            <th style={{ padding: '12px 16px' }}>Target Entity</th>
                                            <th style={{ padding: '12px 16px' }}>Employee Details</th>
                                            <th style={{ padding: '12px 16px' }}>Position Details</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {accessRulesLoading ? (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '30px', textAlign: 'center' }}>
                                                    <Loader2 className="animate-spin" size={24} style={{ display: 'inline', color: 'var(--primary)' }} />
                                                    <span style={{ marginLeft: '10px', color: '#64748b' }}>Loading permissions...</span>
                                                </td>
                                            </tr>
                                        ) : accessRules.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                                                    No access rules found. Only default administrators can access reports.
                                                </td>
                                            </tr>
                                        ) : (
                                            accessRules.map((rule) => (
                                                <tr key={rule.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '16px 16px' }}>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 800,
                                                            textTransform: 'uppercase',
                                                            background: rule.access_type === 'employee' ? '#eef2ff' : '#ecfdf5',
                                                            color: rule.access_type === 'employee' ? '#4f46e5' : '#047857'
                                                        }}>{rule.access_type}</span>
                                                    </td>
                                                    <td style={{ padding: '16px 16px', fontWeight: 700, color: '#1e293b' }}>
                                                        {rule.target_name}
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
                                                            Code: {rule.target_id}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 16px' }}>
                                                        <div style={{ fontWeight: 600, color: '#334155' }}>{rule.employee_name || '—'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{rule.employee_code || '—'}</div>
                                                    </td>
                                                    <td style={{ padding: '16px 16px' }}>
                                                        <div style={{ fontWeight: 600, color: '#334155' }}>{rule.position_name || '—'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{rule.position_code || '—'}</div>
                                                    </td>
                                                    <td style={{ padding: '16px 16px', textAlign: 'center' }}>
                                                        <button
                                                            onClick={() => handleRevokeAccess(rule.id, rule.target_name)}
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: '#ef4444',
                                                                cursor: 'pointer',
                                                                padding: '6px',
                                                                borderRadius: '6px',
                                                                transition: 'background 0.2s'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                            title="Revoke Permission"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal 1: Grand Confirmation Modal for Access Configuration */}
            {isGrantModalOpen && selectedProfile && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.3)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '24px',
                        width: '90%',
                        maxWidth: '500px',
                        padding: '30px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        boxSizing: 'border-box'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Configure Access Permission</h2>
                            <button
                                onClick={() => {
                                    setIsGrantModalOpen(false);
                                    setSelectedProfile(null);
                                }}
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Profile Info Summary */}
                        <div style={{
                            padding: '16px',
                            background: '#f8fafc',
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            marginBottom: '20px'
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>EMPLOYEE NAME</div>
                                    <div style={{ fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>{selectedProfile.employee_name}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>EMPLOYEE CODE</div>
                                    <div style={{ fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>{selectedProfile.employee_code}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>POSITION NAME</div>
                                    <div style={{ fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>{selectedProfile.position_name}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>POSITION CODE</div>
                                    <div style={{ fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>{selectedProfile.position_code}</div>
                                </div>
                            </div>
                        </div>

                        {/* Access Grant Type Selector */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>
                                Permission Level
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '12px',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    background: grantType === 'employee' ? '#f5f3ff' : 'transparent',
                                    borderColor: grantType === 'employee' ? 'var(--primary)' : '#cbd5e1'
                                }}>
                                    <input
                                        type="radio"
                                        name="grantType"
                                        checked={grantType === 'employee'}
                                        onChange={() => setGrantType('employee')}
                                    />
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Specific Employee Access</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                            Only allows this employee ({selectedProfile.employee_code}) to view reports.
                                        </div>
                                    </div>
                                </label>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '12px',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    background: grantType === 'position' ? '#f5f3ff' : 'transparent',
                                    borderColor: grantType === 'position' ? 'var(--primary)' : '#cbd5e1'
                                }}>
                                    <input
                                        type="radio"
                                        name="grantType"
                                        checked={grantType === 'position'}
                                        onChange={() => setGrantType('position')}
                                    />
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Entire Position Access</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                            Allows anyone currently holding the position ({selectedProfile.position_code}) to view reports.
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Confirmation Buttons */}
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    setIsGrantModalOpen(false);
                                    setSelectedProfile(null);
                                }}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    background: 'transparent',
                                    color: '#475569',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGrantAccess}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: 'var(--primary)',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                Grant Access
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default TravelReports;
