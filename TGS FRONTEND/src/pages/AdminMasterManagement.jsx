import React, { useState, useEffect } from 'react';
import api from '../api/api';
import {
    Plus, Edit2, Trash2, AlignLeft, Layers, AlertCircle, RotateCcw, Eye, EyeOff, Search,
    Briefcase, Zap, MapPin, Coffee, Shield, ShieldAlert, X, Save, Settings, Download, Upload, ChevronDown, Award
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import '../styles/AdminMasterManagement.css';

const CONFIG_GROUPS = [
    {
        id: 'travel',
        label: 'Long Distance',
        icon: <Briefcase size={18} />,
        tables: [
            { id: 'travel-mode', name: 'Travel Modes', endpoint: 'travel-mode-masters', fields: ['mode_name', 'status'] },
            { id: 'travel-provider', name: 'Providers', endpoint: 'provider-masters', fields: ['provider_name', 'is_flight', 'is_train', 'is_bus', 'is_intercity_cab', 'status'] },
            { id: 'travel-operator', name: 'Operators', endpoint: 'operator-masters', fields: ['operator_name', 'is_flight', 'is_train', 'is_bus', 'status'] },
            { id: 'travel-class', name: 'Travel Classes', endpoint: 'travel-class-masters', fields: ['class_name', 'is_flight', 'is_train', 'is_bus', 'status'] },
            { id: 'travel-vehicle', name: 'Vehicles', endpoint: 'vehicle-masters', fields: ['vehicle_name', 'is_bus', 'is_intercity_cab', 'status'] },
            { id: 'booking-type', name: 'Booking Types', endpoint: 'booking-type-masters', fields: ['booking_type', 'status'] },
            { id: 'ticket-status', name: 'Ticket Statuses', endpoint: 'ticket-status-masters', fields: ['status_name', 'is_flight', 'is_train', 'is_bus', 'is_intercity_cab', 'status'] },
            { id: 'quota-type', name: 'Quota Types', endpoint: 'quota-type-masters', fields: ['quota_name', 'status'] }
        ]
    },
    {
        id: 'local',
        label: 'Local Conveyance',
        icon: <Zap size={18} />,
        tables: [
            { id: 'local-mode', name: 'Travel Modes', endpoint: 'local-travel-mode-masters', fields: ['mode_name', 'status'] },
            { id: 'local-provider', name: 'Providers', endpoint: 'local-provider-masters', fields: ['provider_name', 'is_car', 'is_bike', 'is_auto', 'is_bus', 'is_metro', 'status'] },
            { id: 'local-subtype', name: 'Sub Types', endpoint: 'local-sub-type-masters', fields: ['sub_type', 'is_car', 'is_bike', 'is_auto', 'status'] }
        ]
    },
    {
        id: 'stay',
        label: 'Stay & Lodging',
        icon: <MapPin size={18} />,
        tables: [
            { id: 'stay-type', name: 'Stay Types', endpoint: 'stay-type-masters', fields: ['stay_type', 'status'] },
            { id: 'room-type', name: 'Room Types', endpoint: 'room-type-masters', fields: ['room_type', 'status'] },
            { id: 'stay-booking', name: 'Booking Types', endpoint: 'stay-booking-type-masters', fields: ['booking_type', 'status'] },
            { id: 'stay-source', name: 'Booking Sources', endpoint: 'stay-booking-source-masters', fields: ['source_name', 'status'] }
        ]
    },
    {
        id: 'food',
        label: 'Food & Refreshments',
        icon: <Coffee size={18} />,
        tables: [
            { id: 'meal-cat', name: 'Meal Categories', endpoint: 'meal-category-masters', fields: ['category_name', 'status'] },
            { id: 'meal-type', name: 'Meal Types', endpoint: 'meal-type-masters', fields: ['meal_type', 'status'] },
            { id: 'meal-source', name: 'Meal Sources', endpoint: 'meal-source-masters', fields: ['source_name', 'status'] },
            { id: 'meal-provider', name: 'Meal Providers', endpoint: 'meal-provider-masters', fields: ['provider_name', 'status'] }
        ]
    },
    {
        id: 'incidental',
        label: 'Incidental Expenses',
        icon: <Shield size={18} />,
        tables: [
            { id: 'incidental-type', name: 'Incidental Types', endpoint: 'incidental-type-masters', fields: ['expense_type', 'category', 'status'] }
        ]
    },
    {
        id: 'access',
        label: 'Access Control',
        icon: <Shield size={18} />,
        tables: [
            { id: 'roles', name: 'Role Permissions', endpoint: 'roles', fields: ['name', 'description'] }
        ]
    },
    {
        id: 'entitlement',
        label: 'Entitlement Policy',
        icon: <Layers size={18} />,
        tables: [
            { id: 'cadre-entitlement', name: 'Cadre Entitlements', endpoint: 'eligibility-rules', fields: [] }
        ]
    }
];

export default function AdminMasterManagement() {
    const { showToast } = useToast() || { showToast: () => { } };

    const [activeGroup, setActiveGroup] = useState(CONFIG_GROUPS[0]);
    const [activeTab, setActiveTab] = useState(CONFIG_GROUPS[0].tables[0]);

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fieldMetadata, setFieldMetadata] = useState({});

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const [showDeleted, setShowDeleted] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);

    // === Entitlement Policy state ===
    const [cadres, setCadres] = useState([]);
    const [rules, setRules] = useState({}); // { cadreId: ruleObj }
    const [editingCadre, setEditingCadre] = useState(null); // { cadre, rule }
    const [globalPolicyEnabled, setGlobalPolicyEnabled] = useState(true);

    const visibleFields = activeTab ? activeTab.fields : [];

    const handleBulkExport = async () => {
        setExporting(true);
        try {
            const response = await api.get(`/api/masters/bulk-export/?group=${activeGroup.id}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const filename = `${activeGroup.label.replace(/\s+/g, '_')}_Masters.xlsx`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            showToast(`Exported ${activeGroup.label} successfully`, "success");
        } catch (error) {
            console.error("Export failed", error);
            showToast("Failed to export masters", "error");
        } finally {
            setExporting(false);
        }
    };

    const handleBulkImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formDataObj = new FormData();
        formDataObj.append('file', file);
        formDataObj.append('group', activeGroup.id);
        setImporting(true);
        try {
            const response = await api.post('/api/masters/bulk-import/', formDataObj, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            const result = response.data;
            showToast(
                `Import completed! Created: ${result.total_created}, Updated: ${result.total_updated}`, 
                "success"
            );
            if (activeGroup.id === 'entitlement') {
                fetchEntitlementData();
            } else {
                fetchData();
            }
        } catch (error) {
            console.error("Import failed", error);
            const errMsg = error.response?.data?.error || "Failed to import masters";
            showToast(errMsg, "error");
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    const fetchEntitlementData = async () => {
        setLoading(true);
        try {
            const [cadresRes, rulesRes, globalRes] = await Promise.all([
                api.get('/api/masters/cadres/'),
                api.get('/api/masters/eligibility-rules/'),
                api.get('/api/masters/eligibility-rules/global-policy/').catch(() => ({ data: { enabled: true } }))
            ]);

            const cadresData = cadresRes.data?.results || cadresRes.data || [];
            const rulesData = rulesRes.data?.results || rulesRes.data || [];

            setCadres(cadresData);
            setGlobalPolicyEnabled(globalRes.data?.enabled !== false);

            const ruleMap = {};
            rulesData.forEach(r => {
                ruleMap[r.cadre] = r;
            });
            setRules(ruleMap);
        } catch (err) {
            console.error("Failed to fetch entitlement data", err);
            showToast("Failed to load entitlement policies", "error");
        } finally {
            setLoading(false);
        }
    };

    const toggleGlobalPolicy = async (newVal) => {
        try {
            const res = await api.post('/api/masters/eligibility-rules/global-policy/', { enabled: newVal });
            setGlobalPolicyEnabled(res.data?.enabled !== false);
            showToast(`Global policy enforcement ${newVal ? 'enabled' : 'disabled'}`, "success");
        } catch (err) {
            console.error("Failed to toggle global policy", err);
            showToast("Failed to update global policy status", "error");
        }
    };

    const toggleRuleActive = async (ruleId, cadreId, currentActiveState) => {
        try {
            const rule = rules[cadreId];
            if (!rule) {
                showToast("No policy configured for this cadre yet", "error");
                return;
            }
            const newVal = !currentActiveState;
            await api.patch(`/api/masters/eligibility-rules/${rule.id}/`, {
                is_active: newVal
            });
            showToast(`Policy status updated successfully`, "success");
            fetchEntitlementData();
        } catch (err) {
            console.error("Failed to toggle policy status", err);
            showToast("Failed to update policy status", "error");
        }
    };

    const saveEntitlementRule = async (cadreId, ruleData, cadreName, cadreDesc) => {
        try {
            let actualCadreId = cadreId;
            if (!actualCadreId) {
                // Create the cadre first via POST
                const cadreRes = await api.post(`/api/masters/cadres/`, {
                    name: cadreName,
                    description: cadreDesc,
                    designation_keywords: ruleData.designation_keywords || []
                });
                actualCadreId = cadreRes.data.id;
            } else {
                // First update cadre name/description
                await api.patch(`/api/masters/cadres/${cadreId}/`, {
                    name: cadreName,
                    description: cadreDesc,
                    designation_keywords: ruleData.designation_keywords || []
                });
            }

            const payload = {
                cadre: actualCadreId,
                is_active: ruleData.is_active,
                company_guest_house_status: ruleData.company_guest_house_status,
                accommodation_state_hq: ruleData.accommodation_state_hq,
                state_hq_clusters: ruleData.state_hq_clusters,
                accommodation_districts: ruleData.accommodation_districts,
                districts_clusters: ruleData.districts_clusters,
                accommodation_others: ruleData.accommodation_others,
                others_clusters: ruleData.others_clusters,
                daily_allowance_amount: ruleData.daily_allowance_amount,
                max_mileage_km: ruleData.max_mileage_km,
                laundry_days_threshold: ruleData.laundry_days_threshold,
                own_stay_state_hq_pct: ruleData.own_stay_state_hq_pct,
                own_stay_districts_pct: ruleData.own_stay_districts_pct,
                own_stay_others_pct: ruleData.own_stay_others_pct,
                travel_rules: ruleData.travel_rules,
                // Legacy fields mapping for backend safety
                ...ruleData.legacyFields
            };

            if (ruleData.id) {
                await api.patch(`/api/masters/eligibility-rules/${ruleData.id}/`, payload);
            } else {
                await api.post(`/api/masters/eligibility-rules/`, payload);
            }

            showToast("Policy saved successfully", "success");
            setEditingCadre(null);
            fetchEntitlementData();
        } catch (err) {
            console.error("Failed to save policy", err);
            showToast("Failed to save entitlement policy", "error");
        }
    };

    useEffect(() => {
        if (activeGroup.id === 'entitlement') {
            fetchEntitlementData();
        } else {
            fetchData();
        }
    }, [activeTab, activeGroup, showDeleted]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let url = `/api/${activeTab.endpoint}/`;
            if (showDeleted) url += '?include_deleted=true';

            // Try fetching field metadata
            try {
                const optionsRes = await api.options(url);
                const actions = optionsRes.data?.actions;
                if (actions && (actions.POST || actions.PUT)) {
                    setFieldMetadata(actions.POST || actions.PUT);
                } else {
                    setFieldMetadata({});
                }
            } catch (err) {
                console.warn("Could not fetch field metadata via OPTIONS", err);
                setFieldMetadata({});
            }

            const res = await api.get(url);
            const rawData = res.data?.results || (Array.isArray(res.data) ? res.data : []);
            setData(rawData);
        } catch (error) {
            console.error("Fetch failed", error);
            showToast("Failed to load table data", "error");
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenForm = (item = null) => {
        setCategoryDropdownOpen(false);
        setEditingItem(item);
        if (item) {
            setFormData({ 
                ...item,
                category: item.category ? [item.category] : []
            });
        } else {
            const initial = {};
            activeTab.fields.forEach(f => {
                if (fieldMetadata[f]?.type === 'boolean' || f.startsWith('is_') || f === 'status') {
                    initial[f] = false;
                } else if (f === 'category') {
                    initial[f] = ['general_incidental']; // Default as array
                } else {
                    initial[f] = '';
                }
            });
            setFormData(initial);
        }
        setIsFormOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (activeTab?.id === 'incidental-type') {
                const categories = Array.isArray(formData.category) ? formData.category : formData.category ? [formData.category] : [];
                if (categories.length === 0) {
                    showToast("Please select at least one category", "error");
                    return;
                }
                if (editingItem) {
                    await api.put(`/api/${activeTab.endpoint}/${editingItem.id}/`, {
                        ...formData,
                        category: categories[0]
                    });
                    for (let i = 1; i < categories.length; i++) {
                        await api.post(`/api/${activeTab.endpoint}/`, {
                            ...formData,
                            category: categories[i]
                        });
                    }
                    showToast("Updated successfully", "success");
                } else {
                    for (const cat of categories) {
                        await api.post(`/api/${activeTab.endpoint}/`, {
                            ...formData,
                            category: cat
                        });
                    }
                    showToast("Created successfully", "success");
                }
            } else {
                if (editingItem) {
                    await api.put(`/api/${activeTab.endpoint}/${editingItem.id}/`, formData);
                    showToast("Updated successfully", "success");
                } else {
                    await api.post(`/api/${activeTab.endpoint}/`, formData);
                    showToast("Created successfully", "success");
                }
            }
            setIsFormOpen(false);
            fetchData();
        } catch (error) {
            const errorData = error.response?.data;
            const firstFieldError = errorData && typeof errorData === 'object'
                ? Object.values(errorData).flat().find(Boolean)
                : null;
            showToast(firstFieldError || errorData?.detail || "Operation failed", "error");
        }
    };

    const confirmDelete = (id) => {
        setDeletingId(id);
        setIsConfirmOpen(true);
    };

    const handleDelete = async () => {
        try {
            if (activeGroup.id === 'entitlement') {
                await api.delete(`/api/masters/cadres/${deletingId}/`);
                showToast("Cadre and policy deleted successfully", "success");
                fetchEntitlementData();
            } else {
                await api.delete(`/api/${activeTab.endpoint}/${deletingId}/`);
                showToast("Deleted successfully", "success");
                fetchData();
            }
            setIsConfirmOpen(false);
        } catch (error) {
            const errorData = error.response?.data;
            const errorMsg = errorData?.detail || errorData?.error || "Deletion failed";
            showToast(errorMsg, "error");
        }
    };

    const handleRestore = async (id) => {
        try {
            await api.post(`/api/${activeTab.endpoint}/${id}/restore/`);
            showToast("Restored successfully", "success");
            fetchData();
        } catch (error) {
            showToast("Restoration failed", "error");
        }
    };

    const regFields = visibleFields.filter(f => !(fieldMetadata[f]?.type === 'boolean' || typeof formData[f] === 'boolean' || f.startsWith('is_') || f === 'status'));
    const boolFields = visibleFields.filter(f => (fieldMetadata[f]?.type === 'boolean' || typeof formData[f] === 'boolean' || f.startsWith('is_') || f === 'status'));

    return (
        <div className="admin-mgmt-module animate-fade-in" style={{ padding: '0', background: 'transparent' }}>
            <div className="master-page-header" style={{ padding: '20px 40px 0 40px', background: 'transparent', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px', letterSpacing: '-0.02em' }}>Master Management</h1>
                    </div>
                    {activeGroup.id !== 'access' && activeGroup.id !== 'entitlement' && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={handleBulkExport}
                                disabled={exporting}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 18px',
                                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.2)'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 12px -2px rgba(2, 132, 199, 0.3)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(2, 132, 199, 0.2)'; }}
                            >
                                <Download size={18} />
                                {exporting ? 'Exporting...' : `Export ${activeGroup.label}`}
                            </button>
                            
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 18px',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    cursor: importing ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 12px -2px rgba(16, 185, 129, 0.3)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(16, 185, 129, 0.2)'; }}
                            >
                                <Upload size={18} />
                                {importing ? 'Importing...' : `Import ${activeGroup.label}`}
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={handleBulkImport}
                                    disabled={importing}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                    )}
                </div>
            </div>

            <div className="content-inner-wrapper" style={{ padding: '20px 40px', maxWidth: '1600px', margin: '0 auto' }}>
                <div className="module-nav">
                    {CONFIG_GROUPS.map(group => (
                        <button
                            key={group.id}
                            className={`module-btn ${activeGroup.id === group.id ? 'active' : ''}`}
                            onClick={() => {
                                setActiveGroup(group);
                                if (group.tables && group.tables.length > 0) {
                                    setActiveTab(group.tables[0]);
                                } else {
                                    setActiveTab(null);
                                }
                            }}
                        >
                            {group.icon}
                            {group.label}
                        </button>
                    ))}
                </div>

                <div className="admin-content-grid" style={{ gridTemplateColumns: activeGroup.tables && activeGroup.tables.length > 0 ? '280px minmax(0, 1fr)' : 'minmax(0, 1fr)' }}>
                    {/* Sidebar */}
                    {activeGroup.tables && activeGroup.tables.length > 0 && (
                        <div className="sidebar-panel">
                            <h3 className="sidebar-title">Available Tables</h3>
                            <div className="master-selector-list">
                                {activeGroup.tables.map(table => (
                                    <button
                                        key={table.id}
                                        className={`master-selector-btn ${activeTab && activeTab.id === table.id ? 'active' : ''}`}
                                        onClick={() => setActiveTab(table)}
                                    >
                                        <AlignLeft size={16} style={{ marginRight: '10px' }} />
                                        {table.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Main Data Panel */}
                    <div className="main-table-panel">
                        {activeGroup.id === 'entitlement' ? (
                            <EntitlementDashboard
                                cadres={cadres}
                                rules={rules}
                                loading={loading}
                                globalPolicyEnabled={globalPolicyEnabled}
                                onToggleGlobalPolicy={toggleGlobalPolicy}
                                onEditPolicy={(cadre) => {
                                    const rule = rules[cadre.id] || {
                                        cadre: cadre.id,
                                        is_active: true,
                                        air_allowed: false,
                                        air_class: 'NA',
                                        train_allowed: true,
                                        train_class: 'NA',
                                        bus_allowed: true,
                                        bus_class: 'NA',
                                        car_allowed: false,
                                        car_notes: 'NA',
                                        local_conveyance_allowed: true,
                                        local_conveyance_type: 'NA',
                                        company_guest_house_status: 'Optional',
                                        accommodation_state_hq: 0,
                                        state_hq_clusters: ['Metropolitan'],
                                        accommodation_districts: 0,
                                        districts_clusters: ['Town', 'City'],
                                        accommodation_others: 0,
                                        others_clusters: ['Others'],
                                        daily_allowance_amount: 0,
                                        max_mileage_km: 0,
                                        own_stay_state_hq_pct: 50,
                                        own_stay_districts_pct: 50,
                                        own_stay_others_pct: 50,
                                        travel_rules: {}
                                    };
                                    setEditingCadre({ cadre, rule });
                                }}
                                onDeleteCadre={confirmDelete}
                                onAddCadre={() => {
                                    const defaultRule = {
                                        is_active: true,
                                        air_allowed: false,
                                        air_class: 'NA',
                                        train_allowed: true,
                                        train_class: 'NA',
                                        bus_allowed: true,
                                        bus_class: 'NA',
                                        car_allowed: false,
                                        car_notes: 'NA',
                                        local_conveyance_allowed: true,
                                        local_conveyance_type: 'NA',
                                        company_guest_house_status: 'Optional',
                                        accommodation_state_hq: 0,
                                        state_hq_clusters: ['Metropolitan'],
                                        accommodation_districts: 0,
                                        districts_clusters: ['Town', 'City'],
                                        accommodation_others: 0,
                                        others_clusters: ['Others'],
                                        daily_allowance_amount: 0,
                                        max_mileage_km: 0,
                                        own_stay_state_hq_pct: 50,
                                        own_stay_districts_pct: 50,
                                        own_stay_others_pct: 50,
                                        travel_rules: {}
                                    };
                                    setEditingCadre({ cadre: { name: '', description: '', designation_keywords: [] }, rule: defaultRule });
                                }}
                                onSyncCadres={async () => {
                                    setLoading(true);
                                    try {
                                        await api.post('/api/masters/cadres/sync/');
                                        showToast("Cadres synced from ERP successfully", "success");
                                        fetchEntitlementData();
                                    } catch (err) {
                                        showToast("Failed to sync cadres", "error");
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                onToggleActive={toggleRuleActive}
                            />
                        ) : (
                            <>
                                <div className="panel-header">
                                    <h2>{activeTab.name} Registry</h2>
                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                        <div style={{ position: 'relative' }}>
                                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                            <input 
                                                type="text" 
                                                placeholder="Search records..." 
                                                style={{ 
                                                    padding: '0 12px 0 38px', 
                                                    height: '40px', 
                                                    borderRadius: '10px', 
                                                    border: '1.5px solid #e2e8f0', 
                                                    fontSize: '14px',
                                                    width: '250px'
                                                }} 
                                                onChange={(e) => {
                                                    const term = e.target.value.toLowerCase();
                                                    if (!term) {
                                                        fetchData();
                                                    } else {
                                                        const filtered = data.filter(item => 
                                                            Object.values(item).some(val => 
                                                                String(val).toLowerCase().includes(term)
                                                            )
                                                        );
                                                        setData(filtered);
                                                    }
                                                }}
                                            />
                                        </div>
                                        <button
                                            className={`action-btn ${showDeleted ? 'active' : ''}`}
                                            style={{
                                                width: 'auto',
                                                padding: '0 12px',
                                                fontSize: '12px',
                                                height: '40px',
                                                display: 'flex',
                                                gap: '6px',
                                                alignItems: 'center',
                                                background: showDeleted ? 'var(--primary-light)' : '#f8fafc',
                                                border: `1.5px solid ${showDeleted ? 'var(--primary)' : '#e2e8f0'}`,
                                                color: showDeleted ? 'var(--primary)' : 'var(--text-muted)',
                                                borderRadius: '10px',
                                                fontWeight: '600'
                                            }}
                                            onClick={() => setShowDeleted(!showDeleted)}
                                        >
                                            {showDeleted ? <EyeOff size={16} /> : <Eye size={16} />}
                                            {showDeleted ? "Hide Inactive" : "Show Inactive"}
                                        </button>
                                        <button className="add-btn" onClick={() => handleOpenForm()}>
                                            <Plus size={20} />
                                            Define Record
                                        </button>
                                    </div>
                                </div>

                                <div className="data-table-container">
                                    {loading ? (
                                        <div className="loading-state">
                                            <div className="loader"></div>
                                            <p>Fetching data...</p>
                                        </div>
                                    ) : (
                                        <table className="modern-table">
                                            <thead>
                                                <tr>
                                                    <th>ID</th>
                                                    {visibleFields.map(f => (
                                                        <th key={f}>{f.replace(/_/g, ' ').toUpperCase()}</th>
                                                    ))}
                                                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.length > 0 ? data.map(item => (
                                                    <tr key={item.id} style={{ opacity: item.is_deleted ? 0.6 : 1 }}>
                                                        <td><span className="id-badge">#{item.id}</span></td>
                                                        {visibleFields.map(f => (
                                                            <td key={f}>
                                                                {fieldMetadata[f]?.type === 'boolean' || typeof item[f] === 'boolean' || f === 'status' || f.startsWith('is_') ? (
                                                                    <span className={`status-badge ${item[f] ? 'status-active' : 'status-inactive'}`}>
                                                                        {item[f] ? 'ACTIVE' : 'INACTIVE'}
                                                                    </span>
                                                                ) : f === 'category' ? (
                                                                    <span className="badge-secondary" style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', background: '#f1f5f9', color: 'var(--text-muted)', fontWeight: '600' }}>
                                                                        {String(item[f] || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ fontWeight: '500' }}>
                                                                        {item[f] === null || item[f] === undefined ? '—' : String(item[f])}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        ))}
                                                        <td style={{ textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                                {item.is_deleted ? (
                                                                    <button className="action-btn" style={{ color: 'var(--primary)' }} title="Restore" onClick={() => handleRestore(item.id)}>
                                                                        <RotateCcw size={16} />
                                                                    </button>
                                                                ) : (
                                                                    <>
                                                                        <button className="action-btn edit-btn" title="Edit" onClick={() => handleOpenForm(item)}>
                                                                            <Edit2 size={16} />
                                                                        </button>
                                                                        <button className="action-btn delete-btn" title="Delete" onClick={() => confirmDelete(item.id)}>
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan={visibleFields.length + 2} className="empty-row">No matching records found.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Modal for Add / Edit */}
                {isFormOpen && (
                    <div className="modal-overlay">
                        <div className="modal-content animate-pop-in" style={{ padding: '0', borderRadius: '32px', maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ padding: '32px 40px', borderBottom: '1px solid #f1f5f9', background: 'white', position: 'sticky', top: 0, zIndex: 10 }}>
                                <h2 className="modal-title" style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: 0 }}>{editingItem ? 'Update Registry' : 'Define New Entry'}</h2>
                            </div>
                            <div style={{ padding: '40px', overflowY: 'auto' }}>
                                <form onSubmit={handleSave} id="master-form">
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                                        {/* Regular Fields */}
                                        {regFields.map((field, idx) => (
                                            <div key={field} className="form-field" style={{ marginBottom: '0', gridColumn: regFields.length === 1 || idx === regFields.length - 1 && regFields.length % 2 !== 0 ? 'span 2' : 'auto' }}>
                                                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', display: 'block' }}>{field.replace(/_/g, ' ').toUpperCase()}</label>
                                                {field === 'category' ? (
                                                    <div style={{ position: 'relative' }}>
                                                        <div
                                                            className="form-input"
                                                            style={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                cursor: 'pointer',
                                                                minHeight: '44px',
                                                                background: '#ffffff',
                                                                borderColor: categoryDropdownOpen ? 'var(--primary)' : '#e2e8f0'
                                                            }}
                                                            onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                                                        >
                                                            <span style={{ color: (!formData[field] || (Array.isArray(formData[field]) && formData[field].length === 0)) ? '#cbd5e1' : 'inherit', fontSize: '14px', fontWeight: '500' }}>
                                                                {(() => {
                                                                    const val = formData[field];
                                                                    if (!val || (Array.isArray(val) && val.length === 0)) {
                                                                        return 'Select Categories';
                                                                    }
                                                                    const arrayVal = Array.isArray(val) ? val : [val];
                                                                    return arrayVal.map(v => {
                                                                        if (v === 'local_conveyance') return 'Local Conveyance';
                                                                        if (v === 'travel_incidental') return 'Travel Incidental';
                                                                        if (v === 'general_incidental') return 'General Incidental';
                                                                        return v;
                                                                    }).join(', ');
                                                                })()}
                                                            </span>
                                                            <ChevronDown size={18} style={{ color: '#64748b', transform: categoryDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                                                        </div>

                                                        {categoryDropdownOpen && (
                                                            <>
                                                                <div 
                                                                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
                                                                    onClick={() => setCategoryDropdownOpen(false)}
                                                                />
                                                                <div style={{
                                                                    position: 'absolute',
                                                                    top: 'calc(100% + 4px)',
                                                                    left: 0,
                                                                    right: 0,
                                                                    background: '#ffffff',
                                                                    border: '1.5px solid #e2e8f0',
                                                                    borderRadius: '12px',
                                                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                                                    zIndex: 999,
                                                                    padding: '8px',
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    gap: '4px'
                                                                }}>
                                                                    {[
                                                                        { value: 'local_conveyance', label: 'Local Conveyance' },
                                                                        { value: 'travel_incidental', label: 'Travel Incidental' },
                                                                        { value: 'general_incidental', label: 'General Incidental' }
                                                                    ].map(opt => {
                                                                        const val = formData[field];
                                                                        const arrayVal = Array.isArray(val) ? val : val ? [val] : [];
                                                                        const isSelected = arrayVal.includes(opt.value);
                                                                        return (
                                                                            <div
                                                                                key={opt.value}
                                                                                style={{
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '10px',
                                                                                    padding: '8px 12px',
                                                                                    borderRadius: '8px',
                                                                                    cursor: 'pointer',
                                                                                    background: isSelected ? 'var(--primary-light)' : 'transparent',
                                                                                    color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                                                                                    fontWeight: isSelected ? '600' : '500',
                                                                                    fontSize: '14px',
                                                                                    transition: 'all 0.15s ease'
                                                                                }}
                                                                                onClick={() => {
                                                                                    let newSelection;
                                                                                    if (isSelected) {
                                                                                        newSelection = arrayVal.filter(v => v !== opt.value);
                                                                                    } else {
                                                                                        newSelection = [...arrayVal, opt.value];
                                                                                    }
                                                                                    setFormData({ ...formData, [field]: newSelection });
                                                                                }}
                                                                                onMouseOver={(e) => {
                                                                                    if (!isSelected) e.currentTarget.style.background = '#f1f5f9';
                                                                                }}
                                                                                onMouseOut={(e) => {
                                                                                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                                                                                }}
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isSelected}
                                                                                    readOnly
                                                                                    style={{
                                                                                        accentColor: 'var(--primary)',
                                                                                        cursor: 'pointer',
                                                                                        width: '16px',
                                                                                        height: '16px'
                                                                                    }}
                                                                                />
                                                                                <span>{opt.label}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        value={formData[field] || ''}
                                                        onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                                                        placeholder={`Enter value...`}
                                                        required
                                                    />
                                                )}
                                            </div>
                                        ))}
                                        {/* Boolean Toggles Grid */}
                                        <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '10px' }}>
                                            {boolFields.map(field => (
                                                <div key={field} className="checkbox-field" style={{
                                                    background: '#f8fafc',
                                                    padding: '12px 16px',
                                                    borderRadius: '16px',
                                                    border: '1.5px solid #e2e8f0',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between'
                                                }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>{field.replace(/^is_/, '').replace(/_/g, ' ')}</label>
                                                    </div>
                                                    <div
                                                        onClick={() => setFormData({ ...formData, [field]: !formData[field] })}
                                                        style={{
                                                            width: '44px',
                                                            height: '24px',
                                                            borderRadius: '24px',
                                                            backgroundColor: (formData[field] === true || String(formData[field]).toLowerCase() === 'true' || formData[field] === 1) ? 'var(--primary)' : '#cbd5e1',
                                                            position: 'relative',
                                                            cursor: 'pointer',
                                                            transition: 'background-color 0.3s ease'
                                                        }}
                                                    >
                                                        <div style={{
                                                            position: 'absolute',
                                                            height: '18px',
                                                            width: '18px',
                                                            left: (formData[field] === true || String(formData[field]).toLowerCase() === 'true' || formData[field] === 1) ? '23px' : '3px',
                                                            top: '3px',
                                                            backgroundColor: 'white',
                                                            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                            borderRadius: '50%',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                        }}></div>
                                                    </div>
                                                </div>
                                            ))}
                                            {activeTab.id === 'roles' && (
                                                <div style={{ gridColumn: 'span 2', marginTop: '20px' }}>
                                                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px' }}>Feature Access Permissions</h3>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                        {[
                                                            { key: 'can_create_trip', label: 'New Trip Request' },
                                                            { key: 'can_create_tour_plan', label: 'New Tour Plan' }
                                                        ].map(perm => (
                                                            <div key={perm.key} className="checkbox-field" style={{
                                                                background: '#fff',
                                                                padding: '12px 16px',
                                                                borderRadius: '16px',
                                                                border: '1.5px solid var(--primary-light)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between'
                                                            }}>
                                                                <div style={{ flex: 1 }}>
                                                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block' }}>{perm.label}</label>
                                                                </div>
                                                                <div
                                                                    onClick={() => {
                                                                        const perms = { ...(formData.permissions || {}) };
                                                                        perms[perm.key] = !perms[perm.key];
                                                                        setFormData({ ...formData, permissions: perms });
                                                                    }}
                                                                    style={{
                                                                        width: '44px',
                                                                        height: '24px',
                                                                        borderRadius: '24px',
                                                                        backgroundColor: (formData.permissions?.[perm.key]) ? 'var(--primary)' : '#cbd5e1',
                                                                        position: 'relative',
                                                                        cursor: 'pointer',
                                                                        transition: 'background-color 0.3s ease'
                                                                    }}
                                                                >
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        height: '18px',
                                                                        width: '18px',
                                                                        left: (formData.permissions?.[perm.key]) ? '23px' : '3px',
                                                                        top: '3px',
                                                                        backgroundColor: 'white',
                                                                        transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                        borderRadius: '50%',
                                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                                    }}></div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div style={{ padding: '24px 40px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '16px', position: 'sticky', bottom: 0, zIndex: 10 }}>
                                <button type="button" className="cancel-btn" onClick={() => setIsFormOpen(false)} style={{ flex: 1, borderRadius: '100px' }}>Discard</button>
                                <button type="submit" form="master-form" className="save-btn" style={{ flex: 2, borderRadius: '100px' }}>{editingItem ? 'Save Changes' : 'Create Entry'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirm Delete Form */}
                {isConfirmOpen && (
                    <div className="modal-overlay">
                        <div className="modal-content confirm-modal">
                            <div className="confirm-icon"><AlertCircle size={32} /></div>
                            <h2>Confirm Deletion</h2>
                            <p style={{ color: '#64748b', marginBottom: '32px' }}>Are you sure you want to delete this record?</p>
                            <div className="modal-actions">
                                <button className="cancel-btn" onClick={() => setIsConfirmOpen(false)}>No, Keep it</button>
                                <button className="save-btn" style={{ background: '#CB6040' }} onClick={handleDelete}>Yes, Delete</button>
                            </div>
                        </div>
                    </div>
                )}

                {editingCadre && (
                    <EntitlementEditorModal
                        cadre={editingCadre.cadre}
                        rule={editingCadre.rule}
                        isOpen={!!editingCadre}
                        onClose={() => setEditingCadre(null)}
                        onSave={saveEntitlementRule}
                    />
                )}
            </div>
        </div>
    );
}

function EntitlementDashboard({ cadres, rules, loading, globalPolicyEnabled, onToggleGlobalPolicy, onEditPolicy, onDeleteCadre, onAddCadre, onSyncCadres, onToggleActive }) {
    const [expandedCadreId, setExpandedCadreId] = useState(null);

    if (loading) {
        return (
            <div className="loading-state">
                <div className="loader"></div>
                <p>Loading entitlement configurations...</p>
            </div>
        );
    }

    return (
        <div className="entitlement-dashboard animate-fade-in" style={{ padding: '0px' }}>
            <div className="panel-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>Cadre Entitlement Policy</h2>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
                        Configure travel, accommodation, daily allowance and own-stay limits per cadre.
                    </p>
                </div>
                <div>
                    <button 
                        type="button" 
                        className="add-btn" 
                        onClick={onAddCadre} 
                        style={{ 
                            background: '#3b82f6', 
                            color: 'white', 
                            padding: '10px 20px', 
                            borderRadius: '10px',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)' 
                        }}
                    >
                        <Plus size={18} />
                        Add New Cadre
                    </button>
                </div>
            </div>

            {/* Global Policy Enforcement Toggle Banner */}
            <div style={{ 
                background: globalPolicyEnabled ? '#f0fdf4' : '#fff5f5',
                border: `1.5px solid ${globalPolicyEnabled ? '#bbf7d0' : '#fecaca'}`,
                borderRadius: '16px',
                padding: '20px 24px',
                marginBottom: '28px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        width: '44px',
                        height: '44px',
                        background: globalPolicyEnabled ? '#d1fae5' : '#fee2e2',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: globalPolicyEnabled ? '#059669' : '#dc2626',
                        flexShrink: 0
                    }}>
                        <ShieldAlert size={22} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: globalPolicyEnabled ? '#065f46' : '#991b1b' }}>
                            Global Entitlement Policy Enforcement
                        </h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: globalPolicyEnabled ? '#047857' : '#b91c1c', fontWeight: 500 }}>
                            {globalPolicyEnabled 
                                ? 'Active: Travel requests and claim submissions are strictly validated against active cadre entitlement rules.' 
                                : 'Suspended: All cadre entitlement policies are bypassed. Employees can request and claim without limit restrictions.'
                            }
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 800, 
                        color: globalPolicyEnabled ? '#065f46' : '#991b1b',
                        background: globalPolicyEnabled ? '#d1fae5' : '#fee2e2',
                        padding: '4px 10px',
                        borderRadius: '100px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        {globalPolicyEnabled ? 'Enforced' : 'Suspended'}
                    </span>
                    <div
                        onClick={() => onToggleGlobalPolicy(!globalPolicyEnabled)}
                        style={{
                            width: '46px',
                            height: '24px',
                            borderRadius: '24px',
                            backgroundColor: globalPolicyEnabled ? '#059669' : '#dc2626',
                            position: 'relative',
                            cursor: 'pointer',
                            transition: 'background-color 0.3s ease',
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            height: '18px',
                            width: '18px',
                            left: globalPolicyEnabled ? '25px' : '3px',
                            top: '3px',
                            backgroundColor: 'white',
                            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            borderRadius: '50%',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}></div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {cadres.map(cadre => {
                    const rule = rules[cadre.id];
                    const isExpanded = expandedCadreId === cadre.id;
                    const isPolicyActive = rule ? rule.is_active !== false : true;
                    let travelModesList = [];
                    if (rule?.travel_rules) {
                        const tr = rule.travel_rules;
                        if (tr.modes) {
                            travelModesList = Object.keys(tr.modes).filter(m => tr.modes[m]?.allowed);
                        } else if (Array.isArray(tr.long_distance)) {
                            travelModesList = tr.long_distance.filter(m => m.allowed).map(m => m.mode);
                        }
                    }
                    
                    return (
                        <div key={cadre.id} style={{
                            background: '#ffffff',
                            borderRadius: '16px',
                            border: '1.5px solid #e2e8f0',
                            padding: '16px 24px',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)',
                            transition: 'all 0.2s ease',
                            opacity: isPolicyActive ? 1 : 0.75
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        background: isPolicyActive ? '#6366f1' : '#94a3b8',
                                        color: '#ffffff',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <Award size={20} />
                                    </div>
                                    <div style={{ minWidth: 0, paddingRight: '16px', flex: 1 }}>
                                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: isPolicyActive ? '#1e293b' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                            {cadre.name}
                                        </h3>
                                        <p style={{ 
                                            margin: '4px 0 0 0', 
                                            fontSize: '0.85rem', 
                                            color: '#64748b', 
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis', 
                                            whiteSpace: 'nowrap' 
                                        }}>
                                            {cadre.designation_keywords && cadre.designation_keywords.length > 0
                                                ? cadre.designation_keywords.join(' / ')
                                                : cadre.description || 'No designations mapped.'}
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                    <span style={{
                                        background: isPolicyActive ? '#ecfdf5' : '#fef2f2',
                                        color: isPolicyActive ? '#15803d' : '#ef4444',
                                        padding: '4px 12px',
                                        borderRadius: '100px',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        whiteSpace: 'nowrap',
                                        border: `1px solid ${isPolicyActive ? '#d1fae5' : '#fee2e2'}`
                                    }}>
                                        {isPolicyActive ? 'Policy Configured' : 'Suspended'}
                                    </span>

                                    <button 
                                        type="button"
                                        onClick={() => onEditPolicy(cadre)}
                                        style={{
                                            background: '#a20025',
                                            color: '#ffffff',
                                            padding: '8px 14px',
                                            borderRadius: '8px',
                                            fontWeight: '600',
                                            fontSize: '0.8rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            transition: 'opacity 0.2s'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.opacity = 0.9}
                                        onMouseOut={(e) => e.currentTarget.style.opacity = 1}
                                    >
                                        <Edit2 size={13} />
                                        Edit Policy
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => onDeleteCadre(cadre.id)}
                                        style={{
                                            background: '#fff5f5',
                                            color: '#ef4444',
                                            border: '1px solid #fee2e2',
                                            padding: '8px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                            height: '34px',
                                            width: '34px'
                                        }}
                                        onMouseOver={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.background = '#fff5f5'; }}
                                        title="Delete Cadre"
                                    >
                                        <Trash2 size={14} style={{ color: '#ef4444' }} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setExpandedCadreId(isExpanded ? null : cadre.id)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#94a3b8',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                            transition: 'transform 0.2s ease'
                                        }}
                                    >
                                        <ChevronDown size={18} />
                                    </button>
                                </div>
                            </div>

                            {isExpanded && (
                                <div style={{
                                    borderTop: '1px dashed #e2e8f0',
                                    marginTop: '16px',
                                    paddingTop: '16px',
                                    animation: 'fadeIn 0.2s ease-out'
                                }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                                        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                Stay Limits (HQ / Dist / Other)
                                            </span>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                                                ₹ {rule?.accommodation_state_hq || 0} / ₹ {rule?.accommodation_districts || 0} / ₹ {rule?.accommodation_others || 0}
                                            </span>
                                        </div>

                                        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                Daily Allowance
                                            </span>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                                                ₹ {rule?.daily_allowance_amount || 0}
                                            </span>
                                        </div>

                                        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                Guest House Policy
                                            </span>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                                                {rule?.company_guest_house_status || 'Optional'}
                                            </span>
                                        </div>

                                        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                Max Mileage Limit
                                            </span>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                                                {rule?.max_mileage_km !== undefined ? `${rule.max_mileage_km} KM` : '0 KM'}
                                            </span>
                                        </div>

                                        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                Travel Modes Allowed
                                            </span>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {travelModesList.length > 0 ? travelModesList.join(', ') : 'None'}
                                            </span>
                                        </div>
                                    </div>

                                    {cadre.description && (
                                        <div style={{ marginTop: '12px', padding: '0 4px' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>
                                                Description
                                            </span>
                                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#475569', lineHeight: '1.4' }}>
                                                {cadre.description}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function EntitlementEditorModal({ cadre, rule, isOpen, onClose, onSave }) {
    const [modalTab, setModalTab] = useState('info');
    const allClusterOptions = ['Metropolitan', 'City', 'Town', 'Village', 'Others'];
    
    // Helper to initialize travel rules from dynamic JSON or legacy fields
    const initializeTravelRules = (ruleObj) => {
        const tr = ruleObj?.travel_rules;

        // --- Format 1: Current DB format with long_distance/local_conveyance arrays ---
        if (tr && Array.isArray(tr.long_distance)) {
            const modes = {};
            for (const entry of tr.long_distance) {
                if (entry?.mode) {
                    modes[entry.mode] = {
                        allowed: entry.allowed === true,
                        classes: Array.isArray(entry.classes) ? entry.classes : []
                    };
                }
            }
            const local_modes = {};
            for (const entry of (tr.local_conveyance || [])) {
                if (entry?.mode) {
                    local_modes[entry.mode] = {
                        allowed: entry.allowed === true,
                        sub_types: Array.isArray(entry.subtypes) ? entry.subtypes : (Array.isArray(entry.sub_types) ? entry.sub_types : [])
                    };
                }
            }
            return { modes, local_modes };
        }

        // --- Format 2: Newer modes/local_modes object format ---
        if (tr && tr.modes && Object.keys(tr.modes).length > 0) {
            return {
                modes: tr.modes || {},
                local_modes: tr.local_modes || {}
            };
        }

        // --- Format 3: Legacy flat fields fallback (air_allowed, train_allowed, etc.) ---
        const modes = {};
        modes['Flight'] = {
            allowed: !!ruleObj?.air_allowed,
            classes: ruleObj?.air_class && ruleObj.air_class !== 'NA' ? ruleObj.air_class.split(',').map(s => s.trim()) : []
        };
        modes['Train'] = {
            allowed: !!ruleObj?.train_allowed,
            classes: ruleObj?.train_class && ruleObj.train_class !== 'NA' ? ruleObj.train_class.split(',').map(s => s.trim()) : []
        };
        modes['Intercity Bus'] = {
            allowed: !!ruleObj?.bus_allowed,
            classes: ruleObj?.bus_class && ruleObj.bus_class !== 'NA' ? ruleObj.bus_class.split(',').map(s => s.trim()) : []
        };
        modes['Intercity Cab'] = {
            allowed: !!ruleObj?.car_allowed,
            classes: ruleObj?.car_notes && ruleObj.car_notes !== 'NA' ? ruleObj.car_notes.split(',').map(s => s.trim()) : []
        };

        const local_modes = {};
        if (ruleObj?.local_conveyance_allowed) {
            local_modes['Local Travel'] = {
                allowed: true,
                sub_types: ruleObj?.local_conveyance_type && ruleObj.local_conveyance_type !== 'NA'
                    ? ruleObj.local_conveyance_type.split(',').map(s => s.trim()) : []
            };
        }

        return { modes, local_modes };
    };

    // Cadre fields
    const [cadreName, setCadreName] = useState('');
    const [cadreDesc, setCadreDesc] = useState('');
    const [designationKeywords, setDesignationKeywords] = useState([]);
    const [customKeyword, setCustomKeyword] = useState('');
    const [selectedDesigDropdown, setSelectedDesigDropdown] = useState('');

    // Rule fields
    const [isActive, setIsActive] = useState(true);
    const [companyGuestHouseStatus, setCompanyGuestHouseStatus] = useState('Optional');
    
    const [accommodationStateHq, setAccommodationStateHq] = useState(0);
    const [stateHqClusters, setStateHqClusters] = useState(['Metropolitan']);
    
    const [accommodationDistricts, setAccommodationDistricts] = useState(0);
    const [districtsClusters, setDistrictsClusters] = useState(['Town', 'City']);
    
    const [accommodationOthers, setAccommodationOthers] = useState(0);
    const [othersClusters, setOthersClusters] = useState(['Others']);

    const [dailyAllowanceAmount, setDailyAllowanceAmount] = useState(0);
    const [maxMileageKm, setMaxMileageKm] = useState(0);

    const [ownStayStateHqPct, setOwnStayStateHqPct] = useState(50);
    const [ownStayDistrictsPct, setOwnStayDistrictsPct] = useState(50);
    const [ownStayOthersPct, setOwnStayOthersPct] = useState(50);

    const [laundryDaysThreshold, setLaundryDaysThreshold] = useState(4);

    const [travelRules, setTravelRules] = useState({ modes: {}, local_modes: {} });

    // Master lists
    const [travelModes, setTravelModes] = useState([]);
    const [travelClasses, setTravelClasses] = useState([]);
    const [localModes, setLocalModes] = useState([]);
    const [localSubTypes, setLocalSubTypes] = useState([]);
    const [allDesignations, setAllDesignations] = useState([]);

    // Sync state values when modal is opened/updated
    useEffect(() => {
        if (isOpen && cadre) {
            setCadreName(cadre.name || '');
            setCadreDesc(cadre.description || '');
            setDesignationKeywords(cadre.designation_keywords || []);
            setIsActive(rule?.is_active !== false);
            setCompanyGuestHouseStatus(rule?.company_guest_house_status || 'Optional');
            setAccommodationStateHq(rule?.accommodation_state_hq || 0);
            setStateHqClusters(rule?.state_hq_clusters || ['Metropolitan']);
            setAccommodationDistricts(rule?.accommodation_districts || 0);
            setDistrictsClusters(rule?.districts_clusters || ['Town', 'City']);
            setAccommodationOthers(rule?.accommodation_others || 0);
            setOthersClusters(rule?.others_clusters || ['Others']);
            setDailyAllowanceAmount(rule?.daily_allowance_amount || 0);
            setMaxMileageKm(rule?.max_mileage_km || 0);
            setLaundryDaysThreshold(rule?.laundry_days_threshold !== undefined ? rule.laundry_days_threshold : 4);
            setOwnStayStateHqPct(rule?.own_stay_state_hq_pct || 50);
            setOwnStayDistrictsPct(rule?.own_stay_districts_pct || 50);
            setOwnStayOthersPct(rule?.own_stay_others_pct || 50);
            setTravelRules(initializeTravelRules(rule));
            
            // Clear inputs
            setCustomKeyword('');
            setSelectedDesigDropdown('');
        }
    }, [isOpen, cadre, rule]);

    useEffect(() => {
        if (!isOpen) return;
        const fetchMasters = async () => {
            // Fetch each master independently so one failure doesn't blank the whole section
            const safe = (promise, name) => promise.catch((err) => {
                console.error(`Failed to fetch master data for ${name}:`, err);
                return { data: [] };
            });
            const [modesRes, classesRes, localModesRes, localSubTypesRes, desigsRes] = await Promise.all([
                safe(api.get('/api/travel-mode-masters/'), 'travel-mode-masters'),
                safe(api.get('/api/travel-class-masters/'), 'travel-class-masters'),
                safe(api.get('/api/local-travel-mode-masters/'), 'local-travel-mode-masters'),
                safe(api.get('/api/local-sub-type-masters/'), 'local-sub-type-masters'),
                safe(api.get('/api/masters/eligibility-rules/designations/'), 'designations')
            ]);
            console.log("modesRes:", modesRes.data);
            console.log("classesRes:", classesRes.data);
            console.log("localModesRes:", localModesRes.data);
            console.log("localSubTypesRes:", localSubTypesRes.data);
            setTravelModes((modesRes.data.results || modesRes.data || []).filter(m => m.status !== false));
            setTravelClasses((classesRes.data.results || classesRes.data || []).filter(c => c.status !== false));
            setLocalModes((localModesRes.data.results || localModesRes.data || []).filter(m => m.status !== false));
            setLocalSubTypes((localSubTypesRes.data.results || localSubTypesRes.data || []).filter(s => s.status !== false));
            console.log("Modes data:", modesRes.data);
            console.log("Classes data:", classesRes.data);
            console.log("Local modes data:", localModesRes.data);
            console.log("Local subtypes data:", localSubTypesRes.data);
            console.log("Designations data from API:", desigsRes.data);
            setAllDesignations(desigsRes.data || []);
        };
        fetchMasters();
    }, [isOpen]);

    // Handle adding keywords
    const handleAddKeyword = (kw) => {
        if (kw && !designationKeywords.includes(kw)) {
            setDesignationKeywords([...designationKeywords, kw]);
        }
    };

    const handleRemoveKeyword = (kw) => {
        setDesignationKeywords(designationKeywords.filter(k => k !== kw));
    };

    // Helper to get allowed classes for a long-distance travel mode
    // TravelClassMaster has: is_flight, is_train, is_bus
    // Intercity Bus → is_bus | Intercity Cab → no flag (show all) | Flight → is_flight | Train → is_train
    const getFilteredClasses = (modeName) => {
        const name = (modeName || '').toLowerCase();
        if (name.includes('flight') || name.includes('air')) {
            return travelClasses.filter(c => c.is_flight);
        }
        if (name.includes('train') || name.includes('rail')) {
            return travelClasses.filter(c => c.is_train);
        }
        if (name.includes('bus')) {
            return travelClasses.filter(c => c.is_bus);
        }
        // Intercity Cab or others — no specific class flag, show all
        return travelClasses;
    };

    // Helper to get sub-types for a local travel mode
    // LocalSubTypeMaster field is `sub_type` (not sub_type_name)
    const getFilteredSubTypes = (localModeName) => {
        const name = (localModeName || '').toLowerCase();
        if (name.includes('car') || name.includes('cab') || name.includes('taxi')) {
            return localSubTypes.filter(s => s.is_car);
        }
        if (name.includes('bike') || name.includes('two') || name.includes('cycle') || name.includes('motor')) {
            return localSubTypes.filter(s => s.is_bike);
        }
        if (name.includes('auto') || name.includes('rickshaw') || name.includes('tuk')) {
            return localSubTypes.filter(s => s.is_auto);
        }
        return localSubTypes;
    };

    const handleModeToggle = (modeName, checked) => {
        const newRules = { ...travelRules };
        if (!newRules.modes) newRules.modes = {};
        newRules.modes[modeName] = {
            allowed: checked,
            classes: newRules.modes[modeName]?.classes || []
        };
        setTravelRules(newRules);
    };

    const handleClassToggle = (modeName, className, checked) => {
        const newRules = { ...travelRules };
        if (!newRules.modes) newRules.modes = {};
        const currentClasses = newRules.modes[modeName]?.classes || [];
        const newClasses = checked 
            ? [...currentClasses, className]
            : currentClasses.filter(c => c !== className);
        
        newRules.modes[modeName] = {
            ...newRules.modes[modeName],
            classes: newClasses
        };
        setTravelRules(newRules);
    };

    const handleLocalModeToggle = (modeName, checked) => {
        const newRules = { ...travelRules };
        if (!newRules.local_modes) newRules.local_modes = {};
        newRules.local_modes[modeName] = {
            allowed: checked,
            sub_types: newRules.local_modes[modeName]?.sub_types || []
        };
        setTravelRules(newRules);
    };

    const handleLocalSubTypeToggle = (modeName, subTypeName, checked) => {
        const newRules = { ...travelRules };
        if (!newRules.local_modes) newRules.local_modes = {};
        const currentSubTypes = newRules.local_modes[modeName]?.sub_types || [];
        const newSubTypes = checked 
            ? [...currentSubTypes, subTypeName]
            : currentSubTypes.filter(s => s !== subTypeName);
        
        newRules.local_modes[modeName] = {
            ...newRules.local_modes[modeName],
            sub_types: newSubTypes
        };
        setTravelRules(newRules);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Map travel rules back to legacy fields for backend safety
        const legacyFields = {
            air_allowed: false,
            air_class: 'NA',
            train_allowed: false,
            train_class: 'NA',
            bus_allowed: false,
            bus_class: 'NA',
            car_allowed: false,
            car_notes: 'NA',
            local_conveyance_allowed: false,
            local_conveyance_type: 'NA'
        };

        const flightMode = Object.keys(travelRules.modes || {}).find(m => m.toLowerCase().includes('flight') || m.toLowerCase().includes('air'));
        if (flightMode) {
            legacyFields.air_allowed = travelRules.modes[flightMode].allowed;
            legacyFields.air_class = travelRules.modes[flightMode].classes?.join(', ') || 'NA';
        }

        const trainMode = Object.keys(travelRules.modes || {}).find(m => m.toLowerCase().includes('train'));
        if (trainMode) {
            legacyFields.train_allowed = travelRules.modes[trainMode].allowed;
            legacyFields.train_class = travelRules.modes[trainMode].classes?.join(', ') || 'NA';
        }

        const busMode = Object.keys(travelRules.modes || {}).find(m => m.toLowerCase().includes('bus'));
        if (busMode) {
            legacyFields.bus_allowed = travelRules.modes[busMode].allowed;
            legacyFields.bus_class = travelRules.modes[busMode].classes?.join(', ') || 'NA';
        }

        const carMode = Object.keys(travelRules.modes || {}).find(m => m.toLowerCase().includes('car') || m.toLowerCase().includes('cab') || m.toLowerCase().includes('vehicle'));
        if (carMode) {
            legacyFields.car_allowed = travelRules.modes[carMode].allowed;
            legacyFields.car_notes = travelRules.modes[carMode].classes?.join(', ') || 'NA';
        }

        const localAllowed = Object.values(travelRules.local_modes || {}).some(lm => lm.allowed);
        legacyFields.local_conveyance_allowed = localAllowed;
        const allLocalSubTypes = Object.values(travelRules.local_modes || {})
            .filter(lm => lm.allowed)
            .flatMap(lm => lm.sub_types || [])
            .join(', ');
        legacyFields.local_conveyance_type = allLocalSubTypes || 'NA';

        // Format travel rules to DB array structure: long_distance and local_conveyance
        const dbTravelRules = {
            long_distance: Object.keys(travelRules.modes || {}).map(mode => ({
                mode,
                allowed: travelRules.modes[mode].allowed === true,
                classes: Array.isArray(travelRules.modes[mode].classes) ? travelRules.modes[mode].classes : []
            })),
            local_conveyance: Object.keys(travelRules.local_modes || {}).map(mode => ({
                mode,
                allowed: travelRules.local_modes[mode].allowed === true,
                subtypes: Array.isArray(travelRules.local_modes[mode].sub_types) ? travelRules.local_modes[mode].sub_types : []
            }))
        };

        onSave(cadre.id, {
            id: rule.id,
            is_active: isActive,
            company_guest_house_status: companyGuestHouseStatus,
            accommodation_state_hq: Number(accommodationStateHq),
            state_hq_clusters: stateHqClusters,
            accommodation_districts: Number(accommodationDistricts),
            districts_clusters: districtsClusters,
            accommodation_others: Number(accommodationOthers),
            others_clusters: othersClusters,
            daily_allowance_amount: Number(dailyAllowanceAmount),
            max_mileage_km: Number(maxMileageKm),
            laundry_days_threshold: Number(laundryDaysThreshold),
            own_stay_state_hq_pct: Number(ownStayStateHqPct),
            own_stay_districts_pct: Number(ownStayDistrictsPct),
            own_stay_others_pct: Number(ownStayOthersPct),
            travel_rules: dbTravelRules,
            designation_keywords: designationKeywords,
            legacyFields
        }, cadreName, cadreDesc);
    };

    return (
        <div className="modal-overlay" style={{ 
            zIndex: 3000,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.3)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div className="modal-content animate-pop-in" style={{ 
                padding: '0', 
                borderRadius: '24px', 
                maxWidth: '780px', 
                width: '90%', 
                height: '90vh',
                maxHeight: '90vh', 
                display: 'flex', 
                flexDirection: 'column', 
                overflow: 'hidden',
                background: '#ffffff',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)'
            }}>
                
                {/* Header */}
                <div style={{ 
                    padding: '28px 40px 24px 40px', 
                    background: 'white', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10
                }}>
                    <div>
                        <h2 className="modal-title" style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1e293b', margin: 0 }}>Entitlement Policy</h2>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#6366f1', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            {cadre?.name || 'NEW CADRE'}
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        style={{ 
                            background: '#f1f5f9', 
                            border: 'none', 
                            padding: '8px', 
                            borderRadius: '50%', 
                            cursor: 'pointer', 
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '32px 40px', overflowY: 'auto', flex: 1, maxHeight: 'calc(90vh - 180px)' }}>
                    <form onSubmit={handleSubmit} id="entitlement-policy-form" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        
                        {/* Cadre Details */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="form-field">
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>CADRE NAME</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={cadreName}
                                    onChange={e => setCadreName(e.target.value)}
                                    required
                                    style={{ borderRadius: '10px', padding: '10px 14px', border: '1.5px solid #cbd5e1', width: '100%' }}
                                />
                            </div>
                            <div className="form-field">
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>CADRE STATUS</label>
                                <div style={{ display: 'flex', alignItems: 'center', height: '44px' }}>
                                    <div
                                        onClick={() => setIsActive(!isActive)}
                                        style={{
                                            width: '44px',
                                            height: '24px',
                                            borderRadius: '24px',
                                            backgroundColor: isActive ? '#6366f1' : '#cbd5e1',
                                            position: 'relative',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.3s ease'
                                        }}
                                    >
                                        <div style={{
                                            position: 'absolute',
                                            height: '18px',
                                            width: '18px',
                                            left: isActive ? '23px' : '3px',
                                            top: '3px',
                                            backgroundColor: 'white',
                                            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            borderRadius: '50%',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                        }}></div>
                                    </div>
                                    <span style={{ marginLeft: '12px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                        {isActive ? 'Active' : 'Suspended'}
                                    </span>
                                </div>
                            </div>
                            <div className="form-field" style={{ gridColumn: 'span 2' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>DESCRIPTION</label>
                                <textarea
                                    className="form-input"
                                    value={cadreDesc}
                                    onChange={e => setCadreDesc(e.target.value)}
                                    style={{ height: '70px', resize: 'vertical', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', width: '100%' }}
                                />
                            </div>
                        </div>

                        {/* SECTION A — TRAVEL ALLOWANCE */}
                        <div>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                                A — TRAVEL ALLOWANCE
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                
                                {/* 1. Long Distance Travel Modes */}
                                <div>
                                    <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                        Long Distance Travel
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {travelModes.map(mode => {
                                            const isAllowed = travelRules.modes?.[mode.mode_name]?.allowed === true;
                                            const allowedClasses = travelRules.modes?.[mode.mode_name]?.classes || [];
                                            const availableClasses = getFilteredClasses(mode.mode_name);
                                            
                                            return (
                                                <div key={mode.id} style={{
                                                    background: '#f8fafc',
                                                    border: '1.5px solid #e2e8f0',
                                                    borderRadius: '12px',
                                                    padding: '16px',
                                                    display: 'grid',
                                                    gridTemplateColumns: '180px 1fr',
                                                    alignItems: 'center',
                                                    gap: '16px'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '16px', borderRight: '1px solid #e2e8f0' }}>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{mode.mode_name}</span>
                                                        <div
                                                            onClick={() => handleModeToggle(mode.mode_name, !isAllowed)}
                                                            style={{
                                                                width: '40px',
                                                                height: '22px',
                                                                borderRadius: '22px',
                                                                backgroundColor: isAllowed ? '#6366f1' : '#cbd5e1',
                                                                position: 'relative',
                                                                cursor: 'pointer',
                                                                transition: 'background-color 0.3s ease'
                                                            }}
                                                        >
                                                            <div style={{
                                                                position: 'absolute',
                                                                height: '16px',
                                                                width: '16px',
                                                                left: isAllowed ? '21px' : '3px',
                                                                top: '3px',
                                                                backgroundColor: 'white',
                                                                transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                borderRadius: '50%',
                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                            }}></div>
                                                        </div>
                                                    </div>

                                                    <div style={{ paddingLeft: '8px' }}>
                                                        {isAllowed ? (
                                                            <div>
                                                                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Permitted Classes</label>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                                    {availableClasses.map(cls => {
                                                                        const isClassSelected = allowedClasses.includes(cls.class_name);
                                                                        return (
                                                                            <button
                                                                                key={cls.id}
                                                                                type="button"
                                                                                onClick={() => handleClassToggle(mode.mode_name, cls.class_name, !isClassSelected)}
                                                                                style={{
                                                                                    fontSize: '0.75rem',
                                                                                    fontWeight: '600',
                                                                                    padding: '4px 10px',
                                                                                    borderRadius: '8px',
                                                                                    border: '1.5px solid',
                                                                                    borderColor: isClassSelected ? '#6366f1' : '#cbd5e1',
                                                                                    background: isClassSelected ? '#eff6ff' : 'white',
                                                                                    color: isClassSelected ? '#4f46e5' : '#475569',
                                                                                    cursor: 'pointer',
                                                                                    transition: 'all 0.15s'
                                                                                }}
                                                                            >
                                                                                {cls.class_name}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Not permitted for this cadre</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 2. Local Conveyance Travel Modes */}
                                <div>
                                    <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                        Local Conveyance & Outstation Local Travel
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {localModes.map(mode => {
                                            const isAllowed = travelRules.local_modes?.[mode.mode_name]?.allowed === true;
                                            const allowedSubTypes = travelRules.local_modes?.[mode.mode_name]?.sub_types || [];
                                            const availableSubTypes = getFilteredSubTypes(mode.mode_name);
                                            
                                            return (
                                                <div key={mode.id} style={{
                                                    background: '#f8fafc',
                                                    border: '1.5px solid #e2e8f0',
                                                    borderRadius: '12px',
                                                    padding: '16px',
                                                    display: 'grid',
                                                    gridTemplateColumns: '180px 1fr',
                                                    alignItems: 'center',
                                                    gap: '16px'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '16px', borderRight: '1px solid #e2e8f0' }}>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{mode.mode_name}</span>
                                                        <div
                                                            onClick={() => handleLocalModeToggle(mode.mode_name, !isAllowed)}
                                                            style={{
                                                                width: '40px',
                                                                height: '22px',
                                                                borderRadius: '22px',
                                                                backgroundColor: isAllowed ? '#6366f1' : '#cbd5e1',
                                                                position: 'relative',
                                                                cursor: 'pointer',
                                                                transition: 'background-color 0.3s ease'
                                                            }}
                                                        >
                                                            <div style={{
                                                                position: 'absolute',
                                                                height: '16px',
                                                                width: '16px',
                                                                left: isAllowed ? '21px' : '3px',
                                                                top: '3px',
                                                                backgroundColor: 'white',
                                                                transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                borderRadius: '50%',
                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                            }}></div>
                                                        </div>
                                                    </div>

                                                    <div style={{ paddingLeft: '8px' }}>
                                                        {isAllowed ? (
                                                            <div>
                                                                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Permitted Sub-types</label>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                                    {availableSubTypes.map(sub => {
                                                                        const isSubSelected = allowedSubTypes.includes(sub.sub_type);
                                                                        return (
                                                                            <button
                                                                                key={sub.id}
                                                                                type="button"
                                                                                onClick={() => handleLocalSubTypeToggle(mode.mode_name, sub.sub_type, !isSubSelected)}
                                                                                style={{
                                                                                    fontSize: '0.75rem',
                                                                                    fontWeight: '600',
                                                                                    padding: '4px 10px',
                                                                                    borderRadius: '8px',
                                                                                    border: '1.5px solid',
                                                                                    borderColor: isSubSelected ? '#6366f1' : '#cbd5e1',
                                                                                    background: isSubSelected ? '#eff6ff' : 'white',
                                                                                    color: isSubSelected ? '#4f46e5' : '#475569',
                                                                                    cursor: 'pointer',
                                                                                    transition: 'all 0.15s'
                                                                                }}
                                                                            >
                                                                                {sub.sub_type}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Not permitted for this cadre</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SECTION B — STAY & LODGING LIMITS */}
                        <div>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                                B — STAY & LODGING LIMITS
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
                                <div className="form-field" style={{ gridColumn: 'span 2' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>GUEST HOUSE POLICY</label>
                                    <select
                                        className="form-select"
                                        value={companyGuestHouseStatus}
                                        onChange={e => setCompanyGuestHouseStatus(e.target.value)}
                                        style={{ borderRadius: '10px', padding: '10px 14px', border: '1.5px solid #cbd5e1', width: '100%' }}
                                    >
                                        <option value="Preferred">Preferred (Must stay if available)</option>
                                        <option value="Optional">Optional (Can choose Guest house or hotel)</option>
                                        <option value="Exceptional Only">Exceptional Only (Allowed only if no hotels)</option>
                                    </select>
                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>STATE HQ LIMIT</span>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', background: '#eff6ff', color: '#4f46e5' }}>
                                                {stateHqClusters.length > 0 ? stateHqClusters.join(', ') : 'None'}
                                            </span>
                                        </div>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#94a3b8' }}>₹</span>
                                            <input
                                                type="number"
                                                className="form-input"
                                                style={{ paddingLeft: '28px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 8px 8px 24px', width: '100%' }}
                                                value={accommodationStateHq}
                                                onChange={e => setAccommodationStateHq(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '12px' }}>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Mapped Clusters</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {allClusterOptions.map(cls => {
                                                const isSelected = stateHqClusters.includes(cls);
                                                return (
                                                    <button
                                                        key={cls}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setStateHqClusters(stateHqClusters.filter(c => c !== cls));
                                                            } else {
                                                                setStateHqClusters([...stateHqClusters, cls]);
                                                            }
                                                        }}
                                                        style={{
                                                            fontSize: '0.65rem',
                                                            fontWeight: '700',
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            border: '1px solid',
                                                            borderColor: isSelected ? '#6366f1' : '#cbd5e1',
                                                            background: isSelected ? '#eff6ff' : 'white',
                                                            color: isSelected ? '#4f46e5' : '#64748b',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        {cls}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>DISTRICTS LIMIT</span>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', background: '#eff6ff', color: '#4f46e5' }}>
                                                {districtsClusters.length > 0 ? districtsClusters.join(', ') : 'None'}
                                            </span>
                                        </div>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#94a3b8' }}>₹</span>
                                            <input
                                                type="number"
                                                className="form-input"
                                                style={{ paddingLeft: '28px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 8px 8px 24px', width: '100%' }}
                                                value={accommodationDistricts}
                                                onChange={e => setAccommodationDistricts(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '12px' }}>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Mapped Clusters</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {allClusterOptions.map(cls => {
                                                const isSelected = districtsClusters.includes(cls);
                                                return (
                                                    <button
                                                        key={cls}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setDistrictsClusters(districtsClusters.filter(c => c !== cls));
                                                            } else {
                                                                setDistrictsClusters([...districtsClusters, cls]);
                                                            }
                                                        }}
                                                        style={{
                                                            fontSize: '0.65rem',
                                                            fontWeight: '700',
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            border: '1px solid',
                                                            borderColor: isSelected ? '#6366f1' : '#cbd5e1',
                                                            background: isSelected ? '#eff6ff' : 'white',
                                                            color: isSelected ? '#4f46e5' : '#64748b',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        {cls}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>OTHERS LIMIT</span>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', background: '#eff6ff', color: '#4f46e5' }}>
                                                {othersClusters.length > 0 ? othersClusters.join(', ') : 'None'}
                                            </span>
                                        </div>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#94a3b8' }}>₹</span>
                                            <input
                                                type="number"
                                                className="form-input"
                                                style={{ paddingLeft: '28px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 8px 8px 24px', width: '100%' }}
                                                value={accommodationOthers}
                                                onChange={e => setAccommodationOthers(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '12px' }}>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>Mapped Clusters</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {allClusterOptions.map(cls => {
                                                const isSelected = othersClusters.includes(cls);
                                                return (
                                                    <button
                                                        key={cls}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setOthersClusters(othersClusters.filter(c => c !== cls));
                                                            } else {
                                                                setOthersClusters([...othersClusters, cls]);
                                                            }
                                                        }}
                                                        style={{
                                                            fontSize: '0.65rem',
                                                            fontWeight: '700',
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            border: '1px solid',
                                                            borderColor: isSelected ? '#6366f1' : '#cbd5e1',
                                                            background: isSelected ? '#eff6ff' : 'white',
                                                            color: isSelected ? '#4f46e5' : '#64748b',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        {cls}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>                  </div>
                        </div>

                        {/* SECTION C — DAILY ALLOWANCE */}
                        <div>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                                C — DAILY ALLOWANCE
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={dailyAllowanceAmount}
                                    onChange={e => setDailyAllowanceAmount(e.target.value)}
                                    style={{ width: '200px', borderRadius: '10px', padding: '10px 14px', border: '1.5px solid #cbd5e1' }}
                                />
                                <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>* per day</span>
                            </div>
                        </div>

                        {/* SECTION D — OWN STAY ALLOWANCE (% OF HOTEL LIMIT) */}
                        <div>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                                D — OWN STAY ALLOWANCE (% OF HOTEL LIMIT)
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                <div className="form-field">
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '8px', display: 'block' }}>State HQ (%)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={ownStayStateHqPct}
                                            onChange={e => setOwnStayStateHqPct(e.target.value)}
                                            max={100}
                                            min={0}
                                            style={{ borderRadius: '10px', padding: '10px 14px', border: '1.5px solid #cbd5e1', width: '100%' }}
                                        />
                                    </div>
                                </div>

                                <div className="form-field">
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '8px', display: 'block' }}>Districts (%)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={ownStayDistrictsPct}
                                            onChange={e => setOwnStayDistrictsPct(e.target.value)}
                                            max={100}
                                            min={0}
                                            style={{ borderRadius: '10px', padding: '10px 14px', border: '1.5px solid #cbd5e1', width: '100%' }}
                                        />
                                    </div>
                                </div>

                                <div className="form-field">
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '8px', display: 'block' }}>Others (%)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={ownStayOthersPct}
                                            onChange={e => setOwnStayOthersPct(e.target.value)}
                                            max={100}
                                            min={0}
                                            style={{ borderRadius: '10px', padding: '10px 14px', border: '1.5px solid #cbd5e1', width: '100%' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SECTION E — ODOMETER / MILEAGE LIMIT */}
                        <div>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                                E — ODOMETER / MILEAGE LIMIT
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={maxMileageKm}
                                    onChange={e => setMaxMileageKm(e.target.value)}
                                    style={{ width: '200px', borderRadius: '10px', padding: '10px 14px', border: '1.5px solid #cbd5e1' }}
                                    placeholder="Enter limit in KM"
                                    min="0"
                                    step="0.01"
                                />
                                <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>* max km allowed per trip</span>
                            </div>
                        </div>

                        {/* SECTION F — LAUNDRY ELIGIBILITY */}
                        <div>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                                F — LAUNDRY ELIGIBILITY
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={laundryDaysThreshold}
                                    onChange={e => setLaundryDaysThreshold(e.target.value)}
                                    style={{ width: '200px', borderRadius: '10px', padding: '10px 14px', border: '1.5px solid #cbd5e1' }}
                                    placeholder="Enter stay days/nights"
                                    min="0"
                                />
                                <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>* minimum stay nights in Guest House / Bavya Guest House for laundry to be applicable</span>
                            </div>
                        </div>

                        {/* DESIGNATION KEYWORDS (AUTO-MATCHING) */}
                        <div>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                                DESIGNATION KEYWORDS (AUTO-MATCHING)
                            </h3>
                            
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                                {designationKeywords.map(kw => (
                                    <span key={kw} style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '0.8rem',
                                        fontWeight: '700',
                                        background: '#eff6ff',
                                        color: '#4f46e5',
                                        padding: '6px 12px',
                                        borderRadius: '100px',
                                        border: '1.5px solid #dbeafe'
                                    }}>
                                        {kw}
                                        <X size={14} style={{ cursor: 'pointer', color: '#4f46e5' }} onClick={() => handleRemoveKeyword(kw)} />
                                    </span>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                                <select
                                    className="form-select"
                                    value={selectedDesigDropdown}
                                    onChange={e => {
                                        setSelectedDesigDropdown(e.target.value);
                                        handleAddKeyword(e.target.value);
                                    }}
                                    style={{ flex: 1, borderRadius: '10px', padding: '10px 14px', border: '1.5px solid #cbd5e1' }}
                                >
                                    <option value="">Select Designation from ERP...</option>
                                    {allDesignations.map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                                <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Or type custom designation..."
                                        value={customKeyword}
                                        onChange={e => setCustomKeyword(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddKeyword(customKeyword.trim());
                                                setCustomKeyword('');
                                            }
                                        }}
                                        style={{ borderRadius: '10px', padding: '10px 14px', border: '1.5px solid #cbd5e1', flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        className="add-btn"
                                        onClick={() => {
                                            handleAddKeyword(customKeyword.trim());
                                            setCustomKeyword('');
                                        }}
                                        style={{ height: '44px', borderRadius: '10px', padding: '0 16px', background: '#6366f1', border: 'none', color: 'white', fontWeight: '600' }}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                            <p style={{ margin: '8px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                                Employee designations containing any of these keywords will be matched to this cadre.
                            </p>
                        </div>

                    </form>
                </div>

                {/* Footer */}
                <div style={{ 
                    padding: '20px 40px', 
                    background: '#ffffff', 
                    display: 'flex', 
                    justifyContent: 'flex-end',
                    gap: '12px', 
                    position: 'sticky', 
                    bottom: 0, 
                    zIndex: 10 
                }}>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        style={{ 
                            background: 'white', 
                            border: '1.5px solid #cbd5e1', 
                            padding: '10px 24px', 
                            borderRadius: '100px', 
                            fontWeight: '600', 
                            color: '#475569', 
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        form="entitlement-policy-form" 
                        style={{ 
                            background: '#6366f1', 
                            color: 'white', 
                            border: 'none', 
                            padding: '10px 32px', 
                            borderRadius: '100px', 
                            fontWeight: '600', 
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)'
                        }}
                    >
                        Save Policy
                    </button>
                </div>

            </div>
        </div>
    );
}
