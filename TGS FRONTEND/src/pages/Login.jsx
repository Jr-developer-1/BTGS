import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/api';
import { Lock, User, Eye, EyeOff, ShieldCheck, Wifi, WifiOff } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isIntro, setIsIntro] = useState(true);
    const [isBackendDown, setIsBackendDown] = useState(false);
    const { login } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const checkConnection = async (silent = false) => {
        try {
            await api.get('/api/health');
            setIsBackendDown(false);
            if (!silent) showToast('Backend connected successfully', 'success');
        } catch (err) {
            setIsBackendDown(true);
            showToast('Backend server is unreachable. Please ensure the backend is running.', 'error');
        }
    };

    useEffect(() => {
        checkConnection(true); // check on mount

        const startTimer = setTimeout(() => {
            const timer = setTimeout(() => {
                setIsIntro(false);
            }, 2500);
            return () => clearTimeout(timer);
        }, 100);

        return () => clearTimeout(startTimer);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!username || !password) {
            setError('Please enter both username and password');
            return;
        }

        setIsLoading(true);
        try {
            const user = await login(username, password);

            if (user.requires_password_change) {
                navigate('/change-password');
                return;
            }

            switch (user.role) {
                case 'admin':
                    navigate('/');
                    break;
                case 'finance':
                    navigate('/');
                    break;
                case 'reporting_authority':
                    navigate('/approvals');
                    break;
                case 'cfo':
                    navigate('/cfo-war-room');
                    break;
                default:
                    navigate('/');
            }
        } catch (err) {
            console.error('Login error detail:', err);
            if (err.message === 'CORRUPT_RESPONSE' || err.code === 'ERR_NOT_JSON') {
                setError('Server configuration error. Received invalid response from backend.');
            } else if (!err.response) {
                setError('Server is unreachable. Please check if the backend is running.');
            } else if (err.response.status === 500) {
                setError(err.response.data?.error || 'Internal Server Error. Please contact support.');
            } else {
                setError(err.response.data?.error || 'Invalid username or password. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`login-container ${isIntro ? 'intro-mode' : ''}`}>
            <div className="login-visual">
                <video
                    className="login-video"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                >
                    <source src="/logo_video.mp4" type="video/mp4" />
                </video>
                <div className="visual-overlay"></div>
                <div className="visual-content">
                    {/* <h1>TGS</h1>
                    <h2>Travel & Expense</h2> */}
                </div>
            </div>
            <div className="login-form-area">
                <div className="login-card">
                    <div className="login-header">
                        <div className="app-logo">
                            <img src="/bavya.png" alt="Logo" className="login-logo-img" />
                        </div>
                        <div className="connection-status-area" style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                            {isBackendDown ? (
                                <div onClick={() => checkConnection()} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>
                                    <WifiOff size={16} />
                                    <span>Backend Offline - Click to Retry</span>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', backgroundColor: '#f0fdf4', color: '#16a34a', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>
                                    <Wifi size={16} />
                                    <span>Server Connected</span>
                                </div>
                            )}
                        </div>
                        <h3>Welcome Back</h3>
                        <p>Sign in to your corporate account</p>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        {error && <div className="login-error">{error}</div>}

                        <div className="form-group">
                            <label className="form-label">Username</label>
                            <div className="input-with-icon">
                                <User size={18} className="field-icon" />
                                <input
                                    type="text"
                                    placeholder="Enter your username"
                                    value={username}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^a-zA-Z0-9\-]/g, '');
                                        setUsername(val.toUpperCase());
                                    }}
                                    maxLength={20}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <div className="input-with-icon">
                                <Lock size={18} className="field-icon" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    maxLength={15}
                                    onPaste={(e) => e.preventDefault()}
                                    onCopy={(e) => e.preventDefault()}
                                    required
                                />
                                <button
                                    type="button"
                                    className="eye-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="login-options">
                            <Link to="/forgot-password" className="forgot-pwd">Forgot password?</Link>
                        </div>

                        <button type="submit" className="login-btn" disabled={isLoading}>
                            {isLoading ? 'Authenticating...' : 'Sign In to Dashboard'}
                        </button>
                    </form>

                    <div className="login-footer">
                        <p className="login-contact-text">Don't have an account? <strong>Contact HR</strong></p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
