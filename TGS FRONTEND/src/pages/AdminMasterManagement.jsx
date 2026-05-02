import React, { useState, useEffect } from 'react';
import api from '../api/api';
import {
    Plus, Edit2, Trash2, AlignLeft, Layers, AlertCircle, RotateCcw, Eye, EyeOff, Search,
    Briefcase, Zap, MapPin, Coffee, Shield
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

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const [showDeleted, setShowDeleted] = useState(false);

    const visibleFields = activeTab.fields;

    useEffect(() => {
        fetchData();
    }, [activeTab, showDeleted]);

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
        setEditingItem(item);
        if (item) {
            setFormData({ ...item });
        } else {
            const initial = {};
            activeTab.fields.forEach(f => {
                if (fieldMetadata[f]?.type === 'boolean' || f.startsWith('is_') || f === 'status') {
                    initial[f] = false;
                } else if (f === 'category') {
                    initial[f] = 'general_incidental'; // Default
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
            if (editingItem) {
                await api.put(`/api/${activeTab.endpoint}/${editingItem.id}/`, formData);
                showToast("Updated successfully", "success");
            } else {
                await api.post(`/api/${activeTab.endpoint}/`, formData);
                showToast("Created successfully", "success");
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
            await api.delete(`/api/${activeTab.endpoint}/${deletingId}/`);
            showToast("Deleted successfully", "success");
            setIsConfirmOpen(false);
            fetchData();
        } catch (error) {
            showToast("Deletion failed", "error");
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
                                setActiveTab(group.tables[0]);
                            }}
                        >
                            {group.icon}
                            {group.label}
                        </button>
                    ))}
                </div>

                <div className="admin-content-grid">
                    {/* Sidebar */}
                    <div className="sidebar-panel">
                        <h3 className="sidebar-title">Available Tables</h3>
                        <div className="master-selector-list">
                            {activeGroup.tables.map(table => (
                                <button
                                    key={table.id}
                                    className={`master-selector-btn ${activeTab.id === table.id ? 'active' : ''}`}
                                    onClick={() => setActiveTab(table)}
                                >
                                    <AlignLeft size={16} style={{ marginRight: '10px' }} />
                                    {table.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Data Panel */}
                    <div className="main-table-panel">
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
                                                    <select
                                                        className="form-select"
                                                        value={formData[field] || ''}
                                                        onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                                                        required
                                                    >
                                                        <option value="">Select Category</option>
                                                        <option value="local_conveyance">Local Conveyance</option>
                                                        <option value="travel_incidental">Travel Incidental</option>
                                                        <option value="general_incidental">General Incidental</option>
                                                    </select>
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
            </div>
        </div>
    );
}
