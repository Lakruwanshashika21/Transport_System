import { useState, useEffect } from 'react';
import { Login } from './components/auth/Login';
import { UserRegistration } from './components/user/UserRegistration';
import { DriverRegistration } from './components/driver/DriverRegistration';
import { AdminRegistration } from './components/admin/AdminRegistration';
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

// Firebase Imports
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

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
  // FIX: Start with null (Logged Out) instead of mock data
  const [user, setUser] = useState<User | null>(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch extra user details from Firestore (Role, Name, EPF)
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              id: firebaseUser.uid,
              name: userData.name || userData.fullName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: userData.role || 'user', // Default to user if role missing
              ...userData
            } as User);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        // User is signed out
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
}

export default App;