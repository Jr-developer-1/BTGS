import React, { useState, useEffect } from 'react';
import {
    Languages,
    FileText,
    Download,
    Upload,
    Plus,
    X,
    Trash2,
    Eye,
    Pencil
} from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext.jsx';

const PolicyCenter = () => {
    const { user } = useAuth();
    const { showToast, confirm } = useToast();
    const [language, setLanguage] = useState('English');
    const [policies, setPolicies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [editingPolicyId, setEditingPolicyId] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [viewContent, setViewContent] = useState(null); // {title: string, content: string}

    // Admin check
    const isAdmin = user?.role?.toLowerCase().includes('admin');

    const [uploadData, setUploadData] = useState({
        title: '',
        category: 'General',
        file_en: null,
        file_te: null,
        file_hi: null
    });

    useEffect(() => {
        fetchPolicies();
    }, []);

    const fetchPolicies = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/api/policies/');
            const payload = response?.data;
            const list = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.results)
                    ? payload.results
                    : Array.isArray(payload?.value)
                        ? payload.value
                        : [];
            setPolicies(list);
        } catch (error) {
            console.error("Failed to fetch policies:", error);
            showToast("Failed to load policies", "error");
        } finally {
            setIsLoading(false);
        }
    };


    const handleFileChange = (lang, file) => {
        if (file && file.type !== 'application/pdf') {
            showToast("Please upload PDF files only", "error");
            return;
        }
        setUploadData(prev => ({ ...prev, [`file_${lang}`]: file }));
    };

    const readFileAsBase64 = (file) => {
        return new Promise((resolve, reject) => {
            if (!file) {
                resolve(null);
                return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        
        if (!uploadData.title) {
            showToast("Please provide a title", "error");
            return;
        }

        if (!uploadData.file_en && !uploadData.file_te && !uploadData.file_hi) {
            showToast("Please upload at least one PDF file", "error");
            return;
        }

        setIsUploading(true);
        try {
            const finalData = {
                title: uploadData.title,
                category: uploadData.category
            };

            // Process all selected files to Base64
            const languages = ['en', 'te', 'hi'];
            for (const lang of languages) {
                if (uploadData[`file_${lang}`]) {
                    const base64 = await readFileAsBase64(uploadData[`file_${lang}`]);
                    finalData[`file_content_${lang}`] = base64;
                    finalData[`file_name_${lang}`] = uploadData[`file_${lang}`].name;
                    finalData[`file_size_${lang}`] = (uploadData[`file_${lang}`].size / 1024).toFixed(2) + " KB";
                }
            }

            if (editingPolicyId) {
                await api.put(`/api/policies/${editingPolicyId}/`, finalData);
                showToast("Policy updated successfully", "success");
            } else {
                await api.post('/api/policies/', finalData);
                showToast("Policy published successfully", "success");
            }

            setShowUploadModal(false);
            setEditingPolicyId(null);
            setUploadData({
                title: '', category: 'General',
                file_en: null, file_te: null, file_hi: null
            });
            fetchPolicies();
        } catch (error) {
            console.error("Operation failed:", error);
            showToast(editingPolicyId ? "Failed to update policy" : "Failed to upload policy", "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleEdit = (policy) => {
        setEditingPolicyId(policy.id);
        setUploadData({
            title: policy.title,
            category: policy.category || 'General',
            file_en: null,
            file_te: null,
            file_hi: null
        });
        setShowUploadModal(true);
    };

    const handleView = async (policy) => {
        const langMap = {
            'English': 'en',
            'Telugu (తెలుగు)': 'te',
            'Hindi (हिन्दी)': 'hi'
        };
        const suffix = langMap[language];

        // Check availability using file metadata (size) rather than the content blob 
        // which is only fetched in the detail view.
        if (!policy[`file_size_${suffix}`]) {
            showToast(`This policy is not available in ${language}`, "warning");
            return;
        }

        try {
            const response = await api.get(`/api/policies/${policy.id}/`);
            const content = response.data[`file_content_${suffix}`];
            if (!content) {
                showToast("Content not found", "error");
                return;
            }
            setViewContent({ 
                title: policy.title, 
                content: content 
            });
        } catch (error) {
            showToast("Failed to load document", "error");
        }
    };


    const handleDelete = async (id) => {
        const confirmed = await confirm("Are you sure you want to delete this policy?");
        if (!confirmed) return;
        try {
            await api.delete(`/api/policies/${id}/`);
            showToast("Policy deleted", "success");
            fetchPolicies();
        } catch (error) {
            showToast("Failed to delete", "error");
        }
    };

    const normalized = (v) => (v || '').toString().trim().toLowerCase();

    const categories = ['HR Policy', 'Travel Guide', 'General'];
    const uncategorizedPolicies = policies.filter(
        p => !categories.some(cat => normalized(cat) === normalized(p.category))
    );

    return (
        <div className="policy-page animate-fade-in" style={{ padding: '2rem' }}>
            <style>{`
                .pc-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2.5rem;
                }
                .pc-icon-box {
                    width: 52px;
                    height: 52px;
                    background: #f0fdfa;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #0f766e;
                }
                .pc-add-btn {
                    background: #0f766e;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 14px;
                    border: none;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.2s;
                    box-shadow: 0 10px 15px -3px rgba(15, 118, 110, 0.2);
                }
                .pc-add-btn:hover {
                    transform: translateY(-2px);
                    background: #0d9488;
                    box-shadow: 0 12px 20px -3px rgba(15, 118, 110, 0.3);
                }
                .pc-lang-selector {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: white;
                    padding: 8px 16px;
                    border-radius: 12px;
                    border: 1.5px solid var(--admin-border);
                    color: #64748b;
                    font-weight: 700;
                    font-size: 0.85rem;
                }
                .pc-lang-selector select {
                    border: none;
                    background: transparent;
                    color: #1e293b;
                    font-weight: 800;
                    cursor: pointer;
                    outline: none;
                }
                .pc-category-group {
                    margin-bottom: 3rem;
                }
                .pc-category-title {
                    font-size: 1.1rem;
                    font-weight: 900;
                    color: #0f172a;
                    letter-spacing: -0.02em;
                    margin-bottom: 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .pc-category-title::after {
                    content: '';
                    flex: 1;
                    height: 1.5px;
                    background: #f1f5f9;
                }
                .pc-policy-card {
                    background: white;
                    padding: 1.5rem;
                    border-radius: 20px;
                    border: 1.5px solid var(--admin-border);
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    margin-bottom: 1rem;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }
                .pc-policy-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 25px -5px rgba(0, 0, 0, 0.05);
                    border-color: #0f766e;
                }
                .pc-accent-bar {
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 4px;
                    background: #0f766e;
                    border-radius: 0 10px 10px 0;
                }
                .pc-icon-box-small {
                    width: 48px;
                    height: 48px;
                    background: #f0fdfa;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #0f766e;
                    flex-shrink: 0;
                }
                .pc-view-btn {
                    padding: 10px 20px;
                    background: #f0fdfa;
                    color: #0f766e;
                    border-radius: 10px;
                    font-weight: 800;
                    font-size: 0.8rem;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .pc-view-btn:hover {
                    background: #0f766e;
                    color: white;
                }
                .pc-action-icon {
                    padding: 8px;
                    color: #64748b;
                    border-radius: 8px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .pc-action-icon:hover {
                    background: #f1f5f9;
                    color: #1e293b;
                    transform: scale(1.1);
                }
                .pc-action-icon.delete:hover {
                    background: #fef2f2;
                    color: #ef4444;
                    border-color: #fee2e2;
                }

                /* Modal Specific Styles */
                .fm-modal {
                    background: white;
                    width: 100%;
                    max-width: 650px;
                    height: 90vh;
                    border-radius: 28px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    position: relative;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
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
                .fm-modal-body { 
                    flex: 1;
                    overflow-y: auto !important;
                    min-height: 0;
                    padding: 2rem 2.5rem;
                }
                .fm-modal-body::-webkit-scrollbar {
                    display: block !important;
                    width: 8px !important;
                }
                .fm-modal-body::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 10px;
                }
                .fm-modal-body::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border: 2px solid #f1f5f9;
                    border-radius: 10px;
                }
                .fm-modal-body::-webkit-scrollbar-thumb:hover {
                    background: #64748b;
                }
                
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
                    border-color: #0f766e;
                    background: white;
                    box-shadow: 0 0 0 4px #f0fdfa;
                }
                .fm-modern-input svg { color: #64748b; flex-shrink: 0; }
                .fm-modern-input input, .fm-modern-input select {
                    border: none;
                    background: transparent;
                    width: 100%;
                    padding: 1rem 0.75rem;
                    font-weight: 600;
                    font-size: 0.95rem;
                    outline: none;
                    color: #1e293b;
                }

                .fm-file-upload-box {
                    padding: 1.25rem;
                    border-radius: 18px;
                    border: 2px dashed #e2e8f0;
                    background: #f8fafc;
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    transition: all 0.2s;
                    cursor: pointer;
                }
                .fm-file-upload-box:hover {
                    border-color: #0f766e;
                    background: #f0fdfa;
                }
                .fm-file-upload-box.has-file {
                    border-color: #10b981;
                    background: #ecfdf5;
                }
                .fm-file-upload-box input[type="file"] {
                    display: none;
                }
                .fm-upload-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: white;
                    color: #64748b;
                    border: 1px solid #e2e8f0;
                    flex-shrink: 0;
                }
                .fm-file-upload-box.has-file .fm-upload-icon {
                    background: #10b981;
                    color: white;
                    border-color: #10b981;
                }
                .fm-file-info {
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                }
                .fm-file-info .main-text {
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: #1e293b;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .fm-file-info .sub-text {
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }

                .fm-modal-footer {
                    padding: 1.5rem 2.5rem;
                    border-top: 1px solid #f1f5f9;
                    display: flex;
                    justify-content: flex-end;
                    background: #f8fafc;
                    border-radius: 0 0 28px 28px;
                    flex-shrink: 0;
                    position: sticky;
                    bottom: 0;
                    z-index: 10;
                }

                .fm-btn-group { 
                    display: flex;
                    justify-content: flex-end;
                    gap: 1rem;
                }
                .fm-btn {
                    padding: 0.75rem 2rem;
                    border-radius: 12px;
                    font-weight: 800;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                    white-space: nowrap;
                }
                .fm-btn.cancel { background: white; color: #64748b; border: 1.5px solid #e2e8f0; }
                .fm-btn.confirm { background: #0f766e; color: white; box-shadow: 0 4px 12px rgba(15, 118, 110, 0.2); }
                .fm-btn:hover { transform: translateY(-2px); }
                .fm-btn.cancel:hover { background: #f8fafc; border-color: #cbd5e1; }
                .fm-btn.confirm:hover { background: #0d9488; box-shadow: 0 8px 20px rgba(15, 118, 110, 0.3); }
            `}</style>

            <div className="pc-header">
                <div className="flex items-center gap-4">
                    <div className="pc-icon-box">
                        <FileText size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Policy Center</h1>
                        {/* <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Corporate governance and compliance documentation</p> */}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {isAdmin && (
                        <button className="pc-add-btn" onClick={() => setShowUploadModal(true)}>
                            <Plus size={20} />
                            <span>Publish New Regulation</span>
                        </button>
                    )}
                    <div className="pc-lang-selector">
                        <Languages size={18} />
                        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                            <option>English</option>
                            <option>Telugu (తెలుగు)</option>
                            <option>Hindi (हिन्दी)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="policy-content" style={{ width: '100%' }}>
                {isLoading ? (
                    <div className="flex flex-col items-center py-24 gap-4">
                        <div className="loader"></div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Accessing Governance Repository...</p>
                    </div>
                ) : (
                    <div className="policy-list">
                        {[...categories, 'Other'].map(cat => {
                            const isOther = cat === 'Other';
                            const catPolicies = isOther
                                ? uncategorizedPolicies
                                : policies.filter(p => normalized(p.category) === normalized(cat));

                            if (catPolicies.length === 0) return null;
                            return (
                                <div key={cat} className="pc-category-group">
                                    <h2 className="pc-category-title">{cat}</h2>
                                    {catPolicies.map((p) => (
                                        <div key={p.id} className="pc-policy-card">
                                            <div className="pc-accent-bar"></div>
                                            <div className="pc-icon-box-small">
                                                <FileText size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-black text-slate-800 leading-tight mb-1">{p.title}</h3>
                                                <div className="flex items-center gap-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                                                    <span>Updated {new Date(p.created_at).toLocaleDateString()}</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                                    <span className="text-[#0f766e]">
                                                        {language === 'English' ? p.file_size_en :
                                                            language === 'Telugu (తెలుగు)' ? p.file_size_te :
                                                                p.file_size_hi || 'N/A'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button className="pc-view-btn" onClick={() => handleView(p)}>
                                                    View Document
                                                </button>
                                                {isAdmin && (
                                                    <div className="flex items-center gap-2 border-l border-slate-100 pl-4 ml-2">
                                                        <button className="pc-action-icon" onClick={() => handleEdit(p)} title="Edit Document">
                                                            <Pencil size={18} />
                                                        </button>
                                                        <button className="pc-action-icon delete" onClick={() => handleDelete(p.id)} title="Purge Record">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-[8px] z-[999] flex items-center justify-center p-6">
                    <div className="fm-modal" style={{ height: '85vh' }}>
                        <div className="fm-modal-header border-b border-slate-50 shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">{editingPolicyId ? 'Revise Regulation' : 'Publish New Protocol'}</h2>
                                <p className="text-slate-500 font-medium text-sm">Update corporate library with latest compliance standards</p>
                            </div>
                            <button onClick={() => {
                                setShowUploadModal(false);
                                setEditingPolicyId(null);
                                setUploadData({ title: '', category: 'General', file_en: null, file_te: null, file_hi: null });
                            }} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <X size={24} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="fm-modal-body">
                            <form id="policy-upload-form" onSubmit={handleUpload}>
                                <div className="grid grid-cols-2 gap-6 mb-8">
                                    <div className="fm-input-group mb-0">
                                        <label>Document Title</label>
                                        <div className="fm-modern-input">
                                            <FileText size={20} />
                                            <input
                                                type="text"
                                                placeholder="e.g. Travel Guidelines 2026"
                                                value={uploadData.title}
                                                onChange={e => setUploadData({ ...uploadData, title: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="fm-input-group mb-0">
                                        <label>Categorization</label>
                                        <div className="fm-modern-input">
                                            <select
                                                value={uploadData.category}
                                                onChange={e => setUploadData({ ...uploadData, category: e.target.value })}
                                            >
                                                <option>General</option>
                                                <option>HR Policy</option>
                                                <option>Travel Guide</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-2">
                                    {['en', 'te', 'hi'].map(lang => (
                                        <div key={lang}>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                                                {lang === 'en' ? 'International Standard (English)' : lang === 'te' ? 'Regional Standard (Telugu)' : 'National Standard (Hindi)'}
                                            </label>
                                            <div 
                                                className={`fm-file-upload-box ${uploadData[`file_${lang}`] ? 'has-file' : ''}`}
                                                onClick={() => document.getElementById(`file-${lang}`).click()}
                                            >
                                                <input 
                                                    type="file" 
                                                    id={`file-${lang}`}
                                                    accept="application/pdf"
                                                    onChange={e => handleFileChange(lang, e.target.files[0])}
                                                />
                                                <div className="fm-upload-icon">
                                                    <Upload size={18} />
                                                </div>
                                                <div className="fm-file-info">
                                                    <span className="main-text">
                                                        {uploadData[`file_${lang}`] ? uploadData[`file_${lang}`].name : `Select ${lang === 'en' ? 'English' : lang === 'te' ? 'Telugu' : 'Hindi'} PDF Document`}
                                                    </span>
                                                    <span className="sub-text">MAX SIZE: 10MB • FORMAT: PDF</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </form>
                        </div>
                        <div className="fm-modal-footer">
                            <div className="fm-btn-group">
                                <button type="button" className="fm-btn cancel" onClick={() => {
                                    setShowUploadModal(false);
                                    setEditingPolicyId(null);
                                    setUploadData({ title: '', category: 'General', file_en: null, file_te: null, file_hi: null });
                                }}>Discard</button>
                                <button 
                                    type="submit" 
                                    form="policy-upload-form"
                                    className="fm-btn confirm" 
                                    disabled={isUploading}
                                >
                                    {isUploading ? 'INDEXING...' : (editingPolicyId ? 'UPDATE REGULATION' : 'PUBLISH TO CENTER')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {viewContent && (
                <div className="modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-[8px] z-[999] flex items-center justify-center p-8">
                    <div className="fm-modal" style={{ maxWidth: '95%', height: '90%', display: 'flex', flexDirection: 'column' }}>
                        <div className="fm-modal-header border-b border-slate-50 shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight">{viewContent.title}</h2>
                                <p className="text-slate-500 font-medium text-xs">Official Document Viewer</p>
                            </div>
                            <button onClick={() => setViewContent(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <X size={24} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="flex-1 bg-slate-800 rounded-b-[28px] overflow-hidden relative">
                            <iframe
                                src={`${viewContent.content}#toolbar=0&navpanes=0&scrollbar=0`}
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                className="block"
                                title="Policy PDF"
                            />
                            {/* Masking the PDF toolbar by showing only content area if possible, though base64 might have limits on overflow hiding like this */}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PolicyCenter;
