import { useState, useEffect } from 'react';
import { Calendar, MapPin, Clock, Car, Plus, History } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

interface UserDashboardProps {
  user: User;
  onNavigate: (screen: string, tripId?: string) => void;
  onLogout: () => void;
}

export function UserDashboard({ user, onNavigate, onLogout }: UserDashboardProps) {
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [pastTrips, setPastTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        // Fetch trips for the current user
        const q = query(
          collection(db, "trip_requests"), 
          where("userId", "==", user.id)
        );
        
        const querySnapshot = await getDocs(q);
        const allTrips = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Client-side sorting (newest first)
        allTrips.sort((a: any, b: any) => {
          const dateA = new Date(`${a.date} ${a.time}`).getTime();
          const dateB = new Date(`${b.date} ${b.time}`).getTime();
          return dateB - dateA;
        });

        // Categorize trips
        const upcoming = allTrips.filter((trip: any) => 
          ['pending', 'approved', 'in-progress', 'requested'].includes(trip.status)
        );
        
        const past = allTrips.filter((trip: any) => 
          ['completed', 'cancelled', 'rejected'].includes(trip.status)
        );

        setUpcomingTrips(upcoming);
        setPastTrips(past);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching user trips:", error);
        setLoading(false);
      }
    };

    fetchTrips();
  }, [user.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-gray-500">Loading Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="user-dashboard" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl text-gray-900 mb-2">Welcome back, {user.name}!</h1>
          <p className="text-gray-600">Manage your vehicle bookings and trips</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <Card 
            onClick={() => onNavigate('book-vehicle')}
            className="p-6 cursor-pointer hover:shadow-lg transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#2563EB] rounded-xl flex items-center justify-center">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-gray-900">Book Vehicle</div>
                <div className="text-sm text-gray-500">Schedule a new trip</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">{upcomingTrips.length}</div>
                <div className="text-sm text-gray-500">Upcoming Trips</div>
              </div>
            </div>
          </Card>

          <Card 
            onClick={() => onNavigate('trip-history')}
            className="p-6 cursor-pointer hover:shadow-lg transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <History className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-gray-900">Trip History</div>
                <div className="text-sm text-gray-500">View all past trips</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Upcoming Trips */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl text-gray-900">Upcoming Trips</h2>
          </div>
          
          {upcomingTrips.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {upcomingTrips.map((trip) => (
                <Card key={trip.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-gray-900 mb-1">Trip #{trip.id}</div>
                      <Badge status={trip.status} />
                    </div>
                    <button
                      onClick={() => onNavigate('view-trip', trip.id)} // Assuming view-trip screen handles viewing details
                      className="text-sm text-[#2563EB] hover:text-[#1E40AF]"
                    >
                      View Details
                    </button>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-sm text-gray-500">Pickup</div>
                        <div className="text-gray-900">{trip.pickup}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-[#2563EB] mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-sm text-gray-500">Destination</div>
                        <div className="text-gray-900">{trip.destination}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Date & Time</div>
                        <div className="text-sm text-gray-900">{trip.date}</div>
                        <div className="text-sm text-gray-900">{trip.time}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Vehicle</div>
                        <div className="text-sm text-gray-900">{trip.vehicleNumber || 'Pending'}</div>
                        <div className="text-sm text-gray-900">{trip.driverName || 'Pending'}</div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No upcoming trips</p>
              <button
                onClick={() => onNavigate('book-vehicle')}
                className="px-6 py-2 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all"
              >
                Book Your First Trip
              </button>
            </Card>
          )}
        </div>

        {/* Past Trips (Limited view for dashboard) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl text-gray-900">Recent Trips</h2>
            <button
              onClick={() => onNavigate('trip-history')}
              className="text-sm text-[#2563EB] hover:text-[#1E40AF]"
            >
              View All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastTrips.slice(0, 3).map((trip) => (
              <Card key={trip.id} className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-gray-900">Trip #{trip.id}</div>
                  <Badge status={trip.status} size="sm" />
                </div>
                <div className="space-y-2 mb-4">
                  <div className="text-sm text-gray-600">{trip.pickup}</div>
                  <div className="text-sm text-gray-600">→ {trip.destination}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-500">{trip.date}</div>
                  {/* Optional: Add view details for past trips if needed */}
                </div>
              </Card>
            ))}
            {pastTrips.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-8 bg-white rounded-xl border border-gray-200">
                No past trip history found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}