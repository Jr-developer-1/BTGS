import React, { useState, useEffect } from 'react';
import api from '../api/api';
import {
    Plus, Edit2, Trash2, Car, IndianRupee, MapPin,
    ChevronDown, AlertCircle, Fuel, Search, Info, TrendingUp, Layers, CheckCircle2, X
} from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import { useToast } from '../context/ToastContext';


// Fallback list of Indian states in case the Location API/DB is empty
const INDIA_STATES_FALLBACK = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

const FuelMaster = () => {
    const { showToast } = useToast();
    const [rates, setRates] = useState([]);
    const [states, setStates] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        state: '',
        vehicle_type: '4 Wheeler',
        rate_per_km: ''
    });

    const [searchQuery, setSearchQuery] = useState('');

    // Compute which vehicle types are already configured for the currently selected state
    // Only applies when CREATING (not editing) so we block duplicates at UI level
    const takenVehicles = React.useMemo(() => {
        if (!formData.state || editingItem) return new Set();
        return new Set(
            rates
                .filter(r => r.state?.toLowerCase() === formData.state?.toLowerCase())
                .map(r => r.vehicle_type)
        );
    }, [formData.state, rates, editingItem]);

    useEffect(() => {
        fetchData();
        fetchStates();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/api/masters/fuel-rate-masters/');
            // Handle both paginated and non-paginated responses
            const data = res.data.results || res.data;
            setRates(Array.isArray(data) ? data : []);
        } catch (error) {
            showToast("Failed to fetch fuel rates", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStates = async () => {
        try {
            const res = await api.get('/api/masters/locations/?type=State');
            const data = res.data.results || res.data;
            const locationStates = Array.isArray(data) ? data : [];
            if (locationStates.length > 0) {
                // Use Location objects from DB (each has .name, .id, etc.)
                setStates(locationStates);
            } else {
                // Fallback: use simple string list of Indian states
                console.warn("Location API returned no states. Using fallback list.");
                setStates(INDIA_STATES_FALLBACK);
            }
        } catch (error) {
            console.error("Failed to fetch states, using fallback list.", error);
            setStates(INDIA_STATES_FALLBACK);
        }
    };

    const handleOpenForm = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                state: item.state,
                vehicle_type: item.vehicle_type,
                rate_per_km: item.rate_per_km
            });
        } else {
            setEditingItem(null);
            setFormData({ state: '', vehicle_type: '4 Wheeler', rate_per_km: '' });
        }
        setIsFormOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await api.put(`/api/masters/fuel-rate-masters/${editingItem.id}/`, formData);
                showToast("Rate updated successfully", "success");
            } else {
                await api.post('/api/masters/fuel-rate-masters/', formData);
                showToast("Rate added successfully", "success");
            }
            setIsFormOpen(false);
            fetchData();
        } catch (error) {
            const msg = error.response?.data?.non_field_errors?.[0] ||
                error.response?.data?.detail ||
                "Operation failed. Check if rate already exists for this state and vehicle.";
            showToast(msg, "error");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this rate?")) return;
        try {
            await api.delete(`/api/masters/fuel-rate-masters/${id}/`);
            showToast("Rate deleted successfully", "success");
            fetchData();
        } catch (error) {
            showToast("Deletion failed", "error");
        }
    };

    const filteredRates = rates.filter(r =>
        (r.state || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.vehicle_type || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Stats for UI
    const totalStates = [...new Set(rates.map(r => r.state))].length;
    const avg2Wheeler = rates.filter(r => r.vehicle_type === '2 Wheeler').reduce((acc, curr) => acc + parseFloat(curr.rate_per_km), 0) / (rates.filter(r => r.vehicle_type === '2 Wheeler').length || 1);
    const avg4Wheeler = rates.filter(r => r.vehicle_type === '4 Wheeler').reduce((acc, curr) => acc + parseFloat(curr.rate_per_km), 0) / (rates.filter(r => r.vehicle_type === '4 Wheeler').length || 1);

    return (
        <div className="fuel-master-module animate-fade-in" style={{ padding: '0', background: 'transparent' }}>
            <div className="master-page-header" style={{ padding: '20px 40px 0 40px', background: 'transparent', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '52px', height: '52px', background: 'var(--primary-light)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', boxShadow: '0 4px 12px rgba(0, 128, 128, 0.1)' }}>
                            <Fuel size={28} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0', letterSpacing: '-0.02em' }}>Fuel Management</h1>
                            {/* <p style={{ color: 'var(--text-dim)', fontSize: '1rem', fontWeight: 500 }}>Configure per-KM rates for dynamic trip expense calculations.</p> */}
                        </div>
                    </div>
                    <button className="tab-switcher-btn active" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 24px', borderRadius: '16px', fontWeight: 700, background: 'var(--primary)', color: 'white', border: 'none', boxShadow: '0 10px 20px -5px rgba(0, 128, 128, 0.3)' }} onClick={() => handleOpenForm()}>
                        <Plus size={20} />
                        Add New Rate
                    </button>
                </div>
            </div>
            
            <div className="content-inner-wrapper" style={{ padding: '20px 40px', maxWidth: '1600px', margin: '0 auto' }}>
            <style>{`
                .fm-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1.5rem;
                    margin: 2.5rem 0;
                }
                .fm-stat-card {
                    background: white;
                    padding: 1.75rem;
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    border: 1.5px solid var(--admin-border);
                    position: relative;
                    overflow: hidden;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                }
                .fm-stat-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 20px -5px rgba(0, 0, 0, 0.08);
                    border-color: var(--primary);
                }
                .fm-accent-bar {
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 5px;
                    border-radius: 0 10px 10px 0;
                }
                .fm-icon-box {
                    width: 56px;
                    height: 56px;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .fm-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }
                .fm-label {
                    font-size: 0.75rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: var(--text-muted);
                    letter-spacing: 0.05em;
                }
                .fm-value {
                    font-size: 1.75rem;
                    font-weight: 900;
                    color: var(--text-main);
                    line-height: 1.2;
                }
                .fm-badge {
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 0.25rem 0.6rem;
                    border-radius: 6px;
                    width: fit-content;
                    margin-top: 0.25rem;
                }
            `}</style>

            {/* Quick Stats Cards */}
            <div className="fm-stats-grid">
                <div className="fm-stat-card">
                    <div className="fm-accent-bar bg-blue-500"></div>
                    <div className="fm-icon-box bg-blue-50 text-blue-600">
                        <MapPin size={24} />
                    </div>
                    <div className="fm-info">
                        <span className="fm-label">States Covered</span>
                        <div className="fm-value">{totalStates}</div>
                        <div className="fm-badge bg-blue-100 text-blue-700">Active Geographic Filters</div>
                    </div>
                </div>

                <div className="fm-stat-card">
                    <div className="fm-accent-bar bg-purple-500"></div>
                    <div className="fm-icon-box bg-purple-50 text-purple-600">
                        <Car size={24} />
                    </div>
                    <div className="fm-info">
                        <span className="fm-label">Avg 2Wheeler Rate</span>
                        <div className="fm-value">₹{avg2Wheeler.toFixed(2)}</div>
                        <div className="fm-badge bg-purple-100 text-purple-700">Base for Local Travel</div>
                    </div>
                </div>

                <div className="fm-stat-card">
                    <div className="fm-accent-bar bg-emerald-500"></div>
                    <div className="fm-icon-box bg-emerald-50 text-emerald-600">
                        <TrendingUp size={24} />
                    </div>
                    <div className="fm-info">
                        <span className="fm-label">Avg 4Wheeler Rate</span>
                        <div className="fm-value">₹{avg4Wheeler.toFixed(2)}</div>
                        <div className="fm-badge bg-emerald-100 text-emerald-700">Premium Travel Logistics</div>
                    </div>
                </div>
            </div>

            {/* Search and Table Panel */}
            <div className="main-table-panel shadow-xl rounded-3xl border border-slate-100 overflow-hidden">
                <div className="panel-header bg-white/50 backdrop-blur-md p-6 border-b border-slate-100">
                    <div className="search-box-wrapper max-w-md w-full relative">
                        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            className="form-input w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 border-slate-200 focus:bg-white focus:ring-4 focus:ring-magenta-100 transition-all"
                            placeholder="Filter by state or vehicle type..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="data-table-container custom-scrollbar max-h-[600px] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-20 gap-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-magenta-200 border-t-magenta-600"></div>
                            <p className="text-slate-500 font-medium">Synchronizing rates...</p>
                        </div>
                    ) : (
                        <table className="modern-table w-full">
                            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur z-10">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">STATE</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">VEHICLE CATEGORY</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">RATE (₹/KM)</th>
                                    <th className="px-6 py-12 text-right text-xs font-bold text-slate-400 uppercase tracking-widest" style={{ textAlign: 'right' }}>CONTROL</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredRates.length > 0 ? filteredRates.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                                                    <MapPin size={16} />
                                                </div>
                                                <span className="font-semibold text-slate-700">{item.state}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${item.vehicle_type === '4 Wheeler'
                                                ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                : 'bg-purple-50 text-purple-600 border border-purple-100'
                                                }`}>
                                                {item.vehicle_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-lg font-bold text-slate-800">
                                                <span className="text-slate-400 font-normal">₹</span>
                                                {item.rate_per_km}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    className="p-2 hover:bg-white hover:text-blue-600 hover:shadow-md rounded-xl transition-all text-slate-400"
                                                    onClick={() => handleOpenForm(item)}
                                                    title="Edit Entry"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    className="p-2 hover:bg-white hover:text-red-500 hover:shadow-md rounded-xl transition-all text-slate-400"
                                                    onClick={() => handleDelete(item.id)}
                                                    title="Delete Entry"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4" className="py-20 text-center">
                                            <div className="flex flex-col items-center gap-3 text-slate-400">
                                                <TrendingUp size={48} className="opacity-20" />
                                                <p className="font-medium">No fuel rates matching your search.</p>
                                                <button className="text-teal-600 text-sm font-bold hover:underline" onClick={() => handleOpenForm()}>
                                                    Set up your first rate
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal Form */}
            {isFormOpen && (
                <div className="modal-overlay fixed inset-0 bg-slate-900/40 backdrop-blur-[6px] z-[999] flex items-center justify-center p-4">
                    <style>{`
                        .fm-modal {
                            background: white;
                            width: 100%;
                            max-width: 550px;
                            border-radius: 28px;
                            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                            position: relative;
                            overflow: hidden;
                            animation: modalPop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                        }
                        @keyframes modalPop {
                            from { transform: scale(0.9) translateY(20px); opacity: 0; }
                            to { transform: scale(1) translateY(0); opacity: 1; }
                        }
                        .fm-modal-header {
                            padding: 2.5rem 2.5rem 1.5rem;
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                        }
                        .fm-modal-body { padding: 0 2.5rem 2.5rem; }
                        
                        .fm-input-group { margin-bottom: 2rem; }
                        .fm-input-group label {
                            display: block;
                            font-size: 0.75rem;
                            font-weight: 800;
                            color: var(--text-muted);
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                            margin-bottom: 0.75rem;
                        }
                        
                        .fm-modern-input {
                            display: flex;
                            align-items: center;
                            background: #f8fafc;
                            border: 1.5px solid var(--admin-border);
                            border-radius: 16px;
                            padding: 0 1.25rem;
                            transition: all 0.2s;
                        }
                        .fm-modern-input:focus-within {
                            border-color: var(--primary);
                            background: white;
                            box-shadow: 0 0 0 4px var(--primary-light);
                        }
                        .fm-modern-input svg { color: var(--text-muted); flex-shrink: 0; }
                        .fm-modern-input input, .fm-modern-input select {
                            border: none;
                            background: transparent;
                            width: 100%;
                            padding: 1rem 0.75rem;
                            font-weight: 600;
                            font-size: 0.95rem;
                        }
                        .fm-modern-input input:focus { outline: none; }

                        .fm-type-selector {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 1rem;
                        }
                        .fm-type-card {
                            background: #f8fafc;
                            border: 2px solid transparent;
                            border-radius: 18px;
                            padding: 1.25rem;
                            cursor: pointer;
                            transition: all 0.2s;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            gap: 0.75rem;
                        }
                        .fm-type-card:hover:not(:disabled) { background: #f1f5f9; border-color: #e2e8f0; }
                        .fm-type-card.active {
                            background: var(--primary-light);
                            border-color: var(--primary);
                            color: var(--primary);
                        }
                        .fm-type-card:disabled { opacity: 0.4; cursor: not-allowed; grayscale: 1; }
                        .fm-type-card strong { font-size: 0.85rem; font-weight: 800; text-transform: uppercase; }

                        .fm-btn-group { display: grid; grid-template-columns: 1fr 1.5fr; gap: 1rem; margin-top: 1rem; }
                        .fm-btn {
                            padding: 1rem;
                            border-radius: 16px;
                            font-weight: 800;
                            font-size: 0.95rem;
                            cursor: pointer;
                            transition: all 0.2s;
                        }
                        .fm-btn.cancel { background: #f1f5f9; color: var(--text-muted); }
                        .fm-btn.confirm { background: var(--primary); color: white; border: none; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
                        .fm-btn:hover { transform: translateY(-2px); }
                        .fm-btn.confirm:hover { background: var(--primary-hover); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15); }
                    `}</style>

                    <div className="fm-modal">
                        <div className="fm-modal-header">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">{editingItem ? 'Edit Fuel Rate' : 'Initialize Rate'}</h2>
                                {/* <p className="text-slate-500 font-medium text-sm">Configure per-kilometer pricing standards</p> */}
                            </div>
                            <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <X size={24} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="fm-modal-body">
                            <form onSubmit={handleSave}>
                                <div className="fm-input-group">
                                    <label>Target State</label>
                                    <div className="fm-modern-input">
                                        <MapPin size={20} />
                                        <SearchableSelect
                                            placeholder="Select Regional State"
                                            options={states}
                                            value={formData.state}
                                            onChange={(val) => {
                                                const stateName = typeof val === 'string' ? val : (val?.name || '');
                                                const existingForState = new Set(
                                                    rates.filter(r => r.state?.toLowerCase() === stateName?.toLowerCase()).map(r => r.vehicle_type)
                                                );
                                                const preferredTypes = ['4 Wheeler', '2 Wheeler'];
                                                const firstAvailable = preferredTypes.find(t => !existingForState.has(t));
                                                setFormData({ ...formData, state: stateName, vehicle_type: firstAvailable || formData.vehicle_type });
                                            }}
                                        />
                                    </div>
                                    <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Synchronized via Geographic Master</p>
                                </div>

                                <div className="fm-input-group">
                                    <label>Vehicle Category</label>
                                    <div className="fm-type-selector">
                                        {['2 Wheeler', '4 Wheeler'].map((vType) => {
                                            const isTaken = takenVehicles.has(vType);
                                            const isActive = formData.vehicle_type === vType;
                                            return (
                                                <button
                                                    key={vType}
                                                    type="button"
                                                    disabled={isTaken}
                                                    onClick={() => setFormData({ ...formData, vehicle_type: vType })}
                                                    className={`fm-type-card ${isActive ? 'active' : ''}`}
                                                >
                                                    <div className={`p-3 rounded-xl ${isActive ? 'bg-white' : 'bg-white'} shadow-sm`}>
                                                        <Car size={24} />
                                                    </div>
                                                    <strong>{vType}</strong>
                                                    {isTaken && <span className="text-[9px] font-black text-red-500">EXISTS</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="fm-input-group">
                                    <label>Fuel Rate (INR per KM)</label>
                                    <div className="fm-modern-input">
                                        <IndianRupee size={20} />
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={formData.rate_per_km}
                                            onChange={(e) => setFormData({ ...formData, rate_per_km: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="fm-btn-group">
                                    <button type="button" className="fm-btn cancel" onClick={() => setIsFormOpen(false)}>Discard</button>
                                    <button type="submit" className="fm-btn confirm">
                                        {editingItem ? 'Update Standard' : 'Confirm Standard'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default FuelMaster;
