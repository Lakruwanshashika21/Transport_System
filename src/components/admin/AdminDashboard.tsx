import { useState, useEffect } from 'react';
import { Car, Calendar, CheckCircle, XCircle, Navigation, Users, AlertCircle, Shield, Lock, X, Clock, AlertTriangle, ChevronDown, ChevronUp,Plus } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

// 🔒 ADMIN DASHBOARD COMPONENT
// ============================================================================

// 🔒 HIDDEN CODE TO ENTER THE ADMIN PANEL
const PANEL_ACCESS_CODE = "OPEN_2025"; 

interface AdminDashboardProps {
    user: User;
    onNavigate: (screen: string) => void;
    onLogout: () => void;
}

// Helper function to replicate the critical risk calculation (now receives all data)
const getVehicleStats = (vehicle: any, completedAndBrokenTrips: any[]) => {
    // Filter trips relevant to mileage calculation (completed, broken-down, reassigned)
    const vehicleTrips = completedAndBrokenTrips.filter((t: any) => (t.vehicleId === vehicle.id || t.vehicleNumber === vehicle.number));
    
    let totalKm = 0;
    vehicleTrips.forEach(t => {
        // Calculate KM run for completed segments
        let kmRun = 0;
        if (t.status === 'completed' && t.odometerEnd && t.odometerStart) {
            kmRun = t.odometerEnd - t.odometerStart;
        } else if (t.status === 'broken-down' && t.breakdownOdometer && t.odometerStart) {
            // Use distance until breakdown for broken trips
            kmRun = t.breakdownOdometer - t.odometerStart;
        }
        totalKm += kmRun;
    });

    const lastServiceKm = vehicle.lastServiceMileage || 0;
    const serviceInterval = parseFloat(vehicle.serviceInterval) || 5000;
    const kmSinceService = Math.max(0, vehicle.initialMileage || 0) + totalKm - lastServiceKm; // Use total mileage accrued + initial mileage (if odometerStart logic is missing)
    const remainingKm = Math.max(0, serviceInterval - kmSinceService);

    const today = new Date();
    const expiryDate = vehicle.licenseExpiry ? new Date(vehicle.licenseExpiry) : null;
    let licenseStatus = 'valid';
    let daysToExpiry = 0;

    if (expiryDate) {
        const diffTime = expiryDate.getTime() - today.getTime();
        daysToExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (daysToExpiry < 0) licenseStatus = 'expired';
        else if (daysToExpiry <= 90) licenseStatus = 'warning';
    }

    // Critical risk logic: Low KM remaining AND near/past license expiry
    const isCriticalRisk = remainingKm <= 500 && (licenseStatus === 'warning' || licenseStatus === 'expired');

    return { totalKm, kmSinceService, remainingKm, licenseStatus, daysToExpiry, isCriticalRisk };
};

export function AdminDashboard({ user, onNavigate, onLogout }: AdminDashboardProps) {
    // 1. Data State
    const [liveVehicles, setLiveVehicles] = useState<any[]>([]);
    const [allTrips, setAllTrips] = useState<any[]>([]); // All trips from DB (used for stats/risk calculation)
    const [activeQueueTrips, setActiveQueueTrips] = useState<any[]>([]); // Trips requiring Admin attention
    const [criticalVehicles, setCriticalVehicles] = useState<any[]>([]); 
    
    const [stats, setStats] = useState({
        totalTrips: 0,
        activeVehicles: 0,
        completedTrips: 0,
        cancellations: 0,
        pendingApprovals: 0,
        brokenTrips: 0,
        mergeCandidates: 0,
    });
    const [loading, setLoading] = useState(true);

    // 2. Security Modal State
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [securityCode, setSecurityCode] = useState("");
    const [securityError, setSecurityError] = useState("");

    // 3. Data Fetching via Real-time Listeners
    useEffect(() => {
        setLoading(true);

        // 3.1. Listener for ALL Trips (for stats, filtering, and risk calculation)
        const unsubTrips = onSnapshot(collection(db, "trip_requests"), (snap) => {
            const requests = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllTrips(requests);

            // Filter lists based on status
            const completed = requests.filter((r: any) => r.status === 'completed');
            const cancelledOrBroken = requests.filter((r: any) => r.status === 'cancelled' || r.status === 'broken-down');
            
            const pendingApprovals = requests.filter((r: any) => r.status === 'pending');
            const broken = requests.filter((r: any) => r.status === 'broken-down');
            const merge = requests.filter((r: any) => ["pending_merge", "awaiting_merge_approval", "approved_merge_request", "merge_rejected"].includes(r.status));
            
            // Set the active queue trips (pending, broken, merge) to show up in the alert/link area
            setActiveQueueTrips([...pendingApprovals, ...broken, ...merge]);


            setStats(prev => ({
                ...prev,
                totalTrips: requests.length,
                completedTrips: completed.length,
                cancellations: cancelledOrBroken.length,
                pendingApprovals: pendingApprovals.length,
                brokenTrips: broken.length,
                mergeCandidates: merge.length,
            }));

        }, (error) => {
             console.error("Error fetching trip data:", error);
        });


        // 3.2. Listener for ALL Vehicles (for live tracking and critical risk calculation)
        const unsubVehicles = onSnapshot(collection(db, "vehicles"), (snap) => {
            const vehicles = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLiveVehicles(vehicles);

            // Update active vehicle count
            setStats(prev => ({
                ...prev,
                activeVehicles: vehicles.filter((v: any) => v.status === 'in-use').length,
            }));

            // Recalculate critical risks using the LATEST trip data
            const completedAndBrokenTrips = allTrips.filter((r: any) => 
                ['completed', 'broken-down', 'reassigned'].includes(r.status)
            );
            
            const criticalList = vehicles.filter((v: any) => getVehicleStats(v, completedAndBrokenTrips).isCriticalRisk);
            setCriticalVehicles(criticalList);

        }, (error) => {
             console.error("Error fetching vehicle data:", error);
        });
        
        setLoading(false);


        return () => { 
            unsubTrips(); 
            unsubVehicles();
        };
    }, [allTrips.length]); // Re-run effect when the base trip data changes (e.g., status flip)
    // NOTE: allTrips.length dependency is a simplified way to ensure vehicle risk calc updates 
    // when new trip data arrives, compensating for the limitations of combining async states.


    // 4. Handle Security Verification
    const handleAdminPanelAccess = () => {
        if (securityCode === PANEL_ACCESS_CODE) {
            setShowSecurityModal(false);
            setSecurityCode(""); // Clear code
            setSecurityError("");
            onNavigate('admin-management'); // Navigate only if code is correct
        } else {
            setSecurityError("❌ Access Denied: Invalid Code");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
                <div className="text-gray-500">Loading Transport System...</div>
            </div>
        );
    }

    // Prepare data for rendering
    const criticalRisksPresent = criticalVehicles.length > 0;
    const pendingReviewPresent = stats.pendingApprovals > 0 || stats.brokenTrips > 0 || stats.mergeCandidates > 0;
    const completedAndBrokenTrips = allTrips.filter((r: any) => 
        ['completed', 'broken-down', 'reassigned'].includes(r.status)
    );

    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="admin-dashboard" />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="mb-8">
                    <h1 className="text-3xl text-gray-900 mb-2">Admin Dashboard</h1>
                    <p className="text-gray-600">Monitor and manage the entire transport system</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <Card className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Calendar className="w-6 h-6 text-[#2563EB]" />
                            </div>
                            <div>
                                <div className="text-2xl text-gray-900">{stats.totalTrips}</div>
                                <div className="text-sm text-gray-500">Total Trips</div>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                <Car className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <div className="text-2xl text-gray-900">{stats.activeVehicles}</div>
                                <div className="text-sm text-gray-500">Active Vehicles</div>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <div className="text-2xl text-gray-900">{stats.completedTrips}</div>
                                <div className="text-sm text-gray-500">Completed Trips</div>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                                <XCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <div className="text-2xl text-gray-900">{stats.cancellations}</div>
                                <div className="text-sm text-gray-500">Cancellations</div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* 🚨 CRITICAL RISK ALERT (NEW FEATURE) */}
                {criticalRisksPresent && (
                    <div className="mb-8">
                        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="w-6 h-6 text-red-600 animate-pulse" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg text-gray-900 mb-2 font-bold">CRITICAL VEHICLE ALERT! ({criticalVehicles.length})</h3>
                                    <p className="text-gray-600 mb-4 text-sm">
                                        {criticalVehicles.length} vehicle(s) require immediate attention due to low service mileage remaining or expiring licenses.
                                    </p>
                                    <ul className="list-disc list-inside text-sm text-red-700 font-medium mb-4">
                                        {criticalVehicles.slice(0, 3).map((v: any) => {
                                            const vStats = getVehicleStats(v, completedAndBrokenTrips); 
                                            return <li key={v.id}>{v.number}: {vStats.remainingKm.toFixed(0)} km left / License {vStats.licenseStatus.toUpperCase()}</li>;
                                        })}
                                    </ul>
                                    <button onClick={() => onNavigate('vehicle-management')} className="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all">
                                        Go to Vehicle Management
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ⚠️ PENDING REVIEW ALERT (Combined Trip Approval/Breakdown/Merge) */}
                {pendingReviewPresent && (
                    <div className="mb-8">
                        <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <AlertCircle className="w-6 h-6 text-orange-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg text-gray-900 mb-2 font-bold">Pending Action Required!</h3>
                                    <p className="text-gray-600 mb-4 text-sm font-medium">
                                        You have {stats.pendingApprovals} pending trip request(s), {stats.brokenTrips} breakdown(s), and {stats.mergeCandidates} merge candidate(s) awaiting action.
                                    </p>
                                    <button onClick={() => onNavigate('trip-approval')} className="px-6 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-all">
                                        Review All Requests ({activeQueueTrips.length} Total)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card className="p-6">
                            <h2 className="text-xl text-gray-900 mb-4">Live Vehicle Tracking</h2>
                            {/* Live Map Placeholder */}
                            <div className="w-full h-96 bg-gray-200 rounded-xl flex items-center justify-center mb-4 relative overflow-hidden">
                                <div className="text-center z-10">
                                    <Navigation className="w-16 h-16 text-[#2563EB] mx-auto mb-3" />
                                    <p className="text-gray-500">Real-time Vehicle Locations</p>
                                </div>
                            </div>
                            {/* Live Vehicle List */}
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {liveVehicles.length === 0 ? (
                                    <p className="text-gray-500 text-center py-4">No vehicles found in database.</p>
                                ) : (
                                    liveVehicles.map((vehicle: any) => (
                                        <div key={vehicle.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                                                    <Car className="w-5 h-5 text-gray-600" />
                                                </div>
                                                <div>
                                                    <div className="text-sm text-gray-900 font-medium">{vehicle.number || 'Unknown Number'}</div>
                                                    <div className="text-sm text-gray-500">{vehicle.model || 'Unknown Model'}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-xs text-gray-600">{vehicle.driverName || 'Unassigned'}</div>
                                                <Badge status={vehicle.status || 'available'} size="sm" />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Quick Actions */}
                    <div className="space-y-6">
                        
                        {/* 🔒 SECURE ADMIN MANAGEMENT CARD */}
                        <Card 
                            onClick={() => setShowSecurityModal(true)} 
                            className="p-6 cursor-pointer hover:shadow-lg transition-all border-l-4 border-red-500"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-red-600" />
                                </div>
                                <div>
                                    <div className="text-gray-900 font-medium">Admin Management</div>
                                    <div className="text-sm text-gray-500">Restricted Access</div>
                                </div>
                            </div>
                        </Card>
                        
                        {/* System History Button */}
                        <Card onClick={() => onNavigate('admin-history')} className="p-6 cursor-pointer hover:shadow-lg transition-all border-l-4 border-blue-500 bg-blue-50">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-blue-200 rounded-xl flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-blue-800" />
                                </div>
                                <div>
                                    <div className="text-gray-900 font-bold">System History</div>
                                    <div className="text-sm text-gray-600">View Audit Logs</div>
                                </div>
                            </div>
                        </Card>

                        {/* Trip Approval Card */}
                        <Card onClick={() => onNavigate('trip-approval')} className="p-6 cursor-pointer hover:shadow-lg transition-all">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                                    <AlertCircle className="w-6 h-6 text-orange-600" />
                                </div>
                                <div>
                                    <div className="text-gray-900">Trip Approval</div>
                                    <div className="text-sm text-gray-500">{activeQueueTrips.length} pending actions</div>
                                </div>
                            </div>
                        </Card>

                        
                        {/*Quick Trip Card */}
                        <Card onClick={() => onNavigate('quick-book-trip')} className="p-6 cursor-pointer hover:shadow-lg transition-all">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <Plus className="w-6 h-6 text-white-600" />
                                </div>
                                <div>
                                    <div className="text-gray-900">Quick Trip Booking</div>
                                    <div className="text-sm text-gray-500">Quick trip booking</div>
                                </div>
                            </div>
                        </Card>

                        {/* Vehicle Management Card */}
                        <Card onClick={() => onNavigate('vehicle-management')} className="p-6 cursor-pointer hover:shadow-lg transition-all">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                                    <Car className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <div className="text-gray-900">Vehicle Management</div>
                                    <div className="text-sm text-gray-500">Manage fleet</div>
                                </div>
                            </div>
                        </Card>

                        {/* Driver Management Card */}
                        <Card onClick={() => onNavigate('driver-management')} className="p-6 cursor-pointer hover:shadow-lg transition-all">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                                    <Users className="w-6 h-6 text-purple-600" />
                                </div>
                                <div>
                                    <div className="text-gray-900">Driver Management</div>
                                    <div className="text-sm text-gray-500">Assign drivers</div>
                                </div>
                            </div>
                        </Card>

                        {/* User Management Card */}
                        <Card onClick={() => onNavigate('user-management')} className="p-6 cursor-pointer hover:shadow-lg transition-all">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <Users className="w-6 h-6 text-[#2563EB]" />
                                </div>
                                <div>
                                    <div className="text-gray-900">User Management</div>
                                    <div className="text-sm text-gray-500">Search users</div>
                                </div>
                            </div>
                        </Card>
                        
                        {/* Reports Card */}
                        <Card onClick={() => onNavigate('reports')} className="p-6 cursor-pointer hover:shadow-lg transition-all">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                                    <Calendar className="w-6 h-6 text-gray-600" />
                                </div>
                                <div>
                                    <div className="text-gray-900">Reports</div>
                                    <div className="text-sm text-gray-500">Generate reports</div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            {/* 🔒 SECURITY ENTRY MODAL (Retained) */}
            {showSecurityModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Lock className="w-5 h-5 text-red-600" /> Security Check
                            </h3>
                            <button onClick={() => setShowSecurityModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        
                        <p className="text-gray-500 mb-4 text-sm">
                            This area is restricted to Super Admins. Please enter the master dashboard code to proceed.
                        </p>

                        <input
                            type="password"
                            value={securityCode}
                            onChange={(e) => setSecurityCode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdminPanelAccess()}
                            className="w-full p-3 border-2 border-gray-200 rounded-xl mb-2 focus:border-red-500 focus:outline-none text-center font-mono text-lg tracking-widest"
                            placeholder="••••••••"
                            autoFocus
                        />
                        
                        {securityError && <div className="text-red-600 text-sm font-medium mb-4 text-center">{securityError}</div>}

                        <button 
                            onClick={handleAdminPanelAccess}
                            className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-black transition-all"
                        >
                            Verify & Enter
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}