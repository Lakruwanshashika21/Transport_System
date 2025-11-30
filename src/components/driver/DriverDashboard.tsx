import { useState, useEffect } from 'react';
import { Car, Calendar, Clock, MapPin, User as UserIcon, Phone, Navigation, Play, Bell, Check } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, getDocs, query, where, onSnapshot, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';

interface DriverDashboardProps {
  user: User;
  onNavigate: (screen: string, tripId?: string) => void;
  onLogout: () => void;
}

export function DriverDashboard({ user, onNavigate, onLogout }: DriverDashboardProps) {
  const [todaysTrips, setTodaysTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignedVehicle, setAssignedVehicle] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);

    // 1. Listen to MY Trips
    const tripsQuery = query(
        collection(db, "trip_requests"), 
        where("driverId", "==", user.id),
        where("status", "in", ["approved", "in-progress"]) 
    );
    const unsubTrips = onSnapshot(tripsQuery, (snap) => {
        const tripList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort: 'in-progress' first, then by time
        tripList.sort((a: any, b: any) => {
            if (a.status === 'in-progress' && b.status !== 'in-progress') return -1;
            if (b.status === 'in-progress' && a.status !== 'in-progress') return 1;
            return new Date(`${a.date} ${a.time}`).getTime() - new Date(`${b.date} ${b.time}`).getTime();
        });
        setTodaysTrips(tripList);
        setLoading(false);
    });

    // 2. Listen to MY User Profile (To see assigned vehicle)
    const unsubUser = onSnapshot(doc(db, "users", user.id), async (docSnap) => {
        if (docSnap.exists()) {
            const userData = docSnap.data();
            if (userData.vehicle) {
                // Fetch vehicle details if assigned
                const vQuery = query(collection(db, "vehicles"), where("number", "==", userData.vehicle));
                const vSnap = await getDocs(vQuery);
                if (!vSnap.empty) {
                    setAssignedVehicle({ id: vSnap.docs[0].id, ...vSnap.docs[0].data() });
                } else {
                    // Fallback if vehicle details not found but number exists
                    setAssignedVehicle({ number: userData.vehicle, model: 'Unknown', type: 'Vehicle' });
                }
            } else {
                setAssignedVehicle(null);
            }
        }
    });

    // 3. Listen to Notifications (Assignment Logs)
    // Get the latest assignment log for this driver
    const notifQuery = query(
        collection(db, "assignment_logs"), 
        where("driverId", "==", user.id),
        orderBy("timestamp", "desc"),
        limit(1)
    );
    const unsubNotif = onSnapshot(notifQuery, (snap) => {
        setNotifications(snap.docs.map(doc => doc.data()));
    });

    return () => {
        unsubTrips();
        unsubUser();
        unsubNotif();
    };
  }, [user.id]);

  if (loading) return <div className="p-10 text-center">Loading Dashboard...</div>;

  const nextTrip = todaysTrips.length > 0 ? todaysTrips[0] : null;
  const isTripActive = nextTrip?.status === 'in-progress';
  const timeUntilTrip = isTripActive ? 'In Progress' : 'Upcoming'; 

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="driver-dashboard" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-3xl text-gray-900 mb-2">Welcome, {user.name}!</h1>
          <p className="text-gray-600">Manage your trips and assignments</p>
        </div>

        {/* NOTIFICATION SECTION */}
        {notifications.length > 0 && (
            <div className={`mb-8 border rounded-xl p-4 flex items-start gap-4 animate-in slide-in-from-top ${
                notifications[0].action.includes("Unassigned") ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"
            }`}>
                <div className={`p-2 rounded-full ${
                    notifications[0].action.includes("Unassigned") ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                }`}>
                    <Bell className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900">
                        {notifications[0].action.includes("Unassigned") ? "Vehicle Removed" : "New Vehicle Assignment"}
                    </h3>
                    <p className="text-sm text-gray-700 mt-1">
                        <strong>{notifications[0].assignedBy}</strong> {notifications[0].action.toLowerCase()} vehicle <strong>{notifications[0].vehicleNumber}</strong>.
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        {new Date(notifications[0].timestamp).toLocaleString()}
                    </p>
                </div>
            </div>
        )}

        {/* Assigned Vehicle Card */}
        {assignedVehicle ? (
            <Card className="p-6 mb-8 border-2 border-[#2563EB] bg-white">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl text-gray-900 font-bold flex items-center gap-2">
                        <Car className="w-6 h-6 text-[#2563EB]" /> Your Assigned Vehicle
                    </h2>
                    <Badge status="in-use" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="text-xs text-gray-500 uppercase">Number</div>
                        <div className="text-lg font-medium">{assignedVehicle.number}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase">Model</div>
                        <div className="text-lg font-medium">{assignedVehicle.model}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase">Type</div>
                        <div className="text-gray-700">{assignedVehicle.type}</div>
                    </div>
                    <div>
                         <div className="text-xs text-gray-500 uppercase">Service Due</div>
                         <div className="text-gray-700">{assignedVehicle.lastService || 'N/A'}</div>
                    </div>
                </div>
            </Card>
        ) : (
            <Card className="p-6 mb-8 bg-red-50 border-2 border-red-200 border-dashed">
                 <div className="text-center text-gray-500 py-4">
                    <Car className="w-12 h-12 mx-auto mb-2 opacity-50 text-red-400" />
                    <h3 className="text-red-600 font-bold text-lg">No Vehicle Assigned</h3>
                    <p className="text-sm text-gray-600 mt-1">You are not currently assigned to any vehicle.</p>
                    <p className="text-sm text-gray-800 font-medium mt-2">Please contact the Admin Panel.</p>
                 </div>
            </Card>
        )}

        {/* Active / Next Trip */}
        {nextTrip ? (
          <Card className={`p-6 mb-8 border-2 ${isTripActive ? 'bg-green-50 border-green-500' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl text-gray-900 mb-1">
                    {isTripActive ? "Current Trip (In Progress)" : "Next Trip"}
                </h2>
                <p className="text-sm text-gray-600">Status: {timeUntilTrip}</p>
              </div>
              <Badge status={nextTrip.status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <UserIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium">{nextTrip.customer || nextTrip.customerName}</div>
                    <div className="text-xs text-gray-500">{nextTrip.phone || nextTrip.customerPhone}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex gap-2"><MapPin className="w-4 h-4 text-green-600"/> {nextTrip.pickup}</div>
                <div className="flex gap-2"><MapPin className="w-4 h-4 text-blue-600"/> {nextTrip.destination}</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200/50">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex gap-1 items-center"><Clock className="w-4 h-4" /> {nextTrip.time}</span>
                <span className="flex gap-1 items-center"><Navigation className="w-4 h-4" /> {nextTrip.distance}</span>
              </div>
              <button
                onClick={() => onNavigate('driver-trip-detail', nextTrip.id)}
                className={`px-6 py-2 text-white rounded-xl transition-all ${isTripActive ? 'bg-green-600 hover:bg-green-700' : 'bg-[#2563EB] hover:bg-[#1E40AF]'}`}
              >
                {isTripActive ? "Continue Trip" : "Start Trip"}
              </button>
            </div>
          </Card>
        ) : (
            <div className="p-8 text-center bg-white rounded-xl border border-gray-200 mb-8">
                <div className="text-gray-500">No trips scheduled for today yet.</div>
            </div>
        )}
        
        {/* All Trips List */}
        <h2 className="text-lg font-bold text-gray-900 mb-4">Upcoming Schedule</h2>
        <div className="space-y-3">
            {todaysTrips.slice(1).map(trip => (
                <Card key={trip.id} className="p-4 flex justify-between items-center opacity-75 hover:opacity-100 transition-opacity">
                    <div className="text-sm">
                        <div className="font-medium">Trip #{trip.serialNumber || trip.id}</div>
                        <div className="text-gray-500">{trip.pickup} ➝ {trip.destination}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-bold bg-gray-100 px-2 py-1 rounded">{trip.time}</div>
                    </div>
                </Card>
            ))}
            {todaysTrips.length <= 1 && <p className="text-sm text-gray-400">No other trips in queue.</p>}
        </div>

      </div>
    </div>
  );
}