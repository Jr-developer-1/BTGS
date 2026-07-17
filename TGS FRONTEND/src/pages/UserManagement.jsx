import React, { useState, useEffect } from 'react';
import {
    Users,
    UserPlus,
    Search,
    Filter,
    MoreVertical,
    UserCheck,
    AlertCircle,
    Briefcase,
    Download,
    Mail,
    Shield,
    ChevronDown,
    Building2,
    CheckCircle2,
    RefreshCcw,
    Eye,
    EyeOff,
    Copy
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import { useToast } from '../context/ToastContext.jsx';

const UserManagement = () => {
    const { showToast } = useToast();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [apiKeyMissing, setApiKeyMissing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDepartment, setFilterDepartment] = useState('All');
    const [filterProject, setFilterProject] = useState('All');
    const [processingId, setProcessingId] = useState(null);
    const [isSyncingAll, setIsSyncingAll] = useState(false);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [syncProgress, setSyncProgress] = useState(null);
    const [visiblePasswords, setVisiblePasswords] = useState({});

    const togglePasswordVisibility = (code) => {
        setVisiblePasswords(prev => ({
            ...prev,
            [code]: !prev[code]
        }));
    };

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            fetchEmployeesAndUsers(currentPage, searchTerm);
        }, 500);
        return () => clearTimeout(debounceTimer);
    }, [currentPage, searchTerm]);

    const fetchEmployeesAndUsers = async (page = 1, search = '') => {
        setLoading(true);
        setApiKeyMissing(false);
        setError(null);

        try {
            const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
            const [empResponse, usersResponse] = await Promise.allSettled([
                api.get(`/api/employees/?page=${page}&page_size=20${searchParam}`),
                api.get('/api/users/?all_pages=true')
            ]);

            let employeeList = [];
            let userList = [];

            if (empResponse.status === 'fulfilled') {
                employeeList = empResponse.value.data.results || [];
                const count = empResponse.value.data.count || 0;
                const pageSize = employeeList.length || 10;
                setTotalPages(Math.ceil(count / pageSize));
                setApiKeyMissing(false);
            } else {
                const status = empResponse.reason?.response?.status;
                if (status === 400 || status === 404) {
                    setApiKeyMissing(true);
                } else {
                    console.error("Error fetching employees:", empResponse.reason);
                    setError('External API Connection Failed. You can still manage existing users.');
                }
            }

            if (usersResponse.status === 'fulfilled') {
                userList = usersResponse.value.data || [];
            } else {
                const status = usersResponse.reason?.response?.status;
                if (status === 403) {
                    console.warn("User is not authorized to fetch users list. Proceeding with empty list.");
                    userList = [];
                } else {
                    console.warn("Could not fetch existing users list:", usersResponse.reason);
                }
            }

            const processedEmployees = employeeList.map(emp => {
                const code = String(emp.employee_code || emp.employee?.employee_code || '').toLowerCase();
                const matchedUser = userList.find(u => {
                    const uCode = String(u.employee_id || u.username || '').toLowerCase();
                    return uCode && uCode === code;
                });
                return {
                    ...emp,
                    isUser: !!matchedUser,
                    password: matchedUser ? matchedUser.password : null
                };
            });

            const sortedEmployees = processedEmployees.sort((a, b) => {
                const nameA = (a.name || a.employee?.name || '').toLowerCase();
                const nameB = (b.name || b.employee?.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });

            setEmployees(sortedEmployees);

        } catch (err) {
            console.error("Unexpected error:", err);
            setError('An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const handleMakeUser = async (employee) => {
        const empCode = employee.employee_code || employee.employee?.employee_code;
        const empName = employee.name || employee.employee?.name;

        if (!empCode) {
            showToast('Employee Code is missing for this record.', 'warning');
            return;
        }

        setProcessingId(empCode);

        try {
            const payload = {
                employee_id: empCode,
                name: empName,
                role: 'Employee'
            };

            const response = await api.post('/api/signup/', payload);

            if (response.status === 200 || response.status === 201) {
                showToast(`User created successfully for ${empName}. An email with the auto-generated password has been sent.`, 'success');

                setEmployees(prevEmployees => prevEmployees.map(e => {
                    const code = e.employee_code || e.employee?.employee_code;
                    if (code === empCode) {
                        return { ...e, isUser: true };
                    }
                    return e;
                }));
            }
        } catch (err) {
            console.error("Error creating user:", err);
            const errMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to create user. It might already exist.';
            showToast(`Error: ${errMsg}`, 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleResendEmail = async (employee) => {
        const empCode = employee.employee_code || employee.employee?.employee_code;
        const empName = employee.name || employee.employee?.name;

        if (!empCode) return;

        setProcessingId(`resend-${empCode}`);

        try {
            const payload = {
                employee_id: empCode,
                resend: true
            };

            const response = await api.post('/api/signup/', payload);

            if (response.status === 201 || response.status === 200) {
                showToast(`Activation email resent successfully to ${empName}.`, 'success');
            }
        } catch (err) {
            console.error("Error resending email:", err);
            showToast('Failed to resend email.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleSyncAllUsers = async () => {
        setIsSyncingAll(true);
        setSyncProgress({ current: 0, total: 0, step: 'Initializing...' });

        try {
            const initResponse = await api.get('/api/employees/?page=1');
            const totalEmployees = initResponse.data.count || 0;
            const pageSize = initResponse.data.results?.length || 10;
            const totalPages = Math.ceil(totalEmployees / pageSize);

            if (totalEmployees === 0) {
                showToast("No employees found to sync.", "warning");
                return;
            }

            setSyncProgress({ current: 0, total: totalEmployees, step: `Starting sync for ${totalEmployees} records...` });
            let processedCount = 0;

            for (let page = 1; page <= totalPages; page++) {
                try {
                    setSyncProgress(prev => ({ ...prev, step: `Syncing batch ${page} of ${totalPages}...` }));
                    const syncResp = await api.post('/api/sync-users-page/', { page });
                    processedCount += (syncResp.data.batch_processed || 0);

                    setSyncProgress(prev => ({
                        ...prev,
                        current: Math.min(processedCount, totalEmployees)
                    }));
                } catch (pageErr) {
                    console.error(`Error syncing page ${page}:`, pageErr);
                }
            }

            showToast(`Successfully synced ${processedCount} users!`, 'success');
            fetchEmployeesAndUsers(currentPage);
            setTimeout(() => {
                setShowSyncModal(false);
                setIsSyncingAll(false);
                setSyncProgress(null);
            }, 1500);

            return;
        } catch (err) {
            console.error("Error syncing users:", err);
            const errMsg = err.response?.data?.error || 'Failed to sync users.';
            showToast(`Error: ${errMsg}`, 'error');
            setIsSyncingAll(false);
            setSyncProgress(null);
        }
    };

    const exportToCSV = () => {
        const headers = ['Employee ID', 'Name', 'Department', 'Project', 'Status'];
        const csvRows = [
            headers.join(','),
            ...filteredEmployees.map(emp => {
                const code = emp.employee_code || emp.employee?.employee_code || 'N/A';
                const name = emp.name || emp.employee?.name || 'Unknown';
                const dept = emp.department || emp.position?.department || 'N/A';
                const proj = emp.project?.name || 'N/A';
                const status = emp.isUser ? 'Registered' : 'Not Registered';
                return `"${code}","${name}","${dept}","${proj}","${status}"`;
            })
        ];

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'employees_report.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const uniqueDepartments = ['All', ...new Set(employees.map(emp => emp.department || emp.position?.department).filter(Boolean))];
    const uniqueProjects = ['All', ...new Set(employees.map(emp => emp.project?.name).filter(Boolean))];

    const filteredEmployees = employees.filter(emp => {
        const searchLower = searchTerm.toLowerCase();
        const code = (emp.employee_code || emp.employee?.employee_code || '').toLowerCase();
        const name = (emp.name || emp.employee?.name || '').toLowerCase();
        const dept = (emp.department || emp.position?.department || '').toLowerCase();
        const proj = (emp.project?.name || '').toLowerCase();
        const matchSearch = code.includes(searchLower) || name.includes(searchLower) || dept.includes(searchLower) || proj.includes(searchLower);
        const matchDept = filterDepartment === 'All' || dept === filterDepartment.toLowerCase();
        const matchProj = filterProject === 'All' || proj === filterProject.toLowerCase();
        return matchSearch && matchDept && matchProj;
    });

    return (
        <div className="dashboard-page" style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh', boxSizing: 'border-box' }}>
            {/* Header Section */}
            <div className="dashboard-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h1 className="welcome-text" style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
                        User Management
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '15px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={16} /> Manage system access, activate new employees, and enforce security policies.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        className="btn"
                        onClick={exportToCSV}
                        style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', fontWeight: '500', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                    >
                        <Download size={18} />
                        <span>Export CSV</span>
                    </button>
                    <button
                        className="btn"
                        onClick={() => setShowSyncModal(true)}
                        disabled={isSyncingAll || loading}
                        style={{ backgroundColor: '#1e293b', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', fontWeight: '500', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)', transition: 'all 0.2s' }}
                    >
                        {isSyncingAll ? <RefreshCcw className="spinning" size={18} /> : <Users size={18} />}
                        <span>Sync All Users</span>
                    </button>
                </div>
            </div>

            {/* Error Notifications */}
            {apiKeyMissing && (
                <div style={{ padding: '16px 24px', backgroundColor: '#fff7ed', borderLeft: '4px solid #f97316', marginBottom: '24px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <AlertCircle className="text-warning" size={24} style={{ color: '#ea580c' }} />
                        <div>
                            <h4 style={{ margin: 0, color: '#9a3412', fontWeight: 'bold' }}>External Database Not Configured</h4>
                            <p style={{ margin: '4px 0 0 0', color: '#c2410c', fontSize: '14px' }}>New employees cannot be synced. Set up your API key to fetch dynamic data.</p>
                        </div>
                    </div>
                    <Link to="/api-management" className="btn btn-primary btn-sm" style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#ea580c', border: 'none', boxShadow: '0 2px 4px rgba(234, 88, 12, 0.2)' }}>
                        Fix Setup
                    </Link>
                </div>
            )}

            {error && (
                <div style={{ padding: '16px 24px', backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', marginBottom: '24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <AlertCircle size={24} style={{ color: '#b91c1c' }} />
                    <span style={{ color: '#991b1b', fontWeight: '500' }}>{error}</span>
                </div>
            )}

            {/* Main Content Card */}
            <div className="premium-card" style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
                {/* Toolbar */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                    <div className="search-box" style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                            type="text"
                            placeholder="Search by name, ID or department..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <Filter size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                            <select
                                value={filterDepartment}
                                onChange={(e) => {
                                    setFilterDepartment(e.target.value);
                                    setCurrentPage(1);
                                }}
                                style={{ appearance: 'none', padding: '12px 36px 12px 36px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer', color: '#334155', fontWeight: '500' }}
                            >
                                {uniqueDepartments.map((dept, i) => (
                                    <option key={i} value={dept}>{dept}</option>
                                ))}
                            </select>
                            <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Briefcase size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                            <select
                                value={filterProject}
                                onChange={(e) => {
                                    setFilterProject(e.target.value);
                                    setCurrentPage(1);
                                }}
                                style={{ appearance: 'none', padding: '12px 36px 12px 36px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer', color: '#334155', fontWeight: '500' }}
                            >
                                {uniqueProjects.map((proj, i) => (
                                    <option key={i} value={proj}>{proj}</option>
                                ))}
                            </select>
                            <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                        </div>
                    </div>
                </div>

                {/* Table Area */}
                {loading ? (
                    <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCcw className="spinning" size={32} style={{ margin: '0 auto 16px', color: '#3b82f6' }} />
                        <p style={{ fontSize: '16px', fontWeight: '500' }}>Loading Employees...</p>
                    </div>
                ) : (
                    <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employee</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Department</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.length > 0 ? (
                                    filteredEmployees.map((emp, idx) => {
                                        const displayCode = emp.employee_code || emp.employee?.employee_code || 'N/A';
                                        const displayName = emp.name || emp.employee?.name || 'Unknown';
                                        const displayDept = emp.department || emp.position?.department || 'N/A';
                                        const displayRole = emp.role || emp.role_name || emp.position?.role_name || 'N/A';
                                        const displayEmail = emp.email || emp.employee?.email || `${displayCode.toLowerCase()}@example.com`;

                                        return (
                                            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background-color 0.15s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                <td style={{ padding: '16px 24px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7', fontWeight: 'bold', fontSize: '14px' }}>
                                                            {displayName.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>{displayName}</div>
                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                                                                <span style={{ fontSize: '12px', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>ID: {displayCode}</span>
                                                                <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={10} /> {displayEmail}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px 24px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', fontSize: '14px', fontWeight: '500' }}>
                                                        <Building2 size={14} color="#64748b" /> {displayDept}
                                                    </div>
                                                    {emp.project?.name && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
                                                            <Briefcase size={12} color="#94a3b8" /> {emp.project.name}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px 24px' }}>
                                                    {emp.isUser ? (
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                                                            <span style={{ width: '6px', height: '6px', backgroundColor: '#22c55e', borderRadius: '50%' }}></span> Active
                                                        </span>
                                                    ) : (
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: '#f3f4f6', color: '#4b5563', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                                                            <span style={{ width: '6px', height: '6px', backgroundColor: '#9ca3af', borderRadius: '50%' }}></span> Pending
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px 24px' }}>
                                                    {emp.isUser ? (
                                                        emp.password ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <input
                                                                    type={visiblePasswords[displayCode] ? "text" : "password"}
                                                                    value={emp.password}
                                                                    readOnly
                                                                    style={{
                                                                        border: 'none',
                                                                        background: 'transparent',
                                                                        fontSize: '14px',
                                                                        fontWeight: '600',
                                                                        color: '#334155',
                                                                        width: '90px',
                                                                        fontFamily: visiblePasswords[displayCode] ? 'monospace' : 'inherit',
                                                                        outline: 'none'
                                                                    }}
                                                                />
                                                                <button
                                                                    onClick={() => togglePasswordVisibility(displayCode)}
                                                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', padding: '4px' }}
                                                                    title={visiblePasswords[displayCode] ? "Hide Password" : "Show Password"}
                                                                >
                                                                    {visiblePasswords[displayCode] ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(emp.password);
                                                                        showToast('Password copied to clipboard!', 'success');
                                                                    }}
                                                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', padding: '4px' }}
                                                                    title="Copy Password"
                                                                >
                                                                    <Copy size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>Not Available</span>
                                                        )
                                                    ) : (
                                                        <span style={{ color: '#cbd5e1', fontSize: '14px' }}>—</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                        <button
                                                            onClick={() => !emp.isUser && handleMakeUser(emp)}
                                                            disabled={processingId === displayCode || emp.isUser}
                                                            style={{
                                                                padding: '8px 16px',
                                                                borderRadius: '8px',
                                                                border: 'none',
                                                                cursor: emp.isUser ? 'default' : 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                fontSize: '13px',
                                                                fontWeight: '600',
                                                                transition: 'all 0.2s',
                                                                backgroundColor: emp.isUser ? '#f8fafc' : '#e0e7ff',
                                                                color: emp.isUser ? '#94a3b8' : '#4338ca',
                                                                boxShadow: emp.isUser ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                                                            }}
                                                            onMouseOver={(e) => { if (!emp.isUser && processingId !== displayCode) e.currentTarget.style.backgroundColor = '#c7d2fe' }}
                                                            onMouseOut={(e) => { if (!emp.isUser && processingId !== displayCode) e.currentTarget.style.backgroundColor = '#e0e7ff' }}
                                                        >
                                                            {processingId === displayCode ? (
                                                                <><RefreshCcw size={14} className="spinning" /> Activating...</>
                                                            ) : emp.isUser ? (
                                                                <><CheckCircle2 size={14} /> Registered</>
                                                            ) : (
                                                                <><Mail size={14} /> Send Invite & Activate</>
                                                            )}
                                                        </button>

                                                        {emp.isUser && (
                                                            <button
                                                                onClick={() => handleResendEmail(emp)}
                                                                disabled={processingId === `resend-${displayCode}`}
                                                                title="Resend Activation Email"
                                                                style={{
                                                                    padding: '8px 12px',
                                                                    borderRadius: '8px',
                                                                    border: '1px solid #cbd5e1',
                                                                    backgroundColor: '#fff',
                                                                    color: '#475569',
                                                                    cursor: 'pointer',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    fontSize: '13px',
                                                                    fontWeight: '600',
                                                                    transition: 'all 0.2s',
                                                                }}
                                                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                                            >
                                                                {processingId === `resend-${displayCode}` ? (
                                                                    <RefreshCcw size={14} className="spinning" />
                                                                ) : (
                                                                    <RefreshCcw size={14} />
                                                                )}
                                                                <span>Resend Mail</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '60px 24px', textAlign: 'center', color: '#64748b' }}>
                                            <div style={{ width: '48px', height: '48px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                                <Search size={24} color="#94a3b8" />
                                            </div>
                                            <p style={{ fontSize: '15px', fontWeight: '500', margin: 0 }}>No employees found.</p>
                                            <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Try modifying your search or filter.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {!loading && !error && totalPages > 1 && (
                    <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                            Showing Page <span style={{ color: '#0f172a', fontWeight: 'bold' }}>{currentPage}</span> of <span style={{ color: '#0f172a', fontWeight: 'bold' }}>{totalPages}</span>
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#334155', fontSize: '13px', fontWeight: '500', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#334155', fontSize: '13px', fontWeight: '500', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Sync Summary Modal */}
            {showSyncModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className="animate-pop-in" style={{ backgroundColor: '#fff', width: '100%', maxWidth: '440px', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', overflow: 'hidden' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>
                                <RefreshCcw className={isSyncingAll ? "spinning" : ""} size={22} color="#3b82f6" />
                                Confirm Bulk Mail & Sync
                            </h2>
                        </div>
                        <div style={{ padding: '24px' }}>
                            {isSyncingAll && syncProgress ? (
                                <div>
                                    <h4 style={{ margin: '0 0 12px 0', color: '#334155', fontSize: '14px', fontWeight: '600' }}>{syncProgress.step}</h4>
                                    <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', height: '8px', marginBottom: '12px' }}>
                                        <div
                                            style={{
                                                width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%`,
                                                backgroundColor: '#3b82f6',
                                                height: '100%',
                                                transition: 'width 0.3s ease',
                                                borderRadius: '999px'
                                            }}
                                        />
                                    </div>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', textAlign: 'right', fontWeight: '500' }}>
                                        {syncProgress.current} / {syncProgress.total} employees processed
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#475569', lineHeight: '1.5' }}>
                                        Are you sure you want to create user accounts for <strong>ALL</strong> active employees in the system?
                                    </p>
                                    <div style={{ backgroundColor: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1px solid #bbf7d0', display: 'flex', gap: '12px' }}>
                                        <Mail size={20} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                                        <p style={{ margin: 0, fontSize: '13px', color: '#166534', lineHeight: '1.5' }}>
                                            <strong>Email Notifications Enabled.</strong> Every synced employee will receive an automated email containing their temporary generated password.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                        <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0' }}>
                            <button
                                onClick={() => setShowSyncModal(false)}
                                disabled={isSyncingAll}
                                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#334155', fontSize: '14px', fontWeight: '600', cursor: isSyncingAll ? 'not-allowed' : 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSyncAllUsers}
                                disabled={isSyncingAll}
                                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#3b82f6', color: '#fff', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', cursor: isSyncingAll ? 'not-allowed' : 'pointer', boxShadow: '0 1px 2px rgba(59, 130, 246, 0.5)' }}
                            >
                                {isSyncingAll ? 'Processing Sync...' : 'Confirm & Send Invitations'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
