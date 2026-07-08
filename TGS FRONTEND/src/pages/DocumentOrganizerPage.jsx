import React, { useState, useEffect, useRef } from 'react';
import {
    FolderPlus,
    ShieldCheck,
    FileText,
    Building2,
    Upload,
    Eye,
    Trash2,
    CheckCircle2,
    AlertCircle,
    CreditCard,
    Briefcase,
    Globe,
    Car,
    Info,
    Camera,
    Ticket,
    PlusCircle,
    X
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import api from '../api/api';



const DocumentCard = ({
    id, label, icon, placeholder,
    type = 'mandatory', showInput = false, isTripDoc = false,
    doc, isAdmin,
    onTextChange, onFileChange, onRemoveFile,
    onUpdateTripTitle, onDeleteTripDoc, onViewDoc
}) => {
    const isVerified = !!doc?.file;
    const fileInputRef = useRef(null);

    return (
        <div className={`doc-premium-card ${isVerified ? 'has-content' : ''} ${type}`}>
            {isTripDoc && (
                <button className="delete-card-btn" onClick={() => onDeleteTripDoc(id)}>
                    <X size={14} />
                </button>
            )}
            <div className="card-badge">
                {isVerified
                    ? <CheckCircle2 size={14} />
                    : (type === 'mandatory' ? <AlertCircle size={14} /> : <Info size={14} />)
                }
                <span>{isVerified ? 'Verified' : (type === 'mandatory' ? 'Required' : 'Optional')}</span>
            </div>

            <div className="card-header">
                <div className="icon-box" style={{ color: '#A50021' }}>{icon}</div>
                <div className="title-box">
                    {isTripDoc ? (
                        <input
                            className="dynamic-title-input"
                            placeholder="Enter Title (e.g. Flight Ticket)"
                            value={doc?.title || ''}
                            onChange={(e) => onUpdateTripTitle(id, e.target.value)}
                        />
                    ) : (
                        <h4>{label}{type === 'mandatory' && <span className="star-mark">*</span>}</h4>
                    )}
                    <p>{doc?.fileName || 'No file uploaded'}</p>
                </div>
            </div>

            <div className="card-body">
                {showInput && !isTripDoc && (
                    <div className="input-group-premium" style={{ marginBottom: '1rem' }}>
                        <label>{label} Number</label>
                        <input
                            type="text"
                            placeholder={placeholder}
                            value={doc?.val || ''}
                            onChange={(e) => onTextChange(id, e.target.value)}
                        />
                    </div>
                )}

                {!doc?.file ? (
                    <div className="upload-container">
                        {(!isTripDoc && id === 'gstNo' && !isAdmin) ? (
                            <div className="upload-zone disabled">
                                <ShieldCheck size={20} />
                                <span>Only Admin can upload GSTIN</span>
                            </div>
                        ) : (
                            <div className="upload-zone" onClick={() => fileInputRef.current.click()}>
                                <input
                                    type="file"
                                    hidden
                                    ref={fileInputRef}
                                    onChange={(e) => onFileChange(id, e, isTripDoc)}
                                />
                                <Upload size={20} />
                                <span>Upload Document Scan</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="uploaded-success-body">
                        <div className="preview-container">
                            {doc.file.startsWith('data:image/')
                                ? <img src={doc.file} alt="Preview" />
                                : <iframe src={doc.file} title="Preview" />
                            }
                        </div>
                        <div className="file-actions">
                            <button className="btn-preview" onClick={() =>
                                onViewDoc({ file: doc.file, title: isTripDoc ? (doc.title || 'Document') : label })
                            }>
                                <Eye size={16} /> View
                            </button>
                            {(!(!isTripDoc && id === 'gstNo' && !isAdmin)) && (
                                <button className="btn-remove" onClick={() => onRemoveFile(id, isTripDoc)}>
                                    <Trash2 size={16} /> Remove
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


const DocumentOrganizerPage = () => {
    const { showToast, confirm } = useToast();
    const { user } = useAuth();

    const isAdmin = ['admin', 'it-admin', 'superuser', 'it admin', 'system administrator', 'system-admin', 'system setup admin']
        .includes(user?.role?.toLowerCase());

    const [docs, setDocs] = useState({
        aadharId:       { val: '', file: null, fileName: '' },
        companyId:      { val: '', file: null, fileName: '' },
        drivingLicense: { val: '', file: null, fileName: '' },
        pan:            { val: '', file: null, fileName: '' },
        passport:       { val: '', file: null, fileName: '' },
        gstNo:          { val: '', file: null, fileName: '' },
        rc:             { val: '', file: null, fileName: '' },
        insurance:      { val: '', file: null, fileName: '' },
        pollution:      { val: '', file: null, fileName: '' }
    });

    const [tripDocs, setTripDocs] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [viewingDoc, setViewingDoc] = useState(null);

    useEffect(() => {
        if (!user?.employee_id) return;

        const fetchDocs = async () => {
            try {
                const response = await api.get('/api/auth/documents');
                if (response.data) {
                    setDocs(response.data);
                }
            } catch (error) {
                console.error("Failed to fetch documents from server, loading from cache", error);
                const userKey = `user_documents_${user.employee_id}`;
                const savedDocs = sessionStorage.getItem(userKey);
                if (savedDocs) {
                    try { setDocs(JSON.parse(savedDocs)); } catch (e) { console.error(e); }
                }
            }
        };

        fetchDocs();

        const tripKey = `user_trip_documents_${user.employee_id}`;
        const savedTripDocs = sessionStorage.getItem(tripKey);
        if (savedTripDocs) {
            try { setTripDocs(JSON.parse(savedTripDocs)); } catch (e) { console.error(e); }
        } else {
            setTripDocs([]);
        }
    }, [user?.employee_id]);


    const handleTextChange = (key, value) => {
        setDocs(prev => {
            const next = { ...prev, [key]: { ...prev[key], val: value } };
            safeSetDocCache(next);
            return next;
        });
    };

    // Safely persist documents to sessionStorage WITHOUT the base64 file data
    // to avoid QuotaExceededError (sessionStorage limit ~5 MB).
    // File blobs live only in React state; only val + fileName are cached.
    const safeSetDocCache = (docsObj) => {
        if (!user?.employee_id) return;
        try {
            const lightweight = {};
            Object.keys(docsObj).forEach(k => {
                const { file, ...rest } = docsObj[k];
                lightweight[k] = rest; // strip base64 blob
            });
            sessionStorage.setItem(`user_documents_${user.employee_id}`, JSON.stringify(lightweight));
        } catch (e) {
            // QuotaExceededError or other storage errors — silently ignore
            console.warn('sessionStorage quota exceeded; document metadata not cached:', e);
        }
    };

    const safeSetTripDocCache = (tripDocsArr) => {
        if (!user?.employee_id) return;
        try {
            const lightweight = tripDocsArr.map(({ file, ...rest }) => rest);
            sessionStorage.setItem(`user_trip_documents_${user.employee_id}`, JSON.stringify(lightweight));
        } catch (e) {
            console.warn('sessionStorage quota exceeded; trip document metadata not cached:', e);
        }
    };

    const handleFileChange = (key, e, isTripDoc = false) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            if (isTripDoc) {
                setTripDocs(prev => {
                    const next = prev.map(d => d.id === key ? { ...d, file: reader.result, fileName: file.name } : d);
                    safeSetTripDocCache(next);
                    return next;
                });
            } else {
                setDocs(prev => {
                    const next = { ...prev, [key]: { ...prev[key], file: reader.result, fileName: file.name } };
                    safeSetDocCache(next);
                    return next;
                });
            }
            showToast(`${file.name} uploaded successfully`, 'success');
        };
        reader.readAsDataURL(file);
    };

    const removeFile = async (key, isTripDoc = false) => {
        const confirmed = await confirm('Are you sure you want to remove this document?');
        if (!confirmed) return;

        if (isTripDoc) {
            setTripDocs(prev => {
                const next = prev.map(d => d.id === key ? { ...d, file: null, fileName: '' } : d);
                safeSetTripDocCache(next);
                return next;
            });
        } else {
            setDocs(prev => {
                const next = { ...prev, [key]: { ...prev[key], file: null, fileName: '' } };
                safeSetDocCache(next);
                return next;
            });
        }
    };

    const addTripDoc = () => {
        const newDoc = { id: Date.now(), title: '', val: '', file: null, fileName: '' };
        setTripDocs(prev => [...prev, newDoc]);
    };

    const updateTripTitle = (id, title) => {
        setTripDocs(prev => {
            const next = prev.map(d => d.id === id ? { ...d, title } : d);
            safeSetTripDocCache(next);
            return next;
        });
    };

    const deleteTripDoc = async (id) => {
        const confirmed = await confirm('Are you sure you want to delete this trip document?');
        if (!confirmed) return;

        setTripDocs(prev => {
            const next = prev.filter(d => d.id !== id);
            safeSetTripDocCache(next);
            return next;
        });
    };

    const handleSave = async () => {
        if (!user?.employee_id) {
            showToast('User session not found. Please log in again.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            await api.post('/api/auth/documents', docs);
            safeSetDocCache(docs);
            safeSetTripDocCache(tripDocs);
            showToast('Repository synchronized successfully with server!', 'success');
        } catch (error) {
            console.error("Failed to sync documents with server:", error);
            showToast('Failed to sync repository with server. Saved to local cache.', 'warning');
            safeSetDocCache(docs);
            safeSetTripDocCache(tripDocs);
        } finally {
            setIsSaving(false);
        }
    };


    // Shared props passed to every DocumentCard
    const cardProps = {
        isAdmin,
        onTextChange: handleTextChange,
        onFileChange: handleFileChange,
        onRemoveFile: removeFile,
        onUpdateTripTitle: updateTripTitle,
        onDeleteTripDoc: deleteTripDoc,
        onViewDoc: setViewingDoc,
    };

    return (
        <div className="doc-page-container animate-fade-in">
            <div className="doc-page-header">
                <div className="header-content">
                    <FolderPlus size={32} style={{ color: '#A50021' }} />
                    <div className="title-area"><h1>Document Organizer</h1></div>
                </div>
                <button className={`sync-btn ${isSaving ? 'loading' : ''}`} onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Synchronizing...' : 'Save & Sync Repository'}
                    {!isSaving && <CheckCircle2 size={18} />}
                </button>
            </div>

            <div className="doc-sections-grid">
                <div className="doc-grid-section">
                    <div className="section-title"><ShieldCheck className="icon-green" size={20} /><h3>Identity Documents</h3></div>
                    <div className="cards-wrapper">
                        <DocumentCard id="aadharId"  label="Aadhar ID"       icon={<CreditCard size={20} />} placeholder="12-digit UIDAI Number" doc={docs.aadharId}  {...cardProps} />
                        <DocumentCard id="companyId" label="Company ID Card" icon={<Briefcase size={20} />} placeholder="Employee Code"          doc={docs.companyId} {...cardProps} />
                    </div>
                </div>

                <div className="doc-grid-section">
                    <div className="section-title"><Car style={{ color: '#E11D48' }} size={20} /><h3>Travel Compliance Documents</h3></div>
                    <div className="cards-wrapper triple">
                        <DocumentCard id="drivingLicense" label="Driving License" icon={<Car size={20} />} placeholder="License Number" type="mandatory" doc={docs.drivingLicense} {...cardProps} />
                        <DocumentCard id="rc" label="RC Copy" icon={<FileText size={20} />} placeholder="RC Number" type="mandatory" doc={docs.rc} {...cardProps} />
                        <DocumentCard id="insurance" label="Insurance Copy" icon={<ShieldCheck size={20} />} placeholder="Policy Number" type="mandatory" doc={docs.insurance} {...cardProps} />
                        <DocumentCard id="pollution" label="Pollution Certificate" icon={<Globe size={20} />} placeholder="Certificate Number" type="mandatory" doc={docs.pollution} {...cardProps} />
                    </div>
                </div>

                <div className="doc-grid-section">
                    <div className="section-title"><FileText className="icon-blue" size={20} /><h3>Additional Documents</h3></div>
                    <div className="cards-wrapper">
                        <DocumentCard id="pan" label="PAN Card" icon={<CreditCard size={20} />} placeholder="Alphanumeric PAN" type="optional" doc={docs.pan} {...cardProps} />
                        <DocumentCard id="passport" label="Passport" icon={<Globe size={20} />} placeholder="Passport Number" type="optional" doc={docs.passport} {...cardProps} />
                    </div>
                </div>

                <div className="doc-grid-section">
                    <div className="section-title"><Ticket size={20} style={{ color: '#A50021' }} /><h3>Trip Documents</h3></div>
                    <div className="cards-wrapper">
                        {tripDocs.map(td => (
                            <DocumentCard
                                key={td.id}
                                id={td.id}
                                label={td.title}
                                icon={<Ticket size={20} />}
                                isTripDoc={true}
                                type="optional"
                                doc={td}
                                {...cardProps}
                            />
                        ))}
                        <div className="add-doc-card-placeholder" onClick={addTripDoc}>
                            <div className="add-doc-circle"><PlusCircle size={32} /></div>
                            <span>Add New Trip Document</span>
                        </div>
                    </div>
                </div>

                <div className="doc-grid-section mb-5">
                    <div className="section-title"><Building2 className="icon-orange" size={20} /><h3>Company GST</h3></div>
                    <div className="cards-wrapper">
                        <DocumentCard
                            id="gstNo" label="Personal GSTIN"
                            icon={<Building2 size={20} />}
                            placeholder="GST Identification Number"
                            type="optional" showInput={true}
                            doc={docs.gstNo}
                            {...cardProps}
                        />
                    </div>
                </div>
            </div>

            <Modal
                isOpen={!!viewingDoc}
                onClose={() => setViewingDoc(null)}
                title={viewingDoc?.title || 'Document Viewer'}
                size="xl"
            >
                <div className="doc-viewer-container">
                    {viewingDoc?.file.startsWith('data:image/') ? (
                        <img src={viewingDoc.file} alt="Preview" className="modal-preview-img" />
                    ) : (
                        <iframe src={viewingDoc?.file} title="Preview" className="modal-preview-iframe" />
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default DocumentOrganizerPage;
