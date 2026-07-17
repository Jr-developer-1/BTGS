import React, { useState, useEffect } from 'react';
import {
    Shield,
    UserPlus,
    RefreshCcw,
    AlertCircle,
    Smartphone,
    Laptop,
    Trash2,
    X,
    PlusCircle,
    Info
} from 'lucide-react';
import api from '../api/api';
import { useToast } from '../context/ToastContext.jsx';

const RolePermissions = () => {
    const { showToast } = useToast();
    const [roles, setRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSavingRole, setIsSavingRole] = useState(false);
    const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleDesc, setNewRoleDesc] = useState('');
    const [isCreatingRole, setIsCreatingRole] = useState(false);
    const [useDynamicPermissions, setUseDynamicPermissions] = useState(true);
    const [isTogglingEnforcement, setIsTogglingEnforcement] = useState(false);

    const WEB_MODULES = [
        { key: 'web_dashboard', label: 'Dashboard', path: '/' },
        { key: 'web_my_trips', label: 'My Trips', path: '/trips' },
        { key: 'web_inbox', label: 'Inbox', path: '/inbox' },
        { key: 'web_outbox', label: 'Outbox', path: '/outbox' },
        { key: 'web_claim_report', label: 'Claim Report', path: '/claim-report' },
        { key: 'web_trip_travel_reports', label: 'Trip & Travel Reports', path: '/trip-travel-reports' },
        { key: 'web_finance_hub', label: 'Finance Hub', path: '/finance' },
        { key: 'web_job_report', label: 'Job Report', path: '/job-report' },
        { key: 'web_settlements', label: 'Settlements', path: '/settlement' },
        { key: 'web_documents', label: 'Documents', path: '/documents' },
        { key: 'web_system_policy', label: 'System Policy', path: '/policy' },
        { key: 'web_user_management', label: 'User Management', path: '/employees' },
        { key: 'web_role_permissions', label: 'Role Permissions', path: '/role-permissions' },
        { key: 'web_finance_workflow', label: 'Finance Workflow', path: '/finance-workflow' },
        { key: 'web_hr_positions', label: 'HR Positions', path: '/hr-positions' },
        { key: 'web_coo_positions', label: 'COO Positions', path: '/coo-positions' },
        { key: 'web_room_requests', label: 'Room Requests (Guesthouse)', path: '/guesthouse' },
        { key: 'web_vehicle_requests', label: 'Vehicle Requests (Fleet)', path: '/fleet' },
        { key: 'web_api_management', label: 'API Management', path: '/api-management' },
        { key: 'web_route_masters', label: 'Route Masters', path: '/route-management' },
        { key: 'web_fuel_master', label: 'Fuel Master', path: '/fuel-master' },
        { key: 'web_master_management', label: 'Master Management', path: '/master-management' },
        { key: 'web_help_support', label: 'Help & Support', path: '/help' },
        { key: 'web_login_history', label: 'Login History', path: '/login-history' },
        { key: 'web_audit_logs', label: 'Audit Logs', path: '/audit-logs' },
        { key: 'web_app_version_config', label: 'App Version Config', path: '/app-version' }
    ];

    const MOBILE_MODULES = [
        { key: 'mobile_trips', label: 'Trips' },
        { key: 'mobile_inbox', label: 'Inbox' },
        { key: 'mobile_outbox', label: 'Outbox' },
        { key: 'mobile_finance_hub', label: 'Finance Hub' },
        { key: 'mobile_settlements', label: 'Settlements' },
        { key: 'mobile_documents', label: 'Documents' },
        { key: 'mobile_system_policy', label: 'System Policy' },
        { key: 'mobile_cfo_room', label: 'CFO Room' },
        { key: 'mobile_user_management', label: 'User Management' },
        { key: 'mobile_guest_houses', label: 'Guest Houses' },
        { key: 'mobile_fleet_management', label: 'Fleet Management' },
        { key: 'mobile_api_management', label: 'API Management' },
        { key: 'mobile_fuel_masters', label: 'Fuel Masters' },
        { key: 'mobile_master_management', label: 'Master Management' },
        { key: 'mobile_admin_masters', label: 'Admin Masters' },
        { key: 'mobile_location_codes', label: 'Location Codes' },
        { key: 'mobile_route_masters', label: 'Route Masters' },
        { key: 'mobile_login_history', label: 'Login History' },
        { key: 'mobile_audit_logs', label: 'Audit Logs' },
        { key: 'mobile_job_report', label: 'Job Report' },
        { key: 'mobile_frs_attendance', label: 'FRS Attendance (Mobile-only)' },
        { key: 'mobile_location_tracking', label: 'Location Tracking (Mobile-only)' },
        { key: 'mobile_frs_requests', label: 'FRS Requests (Mobile-only)' }
    ];

    const getDefaultPermission = (roleName, key) => {
        const r = (roleName || '').toLowerCase();
        const rClean = r.replace(/[^a-z0-9_]/g, '');
        let mappedRole = r;
        if (r.includes('admin')) {
            mappedRole = 'admin';
        } else if (r.includes('finance')) {
            mappedRole = 'finance';
        } else if (r.includes('hr') || r.includes('human resource')) {
            mappedRole = 'hr';
        } else if (r.includes('cfo')) {
            mappedRole = 'cfo';
        } else if (r.includes('guesthouse') || r === 'guesthousemanager' || rClean.includes('cro')) {
            mappedRole = 'guesthousemanager';
        } else if (['reporting', 'manager', 'supervisor', 'lead', 'director', 'head', 'approver', 'officer', 'authority'].some(x => rClean.includes(x))) {
            mappedRole = 'reporting_authority';
        } else if (rClean.includes('management') || rClean.includes('mgmt')) {
            mappedRole = 'management';
        } else if (['employee', 'oe', 'staff'].some(x => rClean.includes(x))) {
            mappedRole = 'employee';
        } else {
            mappedRole = rClean;
        }
        
        if (key.startsWith('web_')) {
            const pathMap = {
                web_dashboard: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo', 'guesthousemanager'],
                web_my_trips: ['employee', 'reporting_authority', 'finance', 'admin'],
                web_inbox: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo', 'guesthousemanager'],
                web_outbox: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo', 'guesthousemanager'],
                web_claim_report: ['hr', 'finance', 'admin'],
                web_trip_travel_reports: ['hr', 'finance', 'admin'],
                web_finance_hub: ['finance', 'admin'],
                web_job_report: ['employee', 'reporting_authority', 'admin'],
                web_settlements: ['finance', 'admin'],
                web_documents: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo'],
                web_system_policy: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo'],
                web_user_management: ['admin'],
                web_role_permissions: ['admin'],
                web_finance_workflow: ['admin'],
                web_hr_positions: ['admin'],
                web_coo_positions: ['admin'],
                web_room_requests: ['admin', 'cfo', 'guesthousemanager'],
                web_vehicle_requests: ['admin', 'guesthousemanager'],
                web_api_management: ['admin'],
                web_route_masters: ['admin'],
                web_fuel_master: ['admin'],
                web_master_management: ['admin'],
                web_help_support: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo', 'guesthousemanager'],
                web_login_history: ['admin'],
                web_audit_logs: ['admin'],
                web_app_version_config: ['admin']
            };
            const allowedRoles = pathMap[key] || [];
            return allowedRoles.includes(mappedRole);
        }
        
        if (key.startsWith('mobile_')) {
            const mobileMap = {
                mobile_trips: ['employee', 'reporting_authority', 'finance', 'admin'],
                mobile_inbox: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo', 'guesthousemanager'],
                mobile_outbox: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo', 'guesthousemanager'],
                mobile_finance_hub: ['finance', 'admin'],
                mobile_settlements: ['finance', 'admin'],
                mobile_documents: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo'],
                mobile_system_policy: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo'],
                mobile_cfo_room: ['cfo', 'admin'],
                mobile_user_management: ['admin'],
                mobile_guest_houses: ['admin', 'cfo', 'guesthousemanager'],
                mobile_fleet_management: ['admin', 'guesthousemanager'],
                mobile_api_management: ['admin'],
                mobile_fuel_masters: ['admin'],
                mobile_master_management: ['admin'],
                mobile_admin_masters: ['admin'],
                mobile_location_codes: ['admin', 'finance'],
                mobile_route_masters: ['admin'],
                mobile_login_history: ['admin'],
                mobile_audit_logs: ['admin'],
                mobile_job_report: ['employee', 'reporting_authority', 'admin'],
                mobile_frs_attendance: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo', 'guesthousemanager'],
                mobile_location_tracking: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo', 'guesthousemanager'],
                mobile_frs_requests: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo', 'guesthousemanager']
            };
            const allowedRoles = mobileMap[key] || [];
            return allowedRoles.includes(mappedRole);
        }
        
        return false;
    };

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/roles/');
            const rolesList = Array.isArray(response.data) 
                ? response.data 
                : (response.data?.results || []);
            setRoles(rolesList);
            if (rolesList.length > 0) {
                setSelectedRole(prev => {
                    if (prev) {
                        const found = rolesList.find(r => r.id === prev.id);
                        if (found) return found;
                    }
                    return rolesList[0];
                });
            }
        } catch (err) {
            console.error("Error fetching roles:", err);
            showToast("Failed to load roles list", "error");
        } finally {
            setLoading(false);
        }
    };

    const fetchEnforcementStatus = async () => {
        try {
            const response = await api.get('/api/roles/enforcement/');
            setUseDynamicPermissions(response.data.enabled);
        } catch (err) {
            console.error("Error fetching enforcement status:", err);
        }
    };

    const toggleEnforcement = async () => {
        setIsTogglingEnforcement(true);
        try {
            const newStatus = !useDynamicPermissions;
            const response = await api.post('/api/roles/enforcement/', { enabled: newStatus });
            setUseDynamicPermissions(response.data.enabled);
            showToast(
                `Successfully switched to ${response.data.enabled ? 'Dynamic' : 'Hardcoded'} Role Permissions!`,
                'success'
            );
        } catch (err) {
            console.error("Error toggling enforcement status:", err);
            showToast("Failed to update enforcement status", "error");
        } finally {
            setIsTogglingEnforcement(false);
        }
    };

    useEffect(() => {
        fetchRoles();
        fetchEnforcementStatus();
    }, []);

    const handlePermissionToggle = (key) => {
        if (!selectedRole) return;
        const currentPermissions = { ...(selectedRole.permissions || {}) };
        
        const currentValue = currentPermissions[key] !== undefined 
            ? currentPermissions[key] 
            : getDefaultPermission(selectedRole.name, key);
            
        currentPermissions[key] = !currentValue;
        
        setSelectedRole({
            ...selectedRole,
            permissions: currentPermissions
        });
    };

    const handleSaveRole = async () => {
        if (!selectedRole) return;
        setIsSavingRole(true);
        try {
            const payload = {
                name: selectedRole.name,
                description: selectedRole.description || '',
                permissions: selectedRole.permissions || {}
            };
            const response = await api.put(`/api/roles/${selectedRole.id}/`, payload);
            showToast(`Role permissions for "${selectedRole.name}" updated successfully!`, 'success');
            setRoles(prev => prev.map(r => r.id === selectedRole.id ? response.data : r));
            setSelectedRole(response.data);
        } catch (err) {
            console.error("Error saving role permissions:", err);
            showToast("Failed to save role permissions", "error");
        } finally {
            setIsSavingRole(false);
        }
    };

    const handleCreateRole = async (e) => {
        e.preventDefault();
        if (!newRoleName.trim()) {
            showToast("Role name is required", "warning");
            return;
        }
        setIsCreatingRole(true);
        try {
            const payload = {
                name: newRoleName.trim(),
                description: newRoleDesc.trim(),
                permissions: {}
            };
            const response = await api.post('/api/roles/', payload);
            showToast(`Role "${newRoleName}" created successfully!`, 'success');
            setRoles(prev => [...prev, response.data]);
            setSelectedRole(response.data);
            setNewRoleName('');
            setNewRoleDesc('');
            setShowCreateRoleModal(false);
        } catch (err) {
            console.error("Error creating role:", err);
            showToast("Failed to create new role", "error");
        } finally {
            setIsCreatingRole(false);
        }
    };

    const handleDeleteRole = async (roleId, roleName) => {
        const lowerName = (roleName || '').toLowerCase();
        if (['admin', 'employee', 'finance', 'guesthousemanager', 'hr', 'cfo'].includes(lowerName)) {
            showToast("System default roles cannot be deleted", "warning");
            return;
        }
        if (!window.confirm(`Are you sure you want to delete the role "${roleName}"?`)) {
            return;
        }
        try {
            await api.delete(`/api/roles/${roleId}/`);
            showToast(`Role "${roleName}" deleted successfully!`, 'success');
            setRoles(prev => {
                const filtered = prev.filter(r => r.id !== roleId);
                setSelectedRole(prevSel => {
                    if (prevSel && prevSel.id === roleId) {
                        return filtered[0] || null;
                    }
                    return prevSel;
                });
                return filtered;
            });
        } catch (err) {
            console.error("Error deleting role:", err);
            const errMsg = err.response?.data?.detail || "Failed to delete role";
            showToast(errMsg, "error");
        }
    };

    if (loading && roles.length === 0) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <RefreshCcw className="spinning" size={40} style={{ margin: '0 auto 16px', color: '#2563eb' }} />
                    <p style={{ fontSize: '16px', fontWeight: '600' }}>Loading Role Configurations...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh', boxSizing: 'border-box' }}>
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Shield size={32} color="#2563eb" />
                        Role Based Access Control
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '15px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Configure dynamic navigation module permissions for Web and Mobile applications across roles.
                    </p>
                </div>

                {/* Global Enforcement Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#fff', padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Enforce Dynamic Settings</span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{useDynamicPermissions ? 'Using custom configuration' : 'Using hardcoded defaults'}</span>
                    </div>
                    <button
                        onClick={toggleEnforcement}
                        disabled={isTogglingEnforcement}
                        style={{
                            width: '44px',
                            height: '24px',
                            borderRadius: '12px',
                            backgroundColor: useDynamicPermissions ? '#2563eb' : '#cbd5e1',
                            border: 'none',
                            cursor: 'pointer',
                            position: 'relative',
                            padding: 0,
                            transition: 'background-color 0.2s',
                            opacity: isTogglingEnforcement ? 0.7 : 1
                        }}
                    >
                        <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: '#fff',
                            position: 'absolute',
                            top: '3px',
                            left: useDynamicPermissions ? '23px' : '3px',
                            transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }} />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{ display: 'flex', gap: '24px', minHeight: '600px', alignItems: 'flex-start' }}>
                {/* Roles Side Panel */}
                <div style={{ width: '280px', backgroundColor: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>System Roles</h3>
                        <button
                            onClick={() => setShowCreateRoleModal(true)}
                            style={{ padding: '6px 12px', fontSize: '12px', fontWeight: '600', backgroundColor: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <PlusCircle size={14} /> Add Role
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {roles.map(role => {
                            const isSelected = selectedRole?.id === role.id;
                            const roleName = role.name || '';
                            const isSystem = roleName ? ['admin', 'employee', 'finance', 'guesthousemanager', 'hr', 'cfo'].includes(roleName.toLowerCase()) : false;
                            return (
                                <div
                                    key={role.id}
                                    onClick={() => setSelectedRole(role)}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '12px 14px',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                                        border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc' }}
                                    onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                                        <span style={{ fontSize: '14px', fontWeight: '600', color: isSelected ? '#1d4ed8' : '#334155', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                            {roleName || 'Unnamed Role'}
                                        </span>
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                            {isSystem ? 'System Default' : 'Custom'}
                                        </span>
                                    </div>
                                    {!isSystem && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteRole(role.id, role.name);
                                            }}
                                            style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px', opacity: 0.7 }}
                                            onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                                            onMouseOut={(e) => e.currentTarget.style.opacity = 0.7}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Configuration Matrix */}
                {selectedRole ? (
                    <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
                            <div style={{ flex: 1, marginRight: '16px' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>
                                    Permissions Configuration: {selectedRole.name}
                                </h2>
                                <input
                                    type="text"
                                    placeholder="Enter optional description..."
                                    value={selectedRole.description || ''}
                                    onChange={(e) => setSelectedRole({ ...selectedRole, description: e.target.value })}
                                    style={{ border: 'none', borderBottom: '1px dashed #cbd5e1', fontSize: '14px', color: '#64748b', outline: 'none', width: '100%', maxWidth: '400px', padding: '2px 0' }}
                                />
                            </div>
                            <button
                                onClick={handleSaveRole}
                                disabled={isSavingRole}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#2563eb',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
                                }}
                            >
                                {isSavingRole ? <RefreshCcw size={16} className="spinning" /> : <Shield size={16} />}
                                Save Role Configurations
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {/* Web Modules section */}
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                    <Laptop size={18} color="#2563eb" />
                                    Web Modules & Dashboard Screens
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                                    {WEB_MODULES.map(module => {
                                        const isChecked = selectedRole.permissions?.[module.key] !== undefined
                                            ? !!selectedRole.permissions[module.key]
                                            : getDefaultPermission(selectedRole.name, module.key);
                                        return (
                                            <div
                                                key={module.key}
                                                onClick={() => handlePermissionToggle(module.key)}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '14px 18px',
                                                    borderRadius: '12px',
                                                    border: '1px solid #e2e8f0',
                                                    cursor: 'pointer',
                                                    backgroundColor: isChecked ? '#f8fafc' : 'transparent',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#cbd5e1' }}
                                                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e2e8f0' }}
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                                                        {module.label}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                        Route: {module.path}
                                                    </span>
                                                </div>
                                                {/* Switch Toggle */}
                                                <div style={{
                                                    width: '40px',
                                                    height: '22px',
                                                    borderRadius: '999px',
                                                    backgroundColor: isChecked ? '#10b981' : '#cbd5e1',
                                                    position: 'relative',
                                                    transition: 'all 0.2s'
                                                }}>
                                                    <div style={{
                                                        width: '18px',
                                                        height: '18px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#fff',
                                                        position: 'absolute',
                                                        top: '2px',
                                                        left: isChecked ? '20px' : '2px',
                                                        transition: 'all 0.2s',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                                    }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Mobile Modules section */}
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                    <Smartphone size={18} color="#10b981" />
                                    Mobile App Access Modules
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                                    {MOBILE_MODULES.map(module => {
                                        const isChecked = selectedRole.permissions?.[module.key] !== undefined
                                            ? !!selectedRole.permissions[module.key]
                                            : getDefaultPermission(selectedRole.name, module.key);
                                        return (
                                            <div
                                                key={module.key}
                                                onClick={() => handlePermissionToggle(module.key)}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '14px 18px',
                                                    borderRadius: '12px',
                                                    border: '1px solid #e2e8f0',
                                                    cursor: 'pointer',
                                                    backgroundColor: isChecked ? '#f8fafc' : 'transparent',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#cbd5e1' }}
                                                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e2e8f0' }}
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                                                        {module.label}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                        Mobile Feature
                                                    </span>
                                                </div>
                                                {/* Switch Toggle */}
                                                <div style={{
                                                    width: '40px',
                                                    height: '22px',
                                                    borderRadius: '999px',
                                                    backgroundColor: isChecked ? '#10b981' : '#cbd5e1',
                                                    position: 'relative',
                                                    transition: 'all 0.2s'
                                                }}>
                                                    <div style={{
                                                        width: '18px',
                                                        height: '18px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#fff',
                                                        position: 'absolute',
                                                        top: '2px',
                                                        left: isChecked ? '20px' : '2px',
                                                        transition: 'all 0.2s',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                                    }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: '16px', padding: '60px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0' }}>
                        <Info size={48} color="#94a3b8" style={{ margin: '0 auto 16px' }} />
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0' }}>No Role Selected</h3>
                        <p style={{ color: '#64748b', margin: 0 }}>Please select a system or custom role from the left panel to configure permissions.</p>
                    </div>
                )}
            </div>

            {/* Create Role Modal */}
            {showCreateRoleModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: '#fff', width: '100%', maxWidth: '440px', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <UserPlus size={20} color="#2563eb" />
                                Add Custom Role
                            </h2>
                            <button onClick={() => setShowCreateRoleModal(false)} style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateRole}>
                            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Role Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Sales Executive"
                                        value={newRoleName}
                                        onChange={(e) => setNewRoleName(e.target.value)}
                                        style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                                        required
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Description</label>
                                    <textarea
                                        placeholder="Enter role description..."
                                        value={newRoleDesc}
                                        onChange={(e) => setNewRoleDesc(e.target.value)}
                                        style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', minHeight: '80px', resize: 'vertical' }}
                                    />
                                </div>
                            </div>
                            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateRoleModal(false)}
                                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#334155', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreatingRole}
                                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    {isCreatingRole ? <RefreshCcw size={14} className="spinning" /> : null}
                                    Create Role
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RolePermissions;
