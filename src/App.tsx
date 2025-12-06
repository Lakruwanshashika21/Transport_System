import { useState, useEffect } from 'react';
import { Login } from './components/auth/Login';
import { UserRegistration } from './components/auth/UserRegistration';
import { DriverRegistration } from './components/auth/DriverRegistration';
import { AdminRegistration } from './components/auth/AdminRegistration';
import { UserDashboard } from './components/user/UserDashboard';
import { DriverDashboard } from './components/driver/DriverDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TripApproval } from './components/admin/TripApproval';
import { VehicleManagement } from './components/admin/VehicleManagement';
import { DriverManagement } from './components/admin/DriverManagement';
import { UserManagement } from './components/admin/UserManagement';
import { Reports } from './components/admin/Reports';
import { BookVehicle } from './components/user/BookVehicle';
import { ViewTrip } from './components/user/ViewTrip';
import { DriverTripDetail } from './components/driver/DriverTripDetail';
import { TripHistory } from './components/shared/TripHistory';
import { AdminManagement } from './components/admin/AdminManagement'; 
// 1. IMPORT ADMIN HISTORY
import { AdminHistory } from './components/admin/AdminHistory';

import { InstallPrompt } from './components/shared/InstallPrompt';
import { Footer } from './components/shared/Footer'; 

// Firebase Imports
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { QuickTripBooking } from './components/admin/QuickTripBooking';

// Type definition for User
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'driver' | 'admin';
  epfNumber?: string;
  phone?: string;
  department?: string;
  joinDate?: string;
  [key: string]: any;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Global Ban Check
            if (userData.status === 'banned') {
               await signOut(auth);
               setUser(null);
               setCurrentScreen('login');
               setLoading(false);
               return;
            }

            setUser({
              id: firebaseUser.uid,
              name: userData.name || userData.fullName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: userData.role || 'user', 
              ...userData
            } as User);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setUser(null);
        setCurrentScreen('login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentScreen('dashboard');
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setCurrentScreen('login');
  };

  const handleNavigate = (screen: string, tripId?: string) => {
    setCurrentScreen(screen);
    if (tripId) setSelectedTripId(tripId);
  };

  // Render Content Helper
  const renderContent = () => {
    if (loading) {
      return <div className="min-h-screen flex items-center justify-center">Loading Transport System...</div>;
    }

    // --- AUTHENTICATION FLOW ---
    if (!user) {
      switch (currentScreen) {
        case 'user-registration':
          return <UserRegistration onBack={() => setCurrentScreen('login')} onRegister={() => setCurrentScreen('login')} />;
        case 'driver-registration':
          return <DriverRegistration onBack={() => setCurrentScreen('login')} onRegister={() => setCurrentScreen('login')} />;
        case 'admin-registration':
          return <AdminRegistration onBack={() => setCurrentScreen('login')} onRegister={() => setCurrentScreen('login')} />;
        default:
          return <Login onLogin={handleLogin} onNavigate={setCurrentScreen} />;
      }
    }

    // --- MAIN APP FLOW (LOGGED IN) ---
    
    // 1. ADMIN SCREENS
    if (user.role === 'admin') {
      switch (currentScreen) {
        case 'trip-approval':
          return <TripApproval user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
        case 'vehicle-management':
          return <VehicleManagement user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
        case 'driver-management':
          return <DriverManagement user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
        case 'user-management':
          return <UserManagement user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
        case 'reports':
          return <Reports user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
        case 'trip-history':
          return <TripHistory user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
        case 'quick-book-trip': // Correctly routing to the new screen
          return <QuickTripBooking adminUser={user} onTripCreated={() => handleNavigate('trip-approval')} />;
        case 'admin-management':
          return (<AdminManagement user={user} onNavigate={handleNavigate} onLogout={handleLogout} />);
        
        // 2. NEW CASE FOR ADMIN HISTORY
        case 'admin-history':
          return <AdminHistory user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
          
        default:
          return <AdminDashboard user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
      }
    }

    // 2. DRIVER SCREENS
    if (user.role === 'driver') {
      switch (currentScreen) {
        case 'driver-trip-detail':
          return <DriverTripDetail user={user} tripId={selectedTripId} onNavigate={handleNavigate} onLogout={handleLogout} />;
        case 'trip-history':
          return <TripHistory user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
        default:
          return <DriverDashboard user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
      }
    }

    // 3. USER SCREENS (Default)
    switch (currentScreen) {
      case 'book-vehicle':
        return <BookVehicle user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
      case 'view-trip':
        return <ViewTrip user={user} tripId={selectedTripId} onNavigate={handleNavigate} onLogout={handleLogout} />;
      case 'trip-history':
        return <TripHistory user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
      default:
        return <UserDashboard user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-grow">
        {renderContent()}
      </div>
      
      {/* 2. Footer Component Here (Always Visible) */}
      <Footer />
      
      <InstallPrompt />
    </div>
  );
}

export default App;