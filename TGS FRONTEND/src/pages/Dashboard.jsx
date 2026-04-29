import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    PlusCircle,
    TrendingUp,
    Briefcase,
    CreditCard,
    Zap,
    BarChart3,
    Building2,
    Activity,
    Users,
    Monitor,
    Globe,
    ShieldCheck,
    CheckCircle2,
    Clock,
    ArrowRight,
    Calendar,
    Award,
    ShieldAlert,
    PieChart,
    Layers,
    Coffee,
    Hotel,
    Car,
    IndianRupee
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { motion, AnimatePresence } from 'framer-motion';

const ANALYTICS_STYLES = `
    .dashboard-page { min-height: 100vh; }
    .kpi-grid { display: grid; grid-template-columns: repeat(1, 1fr); gap: 1.5rem; margin-bottom: 2rem; }
    @media (min-width: 640px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 1024px) { .kpi-grid { grid-template-columns: repeat(4, 1fr); } }

    .kpi-card.premium-card { padding: 0; border-radius: 1.25rem; position: relative; overflow: hidden; color: white; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); min-height: 140px; box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.2); }
    .kpi-card.orange { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); }
    .kpi-card.red { background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); }
    .kpi-card.purple, .kpi-card.magenta { background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%); }
    .kpi-card.yellow { background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%); }

    .mesh-blob { position: absolute; top: -20%; right: -10%; width: 50%; height: 80%; background: white; opacity: 0.1; filter: blur(30px); border-radius: 50%; }
    .mesh-blob-2 { position: absolute; bottom: -20%; left: -10%; width: 40%; height: 70%; background: black; opacity: 0.05; filter: blur(30px); border-radius: 50%; }

    .kpi-content-wrapper { padding: 1.5rem; position: relative; z-index: 10; height: 100%; display: flex; align-items: center; }
    .kpi-content { display: flex; justify-content: space-between; align-items: center; width: 100%; }
    .kpi-info { display: flex; flex-direction: column; gap: 4px; }
    .kpi-title { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.9; }
    .kpi-value { font-size: 2.15rem; font-weight: 900; line-height: 1; margin: 4px 0; }
    .kpi-label { font-size: 0.8rem; font-weight: 600; opacity: 0.8; }
    .kpi-icon-container { padding: 0.75rem; background: rgba(255, 255, 255, 0.2); border-radius: 1.1rem; backdrop-blur: sm; }

    .analytics-section { display: grid; grid-template-columns: 1fr; gap: 2.25rem; align-items: stretch; }
    @media (min-width: 1024px) { .analytics-section { grid-template-columns: 1.8fr 1.2fr; } }

    .institutional-hub {
        background: radial-gradient(circle at 0% 0%, #1e293b 0%, #0f172a 100%);
        border-radius: 1.5rem;
        padding: 2.25rem;
        position: relative;
        overflow: hidden;
        box-shadow: 0 20px 50px -15px rgba(0, 0, 0, 0.4);
        min-height: 480px;
    }
    .chart-container-box { width: 100%; height: 320px; position: relative; margin-top: 1.5rem; }
    .svg-layer-full { width: 100%; height: 100%; overflow: visible; }
    .grid-line { stroke: rgba(255, 255, 255, 0.05); stroke-width: 1; }
    .svg-label-text { font-size: 11px; font-weight: 900; fill: rgba(255, 255, 255, 0.3); text-transform: uppercase; letter-spacing: 0.1em; }

    .metric-card-pro {
        padding: 1.5rem;
        border-radius: 1.25rem;
        display: flex;
        align-items: center;
        gap: 1.25rem;
        background: white;
        border: 1px solid #f1f5f9;
        position: relative;
        overflow: hidden;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .icon-box { padding: 12px; border-radius: 12px; }
    .card-accent-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; }

    .expense-division-panel {
        background: white;
        border-radius: 1.5rem;
        padding: 1.75rem;
        border: 1px solid #f1f5f9;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }
    .mini-progress-row { display: flex; flex-direction: column; gap: 0.4rem; }
    .mini-progress-bg { height: 6px; background: #f8fafc; border-radius: 10px; overflow: hidden; }
    .mini-progress-fill { height: 100%; border-radius: 10px; transition: width 1s cubic-bezier(0.4, 0, 0.2, 1); }

    .pulse-glow { width: 8px; height: 8px; border-radius: 50%; background: #10b981; animation: active-pulse 2s infinite; }
    @keyframes active-pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.6; } 100% { transform: scale(1); opacity: 1; } }

    .spinner { width: 3rem; height: 3rem; border: 4px solid #f1f5f9; border-top: 4px solid #0f172a; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;

const InstitutionalPulseChart = ({ data }) => {
    const [hoveredIdx, setHoveredIdx] = useState(null);
    if (!data || data.length === 0) return (
        <div className="h-[320px] flex items-center justify-center text-white/20 font-black uppercase tracking-widest border border-white/5 rounded-2xl">
            Signal Lost / No Activity Data
        </div>
    );
    const width = 1000; const height = 400; const paddingX = 60; const paddingY = 80;

    const getCurve = (points) => {
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i]; const p1 = points[i + 1]; const cp1x = p0.x + (p1.x - p0.x) / 2;
            d += ` C ${cp1x} ${p0.y}, ${cp1x} ${p1.y}, ${p1.x} ${p1.y}`;
        }
        return d;
    };

    const mainPoints = data.map((d, i) => ({
        x: (i * (width - paddingX * 2)) / (data.length - 1) + paddingX,
        y: height - (d.value * (height - paddingY * 2)) / 100 - paddingY - 40
    }));

    const mainPath = getCurve(mainPoints);

    return (
        <div className="chart-container-box">
            <svg viewBox={`0 0 ${width} ${height}`} className="svg-layer-full">
                <defs>
                    <linearGradient id="primaryArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                    </linearGradient>
                </defs>
                {[0, 25, 50, 75, 100].map(v => {
                    const y = height - (v * (height - paddingY * 2)) / 100 - paddingY - 40;
                    return <line key={v} x1={paddingX} y1={y} x2={width - paddingX} y2={y} className="grid-line" />
                })}
                <motion.path d={`${mainPath} L ${width - paddingX},${height - paddingY - 40} L ${paddingX},${height - paddingY - 40} Z`} fill="url(#primaryArea)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
                <motion.path d={mainPath} fill="none" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5 }} />
                {data.map((d, i) => (
                    <g key={i} onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
                        <circle cx={mainPoints[i].x} cy={mainPoints[i].y} r="18" fill="transparent" style={{ cursor: 'pointer' }} />
                        {(d.count > 0 || hoveredIdx === i) && (
                            <>
                                <circle cx={mainPoints[i].x} cy={mainPoints[i].y} r={hoveredIdx === i ? "10" : "5"} fill="#ef4444" />
                                <circle cx={mainPoints[i].x} cy={mainPoints[i].y} r="2.5" fill="white" />
                            </>
                        )}
                    </g>
                ))}
                <text x={paddingX} y={height - 20} className="svg-label-text" textAnchor="start">{data[0]?.label}</text>
                <text x={width - paddingX} y={height - 20} className="svg-label-text" textAnchor="end">{data[data.length - 1]?.label}</text>
            </svg>
        </div>
    );
};

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [adminAnalytics, setAdminAnalytics] = useState({ totalEmp: 0, activated: 0, activeNow: 0 });
    const [kpiCards, setKpiCards] = useState([]);
    const [expenseDivision, setExpenseDivision] = useState([]);
    const [tripFlow, setTripFlow] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Authorization Check: Determines if the user sees the Admin Dashboard or Employee Dashboard
    const privilegedRoles = ['admin', 'it-admin', 'superuser', 'cfo', 'hr', 'finance', 'guesthousemanager', 'coo', 'it admin'];
    const userRoleStr = (typeof user?.role === 'string' ? user.role : user?.role?.name || '').toLowerCase();
    const isUserAdmin = user?.is_superuser || privilegedRoles.some(r => userRoleStr.includes(r.toLowerCase()));

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                // Fetch directly from standard endpoints
                const [statsRes, tripsRes, travelsRes, expensesRes, employeesRes, loginHistoryRes] = await Promise.all([
                    api.get('/api/dashboard-stats/'),
                    api.get(`/api/trips/${isUserAdmin ? '?all=true' : ''}`),
                    api.get(`/api/travels/${isUserAdmin ? '?all=true' : ''}`),
                    api.get('/api/expenses/'),
                    api.get('/api/employees/'),
                    api.get('/api/login-history/')
                ]);

                // 1. KPI CARDS (From Dashboard Stats)
                const kpis = statsRes.data.kpis || [];
                const iconMap = { 'Briefcase': <Briefcase size={20} />, 'CreditCard': <CreditCard size={20} />, 'TrendingUp': <TrendingUp size={20} />, 'Clock': <Clock size={20} /> };
                setKpiCards(kpis.map(k => ({ ...k, icon: iconMap[k.icon] || <Zap size={20} /> })));

                // 2. ADMIN ANALYTICS
                const totalEmpCount = employeesRes.data.count ?? (employeesRes.data.results || employeesRes.data || []).length;

                let activatedCount = 0;
                let activeNowCount = 0;

                if (isUserAdmin) {
                    try {
                        const [usersRes, sessionsRes] = await Promise.all([
                            api.get('/api/users/').catch(() => ({ data: { count: 0 } })),
                            api.get('/api/session-history').catch(() => ({ data: [] }))
                        ]);

                        activatedCount = usersRes.data.count ?? (Array.isArray(usersRes.data) ? usersRes.data.length : 0);

                        const sessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : (sessionsRes.data.results || []);
                        activeNowCount = sessions.filter(s => s.is_active === true).length;
                    } catch (e) {
                        console.warn("Administrative analytics fetch failed:", e);
                    }
                }

                setAdminAnalytics({
                    totalEmp: totalEmpCount,
                    activated: activatedCount,
                    activeNow: activeNowCount
                });

                // 3. EXPENSES DIVISION (Employee Only)
                const expenses = expensesRes.data.results || expensesRes.data || [];
                const totalValue = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
                const categories = {
                    'Travel': { amount: 0, color: '#f97316' },
                    'Stay': { amount: 0, color: '#ef4444' },
                    'Food': { amount: 0, color: '#d946ef' },
                    'Misc': { amount: 0, color: '#64748b' }
                };
                expenses.forEach(e => {
                    const n = (e.category || e.nature || '').toLowerCase();
                    const a = parseFloat(e.amount || 0);
                    if (n.includes('travel') || n.includes('cab') || n.includes('flight') || n.includes('fuel')) categories['Travel'].amount += a;
                    else if (n.includes('stay') || n.includes('accommodation') || n.includes('hotel')) categories['Stay'].amount += a;
                    else if (n.includes('food') || n.includes('meal')) categories['Food'].amount += a;
                    else categories['Misc'].amount += a;
                });
                setExpenseDivision(Object.keys(categories).map(k => ({
                    category: k, amount: Math.round(categories[k].amount), percentage: totalValue > 0 ? (categories[k].amount / totalValue) * 100 : 0, color: categories[k].color
                })));

                // 4. GRAPH DATA GENERATION (Combine Trips and Travels)
                const allTrips = [...(tripsRes.data.results || tripsRes.data || []), ...(travelsRes.data.results || travelsRes.data || [])];
                const dataPoints = [];
                const now = new Date();
                for (let i = 29; i >= 0; i--) {
                    const d = new Date(); d.setDate(now.getDate() - i);
                    const ds = d.toISOString().split('T')[0];
                    const pts = allTrips.filter(t => {
                        const dateStr = t.created_at || t.start_date || t.request_date || t.date || '';
                        return dateStr.startsWith(ds);
                    }).length;
                    dataPoints.push({ label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), count: pts });
                }
                const maxVal = Math.max(...dataPoints.map(p => p.count)) || 1;
                setTripFlow(dataPoints.map(p => ({ ...p, value: (p.count / maxVal) * 100 })));

            } catch (err) {
                console.error("Dashboard Master Fetch Failure:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAllData();
    }, [user]);

    if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><div className="spinner"></div></div>;

    return (
        <div className="dashboard-page p-4 lg:p-8">
            <style>{ANALYTICS_STYLES}</style>

            <div className="kpi-grid">
                {kpiCards.map((kpi, idx) => (
                    <div key={idx} className={`kpi-card premium-card ${kpi.color}`}>
                        <div className="mesh-blob"></div><div className="mesh-blob-2"></div>
                        <div className="kpi-content-wrapper">
                            <div className="kpi-content">
                                <div className="kpi-info">
                                    <span className="kpi-title">{kpi.title}</span>
                                    <span className="kpi-value">{kpi.value}</span>
                                    <span className="kpi-label">{kpi.label}</span>
                                </div>
                                <div className="kpi-icon-container">{kpi.icon}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="analytics-section">
                <motion.div className="institutional-hub" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-xl text-white backdrop-blur-md border border-white/5"><BarChart3 size={20} /></div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">Trip Analytics</h2>
                        </div>
                    </div>
                    <InstitutionalPulseChart data={tripFlow} />
                </motion.div>

                <div className="flex flex-col gap-4">
                    {isUserAdmin ? (
                        <>
                            <div className="metric-card-pro"><div className="card-accent-bar bg-orange-500"></div><div className="icon-box bg-orange-50 text-orange-600"><Users size={22} /></div><div className="flex-grow"><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Employees Indexed</div><div className="text-2xl font-black text-slate-800">{adminAnalytics.totalEmp}</div></div></div>
                            <div className="metric-card-pro"><div className="card-accent-bar bg-rose-500"></div><div className="icon-box bg-rose-50 text-rose-600"><CheckCircle2 size={22} /></div><div className="flex-grow"><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Activated Access Control</div><div className="text-2xl font-black text-slate-800">{adminAnalytics.activated}</div></div></div>
                            <div className="metric-card-pro"><div className="card-accent-bar bg-fuchsia-500"></div><div className="icon-box bg-fuchsia-50 text-fuchsia-600"><Monitor size={22} /></div><div className="flex-grow flex items-center justify-between pr-2"><div><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Now</div><div className="text-2xl font-black text-slate-800">{adminAnalytics.activeNow < 10 ? `0${adminAnalytics.activeNow}` : adminAnalytics.activeNow}</div></div><div className="pulse-glow"></div></div></div>
                        </>
                    ) : (
                        <>
                            <div className="expense-division-panel">
                                <div className="flex items-center justify-between mb-4"><h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Expenses Division</h3><PieChart size={16} className="text-rose-500" /></div>
                                {expenseDivision.map((item, idx) => (
                                    <div key={idx} className="mini-progress-row"><div className="flex justify-between items-center text-[10px] font-bold text-slate-500"><span className="uppercase tracking-widest">{item.category}</span><span className="font-black text-slate-800">₹{item.amount}</span></div><div className="mini-progress-bg"><motion.div className="mini-progress-fill" initial={{ width: 0 }} animate={{ width: `${item.percentage}%` }} style={{ background: item.color }} /></div></div>
                                ))}
                                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center"><div><div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total My Expense</div><div className="text-xl font-black text-slate-800">₹{expenseDivision.reduce((s, i) => s + i.amount, 0)}</div></div><div className="flex items-center gap-1 bg-teal-50 px-2 py-1.5 rounded-lg text-teal-600"><ShieldCheck size={14} /><span className="text-[8px] font-black uppercase">Verified Node</span></div></div>
                            </div>
                            <div className="metric-card-pro"><div className="card-accent-bar bg-teal-500"></div><div className="icon-box bg-teal-50 text-teal-600"><CheckCircle2 size={22} /></div><div className="flex-grow flex items-center justify-between pr-2"><div><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Account Sync</div><div className="text-sm font-black text-slate-800 uppercase">Profile Verified</div></div><div className="pulse-glow"></div></div></div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
