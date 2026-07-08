import React, { useState, useEffect } from 'react';
import {
    FolderOpen,
    X,
    FileText,
    ShieldCheck,
    CreditCard,
    CheckCircle2,
    AlertCircle,
    Info,
    Upload,
    Building2,
    Briefcase,
    Car,
    Globe
} from 'lucide-react';
import api from '../api/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';



const DocumentOrganizer = ({ isOpen, onClose }) => {
    const { showToast } = useToast();
    const { user } = useAuth();
    const [docs, setDocs] = useState({
        aadharId: '',
        companyId: '',
        drivingLicense: '',
        pan: '',
        passport: '',
        gstNo: '',
        rc: '',
        insurance: '',
        pollution: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    // Fetch existing docs if any
    useEffect(() => {
        if (isOpen && user?.employee_id) {
            const fetchDocs = async () => {
                try {
                    const response = await api.get('/api/auth/documents');
                    if (response.data) {
                        const backendDocs = response.data;
                        setDocs({
                            aadharId: backendDocs.aadharId?.val || '',
                            companyId: backendDocs.companyId?.val || '',
                            drivingLicense: backendDocs.drivingLicense?.val || '',
                            pan: backendDocs.pan?.val || '',
                            passport: backendDocs.passport?.val || '',
                            gstNo: backendDocs.gstNo?.val || '',
                            rc: backendDocs.rc?.val || '',
                            insurance: backendDocs.insurance?.val || '',
                            pollution: backendDocs.pollution?.val || ''
                        });
                    }
                } catch (error) {
                    console.error("Failed to fetch documents in modal", error);
                    const savedDocs = sessionStorage.getItem(`user_docs_${user.employee_id}`);
                    if (savedDocs) {
                        setDocs(JSON.parse(savedDocs));
                    }
                }
            };
            fetchDocs();
        }
    }, [isOpen, user?.employee_id]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        setDocs(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Fetch latest user documents to preserve file scan data
            let currentDocs = {};
            try {
                const response = await api.get('/api/auth/documents');
                if (response.data) currentDocs = response.data;
            } catch (e) {
                if (user?.employee_id) {
                    const saved = sessionStorage.getItem(`user_documents_${user.employee_id}`);
                    if (saved) currentDocs = JSON.parse(saved);
                }
            }

            // Merge text changes
            const updatedDocs = { ...currentDocs };
            Object.keys(docs).forEach(key => {
                if (updatedDocs[key]) {
                    updatedDocs[key] = {
                        ...updatedDocs[key],
                        val: docs[key]
                    };
                } else {
                    updatedDocs[key] = {
                        val: docs[key],
                        file: null,
                        fileName: ''
                    };
                }
            });

            await api.post('/api/auth/documents', updatedDocs);

            if (user?.employee_id) {
                sessionStorage.setItem(`user_docs_${user.employee_id}`, JSON.stringify(docs));
                sessionStorage.setItem(`user_documents_${user.employee_id}`, JSON.stringify(updatedDocs));
            }
            showToast("Documents updated successfully", "success");
            setTimeout(onClose, 1000);
        } catch (error) {
            showToast("Failed to update documents", "error");
        } finally {
            setIsSaving(false);
        }
    };


    if (!isOpen) return null;

    return (
        <div className="doc-organizer-overlay" onClick={onClose}>
            <div className="doc-organizer-modal glass animate-fade-in" onClick={e => e.stopPropagation()}>
                <div className="doc-modal-header">
                    <div className="header-title-box">
                        <FolderOpen className="icon-magenta" size={24} />
                        <div>
                            <h2>Document Organizer</h2>
                            <p>Manage your mandatory and secondary travel credentials.</p>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="doc-modal-body">
                    <div className="doc-section">
                        <div className="section-label">
                            <ShieldCheck className="icon-green" size={18} />
                            <h3>Mandatory Credentials</h3>
                        </div>
                        <div className="doc-grid">
                            <div className="doc-input-field">
                                <label>Aadhar ID / National ID</label>
                                <div className="input-group">
                                    <CreditCard size={16} />
                                    <input
                                        name="aadharId"
                                        placeholder="Enter Aadhar Number"
                                        value={docs.aadharId}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            <div className="doc-input-field">
                                <label>Company ID Card No.</label>
                                <div className="input-group">
                                    <Briefcase size={16} />
                                    <input
                                        name="companyId"
                                        placeholder="Enter Employee ID"
                                        value={docs.companyId}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="doc-section mt-4">
                        <div className="section-label">
                            <Car style={{ color: '#E11D48' }} size={18} />
                            <h3>Travel Compliance Credentials</h3>
                        </div>
                        <div className="doc-grid triple">
                            <div className="doc-input-field">
                                <label>Driving License</label>
                                <input
                                    name="drivingLicense"
                                    placeholder="License No."
                                    value={docs.drivingLicense}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="doc-input-field">
                                <label>RC Number</label>
                                <input
                                    name="rc"
                                    placeholder="Registration No."
                                    value={docs.rc}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="doc-input-field">
                                <label>Insurance Policy</label>
                                <input
                                    name="insurance"
                                    placeholder="Policy No."
                                    value={docs.insurance}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="doc-input-field">
                                <label>Pollution Certificate</label>
                                <input
                                    name="pollution"
                                    placeholder="Certificate No."
                                    value={docs.pollution}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="doc-section mt-4">
                        <div className="section-label">
                            <FileText className="icon-blue" size={18} />
                            <h3>Additional Documents</h3>
                        </div>
                        <div className="doc-grid">
                            <div className="doc-input-field">
                                <label>PAN Account</label>
                                <input
                                    name="pan"
                                    placeholder="Permanent Account No."
                                    value={docs.pan}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="doc-input-field">
                                <label>Passport No.</label>
                                <input
                                    name="passport"
                                    placeholder="Enter Passport No."
                                    value={docs.passport}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="doc-section mt-4">
                        <div className="section-label">
                            <Building2 className="icon-orange" size={18} />
                            <h3>Business Registration</h3>
                        </div>
                        <div className="doc-input-field single">
                            <label>Personal GST Number (if applicable)</label>
                            <div className="input-group">
                                <Building2 size={16} />
                                <input
                                    name="gstNo"
                                    placeholder="Enter GSTIN"
                                    value={docs.gstNo}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="doc-notice info mt-4">
                        <Info size={16} />
                        <p>These documents are used to pre-fill hotel reservations and flight bookings during the trip lifecycle.</p>
                    </div>
                </div>

                <div className="doc-modal-footer">
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className={`btn-primary ${isSaving ? 'loading' : ''}`} onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Synchronizing...' : 'Save Organizer'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DocumentOrganizer;
