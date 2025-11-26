import { useState, useEffect } from 'react';
import { Search, Calendar, Car, User as UserIcon, MapPin, Download, Filter } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from './TopNav';
import { Card } from './Card';
import { Badge } from './Badge';
// Firebase Imports
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';

interface TripHistoryProps {
  user: User;
  onNavigate: (screen: string, tripId?: string) => void;
  onLogout: () => void;
}

export function TripHistory({ user, onNavigate, onLogout }: TripHistoryProps) {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    vehicleNumber: '',
    epfNumber: '',
    dateRange: '',
  });
  const [selectedTrip, setSelectedTrip] = useState<any>(null);

  // 1. Fetch Data based on Role
  useEffect(() => {
    const fetchTrips = async () => {
      try {
        let q;
        const tripsRef = collection(db, "trip_requests");

        // Define query based on role
        if (user.role === 'admin') {
          // Admin sees all trips
          q = query(tripsRef, orderBy('date', 'desc')); // Requires Firestore Index, or remove orderBy if it fails initially
        } else if (user.role === 'driver') {
          // Driver sees only their assigned trips
          q = query(tripsRef, where('driverId', '==', user.id));
        } else {
          // User sees only their requested trips
          // checking 'userId' matching their auth UID
          q = query(tripsRef, where('userId', '==', user.id));
        }

        // Fallback if complex query fails (e.g. missing index): just get all and filter in JS
        // For this demo, let's try the specific query first.
        // Note: 'orderBy' with 'where' requires a composite index in Firestore. 
        // If you get an error in console, create the index via the link provided in the error.
        
        const querySnapshot = await getDocs(q);
        const fetchedTrips = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Client-side sort if server-side sort wasn't applied (to handle simple query fallbacks)
        fetchedTrips.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setTrips(fetchedTrips);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching trip history:", error);
        setLoading(false);
      }
    };

    fetchTrips();
  }, [user]);

  // 2. Client-Side Filtering
  const filteredTrips = trips.filter((trip) => {
    const vehicle = trip.vehicleNumber || trip.vehicle || '';
    const epf = trip.epfNumber || trip.epf || '';
    
    if (filters.vehicleNumber && !vehicle.toLowerCase().includes(filters.vehicleNumber.toLowerCase())) return false;
    if (filters.epfNumber && !epf.toLowerCase().includes(filters.epfNumber.toLowerCase())) return false;
    if (filters.dateRange && trip.date !== filters.dateRange) return false;
    
    return true;
  });

  const handleDownloadPDF = (trip: any) => {
    alert(`Downloading PDF for trip ${trip.id}... (Feature coming soon)`);
  };

  if (loading) {
    return <div className="p-10 text-center">Loading Trip History...</div>;
  }

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

            {/* Only Admins or Drivers usually need to search by EPF to find specific employees */}
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
                      <span className="text-gray-900 ml-2">{trip.vehicleNumber || trip.vehicle || 'Pending'}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Driver:</span>
                      <span className="text-gray-900 ml-2">{trip.driverName || trip.driver || 'Pending'}</span>
                    </div>
                    {user.role !== 'user' && (
                      <div className="text-sm">
                        <span className="text-gray-500">Customer:</span>
                        <span className="text-gray-900 ml-2">{trip.customerName || trip.customer}</span>
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
                    <div className="text-gray-900">{selectedTrip.vehicleNumber || selectedTrip.vehicle || 'Not assigned'}</div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">Driver</div>
                    <div className="text-gray-900">{selectedTrip.driverName || selectedTrip.driver || 'Not assigned'}</div>
                  </div>

                  {user.role !== 'user' && (
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="text-xs text-gray-500 mb-1">Customer</div>
                      <div className="text-gray-900">{selectedTrip.customerName || selectedTrip.customer}</div>
                      <div className="text-sm text-gray-600">{selectedTrip.epfNumber || selectedTrip.epf}</div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="text-xs text-gray-500 mb-1">Distance</div>
                      <div className="text-gray-900">{selectedTrip.distance || '-'}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="text-xs text-gray-500 mb-1">Cost</div>
                      <div className="text-gray-900">{selectedTrip.cost || '-'}</div>
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