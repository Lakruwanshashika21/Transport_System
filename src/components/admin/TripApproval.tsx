import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, User as UserIcon, MapPin, Calendar, Clock, Car, X } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface TripApprovalProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export function TripApproval({ user, onNavigate, onLogout }: TripApprovalProps) {
  // 1. State
  const [pendingTrips, setPendingTrips] = useState<any[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // 2. Fetch Data
  const fetchData = async () => {
    try {
      // A. Fetch Pending Trips
      const tripsQuery = query(collection(db, "trip_requests"), where("status", "==", "pending"));
      const tripsSnapshot = await getDocs(tripsQuery);
      const trips = tripsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPendingTrips(trips);

      // B. Fetch Drivers (Only fetch those who are approved and available)
      const driversQuery = query(collection(db, "users"), where("role", "==", "driver"));
      const driversSnapshot = await getDocs(driversQuery);
      const drivers = driversSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        // Client-side filter for 'available' status if not strictly enforced in DB query
        .filter((d: any) => d.driverStatus === 'approved'); 
      setAvailableDrivers(drivers);

      // C. Fetch Available Vehicles
      const vehiclesQuery = query(collection(db, "vehicles"), where("status", "==", "available"));
      const vehiclesSnapshot = await getDocs(vehiclesQuery);
      const vehicles = vehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvailableVehicles(vehicles);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 3. Handlers
  const handleApproveClick = (trip: any) => {
    setSelectedTrip(trip);
    setShowApproveModal(true);
  };

  const handleRejectClick = (trip: any) => {
    setSelectedTrip(trip);
    setShowRejectModal(true);
  };

  const handleApprove = async () => {
    if (!selectedDriver || !selectedVehicle) {
      alert('Please select both driver and vehicle');
      return;
    }

    try {
      // 1. Update Trip Status & Assign Resources
      const tripRef = doc(db, "trip_requests", selectedTrip.id);
      
      // Find names for better record keeping
      const driverName = availableDrivers.find(d => d.id === selectedDriver)?.fullName || 'Unknown';
      const vehicleNum = availableVehicles.find(v => v.id === selectedVehicle)?.number || 'Unknown';

      await updateDoc(tripRef, {
        status: 'approved',
        driverId: selectedDriver,
        driverName: driverName,
        vehicleId: selectedVehicle,
        vehicleNumber: vehicleNum,
        approvedAt: new Date().toISOString()
      });

      // 2. Mark Vehicle as In-Use
      const vehicleRef = doc(db, "vehicles", selectedVehicle);
      await updateDoc(vehicleRef, { status: 'in-use' });

      // 3. Mark Driver as In-Use (Optional, depends on if they can do multiple trips)
      const driverRef = doc(db, "users", selectedDriver);
      await updateDoc(driverRef, { status: 'in-use' });

      alert(`Trip approved successfully! Assigned to ${driverName}.`);
      setShowApproveModal(false);
      setSelectedDriver('');
      setSelectedVehicle('');
      
      // Refresh List
      fetchData();

    } catch (error) {
      console.error("Error approving trip:", error);
      alert("Failed to approve trip.");
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const tripRef = doc(db, "trip_requests", selectedTrip.id);
      await updateDoc(tripRef, {
        status: 'rejected',
        rejectionReason: rejectReason,
        rejectedAt: new Date().toISOString()
      });

      alert(`Trip rejected.`);
      setShowRejectModal(false);
      setRejectReason('');
      
      // Refresh List
      fetchData();

    } catch (error) {
      console.error("Error rejecting trip:", error);
      alert("Failed to reject trip.");
    }
  };

  if (loading) {
    return <div className="p-10 text-center">Loading Requests...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="trip-approval" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-3xl text-gray-900 mb-2">Trip Approval</h1>
          <p className="text-gray-600">Review and approve pending trip requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">{pendingTrips.length}</div>
                <div className="text-sm text-gray-500">Pending Requests</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                {/* For now hardcoded as we don't query approved/rejected counts here dynamically to save reads */}
                <div className="text-2xl text-gray-900">-</div>
                <div className="text-sm text-gray-500">Approved Today</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">-</div>
                <div className="text-sm text-gray-500">Rejected Today</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Pending Requests */}
        <div className="space-y-4">
          {pendingTrips.map((trip) => (
            <Card key={trip.id} className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="text-xl text-gray-900 mb-2">Trip Request</div>
                  <Badge status="pending" />
                  <div className="text-sm text-gray-500 mt-2">ID: {trip.id}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Customer Info */}
                <div>
                  <h3 className="text-sm text-gray-500 mb-3">Customer Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{trip.customerName || trip.customer}</span>
                    </div>
                    <div className="text-sm text-gray-600">EPF: {trip.epf || trip.epfNumber}</div>
                    <div className="text-sm text-gray-600">Phone: {trip.phone}</div>
                    <div className="text-sm text-gray-600">Email: {trip.email}</div>
                  </div>
                </div>

                {/* Trip Details */}
                <div>
                  <h3 className="text-sm text-gray-500 mb-3">Trip Details</h3>
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
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {trip.date}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {trip.time}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end pt-6 border-t border-gray-200">
                <div className="flex gap-3">
                  <button
                    onClick={() => handleRejectClick(trip)}
                    className="flex items-center gap-2 px-6 py-2 border border-red-300 text-red-600 rounded-xl hover:bg-red-50 transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApproveClick(trip)}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                </div>
              </div>
            </Card>
          ))}

          {pendingTrips.length === 0 && (
            <Card className="p-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-500">No pending requests at the moment</p>
            </Card>
          )}
        </div>
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedTrip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl text-gray-900">Approve Trip (ID: {selectedTrip.id})</h3>
              <button
                onClick={() => setShowApproveModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-6">
              <h4 className="text-sm text-gray-900 mb-3">Select Driver</h4>
              <div className="grid grid-cols-1 gap-3 max-h-48 overflow-y-auto">
                {availableDrivers.length === 0 ? <p className="text-sm text-gray-500">No drivers available</p> : availableDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    onClick={() => driver.status !== 'in-use' && setSelectedDriver(driver.id)}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedDriver === driver.id
                        ? 'border-[#2563EB] bg-blue-50'
                        : driver.status !== 'in-use'
                        ? 'border-gray-200 hover:border-[#2563EB]'
                        : 'border-gray-200 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-gray-900">{driver.fullName || driver.name}</div>
                        <div className="text-sm text-gray-500">{driver.phone}</div>
                      </div>
                      <Badge status={driver.status === 'in-use' ? 'in-use' : 'available'} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sm text-gray-900 mb-3">Select Vehicle</h4>
              <div className="grid grid-cols-1 gap-3 max-h-48 overflow-y-auto">
                {availableVehicles.length === 0 ? <p className="text-sm text-gray-500">No vehicles available</p> : availableVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    onClick={() => setSelectedVehicle(vehicle.id)}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedVehicle === vehicle.id
                        ? 'border-[#2563EB] bg-blue-50'
                        : 'border-gray-200 hover:border-[#2563EB]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Car className="w-5 h-5 text-gray-600" />
                        <div>
                          <div className="text-gray-900">{vehicle.number}</div>
                          <div className="text-sm text-gray-500">{vehicle.model}</div>
                        </div>
                      </div>
                      <Badge status="available" size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowApproveModal(false)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all"
              >
                Approve Trip
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedTrip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl text-gray-900">Reject Trip</h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting this trip. The customer will be notified.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all"
              >
                Reject Trip
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}