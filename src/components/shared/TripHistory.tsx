import { useState } from 'react';
import { Search, Calendar, Car, User as UserIcon, MapPin, Download, Filter } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from './TopNav';
import { Card } from './Card';
import { Badge } from './Badge';

interface TripHistoryProps {
  user: User;
  onNavigate: (screen: string, tripId?: string) => void;
  onLogout: () => void;
}

const allTrips = [
  {
    id: 'TRP001',
    date: '2025-11-20',
    time: '09:00 AM',
    vehicle: 'CAB-2345',
    driver: 'Mike Wilson',
    customer: 'John Doe',
    epf: 'EPF12345',
    pickup: 'Office Building A',
    destination: 'Client Meeting - Downtown',
    distance: '12.5 km',
    cost: 'LKR 1,500',
    status: 'completed' as const,
  },
  {
    id: 'TRP002',
    date: '2025-11-21',
    time: '02:00 PM',
    vehicle: 'VAN-5678',
    driver: 'Sarah Johnson',
    customer: 'Jane Smith',
    epf: 'EPF67890',
    pickup: 'Main Office',
    destination: 'Airport Terminal',
    distance: '35.2 km',
    cost: 'LKR 4,200',
    status: 'completed' as const,
  },
  {
    id: 'TRP003',
    date: '2025-11-22',
    time: '10:30 AM',
    vehicle: 'CAR-1234',
    driver: 'David Miller',
    customer: 'Robert Chen',
    epf: 'EPF54321',
    pickup: 'Branch Office',
    destination: 'Conference Center',
    distance: '18.5 km',
    cost: 'LKR 2,200',
    status: 'completed' as const,
  },
  {
    id: 'TRP004',
    date: '2025-11-23',
    time: '11:00 AM',
    vehicle: 'CAB-2345',
    driver: 'Mike Wilson',
    customer: 'Emily Brown',
    epf: 'EPF98765',
    pickup: 'Head Office',
    destination: 'Shopping Mall',
    distance: '8.3 km',
    cost: 'LKR 1,000',
    status: 'completed' as const,
  },
  {
    id: 'TRP005',
    date: '2025-11-24',
    time: '03:30 PM',
    vehicle: 'VAN-5678',
    driver: 'Sarah Johnson',
    customer: 'John Doe',
    epf: 'EPF12345',
    pickup: 'Office Complex',
    destination: 'Training Center',
    distance: '22.1 km',
    cost: 'LKR 2,650',
    status: 'cancelled' as const,
  },
];

export function TripHistory({ user, onNavigate, onLogout }: TripHistoryProps) {
  const [filters, setFilters] = useState({
    vehicleNumber: '',
    epfNumber: '',
    dateRange: '',
  });
  const [selectedTrip, setSelectedTrip] = useState<any>(null);

  const filteredTrips = allTrips.filter((trip) => {
    if (filters.vehicleNumber && !trip.vehicle.toLowerCase().includes(filters.vehicleNumber.toLowerCase())) return false;
    if (filters.epfNumber && !trip.epf.toLowerCase().includes(filters.epfNumber.toLowerCase())) return false;
    if (filters.dateRange && trip.date !== filters.dateRange) return false;
    
    // For users, only show their trips
    if (user.role === 'user' && trip.epf !== user.epfNumber) return false;
    
    return true;
  });

  const handleDownloadPDF = (trip: any) => {
    alert(`Downloading PDF for trip ${trip.id}`);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="trip-history" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-3xl text-gray-900 mb-2">Trip History</h1>
          <p className="text-gray-600">View and search past trips</p>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg text-gray-900">Search Filters</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">Vehicle Number</label>
              <div className="relative">
                <input
                  type="text"
                  value={filters.vehicleNumber}
                  onChange={(e) => setFilters({ ...filters, vehicleNumber: e.target.value })}
                  placeholder="CAB-2345"
                  className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>

            {user.role !== 'user' && (
              <div>
                <label className="block text-sm text-gray-700 mb-2">EPF Number</label>
                <div className="relative">
                  <input
                    type="text"
                    value={filters.epfNumber}
                    onChange={(e) => setFilters({ ...filters, epfNumber: e.target.value })}
                    placeholder="EPF12345"
                    className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-700 mb-2">Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.dateRange}
                  onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                  className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>

          {(filters.vehicleNumber || filters.epfNumber || filters.dateRange) && (
            <button
              onClick={() => setFilters({ vehicleNumber: '', epfNumber: '', dateRange: '' })}
              className="mt-4 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all"
            >
              Clear Filters
            </button>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trip List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Showing {filteredTrips.length} trip{filteredTrips.length !== 1 ? 's' : ''}
            </div>

            {filteredTrips.map((trip) => (
              <Card 
                key={trip.id} 
                onClick={() => setSelectedTrip(trip)}
                className={`p-6 cursor-pointer transition-all ${
                  selectedTrip?.id === trip.id ? 'ring-2 ring-[#2563EB]' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-lg text-gray-900 mb-1">Trip #{trip.id}</div>
                    <div className="flex items-center gap-3">
                      <Badge status={trip.status} size="sm" />
                      <div className="text-sm text-gray-600">{trip.date} • {trip.time}</div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadPDF(trip);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    <Download className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-gray-500">Pickup</div>
                        <div className="text-sm text-gray-900">{trip.pickup}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-[#2563EB] mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-gray-500">Destination</div>
                        <div className="text-sm text-gray-900">{trip.destination}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-gray-500">Vehicle:</span>
                      <span className="text-gray-900 ml-2">{trip.vehicle}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Driver:</span>
                      <span className="text-gray-900 ml-2">{trip.driver}</span>
                    </div>
                    {user.role !== 'user' && (
                      <div className="text-sm">
                        <span className="text-gray-500">Customer:</span>
                        <span className="text-gray-900 ml-2">{trip.customer}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            {filteredTrips.length === 0 && (
              <Card className="p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No trips found matching your filters</p>
              </Card>
            )}
          </div>

          {/* Trip Details Sidebar */}
          <div className="lg:col-span-1">
            {selectedTrip ? (
              <Card className="p-6 sticky top-24">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg text-gray-900">Trip Details</h2>
                  <Badge status={selectedTrip.status} />
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">Trip ID</div>
                    <div className="text-gray-900">{selectedTrip.id}</div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">Date & Time</div>
                    <div className="text-gray-900">{selectedTrip.date}</div>
                    <div className="text-gray-900">{selectedTrip.time}</div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-xs text-gray-500 mb-2">Route</div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-green-600 mt-0.5" />
                        <div className="text-sm text-gray-900">{selectedTrip.pickup}</div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-[#2563EB] mt-0.5" />
                        <div className="text-sm text-gray-900">{selectedTrip.destination}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">Vehicle</div>
                    <div className="text-gray-900">{selectedTrip.vehicle}</div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">Driver</div>
                    <div className="text-gray-900">{selectedTrip.driver}</div>
                  </div>

                  {user.role !== 'user' && (
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="text-xs text-gray-500 mb-1">Customer</div>
                      <div className="text-gray-900">{selectedTrip.customer}</div>
                      <div className="text-sm text-gray-600">{selectedTrip.epf}</div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="text-xs text-gray-500 mb-1">Distance</div>
                      <div className="text-gray-900">{selectedTrip.distance}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="text-xs text-gray-500 mb-1">Cost</div>
                      <div className="text-gray-900">{selectedTrip.cost}</div>
                    </div>
                  </div>

                  {/* Mock GPS Route */}
                  <div className="p-4 bg-gray-100 rounded-xl">
                    <div className="text-xs text-gray-500 mb-2">GPS Route Preview</div>
                    <div className="w-full h-40 bg-gray-200 rounded-lg flex items-center justify-center">
                      <MapPin className="w-8 h-8 text-gray-400" />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDownloadPDF(selectedTrip)}
                  className="w-full mt-6 flex items-center justify-center gap-2 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all"
                >
                  <Download className="w-5 h-5" />
                  Download PDF
                </button>
              </Card>
            ) : (
              <Card className="p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Select a trip to view details</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
