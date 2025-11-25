import { useState } from 'react';
import { MapPin, User as UserIcon, Phone, Navigation, Play, Square, CheckCircle } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';

interface DriverTripDetailProps {
  user: User;
  tripId: string | null;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

const tripData = {
  id: 'TRP001',
  customer: 'John Doe',
  customerPhone: '+94 77 123 4567',
  epf: 'EPF12345',
  pickup: 'Office Building A, Colombo 03',
  pickupLat: '6.9271',
  pickupLng: '79.8612',
  destination: 'Client Meeting - Downtown Plaza, Colombo 02',
  time: '09:00 AM',
  distance: '12.5 km',
  estimatedDuration: '25 minutes',
};

export function DriverTripDetail({ user, tripId, onNavigate, onLogout }: DriverTripDetailProps) {
  const [tripStatus, setTripStatus] = useState<'pending' | 'in-progress' | 'completed'>('pending');
  const [showSummary, setShowSummary] = useState(false);

  const handleStartTrip = () => {
    setTripStatus('in-progress');
    alert('Trip started! GPS tracking enabled.');
  };

  const handleEndTrip = () => {
    setTripStatus('completed');
    setShowSummary(true);
  };

  const handleCompleteSummary = () => {
    alert('Trip completed successfully!');
    onNavigate('driver-dashboard');
  };

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
          <p className="text-gray-600">Trip #{tripData.id}</p>
        </div>

        {!showSummary ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Map */}
              <Card className="p-6">
                <h2 className="text-lg text-gray-900 mb-4">
                  {tripStatus === 'pending' && 'Route to Pickup Location'}
                  {tripStatus === 'in-progress' && 'Navigation to Destination'}
                  {tripStatus === 'completed' && 'Trip Completed'}
                </h2>
                
                {/* Mock Map */}
                <div className="w-full h-96 bg-gray-200 rounded-xl flex items-center justify-center mb-4">
                  <div className="text-center">
                    <Navigation className="w-16 h-16 text-[#2563EB] mx-auto mb-3" />
                    <p className="text-gray-500">Interactive Map Navigation</p>
                    <p className="text-sm text-gray-400">
                      {tripStatus === 'pending' && 'Route to pickup location'}
                      {tripStatus === 'in-progress' && 'Live GPS tracking active'}
                      {tripStatus === 'completed' && 'Trip route completed'}
                    </p>
                  </div>
                </div>

                {tripStatus === 'in-progress' && (
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
                      <div className="text-gray-900">{tripData.pickup}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        Lat: {tripData.pickupLat}, Lng: {tripData.pickupLng}
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
                      <div className="text-gray-900">{tripData.destination}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200">
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Distance</div>
                    <div className="text-gray-900">{tripData.distance}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Est. Duration</div>
                    <div className="text-gray-900">{tripData.estimatedDuration}</div>
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
                      <div className="text-gray-900">{tripData.customer}</div>
                      <div className="text-sm text-gray-600">{tripData.epf}</div>
                    </div>
                  </div>

                  <a
                    href={`tel:${tripData.customerPhone}`}
                    className="flex items-center gap-3 p-3 bg-green-50 rounded-xl hover:bg-green-100 transition-all"
                  >
                    <Phone className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="text-sm text-gray-500">Call Customer</div>
                      <div className="text-green-700">{tripData.customerPhone}</div>
                    </div>
                  </a>
                </div>
              </Card>

              {/* Trip Controls */}
              <Card className="p-6">
                <h2 className="text-lg text-gray-900 mb-4">Trip Controls</h2>
                
                <div className="space-y-3">
                  {tripStatus === 'pending' && (
                    <button
                      onClick={handleStartTrip}
                      className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all"
                    >
                      <Play className="w-5 h-5" />
                      Start Trip
                    </button>
                  )}

                  {tripStatus === 'in-progress' && (
                    <button
                      onClick={handleEndTrip}
                      className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all"
                    >
                      <Square className="w-5 h-5" />
                      End Trip
                    </button>
                  )}

                  {tripStatus === 'completed' && (
                    <div className="flex items-center justify-center gap-2 px-4 py-4 bg-gray-100 text-gray-700 rounded-xl">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Trip Completed
                    </div>
                  )}
                </div>

                {tripStatus === 'pending' && (
                  <p className="text-sm text-gray-500 mt-3 text-center">
                    GPS tracking will start when you begin the trip
                  </p>
                )}

                {tripStatus === 'in-progress' && (
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
                <div className="text-gray-900">{tripData.id}</div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="text-sm text-gray-500 mb-1">Customer</div>
                <div className="text-gray-900">{tripData.customer}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-sm text-gray-500 mb-1">Distance</div>
                  <div className="text-gray-900">{tripData.distance}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-sm text-gray-500 mb-1">Duration</div>
                  <div className="text-gray-900">{tripData.estimatedDuration}</div>
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
