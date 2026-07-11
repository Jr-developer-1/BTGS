import React, { useState, useEffect } from 'react';
import {
    Shield,
    Search,
    RefreshCw,
    Briefcase,
    CheckCircle2,
    XCircle,
    Sliders,
    Settings,
    UserCheck,
    Layers
} from 'lucide-react';
import api from '../api/api';
import { useToast } from '../context/ToastContext.jsx';

const COOProjectConfig = () => {
    const { showToast } = useToast();
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [savingId, setSavingId] = useState(null);

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async (isRefresh = false) => {
        setLoading(true);
        try {
            const url = isRefresh ? '/api/coo-project-setting/?force_refresh=true' : '/api/coo-project-setting/';
            const response = await api.get(url);
            // Sort by project code then position name
            const sortedData = (response.data || []).sort((a, b) => {
                if (a.project_code !== b.project_code) {
                    return a.project_code.localeCompare(b.project_code);
                }
                return a.coo_position_name.localeCompare(b.coo_position_name);
            });
            setConfigs(sortedData);
            if (isRefresh) {
                showToast('Roster and COO configurations synced successfully', 'success');
            }
        } catch (err) {
            console.error('Failed to load COO settings', err);
            showToast('Failed to load COO settings from server', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (item) => {
        const key = `${item.project_code}_${item.coo_position_id}`;
        setSavingId(key);
        const newValue = !item.enable_coo_approval;
        try {
            await api.post('/api/coo-project-setting/', {
                project_code: item.project_code,
                coo_position_id: item.coo_position_id,
                coo_position_name: item.coo_position_name,
                enable_coo_approval: newValue
            });
            
            setConfigs(prev => prev.map(c => {
                if (c.project_code === item.project_code && c.coo_position_id === item.coo_position_id) {
                    return { ...c, enable_coo_approval: newValue };
                }
                return c;
            }));
            
            showToast(`COO Approval for project ${item.project_code} ${newValue ? 'Enabled' : 'Disabled'}`, 'success');
        } catch (err) {
            console.error('Failed to update COO approval setting', err);
            showToast('Failed to update COO approval configuration', 'error');
        } finally {
            setSavingId(null);
        }
    };

    // Filter configs based on search query
    const filteredConfigs = configs.filter(c => {
        const query = searchQuery.toLowerCase();
        return (
            c.project_code.toLowerCase().includes(query) ||
            c.coo_position_name.toLowerCase().includes(query) ||
            c.coo_position_id.toLowerCase().includes(query)
        );
    });

    return (
        <div className="coo-config-page" style={{ padding: '2rem', animation: 'fadeIn 0.5s ease' }}>
            <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Sliders style={{ color: 'var(--primary)' }} size={28} />
                        COO Approval Workflow Settings
                    </h1>
                    <p style={{ color: 'var(--text-dim)', margin: 0, fontSize: '0.95rem', maxWidth: '800px' }}>
                        Configure hierarchical routing toggles per project. Enabling a project's COO position forces approval escalation to that COO before routing to Finance and HR. Disabling will bypass COO approval (default).
                    </p>
                </div>
                <button 
                    onClick={() => fetchConfigs(true)} 
                    disabled={loading}
                    className="btn-secondary" 
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        padding: '0.75rem 1.25rem', 
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.3s ease'
                    }}
                >
                    <RefreshCw className={loading ? 'spin-anim' : ''} size={16} />
                    Refresh
                </button>
            </div>

            {/* Filter Section */}
            <div className="premium-card search-card" style={{ padding: '1.25rem', borderRadius: '16px', marginBottom: '2rem', background: 'white', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '1.25rem', color: 'var(--text-dim)' }} size={20} />
                    <input 
                        type="text" 
                        placeholder="Search by Project Code or COO Position name..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.85rem 1rem 0.85rem 3.25rem',
                            borderRadius: '12px',
                            border: '1.5px solid var(--border)',
                            fontSize: '0.95rem',
                            outline: 'none',
                            transition: 'all 0.3s ease',
                            background: 'var(--bg-main)'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                    />
                </div>
            </div>

            {/* Main Table/Grid */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 0', gap: '1rem' }}>
                    <RefreshCw className="spin-anim" style={{ color: 'var(--primary)' }} size={36} />
                    <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Loading project-level COO configurations...</span>
                </div>
            ) : filteredConfigs.length === 0 ? (
                <div className="premium-card" style={{ padding: '5rem 2rem', textAlign: 'center', borderRadius: '20px', background: 'white', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'inline-flex', padding: '1.25rem', borderRadius: '50%', backgroundColor: 'var(--bg-main)', color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
                        <Layers size={32} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>No COO Configurations Found</h3>
                    <p style={{ color: 'var(--text-dim)', margin: 0, fontSize: '0.95rem' }}>
                        {searchQuery ? 'No match found for your search query.' : 'No active COO positions or projects detected from employee synchronizations.'}
                    </p>
                </div>
            ) : (
                <div className="premium-card table-responsive" style={{ borderRadius: '20px', overflow: 'hidden', background: 'white', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem', width: '25%' }}>PROJECT CODE</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem', width: '45%' }}>COO POSITION</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem', width: '15%' }}>STATUS</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem', width: '15%', textAlign: 'center' }}>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredConfigs.map((item, index) => {
                                const isSaving = savingId === `${item.project_code}_${item.coo_position_id}`;
                                return (
                                    <tr 
                                        key={`${item.project_code}_${item.coo_position_id}`} 
                                        style={{ 
                                            borderBottom: index === filteredConfigs.length - 1 ? 'none' : '1px solid var(--border)',
                                            transition: 'background 0.2s ease',
                                            cursor: 'pointer'
                                        }}
                                        className="hover-row"
                                    >
                                        <td style={{ padding: '1.25rem 1.5rem', verticalAlign: 'middle' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ 
                                                    background: 'var(--primary-light)', 
                                                    color: 'var(--primary)', 
                                                    padding: '8px 12px', 
                                                    borderRadius: '8px', 
                                                    fontWeight: 700, 
                                                    fontSize: '0.85rem',
                                                    letterSpacing: '0.5px'
                                                }}>
                                                    {item.project_code}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', verticalAlign: 'middle' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                                                    {item.coo_position_name}
                                                </div>
                                                <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                                    Position ID: {item.coo_position_id}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', verticalAlign: 'middle' }}>
                                            {item.enable_coo_approval ? (
                                                <span style={{ 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center', 
                                                    gap: '0.35rem', 
                                                    backgroundColor: '#e6f4ea', 
                                                    color: '#137333', 
                                                    padding: '4px 10px', 
                                                    borderRadius: '20px', 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: 600 
                                                }}>
                                                    <CheckCircle2 size={14} />
                                                    Enabled
                                                </span>
                                            ) : (
                                                <span style={{ 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center', 
                                                    gap: '0.35rem', 
                                                    backgroundColor: '#fce8e6', 
                                                    color: '#c5221f', 
                                                    padding: '4px 10px', 
                                                    borderRadius: '20px', 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: 600 
                                                }}>
                                                    <XCircle size={14} />
                                                    Bypassed
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', verticalAlign: 'middle', textAlign: 'center' }}>
                                            <button 
                                                onClick={() => handleToggle(item)}
                                                disabled={isSaving}
                                                style={{
                                                    background: item.enable_coo_approval ? 'var(--primary)' : '#cbd5e1',
                                                    border: 'none',
                                                    borderRadius: '30px',
                                                    width: '50px',
                                                    height: '26px',
                                                    position: 'relative',
                                                    cursor: isSaving ? 'not-allowed' : 'pointer',
                                                    transition: 'all 0.3s ease',
                                                    boxShadow: item.enable_coo_approval ? '0 0 8px var(--primary-light)' : 'none',
                                                    opacity: isSaving ? 0.7 : 1
                                                }}
                                                title={item.enable_coo_approval ? "Click to bypass COO" : "Click to enforce COO approval"}
                                            >
                                                <span 
                                                    style={{
                                                        position: 'absolute',
                                                        top: '3px',
                                                        left: item.enable_coo_approval ? '27px' : '3px',
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: '50%',
                                                        background: 'white',
                                                        transition: 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                                    }}
                                                />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .hover-row:hover {
                    background-color: var(--primary-light) !important;
                }
                .spin-anim {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .btn-secondary:hover {
                    background-color: var(--primary-light) !important;
                    color: var(--primary) !important;
                    border-color: var(--primary) !important;
                }
            `}</style>
        </div>
    );
};

export default COOProjectConfig;
