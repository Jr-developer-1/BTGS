import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, MapPin, Briefcase, Building2, Hash } from 'lucide-react';
import api from '../api/api';

const Profile = () => {
    const { user } = useAuth();
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [apiKeyMissing, setApiKeyMissing] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            const apiKey = sessionStorage.getItem('company_api_key');

            if (!apiKey) {
                setApiKeyMissing(true);
            }

            try {
                const empCodeForFilter = user?.employee_code || user?.username || user?.employee_id || '';
                const response = await api.get(`/api/employees/?employee_code=${empCodeForFilter}`);

                const employees = response.data.results || [];

                const matchedEmployee = employees.find(emp => {
                    const userCode = String(empCodeForFilter).toLowerCase();
                    const userName = String(user?.name || '').toLowerCase();

                    const empCode = String(emp.employee_code || emp.employee?.employee_code || '').toLowerCase();
                    const empName = String(emp.name || emp.employee?.name || '').toLowerCase();

                    return (
                        (userCode && empCode && empCode === userCode) ||
                        (userName && empName && empName === userName)
                    );
                });

                if (matchedEmployee) {
                    setProfileData(matchedEmployee);
                } else {
                    console.warn("User not found in employee list for code:", user?.username);
                }
            } catch (err) {
                setError('Failed to load detailed profile data.');
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchProfile();
        }
    }, [user]);

    if (!user) {
        return <div className="loading-state">Please log in to view your profile.</div>;
    }



    const displayData = profileData ? {
        employee: {
            name: profileData.name || profileData.employee?.name || user?.name || '',
            employee_code: profileData.employee_code || profileData.employee?.employee_code || user?.username || '',
            phone: profileData.phone || profileData.employee?.phone || user?.phone || '',
            email: profileData.email || profileData.employee?.email || user?.email || '',
            photo: profileData.photo || profileData.employee?.photo || null
        },
        position: {
            name: (() => {
                if (user?.active_position_id && profileData.positions_details) {
                    const activePos = profileData.positions_details.find(p => String(p.id) === String(user.active_position_id));
                    if (activePos) return activePos.name || activePos.role_name || '';
                }
                return profileData.role || profileData.position?.name || user?.role || '';
            })(),
            department: (() => {
                if (user?.active_position_id && profileData.positions_details) {
                    const activePos = profileData.positions_details.find(p => String(p.id) === String(user.active_position_id));
                    if (activePos) return activePos.department_name || activePos.department || '';
                }
                return profileData.department || profileData.position?.department || '';
            })(),
            section: (() => {
                if (user?.active_position_id && profileData.positions_details) {
                    const activePos = profileData.positions_details.find(p => String(p.id) === String(user.active_position_id));
                    if (activePos) return activePos.section_name || activePos.section || '';
                }
                return profileData.section || profileData.position?.section || '';
            })(),
            reporting_to: (() => {
                if (user?.active_position_id && profileData.positions_details) {
                    const activePos = profileData.positions_details.find(p => String(p.id) === String(user.active_position_id));
                    if (activePos && activePos.reporting_to) return activePos.reporting_to;
                }
                return (profileData.positions_details && profileData.positions_details[0]?.reporting_to) || 
                       profileData.reporting_to || 
                       profileData.position?.reporting_to || [];
            })()
        },
        project: {
            name: profileData.project?.name || '',
            code: profileData.project?.code || (() => {
                // External API only provides project_name, not project_code.
                // Derive a readable code from the project name if no code is available.
                const pName = profileData.project?.name || '';
                if (!pName) return '';
                // Try to extract a numeric part (e.g. '104 Project' → 'PROJ-104')
                const numMatch = pName.match(/(\d+)/);
                return numMatch ? `PROJ-${numMatch[1]}` : pName.slice(0, 6).toUpperCase();
            })()
        },
        office: {
            name: profileData.office?.name || '',
            level: profileData.office?.level || '',
            geo_location: profileData.office?.geo_location || {
                district: '',
                state: '',
                country: ''
            }
        }
    } : {
        employee: {
            name: user?.name || '',
            employee_code: user?.username || user?.employee_id || '',
            phone: user?.phone || '',
            email: user?.email || '',
            photo: null
        },
        position: {
            name: user?.role || '',
            department: '',
            section: '',
            reporting_to: []
        },
        project: {
            name: '',
            code: ''
        },
        office: {
            name: '',
            level: '',
            geo_location: {
                district: '',
                state: '',
                country: ''
            }
        }
    };

    return (
        <div className="dashboard-page">
            <div className="dashboard-header-row">
                <div>
                    <h1 className="welcome-text">My Profile</h1>
                </div>
                <div className="header-actions">
                </div>
            </div>

            <div className="profile-container">
                {/* Left Column: Identity Card */}
                <div className="profile-sidebar">
                    <div className="premium-card identity-card">
                        <div className="card-body">
                            <div className="avatar-wrapper">
                                {displayData.employee.photo ? (
                                    <img src={displayData.employee.photo} alt={displayData.employee.name} />
                                ) : (
                                    <div className="avatar-placeholder">
                                        <User size={64} strokeWidth={1.5} />
                                    </div>
                                )}
                                <span className="status-indicator active" title="Active"></span>
                            </div>

                            <h2 className="profile-name">{displayData.employee.name}</h2>
                            <p className="profile-designation">{displayData.position.name}</p>

                            <div className="profile-badges">
                                <span className="badge-pill">
                                    <Hash size={14} />
                                    {displayData.employee.employee_code}
                                </span>
                                <span className="badge-pill">
                                    <Building2 size={14} />
                                    {displayData.position.department}
                                </span>
                            </div>

                            <div className="divider"></div>

                            <div className="contact-list">
                                <div className="contact-row">
                                    <div className="icon-box">
                                        <Mail size={16} />
                                    </div>
                                    <div className="contact-details">
                                        <label>Email</label>
                                        <div className="value">{displayData.employee.email || '--'}</div>
                                    </div>
                                </div>
                                <div className="contact-row">
                                    <div className="icon-box">
                                        <Phone size={16} />
                                    </div>
                                    <div className="contact-details">
                                        <label>Phone</label>
                                        <div className="value">{displayData.employee.phone}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Information Details */}
                <div className="profile-content">

                    {/* Organization Details */}
                    <div className="premium-card info-card">
                        <div className="card-header-styled">
                            <div className="header-icon primary-gradient">
                                <Briefcase size={20} />
                            </div>
                            <h3>Organization Details</h3>
                        </div>
                        <div className="card-body">
                            <div className="info-grid">
                                <div className="info-item">
                                    <label>Department</label>
                                    <div className="info-value">{displayData.position.department}</div>
                                </div>
                                <div className="info-item">
                                    <label>Section</label>
                                    <div className="info-value">{displayData.position.section}</div>
                                </div>
                                <div className="info-item">
                                    <label>Project Name</label>
                                    <div className="info-value">{displayData.project.name}</div>
                                </div>
                                <div className="info-item">
                                    <label>Project Code</label>
                                    <div className="info-value">{displayData.project.code || 'N/A'}</div>
                                </div>
                                <div className="info-item full-width">
                                    <label>Reporting Manager(s)</label>
                                    <div className="info-value managers-list">
                                        {displayData.position.reporting_to && displayData.position.reporting_to.length > 0 ? (
                                            displayData.position.reporting_to.map((manager, idx) => {
                                                const name = manager.employee_name || manager.name || 'Unknown';
                                                const role = manager.position_name || manager.role_name || '';
                                                return (
                                                    <div key={idx} className="manager-chip">
                                                        <div className="chip-avatar">{name.charAt(0).toUpperCase()}</div>
                                                        <div className="chip-info">
                                                            <span className="chip-name">{name}</span>
                                                            <span className="chip-role">{role}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <span className="text-muted">None Assigned</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Location Details */}
                    <div className="premium-card info-card">
                        <div className="card-header-styled">
                            <div className="header-icon secondary-gradient">
                                <MapPin size={20} />
                            </div>
                            <h3>Work Location</h3>
                        </div>
                        <div className="card-body">
                            <div className="info-grid">
                                <div className="info-item">
                                    <label>Office Name</label>
                                    <div className="info-value">{displayData.office.name}</div>
                                </div>
                                <div className="info-item">
                                    <label>Base Level</label>
                                    <div className="info-value">{displayData.office.level}</div>
                                </div>
                                <div className="info-item">
                                    <label>District</label>
                                    <div className="info-value">{displayData.office.geo_location.district}</div>
                                </div>
                                <div className="info-item">
                                    <label>State, Country</label>
                                    <div className="info-value">
                                        {displayData.office.geo_location.state ? `${displayData.office.geo_location.state}, ` : ''}
                                        {displayData.office.geo_location.country}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>


        </div>
    );
};

export default Profile;
