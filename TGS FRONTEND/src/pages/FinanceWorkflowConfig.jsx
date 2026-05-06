import React, { useState, useEffect } from 'react';
import {
    Shield,
    Users,
    Search,
    Plus,
    Trash2,
    ChevronUp,
    ChevronDown,
    Save,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    UserPlus,
    Eye,
    Edit
} from 'lucide-react';
import api from '../api/api';
import { useToast } from '../context/ToastContext.jsx';

const FinanceWorkflowConfig = () => {
    const { showToast } = useToast();
    const [steps, setSteps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    useEffect(() => {
        fetchSteps();
    }, []);

    const fetchSteps = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/finance-workflow-config/');
            // Handle both paginated and non-paginated responses
            const data = response.data.results || response.data;
            setSteps(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast('Failed to load workflow configuration', 'error');
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
            const response = await api.get(`/api/finance-workflow-config/search-users/?q=${query}`);
            const data = response.data.results || response.data;
            setSearchResults(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Search failed', err);
        } finally {
            setSearching(false);
        }
    };

    const addStep = async (user) => {
        try {
            const nextOrder = steps.length > 0 ? Math.max(...steps.map(s => s.sequence_order)) + 1 : 1;
            const payload = {
                user: user.id,
                sequence_order: nextOrder,
                can_edit_amount: true,
                visibility_type: 'INBOX',
                is_active: true
            };
            const response = await api.post('/api/finance-workflow-config/', payload);
            setSteps([...steps, response.data]);
            setShowAddModal(false);
            setSearchQuery('');
            setSearchResults([]);
            showToast(`Added ${user.name} to workflow`, 'success');
        } catch (err) {
            showToast('Failed to add user to workflow', 'error');
        }
    };

    const removeStep = async (id) => {
        if (!window.confirm('Remove this user from the finance workflow?')) return;
        try {
            await api.delete(`/api/finance-workflow-config/${id}/`);
            setSteps(steps.filter(s => s.id !== id));
            showToast('Removed user from workflow', 'success');
        } catch (err) {
            showToast('Failed to remove step', 'error');
        }
    };

    const updateStep = async (id, data) => {
        try {
            const response = await api.patch(`/api/finance-workflow-config/${id}/`, data);
            setSteps(steps.map(s => s.id === id ? response.data : s));
            showToast('Setting updated', 'success');
        } catch (err) {
            showToast('Update failed', 'error');
        }
    };

    const reorder = async (id, direction) => {
        const index = steps.findIndex(s => s.id === id);
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === steps.length - 1) return;

        const newSteps = [...steps];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];

        // Update sequence orders locally
        const orderedSteps = newSteps.map((s, i) => ({ ...s, sequence_order: i + 1 }));
        setSteps(orderedSteps);

        // Sync with backend
        try {
            await api.post('/api/finance-workflow-config/reorder/', {
                ids: orderedSteps.map(s => s.id)
            });
        } catch (err) {
            showToast('Failed to sync order', 'error');
            fetchSteps(); // Revert
        }
    };

    if (loading && steps.length === 0) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <RefreshCw size={40} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6', marginBottom: '12px' }} />
                    <p style={{ color: '#64748b' }}>Loading workflow configuration...</p>
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
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0' }}>Finance Workflow Management</h1>
                    <p style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={16} /> Configure sequential approval levels and permissions for the finance team.
                    </p>
                </div>
                <button 
                    onClick={() => setShowAddModal(true)}
                    style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)', cursor: 'pointer' }}
                >
                    <UserPlus size={18} /> Add Approver
                </button>
            </div>

            {/* Workflow Visualization */}
            <div style={{ display: 'flex', gap: '24px', marginBottom: '32px', overflowX: 'auto', padding: '8px 4px' }}>
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    <div style={{ padding: '16px', backgroundColor: '#fff', borderRadius: '12px', border: '2px dashed #cbd5e1', color: '#64748b', fontSize: '14px', fontWeight: '600' }}>
                        HR Verified
                    </div>
                    <div style={{ width: '40px', height: '2px', backgroundColor: '#cbd5e1' }}></div>
                </div>

                {steps.map((step, index) => (
                    <div key={step.id} style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        <div style={{ 
                            padding: '16px', 
                            backgroundColor: '#fff', 
                            borderRadius: '12px', 
                            border: '2px solid #3b82f6', 
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.1)',
                            minWidth: '180px'
                        }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#3b82f6', fontWeight: '800', marginBottom: '4px' }}>Level {index + 1}</div>
                            <div style={{ fontWeight: '700', color: '#1e293b' }}>{step.user_name}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{step.visibility_type === 'HUB' ? 'Finance Hub' : 'Inbox Only'}</div>
                        </div>
                        <div style={{ width: '40px', height: '2px', backgroundColor: '#3b82f6' }}></div>
                    </div>
                ))}

                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    <div style={{ padding: '16px', backgroundColor: '#ecfdf5', borderRadius: '12px', border: '2px solid #10b981', color: '#065f46', fontSize: '14px', fontWeight: '600' }}>
                        Payout Complete
                    </div>
                </div>
            </div>

            {/* Config Table */}
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>ORDER</th>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>APPROVER</th>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>CAN EDIT AMOUNT</th>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>VISIBILITY</th>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px', textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {steps.length === 0 ? (
                            <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No approvers configured. Add one to start.</td></tr>
                        ) : (
                            steps.map((step, idx) => (
                                <tr key={step.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>#{idx + 1}</span>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <button onClick={() => reorder(step.id, 'up')} disabled={idx === 0} style={{ padding: '2px', border: 'none', background: 'none', cursor: 'pointer', color: idx === 0 ? '#cbd5e1' : '#64748b' }}><ChevronUp size={14} /></button>
                                                <button onClick={() => reorder(step.id, 'down')} disabled={idx === steps.length - 1} style={{ padding: '2px', border: 'none', background: 'none', cursor: 'pointer', color: idx === steps.length - 1 ? '#cbd5e1' : '#64748b' }}><ChevronDown size={14} /></button>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{step.user_name}</div>
                                        <div style={{ fontSize: '12px', color: '#64748b' }}>{step.user_emp_id}</div>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={step.can_edit_amount} 
                                                onChange={(e) => updateStep(step.id, { can_edit_amount: e.target.checked })}
                                            />
                                            <span style={{ fontSize: '14px' }}>{step.can_edit_amount ? 'Yes' : 'No'}</span>
                                        </label>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <select 
                                            value={step.visibility_type}
                                            onChange={(e) => updateStep(step.id, { visibility_type: e.target.value })}
                                            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                                        >
                                            <option value="INBOX">Inbox Only</option>
                                            <option value="FINANCE_HUB">Finance Hub Only</option>
                                            <option value="BOTH">Both</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                        <button 
                                            onClick={() => removeStep(step.id)}
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
                    <div style={{ backgroundColor: '#fff', width: '100%', maxWidth: '500px', borderRadius: '20px', overflow: 'hidden' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Add Finance Approver</h2>
                            <button onClick={() => setShowAddModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
                        </div>
                        <div style={{ padding: '24px' }}>
                            <div style={{ position: 'relative', marginBottom: '16px' }}>
                                <Search size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94a3b8' }} />
                                <input 
                                    type="text" 
                                    placeholder="Search by name or ID..." 
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>

                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '10px' }}>
                                {searching ? (
                                    <div style={{ padding: '20px', textAlign: 'center' }}><RefreshCw style={{ animation: 'spin 1s linear infinite' }} /></div>
                                ) : searchResults.length > 0 ? (
                                    searchResults.map(user => (
                                        <div 
                                            key={user.id} 
                                            onClick={() => addStep(user)}
                                            style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <div>
                                                <div style={{ fontWeight: '600' }}>{user.name}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b' }}>{user.employee_id} • {user.department}</div>
                                            </div>
                                            <Plus size={18} color="#3b82f6" />
                                        </div>
                                    ))
                                ) : searchQuery.length >= 3 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No users found</div>
                                ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Type at least 3 characters to search</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceWorkflowConfig;
