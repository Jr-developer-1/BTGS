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
    XCircle,
    ChevronUp,
    ChevronDown,
    Sliders,
    Layers,
    FileText,
    CheckSquare
} from 'lucide-react';
import api from '../api/api';
import { useToast } from '../context/ToastContext.jsx';

const HRPositionConfig = () => {
    const { showToast } = useToast();
    const [configs, setConfigs] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState('General');
    const [loading, setLoading] = useState(true);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    // Modal fields for initial configuration
    const [newConfigProjects, setNewConfigProjects] = useState(['General']);
    const [newTripsAppr, setNewTripsAppr] = useState('MARK_READ');
    const [newBulkAppr, setNewBulkAppr] = useState('MARK_READ');
    const [newClaimsAppr, setNewClaimsAppr] = useState('MARK_READ');
    const [newEditClaims, setNewEditClaims] = useState('READ_ONLY');
    const [newCanViewReports, setNewCanViewReports] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState(null);

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        fetchConfigs();
    }, [selectedProject]);

    const fetchProjects = async () => {
        setProjectsLoading(true);
        try {
            // Use a timeout so we never get stuck on "Loading projects..."
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s max wait
            try {
                const response = await api.get('/api/masters/jurisdictions/projects/', {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                const data = response.data.results || response.data;
                const list = Array.isArray(data) ? data : [];
                // Filter out the General default so we don't duplicate it (it's already hardcoded in <select>)
                setProjects(list.filter(p => p.code !== 'General'));
            } catch (innerErr) {
                clearTimeout(timeoutId);
                if (innerErr.name === 'AbortError' || innerErr.code === 'ERR_CANCELED') {
                    console.warn('Projects fetch timed out - showing fallback');
                } else {
                    throw innerErr;
                }
            }
        } catch (err) {
            console.error('Failed to load projects', err);
        } finally {
            // Always stop loading — even on error/timeout, so dropdown renders
            setProjectsLoading(false);
        }
    };

    const fetchConfigs = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/api/hr-position-config/?project_code=${selectedProject}`);
            const data = response.data.results || response.data;
            // Sort by sequence_order on client side just in case
            const sortedData = Array.isArray(data) ? data.sort((a, b) => a.sequence_order - b.sequence_order) : [];
            setConfigs(sortedData);
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
        const projectCodes = newConfigProjects.length ? newConfigProjects : ['General'];
        const createdConfigs = [];
        const errors = [];

        for (const projectCode of projectCodes) {
            const payload = {
                position_id: String(item.id),
                position_name: item.name,
                project_code: projectCode,
                trips_approval: newTripsAppr,
                bulk_approval: newBulkAppr,
                claims_approval: newClaimsAppr,
                edit_claims: newEditClaims,
                can_view_reports: newCanViewReports,
                is_active: true
            };

            try {
                const response = await api.post('/api/hr-position-config/', payload);
                createdConfigs.push(response.data);
            } catch (err) {
                errors.push({ projectCode, error: err });
            }
        }

        if (!createdConfigs.length) {
            const errorMsg = errors[0]?.error?.response?.data?.detail || 'Failed to add HR position for selected projects';
            showToast(errorMsg, 'error');
            return;
        }

        if (projectCodes.includes(selectedProject)) {
            setConfigs([...configs, ...createdConfigs].sort((a, b) => a.sequence_order - b.sequence_order));
        }

        setShowAddModal(false);
        setSelectedPosition(null);
        setSearchQuery('');
        setSearchResults([]);
        setNewConfigProjects([selectedProject || 'General']);
        setNewTripsAppr('MARK_READ');
        setNewBulkAppr('MARK_READ');
        setNewClaimsAppr('MARK_READ');
        setNewEditClaims('READ_ONLY');
        setNewCanViewReports(false);

        const successCount = createdConfigs.length;
        const projectLabel = successCount > 1 ? `${successCount} projects` : `${projectCodes[0]}`;
        showToast(`Configured ${item.name} for ${projectLabel}`, 'success');
    };

    const handleSelectPosition = (item) => {
        setSelectedPosition(item);
        setSearchQuery(item.name);
        setSearchResults([]);
    };

    const handleClearSelectedPosition = () => {
        setSelectedPosition(null);
        setSearchQuery('');
        setNewConfigProjects([selectedProject || 'General']);
    };

    const handleSave = () => {
        if (!selectedPosition) return;
        addPosition(selectedPosition);
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

    const updatePositionConfig = async (id, patchFields) => {
        try {
            const response = await api.patch(`/api/hr-position-config/${id}/`, patchFields);
            setConfigs(configs.map(c => c.id === id ? response.data : c).sort((a, b) => a.sequence_order - b.sequence_order));
            showToast('Configuration updated', 'success');
        } catch (err) {
            showToast('Failed to update configuration', 'error');
        }
    };

    const reorder = async (id, direction) => {
        const index = configs.findIndex(s => s.id === id);
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === configs.length - 1) return;

        const newConfigs = [...configs];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        [newConfigs[index], newConfigs[newIndex]] = [newConfigs[newIndex], newConfigs[index]];

        const orderedSteps = newConfigs.map((s, i) => ({ ...s, sequence_order: i + 1 }));
        setConfigs(orderedSteps);

        try {
            await api.post('/api/hr-position-config/reorder_steps/', {
                ids: orderedSteps.map(s => s.id)
            });
            showToast('Sequence order synchronized', 'success');
        } catch (err) {
            showToast('Failed to sync order', 'error');
            fetchConfigs();
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
                        <Shield size={16} /> Manage target HR Positions for sequential approval and intimation routing.
                    </p>
                </div>
                <button
                    onClick={() => { setShowAddModal(true); setSearchQuery(''); setSearchResults([]); setSelectedPosition(null); setNewConfigProjects([selectedProject || 'General']); }}
                    style={{ backgroundColor: '#8b5cf6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.2)', cursor: 'pointer' }}
                >
                    <UserPlus size={18} /> Configure HR Position
                </button>
            </div>

            {/* Project Selection Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', backgroundColor: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <span style={{ fontWeight: '600', color: '#475569', fontSize: '14px' }}>Select Project Scope:</span>
                {projectsLoading ? (
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Loading projects...</span>
                ) : (
                    <select
                        value={selectedProject}
                        onChange={(e) => setSelectedProject(e.target.value)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#fff',
                            color: '#1e293b',
                            fontWeight: '600',
                            minWidth: '240px',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="General">General (Global Default)</option>
                        {projects.map((proj) => (
                            <option key={proj.code} value={proj.code}>
                                {proj.name} ({proj.code})
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Dashboard Summary / Intro */}
            <div style={{ backgroundColor: '#ede9fe', padding: '20px', borderRadius: '16px', border: '1px solid #ddd6fe', color: '#5b21b6', marginBottom: '24px', lineHeight: '1.5' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 'bold', color: '#4c1d95' }}>Project-Scoped Sequential HR routing</h3>
                HR configurations are resolved sequentially based on the order defined below.
                If <strong>Formal Approval</strong> is enabled, requests will block at that HR step and require action.
                If <strong>Mark as Read</strong> is enabled, a read-only intimation is dispatched without blocking the workflow.
                If <strong>Can Edit</strong> is enabled, HR members can adjust claim item amounts during review.
            </div>

            {/* Config Table */}
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px', width: '60px' }}>ORDER</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>POSITION IDENTIFIER</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>POSITION NAME</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>TRIP/TRAVEL ROUTE</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>BULK LOG ROUTE</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>CLAIMS/ADVANCES</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>CLAIM EDITING</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>VIEW REPORTS</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>STATUS</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px', textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {configs.length === 0 ? (
                            <tr>
                                <td colSpan="10" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                    No HR positions configured for project "{selectedProject}".
                                </td>
                            </tr>
                        ) : (
                            configs.map((cfg, index) => (
                                <tr key={cfg.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <button
                                                    onClick={() => reorder(cfg.id, 'up')}
                                                    disabled={index === 0}
                                                    style={{ color: index === 0 ? '#cbd5e1' : '#64748b', border: 'none', background: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', padding: '2px' }}
                                                >
                                                    <ChevronUp size={16} />
                                                </button>
                                                <button
                                                    onClick={() => reorder(cfg.id, 'down')}
                                                    disabled={index === configs.length - 1}
                                                    style={{ color: index === configs.length - 1 ? '#cbd5e1' : '#64748b', border: 'none', background: 'none', cursor: index === configs.length - 1 ? 'not-allowed' : 'pointer', padding: '2px' }}
                                                >
                                                    <ChevronDown size={16} />
                                                </button>
                                            </div>
                                            <span style={{ fontWeight: 'bold', color: '#64748b' }}>#{index + 1}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ backgroundColor: '#f5f3ff', padding: '8px', borderRadius: '8px', color: '#8b5cf6' }}>
                                                <Briefcase size={16} />
                                            </div>
                                            <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: '#4b5563', fontSize: '14px' }}>{cfg.position_id}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{cfg.position_name}</div>
                                        <span style={{ fontSize: '11px', backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '2px' }}>
                                            {cfg.project_code}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <select
                                            value={cfg.trips_approval}
                                            onChange={(e) => updatePositionConfig(cfg.id, { trips_approval: e.target.value })}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                outline: 'none',
                                                color: cfg.trips_approval === 'APPROVAL' ? '#2563eb' : (cfg.trips_approval === 'MARK_READ' ? '#16a34a' : '#64748b'),
                                                backgroundColor: cfg.trips_approval === 'APPROVAL' ? '#eff6ff' : (cfg.trips_approval === 'MARK_READ' ? '#f0fdf4' : '#f3f4f6'),
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="NONE">None</option>
                                            <option value="MARK_READ">Mark as Read</option>
                                            <option value="APPROVAL">Formal Approval</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <select
                                            value={cfg.bulk_approval}
                                            onChange={(e) => updatePositionConfig(cfg.id, { bulk_approval: e.target.value })}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                outline: 'none',
                                                color: cfg.bulk_approval === 'APPROVAL' ? '#2563eb' : (cfg.bulk_approval === 'MARK_READ' ? '#16a34a' : '#64748b'),
                                                backgroundColor: cfg.bulk_approval === 'APPROVAL' ? '#eff6ff' : (cfg.bulk_approval === 'MARK_READ' ? '#f0fdf4' : '#f3f4f6'),
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="NONE">None</option>
                                            <option value="MARK_READ">Mark as Read</option>
                                            <option value="APPROVAL">Formal Approval</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <select
                                            value={cfg.claims_approval}
                                            onChange={(e) => updatePositionConfig(cfg.id, { claims_approval: e.target.value })}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                outline: 'none',
                                                color: cfg.claims_approval === 'APPROVAL' ? '#2563eb' : (cfg.claims_approval === 'MARK_READ' ? '#16a34a' : '#64748b'),
                                                backgroundColor: cfg.claims_approval === 'APPROVAL' ? '#eff6ff' : (cfg.claims_approval === 'MARK_READ' ? '#f0fdf4' : '#f3f4f6'),
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="NONE">None</option>
                                            <option value="MARK_READ">Mark as Read</option>
                                            <option value="APPROVAL">Formal Approval</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <select
                                            value={cfg.edit_claims}
                                            onChange={(e) => updatePositionConfig(cfg.id, { edit_claims: e.target.value })}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                outline: 'none',
                                                color: cfg.edit_claims === 'CAN_EDIT' ? '#7c3aed' : '#4b5563',
                                                backgroundColor: cfg.edit_claims === 'CAN_EDIT' ? '#f5f3ff' : '#f3f4f6',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="READ_ONLY">Read Only</option>
                                            <option value="CAN_EDIT">Can Edit</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <select
                                            value={cfg.can_view_reports ? 'true' : 'false'}
                                            onChange={(e) => updatePositionConfig(cfg.id, { can_view_reports: e.target.value === 'true' })}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                outline: 'none',
                                                color: cfg.can_view_reports ? '#16a34a' : '#64748b',
                                                backgroundColor: cfg.can_view_reports ? '#f0fdf4' : '#f3f4f6',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="false">Denied</option>
                                            <option value="true">Allowed</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <button
                                            onClick={() => updatePositionConfig(cfg.id, { is_active: !cfg.is_active })}
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
                                            {cfg.is_active ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
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
                    <div style={{ backgroundColor: '#fff', width: '100%', maxWidth: '550px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Configure HR Position</h2>
                            <button onClick={() => setShowAddModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '24px', color: '#94a3b8' }}>&times;</button>
                        </div>

                        <div style={{ padding: '24px' }}>
                            {/* Project Scope Selection */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontWeight: '600', color: '#475569', fontSize: '13px', marginBottom: '6px' }}>Project Scope (select one or more)</label>
                                <div style={{ width: '100%', maxHeight: '220px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px', backgroundColor: '#fff' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                        <input
                                            type="checkbox"
                                            checked={newConfigProjects.includes('General')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setNewConfigProjects(prev => Array.from(new Set([...prev, 'General'])));
                                                } else {
                                                    setNewConfigProjects(prev => prev.filter(code => code !== 'General'));
                                                }
                                            }}
                                        />
                                        <span style={{ color: '#1f2937', fontWeight: 600 }}>General (Global Default)</span>
                                    </label>
                                    {projects.map((proj) => (
                                        <label key={proj.code} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                            <input
                                                type="checkbox"
                                                checked={newConfigProjects.includes(proj.code)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setNewConfigProjects(prev => Array.from(new Set([...prev, proj.code])));
                                                    } else {
                                                        setNewConfigProjects(prev => prev.filter(code => code !== proj.code));
                                                    }
                                                }}
                                            />
                                            <span style={{ color: '#1f2937' }}>{proj.name} ({proj.code})</span>
                                        </label>
                                    ))}
                                </div>
                                <span style={{ fontSize: '11px', color: '#475569', marginTop: '8px', display: 'block' }}>
                                    Choose one or more projects. Selections determine HR routing for this position configuration.
                                </span>
                            </div>

                            {/* Position Search */}
                            <div style={{ position: 'relative', marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontWeight: '600', color: '#475569', fontSize: '13px', marginBottom: '6px' }}>Search Position</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                                    <input
                                        type="text"
                                        placeholder="Search by name (e.g. CHRO, HR Executive)..."
                                        value={searchQuery}
                                        onChange={(e) => handleSearch(e.target.value)}
                                        disabled={!!selectedPosition}
                                        style={{ 
                                            width: '100%', 
                                            padding: '10px 40px 10px 40px', 
                                            borderRadius: '8px', 
                                            border: '1px solid #cbd5e1', 
                                            outline: 'none', 
                                            boxSizing: 'border-box',
                                            backgroundColor: selectedPosition ? '#f1f5f9' : '#fff',
                                            color: selectedPosition ? '#475569' : '#0f172a'
                                        }}
                                        autoFocus
                                    />
                                    {selectedPosition && (
                                        <button 
                                            onClick={handleClearSelectedPosition}
                                            style={{ 
                                                position: 'absolute', 
                                                right: '12px', 
                                                top: '10px', 
                                                border: 'none', 
                                                background: 'none', 
                                                cursor: 'pointer', 
                                                color: '#ef4444',
                                                fontWeight: 'bold',
                                                fontSize: '16px'
                                            }}
                                        >
                                            &times;
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Options configuration */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', fontWeight: '600', color: '#475569', fontSize: '13px', marginBottom: '4px' }}>Trip/Travel Route</label>
                                    <select
                                        value={newTripsAppr}
                                        onChange={(e) => setNewTripsAppr(e.target.value)}
                                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                                    >
                                        <option value="NONE">None</option>
                                        <option value="MARK_READ">Mark as Read</option>
                                        <option value="APPROVAL">Formal Approval</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: '600', color: '#475569', fontSize: '13px', marginBottom: '4px' }}>Bulk Activity Log</label>
                                    <select
                                        value={newBulkAppr}
                                        onChange={(e) => setNewBulkAppr(e.target.value)}
                                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                                    >
                                        <option value="NONE">None</option>
                                        <option value="MARK_READ">Mark as Read</option>
                                        <option value="APPROVAL">Formal Approval</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: '600', color: '#475569', fontSize: '13px', marginBottom: '4px' }}>Claims/Advances</label>
                                    <select
                                        value={newClaimsAppr}
                                        onChange={(e) => setNewClaimsAppr(e.target.value)}
                                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                                    >
                                        <option value="NONE">None</option>
                                        <option value="MARK_READ">Mark as Read</option>
                                        <option value="APPROVAL">Formal Approval</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: '600', color: '#475569', fontSize: '13px', marginBottom: '4px' }}>Claim Editing</label>
                                    <select
                                        value={newEditClaims}
                                        onChange={(e) => setNewEditClaims(e.target.value)}
                                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                                    >
                                        <option value="READ_ONLY">Read Only</option>
                                        <option value="CAN_EDIT">Can Edit</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: '600', color: '#475569', fontSize: '13px', marginBottom: '4px' }}>Report Access</label>
                                    <select
                                        value={newCanViewReports ? 'true' : 'false'}
                                        onChange={(e) => setNewCanViewReports(e.target.value === 'true')}
                                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                                    >
                                        <option value="false">Denied</option>
                                        <option value="true">Allowed</option>
                                    </select>
                                </div>
                            </div>

                             {/* Position search results list / Save button */}
                            {selectedPosition ? (
                                <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={handleClearSelectedPosition}
                                        style={{ 
                                            flex: 1,
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: '1px solid #cbd5e1',
                                            backgroundColor: '#fff',
                                            color: '#475569',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Change Position
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        style={{ 
                                            flex: 2,
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            backgroundColor: '#8b5cf6',
                                            color: '#fff',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.2)'
                                        }}
                                    >
                                        Save Configuration
                                    </button>
                                </div>
                            ) : (
                                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                                    {searching ? (
                                        <div style={{ padding: '20px', textAlign: 'center' }}><RefreshCw style={{ animation: 'spin 1s linear infinite', color: '#8b5cf6' }} /></div>
                                    ) : searchResults.length > 0 ? (
                                        searchResults.map(item => (
                                            <div
                                                key={item.id}
                                                onClick={() => handleSelectPosition(item)}
                                                style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ backgroundColor: '#f5f3ff', padding: '6px', borderRadius: '6px', color: '#8b5cf6' }}><Briefcase size={14} /></div>
                                                    <div>
                                                        <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '13px' }}>{item.name}</div>
                                                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                            ID: {item.id} {item.parent_name ? `• Reports to ${item.parent_name}` : ''}
                                                            {item.project_code && item.project_code !== 'General' && (
                                                                <span style={{ marginLeft: '8px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                                                    Project: {item.project_code}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Plus size={16} color="#8b5cf6" />
                                            </div>
                                        ))
                                    ) : searchQuery.length >= 2 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No positions found.</div>
                                    ) : (
                                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>Type at least 2 characters of position name to search and select</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HRPositionConfig;