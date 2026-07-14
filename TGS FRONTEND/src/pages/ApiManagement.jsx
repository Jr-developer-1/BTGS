import React, { useState, useEffect } from 'react';
import { Save, Shield, Key, AlertCircle, CheckCircle2, Copy, Trash2, Activity, ArrowUpRight, BarChart2, AlertTriangle, Plus, X, Users, MapPin, RefreshCw } from 'lucide-react';
import api from '../api/api';
import { useToast } from '../context/ToastContext';

import Modal from '../components/Modal';

const ApiManagement = () => {
    const { showToast, confirm } = useToast();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [apiKey, setApiKey] = useState('');
    const [externalApiUrl, setExternalApiUrl] = useState('');
    const [geoApiKey, setGeoApiKey] = useState('');
    const [geoApiUrl, setGeoApiUrl] = useState('');
    const [saved, setSaved] = useState(false);
    const [geoSaved, setGeoSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isGeoSaving, setIsGeoSaving] = useState(false);
    const [error, setError] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState(false);

    // New Key Modal State
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);
    const [newKeyRateLimit, setNewKeyRateLimit] = useState(60);

    // Custom Endpoints State
    const [customEndpoints, setCustomEndpoints] = useState([]);
    const [isEndpointModalOpen, setIsEndpointModalOpen] = useState(false);
    const [newEndpointName, setNewEndpointName] = useState('');
    const [newEndpointPath, setNewEndpointPath] = useState('');
    const [newEndpointResponseType, setNewEndpointResponseType] = useState('NONE');
    const [newEndpointScriptType, setNewEndpointScriptType] = useState('SQL');
    const [newEndpointScriptContent, setNewEndpointScriptContent] = useState('');

    const [viewingSubmissions, setViewingSubmissions] = useState(null); // ID of endpoint being viewed
    const [submissions, setSubmissions] = useState([]);
    const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);

    // Key Generation Form State
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyExpiry, setNewKeyExpiry] = useState("");
    const [newKeyPermissions, setNewKeyPermissions] = useState([]);

    // State for the "Add Rule" input
    const [currentRulePath, setCurrentRulePath] = useState('');
    const [currentRuleMethods, setCurrentRuleMethods] = useState({
        GET: true, POST: false, PUT: false, DELETE: false
    });

    // Modal for Input
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);

    // Dashboard Stats
    const [stats, setStats] = useState({
        externalCalls: 0,
        activeKeys: 0,
        failedRequests: 0,
        avgLatency: '0ms'
    });

    // API Logs
    const [logs, setLogs] = useState([]);

    // Access Key State
    const [generatedKeys, setGeneratedKeys] = useState([]);
    const [loadingKeys, setLoadingKeys] = useState(false);

    useEffect(() => {
        fetchDashboardData();
        fetchKeys();
        fetchEndpoints();
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const response = await api.get('/api/apikey/');
            const data = response.data;
            if (data.external_api_url) setExternalApiUrl(data.external_api_url);
            if (data.geo_api_url) setGeoApiUrl(data.geo_api_url);
            if (data.external_api_key) setApiKey(data.external_api_key);
            if (data.geo_api_key) setGeoApiKey(data.geo_api_key);
        } catch (error) {
            console.error("Error fetching config:", error);
        }
    };

    const fetchDashboardData = async () => {
        try {
            const response = await api.get('/api/dashboard/stats/');
            if (response.data && response.data.stats) {
                setStats(response.data.stats);
            }
            if (response.data && Array.isArray(response.data.logs)) {
                setLogs(response.data.logs);
            }
        } catch (error) {
            console.error("Error fetching dashboard stats:", error);
        }
    };

    const fetchKeys = async () => {
        setLoadingKeys(true);
        try {
            const response = await api.get('/api/access-keys/');
            const data = response.data.results || response.data;
            setGeneratedKeys(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching keys:", error);
            setGeneratedKeys([]);
        } finally {
            setLoadingKeys(false);
        }
    };



    const handleSave = async (type) => {
        const isGeo = type === 'geo';
        const keyToSave = isGeo ? geoApiKey : apiKey;
        const urlToSave = isGeo ? geoApiUrl : externalApiUrl;
        const keyType = isGeo ? 'geo_api_key' : 'external_api_key';

        if (!keyToSave.trim() && !urlToSave.trim()) return;

        if (isGeo) setIsGeoSaving(true);
        else setIsSaving(true);

        setError(null);

        try {
            await api.post('/api/apikey/', {
                api_key: keyToSave.trim(),
                api_url: urlToSave.trim(),
                key_type: keyType
            });

            if (isGeo) {
                setGeoSaved(true);
                setTimeout(() => setGeoSaved(false), 3000);
            } else {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            }
        } catch (err) {
            console.error("Failed to save API key:", err);
            setError(`Failed to save ${isGeo ? 'Geo' : 'Employee'} configuration.`);
        } finally {
            if (isGeo) setIsGeoSaving(false);
            else setIsSaving(false);
        }
    };

    const handleSyncEmployeeCache = async () => {
        setIsSyncing(true);
        setError(null);
        try {
            await api.post('/api/employees/sync-cache/');
            setSyncSuccess(true);
            showToast("Employee cache successfully synchronized from external API.", "success");
            setTimeout(() => setSyncSuccess(false), 3000);
        } catch (err) {
            console.error("Failed to sync employee cache:", err);
            const errMsg = err.response?.data?.error || "Failed to sync employee cache.";
            setError(errMsg);
            showToast(errMsg, "error");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleGenerateKey = async () => {
        setError(null);

        if (!newKeyName.trim()) {
            setError("Application Name is required");
            return;
        }

        // Calculate Expiry Date
        let expiresAt = null;
        if (newKeyExpiry) {
            expiresAt = new Date(newKeyExpiry).toISOString();
        }

        const formattedPermissions = {};

        if (!currentRulePath) {
            setError("Please select an endpoint.");
            return;
        }

        const selectedMethods = Object.keys(currentRuleMethods).filter(m => currentRuleMethods[m]);
        if (selectedMethods.length === 0) {
            setError("Please select at least one method.");
            return;
        }

        formattedPermissions[currentRulePath] = selectedMethods;

        const payload = {
            name: newKeyName,
            rate_limit: parseInt(newKeyRateLimit),
            expires_at: expiresAt,
            permissions: formattedPermissions
        };

        try {
            const response = await api.post('/api/access-keys/', payload);
            setNewlyCreatedKey(response.data);
            setIsFormModalOpen(false); // Close Input Modal
            setShowKeyModal(true); // Open Result Modal

            setNewKeyName('');
            setNewKeyRateLimit(60);
            setNewKeyExpiry("");
            setNewKeyPermissions([]);
            setCurrentRulePath('');
            setCurrentRuleMethods({ GET: true, POST: false, PUT: false, DELETE: false });
            setError(null);

            fetchKeys();
            fetchDashboardData();
            fetchEndpoints();
        } catch (error) {
            console.error("Error generating key:", error);
            setError("Failed to generate API key.");
        }
    };

    const fetchEndpoints = async () => {
        try {
            const response = await api.get('/api/dynamic-endpoints/');
            const data = response.data.results || response.data;
            setCustomEndpoints(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching endpoints:", error);
            setCustomEndpoints([]);
        }
    };

    const handleCreateEndpoint = async () => {
        if (!newEndpointName.trim() || !newEndpointPath.trim()) {
            setError("Name and Path are required");
            return;
        }
        // Validate path format (simple check)
        if (!/^[a-zA-Z0-9-_]+$/.test(newEndpointPath)) {
            setError("Path contains invalid characters. Use letters, numbers, hyphens, and underscores.");
            return;
        }

        try {
            await api.post('/api/dynamic-endpoints/', {
                name: newEndpointName,
                url_path: newEndpointPath,
                response_type: newEndpointResponseType,
                script_type: newEndpointResponseType === 'CUSTOM_SCRIPT' ? newEndpointScriptType : null,
                script_content: newEndpointResponseType === 'CUSTOM_SCRIPT' ? newEndpointScriptContent : ''
            });
            setNewEndpointName('');
            setNewEndpointPath('');
            setNewEndpointResponseType('NONE');
            setNewEndpointScriptType('SQL');
            setNewEndpointScriptContent('');
            setIsEndpointModalOpen(false);
            fetchEndpoints();
        } catch (error) {
            console.error("Error creating endpoint", error);
            setError("Failed to create endpoint. Path might be duplicate.");
        }
    };

    const handleViewSubmissions = async (endpoint) => {
        setViewingSubmissions(endpoint);
        setSubmissions([]);
        setIsSubmissionsModalOpen(true);
        try {
            const response = await api.get(`/api/connect/${endpoint.url_path}/`);
            const data = response.data.results || response.data;
            setSubmissions(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching submissions", error);
            setSubmissions([]);
        }
    };

    const handleRevokeKey = async (id) => {
        const confirmed = await confirm("Are you sure you want to revoke this key? This action cannot be undone.");
        if (!confirmed) return;
        
        try {
                await api.delete(`/api/access-keys/${id}/`);
                setGeneratedKeys(generatedKeys.filter(k => k.id !== id));
                fetchDashboardData();
                showToast("API key revoked successfully.", "success");
            } catch (error) {
                console.error("Error revoking key:", error);
                showToast("Failed to revoke API key.", "error");
            }
    };

    const addPermissionRule = () => {
        if (!currentRulePath.trim()) {
            setError("Please enter a valid API Endpoint Path");
            return;
        }

        const selectedMethods = Object.keys(currentRuleMethods).filter(m => currentRuleMethods[m]);
        if (selectedMethods.length === 0) {
            setError("Please select at least one method (GET, POST, etc.)");
            return;
        }

        setNewKeyPermissions([...newKeyPermissions, {
            path: currentRulePath.trim(),
            methods: selectedMethods
        }]);

        setError(null);
        setCurrentRulePath('');
        setCurrentRuleMethods({ GET: true, POST: false, PUT: false, DELETE: false });
    };

    const removePermissionRule = (index) => {
        setNewKeyPermissions(newKeyPermissions.filter((_, i) => i !== index));
    };

    const renderKeyGenerationModal = () => (
        <Modal
            isOpen={isFormModalOpen}
            onClose={() => setIsFormModalOpen(false)}
            title="Generate New Access Key"
            size="lg"
            actions={
                <div className="flex justify-end gap-3 w-full">
                    <button className="btn-secondary" onClick={() => setIsFormModalOpen(false)}>Cancel</button>
                    <button className="btn-primary" onClick={handleGenerateKey}>Generate Key</button>
                </div>
            }
        >
            <div className="flex flex-col gap-6">
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in border border-red-100">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="clean-input-group">
                        <label>Application Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            placeholder="e.g. Finance Dashboard"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            className="professional-input"
                        />
                    </div>
                    <div className="clean-input-group">
                        <label>Validity <span className="text-slate-400 font-normal text-xs">(Optional)</span></label>
                        <input
                            type="datetime-local"
                            className="professional-input"
                            value={newKeyExpiry}
                            onChange={(e) => setNewKeyExpiry(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                        />
                        <p className="text-xs text-slate-500 mt-1">Leave empty for unlimited validity.</p>
                    </div>
                </div>

                <div className="clean-input-group">
                    <label>Rate Limit</label>
                    <div className="flex items-center gap-3">
                        <input
                            type="number"
                            min="1"
                            value={newKeyRateLimit}
                            onChange={(e) => setNewKeyRateLimit(e.target.value)}
                            className="professional-input w-32"
                        />
                        <span className="text-slate-500 text-sm">Requests per minute</span>
                    </div>
                </div>

                <div className="clean-input-group">
                    <label>Endpoint Permissions</label>
                    <p className="text-xs text-slate-500 mb-3">
                        Define which API paths this key can access. Use <code>*</code> for wildcards (e.g. <code>/api/trips/*</code>).
                    </p>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                        <div className="flex flex-col gap-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 uppercase mb-1 block">Endpoint Path</label>

                                {/* Dropdown for Existing Endpoints */}


                                {/* Dropdown for Existing Endpoints (Always Show) */}
                                <div className="text-xs text-slate-500 mb-1 ml-1 font-medium">Or quick select from custom endpoints:</div>
                                <select
                                    className="professional-input text-sm bg-slate-50 border-slate-200 text-slate-700 disabled:opacity-50 h-10"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setCurrentRulePath(`/api/connect/${e.target.value}/*`);
                                        }
                                    }}
                                    defaultValue=""
                                    disabled={customEndpoints.length === 0}
                                >
                                    <option value="" disabled>
                                        {customEndpoints.length === 0 ? "No Custom Endpoints Available" : "-- Select to Autofill --"}
                                    </option>
                                    {customEndpoints.map(ep => (
                                        <option key={ep.id} value={ep.url_path}>
                                            {ep.name} ({ep.url_path})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-600 uppercase mb-2 block">Allowed Methods</label>
                                <div className="flex flex-wrap gap-4">
                                    {['GET', 'POST', 'PUT', 'DELETE'].map(method => (
                                        <label key={method} className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={currentRuleMethods[method]}
                                                onChange={() => setCurrentRuleMethods(prev => ({ ...prev, [method]: !prev[method] }))}
                                                className="w-4 h-4 rounded text-secondary border-slate-300 focus:ring-secondary cursor-pointer"
                                            />
                                            <span className={`text-sm font-bold ${currentRuleMethods[method] ? 'text-secondary' : 'text-slate-500'}`}>{method}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>




                </div>
            </div>
        </Modal>
    );

    const renderNewKeyModal = () => (
        <Modal
            isOpen={showKeyModal}
            onClose={() => setShowKeyModal(false)}
            title="Access Key Generated"
            type="success"
            actions={
                <button className="btn-primary" onClick={() => setShowKeyModal(false)}>I have copied the key</button>
            }
        >
            <div className="flex flex-col gap-4">
                <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="flex-shrink-0 mt-0.5" size={18} />
                    <p className="text-sm font-medium">
                        Please copy this key now. It will not be shown again once you close this window.
                    </p>
                </div>

                <div className="clean-input-group">
                    <label>API Key</label>
                    <div className="flex gap-2">
                        <code className="flex-1 bg-slate-100 p-3 rounded font-mono text-sm break-all border border-slate-200">
                            {newlyCreatedKey?.key}
                        </code>
                        <button
                            className="btn-secondary whitespace-nowrap"
                            onClick={() => {
                                navigator.clipboard.writeText(newlyCreatedKey?.key);
                                showToast("Copied to clipboard!", "success");
                            }}
                        >
                            <Copy size={16} /> Copy
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );

    const renderDashboard = () => (
        <div className="api-dashboard animate-scale-in">
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon-bg bg-blue-50 text-blue-600">
                        <Activity size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>Total Calls (24h)</h3>
                        <p className="stat-value">{(stats?.externalCalls || 0).toLocaleString()}</p>
                        <span className="stat-trend text-success flex items-center gap-1">
                            <ArrowUpRight size={14} /> +12%
                        </span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon-bg bg-purple-50 text-purple-600">
                        <Key size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>Active Keys</h3>
                        <p className="stat-value">{stats?.activeKeys || 0}</p>
                        <span className="stat-sub">Internal Applications</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon-bg bg-red-50 text-red-600">
                        <AlertTriangle size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>Failed Requests</h3>
                        <p className="stat-value">{stats?.failedRequests || 0}</p>
                        <span className="stat-trend text-danger">1.2% Error Rate</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon-bg bg-green-50 text-green-600">
                        <BarChart2 size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>Avg Latency</h3>
                        <p className="stat-value">{stats?.avgLatency || '0ms'}</p>
                        <span className="stat-sub">Optimal Performance</span>
                    </div>
                </div>
            </div>

            <div className="section-header mt-8 mb-4">
                <h3 className="section-title">Recent API Logs</h3>
            </div>

            <div className="table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>Source</th>
                            <th>Endpoint</th>
                            <th>Status</th>
                            <th>Latency</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.isArray(logs) && logs.map(log => (
                            <tr key={log.id}>
                                <td className="text-slate-500 text-sm font-mono">{new Date(log.timestamp).toLocaleString()}</td>
                                <td className="font-bold text-slate-700">{log.source || 'Anonymous'}</td>
                                <td className="text-blue-600 font-mono text-xs">{log.endpoint}</td>
                                <td>
                                    <span className={`badge ${log.status_code >= 200 && log.status_code < 300 ? 'badge-success' : log.status_code === 403 ? 'badge-warning' : 'badge-danger'}`}>
                                        {log.status_code}
                                    </span>
                                </td>
                                <td className="text-slate-500 text-sm">{parseInt(log.latency_ms)}ms</td>
                            </tr>
                        ))}
                        {(!logs || logs.length === 0) && (
                            <tr>
                                <td colSpan="5" className="text-center py-6 text-slate-400">
                                    No external or generated API logs found yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="dashboard-page animate-fade-in">
            {renderKeyGenerationModal()}
            {renderNewKeyModal()}
            <div className="dashboard-header-row">
                <div className="header-left">
                    <h1 className="welcome-text">API Management</h1>
                    <p className="current-date">Monitor usage, manage keys, and configure integrations</p>
                </div>
            </div>

            <div className="w-full max-w-none px-6">
                <div className="tabs-container mb-6">
                    <button
                        className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveTab('dashboard')}
                    >
                        Dashboard
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'external' ? 'active' : ''}`}
                        onClick={() => setActiveTab('external')}
                    >
                        External Integration
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'access_keys' ? 'active' : ''}`}
                        onClick={() => setActiveTab('access_keys')}
                    >
                        Access Keys
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'custom_endpoints' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('custom_endpoints'); fetchEndpoints(); }}
                    >
                        Custom Endpoints
                    </button>
                </div>

                {activeTab === 'dashboard' && renderDashboard()}

                {activeTab === 'external' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-scale-in">
                        {/* Employee API Config */}
                        <div className="premium-card main-config-card">
                            <div className="card-header-simple">
                                <Users size={20} className="text-secondary" />
                                <h3>Employee List Configuration</h3>
                            </div>

                            <div className="card-body-simple">
                                <p className="helper-text">
                                    Enterprise employee database integration. Required for reporting structures.
                                </p>

                                <div className="space-y-4 my-6">
                                    <div className="clean-input-group">
                                        <label>API GATEWAY URL</label>
                                        <input
                                            type="text"
                                            placeholder="http://..."
                                            value={externalApiUrl}
                                            onChange={(e) => setExternalApiUrl(e.target.value)}
                                            className="professional-input"
                                        />
                                    </div>
                                    <div className="clean-input-group">
                                        <label>MASTER API KEY</label>
                                        <input
                                            type="password"
                                            placeholder="sk_live_..."
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            disabled={isSaving}
                                            className="professional-input"
                                        />
                                    </div>
                                </div>

                                <div className="action-row flex flex-wrap gap-3">
                                    <button
                                        className={`btn-primary-premium ${saved ? 'success' : ''}`}
                                        onClick={() => handleSave('external')}
                                        disabled={isSaving || (!apiKey.trim() && !externalApiUrl.trim())}
                                    >
                                        {saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
                                        <span>{isSaving ? 'Saving...' : saved ? 'Saved Successfully' : 'Update Employee API'}</span>
                                    </button>
                                    <button
                                        className={`btn-primary-premium bg-slate-700 hover:bg-slate-800 ${syncSuccess ? 'success' : ''}`}
                                        onClick={handleSyncEmployeeCache}
                                        disabled={isSyncing}
                                    >
                                        {syncSuccess ? <CheckCircle2 size={18} /> : <RefreshCw className={isSyncing ? "animate-spin" : ""} size={18} />}
                                        <span>{isSyncing ? 'Syncing...' : syncSuccess ? 'Sync Completed' : 'Sync Cache Now'}</span>
                                    </button>
                                </div>

                                <div className="security-footer mt-4">
                                    <Shield size={14} />
                                    <span>Encrypted at rest in server vault.</span>
                                </div>
                            </div>
                        </div>

                        {/* Geo API Config */}
                        <div className="premium-card main-config-card">
                            <div className="card-header-simple">
                                <MapPin size={20} className="text-indigo-600" />
                                <h3>Geo & Route Configuration</h3>
                            </div>

                            <div className="card-body-simple">
                                <p className="helper-text">
                                    Geographic hierarchy and route management integration.
                                </p>

                                <div className="space-y-4 my-6">
                                    <div className="clean-input-group">
                                        <label>GEO SERVICE URL</label>
                                        <input
                                            type="text"
                                            placeholder="http://..."
                                            value={geoApiUrl}
                                            onChange={(e) => setGeoApiUrl(e.target.value)}
                                            className="professional-input"
                                        />
                                    </div>
                                    <div className="clean-input-group">
                                        <label>GEO API KEY</label>
                                        <input
                                            type="password"
                                            placeholder="geo_sk_..."
                                            value={geoApiKey}
                                            onChange={(e) => setGeoApiKey(e.target.value)}
                                            disabled={isGeoSaving}
                                            className="professional-input"
                                        />
                                    </div>
                                </div>

                                <div className="action-row">
                                    <button
                                        className={`btn-primary-premium ${geoSaved ? 'success' : ''} bg-indigo-600 hover:bg-indigo-700`}
                                        onClick={() => handleSave('geo')}
                                        disabled={isGeoSaving || (!geoApiKey.trim() && !geoApiUrl.trim())}
                                    >
                                        {geoSaved ? <CheckCircle2 size={18} /> : <Save size={18} />}
                                        <span>{isGeoSaving ? 'Saving...' : geoSaved ? 'Saved Successfully' : 'Update Geo API'}</span>
                                    </button>
                                </div>

                                <div className="security-footer mt-4">
                                    <Shield size={14} />
                                    <span>Secure tunnel connection active.</span>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="col-span-full error-box">
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'access_keys' && (
                    <div className="premium-card main-config-card animate-scale-in">
                        <div className="card-header-simple flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Key size={20} className="text-secondary" />
                                <h3>Active Access Keys</h3>
                            </div>
                            <button
                                className="btn-primary-premium flex items-center gap-2"
                                onClick={() => { setIsFormModalOpen(true); setError(null); }}
                            >
                                <Key size={16} /> Generate New Key
                            </button>
                        </div>
                        <div className="card-body-simple">
                            <p className="helper-text mb-6">
                                Manage the API keys that allow external applications to access the system.
                                You can revoke keys at any time.
                            </p>

                            <div className="table-wrapper">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Application Name</th>
                                            <th>API Key</th>
                                            <th>Created Date</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.isArray(generatedKeys) && generatedKeys.map(key => (
                                            <tr key={key.id}>
                                                <td>
                                                    <div className="flex flex-col">
                                                        <strong className="text-slate-700">{key.name}</strong>
                                                        <span className="text-xs text-slate-400">
                                                            {key.rate_limit} req/min
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <code className="text-slate-500 font-mono text-xs">
                                                        {key.key}
                                                    </code>
                                                </td>
                                                <td className="text-slate-500 text-sm">{new Date(key.created_at).toLocaleDateString()}</td>
                                                <td>
                                                    <span className={`badge ${key.is_active ? 'badge-success' : 'badge-danger'}`}>
                                                        {key.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        className="icon-btn-small delete"
                                                        title="Revoke Key"
                                                        onClick={() => handleRevokeKey(key.id)}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {(!generatedKeys || generatedKeys.length === 0) && (
                                            <tr>
                                                <td colSpan="5" className="text-center py-12 text-slate-400">
                                                    <Key size={48} className="mx-auto mb-3 opacity-20" />
                                                    <p>No access keys generated yet.</p>
                                                    <button
                                                        className="text-secondary font-medium mt-2 hover:underline"
                                                        onClick={() => setIsFormModalOpen(true)}
                                                    >
                                                        Generate your first key
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'custom_endpoints' && (
                    <div className="premium-card main-config-card animate-scale-in">
                        <div className="card-header-simple flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <ArrowUpRight size={20} className="text-secondary" />
                                <h3>Custom Data Endpoints</h3>
                            </div>
                            <button
                                className="btn-primary-premium flex items-center gap-2"
                                onClick={() => { setIsEndpointModalOpen(true); setError(null); }}
                            >
                                <Plus size={16} /> Create Endpoint
                            </button>
                        </div>
                        <div className="card-body-simple">
                            <p className="helper-text mb-6">
                                Create custom API paths.
                                By default, data sent to <code>/api/connect/&lt;path&gt;</code> is ingested.
                                You can also configure endpoints to return system data (like Trip Lists).
                            </p>

                            <div className="table-wrapper">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Path</th>
                                            <th>Type</th>
                                            <th>Full URL</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.isArray(customEndpoints) && customEndpoints.map(ep => (
                                            <tr key={ep.id}>
                                                <td><strong>{ep.name}</strong></td>
                                                <td><code className="text-secondary bg-blue-50 px-2 py-1 rounded">{ep.url_path}</code></td>
                                                <td>
                                                    <span className={`badge ${ep.response_type === 'NONE' ? 'badge-primary' : 'badge-success'}`}>
                                                        {ep.response_type === 'NONE' ? 'Ingestion' : ep.response_type}
                                                    </span>
                                                </td>
                                                <td className="text-xs text-slate-500 font-mono">
                                                    {window.location.origin}/api/connect/{ep.url_path}/
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn-secondary text-xs px-3 py-1 flex items-center gap-2"
                                                        onClick={() => handleViewSubmissions(ep)}
                                                    >
                                                        View Data
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {(!customEndpoints || customEndpoints.length === 0) && (
                                            <tr>
                                                <td colSpan="5" className="text-center py-12 text-slate-400">
                                                    <div className="flex flex-col items-center">
                                                        <ArrowUpRight size={48} className="mb-3 opacity-20" />
                                                        <p>No custom endpoints created.</p>
                                                        <button
                                                            className="text-secondary font-medium mt-2 hover:underline"
                                                            onClick={() => setIsEndpointModalOpen(true)}
                                                        >
                                                            Create your first endpoint
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Create Endpoint Modal */}
            <Modal
                isOpen={isEndpointModalOpen}
                onClose={() => setIsEndpointModalOpen(false)}
                title="Create New Endpoint"
                size="xl"
                actions={
                    <div className="flex justify-end gap-3 w-full">
                        <button className="btn-secondary" onClick={() => setIsEndpointModalOpen(false)}>Cancel</button>
                        <button className="btn-primary" onClick={handleCreateEndpoint}>Create</button>
                    </div>
                }
            >
                <div className="flex flex-col gap-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}
                    <div className="clean-input-group">
                        <label>Endpoint Name</label>
                        <input
                            className="professional-input"
                            placeholder="e.g. Monthly Trip Export"
                            value={newEndpointName}
                            onChange={e => setNewEndpointName(e.target.value)}
                        />
                    </div>
                    <div className="clean-input-group">
                        <label>URL Path Slug</label>
                        <div className="flex items-center">
                            <span className="bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg px-3 py-2 text-slate-500 text-sm">/api/connect/</span>
                            <input
                                className="professional-input rounded-l-none"
                                placeholder="trip-data"
                                value={newEndpointPath}
                                onChange={e => setNewEndpointPath(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="clean-input-group">
                        <label>Response Type (Data Retrieval)</label>
                        <select
                            className="professional-input"
                            value={newEndpointResponseType}
                            onChange={e => setNewEndpointResponseType(e.target.value)}
                        >
                            <option value="NONE">Ingestion Only (Receive Data)</option>
                            <option value="TRIP_LIST">Return: Trip List (All Trips)</option>
                            <option value="TRIP_STATS">Return: Trip Statistics</option>
                            <option value="CUSTOM_SCRIPT">Return: Custom Script (SQL/Python)</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-1">
                            Select what data this endpoint should return when accessed with a GET request.
                        </p>
                    </div>

                    {newEndpointResponseType === 'CUSTOM_SCRIPT' && (
                        <div className="animate-fade-in flex flex-col gap-4 border-t border-slate-100 pt-4">
                            <div className="clean-input-group">
                                <label>Script Language</label>
                                <div className="flex gap-4">
                                    <div
                                        className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${newEndpointScriptType === 'SQL' ? 'bg-blue-50 border-blue-200 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
                                        onClick={() => setNewEndpointScriptType('SQL')}
                                    >
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${newEndpointScriptType === 'SQL' ? 'border-blue-600' : 'border-slate-300'}`}>
                                            {newEndpointScriptType === 'SQL' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                                        </div>
                                        <span className={`font-bold text-sm ${newEndpointScriptType === 'SQL' ? 'text-blue-700' : 'text-slate-600'}`}>SQL Query</span>
                                    </div>
                                    <div
                                        className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${newEndpointScriptType === 'PYTHON' ? 'bg-yellow-50 border-yellow-200 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
                                        onClick={() => setNewEndpointScriptType('PYTHON')}
                                    >
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${newEndpointScriptType === 'PYTHON' ? 'border-yellow-600' : 'border-slate-300'}`}>
                                            {newEndpointScriptType === 'PYTHON' && <div className="w-2.5 h-2.5 rounded-full bg-yellow-600" />}
                                        </div>
                                        <span className={`font-bold text-sm ${newEndpointScriptType === 'PYTHON' ? 'text-yellow-700' : 'text-slate-600'}`}>Python Script</span>
                                    </div>
                                </div>
                            </div>

                            <div className="clean-input-group">
                                <label>
                                    {newEndpointScriptType === 'SQL' ? 'Query Editor' : 'Python Code Editor'}
                                </label>
                                <textarea
                                    className="professional-input font-mono text-xs bg-slate-900 text-slate-100 leading-relaxed p-4"
                                    style={{ height: '500px' }}
                                    placeholder={newEndpointScriptType === 'SQL' ? "SELECT * FROM travel_trip WHERE cost > 1000;" : "dataset = Trip.objects.filter(cost__gt=1000).values()"}
                                    value={newEndpointScriptContent}
                                    onChange={e => setNewEndpointScriptContent(e.target.value)}
                                />
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-500 mt-2 flex gap-2 items-start">
                                    <div className="mt-0.5 text-blue-500"><AlertCircle size={14} /></div>
                                    <div>
                                        {newEndpointScriptType === 'SQL'
                                            ? "Executes raw SQL. Returns a list of dictionaries."
                                            : "Available context: request, Trip, connection. You must assign the result to the 'dataset' variable."}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Submissions Viewer Modal */}
            <Modal
                isOpen={isSubmissionsModalOpen}
                onClose={() => setIsSubmissionsModalOpen(false)}
                title={`Data Received: ${viewingSubmissions?.name}`}
                size="lg"
            >
                <div className="flex flex-col gap-4 h-[60vh]">
                    <div className="overflow-y-auto flex-1 border border-slate-200 rounded-lg">
                        {submissions.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                No data received yet.
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="p-3 border-b">Time</th>
                                        <th className="p-3 border-b">Data Payload</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {submissions.map(sub => (
                                        <tr key={sub.id}>
                                            <td className="p-3 whitespace-nowrap text-slate-500 align-top">
                                                {new Date(sub.received_at).toLocaleString()}
                                            </td>
                                            <td className="p-3 font-mono text-xs">
                                                <pre className="whitespace-pre-wrap bg-slate-50 p-2 rounded text-slate-700">
                                                    {JSON.stringify(sub.data, null, 2)}
                                                </pre>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ApiManagement;
