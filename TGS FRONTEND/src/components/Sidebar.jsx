import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Plane,
    ClipboardCheck,
    ClipboardList,
    IndianRupee,
    Settings,
    BookOpen,
    BarChart3,
    AlertCircle,
    Users,
    Building2,
    Wallet,
    MapPin,
    Car,
    ShieldCheck,
    Fuel,
    Inbox as InboxIcon,
    Archive
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

const Sidebar = () => {
    const { user, heartbeatData } = useAuth();
    const approvalCount = heartbeatData?.approval_counts?.total || 0;
    const rawRole = user?.role?.toLowerCase() || 'employee';
    const userRole = rawRole === 'user' ? 'employee' : rawRole;


    const sections = [
        {
            label: 'CORE',
            items: [
                { title: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/', roles: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo'] },
                { title: 'Inbox', icon: <InboxIcon size={18} />, path: '/inbox' },
                { title: 'Outbox', icon: <Archive size={18} />, path: '/outbox' },
            ]
        },
        {
            label: 'TRAVEL & FIELD',
            items: [
                { title: 'My Trips', icon: <Plane size={18} />, path: '/trips', roles: ['employee', 'reporting_authority', 'finance', 'admin'] },
                { title: 'Trip Planner', icon: <MapPin size={18} />, path: '/planner', roles: ['employee', 'admin'] },
                { title: 'Mileage Log', icon: <MapPin size={18} />, path: '/mileage', roles: ['employee', 'admin'] },
                { title: 'Job Report', icon: <ClipboardList size={18} />, path: '/job-report', roles: ['employee', 'reporting_authority', 'admin'] },
                { title: 'Guest House', icon: <Building2 size={18} />, path: '/guesthouse', roles: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo', 'guesthousemanager'] },
                { title: 'Fleet Management', icon: <Car size={18} />, path: '/fleet', roles: ['employee', 'admin'] },
            ]
        },
        {
            label: 'FINANCE & CLAIMS',
            items: [
                { title: 'New Advance', icon: <Wallet size={18} />, path: '/advance', roles: ['employee', 'admin'] },
                { title: 'Expenses', icon: <IndianRupee size={18} />, path: '/expenses', roles: ['employee', 'reporting_authority', 'admin'] },
                { title: 'Finance Hub', icon: <BarChart3 size={18} />, path: '/finance', roles: ['finance', 'admin'] },
                { title: 'Settlements', icon: <Wallet size={18} />, path: '/settlement', roles: ['finance', 'admin'] },
            ]
        },
        {
            label: 'GOVERNANCE',
            items: [
                { title: 'Policy Center', icon: <BookOpen size={18} />, path: '/policy', roles: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo'] },
                { title: 'Vendor Matrix', icon: <Users size={18} />, path: '/vendors', roles: ['employee', 'admin'] },
                { title: 'Disputes', icon: <AlertCircle size={18} />, path: '/disputes', roles: ['employee', 'reporting_authority', 'finance', 'admin'] },
                { title: 'Login History', icon: <Settings size={18} />, path: '/login-history', roles: ['admin'] },
                { title: 'Audit Logs', icon: <ShieldCheck size={18} />, path: '/audit-logs', roles: ['admin', 'finance', 'cfo'] },
            ]
        },
        {
            label: 'ADMINISTRATION',
            items: [
                { title: 'CFO Room', icon: <BarChart3 size={18} />, path: '/cfo-war-room', roles: ['cfo', 'admin'] },
                { title: 'User Management', icon: <Users size={18} />, path: '/employees', roles: ['admin'] },
                { title: 'API Management', icon: <Settings size={18} />, path: '/api-management', roles: ['admin'] },
                { title: 'Route Masters', icon: <MapPin size={18} />, path: '/route-management', roles: ['admin'] },
                { title: 'Master Management', icon: <Settings size={18} />, path: '/master-management', roles: ['admin'] },
                { title: 'Fuel Rate Master', icon: <Fuel size={18} />, path: '/fuel-master', roles: ['admin'] },
                { title: 'Masters', icon: <Settings size={18} />, path: '/AdminMasters', roles: ['admin'] },
                { title: 'App Version Config', icon: <Settings size={18} />, path: '/app-version', roles: ['admin'] },
            ]
        },
        {
            label: 'PERSONALIZATION',
            items: [
                { title: 'System Settings', icon: <Settings size={18} />, path: '/settings' },
            ]
        }
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="logo-box">
                    <img src="/logo.png" alt="TGS Logo" className="logo-img" />
                </div>
                <span>TGS Governance</span>
            </div>
            <nav className="sidebar-nav">
                {sections.map((section, sIdx) => {
                    const filteredItems = section.items.filter(item => !item.roles || item.roles.includes(userRole));
                    if (filteredItems.length === 0) return null;

                    return (
                        <div key={sIdx} className="sidebar-section">
                            <h4 className="section-label">{section.label}</h4>
                            <div className="section-items">
                                {filteredItems.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    >
                                        {item.icon}
                                        <span>{item.title}</span>
                                        {item.title === 'Inbox' && approvalCount > 0 && (
                                            <span className="nav-badge animate-pulse">{approvalCount}</span>
                                        )}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </nav>
            <NavLink to="/profile" className="sidebar-footer">
                <div className="user-info">
                    <div className="avatar">{user?.name?.charAt(0)}</div>
                    <div className="details">
                        <p className="name">{user?.name}</p>
                        <p className="role">{userRole}</p>
                    </div>
                </div>
            </NavLink>
        </aside>
    );
};

export default Sidebar;
