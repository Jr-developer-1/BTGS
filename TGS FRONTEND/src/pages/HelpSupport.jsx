import React, { useState } from 'react';
import {
    HelpCircle,
    MessageCircle,
    FileText,
    Phone,
    Search,
    ChevronRight,
    ExternalLink,
    Mail,
    User,
    ShieldCheck,
    AlertCircle,
    Settings,
    Wallet,
    MapPin,
    X,
    Send,
    Download,
    FileSpreadsheet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useToast } from '../context/ToastContext';


const HelpSupport = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const handleOpenChat = () => {
        window.dispatchEvent(new CustomEvent('open-tgs-chat'));
    };

    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get('/api/bulk-activities/template/', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'travel_activities_template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            showToast("Template downloaded successfully", "success");
        } catch (error) {
            console.error('Download error:', error);
            showToast("Failed to download template", "error");
        }
    };

    const faqs = [
        {
            category: 'Getting Started',
            icon: <FileText size={20} />,
            questions: [
                'How do I create a new trip request?',
                'What is the approval workflow?',
                'How to set up my profile properly?'
            ]
        },
        {
            category: 'Expenses & Claims',
            icon: <ShieldCheck size={20} />,
            questions: [
                'How to claim mileage for local travel?',
                'What receipts are mandatory for reimbursement?',
                'How long does it take for settlement?'
            ]
        },
        {
            category: 'Guest House Booking',
            icon: <AlertCircle size={20} />,
            questions: [
                'How to book a room in a company guest house?',
                'Can I cancel a booking after approval?',
                'What are the guest house rules?'
            ]
        }
    ];

    const contactMethods = [
        {
            title: 'Technical Support',
            description: 'For issues with the application or login problems.',
            email: 'it.support@tgs.com',
            phone: '+91 800-456-7890',
            icon: <Settings className="method-icon" size={24} />
        },
        {
            title: 'HR & Policy',
            description: 'For queries related to travel policy and eligibility.',
            email: 'hr.travel@tgs.com',
            phone: '+91 800-456-7891',
            icon: <User className="method-icon" size={24} />
        },
        {
            title: 'Finance & Claims',
            description: 'For questions about payments and settlements.',
            email: 'finance.claims@tgs.com',
            phone: '+91 800-456-7892',
            icon: <Wallet className="method-icon" size={24} />
        }
    ];

    return (
        <div className="help-module animate-fade-in" style={{ padding: '0', background: 'transparent' }}>
            <div className="master-page-header" style={{ padding: '20px 40px 0 40px', background: 'transparent', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '52px', height: '52px', background: 'var(--primary-light)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', boxShadow: '0 4px 12px rgba(0, 128, 128, 0.1)' }}>
                            <HelpCircle size={28} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0', letterSpacing: '-0.02em' }}>Help & Support</h1>
                        </div>
                    </div>
                    
                    <div className="search-box-premium" style={{ width: '100%', maxWidth: '400px' }}>
                        <Search size={22} className="text-primary" />
                        <input
                            type="text"
                            placeholder="Find answers, guides, policies..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ background: 'transparent' }}
                        />
                    </div>
                </div>
            </div>

            <style>{`
                .search-box-premium {
                    background: white;
                    padding: 12px 24px;
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    border: 1px solid #e2e8f0;
                }
                .search-box-premium input {
                    border: none;
                    width: 100%;
                    padding: 10px 0;
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: #1e293b;
                }
                .search-box-premium input:focus { outline: none; }
                .search-box-premium svg { color: var(--primary); }

                .help-quick-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
                    gap: 2rem;
                    margin-top: 2rem;
                }
                .help-action-card {
                    background: white;
                    padding: 2rem;
                    border-radius: 24px;
                    border: 1.5px solid #edf2f7;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .help-action-card:hover {
                    transform: translateY(-8px);
                    box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.1);
                    border-color: var(--primary);
                }
                .help-accent-bar {
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 5px;
                    background: var(--primary);
                    border-radius: 0 10px 10px 0;
                }
                .help-icon-box {
                    width: 52px;
                    height: 52px;
                    background: var(--primary-light);
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary);
                    margin-bottom: 0.5rem;
                }
                .help-action-card h3 {
                    font-size: 1.25rem;
                    font-weight: 850;
                    color: #1e293b;
                    margin: 0;
                }
                .help-action-card p {
                    font-size: 0.95rem;
                    color: #64748b;
                    line-height: 1.6;
                    margin: 0;
                }
                .help-link-btn {
                    margin-top: auto;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--primary);
                    font-weight: 800;
                    font-size: 0.9rem;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    padding: 0;
                }
                .help-link-btn:hover { color: var(--primary-hover); }

                .faq-modern {
                    margin-top: 4rem;
                }
                .faq-header-pro {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-bottom: 2rem;
                }
                .faq-header-pro h2 {
                    font-size: 2rem;
                    font-weight: 900;
                    color: #0f172a;
                    letter-spacing: -0.02em;
                }
                .faq-grid-pro {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                    gap: 2.5rem;
                }
                .faq-list-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px 0;
                    border-bottom: 1px solid #f1f5f9;
                    color: #475569;
                    font-weight: 600;
                    text-decoration: none;
                    transition: all 0.2s;
                }
                .faq-list-item:hover {
                    color: var(--primary);
                    padding-left: 8px;
                }
                .faq-cat-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    color: var(--primary);
                    font-weight: 850;
                    margin-bottom: 1.5rem;
                    font-size: 1.1rem;
                }

                .contact-section-pro {
                    margin: 4rem 0;
                    padding: 4rem;
                    background: #f8fafc;
                    border-radius: 40px;
                    text-align: center;
                }
                .contact-grid-pro {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 2rem;
                    margin-top: 3rem;
                }
                .contact-card-pro {
                    background: white;
                    padding: 2.5rem;
                    border-radius: 30px;
                    border: 1px solid #e2e8f0;
                    transition: all 0.3s;
                }
                .contact-card-pro:hover {
                    transform: scale(1.02);
                    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.08);
                }
                .contact-btn-pro {
                    background: var(--primary);
                    color: white;
                    padding: 14px 28px;
                    border-radius: 16px;
                    font-weight: 800;
                    border: none;
                    cursor: pointer;
                    width: 100%;
                    margin-top: 2rem;
                    transition: all 0.2s;
                }
                .contact-btn-pro:hover {
                    background: var(--primary-hover);
                    box-shadow: 0 10px 20px -5px rgba(0, 128, 128, 0.3);
                }
            `}</style>

            <div className="content-inner-wrapper" style={{ padding: '20px 40px 100px 40px', maxWidth: '1600px', margin: '0 auto' }}>
                <div className="help-quick-grid">
                    <div className="help-action-card">
                        <div className="help-accent-bar"></div>
                        <div className="help-icon-box"><FileText size={24} /></div>
                        <h3>User Guides</h3>
                        <p>Complete documentation on every system feature and module.</p>
                        <button className="help-link-btn" onClick={() => navigate('/policy')}>
                            Browse Guides <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="help-action-card">
                        <div className="help-accent-bar" style={{ background: 'var(--primary)' }}></div>
                        <div className="help-icon-box" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}><MessageCircle size={24} /></div>
                        <h3>Live Chat</h3>
                        <p>Talk to our expert support agents in real-time sessions.</p>
                        <button className="help-link-btn" style={{ color: 'var(--primary)' }} onClick={handleOpenChat}>
                            Start Chat <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="help-action-card">
                        <div className="help-accent-bar" style={{ background: 'var(--primary)' }}></div>
                        <div className="help-icon-box" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}><MapPin size={24} /></div>
                        <h3>Location Codes</h3>
                        <p>Find ISO and project-specific location identifiers.</p>
                        <button className="help-link-btn" style={{ color: 'var(--primary)' }} onClick={() => navigate('/location-codes')}>
                            View Codes <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="help-action-card">
                        <div className="help-accent-bar" style={{ background: 'var(--primary)' }}></div>
                        <div className="help-icon-box" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}><FileSpreadsheet size={24} /></div>
                        <h3>Data Templates</h3>
                        <p>Download structured Excel templates for tour schedules.</p>
                        <button className="help-link-btn" style={{ color: 'var(--primary)' }} onClick={handleDownloadTemplate}>
                            Get Template <Download size={18} />
                        </button>
                    </div>
                </div>

                <div className="faq-modern">
                    <div className="faq-header-pro">
                        <div>
                            <h2 className="mb-2">Frequently Asked Questions</h2>
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Instant solutions to common queries</p>
                        </div>
                        <button className="px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all">View All FAQ</button>
                    </div>

                    <div className="faq-grid-pro">
                        {faqs.map((group, idx) => (
                            <div key={idx}>
                                <div className="faq-cat-header">
                                    {group.icon}
                                    <span>{group.category}</span>
                                </div>
                                <div className="flex flex-col">
                                    {group.questions.map((q, qIdx) => (
                                        <a key={qIdx} href="#" className="faq-list-item">
                                            <ChevronRight size={16} className="opacity-40" />
                                            {q}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="contact-section-pro">
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Contact Support Teams</h2>
                    <div className="contact-grid-pro">
                        {contactMethods.map((method, idx) => (
                            <div key={idx} className="contact-card-pro">
                                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 mx-auto mb-6">
                                    {method.icon}
                                </div>
                                <h3 className="text-xl font-black text-slate-800 mb-3">{method.title}</h3>
                                <p className="text-slate-500 font-medium text-sm mb-6 leading-relaxed">{method.description}</p>
                                
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-center gap-3 text-slate-600 font-bold text-sm">
                                        <Mail size={16} />
                                        <span>{method.email}</span>
                                    </div>
                                    <div className="flex items-center justify-center gap-3 text-slate-600 font-bold text-sm">
                                        <Phone size={16} />
                                        <span>{method.phone}</span>
                                    </div>
                                </div>
                                <button className="contact-btn-pro">Send Message</button>
                            </div>
                        ))}
                    </div>
                </div>

                <footer className="help-footer-pro p-12 text-center border-t border-slate-100 mt-12 bg-white" style={{ borderRadius: '24px'}}>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-4">&copy; 2026 Bavya TGS Governance. All rights reserved.</p>
                    <div className="flex justify-center gap-8 text-xs font-bold text-slate-500">
                        <a href="#" className="hover:text-[var(--primary)]">Privacy Policy</a>
                        <a href="#" className="hover:text-[var(--primary)]">Terms of Service</a>
                        <a href="#" className="flex items-center gap-2 hover:text-[var(--primary)]">
                            System Status <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        </a>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default HelpSupport;
