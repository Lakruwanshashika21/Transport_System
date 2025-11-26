import { useState } from 'react';
import { Menu, LogOut, User, MapPin, Calendar, FileText, Car, Users, Settings } from 'lucide-react';
import { User as UserType } from '../../App';

interface TopNavProps {
  user: UserType;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
  currentScreen?: string;
}

export function TopNav({ user, onNavigate, onLogout, currentScreen }: TopNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const userMenuItems = [
    { id: 'user-dashboard', label: 'Dashboard', icon: User },
    { id: 'book-vehicle', label: 'Book Vehicle', icon: Car },
    { id: 'trip-history', label: 'Trip History', icon: FileText },
  ];

  const driverMenuItems = [
    { id: 'driver-dashboard', label: 'Dashboard', icon: User },
    { id: 'trip-history', label: 'Trip History', icon: FileText },
  ];

  const adminMenuItems = [
    { id: 'admin-dashboard', label: 'Dashboard', icon: User },
    { id: 'trip-approval', label: 'Trip Approval', icon: Calendar },
    { id: 'vehicle-management', label: 'Vehicles', icon: Car },
    { id: 'driver-management', label: 'Drivers', icon: Users },
    { id: 'user-management', label: 'Users', icon: Users },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'trip-history', label: 'Trip History', icon: FileText },
  ];

  const menuItems = user.role === 'user' ? userMenuItems : user.role === 'driver' ? driverMenuItems : adminMenuItems;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2563EB] rounded-xl flex items-center justify-center">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="text-gray-900">Transport System</div>
              <div className="text-xs text-gray-500">{user.role?.toUpperCase()}</div>
            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center gap-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                    isActive
                      ? 'bg-[#2563EB] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block text-right">
              <div className="text-sm text-gray-900">{user.name}</div>
              <div className="text-xs text-gray-500">{user.email}</div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Logout</span>
            </button>
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-xl"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="lg:hidden py-4 border-t border-gray-200">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-1 ${
                    isActive
                      ? 'bg-[#2563EB] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}