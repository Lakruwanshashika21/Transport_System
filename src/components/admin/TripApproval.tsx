import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, User as UserIcon, MapPin, Calendar, Clock, Car, X, WifiOff, Banknote, Navigation } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, getDocs, query, where, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { sendTripApprovalEmail } from '../../utils/emailService';

interface TripApprovalProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export function TripApproval({ user, onNavigate, onLogout }: TripApprovalProps) {
  const [pendingTrips, setPendingTrips] = useState<any[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // --- Real-Time Data Fetching ---
  useEffect(() => {
    setLoading(true);
    
    const tripsQuery = query(collection(db, "trip_requests"), where("status", "==", "pending"));
    const unsubTrips = onSnapshot(tripsQuery, (snap) => {
      setPendingTrips(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => setError("Connection unstable."));

    const driversQuery = query(collection(db, "users"), where("role", "==", "driver"));
    const unsubDrivers = onSnapshot(driversQuery, (snap) => {
      const driverList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
         .filter((d: any) => d.driverStatus === 'approved');
      setAvailableDrivers(driverList);
    });

    const vehiclesQuery = query(collection(db, "vehicles"), where("status", "==", "available"));
    const unsubVehicles = onSnapshot(vehiclesQuery, (snap) => {
      setAvailableVehicles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubTrips();
      unsubDrivers();
      unsubVehicles();
    };
  }, []);

  const handleApproveClick = (trip: any) => {
    setSelectedTrip(trip);
    setShowApproveModal(true);
  };

  const handleRejectClick = (trip: any) => {
    setSelectedTrip(trip);
    setShowRejectModal(true);
  };

  const handleApprove = async () => {
    if (!selectedDriver || !selectedVehicle) { alert('Select driver & vehicle'); return; }
    try {
      const driver = availableDrivers.find(d => d.id === selectedDriver);
      const vehicle = availableVehicles.find(v => v.id === selectedVehicle);
      
      const driverName = driver?.fullName || 'Unknown';
      const vehicleNum = vehicle?.number || 'Unknown';

      // --- FIX: Recalculate Cost Based on Selected Vehicle ---
      let finalCost = selectedTrip.cost; // Default to existing cost
      
      // Extract numeric distance (e.g., "12.5 km" -> 12.5)
      const distMatch = (selectedTrip.distance || '').toString().match(/([\d.]+)/);
      const distKm = distMatch ? parseFloat(distMatch[0]) : 0;
      
      // Get vehicle rate
      const rate = vehicle?.ratePerKm ? Number(vehicle.ratePerKm) : 0;

      // If we have distance and rate, calculate new cost
      if (distKm > 0 && rate > 0) {
         const calcValue = Math.round(distKm * rate);
         finalCost = `LKR ${calcValue}`;
         console.log(`Recalculated Cost: ${distKm}km * ${rate} = ${finalCost}`);
      }
      // -------------------------------------------------------

      await updateDoc(doc(db, "trip_requests", selectedTrip.id), {
        status: 'approved',
        driverId: selectedDriver,
        driverName: driverName,
        vehicleId: selectedVehicle,
        vehicleNumber: vehicleNum,
        cost: finalCost, // Save the correct cost
        approvedAt: new Date().toISOString()
      });

      await updateDoc(doc(db, "vehicles", selectedVehicle), { status: 'in-use' });
      await updateDoc(doc(db, "users", selectedDriver), { status: 'in-use' });

      const emailData = {
        email: selectedTrip.email,
        customer: selectedTrip.customer,
        serialNumber: selectedTrip.serialNumber || selectedTrip.id,
        driverName: driverName,
        vehicleNumber: vehicleNum,
        cost: finalCost // Include cost in email
      };
      await sendTripApprovalEmail(emailData);

      alert(`Trip Approved! Cost updated to ${finalCost}. Ticket sent.`);
      setShowApproveModal(false);
      setSelectedDriver('');
      setSelectedVehicle('');
    } catch (err) {
      console.error(err);
      alert("Failed to approve.");
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { alert("Reason required"); return; }
    try {
      await updateDoc(doc(db, "trip_requests", selectedTrip.id), {
        status: 'rejected',
        rejectionReason: rejectReason,
        rejectedAt: new Date().toISOString()
      });
      alert("Trip Rejected.");
      setShowRejectModal(false);
      setRejectReason('');
    } catch (err) {
      alert("Failed to reject.");
    }
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="trip-approval" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-3xl text-gray-900 mb-2">Trip Approval</h1>
          <p className="text-gray-600">Review and approve pending trip requests</p>
        </div>
        
        {error && <div className="mb-4 p-3 text-red-600 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"><WifiOff className="w-4 h-4"/>{error}</div>}

        <div className="space-y-4">
          {pendingTrips.map((trip) => (
            <Card key={trip.id} className="p-6">
              <div className="flex justify-between mb-6">
                <div>
                  <div className="text-xl text-gray-900 mb-1">Trip #{trip.serialNumber || trip.id}</div>
                  <Badge status="pending" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <h3 className="text-sm text-gray-500 mb-2">Customer</h3>
                    <div className="text-gray-900 font-medium">{trip.customerName || trip.customer}</div>
                    <div className="text-sm text-gray-600">{trip.epf || trip.epfNumber}</div>
                </div>
                <div>
                    <h3 className="text-sm text-gray-500 mb-2">Route Details</h3>
                    <div className="text-gray-900">{trip.pickup}</div>
                    <div className="text-sm text-gray-600 mb-2">to {trip.destination}</div>
                    
                    {/* Display Distance & Est Cost */}
                    <div className="flex items-center gap-4 text-sm bg-gray-50 p-2 rounded-lg">
                         <span className="flex items-center gap-1 text-blue-600 font-medium">
                           <Navigation className="w-3 h-3"/> {trip.distance || '0 km'}
                         </span>
                         <span className="flex items-center gap-1 text-gray-500">
                           Est: {trip.cost || 'LKR 0'}
                         </span>
                    </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t">
                <button onClick={() => handleRejectClick(trip)} className="px-6 py-2 border border-red-300 text-red-600 rounded-xl hover:bg-red-50">Reject</button>
                <button onClick={() => handleApproveClick(trip)} className="px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700">Approve</button>
              </div>
            </Card>
          ))}
          {pendingTrips.length === 0 && <p className="text-center text-gray-500 p-10">No pending requests.</p>}
        </div>
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl p-6">
            <h3 className="text-xl mb-6">Approve Trip</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
                    <select className="w-full p-3 border rounded-xl" onChange={e => setSelectedDriver(e.target.value)}>
                        <option value="">Select Driver</option>
                        {availableDrivers.map(d => <option key={d.id} value={d.id}>{d.fullName}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
                    <select className="w-full p-3 border rounded-xl" onChange={e => setSelectedVehicle(e.target.value)}>
                        <option value="">Select Vehicle</option>
                        {availableVehicles.map(v => (
                          <option key={v.id} value={v.id}>
                             {v.number} - {v.model} (Rate: LKR {v.ratePerKm}/km)
                          </option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="flex gap-3 mt-6">
                <button onClick={() => setShowApproveModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
                <button onClick={handleApprove} className="flex-1 py-3 bg-green-600 text-white rounded-xl">Confirm & Calculate Cost</button>
            </div>
          </Card>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6">
                <h3 className="text-xl mb-4">Reject Trip</h3>
                <textarea className="w-full border p-3 rounded-xl" rows={3} placeholder="Reason for rejection..." onChange={e => setRejectReason(e.target.value)} />
                <div className="flex gap-3 mt-4">
                    <button onClick={() => setShowRejectModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
                    <button onClick={handleReject} className="flex-1 py-3 bg-red-600 text-white rounded-xl">Reject</button>
                </div>
            </Card>
        </div>
      )}
    </div>
  );
}