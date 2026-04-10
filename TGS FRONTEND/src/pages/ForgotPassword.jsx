import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import api from '../api/api';
import { Mail, ArrowLeft, ArrowRight, ShieldCheck, User, Lock, KeyRound, Eye, EyeOff, Check, X, ShieldAlert } from 'lucide-react';

const ForgotPassword = () => {
    const { showToast } = useToast();
    const navigate = useNavigate();

    // Step management: 1 = Request OTP, 2 = Verify OTP & Reset
    const [step, setStep] = useState(1);

    // Form fields
    const [employeeId, setEmployeeId] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Validation States
    const [validations, setValidations] = useState({
        length: false,
        uppercase: false,
        number: false,
        special: false
    });

    useEffect(() => {
        setValidations({
            length: newPassword.length >= 8 && newPassword.length <= 12,
            uppercase: /[A-Z]/.test(newPassword),
            number: /[0-9]/.test(newPassword),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
        });
    }, [newPassword]);

    const allValid = Object.values(validations).every(Boolean);

    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setError('');

        if (!employeeId) {
            setError('Please enter your Employee ID');
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/api/auth/request-otp', {
                employee_id: employeeId
            });

            showToast('6-digit OTP sent securely to your email.', 'success');
            setStep(2);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Failed to process request. Ensure ID is correct.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');

        if (!otp || otp.length !== 6) {
            setError('Please enter the 6-digit OTP.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (!allValid) {
            setError('Please ensure your new password meets all security requirements.');
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/api/auth/reset-password-otp', {
                employee_id: employeeId,
                otp: otp,
                new_password: newPassword
            });

            showToast('Password has been successfully updated! You can now log in.', 'success');
            setTimeout(() => navigate('/login'), 1500);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Invalid OTP or expired. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="cp-wrapper">
            <style>{`
                /* Premium Styles from ChangePassword included */
                .cp-wrapper {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%);
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    padding: 20px;
                    position: relative;
                    overflow: hidden;
                }
                
                .cp-wrapper::before, .cp-wrapper::after {
                    content: '';
                    position: absolute;
                    width: 600px;
                    height: 600px;
                    border-radius: 50%;
                    filter: blur(80px);
                    z-index: 0;
                    pointer-events: none;
                }
                .cp-wrapper::before {
                    background: rgba(225, 29, 72, 0.15);
                    top: -200px;
                    left: -200px;
                }
                .cp-wrapper::after {
                    background: rgba(59, 130, 246, 0.15);
                    bottom: -200px;
                    right: -200px;
                }

                .cp-card {
                    background: #ffffff;
                    width: 100%;
                    max-width: 520px;
                    border-radius: 24px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.02);
                    z-index: 1;
                    overflow: hidden;
                    animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }

                @keyframes slideUpFade {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .cp-header {
                    background: linear-gradient(135deg, #be123c 0%, #881337 100%);
                    padding: 40px 30px;
                    text-align: center;
                    color: white;
                    position: relative;
                }
                
                .cp-header-icon {
                    width: 64px;
                    height: 64px;
                    background: rgba(255, 255, 255, 0.2);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    box-shadow: 0 8px 16px rgba(0,0,0,0.1);
                    border: 1px solid rgba(255,255,255,0.3);
                }

                .cp-header h2 {
                    margin: 0;
                    font-size: 26px;
                    font-weight: 700;
                    letter-spacing: -0.5px;
                }

                .cp-header p {
                    margin: 10px 0 0;
                    color: rgba(255, 255, 255, 0.85);
                    font-size: 15px;
                    line-height: 1.5;
                }

                .cp-body {
                    padding: 40px 30px;
                }

                .cp-error {
                    background: #fef2f2;
                    border-left: 4px solid #ef4444;
                    color: #991b1b;
                    padding: 14px 16px;
                    border-radius: 8px;
                    font-size: 14px;
                    margin-bottom: 24px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
                }

                @keyframes shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0); }
                    20%, 80% { transform: translate3d(2px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                    40%, 60% { transform: translate3d(4px, 0, 0); }
                }

                .cp-form-group {
                    margin-bottom: 24px;
                    position: relative;
                }

                .cp-label {
                    display: block;
                    font-size: 13px;
                    font-weight: 600;
                    color: #475569;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .cp-input-container {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .cp-input-icon {
                    position: absolute;
                    left: 16px;
                    color: #94a3b8;
                    transition: color 0.2s;
                }

                .cp-input {
                    width: 100%;
                    padding: 14px 16px 14px 46px !important;
                    font-size: 15px !important;
                    color: #0f172a;
                    background: #f8fafc;
                    border: 2px solid #e2e8f0;
                    border-radius: 12px;
                    transition: all 0.2s ease;
                    outline: none;
                    box-sizing: border-box;
                }

                .cp-input.text-center {
                    text-align: center;
                    letter-spacing: 4px;
                    font-weight: bold;
                    padding: 14px 16px 14px 46px !important;
                }

                .cp-input:focus {
                    background: #ffffff;
                    border-color: #be123c;
                    box-shadow: 0 0 0 4px rgba(190, 18, 60, 0.1);
                }

                .cp-input:focus + .cp-input-icon {
                    color: #be123c;
                }

                .cp-eye-btn {
                    position: absolute;
                    right: 16px;
                    background: none;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                    border-radius: 50%;
                    transition: all 0.2s;
                }

                .cp-eye-btn:hover {
                    color: #475569;
                    background: #f1f5f9;
                }

                .cp-rules {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 16px;
                    margin-top: -8px;
                    margin-bottom: 24px;
                }

                .cp-rules-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: #475569;
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .cp-rule-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13.5px;
                    margin-bottom: 8px;
                    color: #64748b;
                    transition: all 0.3s ease;
                }
                
                .cp-rule-item:last-child {
                    margin-bottom: 0;
                }

                .cp-rule-item.valid {
                    color: #16a34a;
                    font-weight: 500;
                }

                .cp-rule-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #e2e8f0;
                    color: #94a3b8;
                    transition: all 0.3s ease;
                }

                .cp-rule-item.valid .cp-rule-icon {
                    background: #dcfce7;
                    color: #16a34a;
                }

                .cp-submit-btn {
                    width: 100%;
                    padding: 16px;
                    background: linear-gradient(135deg, #be123c 0%, #9f1239 100%);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    transition: all 0.3s ease;
                    box-shadow: 0 10px 15px -3px rgba(190, 18, 60, 0.3);
                }

                .cp-submit-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 15px 20px -3px rgba(190, 18, 60, 0.4);
                    background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
                }

                .cp-submit-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                    transform: none;
                }

                .cp-back-link {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    margin-top: 24px;
                    color: #64748b;
                    font-size: 14px;
                    font-weight: 500;
                    text-decoration: none;
                    transition: color 0.2s;
                }

                .cp-back-link:hover {
                    color: #be123c;
                }
            `}</style>
            
            <div className="cp-card">
                <div className="cp-header">
                    <div className="cp-header-icon">
                        <Mail size={32} color="white" />
                    </div>
                    <h2>Password Recovery</h2>
                    <p>
                        {step === 1 
                            ? "Enter your corporate Employee ID to receive a secure 6-digit OTP." 
                            : `An OTP was sent to your email. Please verify and pick a strong password.`}
                    </p>
                </div>

                <div className="cp-body">
                    {step === 1 ? (
                        <form onSubmit={handleRequestOtp}>
                            {error && (
                                <div className="cp-error">
                                    <ShieldAlert size={20} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="cp-form-group">
                                <label className="cp-label">Employee ID</label>
                                <div className="cp-input-container">
                                    <User size={18} className="cp-input-icon" />
                                    <input
                                        type="text"
                                        className="cp-input"
                                        placeholder="e.g. EMP12345"
                                        value={employeeId}
                                        onChange={(e) => setEmployeeId(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                className="cp-submit-btn" 
                                disabled={isLoading || !employeeId}
                            >
                                {isLoading ? 'Sending OTP...' : (
                                    <>
                                        Send OTP & Continue
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>

                            <Link to="/login" className="cp-back-link">
                                <ArrowLeft size={16} />
                                Back to Login
                            </Link>
                        </form>
                    ) : (
                        <form onSubmit={handleResetPassword}>
                            {error && (
                                <div className="cp-error">
                                    <ShieldAlert size={20} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="cp-form-group">
                                <label className="cp-label">6-Digit OTP</label>
                                <div className="cp-input-container">
                                    <KeyRound size={18} className="cp-input-icon" />
                                    <input
                                        type="text"
                                        className="cp-input text-center"
                                        placeholder="------"
                                        maxLength={6}
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="cp-form-group">
                                <label className="cp-label">New Secure Password</label>
                                <div className="cp-input-container">
                                    <Lock size={18} className="cp-input-icon" />
                                    <input
                                        type={showNew ? "text" : "password"}
                                        className="cp-input"
                                        placeholder="Create a strong password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                    />
                                    <button type="button" className="cp-eye-btn" onClick={() => setShowNew(!showNew)}>
                                        {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Real-time Validation Rules */}
                            {newPassword.length > 0 && (
                                <div className="cp-rules">
                                    <div className="cp-rules-title">Password Strength Requirements</div>
                                    <div className={`cp-rule-item ${validations.length ? 'valid' : ''}`}>
                                        <div className="cp-rule-icon">{validations.length ? <Check size={14} strokeWidth={3} /> : <X size={14} />}</div>
                                        <span>Between 8 and 12 characters completely</span>
                                    </div>
                                    <div className={`cp-rule-item ${validations.uppercase ? 'valid' : ''}`}>
                                        <div className="cp-rule-icon">{validations.uppercase ? <Check size={14} strokeWidth={3} /> : <X size={14} />}</div>
                                        <span>At least one uppercase letter (A-Z)</span>
                                    </div>
                                    <div className={`cp-rule-item ${validations.number ? 'valid' : ''}`}>
                                        <div className="cp-rule-icon">{validations.number ? <Check size={14} strokeWidth={3} /> : <X size={14} />}</div>
                                        <span>At least one numeric digit (0-9)</span>
                                    </div>
                                    <div className={`cp-rule-item ${validations.special ? 'valid' : ''}`}>
                                        <div className="cp-rule-icon">{validations.special ? <Check size={14} strokeWidth={3} /> : <X size={14} />}</div>
                                        <span>At least one special character (!@#$%^&*)</span>
                                    </div>
                                </div>
                            )}

                            <div className="cp-form-group">
                                <label className="cp-label">Confirm New Password</label>
                                <div className="cp-input-container">
                                    <Lock size={18} className="cp-input-icon" />
                                    <input
                                        type={showConfirm ? "text" : "password"}
                                        className="cp-input"
                                        placeholder="Re-enter your new password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                    />
                                    <button type="button" className="cp-eye-btn" onClick={() => setShowConfirm(!showConfirm)}>
                                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                className="cp-submit-btn" 
                                disabled={isLoading || otp.length !== 6 || (newPassword.length > 0 && !allValid)}
                            >
                                {isLoading ? 'Updating...' : (
                                    <>
                                        Verify & Reset Password
                                        <ShieldCheck size={18} />
                                    </>
                                )}
                            </button>
                            
                            <button 
                                type="button" 
                                onClick={() => setStep(1)}
                                className="cp-back-link" 
                                style={{ background: 'none', border: 'none', cursor: 'pointer', margin: '24px auto 0' }}
                            >
                                <ArrowLeft size={16} />
                                Back to Employee ID
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
