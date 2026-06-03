import React, { useState, useEffect } from 'react';
import {
    Shield,
    Search,
    Plus,
    Trash2,
    RefreshCw,
    UserPlus,
    Briefcase,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import api from '../api/api';
import { useToast } from '../context/ToastContext.jsx';

const HRPositionConfig = () => {
    const { showToast } = useToast();
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/hr-position-config/');
            const data = response.data.results || response.data;
            setConfigs(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast('Failed to load HR position configurations', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (query) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            // Reuse the positions search endpoint from finance workflow to centralize HRMS caching
            const response = await api.get(`/api/finance-workflow-config/search-positions/?q=${query}`);
            const data = response.data.results || response.data;
            setSearchResults(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Position search failed', err);
        } finally {
            setSearching(false);
        }
    };

    const addPosition = async (item) => {
        try {
            const payload = {
                position_id: String(item.id),
                position_name: item.name,
                is_active: true
            };

            const response = await api.post('/api/hr-position-config/', payload);
            setConfigs([...configs, response.data]);
            setShowAddModal(false);
            setSearchQuery('');
            setSearchResults([]);
            showToast(`Successfully configured ${item.name} as an HR Position`, 'success');
        } catch (err) {
            showToast(err.response?.data?.detail || err.response?.data?.position_id?.[0] || 'Failed to add HR position', 'error');
        }
    };

    const removePosition = async (id) => {
        if (!window.confirm('Are you sure you want to remove this HR position configuration? Current HR tasks won\'t route to it anymore.')) return;
        try {
            await api.delete(`/api/hr-position-config/${id}/`);
            setConfigs(configs.filter(c => c.id !== id));
            showToast('HR Position removed', 'success');
        } catch (err) {
            showToast('Failed to remove position', 'error');
        }
    };

    const toggleActive = async (id, currentStatus) => {
        try {
            const response = await api.patch(`/api/hr-position-config/${id}/`, { is_active: !currentStatus });
            setConfigs(configs.map(c => c.id === id ? response.data : c));
            showToast('Position status updated', 'success');
        } catch (err) {
            showToast('Failed to update status', 'error');
        }
    };

    const toggleCanApprove = async (id, currentStatus) => {
        try {
            const response = await api.patch(`/api/hr-position-config/${id}/`, { can_approve: !currentStatus });
            setConfigs(configs.map(c => c.id === id ? response.data : c));
            showToast('Position approval authority updated', 'success');
        } catch (err) {
            showToast('Failed to update approval authority', 'error');
        }
    };

    if (loading && configs.length === 0) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <RefreshCw size={40} style={{ animation: 'spin 1s linear infinite', color: '#8b5cf6', marginBottom: '12px' }} />
                    <p style={{ color: '#64748b' }}>Loading HR Position details...</p>
                    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-page" style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0' }}>HR Position Configuration</h1>
                    <p style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={16} /> Manage target HR Positions for Intimation (Mark as Read) dispatch routing.
                    </p>
                </div>
                <button
                    onClick={() => { setShowAddModal(true); setSearchQuery(''); setSearchResults([]); }}
                    style={{ backgroundColor: '#8b5cf6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.2)', cursor: 'pointer' }}
                >
                    <UserPlus size={18} /> Configure HR Position
                </button>
            </div>

            {/* Dashboard Summary / Intro */}
            <div style={{ backgroundColor: '#ede9fe', padding: '20px', borderRadius: '16px', border: '1px solid #ddd6fe', color: '#5b21b6', marginBottom: '24px', lineHeight: '1.5' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 'bold', color: '#4c1d95' }}>Position-Based HR Information & Approval Matrix</h3>
                Employees occupying positions configured below will receive all auto-approved top-level Trip Requests and final Claims/Advances into their Inboxes. By default, HR receives these as information entries requiring <strong>Mark as Read</strong> acknowledgement. If <strong>Formal Approval</strong> is enabled, requests from employees reporting to the COO will require active approval/rejection from HR before completion.
            </div>

            {/* Config Table */}
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>POSITION IDENTIFIER</th>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>POSITION NAME</th>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>ROUTING STATUS</th>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>APPROVAL AUTHORITY</th>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px', textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {configs.length === 0 ? (
                            <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No HR positions configured. Configure one to start parallel dispatch.</td></tr>
                        ) : (
                            configs.map((cfg) => (
                                <tr key={cfg.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ backgroundColor: '#f5f3ff', padding: '8px', borderRadius: '8px', color: '#8b5cf6' }}>
                                                <Briefcase size={16} />
                                            </div>
                                            <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: '#4b5563', fontSize: '14px' }}>{cfg.position_id}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{cfg.position_name}</div>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <button
                                            onClick={() => toggleActive(cfg.id, cfg.is_active)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '6px 12px',
                                                borderRadius: '20px',
                                                border: 'none',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                backgroundColor: cfg.is_active ? '#dcfce7' : '#fee2e2',
                                                color: cfg.is_active ? '#15803d' : '#b91c1c'
                                            }}
                                        >
                                            {cfg.is_active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                            {cfg.is_active ? 'Active Routing' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <button
                                            onClick={() => toggleCanApprove(cfg.id, cfg.can_approve)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '6px 12px',
                                                borderRadius: '20px',
                                                border: 'none',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                backgroundColor: cfg.can_approve ? '#dbeafe' : '#f3f4f6',
                                                color: cfg.can_approve ? '#2563eb' : '#4b5563'
                                            }}
                                        >
                                            {cfg.can_approve ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                            {cfg.can_approve ? 'Formal Approval' : 'Mark as Read'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                        <button
                                            onClick={() => removePosition(cfg.id)}
                                            style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', padding: '8px' }}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: '#fff', width: '100%', maxWidth: '500px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Configure HR Position</h2>
                            <button onClick={() => setShowAddModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '24px', color: '#94a3b8' }}>&times;</button>
                        </div>

                        <div style={{ padding: '24px' }}>
                            <div style={{ position: 'relative', marginBottom: '16px' }}>
                                <Search size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94a3b8' }} />
                                <input
                                    type="text"
                                    placeholder="Search position name (e.g., CHRO, HR Executive)..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}
                                    autoFocus
                                />
                            </div>

                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '10px' }}>
                                {searching ? (
                                    <div style={{ padding: '30px', textAlign: 'center' }}><RefreshCw style={{ animation: 'spin 1s linear infinite', color: '#8b5cf6' }} /></div>
                                ) : searchResults.length > 0 ? (
                                    searchResults.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => addPosition(item)}
                                            style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ backgroundColor: '#f5f3ff', padding: '8px', borderRadius: '8px', color: '#8b5cf6' }}><Briefcase size={16} /></div>
                                                <div>
                                                    <div style={{ fontWeight: '600', color: '#1e293b' }}>{item.name}</div>
                                                    <div style={{ fontSize: '12px', color: '#64748b' }}>ID: {item.id} {item.parent_name ? `• Reports to ${item.parent_name}` : ''}</div>
                                                </div>
                                            </div>
                                            <Plus size={18} color="#8b5cf6" />
                                        </div>
                                    ))
                                ) : searchQuery.length >= 2 ? (
                                    <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No positions found.</div>
                                ) : (
                                    <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Type at least 2 characters to search</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HRPositionConfig;