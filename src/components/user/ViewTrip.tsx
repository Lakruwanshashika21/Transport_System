import { useState } from 'react';
import { MapPin, Calendar, Clock, Car, Phone, User as UserIcon, Navigation, FileText, X, Download } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';

interface ViewTripProps {
  user: User;
  tripId: string | null;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

// Mock trip data
const tripData = {
  id: 'TRP001',
  vehicleNumber: 'CAB-2345',
  vehicleModel: 'Toyota Corolla',
  driver: 'Mike Wilson',
  driverPhone: '+94 77 123 4567',
  pickup: 'Office Building A, Colombo 03',
  destination: 'Client Meeting - Downtown Plaza, Colombo 02',
  date: '2025-11-25',
  time: '09:00 AM',
  status: 'approved' as const,
  distance: '12.5 km',
  cost: 'LKR 1,500',
  currentLocation: 'En route to pickup location',
  estimatedArrival: '5 minutes',
  timeline: [
    { status: 'requested', label: 'Requested', date: '2025-11-20 10:30 AM', completed: true },
    { status: 'approved', label: 'Approved', date: '2025-11-20 11:15 AM', completed: true },
    { status: 'in-progress', label: 'In Progress', date: '', completed: false },
    { status: 'completed', label: 'Completed', date: '', completed: false },
  ],
};

export function ViewTrip({ user, tripId, onNavigate, onLogout }: ViewTripProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const handleCancelTrip = () => {
    if (!cancelReason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }
    alert('Trip cancelled successfully');
    setShowCancelModal(false);
    onNavigate('user-dashboard');
  };

  const handleDownloadReceipt = () => {
    alert('Receipt PDF downloaded');
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6">
          <button
            onClick={() => onNavigate('user-dashboard')}
            className="text-[#2563EB] hover:text-[#1E40AF] mb-4"
          >
            ← Back to Dashboard
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl text-gray-900 mb-2">Trip Details</h1>
              <p className="text-gray-600">Trip #{tripData.id}</p>
            </div>
            <Badge status={tripData.status} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Tracking */}
            {tripData.status === 'approved' && (
              <Card className="p-6">
                <h2 className="text-lg text-gray-900 mb-4">Live Tracking</h2>
                
                {/* Mock Map */}
                <div className="w-full h-64 bg-gray-200 rounded-xl flex items-center justify-center mb-4">
                  <div className="text-center">
                    <Navigation className="w-12 h-12 text-[#2563EB] mx-auto mb-2" />
                    <p className="text-gray-500">Live GPS Tracking</p>
                    <p className="text-sm text-gray-400">{tripData.currentLocation}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                  <div className="text-gray-700">Estimated Arrival</div>
                  <div className="text-lg text-[#2563EB]">{tripData.estimatedArrival}</div>
                </div>
              </Card>
            )}

            {/* Route Details */}
            <Card className="p-6">
              <h2 className="text-lg text-gray-900 mb-4">Route Information</h2>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-500 mb-1">Pickup Location</div>
                    <div className="text-gray-900">{tripData.pickup}</div>
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
                  <div className="text-sm text-gray-500 mb-1">Estimated Cost</div>
                  <div className="text-gray-900">{tripData.cost}</div>
                </div>
              </div>
            </Card>

            {/* Trip Timeline */}
            <Card className="p-6">
              <h2 className="text-lg text-gray-900 mb-4">Trip Status</h2>
              
              <div className="space-y-4">
                {tripData.timeline.map((item, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.completed ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {item.completed ? (
                        <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                      ) : (
                        <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className={`${item.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                        {item.label}
                      </div>
                      {item.date && (
                        <div className="text-sm text-gray-500">{item.date}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Schedule */}
            <Card className="p-6">
              <h2 className="text-lg text-gray-900 mb-4">Schedule</h2>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-500">Date</div>
                    <div className="text-gray-900">{tripData.date}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-500">Time</div>
                    <div className="text-gray-900">{tripData.time}</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Vehicle & Driver */}
            <Card className="p-6">
              <h2 className="text-lg text-gray-900 mb-4">Vehicle & Driver</h2>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Car className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-500">Vehicle</div>
                    <div className="text-gray-900">{tripData.vehicleNumber}</div>
                    <div className="text-sm text-gray-600">{tripData.vehicleModel}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <UserIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-sm text-gray-500">Driver</div>
                    <div className="text-gray-900">{tripData.driver}</div>
                  </div>
                </div>

                <a
                  href={`tel:${tripData.driverPhone}`}
                  className="flex items-center gap-3 p-3 bg-green-50 rounded-xl hover:bg-green-100 transition-all"
                >
                  <Phone className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="text-sm text-gray-500">Call Driver</div>
                    <div className="text-green-700">{tripData.driverPhone}</div>
                  </div>
                </a>
              </div>
            </Card>

            {/* Actions */}
            <Card className="p-6">
              <h2 className="text-lg text-gray-900 mb-4">Actions</h2>
              
              <div className="space-y-3">
                <button
                  onClick={handleDownloadReceipt}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all"
                >
                  <Download className="w-5 h-5" />
                  Download Receipt
                </button>

                {tripData.status !== 'completed' && tripData.status !== 'cancelled' && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-red-300 text-red-600 rounded-xl hover:bg-red-50 transition-all"
                  >
                    <X className="w-5 h-5" />
                    Cancel Trip
                  </button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl text-gray-900">Cancel Trip</h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              Please provide a reason for cancelling this trip.
            </p>

            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter cancellation reason..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
              >
                Keep Trip
              </button>
              <button
                onClick={handleCancelTrip}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all"
              >
                Cancel Trip
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
