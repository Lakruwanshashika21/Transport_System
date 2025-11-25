import { useState } from 'react';
import { Login } from './components/auth/Login';
import { UserRegistration } from './components/auth/UserRegistration';
import { DriverRegistration } from './components/auth/DriverRegistration';
import { AdminRegistration } from './components/auth/AdminRegistration';
import { UserDashboard } from './components/user/UserDashboard';
import { BookVehicle } from './components/user/BookVehicle';
import { ViewTrip } from './components/user/ViewTrip';
import { DriverDashboard } from './components/driver/DriverDashboard';
import { DriverTripDetail } from './components/driver/DriverTripDetail';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TripApproval } from './components/admin/TripApproval';
import { VehicleManagement } from './components/admin/VehicleManagement';
import { DriverManagement } from './components/admin/DriverManagement';
import { UserManagement } from './components/admin/UserManagement';
import { Reports } from './components/admin/Reports';
import { TripHistory } from './components/shared/TripHistory';

export type UserRole = 'user' | 'driver' | 'admin' | null;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  epfNumber?: string;
  phone?: string;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [user, setUser] = useState<User | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const handleLogin = (userData: User) => {
    setUser(userData);
    if (userData.role === 'user') {
      setCurrentScreen('user-dashboard');
    } else if (userData.role === 'driver') {
      setCurrentScreen('driver-dashboard');
    } else if (userData.role === 'admin') {
      setCurrentScreen('admin-dashboard');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentScreen('login');
  };

  const navigate = (screen: string, tripId?: string) => {
    setCurrentScreen(screen);
    if (tripId) setSelectedTripId(tripId);
  };

  // Auth screens
  if (currentScreen === 'login') {
    return <Login onLogin={handleLogin} onNavigate={navigate} />;
  }

  if (currentScreen === 'user-registration') {
    return <UserRegistration onBack={() => navigate('login')} onRegister={() => navigate('login')} />;
  }

  if (currentScreen === 'driver-registration') {
    return <DriverRegistration onBack={() => navigate('login')} onRegister={() => navigate('login')} />;
  }

  if (currentScreen === 'admin-registration') {
    return <AdminRegistration onBack={() => navigate('login')} onRegister={() => navigate('login')} />;
  }

  // User screens
  if (user?.role === 'user') {
    if (currentScreen === 'user-dashboard') {
      return <UserDashboard user={user} onNavigate={navigate} onLogout={handleLogout} />;
    }
    if (currentScreen === 'book-vehicle') {
      return <BookVehicle user={user} onNavigate={navigate} onLogout={handleLogout} />;
    }
    if (currentScreen === 'view-trip') {
      return <ViewTrip user={user} tripId={selectedTripId} onNavigate={navigate} onLogout={handleLogout} />;
    }
    if (currentScreen === 'trip-history') {
      return <TripHistory user={user} onNavigate={navigate} onLogout={handleLogout} />;
    }
  }

  // Driver screens
  if (user?.role === 'driver') {
    if (currentScreen === 'driver-dashboard') {
      return <DriverDashboard user={user} onNavigate={navigate} onLogout={handleLogout} />;
    }
    if (currentScreen === 'driver-trip-detail') {
      return <DriverTripDetail user={user} tripId={selectedTripId} onNavigate={navigate} onLogout={handleLogout} />;
    }
    if (currentScreen === 'trip-history') {
      return <TripHistory user={user} onNavigate={navigate} onLogout={handleLogout} />;
    }
  }

  // Admin screens
  if (user?.role === 'admin') {
    if (currentScreen === 'admin-dashboard') {
      return <AdminDashboard user={user} onNavigate={navigate} onLogout={handleLogout} />;
    }
    if (currentScreen === 'trip-approval') {
      return <TripApproval user={user} onNavigate={navigate} onLogout={handleLogout} />;
    }
    if (currentScreen === 'vehicle-management') {
      return <VehicleManagement user={user} onNavigate={navigate} onLogout={handleLogout} />;
    }
    if (currentScreen === 'driver-management') {
      return <DriverManagement user={user} onNavigate={navigate} onLogout={handleLogout} />;
    }
    if (currentScreen === 'user-management') {
      return <UserManagement user={user} onNavigate={navigate} onLogout={handleLogout} />;
    }
    if (currentScreen === 'reports') {
      return <Reports user={user} onNavigate={navigate} onLogout={handleLogout} />;
    }
    if (currentScreen === 'trip-history') {
      return <TripHistory user={user} onNavigate={navigate} onLogout={handleLogout} />;
    }
  }

  return <Login onLogin={handleLogin} onNavigate={navigate} />;
}
