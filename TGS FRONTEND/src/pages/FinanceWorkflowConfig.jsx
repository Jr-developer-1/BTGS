import React, { useState, useEffect } from 'react';
import {
    Shield,
    Users,
    Search,
    Plus,
    Trash2,
    ChevronUp,
    ChevronDown,
    RefreshCw,
    UserPlus,
    Briefcase
} from 'lucide-react';
import api from '../api/api';
import { useToast } from '../context/ToastContext.jsx';

const FinanceWorkflowConfig = () => {
    const { showToast } = useToast();
    const [steps, setSteps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState('position'); // force position-centric configuration

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
            const data = response.data.results || response.data;
            setSteps(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast('Failed to load workflow configuration', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (query, currentType = searchType) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const endpoint = currentType === 'position'
                ? `/api/finance-workflow-config/search-positions/?q=${query}`
                : `/api/finance-workflow-config/search-users/?q=${query}`;
            
            const response = await api.get(endpoint);
            const data = response.data.results || response.data;
            setSearchResults(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Search failed', err);
        } finally {
            setSearching(false);
        }
    };

    const addStep = async (item) => {
        try {
            const nextOrder = steps.length > 0 ? Math.max(...steps.map(s => s.sequence_order)) + 1 : 1;
            let payload = {
                sequence_order: nextOrder,
                can_edit_amount: true,
                can_view_reports: false,
                visibility_type: 'INBOX',
                is_active: true
            };

            if (searchType === 'position') {
                payload.position_id = String(item.id);
                payload.position_name = item.name;
            } else {
                payload.user = item.id;
            }

            const response = await api.post('/api/finance-workflow-config/', payload);
            setSteps([...steps, response.data]);
            setShowAddModal(false);
            setSearchQuery('');
            setSearchResults([]);
            showToast(`Added ${searchType === 'position' ? item.name : item.name} to workflow`, 'success');
        } catch (err) {
            showToast(err.response?.data?.detail || 'Failed to add step to workflow', 'error');
        }
    };

    const removeStep = async (id) => {
        if (!window.confirm('Remove this level from the finance workflow?')) return;
        try {
            await api.delete(`/api/finance-workflow-config/${id}/`);
            setSteps(steps.filter(s => s.id !== id));
            showToast('Removed level from workflow', 'success');
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

        const orderedSteps = newSteps.map((s, i) => ({ ...s, sequence_order: i + 1 }));
        setSteps(orderedSteps);

        try {
            await api.post('/api/finance-workflow-config/reorder/', {
                ids: orderedSteps.map(s => s.id)
            });
        } catch (err) {
            showToast('Failed to sync order', 'error');
            fetchSteps();
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
                        <Shield size={16} /> Configure sequential approval levels and position-centric permissions. (Note: Expense Claims and Advances are always approval-based).
                    </p>
                </div>
                <button 
                    onClick={() => { setShowAddModal(true); setSearchType('position'); setSearchQuery(''); setSearchResults([]); }}

                    style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)', cursor: 'pointer' }}
                >
                    <UserPlus size={18} /> Add Approver Step
                </button>
            </div>

            {/* Workflow Visualization */}
            <div style={{ display: 'flex', gap: '24px', marginBottom: '32px', overflowX: 'auto', padding: '8px 4px' }}>
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    <div style={{ padding: '16px', backgroundColor: '#fff', borderRadius: '12px', border: '2px dashed #cbd5e1', color: '#64748b', fontSize: '14px', fontWeight: '600' }}>
                        Management Approved
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
                            minWidth: '200px'
                        }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#3b82f6', fontWeight: '800', marginBottom: '4px' }}>Level {index + 1}</div>
                            <div style={{ fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {step.position_id ? <Briefcase size={14} style={{ color: '#6366f1' }} /> : <Users size={14} style={{ color: '#3b82f6' }} />}
                                {step.position_name || step.user_name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{step.visibility_type === 'BOTH' ? 'Inbox & Hub' : (step.visibility_type === 'FINANCE_HUB' ? 'Finance Hub Only' : 'Inbox Only')}</div>
                        </div>
                        <div style={{ width: '40px', height: '2px', backgroundColor: '#3b82f6' }}></div>
                    </div>
                ))}

                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    <div style={{ padding: '16px', backgroundColor: '#ecfdf5', borderRadius: '12px', border: '2px solid #10b981', color: '#065f46', fontSize: '14px', fontWeight: '600' }}>
                        Payout Completed
                    </div>
                </div>
            </div>

            {/* Config Table */}
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>ORDER</th>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>APPROVER TARGET</th>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>CAN EDIT AMOUNT</th>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>VISIBILITY</th>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>TRIP/TRAVEL TYPE (PRE-TRAVEL)</th>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>CONTROL MODE (PRE-TRAVEL)</th>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>REPORT ACCESS</th>
                            <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: '600', fontSize: '13px', textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {steps.length === 0 ? (
                            <tr><td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No approvers configured. Add one to start.</td></tr>
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {step.position_id ? (
                                                <div style={{ backgroundColor: '#e0e7ff', padding: '6px', borderRadius: '8px', color: '#4f46e5' }}>
                                                    <Briefcase size={16} />
                                                </div>
                                            ) : (
                                                <div style={{ backgroundColor: '#dbeafe', padding: '6px', borderRadius: '8px', color: '#2563eb' }}>
                                                    <Users size={16} />
                                                </div>
                                            )}
                                            <div>
                                                <div style={{ fontWeight: '600', color: '#1e293b' }}>{step.position_name || step.user_name}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                    {step.position_id ? `Position Configuration (ID: ${step.position_id})` : `Specific User (${step.user_emp_id})`}
                                                </div>
                                            </div>
                                        </div>
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
                                    <td style={{ padding: '16px 24px' }}>
                                        <select 
                                            value={step.trip_type}
                                            onChange={(e) => updateStep(step.id, { trip_type: e.target.value })}
                                            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                                        >
                                            <option value="BOTH">Both Trip & Travel</option>
                                            <option value="TRIP">Trip Only (Local)</option>
                                            <option value="TRAVEL">Travel Only (Outstation)</option>
                                            <option value="NONE">None</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <select 
                                            value={step.trip_control}
                                            onChange={(e) => updateStep(step.id, { trip_control: e.target.value })}
                                            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                                        >
                                            <option value="APPROVAL">Approval</option>
                                            <option value="MARK_READ">Mark as Read</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={step.can_view_reports} 
                                                onChange={(e) => updateStep(step.id, { can_view_reports: e.target.checked })}
                                            />
                                            <span style={{ fontSize: '14px' }}>{step.can_view_reports ? 'Yes' : 'No'}</span>
                                        </label>
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
                    <div style={{ backgroundColor: '#fff', width: '100%', maxWidth: '500px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Add Finance Approver</h2>
                            <button onClick={() => setShowAddModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '24px', color: '#94a3b8' }}>&times;</button>
                        </div>



                        <div style={{ padding: '24px' }}>
                            <div style={{ position: 'relative', marginBottom: '16px' }}>
                                <Search size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94a3b8' }} />
                                <input 
                                    type="text" 
                                    placeholder="Search for a position (e.g., CFO, Accountant)..." 
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}
                                    autoFocus
                                />
                            </div>

                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '10px' }}>
                                {searching ? (
                                    <div style={{ padding: '30px', textAlign: 'center' }}><RefreshCw style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} /></div>
                                ) : searchResults.length > 0 ? (
                                    searchResults.map(item => (
                                        <div 
                                            key={item.id} 
                                            onClick={() => addStep(item)}
                                            style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ backgroundColor: '#e0e7ff', padding: '8px', borderRadius: '8px', color: '#4f46e5' }}><Briefcase size={16} /></div>
                                                <div>
                                                    <div style={{ fontWeight: '600', color: '#1e293b' }}>{item.name}</div>
                                                    <div style={{ fontSize: '12px', color: '#64748b' }}>ID: {item.id} {item.parent_name ? `• Reports to ${item.parent_name}` : ''}</div>
                                                </div>
                                            </div>
                                            <Plus size={18} color="#3b82f6" />
                                        </div>
                                    ))
                                ) : searchQuery.length >= 2 ? (
                                    <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                                        <span>No positions found.</span>
                                    </div>

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

export default FinanceWorkflowConfig;
