import { Car, Calendar, CheckCircle, XCircle, Navigation, Users, AlertCircle } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';

interface AdminDashboardProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

const liveVehicles = [
  { id: '1', number: 'CAB-2345', status: 'in-use' as const, location: 'Colombo 03', driver: 'Mike Wilson' },
  { id: '2', number: 'VAN-5678', status: 'available' as const, location: 'Parking', driver: 'Unassigned' },
  { id: '3', number: 'CAR-1234', status: 'in-use' as const, location: 'Colombo 02', driver: 'Sarah Johnson' },
  { id: '4', number: 'SUV-9012', status: 'maintenance' as const, location: 'Workshop', driver: 'Unassigned' },
];

const pendingRequests = [
  {
    id: 'TRP006',
    customer: 'Robert Chen',
    epf: 'EPF54321',
    pickup: 'Branch Office',
    destination: 'City Center',
    date: '2025-11-26',
    time: '10:00 AM',
  },
  {
    id: 'TRP007',
    customer: 'Emily Brown',
    epf: 'EPF98765',
    pickup: 'Head Office',
    destination: 'Conference Hall',
    date: '2025-11-26',
    time: '02:30 PM',
  },
];

export function AdminDashboard({ user, onNavigate, onLogout }: AdminDashboardProps) {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="admin-dashboard" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Monitor and manage the entire transport system</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">12</div>
                <div className="text-sm text-gray-500">Total Trips Today</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Car className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">3</div>
                <div className="text-sm text-gray-500">Active Vehicles</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">8</div>
                <div className="text-sm text-gray-500">Completed Trips</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">1</div>
                <div className="text-sm text-gray-500">Cancellations</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Pending Requests Alert */}
        {pendingRequests.length > 0 && (
          <div className="mb-8">
            <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg text-gray-900 mb-2">Pending Trip Approvals</h3>
                  <p className="text-gray-600 mb-4">
                    You have {pendingRequests.length} trip requests waiting for approval
                  </p>
                  <button
                    onClick={() => onNavigate('trip-approval')}
                    className="px-6 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-all"
                  >
                    Review Requests
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Vehicle Map */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h2 className="text-xl text-gray-900 mb-4">Live Vehicle Tracking</h2>
              
              {/* Mock Map */}
              <div className="w-full h-96 bg-gray-200 rounded-xl flex items-center justify-center mb-4">
                <div className="text-center">
                  <Navigation className="w-16 h-16 text-[#2563EB] mx-auto mb-3" />
                  <p className="text-gray-500">Real-time Vehicle Locations</p>
                  <p className="text-sm text-gray-400">Interactive map with live GPS tracking</p>
                </div>
              </div>

              {/* Vehicle List */}
              <div className="space-y-3">
                {liveVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                        <Car className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <div className="text-sm text-gray-900">{vehicle.number}</div>
                        <div className="text-xs text-gray-500">{vehicle.location}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-600">{vehicle.driver}</div>
                      <Badge status={vehicle.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <Card 
              onClick={() => onNavigate('trip-approval')}
              className="p-6 cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <div className="text-gray-900">Trip Approval</div>
                  <div className="text-sm text-gray-500">{pendingRequests.length} pending</div>
                </div>
              </div>
            </Card>

            <Card 
              onClick={() => onNavigate('vehicle-management')}
              className="p-6 cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <Car className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="text-gray-900">Vehicle Management</div>
                  <div className="text-sm text-gray-500">Manage fleet</div>
                </div>
              </div>
            </Card>

            <Card 
              onClick={() => onNavigate('driver-management')}
              className="p-6 cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <div className="text-gray-900">Driver Management</div>
                  <div className="text-sm text-gray-500">Assign drivers</div>
                </div>
              </div>
            </Card>

            <Card 
              onClick={() => onNavigate('user-management')}
              className="p-6 cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-[#2563EB]" />
                </div>
                <div>
                  <div className="text-gray-900">User Management</div>
                  <div className="text-sm text-gray-500">Search users</div>
                </div>
              </div>
            </Card>

            <Card 
              onClick={() => onNavigate('reports')}
              className="p-6 cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <div className="text-gray-900">Reports</div>
                  <div className="text-sm text-gray-500">Generate reports</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
