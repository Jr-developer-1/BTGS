import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/api';
import {
    Bell,
    LogOut,
    LayoutDashboard,
    Plane,
    IndianRupee,
    MapPin,
    Wallet,
    BookOpen,
    Users,
    Settings,
    ChevronDown,
    Building2,
    BarChart3,
    BarChart2,
    AlertCircle,
    MoreHorizontal,
    ShieldCheck,
    FolderOpen,
    HelpCircle,
    Car,
    ClipboardList,
    Fuel,
    Inbox as InboxIcon,
    Archive,
    Menu,
    X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Header = () => {
    const { user, logout, switchPosition, heartbeatData, fetchHeartbeat } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [showManagement, setShowManagement] = useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const notifications = heartbeatData?.notifications || [];
    const unreadCount = heartbeatData?.unread_notification_count || 0;

    useEffect(() => {
        if (user && showNotifications) {
            fetchHeartbeat();
        }
    }, [user, showNotifications, fetchHeartbeat]);

    const rawRole = user?.role?.toLowerCase() || 'employee';
    const dept = user?.department?.toLowerCase() || '';
    const desig = user?.designation?.toLowerCase() || '';

    // Comprehensive role detection matching backend logic
    let userRole = rawRole;
    if (rawRole === 'admin') userRole = 'admin';
    else if (dept.includes('finance') || desig.includes('finance') || rawRole.includes('finance')) userRole = 'finance';
    else if (dept.includes('hr') || desig.includes('hr') || rawRole === 'hr') userRole = 'hr';
    else if (dept.includes('cfo') || desig.includes('cfo') || rawRole === 'cfo') userRole = 'cfo';
    else if (rawRole.includes('guesthouse') || rawRole === 'guesthousemanager') userRole = 'guesthousemanager';


    useEffect(() => {
        setShowManagement(false);
        setShowProfileDropdown(false);
        setShowNotifications(false);
        setIsMobileMenuOpen(false);
    }, [location]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.management-dropdown-wrapper') &&
                !event.target.closest('.profile-wrapper') &&
                !event.target.closest('.notification-wrapper')) {
                setShowManagement(false);
                setShowProfileDropdown(false);
                setShowNotifications(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAllRead = async () => {
        try {
            await api.post('/api/notifications/mark-all-read/');
            fetchHeartbeat();
        } catch (error) {
            console.error("Failed to mark notifications as read:", error);
        }
    };

    const mainNav = [
        { title: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/', roles: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo', 'guesthousemanager'] },
        { title: 'My Trips', icon: <Plane size={18} />, path: '/trips', roles: ['employee', 'reporting_authority', 'finance', 'admin'] },
        { title: 'Inbox', icon: <InboxIcon size={18} />, path: '/inbox' },
        { title: 'Outbox', icon: <Archive size={18} />, path: '/outbox' },
    ];

    const managementNav = [
        { title: 'Claim Report', icon: <BarChart2 size={18} />, path: '/claim-report', roles: ['hr', 'finance', 'admin'] },
        { title: 'Trip & Travel Reports', icon: <BarChart3 size={18} />, path: '/trip-travel-reports', roles: ['hr', 'finance', 'admin'] },
        { title: 'Finance Hub', icon: <IndianRupee size={18} />, path: '/finance', roles: ['finance', 'admin'] },
        { title: 'Job Report', icon: <ClipboardList size={18} />, path: '/job-report', roles: ['employee', 'reporting_authority', 'admin'] },
        { title: 'Settlements', icon: <Wallet size={18} />, path: '/settlement', roles: ['finance', 'admin'] },
        { title: 'Documents', icon: <FolderOpen size={18} />, path: '/documents', roles: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo'] },
        { title: 'System Policy', icon: <BookOpen size={18} />, path: '/policy', roles: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo'] },
        // { title: 'CFO Room', icon: <BarChart3 size={18} />, path: '/cfo-war-room', roles: ['cfo', 'admin'] },
        { title: 'User Management', icon: <Users size={18} />, path: '/employees', roles: ['admin'] },
        { title: 'Role Permissions', icon: <ShieldCheck size={18} />, path: '/role-permissions', roles: ['admin'] },
        { title: 'Finance Workflow', icon: <ShieldCheck size={18} />, path: '/finance-workflow', roles: ['admin'] },
        { title: 'HR Positions', icon: <Users size={18} />, path: '/hr-positions', roles: ['admin'] },
        { title: 'COO Positions', icon: <Settings size={18} />, path: '/coo-positions', roles: ['admin'] },
        { title: 'Room Requests', icon: <Building2 size={18} />, path: '/guesthouse', roles: ['admin', 'cfo', 'guesthousemanager'] },
        { title: 'Vehicle Requests', icon: <Car size={18} />, path: '/fleet', roles: ['admin', 'guesthousemanager'] },
        { title: 'API Management', icon: <Settings size={18} />, path: '/api-management', roles: ['admin'] },
        { title: 'Route Masters', icon: <MapPin size={18} />, path: '/route-management', roles: ['admin'] },
        { title: 'Fuel Master', icon: <Fuel size={18} />, path: '/fuel-master', roles: ['admin'] },
        { title: 'Master Management', icon: <Settings size={18} />, path: '/master-management', roles: ['admin'] },
        // { title: 'Masters', icon: <Settings size={18} />, path: '/AdminMasters', roles: ['admin'] },
        { title: 'Help & Support', icon: <HelpCircle size={18} />, path: '/help', roles: ['employee', 'reporting_authority', 'finance', 'admin', 'cfo', 'guesthousemanager'] },
        { title: 'Login History', icon: <Settings size={18} />, path: '/login-history', roles: ['admin'] },
        { title: 'Audit Logs', icon: <ShieldCheck size={18} />, path: '/audit-logs', roles: ['admin'] },
        { title: 'App Version Config', icon: <Settings size={18} />, path: '/app-version', roles: ['admin'] },
    ];

    const checkPermission = (item) => {
        // Map paths to permission keys
        const permissionKeys = {
            '/': 'web_dashboard',
            '/trips': 'web_my_trips',
            '/inbox': 'web_inbox',
            '/outbox': 'web_outbox',
            '/claim-report': 'web_claim_report',
            '/trip-travel-reports': 'web_trip_travel_reports',
            '/finance': 'web_finance_hub',
            '/job-report': 'web_job_report',
            '/settlement': 'web_settlements',
            '/documents': 'web_documents',
            '/policy': 'web_system_policy',
            '/employees': 'web_user_management',
            '/role-permissions': 'web_role_permissions',
            '/finance-workflow': 'web_finance_workflow',
            '/hr-positions': 'web_hr_positions',
            '/coo-positions': 'web_coo_positions',
            '/guesthouse': 'web_room_requests',
            '/fleet': 'web_vehicle_requests',
            '/api-management': 'web_api_management',
            '/route-management': 'web_route_masters',
            '/fuel-master': 'web_fuel_master',
            '/master-management': 'web_master_management',
            '/help': 'web_help_support',
            '/login-history': 'web_login_history',
            '/audit-logs': 'web_audit_logs',
            '/app-version': 'web_app_version_config'
        };

        const key = permissionKeys[item.path];
        if (key && user?.role_permissions && user.role_permissions[key] !== undefined) {
            return !!user.role_permissions[key];
        }

        // Fallbacks
        if (item.path === '/trip-travel-reports') {
            return !!user?.can_view_reports;
        }
        if (item.path === '/claim-report') {
            return !!user?.can_view_claim_report;
        }
        if (item.roles && !item.roles.includes(userRole)) return false;
        return true;
    };

    const filteredMain = mainNav.filter(item => checkPermission(item));
    const filteredManagement = managementNav.filter(item => checkPermission(item));

    return (
        <header className="header">
            <div className="header-container">
                <div className="header-left">
                    <button
                        type="button"
                        className="mobile-menu-toggle"
                        onClick={() => setIsMobileMenuOpen(true)}
                    >
                        <Menu size={24} />
                    </button>
                    <div className="logo-section">
                        <div className="logo-box" onClick={() => navigate('/')}>
                            <img src="/logo.png" alt="TGS Logo" className="logo-img" />
                        </div>
                    </div>
                    <div className="app-title-section">
                        <h1 className="app-main-title">Bavya Travel Governance System</h1>
                    </div>
                </div>

                <div className="header-right">
                    <nav className="top-nav desktop-only">
                        {filteredMain.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            >
                                {item.icon}
                                <span>{item.title}</span>
                            </NavLink>
                        ))}

                        {filteredManagement.length > 0 && (
                            <div className="management-dropdown-wrapper">
                                <button
                                    className={`nav-link dropdown-trigger ${showManagement ? 'active-dropdown' : ''}`}
                                    onClick={() => setShowManagement(!showManagement)}
                                >
                                    <MoreHorizontal size={18} />
                                    <span>More</span>
                                    <ChevronDown size={14} className={`chevron ${showManagement ? 'open' : ''}`} />
                                </button>

                                {showManagement && (
                                    <div className="management-dropdown glass">
                                        {filteredManagement.map((item) => (
                                            <NavLink
                                                key={item.path}
                                                to={item.path}
                                                className="dropdown-item"
                                                onClick={() => setShowManagement(false)}
                                            >
                                                {item.icon}
                                                <span>{item.title}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </nav>

                    <div className="header-actions">
                        <div className="notification-wrapper">
                            <button className="icon-btn" onClick={() => setShowNotifications(!showNotifications)} title="Notifications">
                                <Bell size={24} className="header-icon-svg" />
                                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                            </button>

                            {showNotifications && (
                                <div className="notifications-dropdown glass">
                                    <div className="notifications-header">
                                        <h3>Recent Notifications</h3>
                                        <button className="btn-text-only" onClick={markAllRead}>Mark all as read</button>
                                    </div>
                                    <div className="notifications-list">
                                        {notifications.length > 0 ? (
                                            notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    className={`notification-item ${n.unread ? 'unread' : ''}`}
                                                    onClick={() => setShowNotifications(false)}
                                                >
                                                    <div className="notif-content">
                                                        <div className="notif-header">
                                                            <strong>{n.title}</strong>
                                                            <span className="notif-time">{n.time_ago}</span>
                                                        </div>
                                                        <p>{n.message}</p>
                                                        {n.link && !n.title.toLowerCase().includes('reminder') && !n.message.toLowerCase().includes('reminder') && (
                                                            <button
                                                                className="click-to-view-link"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (n.link) {
                                                                        navigate(n.link);
                                                                    } else if (n.title.toLowerCase().includes('room') || n.message.toLowerCase().includes('room')) {
                                                                        navigate('/guesthouse?tab=requests');
                                                                    } else {
                                                                        navigate('/approvals');
                                                                    }
                                                                    setShowNotifications(false);
                                                                }}
                                                            >
                                                                Click to view
                                                            </button>
                                                        )}
                                                    </div>
                                                    {n.unread && <div className="unread-dot"></div>}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="empty-notifications">
                                                <Bell size={32} opacity={0.3} />
                                                <p>All caught up!</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="notifications-footer">
                                        <button className="view-all-notif" onClick={() => {
                                            navigate('/notifications');
                                            setShowNotifications(false);
                                        }}>View All Notifications</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="profile-wrapper">
                            <button
                                className="profile-trigger"
                                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                                title="Account Settings"
                            >
                                <div className="user-avatar-outer">
                                    <div className="user-avatar">
                                        {user?.name?.charAt(0) || 'S'}
                                    </div>
                                    <div className="status-dot"></div>
                                </div>
                            </button>

                            {showProfileDropdown && (
                                <div className="profile-dropdown glass">
                                    <div className="dropdown-user-info">
                                        <strong>{user?.name || 'System Admin'}</strong>
                                        <span>{userRole.toUpperCase()}</span>
                                    </div>
                                    <div className="dropdown-divider"></div>
                                    <NavLink to="/profile" className="dropdown-item" onClick={() => setShowProfileDropdown(false)}>
                                        <Users size={18} />
                                        <span>My Profile</span>
                                    </NavLink>
                                    <NavLink to="/settings" className="dropdown-item" onClick={() => setShowProfileDropdown(false)}>
                                        <Settings size={18} />
                                        <span>System Settings</span>
                                    </NavLink>

                                    {user?.available_positions?.length > 1 && (
                                        <>
                                            <div className="dropdown-divider"></div>
                                            <div className="dropdown-section-title">Switch Position</div>
                                            {user.available_positions.map(pos => (
                                                <button
                                                    key={pos.id}
                                                    className={`dropdown-item position-item ${String(pos.id) === String(user.active_position_id || user.available_positions[0]?.id) ? 'active-pos' : ''}`}
                                                    onClick={() => {
                                                        if (String(pos.id) !== String(user.active_position_id || user.available_positions[0]?.id)) {
                                                            switchPosition(pos.id);
                                                        }
                                                        setShowProfileDropdown(false);
                                                    }}
                                                >
                                                    <div className="pos-icon-box">
                                                        <ShieldCheck size={16} />
                                                    </div>
                                                    <div className="pos-item-details">
                                                        <span className="pos-name">{pos.name}</span>
                                                        <span className="pos-dept">{pos.department_name || pos.department}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </>
                                    )}

                                    <div className="dropdown-divider"></div>
                                    <button className="dropdown-item logout-item" onClick={logout}>
                                        <LogOut size={18} />
                                        <span>Logout</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            <div className={`mobile-menu-overlay ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="mobile-menu-header">
                    <img src="/logo.png" alt="TGS Logo" className="mobile-logo" />
                    <button className="close-menu" onClick={() => setIsMobileMenuOpen(false)}>
                        <X size={24} />
                    </button>
                </div>
                <div className="mobile-menu-content">
                    <div className="mobile-nav-section">
                        <h4>Main Navigation</h4>
                        <div className="mobile-nav-list">
                            {filteredMain.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {item.icon}
                                    <span>{item.title}</span>
                                </NavLink>
                            ))}
                        </div>
                    </div>
                    {filteredManagement.length > 0 && (
                        <div className="mobile-nav-section">
                            <h4>Management</h4>
                            <div className="mobile-nav-list">
                                {filteredManagement.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        {item.icon}
                                        <span>{item.title}</span>
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
