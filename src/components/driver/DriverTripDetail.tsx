import { useState, useEffect } from 'react';
import { MapPin, User as UserIcon, Phone, Navigation, Play, Square, CheckCircle } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
// Firebase Imports
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface DriverTripDetailProps {
  user: User;
  tripId: string | null;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export function DriverTripDetail({ user, tripId, onNavigate, onLogout }: DriverTripDetailProps) {
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);

  // 1. Fetch Trip Data
  useEffect(() => {
    const fetchTrip = async () => {
      if (!tripId) return;

      try {
        const docRef = doc(db, "trip_requests", tripId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setTrip(data);
          
          // If previously completed, show summary immediately
          if (data.status === 'completed') {
            setShowSummary(true);
          }
        } else {
          alert("Trip not found!");
          onNavigate('driver-dashboard');
        }
      } catch (error) {
        console.error("Error fetching trip:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();
  }, [tripId, onNavigate]);

  // 2. Handlers
  const handleStartTrip = async () => {
    if (!trip) return;
    try {
      const tripRef = doc(db, "trip_requests", trip.id);
      await updateDoc(tripRef, {
        status: 'in-progress',
        startedAt: new Date().toISOString()
      });
      
      // Update local state immediately for UI responsiveness
      setTrip((prev: any) => ({ ...prev, status: 'in-progress' }));
      alert('Trip started! GPS tracking enabled.');
    } catch (error) {
      console.error("Error starting trip:", error);
      alert("Failed to start trip. Please try again.");
    }
  };

  const handleEndTrip = async () => {
    if (!trip) return;
    try {
      const tripRef = doc(db, "trip_requests", trip.id);
      await updateDoc(tripRef, {
        status: 'completed',
        endedAt: new Date().toISOString()
      });

      // Mark vehicle as available again
      if (trip.vehicleId) {
        const vehicleRef = doc(db, "vehicles", trip.vehicleId);
        await updateDoc(vehicleRef, { status: 'available' });
      }

      setTrip((prev: any) => ({ ...prev, status: 'completed' }));
      setShowSummary(true);
    } catch (error) {
      console.error("Error ending trip:", error);
      alert("Failed to end trip. Please try again.");
    }
  };

  const handleCompleteSummary = () => {
    onNavigate('driver-dashboard');
  };

  if (loading) {
    return <div className="p-10 text-center">Loading Trip Details...</div>;
  }

  if (!trip) {
    return <div className="p-10 text-center">Trip not found.</div>;
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6">
          <button
            onClick={() => onNavigate('driver-dashboard')}
            className="text-[#2563EB] hover:text-[#1E40AF] mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl text-gray-900 mb-2">Trip Details</h1>
          <p className="text-gray-600">Trip #{trip.id}</p>
        </div>

        {!showSummary ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Map */}
              <Card className="p-6">
                <h2 className="text-lg text-gray-900 mb-4">
                  {trip.status === 'approved' && 'Route to Pickup Location'}
                  {trip.status === 'in-progress' && 'Navigation to Destination'}
                  {trip.status === 'completed' && 'Trip Completed'}
                </h2>
                
                {/* Mock Map */}
                <div className="w-full h-96 bg-gray-200 rounded-xl flex items-center justify-center mb-4 relative overflow-hidden">
                  <div className="text-center z-10">
                    <Navigation className="w-16 h-16 text-[#2563EB] mx-auto mb-3" />
                    <p className="text-gray-500">Interactive Map Navigation</p>
                    <p className="text-sm text-gray-400">
                      {trip.status === 'approved' && 'Route to pickup location'}
                      {trip.status === 'in-progress' && 'Live GPS tracking active'}
                      {trip.status === 'completed' && 'Trip route completed'}
                    </p>
                  </div>
                </div>

                {trip.status === 'in-progress' && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-2 text-green-700">
                      <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                      <span>GPS Tracking Active</span>
                    </div>
                  </div>
                )}
              </Card>

              {/* Route Details */}
              <Card className="p-6">
                <h2 className="text-lg text-gray-900 mb-4">Trip Information</h2>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-gray-500 mb-1">Pickup Location</div>
                      <div className="text-gray-900">{trip.pickup}</div>
                      {/* Fallback if lat/lng aren't in DB yet */}
                      <div className="text-sm text-gray-500 mt-1">
                        Lat: {trip.pickupLat || 'N/A'}, Lng: {trip.pickupLng || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="ml-5 border-l-2 border-dashed border-gray-300 h-8"></div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-[#2563EB]" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-gray-500 mb-1">Destination</div>
                      <div className="text-gray-900">{trip.destination}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200">
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Distance</div>
                    <div className="text-gray-900">{trip.distance || 'Calculating...'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Est. Duration</div>
                    <div className="text-gray-900">{trip.estimatedDuration || 'Calculating...'}</div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Customer Info */}
              <Card className="p-6">
                <h2 className="text-lg text-gray-900 mb-4">Customer Details</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <UserIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm text-gray-500">Name</div>
                      <div className="text-gray-900">{trip.customer || trip.customerName}</div>
                      <div className="text-sm text-gray-600">{trip.epf || trip.epfNumber}</div>
                    </div>
                  </div>

                  <a
                    href={`tel:${trip.customerPhone || trip.phone}`}
                    className="flex items-center gap-3 p-3 bg-green-50 rounded-xl hover:bg-green-100 transition-all"
                  >
                    <Phone className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="text-sm text-gray-500">Call Customer</div>
                      <div className="text-green-700">{trip.customerPhone || trip.phone || 'N/A'}</div>
                    </div>
                  </a>
                </div>
              </Card>

              {/* Trip Controls */}
              <Card className="p-6">
                <h2 className="text-lg text-gray-900 mb-4">Trip Controls</h2>
                
                <div className="space-y-3">
                  {(trip.status === 'approved' || trip.status === 'pending') && (
                    <button
                      onClick={handleStartTrip}
                      className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all"
                    >
                      <Play className="w-5 h-5" />
                      Start Trip
                    </button>
                  )}

                  {trip.status === 'in-progress' && (
                    <button
                      onClick={handleEndTrip}
                      className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all"
                    >
                      <Square className="w-5 h-5" />
                      End Trip
                    </button>
                  )}

                  {trip.status === 'completed' && (
                    <div className="flex items-center justify-center gap-2 px-4 py-4 bg-gray-100 text-gray-700 rounded-xl">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Trip Completed
                    </div>
                  )}
                </div>

                {trip.status === 'approved' && (
                  <p className="text-sm text-gray-500 mt-3 text-center">
                    GPS tracking will start when you begin the trip
                  </p>
                )}

                {trip.status === 'in-progress' && (
                  <p className="text-sm text-green-600 mt-3 text-center">
                    Your location is being tracked
                  </p>
                )}
              </Card>
            </div>
          </div>
        ) : (
          /* Trip Summary */
          <Card className="p-8 max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl text-gray-900 mb-2">Trip Completed!</h2>
              <p className="text-gray-600">Summary of your trip</p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="text-sm text-gray-500 mb-1">Trip ID</div>
                <div className="text-gray-900">{trip.id}</div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="text-sm text-gray-500 mb-1">Customer</div>
                <div className="text-gray-900">{trip.customer || trip.customerName}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-sm text-gray-500 mb-1">Distance</div>
                  <div className="text-gray-900">{trip.distance || 'N/A'}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-sm text-gray-500 mb-1">Duration</div>
                  <div className="text-gray-900">{trip.estimatedDuration || 'N/A'}</div>
                </div>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="text-sm text-gray-500 mb-1">Status</div>
                <div className="text-green-700">Successfully Completed</div>
              </div>
            </div>

            <button
              onClick={handleCompleteSummary}
              className="w-full py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all"
            >
              Return to Dashboard
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}