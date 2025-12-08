import { useState, useEffect } from 'react';
import { Car, Calendar, Clock, MapPin, User as UserIcon, Phone, Navigation, Play, Bell, Check, Gauge, FileText, Wrench, MessageSquare, Phone as PhoneIcon } from 'lucide-react';
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

// Helper to determine if a trip date is exactly today
const isToday = (dateString: string) => {
    // Note: The date comparison is based on midnight (00:00:00) of the trip date vs. today's date.
    const tripDateTime = new Date(dateString).setHours(0, 0, 0, 0);
    const today = new Date().setHours(0, 0, 0, 0);
    return tripDateTime <= today;
};

// CRITICAL: Helper to determine if a trip should be displayed.
// Filters out completed, cancelled, rejected, and any past 'approved' trips.
const isRelevantTrip = (trip: any) => {
    // 1. Exclude final states immediately
    if (['completed', 'cancelled', 'rejected'].includes(trip.status)) {
        return false;
    }

    // 2. Keep active states (in-progress, reassigned) regardless of date, as they need immediate action.
    if (['in-progress', 'reassigned'].includes(trip.status)) {
        return true;
    }

    // 3. Keep approved trips scheduled for today or the future
    const tripDateTime = new Date(trip.date).setHours(0, 0, 0, 0);
    const today = new Date().setHours(0, 0, 0, 0);
    return tripDateTime >= today;
};

// Determine Trip Type from Serial Number Prefix
const getTripType = (serialNumber: string) => {
    if (!serialNumber) return { type: 'Normal', color: 'bg-gray-500', icon: <Check className="w-3 h-3"/> };
    const prefix = serialNumber.split('-')[0].toUpperCase();
    switch (prefix) {
        case 'M': return { type: 'Merged Trip', color: 'bg-purple-600', icon: <MessageSquare className="w-3 h-3"/> };
        case 'B': return { type: 'Re-Assigned (Breakdown)', color: 'bg-yellow-600', icon: <Wrench className="w-3 h-3"/> };
        case 'N':
        default: return { type: 'Normal Trip', color: 'bg-blue-600', icon: <Check className="w-3 h-3"/> };
    }
}

// Helper for sorting trips based on operational rules (In-progress > Reassigned > Approved > Date/Time)
const sortTrips = (tripList: any[]) => {
    return tripList.sort((a: any, b: any) => {
        // 1. Prioritize by status
        const statusOrder = (status: string) => {
            if (status === 'in-progress') return 0;
            if (status === 'reassigned') return 1;
            if (status === 'approved') return 2;
            return 3;
        };

        const orderA = statusOrder(a.status);
        const orderB = statusOrder(b.status);

        if (orderA !== orderB) return orderA - orderB;

        // 2. Sort by Date/Time (Ascending) for same status
        const dateA = new Date(`${a.date} ${a.time}`).getTime();
        const dateB = new Date(`${b.date} ${b.time}`).getTime();
        return dateA - dateB;
    });
};


export function DriverDashboard({ user, onNavigate, onLogout }: DriverDashboardProps) {
    const [allTrips, setAllTrips] = useState<any[]>([]); // All relevant trips
    const [loading, setLoading] = useState(true);
    const [assignedVehicle, setAssignedVehicle] = useState<any>(null);
    const [notifications, setNotifications] = useState<any[]>([]);
    
    // State for trip categorization
    const [currentTrip, setCurrentTrip] = useState<any>(null);
    const [upcomingSchedule, setUpcomingSchedule] = useState<any[]>([]);

    useEffect(() => {
        setLoading(true);
        
        // 1. Fetch all trips assigned to this driver
        const tripsQuery = query(
            collection(db, "trip_requests"), 
            where("driverId", "==", user.uid)
            // Note: We deliberately exclude status filtering in the query to handle complex client-side filtering logic
        );
        
        const unsubTrips = onSnapshot(tripsQuery, (snap) => {
            const rawTripList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // 🎯 FILTER: Exclude completed, cancelled, rejected, and past approved trips
            const filteredTrips = rawTripList.filter(isRelevantTrip);
            
            const sortedTrips = sortTrips(filteredTrips);
            setAllTrips(sortedTrips);
            
            // 🚨 DETERMINE CURRENT/NEXT TRIP 🚨
            const activeTrip = sortedTrips.find(t => t.status === 'in-progress'); // Priority 1: The truly active trip

            if (activeTrip) {
                setCurrentTrip(activeTrip);
                setUpcomingSchedule(sortedTrips.filter(t => t.id !== activeTrip.id));
            } else {
                // Priority 2: Next scheduled trip (approved or reassigned), which is the first one in the sorted list
                const nextTrip = sortedTrips[0] || null;
                setCurrentTrip(nextTrip); 
                setUpcomingSchedule(sortedTrips.filter(t => t.id !== nextTrip?.id));
            }
            
            setLoading(false);
        });

        // 2. Listen to MY User Profile (To see assigned vehicle)
        const unsubUser = onSnapshot(doc(db, "users", user.uid), async (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                if (userData.vehicle) {
                    // Fetch vehicle details if assigned
                    const vQuery = query(collection(db, "vehicles"), where("number", "==", userData.vehicle));
                    const vSnap = await getDocs(vQuery);
                    if (!vSnap.empty) {
                        setAssignedVehicle({ id: vSnap.docs[0].id, ...vSnap.docs[0].data() });
                    } else {
                        setAssignedVehicle({ number: userData.vehicle, model: 'Unknown', type: 'Vehicle' });
                    }
                } else {
                    setAssignedVehicle(null);
                }
            }
        });

        // 3. Listen to Notifications (Assignment Logs)
        const notifQuery = query(
            collection(db, "assignment_logs"), 
            where("driverId", "==", user.uid),
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
    }, [user.uid]);

    if (loading) return <div className="p-10 text-center">Loading Dashboard...</div>;

    const isTripActive = currentTrip?.status === 'in-progress'; // Only in-progress is 'active' for continuation
    
    // Condition to allow 'Start Trip': Must be the next approved/reassigned trip AND must be today's date
    const isStartable = currentTrip && (currentTrip.status === 'approved' || currentTrip.status === 'reassigned') && isToday(currentTrip.date);
    
    const currentTripType = currentTrip ? getTripType(currentTrip.serialNumber) : null;


    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="driver-dashboard" />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="mb-8">
                    <h1 className="text-3xl text-gray-900 mb-2">Welcome, {user.name}!</h1>
                    <p className="text-gray-600">Manage your trips and assignments</p>
                </div>

                {/* NOTIFICATION SECTION (Retained) */}
                {notifications.length > 0 && (
                    <Card className={`mb-8 border p-4 flex items-start gap-4 animate-in slide-in-from-top ${
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
                    </Card>
                )}
                
                {/* Reassignment Alert - FIX: Added handover details */}
                {currentTripType?.type === 'Re-Assigned (Breakdown)' && (
                     <Card className="mb-8 p-4 bg-yellow-100 border-l-4 border-yellow-500 flex items-start gap-3">
                         <Wrench className="w-6 h-6 text-yellow-700 flex-shrink-0" />
                         <div className='text-sm text-yellow-800 flex-1'>
                              <p className='font-bold'>URGENT: Handover Required - Re-assigned Trip</p>
                              <p className='mt-1'>**Go to Breakdown Site:** <span className='font-semibold text-gray-900'>{currentTrip.breakdownLocation || currentTrip.pickup}</span></p>
                              
                              <div className='mt-2 pt-2 border-t border-yellow-300 space-y-1'>
                                  <p className='font-semibold text-gray-900'>Handover Contacts:</p>
                                  <div className='flex items-center gap-3 text-xs'>
                                      <UserIcon className='w-3 h-3 text-gray-700' />
                                      **Customer:** {currentTrip.customer || currentTrip.customerName} - 
                                      <PhoneIcon className='w-3 h-3 text-blue-600'/> {currentTrip.customerPhone || 'N/A'}
                                  </div>
                                  <div className='flex items-center gap-3 text-xs'>
                                      <UserIcon className='w-3 h-3 text-gray-700' />
                                      **Original Driver:** {currentTrip.originalDriverName || 'N/A'} - 
                                      <PhoneIcon className='w-3 h-3 text-blue-600'/> {currentTrip.originalDriverPhone || 'N/A'}
                                  </div>
                              </div>

                              {currentTrip.costBreakdown && (
                                   <p className='text-xs font-medium mt-2'>Original Vehicle Cost: LKR {currentTrip.costBreakdown.oldCost} (Up to breakdown odometer).</p>
                              )}
                         </div>
                     </Card>
                )}
                
                {/* Merge Alert (Retained) */}
                {currentTripType?.type === 'Merged Trip' && (
                     <Card className="mb-8 p-4 bg-purple-100 border-l-4 border-purple-500 flex items-center gap-3">
                          <MessageSquare className="w-6 h-6 text-purple-700 flex-shrink-0" />
                          <div className='text-sm text-purple-800'>
                              <p className='font-bold'>NOTE: This is a MERGED trip.</p>
                              <p>You are transporting passengers from multiple original requests. Review the **Trip Detail** screen for all passenger and destination information.</p>
                          </div>
                     </Card>
                )}

                {/* MAIN CONTENT GRID (Retained) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* LEFT COLUMN: VEHICLE & CURRENT/NEXT TRIP (Retained) */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Assigned Vehicle Card (Retained) */}
                        {assignedVehicle ? (
                            <Card className="p-6 border-2 border-[#2563EB] bg-white">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl text-gray-900 font-bold flex items-center gap-2">
                                        <Car className="w-6 h-6 text-[#2563EB]" /> Assigned Vehicle
                                    </h2>
                                    <Badge status={assignedVehicle.status === 'in-maintenance' ? 'maintenance' : 'in-use'} />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <div className="text-xs text-gray-500 uppercase">Number</div>
                                        <div className="text-lg font-medium">{assignedVehicle.number}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 uppercase">Model</div>
                                        <div className="text-lg font-medium">{assignedVehicle.model}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 uppercase">License Exp.</div>
                                        <div className="text-sm text-gray-700">{assignedVehicle.licenseExpiry || 'N/A'}</div>
                                    </div>
                                </div>
                            </Card>
                        ) : (
                            <Card className="p-6 border-2 border-red-200 border-dashed bg-red-50/50">
                                <div className="text-center py-4">
                                    <Car className="w-12 h-12 mx-auto mb-2 opacity-50 text-red-400" />
                                    <h3 className="text-red-600 font-bold text-lg">No Vehicle Assigned</h3>
                                    <p className="text-sm text-gray-600 mt-1">Please contact the Admin Panel.</p>
                                </div>
                            </Card>
                        )}
                        
                        {/* Active / Next Trip Card (Retained) */}
                        {currentTrip ? (
                            <Card className={`p-6 border-2 ${isTripActive ? 'bg-green-50 border-green-500' : 'border-gray-200'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="text-xl text-gray-900 mb-1">
                                            {isTripActive ? "Current Trip" : "Next Scheduled Trip"}
                                        </h2>
                                        <p className="text-sm text-gray-600">
                                            {isTripActive ? "Status: In Progress" : isToday(currentTrip.date) ? "Starts Today" : `Date: ${currentTrip.date}`}
                                        </p>
                                    </div>
                                    {/* Trip Type Badge */}
                                    {currentTrip.serialNumber && (
                                        <div className={`flex items-center gap-1 px-3 py-1 text-xs text-white font-bold rounded-full mr-2 ${currentTripType.color}`}>
                                            {currentTripType.icon} {currentTripType.type}
                                        </div>
                                    )}
                                    <Badge status={currentTrip.status} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 pt-4 border-t border-gray-100">
                                    {/* Route */}
                                    <div className="space-y-2 text-sm">
                                        <div className="font-medium text-gray-900 mb-1">Trip ID: {currentTrip.serialNumber || currentTrip.id}</div>
                                        <div className="flex gap-2"><MapPin className="w-4 h-4 text-green-600"/> {currentTrip.pickup}</div>
                                        <div className="flex gap-2"><MapPin className="w-4 h-4 text-blue-600"/> {currentTrip.destination}</div>
                                        <div className="flex gap-2 text-xs text-gray-500 pt-1"><Clock className="w-3 h-3" /> Time: {currentTrip.time}</div>
                                    </div>
                                    
                                    {/* Customer/Metrics */}
                                    <div className="space-y-2 text-sm bg-gray-50 p-3 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <UserIcon className="w-4 h-4 text-gray-400" />
                                            <div className="font-medium">{currentTrip.customer || currentTrip.customerName}</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Navigation className="w-4 h-4 text-gray-400" />
                                            <div className="font-medium">{currentTrip.distance}</div>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-600">
                                            <Car className="w-4 h-4 text-gray-400" />
                                            Approved By: {currentTrip.approvedByAdmin || 'Admin'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        onClick={() => onNavigate('driver-trip-detail', currentTrip.id)}
                                        // LOGIC: Enable button if ACTIVE ('in-progress') OR STARTABLE (next and today's date)
                                        disabled={!(isStartable || isTripActive)} 
                                        className={`px-6 py-2 text-white rounded-xl transition-all font-semibold ${
                                            isTripActive ? 'bg-green-600 hover:bg-green-700' :
                                            isStartable ? 'bg-[#2563EB] hover:bg-[#1E40AF]' : 
                                            'bg-gray-400 cursor-not-allowed'
                                        }`}
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
                    </div>

                    {/* RIGHT COLUMN: UPCOMING SCHEDULE & ACTIONS (Retained) */}
                    <div className="lg:col-span-1 space-y-6">
                        
                        <Card className='p-4'>
                            <h3 className="text-lg font-bold text-gray-900 mb-3">Upcoming Schedule</h3>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {upcomingSchedule.length > 0 ? upcomingSchedule.map(trip => (
                                    <Card 
                                        key={trip.id} 
                                        // Enable click/navigation for ALL upcoming trips to view details
                                        onClick={() => onNavigate('driver-trip-detail', trip.id)} 
                                        className="p-3 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                                    >
                                        <div className="text-sm">
                                            <div className="font-medium text-gray-900">Trip #{trip.serialNumber || trip.id}</div>
                                            
                                            {/* MODIFIED: Explicitly show customer name/ID */}
                                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                                <UserIcon className="w-3 h-3 text-gray-400" />
                                                Customer: {trip.customer || trip.customerName}
                                            </div>

                                            {/* MODIFIED: Explicitly show date/time */}
                                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                                <Calendar className="w-3 h-3 text-gray-400" />
                                                Scheduled: {trip.date} at {trip.time}
                                            </div>

                                            {/* Trip Type Badge in Upcoming Schedule */}
                                            {trip.serialNumber && (
                                                <div className="mt-1">
                                                    <span className={`flex items-center gap-1 px-2 py-0.5 text-xs text-white font-semibold rounded ${getTripType(trip.serialNumber).color}`}>
                                                        {getTripType(trip.serialNumber).icon} {getTripType(trip.serialNumber).type.split(' ')[0]}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <Badge status={trip.status} size="sm" />
                                        </div>
                                    </Card>
                                )) : <p className="text-sm text-gray-500">No future trips scheduled.</p>}
                            </div>
                        </Card>
                        
                        {/* History Quick Link */}
                        <Card onClick={() => onNavigate('trip-history')} className="p-4 bg-white hover:bg-gray-50 border-blue-500 border-l-4 cursor-pointer">
                            <div className="flex items-center gap-3">
                                <FileText className='w-5 h-5 text-blue-600' />
                                <div className="font-medium">View Full Trip History</div>
                            </div>
                        </Card>
                        
                    </div>
                </div>

            </div>
        </div>
    );
}