import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext.jsx';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateTrip from './pages/CreateTrip';
import ExpenseEntry from './pages/ExpenseEntry';
import MileageCapture from './pages/MileageCapture';
import CFOWarRoom from './pages/CFOWarRoom';
import PolicyCenter from './pages/PolicyCenter';
import ApprovalInbox from './pages/ApprovalInbox';
import Inbox from './pages/Inbox';
import Outbox from './pages/Outbox';
import AdvanceRequest from './pages/AdvanceRequest';
import GuestHouse from './pages/GuestHouse';
import TripPlanner from './pages/TripPlanner';
import ClaimReview from './pages/ClaimReview';
import Settlement from './pages/Settlement';
import Disputes from './pages/Disputes';
import VendorSelection from './pages/VendorSelection';
import MyTrips from './pages/MyTrips';
import MyRequests from './pages/MyRequests.jsx';
import FinanceDashboard from './pages/FinanceDashboard';
import UserManagement from './pages/UserManagement';
import Profile from './pages/Profile';
import ApiManagement from './pages/ApiManagement';
import TripTimeline from './pages/TripTimeline';
import TravelTimeline from './pages/TravelTimeline';
import TripStory from './pages/TripStory';
import TravelStory from './pages/TravelStory';
import LoginHistory from './pages/LoginHistory';
import AuditLogs from './pages/AuditLogs';
import DocumentOrganizerPage from './pages/DocumentOrganizerPage';
import LocationCodes from './pages/LocationCodes';
import HelpSupport from './pages/HelpSupport';
import Fleet from './pages/Fleet';
import RouteManagement from './pages/RouteManagement';
import AdminMasterManagement from './pages/AdminMasterManagement';
import FuelMaster from './pages/FuelMaster';
import JobReport from './pages/JobReport';
import TravelCreation from './pages/TravelCreation';
import AdminMasters from './pages/AdminMasters';
import NotificationsPage from './pages/NotificationsPage';
import Settings from './pages/Settings';
import SupportBot from './components/SupportBot';
import AppVersionManagement from './pages/AppVersionManagement';
import ChangePassword from './pages/ChangePassword';
import ForgotPassword from './pages/ForgotPassword';
import FinanceWorkflowConfig from './pages/FinanceWorkflowConfig';
import HRPositionConfig from './pages/HRPositionConfig';
import ClaimReport from './pages/ClaimReport';


const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  return <Layout>{children}</Layout>;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  const roleName = (user.role || '').toLowerCase();
  const isAdmin = 
    roleName.includes('admin') || 
    roleName.includes('superuser') ||
    roleName.includes('finance') ||
    roleName.includes('cfo');
  
  if (!isAdmin) {
    return <Navigate to="/" />;
  }
  
  return <Layout>{children}</Layout>;
};

const ReportRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  if (!user.can_view_reports) {
    return <Navigate to="/" />;
  }
  
  return <Layout>{children}</Layout>;
};



import api from './api/api';
import { useToast } from './context/ToastContext.jsx';

const NotificationHandler = () => {
  const { user } = useAuth();
  
  React.useEffect(() => {
    if (!user) return;

    const registerSW = async () => {
      // 1. Always ask for permission if not already decided, regardless of protocol
      if ('Notification' in window && (Notification.permission === 'default' || Notification.permission === 'prompt')) {
        console.log('Proactively requesting notification permission...');
        await Notification.requestPermission();
      }

      // 2. Security Check for Push (Push API requires secure context or localhost)
      const isSecure = window.location.protocol === 'https:' || 
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
      
      if (!isSecure && window.location.hostname !== 'localhost') {
        console.warn('System Notifications (Push) registration skipped: Insecure HTTP context.');
        return;
      }

      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          
          if (Notification.permission === 'granted') {
            const VAPID_PUBLIC_KEY = "BEjEe1eOPD-gYTA-7msDABtNpiSF9wx5NgFhfxvBy_iPEwlbQ7WsgorcovmftYf__Uo7bdPTKDSoORmqBy_UY6Y";
            
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: VAPID_PUBLIC_KEY
              });
            }
            
            // Send subscription to backend
            await api.post('/api/notifications/push/', subscription);
            console.log('Push subscription successful and registered on backend');
          }
        } catch (error) {
          console.error('Push API registration failed:', error);
        }
      }
    };

    registerSW();
  }, [user]);

  return null;
};

const ApiErrorHandler = () => {
  const { showToast } = useToast();
  React.useEffect(() => {
    api.setErrorHandler(showToast);
  }, [showToast]);
  return null;
};

const ReminderHandler = () => {
  const { user, heartbeatData, fetchHeartbeat } = useAuth();
  const { showToast, showReminder } = useToast();
  const triggeredRef = React.useRef(new Set());
  const audioRef = React.useRef(new Audio('/_Tic_Tac_Alarm_Ringtone.mp3'));
  const [isAlerting, setIsAlerting] = React.useState(false);
  const stopAudioRef = React.useRef(false);

  const stopAlert = React.useCallback(() => {
    stopAudioRef.current = true;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsAlerting(false);
  }, []);

  const playAlert = React.useCallback(async (count = 5) => {
    stopAudioRef.current = false;
    setIsAlerting(true);
    
    // Ensure audio is loaded and volume is up
    audioRef.current.load();
    audioRef.current.volume = 1.0;

    for (let i = 0; i < count; i++) {
      if (stopAudioRef.current) break;
      try {
        console.log(`[Alarm] Playing attempt ${i + 1}`);
        await audioRef.current.play();
        
        await new Promise(resolve => {
          const onEnded = () => {
            audioRef.current.removeEventListener('ended', onEnded);
            setTimeout(resolve, 1500); // 1.5s gap between rings
          };
          audioRef.current.addEventListener('ended', onEnded);
          
          const interval = setInterval(() => {
            if (stopAudioRef.current) {
              clearInterval(interval);
              resolve();
            }
          }, 100);
        });
      } catch (err) {
        console.warn("[Alarm] Playback failed:", err);
        // Only show toast if it's not a user-initiated pause
        if (!stopAudioRef.current) {
            showToast("Alarm sound blocked by browser. Please click anywhere on the page to enable audio.", "warning");
        }
        break;
      }
    }
    setIsAlerting(false);
  }, [showToast]);

  const handleSnooze = React.useCallback(async (reminder) => {
    stopAlert();
    try {
        // 1. Acknowledge original reminder first to clear the duplicate check
        await api.patch(`/api/notifications/reminders/${reminder.id}/`, { acknowledged: true });
        
        // 2. Create the snoozed reminder
        const snoozeTime = new Date(Date.now() + 5 * 60000).toISOString();
        await api.post('/api/notifications/reminders/', {
            title: `[SNOOZED] ${reminder.title}`,
            message: reminder.message,
            remind_at: snoozeTime,
            category: reminder.category,
            trip: reminder.trip
        });
        
        showToast("Snoozed for 5 minutes", "success");
        fetchHeartbeat(); // Sync UI
    } catch (err) {
        console.error("Snooze failed:", err);
        showToast("Failed to snooze reminder", "error");
    }
  }, [stopAlert, showToast, fetchHeartbeat]);

  const scheduledRef = React.useRef(new Set());

  const triggerAlert = React.useCallback((reminder) => {
    if (triggeredRef.current.has(reminder.id)) return;
    triggeredRef.current.add(reminder.id);
    
    if (showReminder) {
        showReminder(`REMINDER: ${reminder.title}`, {
            onStop: async () => {
              stopAlert();
              try {
                await api.patch(`/api/notifications/reminders/${reminder.id}/`, { acknowledged: true });
                fetchHeartbeat();
              } catch (e) {
                console.error("Failed to acknowledge reminder:", e);
              }
            },
            onSnooze: () => handleSnooze(reminder)
        });
    } else {
        showToast(`REMINDER: ${reminder.title}`, "info");
    }
    playAlert(5);
  }, [showReminder, showToast, stopAlert, handleSnooze, fetchHeartbeat, playAlert]);

  const checkReminders = React.useCallback(() => {
    if (!user || !heartbeatData?.due_reminders) return;
    
    const now = Date.now();
    const reminders = heartbeatData.due_reminders;

    for (const reminder of reminders) {
      if (triggeredRef.current.has(reminder.id)) continue;

      const remindAt = new Date(reminder.remind_at).getTime();
      const delay = remindAt - now;

      if (delay <= 0) {
        // Due now or passed
        triggerAlert(reminder);
      } else if (!scheduledRef.current.has(reminder.id)) {
        // Due soon - schedule it
        scheduledRef.current.add(reminder.id);
        setTimeout(() => {
          scheduledRef.current.delete(reminder.id);
          triggerAlert(reminder);
        }, delay);
      }
    }
  }, [user, heartbeatData, triggerAlert]);

  React.useEffect(() => {
    if (user) {
      checkReminders();
    }
  }, [user, heartbeatData, checkReminders]);

  return null;
};

import { ThemeProvider } from './context/ThemeContext';

const SupportBotWrapper = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading || !user || location.pathname === '/login') {
    return null;
  }
  
  return <SupportBot />;
};

function App() {
  return (
    <ToastProvider>
      <ApiErrorHandler />
      <AuthProvider>
        <ThemeProvider>
          <NotificationHandler />
          <ReminderHandler />
          <Router>
            <SupportBotWrapper />
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/trips" element={<ProtectedRoute><MyTrips /></ProtectedRoute>} />
            <Route path="/my-requests" element={<ProtectedRoute><MyRequests /></ProtectedRoute>} />
            <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
            <Route path="/outbox" element={<ProtectedRoute><Outbox /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><DocumentOrganizerPage /></ProtectedRoute>} />
            <Route path="/planner" element={<ProtectedRoute><TripPlanner /></ProtectedRoute>} />
            <Route path="/create-trip" element={<ProtectedRoute><CreateTrip /></ProtectedRoute>} />
            <Route path="/approvals" element={<ProtectedRoute><ApprovalInbox /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute><ExpenseEntry /></ProtectedRoute>} />
            <Route path="/mileage" element={<ProtectedRoute><MileageCapture /></ProtectedRoute>} />
            <Route path="/advance" element={<ProtectedRoute><AdvanceRequest /></ProtectedRoute>} />
            <Route path="/guesthouse" element={<ProtectedRoute><GuestHouse /></ProtectedRoute>} />
            <Route path="/fleet" element={<ProtectedRoute><Fleet /></ProtectedRoute>} />
            <Route path="/claim-review" element={<ProtectedRoute><ClaimReview /></ProtectedRoute>} />
            <Route path="/settlement" element={<ProtectedRoute><Settlement /></ProtectedRoute>} />
            <Route path="/disputes" element={<ProtectedRoute><Disputes /></ProtectedRoute>} />
            <Route path="/vendors" element={<ProtectedRoute><VendorSelection /></ProtectedRoute>} />
            <Route path="/location-codes" element={<ProtectedRoute><LocationCodes /></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute><FinanceDashboard /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/policy" element={<ProtectedRoute><PolicyCenter /></ProtectedRoute>} />
            <Route path="/cfo-war-room" element={<ProtectedRoute><CFOWarRoom /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/api-management" element={<ProtectedRoute><ApiManagement /></ProtectedRoute>} />
            <Route path="/trip-timeline/:id" element={<ProtectedRoute><TripTimeline /></ProtectedRoute>} />
            <Route path="/travel-timeline/:id" element={<ProtectedRoute><TravelTimeline /></ProtectedRoute>} />
            <Route path="/trip-story/:id" element={<ProtectedRoute><TripStory /></ProtectedRoute>} />
            <Route path="/travel-story/:id" element={<ProtectedRoute><TravelStory /></ProtectedRoute>} />
            <Route path="/login-history" element={<ProtectedRoute><LoginHistory /></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
            <Route path="/help" element={<ProtectedRoute><HelpSupport /></ProtectedRoute>} />
            <Route path="/route-management" element={<ProtectedRoute><RouteManagement /></ProtectedRoute>} />
            <Route path="/master-management" element={<ProtectedRoute><AdminMasterManagement /></ProtectedRoute>} />
            <Route path="/job-report" element={<ProtectedRoute><JobReport /></ProtectedRoute>} />
            <Route path="/fuel-master" element={<ProtectedRoute><FuelMaster /></ProtectedRoute>} />
            <Route path="/travel-creation" element={<ProtectedRoute><TravelCreation /></ProtectedRoute>} />
            <Route path="/travel-timeline/:id" element={<ProtectedRoute><TravelTimeline /></ProtectedRoute>} />
            <Route path="/AdminMasters" element={<ProtectedRoute><AdminMasters /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/finance-workflow" element={<AdminRoute><FinanceWorkflowConfig /></AdminRoute>} />
            <Route path="/hr-positions" element={<AdminRoute><HRPositionConfig /></AdminRoute>} />
            <Route path="/claim-report" element={<ReportRoute><ClaimReport /></ReportRoute>} />

            <Route path="/app-version" element={<AdminRoute><AppVersionManagement /></AdminRoute>} />
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
</ToastProvider>
  );
}

export default App;