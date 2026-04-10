import React, { useState } from 'react';
import ApprovalInbox from './ApprovalInbox';
import MyRequests from './MyRequests.jsx';
import { FileText, ClipboardList } from 'lucide-react';

const Outbox = () => {
    const [view, setView] = useState('approvals');

    return (
        <div className="outbox-module animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="master-page-header" style={{ padding: '20px 40px 0 40px', background: 'transparent', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px', letterSpacing: '-0.02em' }}>Outbox</h1>
                        {/* <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>Check your past approvals and active requests.</p> */}
                    </div>
                </div>
                
                <div className="outbox-header-tabs" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                    <button
                        onClick={() => setView('approvals')}
                        className={`tab-switcher-btn ${view === 'approvals' ? 'active' : ''}`}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '10px', 
                            padding: '12px 24px', 
                            borderRadius: '16px', 
                            fontWeight: 700, 
                            fontSize: '0.95rem',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            background: view === 'approvals' ? 'var(--primary)' : 'white',
                            color: view === 'approvals' ? 'white' : 'var(--text-muted)',
                            boxShadow: view === 'approvals' ? '0 10px 20px -5px rgba(0, 128, 128, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                            border: '1px solid ' + (view === 'approvals' ? 'var(--primary)' : 'rgba(226, 232, 240, 0.8)')
                        }}
                    >
                        <FileText size={20} />
                        History Approvals
                    </button>
                    <button
                        onClick={() => setView('requests')}
                        className={`tab-switcher-btn ${view === 'requests' ? 'active' : ''}`}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '10px', 
                            padding: '12px 24px', 
                            borderRadius: '16px', 
                            fontWeight: 700, 
                            fontSize: '0.95rem',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            background: view === 'requests' ? '#9333ea' : 'white',
                            color: view === 'requests' ? 'white' : 'var(--text-muted)',
                            boxShadow: view === 'requests' ? '0 10px 20px -5px rgba(147, 51, 234, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                            border: '1px solid ' + (view === 'requests' ? '#9333ea' : 'rgba(226, 232, 240, 0.8)')
                        }}
                    >
                        <ClipboardList size={20} />
                        My Active Requests
                    </button>
                </div>
            </div>

            <div className="outbox-content custom-scrollbar" style={{ flex: 1, overflow: 'auto', background: 'transparent', padding: '16px 40px' }}>
                <div className="content-inner-wrapper" style={{ maxWidth: '1600px', margin: '0 auto' }}>
                    {view === 'approvals' && <ApprovalInbox enforceTab="history" />}
                    {view === 'requests' && <MyRequests enforceView="active" />}
                </div>
            </div>
        </div>
    );
};

export default Outbox;
