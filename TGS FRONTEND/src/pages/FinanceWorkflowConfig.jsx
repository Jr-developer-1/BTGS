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
    CheckSquare,
    Users
} from 'lucide-react';
import api from '../api/api';
import { useToast } from '../context/ToastContext.jsx';

const FinanceWorkflowConfig = () => {
    const { showToast } = useToast();
    const [steps, setSteps] = useState([]);
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
    const [newCanEditAmount, setNewCanEditAmount] = useState(true);
    const [newCanViewReports, setNewCanViewReports] = useState(false);
    const [newVisibilityType, setNewVisibilityType] = useState('INBOX');
    const [newTripType, setNewTripType] = useState('BOTH');
    const [newTripControl, setNewTripControl] = useState('APPROVAL');
    const [newFinanceLevelType, setNewFinanceLevelType] = useState('assistant_manager');
    const [selectedPosition, setSelectedPosition] = useState(null);

    const [isParallelFlow, setIsParallelFlow] = useState(false);
    const [enableTwoLevelFlow, setEnableTwoLevelFlow] = useState(false);

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        fetchSteps();
        fetchWorkflowSetting(selectedProject);
    }, [selectedProject]);

    const fetchWorkflowSetting = async (projectCode) => {
        try {
            const response = await api.get(`/api/finance-workflow-config/get_workflow_setting/?project_code=${projectCode}`);
            setIsParallelFlow(response.data.is_parallel);
            setEnableTwoLevelFlow(response.data.enable_two_level_flow);
        } catch (err) {
            console.error('Failed to load workflow setting', err);
        }
    };

    const updateWorkflowSettings = async (parallelValue, twoLevelValue) => {
        try {
            const response = await api.post('/api/finance-workflow-config/set_workflow_setting/', {
                project_code: selectedProject,
                is_parallel: parallelValue,
                enable_two_level_flow: twoLevelValue
            });
            setIsParallelFlow(response.data.is_parallel);
            setEnableTwoLevelFlow(response.data.enable_two_level_flow);
            showToast(`Workflow settings updated successfully`, 'success');
        } catch (err) {
            showToast('Failed to update workflow setting', 'error');
        }
    };

    const handleToggleParallelFlow = () => {
        const newParallel = !isParallelFlow;
        const newTwoLevel = newParallel ? enableTwoLevelFlow : false;
        updateWorkflowSettings(newParallel, newTwoLevel);
    };

    const handleToggleTwoLevelFlow = () => {
        const newTwoLevel = !enableTwoLevelFlow;
        updateWorkflowSettings(isParallelFlow, newTwoLevel);
    };

    const fetchProjects = async () => {
        setProjectsLoading(true);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s max wait
            try {
                const response = await api.get('/api/masters/jurisdictions/projects/', {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                const data = response.data.results || response.data;
                const list = Array.isArray(data) ? data : [];
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
            setProjectsLoading(false);
        }
    };

    const fetchSteps = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/api/finance-workflow-config/?project_code=${selectedProject}`);
            const data = response.data.results || response.data;
            const sortedData = Array.isArray(data) ? data.sort((a, b) => a.sequence_order - b.sequence_order) : [];
            setSteps(sortedData);
        } catch (err) {
            showToast('Failed to load Finance workflow configurations', 'error');
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
        const createdSteps = [];
        const errors = [];

        for (const projectCode of projectCodes) {
            const payload = {
                position_id: String(item.id),
                position_name: item.name,
                project_code: projectCode,
                can_edit_amount: newCanEditAmount,
                can_view_reports: newCanViewReports,
                visibility_type: newVisibilityType,
                trip_type: newTripType,
                trip_control: newTripControl,
                finance_level_type: newFinanceLevelType,
                is_active: true
            };

            try {
                const response = await api.post('/api/finance-workflow-config/', payload);
                createdSteps.push(response.data);
            } catch (err) {
                errors.push({ projectCode, error: err });
            }
        }

        if (!createdSteps.length) {
            const errorMsg = errors[0]?.error?.response?.data?.detail || 'Failed to add Finance step for selected projects';
            showToast(errorMsg, 'error');
            return;
        }

        if (projectCodes.includes(selectedProject)) {
            setSteps([...steps, ...createdSteps].sort((a, b) => a.sequence_order - b.sequence_order));
        }

        setShowAddModal(false);
        setSelectedPosition(null);
        setSearchQuery('');
        setSearchResults([]);
        setNewConfigProjects([selectedProject || 'General']);
        setNewCanEditAmount(true);
        setNewCanViewReports(false);
        setNewVisibilityType('INBOX');
        setNewTripType('BOTH');
        setNewTripControl('APPROVAL');
        setNewFinanceLevelType('assistant_manager');

        const successCount = createdSteps.length;
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

    const removeStep = async (id) => {
        if (!window.confirm('Are you sure you want to remove this Finance step configuration?')) return;
        try {
            await api.delete(`/api/finance-workflow-config/${id}/`);
            setSteps(steps.filter(s => s.id !== id));
            showToast('Finance Step removed', 'success');
        } catch (err) {
            showToast('Failed to remove step', 'error');
        }
    };

    const updateStepConfig = async (id, patchFields) => {
        try {
            const response = await api.patch(`/api/finance-workflow-config/${id}/`, patchFields);
            setSteps(steps.map(s => s.id === id ? response.data : s).sort((a, b) => a.sequence_order - b.sequence_order));
            showToast('Configuration updated', 'success');
        } catch (err) {
            showToast('Failed to update configuration', 'error');
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
            await api.post('/api/finance-workflow-config/reorder_steps/', {
                ids: orderedSteps.map(s => s.id)
            });
            showToast('Sequence order synchronized', 'success');
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
                    <p style={{ color: '#64748b' }}>Loading Finance configuration...</p>
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
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0' }}>Finance Workflow Configuration</h1>
                    <p style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={16} /> Manage target Finance Positions and sequential/parallel routing for payout release.
                    </p>
                </div>
                <button
                    onClick={() => { setShowAddModal(true); setSearchQuery(''); setSearchResults([]); setSelectedPosition(null); setNewConfigProjects([selectedProject || 'General']); }}
                    style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)', cursor: 'pointer' }}
                >
                    <UserPlus size={18} /> Configure Finance Position
                </button>
            </div>

            {/* Project Selection & Routing Settings */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', backgroundColor: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontWeight: '600', color: '#475569', fontSize: '14px' }}>Workflow Routing:</span>
                        <button
                            onClick={handleToggleParallelFlow}
                            style={{
                                position: 'relative',
                                width: '100px',
                                height: '34px',
                                borderRadius: '17px',
                                backgroundColor: isParallelFlow ? '#3b82f6' : '#64748b',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: isParallelFlow ? 'flex-start' : 'flex-end',
                                padding: '2px 6px',
                                outline: 'none',
                                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)'
                            }}
                        >
                            <span style={{
                                color: '#fff',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                position: 'absolute',
                                left: isParallelFlow ? '38px' : 'auto',
                                right: isParallelFlow ? 'auto' : '38px',
                                transition: 'all 0.3s ease',
                                userSelect: 'none'
                            }}>
                                {isParallelFlow ? 'Parallel' : 'Sequential'}
                            </span>
                            <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: '#fff',
                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }} />
                        </button>
                    </div>

                    {isParallelFlow && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontWeight: '600', color: '#475569', fontSize: '14px' }}>2-Level Flow:</span>
                            <button
                                onClick={handleToggleTwoLevelFlow}
                                style={{
                                    position: 'relative',
                                    width: '100px',
                                    height: '34px',
                                    borderRadius: '17px',
                                    backgroundColor: enableTwoLevelFlow ? '#10b981' : '#64748b',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: enableTwoLevelFlow ? 'flex-start' : 'flex-end',
                                    padding: '2px 6px',
                                    outline: 'none',
                                    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)'
                                }}
                            >
                                <span style={{
                                    color: '#fff',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    position: 'absolute',
                                    left: enableTwoLevelFlow ? '38px' : 'auto',
                                    right: enableTwoLevelFlow ? 'auto' : '38px',
                                    transition: 'all 0.3s ease',
                                    userSelect: 'none'
                                }}>
                                    {enableTwoLevelFlow ? 'Enabled' : 'Disabled'}
                                </span>
                                <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    backgroundColor: '#fff',
                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Workflow Mode Description Banner */}
            <div style={{ backgroundColor: isParallelFlow ? (enableTwoLevelFlow ? '#ecfdf5' : '#f0fdf4') : '#eff6ff', padding: '20px', borderRadius: '16px', border: isParallelFlow ? (enableTwoLevelFlow ? '1px solid #a7f3d0' : '1px solid #bbf7d0') : '1px solid #bfdbfe', color: isParallelFlow ? (enableTwoLevelFlow ? '#065f46' : '#15803d') : '#1e3a8a', marginBottom: '24px', lineHeight: '1.5', transition: 'all 0.3s ease' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 'bold', color: isParallelFlow ? (enableTwoLevelFlow ? '#064e3b' : '#166534') : '#1e3a8a' }}>
                    {isParallelFlow ? (enableTwoLevelFlow ? 'Project-Scoped 2-Level Parallel Finance Routing' : 'Project-Scoped Parallel Finance Routing') : 'Project-Scoped Sequential Finance Routing'}
                </h3>
                {isParallelFlow ? (
                    enableTwoLevelFlow ? (
                        <span>
                            Finance configurations are resolved in <strong>2-Levels</strong>. First, parallel dispatch is sent to all <strong>Assistant Manager</strong> level finance positions. Once any single Assistant Manager confirms, the request is promoted to all <strong>Manager</strong> level finance positions. Finance Hub steps bypass level checks and process immediate payouts.
                        </span>
                    ) : (
                        <span>
                            Finance steps are dispatched <strong>simultaneously</strong> (Parallel dispatch) to all active positions. A <strong>single confirmation</strong> from any position will proceed/clear the stage.
                        </span>
                    )
                ) : (
                    <span>
                        Finance steps are resolved <strong>sequentially</strong> based on the sequence order defined below.
                    </span>
                )}
            </div>

            {/* Workflow Config Table */}
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px', width: '60px' }}>ORDER</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>POSITION IDENTIFIER</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>POSITION NAME</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>FINANCE LEVEL</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>CAN EDIT AMOUNT</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>VISIBILITY TYPE</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>TRIP/TRAVEL ROUTE</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>CONTROL MODE</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>VIEW REPORTS</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px' }}>STATUS</th>
                            <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600', fontSize: '13px', textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {steps.length === 0 ? (
                            <tr>
                                <td colSpan="11" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                    No Finance steps configured for project "{selectedProject}".
                                </td>
                            </tr>
                        ) : (
                            steps.map((step, index) => (
                                <tr key={step.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <button
                                                    onClick={() => reorder(step.id, 'up')}
                                                    disabled={index === 0}
                                                    style={{ color: index === 0 ? '#cbd5e1' : '#64748b', border: 'none', background: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', padding: '2px' }}
                                                >
                                                    <ChevronUp size={16} />
                                                </button>
                                                <button
                                                    onClick={() => reorder(step.id, 'down')}
                                                    disabled={index === steps.length - 1}
                                                    style={{ color: index === steps.length - 1 ? '#cbd5e1' : '#64748b', border: 'none', background: 'none', cursor: index === steps.length - 1 ? 'not-allowed' : 'pointer', padding: '2px' }}
                                                >
                                                    <ChevronDown size={16} />
                                                </button>
                                            </div>
                                            <span style={{ fontWeight: 'bold', color: '#64748b' }}>#{index + 1}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ backgroundColor: '#eff6ff', padding: '8px', borderRadius: '8px', color: '#3b82f6' }}>
                                                <Briefcase size={16} />
                                            </div>
                                            <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: '#4b5563', fontSize: '14px' }}>{step.position_id}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{step.position_name}</div>
                                        <span style={{ fontSize: '11px', backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '2px' }}>
                                            {step.project_code}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <select
                                            value={step.finance_level_type || 'assistant_manager'}
                                            onChange={(e) => updateStepConfig(step.id, { finance_level_type: e.target.value })}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                outline: 'none',
                                                color: step.finance_level_type === 'manager' ? '#0f766e' : '#2563eb',
                                                backgroundColor: step.finance_level_type === 'manager' ? '#f0fdfa' : '#eff6ff',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="assistant_manager">Assistant Manager</option>
                                            <option value="manager">Manager</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <select
                                            value={step.can_edit_amount ? 'true' : 'false'}
                                            onChange={(e) => updateStepConfig(step.id, { can_edit_amount: e.target.value === 'true' })}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                outline: 'none',
                                                color: step.can_edit_amount ? '#16a34a' : '#64748b',
                                                backgroundColor: step.can_edit_amount ? '#f0fdf4' : '#f3f4f6',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="false">No</option>
                                            <option value="true">Yes</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <select
                                            value={step.visibility_type || 'INBOX'}
                                            onChange={(e) => updateStepConfig(step.id, { visibility_type: e.target.value })}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                outline: 'none',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="INBOX">Inbox Only</option>
                                            <option value="FINANCE_HUB">Finance Hub Only</option>
                                            <option value="BOTH">Both</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <select
                                            value={step.trip_type || 'BOTH'}
                                            onChange={(e) => updateStepConfig(step.id, { trip_type: e.target.value })}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                outline: 'none',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="BOTH">Both Trip & Travel</option>
                                            <option value="TRIP">Trip Only (Local)</option>
                                            <option value="TRAVEL">Travel Only (Outstation)</option>
                                            <option value="NONE">None</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <select
                                            value={step.trip_control || 'APPROVAL'}
                                            onChange={(e) => updateStepConfig(step.id, { trip_control: e.target.value })}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                outline: 'none',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="APPROVAL">Approval</option>
                                            <option value="MARK_READ">Mark as Read</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <select
                                            value={step.can_view_reports ? 'true' : 'false'}
                                            onChange={(e) => updateStepConfig(step.id, { can_view_reports: e.target.value === 'true' })}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                outline: 'none',
                                                color: step.can_view_reports ? '#16a34a' : '#64748b',
                                                backgroundColor: step.can_view_reports ? '#f0fdf4' : '#f3f4f6',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="false">Denied</option>
                                            <option value="true">Allowed</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <button
                                            onClick={() => updateStepConfig(step.id, { is_active: !step.is_active })}
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
                                                backgroundColor: step.is_active ? '#dcfce7' : '#fee2e2',
                                                color: step.is_active ? '#15803d' : '#b91c1c'
                                            }}
                                        >
                                            {step.is_active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                            {step.is_active ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
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
                    <div style={{ backgroundColor: '#fff', width: '100%', maxWidth: '550px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Configure Finance Position</h2>
                            <button onClick={() => setShowAddModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '24px', color: '#94a3b8' }}>&times;</button>
                        </div>

                        <div style={{ padding: '24px', maxHeight: '75vh', overflowY: 'auto' }}>
                            {/* Project Scope Selection */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontWeight: '600', color: '#475569', fontSize: '13px', marginBottom: '6px' }}>Project Scope (select one or more)</label>
                                <div style={{ width: '100%', maxHeight: '180px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px', backgroundColor: '#fff', boxSizing: 'border-box' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', cursor: 'pointer' }}>
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
                                        <label key={proj.code} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', cursor: 'pointer' }}>
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
                            </div>

                            {/* Position Search */}
                            <div style={{ position: 'relative', marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontWeight: '600', color: '#475569', fontSize: '13px', marginBottom: '6px' }}>Search Position</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                                    <input
                                        type="text"
                                        placeholder="Search by name (e.g. CFO, Finance Lead)..."
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
                                {!selectedPosition && searchResults.length > 0 && (
                                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', marginTop: '4px', maxHeight: '150px', overflowY: 'auto', backgroundColor: '#fff' }}>
                                        {searchResults.map(item => (
                                            <div
                                                key={item.id}
                                                onClick={() => handleSelectPosition(item)}
                                                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <strong>{item.name}</strong> <span style={{ fontSize: '11px', color: '#64748b' }}>(ID: {item.id})</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Additional Fields */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', fontWeight: '600', color: '#475569', fontSize: '13px', marginBottom: '4px' }}>Finance Level Type</label>
                                    <select
                                        value={newFinanceLevelType}
                                        onChange={(e) => setNewFinanceLevelType(e.target.value)}
                                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                                    >
                                        <option value="assistant_manager">Assistant Manager</option>
                                        <option value="manager">Manager</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: '600', color: '#475569', fontSize: '13px', marginBottom: '4px' }}>Visibility Type</label>
                                    <select
                                        value={newVisibilityType}
                                        onChange={(e) => setNewVisibilityType(e.target.value)}
                                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                                    >
                                        <option value="INBOX">Inbox Only</option>
                                        <option value="FINANCE_HUB">Finance Hub Only</option>
                                        <option value="BOTH">Both</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: '600', color: '#475569', fontSize: '13px', marginBottom: '4px' }}>Trip/Travel Route</label>
                                    <select
                                        value={newTripType}
                                        onChange={(e) => setNewTripType(e.target.value)}
                                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                                    >
                                        <option value="BOTH">Both Trip & Travel</option>
                                        <option value="TRIP">Trip Only (Local)</option>
                                        <option value="TRAVEL">Travel Only (Outstation)</option>
                                        <option value="NONE">None</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: '600', color: '#475569', fontSize: '13px', marginBottom: '4px' }}>Control Mode</label>
                                    <select
                                        value={newTripControl}
                                        onChange={(e) => setNewTripControl(e.target.value)}
                                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                                    >
                                        <option value="APPROVAL">Approval</option>
                                        <option value="MARK_READ">Mark as Read</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '10px' }}>
                                        <input
                                            type="checkbox"
                                            checked={newCanEditAmount}
                                            onChange={(e) => setNewCanEditAmount(e.target.checked)}
                                        />
                                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Can Edit Amount</span>
                                    </label>
                                </div>
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '10px' }}>
                                        <input
                                            type="checkbox"
                                            checked={newCanViewReports}
                                            onChange={(e) => setNewCanViewReports(e.target.checked)}
                                        />
                                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Can View Reports</span>
                                    </label>
                                </div>
                            </div>

                            {/* Submit buttons */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!selectedPosition}
                                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#3b82f6', color: '#fff', cursor: selectedPosition ? 'pointer' : 'not-allowed', opacity: selectedPosition ? 1 : 0.6 }}
                                >
                                    Save Config
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceWorkflowConfig;
