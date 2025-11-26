import { useState, useEffect } from 'react';
import { Car, Calendar, Clock, MapPin, User as UserIcon, Phone, Navigation } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';

interface DriverDashboardProps {
  user: User;
  onNavigate: (screen: string, tripId?: string) => void;
  onLogout: () => void;
}

export function DriverDashboard({ user, onNavigate, onLogout }: DriverDashboardProps) {
  // 1. State
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [todaysTrips, setTodaysTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState('');

  // 2. Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // A. Fetch Available Vehicles
        // We only show vehicles that are currently 'available' for the driver to pick
        const vehiclesQuery = query(collection(db, "vehicles"), where("status", "==", "available"));
        const vehicleSnapshot = await getDocs(vehiclesQuery);
        const vehicleList = vehicleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAvailableVehicles(vehicleList);

        // B. Fetch My Assigned Trips
        // Filter by driverId matching the current user's ID and status='approved'
        const tripsQuery = query(
          collection(db, "trip_requests"), 
          where("driverId", "==", user.id),
          where("status", "==", "approved")
        );
        const tripsSnapshot = await getDocs(tripsQuery);
        const tripList = tripsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTodaysTrips(tripList);

        setLoading(false);
      } catch (error) {
        console.error("Error fetching driver data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [user.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-gray-500">Loading Dashboard...</div>
      </div>
    );
  }

  // Logic for "Next Trip" (just takes the first one for now)
  const nextTrip = todaysTrips.length > 0 ? todaysTrips[0] : null;
  const timeUntilTrip = nextTrip ? 'Upcoming' : '-'; 

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="driver-dashboard" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl text-gray-900 mb-2">Welcome, {user.name}!</h1>
          <p className="text-gray-600">Manage your trips and vehicle assignments</p>
        </div>

        {/* Vehicle Selection */}
        <Card className="p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#2563EB] rounded-xl flex items-center justify-center">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl text-gray-900">Today's Vehicle</h2>
              <p className="text-sm text-gray-600">Select your assigned vehicle for the day</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {availableVehicles.length === 0 ? (
              <p className="text-sm text-gray-500 col-span-3">No vehicles currently available.</p>
            ) : (
              availableVehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  onClick={() => setSelectedVehicle(vehicle.id)}
                  className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    selectedVehicle === vehicle.id
                      ? 'border-[#2563EB] bg-blue-50'
                      : 'border-gray-200 hover:border-[#2563EB]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                      <Car className="w-6 h-6 text-gray-600" />
                    </div>
                    <div>
                      <div className="text-gray-900">{vehicle.number}</div>
                      <div className="text-sm text-gray-500">{vehicle.model}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">{todaysTrips.length}</div>
                <div className="text-sm text-gray-500">Today's Trips</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">0</div>
                <div className="text-sm text-gray-500">Completed</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Navigation className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                {/* This would require summing up distance from completed trips */}
                <div className="text-2xl text-gray-900">-</div>
                <div className="text-sm text-gray-500">Total Distance</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Next Trip Card */}
        {nextTrip && (
          <Card className="p-6 mb-8 bg-gradient-to-r from-blue-50 to-white border-2 border-[#2563EB]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl text-gray-900 mb-1">Next Trip</h2>
                <p className="text-sm text-gray-600">Status: {timeUntilTrip}</p>
              </div>
              <Badge status={nextTrip.status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <UserIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-500">Customer</div>
                    <div className="text-gray-900">{nextTrip.customer || nextTrip.customerName}</div>
                    <div className="text-sm text-gray-600">{nextTrip.epf || nextTrip.epfNumber}</div>
                  </div>
                </div>

                <a
                  href={`tel:${nextTrip.phone}`}
                  className="flex items-center gap-2 text-[#2563EB] hover:text-[#1E40AF]"
                >
                  <Phone className="w-4 h-4" />
                  <span className="text-sm">{nextTrip.phone || 'No Phone'}</span>
                </a>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm text-gray-500">Pickup</div>
                    <div className="text-gray-900">{nextTrip.pickup}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#2563EB] mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm text-gray-500">Destination</div>
                    <div className="text-gray-900">{nextTrip.destination}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {nextTrip.time}
                </div>
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4" />
                  {nextTrip.distance || 'N/A'}
                </div>
              </div>
              <button
                onClick={() => onNavigate('driver-trip-detail', nextTrip.id)}
                className="px-6 py-2 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all"
              >
                View Details
              </button>
            </div>
          </Card>
        )}

        {/* Today's Trips List */}
        <div>
          <h2 className="text-xl text-gray-900 mb-4">All Trips Today</h2>
          
          <div className="grid grid-cols-1 gap-4">
            {todaysTrips.length === 0 && <p className="text-gray-500">No approved trips assigned to you yet.</p>}
            
            {todaysTrips.map((trip) => (
              <Card key={trip.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-gray-900 mb-1">Trip #{trip.id}</div>
                    <div className="flex items-center gap-3">
                      <Badge status={trip.status} size="sm" />
                      <div className="text-sm text-gray-600">{trip.time}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate('driver-trip-detail', trip.id)}
                    className="text-sm text-[#2563EB] hover:text-[#1E40AF]"
                  >
                    View Details
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">{trip.customer || trip.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{trip.phone || 'No Phone'}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      <MapPin className="w-4 h-4 inline text-gray-400 mr-1" />
                      {trip.pickup}
                    </div>
                    <div className="text-sm text-gray-600">
                      <MapPin className="w-4 h-4 inline text-[#2563EB] mr-1" />
                      {trip.destination}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}