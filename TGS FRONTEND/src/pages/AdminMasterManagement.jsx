import React, { useState, useEffect } from 'react';
import api from '../api/api';
import {
    Plus, Edit2, Trash2, AlignLeft, Layers, AlertCircle, RotateCcw, Eye, EyeOff,
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
            setData(res.data);
        } catch (error) {
            console.error("Fetch failed", error);
            showToast("Failed to load table data", "error");
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

    return (
        <div className="admin-mgmt-module animate-fade-in" style={{ padding: '0', background: 'transparent' }}>
            <div className="master-page-header" style={{ padding: '20px 40px 0 40px', background: 'transparent', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px', letterSpacing: '-0.02em' }}>Master Management</h1>
                        {/* <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>Global configuration for system-wide master tables.</p> */}
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
                                title={showDeleted ? "Hide inactive records" : "Show deleted/inactive records"}
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
                    <div className="modal-content animate-pop-in">
                        <h2 className="modal-title">{editingItem ? 'Update Registry' : 'Define New Entry'}</h2>
                        <form onSubmit={handleSave}>
                            {visibleFields.map(field => (
                                <div key={field} className="form-field">
                                    <label>{field.replace(/_/g, ' ').toUpperCase()}</label>
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
                                    ) : fieldMetadata[field]?.type === 'boolean' || typeof formData[field] === 'boolean' || field.startsWith('is_') || field === 'status' ? (
                                        <div className="checkbox-field">
                                            <label className="custom-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={formData[field] === true || String(formData[field]).toLowerCase() === 'true' || formData[field] === 1}
                                                    onChange={e => setFormData({ ...formData, [field]: e.target.checked })}
                                                />
                                                <span>Mark as Active/Enabled</span>
                                            </label>
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={formData[field] || ''}
                                            onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                                            placeholder={`Enter value for ${field.replace(/_/g, ' ')}...`}
                                            required
                                        />
                                    )}
                                </div>
                            ))}
                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={() => setIsFormOpen(false)}>Discard</button>
                                <button type="submit" className="save-btn">{editingItem ? 'Save Changes' : 'Create Entry'}</button>
                            </div>
                        </form>
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
