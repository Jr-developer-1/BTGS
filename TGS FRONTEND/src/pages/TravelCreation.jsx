import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal';
import { encodeId } from '../utils/idEncoder';
import {
    Upload,
    CheckCircle2,
    Clock,
    Download,
    User,
    Calendar,
    Briefcase,
    Navigation,
    Info,
    FileSpreadsheet,
    AlertCircle,
    Check,
    X,
    FileText,
    ArrowLeft
} from 'lucide-react';

const TravelCreation = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [file, setFile] = useState(null);
    const [policyAccepted, setPolicyAccepted] = useState(false);
    const [reportingInfo, setReportingInfo] = useState({ name: 'Loading...', id: null });

    const [formData, setFormData] = useState({
        purpose: (() => {
            const date = new Date();
            const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
            const year = date.getFullYear().toString().slice(-2);
            return `MMU ITS ${month}${year}`;
        })(),
        month: new Date().toISOString().slice(0, 7), // YYYY-MM
        project: 'Loading...',
        locationCode: 'VIJ',
        locationName: 'Vijayawada',
        positionCode: 'EMP',
        reportingManager: null
    });

    const [submitting, setSubmitting] = useState(false);
    const [modalState, setModalState] = useState({
        isOpen: false,
        type: 'success',
        title: '',
        message: '',
        actions: null
    });

    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get('/api/bulk-activities/template/', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            let monthFormatted = 'MONTH';
            if (formData.month) {
                const date = new Date(formData.month + '-01');
                const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
                const year = date.getFullYear().toString().slice(-2);
                monthFormatted = `${month}${year}`;
            }

            const fileName = `ITS-${formData.project}-${formData.positionCode}-${monthFormatted}.xlsx`;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            showToast("Template downloaded successfully", "success");
        } catch (error) {
            console.error('Download error:', error);
            showToast("Failed to download template", "error");
        }
    };

    useEffect(() => {
        if (!user) return;
        const canCreateTourPlan = user?.role_permissions?.can_create_tour_plan;

        if (!canCreateTourPlan) {
            showToast("Access Restricted: Your role does not have permission to initiate Tour Plans", "error");
            navigate('/trips');
        }
    }, [user, navigate, showToast]);

    useEffect(() => {
        const detectManager = async () => {
            if (!user?.employee_id) return;
            try {
                // Same logic as CreateTrip
                const empRes = await api.get(`/api/employees/?employee_code=${user.employee_id}`);
                const employeesData = Array.isArray(empRes.data) ? empRes.data : (empRes.data.results || []);
                const me = employeesData.find(e =>
                    String(e.employee?.employee_code || e.employee_code).toLowerCase().includes(String(user.employee_id).toLowerCase())
                );

                // ── Auto-fill project code & location from employee HR profile ──
                if (me) {
                    const locName = me.office?.name || 'Vijayawada';
                    let locCode = 'VIJ';
                    if (locName) {
                        locCode = locName.slice(0, 3).toUpperCase();
                    }

                    const projectName = me.project?.name || '';
                    const projectCode = me.project?.code || '';
                    let derivedCode = projectCode;

                    if (!derivedCode && projectName) {
                        const numMatch = projectName.match(/(\d+)/);
                        derivedCode = numMatch
                            ? `PROJ-${numMatch[1]}`
                            : projectName.slice(0, 6).toUpperCase();
                    }
                    if (!derivedCode) derivedCode = 'GENERAL';

                    const positionName = me.position?.name || 'Employee';
                    const jobName = me.positions_details?.[0]?.job_name || me.position?.role_name;
                    let derivedPosition = 'EMP';
                    
                    if (jobName) {
                        const cleanJob = jobName.trim();
                        if (cleanJob.length <= 4 && !cleanJob.includes(' ')) {
                            derivedPosition = cleanJob.toUpperCase();
                        } else {
                            const words = cleanJob.split(/[\s-]+/).filter(w => w.length > 0);
                            derivedPosition = words.map(w => w[0]).join('').toUpperCase();
                        }
                    } else if (positionName) {
                        const words = positionName.split(/[\s-]+/).filter(w => w.length > 0);
                        if (words.length > 0) {
                            const firstWord = words[0];
                            if (firstWord.length <= 3 && isNaN(firstWord)) {
                                derivedPosition = firstWord.toUpperCase();
                            } else {
                                derivedPosition = words
                                    .filter(w => isNaN(w))
                                    .map(w => w[0])
                                    .join('')
                                    .toUpperCase() || 'EMP';
                            }
                        }
                    }

                    // Append district if available
                    const district = me.office?.geo_location?.district || me.position?.geo_location?.district;
                    if (district) {
                        const cleanDistrict = district.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                        derivedPosition = `${derivedPosition}${cleanDistrict}`;
                    }

                    setFormData(prev => ({
                        ...prev,
                        project: derivedCode,
                        locationCode: locCode,
                        locationName: locName,
                        positionCode: derivedPosition
                    }));
                }

                if (me && me.position?.reporting_to?.length > 0) {
                    const managerInfo = me.position.reporting_to[0];
                    const managerCode = managerInfo.employee_code || managerInfo.employee_id;
                    const managerName = managerInfo.name || managerInfo.employee_name || 'Assigned Manager';

                    const userRes = await api.get(`/api/users/?search=${managerCode}`);
                    const systemUsers = Array.isArray(userRes.data) ? userRes.data : (userRes.data.results || []);
                    const systemMgr = systemUsers.find(u =>
                        String(u.employee_id).toLowerCase() === String(managerCode).toLowerCase()
                    );

                    if (systemMgr) {
                        setFormData(prev => ({ ...prev, reportingManager: systemMgr.id }));
                        setReportingInfo({ name: systemMgr.name, id: systemMgr.id });
                    } else {
                        setReportingInfo({
                            name: managerName,
                            id: null,
                            warning: "Manager not registered. Routed automatically."
                        });
                    }
                } else {
                    setReportingInfo({ name: "Routing Automatically", id: null });
                }
            } catch (error) {
                console.error("Manager detection failed", error);
                setReportingInfo({ name: 'Assigned Manager', id: null });
            }
        };
        detectManager();
    }, [user]);

    useEffect(() => {
        if (formData.month) {
            const date = new Date(formData.month + '-01');
            const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
            const year = date.getFullYear().toString().slice(-2);
            setFormData(prev => ({ ...prev, purpose: `MMU ITS ${month}${year}` }));
        }
    }, [formData.month]);



    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
            if (!isExcel) {
                showToast("Please select a valid Excel file (.xlsx or .xls)", "error");
                e.target.value = null;
                return;
            }

            let monthFormatted = 'MONTH';
            if (formData.month) {
                const date = new Date(formData.month + '-01');
                const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
                const year = date.getFullYear().toString().slice(-2);
                monthFormatted = `${month}${year}`;
            }
            const expectedBaseName = `ITS-${formData.project}-${formData.positionCode}-${monthFormatted}`.toLowerCase();
            
            const lastDotIndex = selectedFile.name.lastIndexOf('.');
            const selectedBaseName = (lastDotIndex !== -1 ? selectedFile.name.substring(0, lastDotIndex) : selectedFile.name).toLowerCase();

            if (selectedBaseName !== expectedBaseName) {
                const expectedFullName = `ITS-${formData.project}-${formData.positionCode}-${monthFormatted}.xlsx`;
                showToast(`Invalid File Name! The uploaded file must be named exactly: ${expectedFullName}`, "error");
                e.target.value = null;
                setFile(null);
                return;
            }

            setFile(selectedFile);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!file) {
            showToast("Please upload the activities file", "error");
            return;
        }

        let monthFormatted = 'MONTH';
        if (formData.month) {
            const date = new Date(formData.month + '-01');
            const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
            const year = date.getFullYear().toString().slice(-2);
            monthFormatted = `${month}${year}`;
        }
        const expectedBaseName = `ITS-${formData.project}-${formData.positionCode}-${monthFormatted}`.toLowerCase();
        
        const lastDotIndex = file.name.lastIndexOf('.');
        const selectedBaseName = (lastDotIndex !== -1 ? file.name.substring(0, lastDotIndex) : file.name).toLowerCase();

        if (selectedBaseName !== expectedBaseName) {
            const expectedFullName = `ITS-${formData.project}-${formData.positionCode}-${monthFormatted}.xlsx`;
            showToast(`File name must match the expected template name: ${expectedFullName}`, "error");
            return;
        }

        if (!formData.purpose) {
            showToast("Please provide a purpose for this travel request", "error");
            return;
        }

        if (!policyAccepted) {
            showToast("You must accept the tour plan policy to proceed", "error");
            return;
        }

        setSubmitting(true);

        try {
            const [year, month] = formData.month.split('-');
            const startDate = `${year}-${month}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;

            const tripPayload = {
                source: formData.locationName,
                destination: formData.locationName,
                consider_as_local: true,
                start_date: startDate,
                end_date: endDate,
                composition: 'Solo',
                purpose: formData.purpose,
                travel_mode: 'Car / Jeep / Van',
                vehicle_type: 'Own',
                project_code: formData.project,
                is_tour_plan: true,
                // reporting_manager is determined on the server from the logged-in user
            };

            const tripRes = await api.post('/api/travels/', tripPayload);
            const tripId = tripRes.data.trip_id;

            const bulkFormData = new FormData();
            bulkFormData.append('file', file);
            bulkFormData.append('trip_id', tripId);

            await api.post('/api/bulk-activities/upload/', bulkFormData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });



            setModalState({
                isOpen: true,
                type: 'success',
                title: 'Tour Plan Created!',
                message: (
                    <div className="text-center p-4">
                        <p className="text-slate-600 mb-6 font-medium">Request has been sent to your reporting manager <span className="text-emerald-600 font-extrabold">{reportingInfo.name}</span> for approval.</p>
                        <div className="flex flex-col gap-2 items-center bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Tour Plan ID</span>
                            <span className="text-3xl font-black text-primary tracking-tight">{tripId}</span>
                        </div>
                    </div>
                ),
                actions: (
                    <div className="flex gap-2 justify-center">
                        <button className="btn-secondary" onClick={() => navigate('/trips')}>
                            Back to Trips
                        </button>
                        {/* <button className="btn-primary" onClick={() => navigate(`/travel-story/${encodeId(tripId)}`)}>
                            View Travel Story
                        </button> */}
                    </div>
                )
            });
        } catch (error) {
            console.error("Submission failed", error);
            // display server validation details if available
            const errData = error.response?.data;
            let msg = "Failed to create tour plan request";
            if (errData) {
                if (typeof errData === 'string') msg = errData;
                else if (errData.error) msg = errData.error;
                else if (errData.detail) msg = errData.detail;
                else {
                    // flatten first field message
                    const firstKey = Object.keys(errData)[0];
                    msg = Array.isArray(errData[firstKey]) ? errData[firstKey][0] : errData[firstKey];
                }
            }
            showToast(msg, "error");

            const isComplianceError = msg.toLowerCase().includes("required travel documents");
            setModalState({
                isOpen: true,
                type: 'error',
                title: isComplianceError ? 'Compliance Validation Failed' : 'Submission Failed',
                message: msg,
                actions: isComplianceError ? (
                    <div className="flex gap-2 justify-center">
                        <button className="btn-secondary" onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}>
                            Cancel
                        </button>
                        <button className="btn-primary" onClick={() => {
                            setModalState(prev => ({ ...prev, isOpen: false }));
                            navigate('/documents');
                        }}>
                            Go to Document Organizer
                        </button>
                    </div>
                ) : null
            });
        } finally {
            setSubmitting(false);
        }

    };

    return (
        <div className="create-trip-page">
            <div className="page-header">
                <div>
                    <button className="back-btn-simple" onClick={() => navigate('/trips')}>
                        <span className="ct-back-arrow">←</span> Back to Trips
                    </button>
                    <h1>New Tour Plan</h1>
                    <p>Provide details for your monthly tour plan settlement.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="trip-form">
                <div className="form-grid">

                    {/* TOUR PLAN CONTEXT */}
                    <div className="form-section premium-card">
                        <div className="section-title">
                            <Briefcase size={20} className="title-icon" />
                            <h3>Tour Plan Context</h3>
                        </div>

                        <div className="input-field" style={{ gridColumn: '1 / -1' }}>
                            <label>Traveler Detail (Auto-Filled)</label>
                            <div className="flex items-center gap-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100 group hover:border-primary/20 transition-all duration-300">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                    <User size={24} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-base font-bold text-slate-800">{user?.name || 'Loading...'}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider shadow-sm">ID: {user?.employee_id || 'U-0000'}</span>
                                        <span className="text-[10px] font-bold text-slate-300">•</span>
                                        <span className="text-xs font-medium text-slate-400 italic">Self Service Mode</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="date-row" style={{ gridColumn: '1 / -1' }}>
                            <div className="input-field">
                                <label>Settlement Month <span className="required">*</span></label>
                                <div className="input-with-icon">
                                    <Calendar size={18} className="field-icon" />
                                    <input
                                        type="month"
                                        value={formData.month}
                                        onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                                        min={new Date().toISOString().slice(0, 7)}
                                        max={(() => {
                                            const d = new Date();
                                            d.setFullYear(d.getFullYear() + 1);
                                            return d.toISOString().slice(0, 7);
                                        })()}
                                        required
                                        className="h-[48px]"
                                    />
                                </div><br />
                                <button
                                    type="button"
                                    className="mt-4 flex items-center gap-3 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-bold rounded-xl transition-all border border-emerald-200 hover:border-emerald-300 shadow-sm group w-full sm:w-auto"
                                    onClick={handleDownloadTemplate}
                                >
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center transition-colors shrink-0">
                                        <Download size={16} className="text-emerald-600" />
                                    </div>
                                    <span className="truncate">Download {(() => {
                                        let monthFormatted = 'MONTH';
                                        if (formData.month) {
                                            const date = new Date(formData.month + '-01');
                                            const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
                                            const year = date.getFullYear().toString().slice(-2);
                                            monthFormatted = `${month}${year}`;
                                        }
                                        return `ITS-${formData.project}-${formData.positionCode}-${monthFormatted}.xlsx`;
                                    })()}</span>
                                </button>
                                <br />
                            </div>

                            <div className="input-field">
                                <label>Project Code</label>
                                <div className="input-with-icon">
                                    <Briefcase size={18} className="field-icon" />
                                    <input
                                        type="text"
                                        value={formData.project}
                                        readOnly
                                        className="h-[48px] bg-slate-50/50 cursor-not-allowed font-bold text-slate-700"
                                        placeholder="Project Code"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="input-field" style={{ gridColumn: '1 / -1' }}>
                            <label>Business Objective / Purpose <span className="required">*</span></label>
                            <textarea
                                value={formData.purpose}
                                placeholder="STATE THE BUSINESS OBJECTIVE FOR THIS MONTH'S TRAVEL..."
                                rows={2}
                                readOnly
                                className="bg-slate-50/50 cursor-not-allowed font-bold text-slate-700"
                                required
                            />
                        </div>


                    </div>

                    {/* BULK UPLOAD SECTION */}
                    <div className="form-section premium-card">
                        <div className="section-title">
                            <FileSpreadsheet size={20} className="title-icon" />
                            <h3>Activity Log Upload</h3>
                        </div>

                        <div className="service-alert info animate-fade-in mb-4">
                            <Info size={18} className="flex-shrink-0 mt-0.5" />
                            <div className="flex flex-col gap-1">
                                <p>Monthly tour plans require a validated bulk upload of day to day activities.</p>
                                <p className="text-xs font-medium text-slate-500">
                                    Need the Activity Log Template? You can download it from the <button type="button" onClick={() => navigate('/help')} className="text-primary font-bold hover:underline">Help & Support</button> page.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">


                            <div className={`file-upload-zone ${file ? 'active' : ''}`} style={{ border: '2px dashed #f1f5f9', borderRadius: '24px', padding: '1.5rem', background: file ? '#f0fdf4' : '#fafafa', transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                                <input
                                    type="file"
                                    id="bulkFile"
                                    accept=".xlsx, .xls"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <label htmlFor="bulkFile" className="cursor-pointer flex flex-col items-center gap-4 py-4">
                                    {file ? (
                                        <>
                                            <div className="w-16 h-16 rounded-2xl bg-emerald-100/50 flex items-center justify-center text-emerald-600 shadow-sm">
                                                <CheckCircle2 size={32} />
                                            </div>
                                            <div className="text-center">
                                                <p className="font-bold text-slate-700 text-sm max-w-[200px] truncate">{file.name}</p>
                                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter mt-1">Ready to Upload • {(file.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm group-hover:bg-slate-50">
                                                <Upload size={32} />
                                            </div>
                                            <div className="text-center">
                                                <p className="font-bold text-slate-600 text-sm">Upload Log File</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">XLSX or XLS Only</p>
                                            </div>
                                        </>
                                    )}
                                </label>
                            </div>
                        </div>

                        <div className="ct-alert-card warning mt-4 shadow-none border-dashed border-2 flex items-start gap-4 p-4 !bg-transparent" style={{ borderColor: '#fef3c7' }}>
                            <AlertCircle size={24} className="text-warning flex-shrink-0" />
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">Compliance Reminder</span>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                    Activity dates must fall within the selected month.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* POLICY ACCEPTANCE */}
                <div className="policy-acceptance-section premium-card mt-8">
                    <label className="flex items-center gap-4 cursor-pointer select-none group">
                        <div className={`w-7 h-7 rounded-lg border-2 transition-all duration-300 flex items-center justify-center ${policyAccepted ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'border-slate-200 bg-white group-hover:border-primary'}`}>
                            {policyAccepted && <Check size={18} className="text-white" />}
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={policyAccepted}
                                onChange={(e) => setPolicyAccepted(e.target.checked)}
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-800 font-bold text-sm tracking-tight">
                                I confirm the authenticity of the tour plan logs provided above.
                            </span>
                            <span className="text-slate-400 text-xs font-medium">
                                I have read and accepted the <button type="button" className="text-primary hover:underline font-extrabold ml-1">Travel Governance Policy</button>
                            </span>
                        </div>
                    </label>
                </div>

                <div className="form-actions">
                    <button
                        type="submit"
                        className={`btn-primary shadow-xl ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                        disabled={submitting}
                        style={{ height: '56px', minWidth: '240px' }}
                    >
                        {submitting ? (
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Processing...</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <FileText size={20} />
                                <span>Send ITS for Approval</span>
                            </div>
                        )}
                    </button>
                </div>
            </form>

            <Modal
                isOpen={modalState.isOpen}
                onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                title={modalState.title}
                type={modalState.type}
                actions={modalState.actions}
            >
                {modalState.message}
            </Modal>
        </div>
    );
};

export default TravelCreation;
