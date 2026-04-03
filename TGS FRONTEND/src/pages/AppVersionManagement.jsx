import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Smartphone } from 'lucide-react';
import api from '../api/api';
import { useToast } from '../context/ToastContext';

const AppVersionManagement = () => {
    const [versionData, setVersionData] = useState({
        latest_version: '',
        minimum_supported_version: '',
        update_type: 'optional',
        message: '',
        update_url: ''
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        fetchVersionData();
    }, []);

    const fetchVersionData = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/app-version');
            if (response.data) {
                setVersionData(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch app version", error);
            showToast("Failed to load app version config", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        if (!versionData.latest_version || !versionData.minimum_supported_version) {
            showToast("Please provide both latest and minimum supported versions", "warning");
            return;
        }

        setSaving(true);
        try {
            await api.post('/api/app-version', versionData);
            showToast("App version updated successfully!", "success");
            fetchVersionData();
        } catch (error) {
            console.error("Failed to save app version", error);
            showToast("Failed to update app version config", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field, value) => {
        setVersionData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <div className="admin-page">
            <div className="admin-header">
                <div>
                    <h1>App Version Management</h1>
                    <p>Configure mobile app force update parameters and minimum supported versions.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        className="btn-secondary" 
                        onClick={fetchVersionData}
                        disabled={loading}
                        style={{ 
                            whiteSpace: 'nowrap', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            padding: '8px 16px',
                            minWidth: 'min-content',
                            flexShrink: 0,
                            fontSize: '0.9rem'
                        }}
                    >
                        <RefreshCw size={18} className={loading ? 'spin' : ''} />
                        <span>Refresh</span>
                    </button>
                    <button className="btn-primary" onClick={handleSave} disabled={saving}>
                        <Save size={18} />
                        <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
                    </button>
                </div>
            </div>

            <div className="admin-container premium-card">
                <div className="admin-tabs">
                    <button className="tab-btn active">
                        <Smartphone size={18} />
                        <span>Mobile App Config</span>
                    </button>
                </div>

                <div className="admin-content" style={{ padding: '2rem' }}>
                    {loading ? (
                        <div className="loading-spinner">Loading...</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#1e293b' }}>
                                    Latest Version
                                </label>
                                <input
                                    type="text"
                                    value={versionData.latest_version}
                                    onChange={(e) => handleChange('latest_version', e.target.value)}
                                    placeholder="e.g. 1.2.0"
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.95rem'
                                    }}
                                />
                                <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', display: 'block' }}>The current release version available on the app store.</span>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#1e293b' }}>
                                    Minimum Supported Version
                                </label>
                                <input
                                    type="text"
                                    value={versionData.minimum_supported_version}
                                    onChange={(e) => handleChange('minimum_supported_version', e.target.value)}
                                    placeholder="e.g. 1.0.0"
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.95rem'
                                    }}
                                />
                                <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', display: 'block' }}>Versions below this will be forced to update to use the app.</span>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#1e293b' }}>
                                    Update Type
                                </label>
                                <select
                                    value={versionData.update_type}
                                    onChange={(e) => handleChange('update_type', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.95rem',
                                        backgroundColor: '#fff'
                                    }}
                                >
                                    <option value="optional">Optional Update</option>
                                    <option value="force">Force Update</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem', gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#1e293b' }}>
                                    Update URL (Play Store / App Store)
                                </label>
                                <input
                                    type="url"
                                    value={versionData.update_url}
                                    onChange={(e) => handleChange('update_url', e.target.value)}
                                    placeholder="https://"
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem', gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#1e293b' }}>
                                    Update Message
                                </label>
                                <textarea
                                    value={versionData.message}
                                    onChange={(e) => handleChange('message', e.target.value)}
                                    placeholder="Message to display to the user in the update dialog..."
                                    rows={4}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.95rem',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AppVersionManagement;
