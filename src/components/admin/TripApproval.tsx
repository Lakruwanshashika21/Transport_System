import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, User as UserIcon, MapPin, Calendar, Clock, Car, X, WifiOff, Banknote, Navigation, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
import { collection, getDocs, query, where, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { sendTripApprovalEmail, sendTripRejectionEmail, sendDriverTripEmail } from '../../utils/emailService';

interface TripApprovalProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

// ... (StopList component same as before) ...
const StopList = ({ stops, destination }: { stops?: string[], destination: string }) => {
  const [expanded, setExpanded] = useState(false);
  if (!stops || stops.length === 0) return <div className="text-sm text-gray-900 mb-2 pl-4 border-l-2 border-gray-200">{destination}</div>;
  const allPoints = [...stops]; 
  if (allPoints.length <= 2) return <div className="mb-2 space-y-1">{allPoints.map((stop, i) => <div key={i} className="text-sm text-gray-600 flex items-start gap-2"><div className={`w-2 h-2 rounded-full ${i === allPoints.length - 1 ? 'bg-red-500' : 'bg-gray-400'}`}></div>{stop}</div>)}</div>;
  return <div className="mb-2 space-y-1"><div className="text-sm text-gray-600 flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-gray-400"></div>{allPoints[0]}</div>{expanded && allPoints.slice(1, -1).map((stop, i) => <div key={i} className="text-sm text-gray-600 flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>{stop}</div>)}<div className="text-sm text-gray-900 flex items-start gap-2 font-medium"><div className="w-2 h-2 rounded-full bg-red-500"></div>{allPoints[allPoints.length - 1]}</div><button onClick={() => setExpanded(!expanded)} className="text-xs text-blue-600 flex items-center gap-1 mt-1 hover:underline ml-4">{expanded ? <><ChevronUp className="w-3 h-3"/> Less</> : <><ChevronDown className="w-3 h-3"/> +{allPoints.length - 2} stops</>}</button></div>;
};

export function TripApproval({ user, onNavigate, onLogout }: TripApprovalProps) {
  const [pendingTrips, setPendingTrips] = useState<any[]>([]);
  const [allDrivers, setAllDrivers] = useState<any[]>([]);
  const [allVehicles, setAllVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    setLoading(true);
    const unsubTrips = onSnapshot(query(collection(db, "trip_requests"), where("status", "==", "pending")), (snap) => {
      setPendingTrips(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => setError("Connection unstable."));

    const unsubDrivers = onSnapshot(query(collection(db, "users"), where("role", "==", "driver")), (snap) => {
      setAllDrivers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((d: any) => d.driverStatus === 'approved'));
    });

    const unsubVehicles = onSnapshot(query(collection(db, "vehicles")), (snap) => {
      setAllVehicles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubTrips(); unsubDrivers(); unsubVehicles(); };
  }, []);

  // --- Smart Auto-Fill ---
  const handleVehicleChange = (vehicleId: string) => {
      setSelectedVehicle(vehicleId);
      const vehicle = allVehicles.find(v => v.id === vehicleId);
      if (vehicle) {
          // Find driver assigned to this vehicle
          const assignedDriver = allDrivers.find(d => d.vehicle === vehicle.number);
          if (assignedDriver) {
              setSelectedDriver(assignedDriver.id);
          } else {
              setSelectedDriver(''); // Reset if no one assigned
          }
      }
  };

  const handleApproveClick = (trip: any) => {
    setSelectedTrip(trip);
    if (trip.requestedVehicleId) {
        handleVehicleChange(trip.requestedVehicleId);
    } else {
        setSelectedVehicle('');
        setSelectedDriver('');
    }
    setShowApproveModal(true);
  };

  const handleRejectClick = (trip: any) => {
    setSelectedTrip(trip);
    setShowRejectModal(true);
  };

  const handleApprove = async () => {
    if (!selectedDriver || !selectedVehicle) { alert('Select driver & vehicle'); return; }
    
    // --- Conflict Warning ---
    const driver = allDrivers.find(d => d.id === selectedDriver);
    if (driver && driver.status === 'in-use') {
        if (!window.confirm(`⚠️ WARNING: Driver ${driver.fullName || driver.name} is currently BUSY on another trip.\n\nAssign anyway?`)) return;
    }

    try {
      const vehicle = allVehicles.find(v => v.id === selectedVehicle) || { ratePerKm: 0, number: 'Unknown' };
      
      // Recalculate Cost
      let finalCost = selectedTrip.cost;
      const distMatch = (selectedTrip.distance || '').toString().match(/([\d.]+)/);
      const distKm = distMatch ? parseFloat(distMatch[0]) : 0;
      const rate = vehicle?.ratePerKm ? Number(vehicle.ratePerKm) : 0;
      if (distKm > 0 && rate > 0) finalCost = `LKR ${Math.round(distKm * rate)}`;

      const driverName = driver?.fullName || 'Unknown';
      const vehicleNum = vehicle?.number || 'Unknown';

      await updateDoc(doc(db, "trip_requests", selectedTrip.id), {
        status: 'approved',
        driverId: selectedDriver,
        driverName: driverName,
        vehicleId: selectedVehicle,
        vehicleNumber: vehicleNum,
        cost: finalCost,
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
        cost: finalCost,
        driverEmail: driver?.email,
        customerPhone: selectedTrip.customerPhone,
        pickup: selectedTrip.pickup,
        destination: selectedTrip.destination,
        date: selectedTrip.date,
        time: selectedTrip.time
      };

      await sendTripApprovalEmail(emailData); // To User
      await sendDriverTripEmail(emailData);   // To Driver

      alert(`Trip Approved! Emails sent to User & Driver.`);
      setShowApproveModal(false);
    } catch (err) { alert("Failed to approve."); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { alert("Reason required"); return; }
    try {
      await updateDoc(doc(db, "trip_requests", selectedTrip.id), { status: 'rejected', rejectionReason: rejectReason, rejectedAt: new Date().toISOString() });
      await sendTripRejectionEmail({ email: selectedTrip.email, customer: selectedTrip.customer, serialNumber: selectedTrip.serialNumber }, rejectReason);
      alert("Trip Rejected. User notified.");
      setShowRejectModal(false);
    } catch (err) { alert("Failed to reject."); }
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="trip-approval" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8"><h1 className="text-3xl text-gray-900 mb-2">Trip Approval</h1></div>
        {error && <div className="mb-4 p-3 text-red-600 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

        <div className="space-y-4">
          {pendingTrips.map((trip) => (
            <Card key={trip.id} className="p-6">
              <div className="flex justify-between mb-6">
                 <div className="text-xl text-gray-900 font-bold">Trip #{trip.serialNumber || trip.id}</div>
                 <Badge status="pending" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-2"><UserIcon className="w-4 h-4 text-gray-500"/><span className="font-medium">{trip.customerName || trip.customer}</span></div>
                    <div className="text-sm text-gray-600 ml-6">{trip.epf || trip.epfNumber}</div>
                </div>
                <div>
                    <div className="flex items-start gap-2 mb-2"><MapPin className="w-4 h-4 text-green-600 mt-1"/><span className="font-medium">{trip.pickup}</span></div>
                    <div className="ml-6"><StopList stops={trip.destinations} destination={trip.destination} /></div>
                    <div className="flex items-center gap-4 text-sm mt-3 p-2 bg-gray-50 rounded-lg">
                       <span className="text-blue-600 font-medium">{trip.distance || '0 km'}</span>
                       <span className="text-green-600 font-bold">{trip.cost || 'LKR 0'}</span>
                    </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t">
                <button onClick={() => handleRejectClick(trip)} className="px-6 py-2 border border-red-300 text-red-600 rounded-xl">Reject</button>
                <button onClick={() => handleApproveClick(trip)} className="px-6 py-2 bg-green-600 text-white rounded-xl">Approve</button>
              </div>
            </Card>
          ))}
          {pendingTrips.length === 0 && <p className="text-center text-gray-500 p-10">No pending requests.</p>}
        </div>
      </div>

      {showApproveModal && selectedTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl p-6">
            <h3 className="text-xl mb-6">Approve Trip</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
                    <select className="w-full p-3 border rounded-xl" value={selectedVehicle} onChange={e => handleVehicleChange(e.target.value)}>
                        <option value="">Select Vehicle</option>
                        {allVehicles.map(v => (
                            <option key={v.id} value={v.id} disabled={v.status !== 'available' && v.id !== selectedTrip.requestedVehicleId}>
                               {v.number} - {v.model} {v.status !== 'available' ? `(${v.status})` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
                    <select className={`w-full p-3 border rounded-xl ${selectedDriver && allDrivers.find(d => d.id === selectedDriver)?.status === 'in-use' ? 'border-yellow-500 bg-yellow-50' : ''}`} value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}>
                        <option value="">Select Driver</option>
                        {allDrivers.map(d => (
                           <option key={d.id} value={d.id} className={d.status === 'in-use' ? 'text-red-600' : ''}>
                              {d.fullName} {d.status === 'in-use' ? '(BUSY)' : '(Available)'}
                           </option>
                        ))}
                    </select>
                    {selectedVehicle && selectedDriver && (
                        <p className="text-xs text-green-600 mt-1">
                           <CheckCircle className="w-3 h-3 inline mr-1"/> Driver matched from assignment.
                        </p>
                    )}
                    {selectedDriver && allDrivers.find(d => d.id === selectedDriver)?.status === 'in-use' && (
                        <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                           <AlertTriangle className="w-3 h-3"/> Warning: Driver is currently on another trip.
                        </p>
                    )}
                </div>
            </div>
            <div className="flex gap-3 mt-6">
                <button onClick={() => setShowApproveModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
                <button onClick={handleApprove} className="flex-1 py-3 bg-green-600 text-white rounded-xl">Confirm</button>
            </div>
          </Card>
        </div>
      )}
      
      {/* Reject Modal... (Same as before) */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6">
                <h3 className="text-xl mb-4">Reject Trip</h3>
                <textarea className="w-full border p-3 rounded-xl" rows={3} placeholder="Reason..." onChange={e => setRejectReason(e.target.value)} />
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