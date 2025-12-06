import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
// 💥 CRITICAL FIX: Ensure all required Lucide icons are imported on this line 💥
import { MapPin, User as UserIcon, Phone, Navigation, Play, Square, CheckCircle, ChevronDown, ChevronUp, AlertTriangle, Wrench, ArrowLeft, Gauge, User as PaxIcon, MessageSquare, Plus, Users as CombinedUsers, Search, Phone as PhoneIcon, Mail, Loader2, Trash2, Car, Calendar, Clock, FileText, Banknote, Upload, X } from 'lucide-react'; 
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { doc, getDoc, updateDoc, addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { logAction } from '../../utils/auditLogger'; 

// --- ASYNC HELPERS (MOCK IMPLEMENTATIONS RETAINED FOR COMPILATION) ---
const getMapRouteDistanceKm = async (locations: string[]): Promise<number> => { return locations.length * 50; };
const calculateOriginalVehicleDistance = async (trip: any): Promise<number> => { return 0; };
const calculateRemainingDistanceKm = async (trip: any, newStartPlace: string): Promise<number> => { return 0; };

// Helper to determine if a trip date is exactly today
const isToday = (dateString: string) => {
    const tripDateTime = new Date(dateString).setHours(0, 0, 0, 0);
    const today = new Date().setHours(0, 0, 0, 0);
    return tripDateTime === today;
};

// 🚨 GPS Hook: Uses a simulated location for the development environment.
const useDriverGPS = () => {
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    useEffect(() => { setLocation({ lat: 6.9271, lng: 79.8612 }); return () => {}; }, []); 
    return location;
};

interface DriverTripDetailProps {
    user: User;
    tripId: string | null;
    onNavigate: (screen: string) => void;
    onLogout: () => void;
}

// Helper Component for Collapsible Stops (Retained)
const DriverStopList = ({ destinations, finalDestination }: { destinations?: string[], finalDestination: string }) => {
    const [expanded, setExpanded] = useState(false);
    
    if (!destinations || destinations.length === 0) {
      return (
           <div className="flex gap-4 items-start">
             <div className="flex flex-col items-center mt-0.5">
                <div className="w-3 h-3 bg-red-500 rounded-full"/>
             </div>
             <div>
                <div className="text-xs text-gray-500 uppercase">Drop-off</div>
                <div className="text-gray-900 font-medium">{finalDestination}</div>
             </div>
           </div>
      );
    }
    
    const allPoints = [...(destinations || []), finalDestination]; // Ensure all points are included in the array for accurate indexing
    const pointsToShow = expanded ? allPoints : allPoints.slice(0, 2);

    return (
      <>
        <div className="flex gap-4 items-start">
             <div className="flex flex-col items-center mt-0.5">
                 <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm"/>
                 <div className="w-0.5 h-full bg-gray-200"/>
             </div>
             <div>
                 <div className="text-xs text-gray-500 uppercase">Stop 1</div>
                 <div className="text-gray-900">{destinations[0]}</div>
             </div>
        </div>
        
        {/* Render rest of stops if expanded, or the expand button */}
        {expanded && destinations.slice(1).map((stop, index) => (
             <div key={index + 1} className="flex gap-4 items-start pt-2">
                 <div className="flex flex-col items-center">
                     <div className="w-0.5 h-full bg-gray-200"/>
                     <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm"/>
                     <div className="w-0.5 h-full bg-gray-200"/>
                 </div>
                 <div>
                     <div className="text-xs text-gray-500 uppercase">Stop {index + 2}</div>
                     <div className="text-gray-900">{stop}</div>
                 </div>
             </div>
        ))}
        
        {/* Toggle Button */}
        {destinations.length > 1 && (
            <div className="flex justify-center my-2">
                <button 
                    onClick={() => setExpanded(!expanded)} 
                    className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                    {expanded ? 'Show Less Stops' : `Show ${destinations.length - 1} More Stops`}
                    {expanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                </button>
            </div>
        )}
        
        {/* Final Drop-off */}
        <div className="flex gap-4 items-start pt-2">
            <div className="flex flex-col items-center">
               <div className="w-0.5 h-full bg-gray-200"/>
               <div className="w-3 h-3 bg-red-500 rounded-full"/>
            </div>
            <div>
               <div className="text-xs text-gray-500 uppercase">Drop-off</div>
               <div className="text-gray-900 font-medium">{finalDestination}</div>
            </div>
        </div>
      </>
    );
};
    

export function DriverTripDetail({ user, tripId, onNavigate, onLogout }: DriverTripDetailProps) {
    const [trip, setTrip] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showSummary, setShowSummary] = useState(false);
    
    const [showOdometerModal, setShowOdometerModal] = useState(false);
    const [odometerInput, setOdometerInput] = useState('');
    const [modalActionType, setModalActionType] = useState<'start' | 'end' | null>(null);

    const [showBreakdownModal, setShowBreakdownModal] = useState(false);
    const [breakdownReason, setBreakdownReason] = useState('');
    const [breakdownOdometer, setBreakdownOdometer] = useState('');
    const [lastVisitedStop, setLastVisitedStop] = useState('');
    const [breakdownAddress, setBreakdownAddress] = useState('');
    const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]); 
    // State to manage the loading/fetching of GPS data
    const [gpsLoading, setGpsLoading] = useState(false); 
    
    // Fine Claim Modal state (Retained)
    const [showFineClaimModal, setShowFineClaimModal] = useState(false);
    const [fineClaimData, setFineClaimData] = useState({
        fineDate: new Date().toISOString().split('T')[0], 
        policeStationPlace: '', 
        amount: '',
        reason: '', 
        fineDescription: '', 
        photoUrl: '' 
    });


    const driverLocation = useDriverGPS();

    // Collect all destinations and the final drop-off
    const allTripStops = trip ? [
        trip.pickup, 
        ...(trip.destinations || []),
        trip.destination // Include final drop-off
    ] : [];

    // --- 🎯 CORRECTED LOCATION HANDLERS for Breakdown Modal ---
    const handleLocationSearch = async (query: string) => {
        setBreakdownAddress(query);
        if (query.length < 3) { setLocationSuggestions([]); return; }
        
        const lowerQuery = query.toLowerCase();
        const specialMatches = [
            { display_name: "Carlos Embellishers (Pvt) Ltd - Veyangoda (Head Office)", lat: 7.1667, lon: 80.0500 },
            { display_name: "Eskimo Fashion Knitwear - Negombo (Main)", lat: 7.2008, lon: 79.8737 },
        ].filter(loc => loc.display_name.toLowerCase().includes(lowerQuery));

        let apiMatches: any[] = [];
        try {
            // MOCK: API call to Nominatim
            apiMatches = [{ display_name: `${query} Address 1 (MOCK)`, lat: 6.9, lon: 79.8 }, { display_name: `${query} Warehouse (MOCK)`, lat: 6.95, lon: 79.9 }];
        } catch (e) { console.error("Location search failed", e); }
        
        setLocationSuggestions([...specialMatches, ...apiMatches]);
    };
    
    const handleSelectLocation = (address: string) => {
        setBreakdownAddress(address);
        setLocationSuggestions([]);
    };

    const handleUseGPS = async () => {
        if (!driverLocation) {
            alert("GPS location unavailable or still fetching.");
            return;
        }
        setGpsLoading(true);

        // Use real GPS if available, otherwise fallback to simulated hook location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    try {
                        const response = { json: async () => ({ display_name: `Current GPS Location (${lat.toFixed(4)})` }) };
                        const data = await response.json();
                        const address = data.display_name || `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                        setBreakdownAddress(address);
                    } catch (e) {
                        setBreakdownAddress(`GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                    }
                    setGpsLoading(false);
                    setLocationSuggestions([]);
                },
                (error) => {
                    alert("GPS Error: " + error.message);
                    setGpsLoading(false);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            // Fallback for simulated hook location (driverLocation)
            try {
                const response = { json: async () => ({ display_name: `Simulated Handover Point` }) };
                const data = await response.json();
                const address = data.display_name || `GPS: ${driverLocation.lat.toFixed(4)}, ${driverLocation.lng.toFixed(4)}`;
                setBreakdownAddress(address);
            } catch (e) {
                setBreakdownAddress(`GPS: ${driverLocation.lat.toFixed(4)}, ${driverLocation.lng.toFixed(4)}`);
            }
            setGpsLoading(false);
            setLocationSuggestions([]);
        }
    };
    // --- END CORRECTED LOCATION HANDLERS ---


    // 1. Fetch Trip Data (Retained)
    useEffect(() => {
        const fetchTrip = async () => {
            if (!tripId) return;

            try {
                const docRef = doc(db, "trip_requests", tripId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    let data = { id: docSnap.id, ...docSnap.data() };
                        
                    // 🚨 Fetch Customer details (if available)
                    if (data.userId) {
                        const userSnap = await getDoc(doc(db, "users", data.userId));
                        if (userSnap.exists()) {
                            const userData = userSnap.data();
                            data = { ...data, customerName: userData.fullName || userData.name, customerPhone: userData.phone };
                        }
                    }

                    // 🚨 Fetch Original Driver details (if applicable for re-assigned trip)
                    if (data.originalDriverId) {
                        const driverSnap = await getDoc(doc(db, "users", data.originalDriverId));
                        if (driverSnap.exists()) {
                            const driverData = driverSnap.data();
                            // Store original driver contact details
                            data = { ...data, originalDriverName: driverData.fullName, originalDriverPhone: driverData.phone };
                        }
                    }

                    setTrip(data);
                    
                    // 🚨 FIX 1: Show summary ONLY for terminal states
                    if (['completed', 'broken-down', 'cancelled', 'rejected'].includes(data.status)) {
                        setShowSummary(true);
                    } else {
                        setShowSummary(false); // Ensure modal view is ready for 'approved' or 're-assigned'
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
    }, [tripId, onNavigate, user.id]);

    // 2. Handlers (Retained)
    const handleStartTripClick = () => {
        // Show modal to ask for odometer
        setOdometerInput(trip?.odometerStart || '');
        setModalActionType('start');
        setShowOdometerModal(true);
    };

    const handleEndTripClick = () => {
        // Show modal to ask for odometer
        setOdometerInput(''); // Clear for new end reading
        setModalActionType('end');
        setShowOdometerModal(true);
    };
    
    // 🆕 NEW HANDLER: Submits Odometer and updates trip status
    const handleSubmitOdometer = async () => {
        if (!trip || !odometerInput) { alert("Odometer reading required."); return; }
        const odometer = Number(odometerInput);
        if (isNaN(odometer) || odometer <= 0) { alert("Invalid odometer value."); return; }
        
        try {
            const tripRef = doc(db, "trip_requests", trip.id);
            
            if (modalActionType === 'start') {
                await updateDoc(tripRef, {
                    status: 'in-progress',
                    startedAt: new Date().toISOString(),
                    odometerStart: odometer // 🆕 SAVE ODOMETER START
                });
                // Update Vehicle/Driver Status to In-Use (redundant but safe check)
                if (trip.vehicleId) { await updateDoc(doc(db, "vehicles", trip.vehicleId), { status: 'in-use' }); }
                if (user.id) { await updateDoc(doc(db, "users", user.id), { status: 'in-use', currentTripId: trip.id }); }


                setTrip((prev: any) => ({ ...prev, status: 'in-progress', odometerStart: odometer }));
                alert('Trip started! Odometer recorded.');
                
            } else if (modalActionType === 'end') {
                if (odometer < (trip.odometerStart || 0)) {
                    alert(`Error: End Odometer (${odometer}) cannot be less than Start Odometer (${trip.odometerStart}).`);
                    return;
                }
                
                const distanceRun = odometer - (trip.odometerStart || 0);
                
                await updateDoc(tripRef, {
                    status: 'completed', // 🎯 CRITICAL: Mark as completed
                    endedAt: new Date().toISOString(),
                    odometerEnd: odometer, // 🆕 SAVE ODOMETER END
                    kmRun: distanceRun
                });

                // Update Vehicle/Driver Status to Available
                if (trip.vehicleId) { await updateDoc(doc(db, "vehicles", trip.vehicleId), { status: 'available' }); }
                if (user.id) { await updateDoc(doc(db, "users", user.id), { status: 'available', currentTripId: null }); }
                
                setTrip((prev: any) => ({ ...prev, status: 'completed', odometerEnd: odometer, kmRun: distanceRun }));
                
                // 💥 FIX 2: Upon successful trip completion, immediately ask for the Police Fine Claim 💥
                setShowFineClaimModal(true); 
                setShowOdometerModal(false); // Close Odometer modal
                return; // Stop here to handle fine modal flow
            }
            
            setShowOdometerModal(false);
            setOdometerInput('');
            setModalActionType(null);

        } catch (error) {
            console.error(`Error ${modalActionType}ing trip:`, error);
            alert(`Failed to ${modalActionType} trip. Please try again.`);
        }
    };

    // 🆕 NEW HANDLER: Breakdown/Cancel Trip
    const handleReportBreakdown = async () => {
        if (!trip || !breakdownReason.trim() || !breakdownOdometer || !lastVisitedStop || !breakdownAddress) {
          alert("Please provide all required breakdown details.");
          return;
        }
        if (!driverLocation) {
             alert("Cannot report breakdown: GPS location unavailable.");
             return;
        }

        const confirmStop = window.confirm(`Confirm breakdown for ${trip.vehicleNumber}? This will halt the trip and notify admin for reassignment/maintenance.`);
        if (!confirmStop) return;

        try {
          const tripRef = doc(db, "trip_requests", trip.id);
          
          const breakdownLocationGPS = `${driverLocation.lat},${driverLocation.lng}`;
          
          // 1. Update Trip Status
          await updateDoc(tripRef, {
            status: 'broken-down', // 🆕 Set new status
            cancelledAt: new Date().toISOString(),
            breakdownReason: breakdownReason, // 🆕 Store reason
            breakdownLocation: breakdownAddress, // 🆕 Store driver's input/selected address
            breakdownGPS: breakdownLocationGPS, // 🆕 Store GPS coordinates for Admin analysis
            breakdownOdometer: Number(breakdownOdometer), // 🆕 Store odometer at breakdown
            lastVisitedStop: lastVisitedStop, // 🆕 Store last place reached/missed
          });

          // 2. Update Vehicle Status for maintenance
          if (trip.vehicleId) {
            const vehicleRef = doc(db, "vehicles", trip.vehicleId);
            await updateDoc(vehicleRef, { 
                status: 'in-maintenance', // 🆕 Mark vehicle for maintenance
                lastTripId: trip.id 
            });
          }
          
          // 3. Update Driver Status (optional, but clean)
          if (user.id) { await updateDoc(doc(db, "users", user.id), { status: 'available', currentTripId: null }); }


          // 4. Log the action for admin
          await logAction(user.email, 'BREAKDOWN_REPORTED',
             `Driver reported breakdown for ${trip.vehicleNumber} during trip #${trip.serialNumber}. Reason: ${breakdownReason}. Stop: ${lastVisitedStop}`,
             { tripId: trip.id, breakdownLocation: breakdownAddress }
          );
          
          // 5. Update UI
          setTrip((prev: any) => ({ 
              ...prev, 
              status: 'broken-down', 
              breakdownReason, 
              breakdownLocation: breakdownAddress 
          }));
          setShowBreakdownModal(false);
          setShowSummary(true); // Show a summary/message screen
          alert('Breakdown reported. Admin has been notified for vehicle replacement.');

        } catch (error) {
          console.error("Error reporting breakdown:", error);
          alert("Failed to report breakdown. Please try again.");
        }
    };
    
    // 🎯 UPDATED HANDLER: Submit Police Fine Claim - Uses trip details automatically
    const handleReportFine = async () => {
        if (!fineClaimData.policeStationPlace || !fineClaimData.amount || !fineClaimData.reason || !fineClaimData.fineDate) {
            alert("Please fill in the fine date, police station/place, reason, and amount of the fine.");
            return;
        }

        try {
            await addDoc(collection(db, "police_claims"), {
                driverId: user.id,
                driverName: user.fullName || user.name,
                vehicleNumber: trip.vehicleNumber || 'N/A',
                tripId: trip.id,
                tripSerialNumber: trip.serialNumber,
                
                // Fine Details from Modal
                date: fineClaimData.fineDate,
                police: fineClaimData.policeStationPlace,
                reason: fineClaimData.reason,
                amount: parseFloat(fineClaimData.amount), // Store as number
                description: fineClaimData.fineDescription, 
                fineTicketUrl: fineClaimData.photoUrl || 'N/A',
                
                // Status
                status: 'pending', // IMPORTANT: Status starts as pending
                claimedDate: new Date().toISOString() // Date the driver reported it
            });

            alert("Fine claim submitted successfully! Admin will review.");
            setShowFineClaimModal(false);
            setShowSummary(true); // Ensure summary view is shown after successful submission
            
        } catch (e) {
            console.error(e);
            alert("Failed to submit claim.");
        }
    };


    const handleCompleteSummary = () => {
      onNavigate('driver-dashboard');
    };

    if (loading) return <div className="p-10 text-center text-lg font-medium">Loading Trip Details...</div>;
    if (!trip) return <div className="p-10 text-center text-red-600 font-medium">Trip not found or ID is missing.</div>;

    // Check if the trip is completed (The only time the driver should see the fine claim button)
    const isTripCompleted = trip.status === 'completed';
    // Check if the trip is assigned and ready to start (Approved/Reassigned, no start Odo, and is Today)
    const isReadyToStart = (trip.status === 'approved' || trip.status === 'reassigned') && !trip.odometerStart && isToday(trip.date);

    // Determine the pickup location for the route overview
    // If re-assigned, the pickup is the breakdown location of the previous vehicle.
    const effectivePickup = trip.status === 'reassigned' && trip.breakdownLocation 
                            ? trip.breakdownLocation 
                            : trip.pickup;


    return (
        <div className="min-h-screen bg-gray-50"> {/* Standardized background to gray-50 */}
            <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} />
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8"> {/* Increased max-width and padding */}
                <div className="mb-6">
                    <button onClick={() => onNavigate('driver-dashboard')} className="text-blue-600 mb-4 font-medium hover:text-blue-800 transition-colors">← Back to Dashboard</button>
                    <h1 className="text-3xl font-extrabold text-gray-900">Trip Details <span className="text-gray-500 font-medium">#{trip.serialNumber || trip.id.slice(0, 8)}</span></h1>
                    <span className={`inline-flex items-center px-3 py-1 mt-2 rounded-full text-sm font-semibold capitalize ${
                        trip.status === 'approved' || trip.status === 'reassigned' ? 'bg-blue-100 text-blue-800' :
                        trip.status === 'in-progress' ? 'bg-green-100 text-green-800' :
                        trip.status === 'completed' ? 'bg-gray-200 text-gray-700' :
                        'bg-yellow-100 text-yellow-800'
                    }`}>
                        <Car className="w-4 h-4 mr-1"/> Status: **{trip.status.replace('-', ' ')}**
                    </span>
                    {trip.status === 'reassigned' && <p className='text-orange-600 font-semibold mt-2'>This trip was re-assigned to you due to a breakdown.</p>}
                </div>
                
                {/* Contact Info Card for Reassigned Driver */}
                {trip.status === 'reassigned' && (
                    <Card className="p-6 mb-6 bg-yellow-50 border border-yellow-300">
                        <h2 className="text-lg font-bold text-yellow-800 mb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Handover Details (Re-assigned Trip)</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            {/* Customer Contact */}
                            <div>
                                <p className='font-semibold text-gray-700'>Customer:</p>
                                <p className='text-gray-900'>{trip.customerName || trip.customer || 'N/A'}</p>
                                <a href={`tel:${trip.customerPhone}`} className="text-blue-600 flex items-center gap-1 hover:underline">
                                    <PhoneIcon className='w-3 h-3'/> {trip.customerPhone || 'N/A'}
                                </a>
                            </div>
                            {/* Original Driver Contact */}
                            <div>
                                <p className='font-semibold text-gray-700'>Original Driver (Contact):</p>
                                <p className='text-gray-900'>{trip.originalDriverName || 'N/A'}</p>
                                <a href={`tel:${trip.originalDriverPhone}`} className="text-blue-600 flex items-center gap-1 hover:underline">
                                    <PhoneIcon className='w-3 h-3'/> {trip.originalDriverPhone || 'N/A'}
                                </a>
                            </div>
                             {/* Breakdown Location */}
                            <div>
                                <p className='font-semibold text-gray-700'>Handover Location:</p>
                                {/* 💥 FIX: Use trip.breakdownLocation for the handover point address 💥 */}
                                <p className='text-gray-900'>{trip.breakdownLocation || 'N/A'}</p> 
                                <span className='text-xs text-yellow-700'>Your new pickup point.</span>
                            </div>
                        </div>
                    </Card>
                )}

                <div className='lg:flex lg:gap-8'>
                    {/* Main Content Area */}
                    <div className="lg:flex-1 space-y-6">
                        {/* Route Details Card */}
                        <Card className="p-6">
                            <h2 className="text-xl font-bold mb-6 text-gray-800">Route Overview</h2>
                            <div className="space-y-4">
                                {/* Pickup (Effective Pickup Location) */}
                                <div className="flex gap-4 items-start">
                                    <div className="flex flex-col items-center mt-0.5">
                                        <div className="w-3 h-3 bg-green-600 rounded-full border-2 border-white shadow-sm"/>
                                        <div className="w-0.5 h-full bg-gray-200"/>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 uppercase">Start/Pickup</div>
                                        <div className="text-gray-900 font-semibold">{effectivePickup}</div>
                                    </div>
                                </div>

                                {/* Stop List (Uses the extended component now) */}
                                <DriverStopList destinations={trip.destinations} finalDestination={trip.destination} />
                                
                            </div>
                        </Card>
                        
                        {/* Optional: Summary of recorded Odometer */}
                        {trip.odometerStart && (
                            <Card className="p-4 border-l-4 border-blue-500 bg-blue-50">
                                <h3 className="text-base font-semibold text-blue-700 flex items-center gap-2"><Gauge className='w-4 h-4'/> Odometer Readings</h3>
                                <p className='text-sm text-gray-700 mt-1'>
                                    **Start Odometer:** {trip.odometerStart} km &nbsp; | &nbsp; 
                                    **End Odometer:** {trip.odometerEnd ? `${trip.odometerEnd} km` : 'N/A'}
                                    {isTripCompleted && <span className='font-bold ml-2 text-green-700'> (Distance Run: {trip.kmRun} km)</span>}
                                </p>
                            </Card>
                        )}
                        
                    </div>
                    
                    {/* Right Column: Customer and Actions */}
                    <div className="lg:w-1/3 mt-6 lg:mt-0 space-y-6">
                        {/* Customer Card (Retained) */}
                        <Card className="p-6">
                            <h2 className="text-xl font-bold mb-4 text-gray-800">Customer Details</h2>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center"><UserIcon className="w-6 h-6 text-blue-600"/></div>
                                <div>
                                    <div className="font-bold text-gray-900">{trip.customer || trip.customerName}</div>
                                    <div className="text-sm text-gray-500">{trip.epf || trip.epfNumber || 'N/A'}</div>
                                </div>
                            </div>
                            <a 
                                href={`tel:${trip.customerPhone || trip.phone}`} 
                                className="flex items-center justify-center gap-2 w-full py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all font-medium"
                            >
                                <Phone className="w-4 h-4"/> Call Customer
                            </a>
                        </Card>

                        {/* Actions Card */}
                        {!showSummary && (
                            <Card className="p-6">
                                <h2 className="text-xl font-bold mb-4 text-gray-800">Trip Actions</h2>
                                {/* Start Trip Button Logic - Uses isReadyToStart and isTripActive */}
                                {isReadyToStart ? (
                                     // Trip is assigned/reassigned and is today - ready for ODO input
                                    <button onClick={handleStartTripClick} className="w-full py-4 bg-green-600 text-white rounded-xl flex justify-center gap-2 hover:bg-green-700 transition-all font-semibold">
                                        <Play className="w-5 h-5" /> Start Trip
                                    </button>
                                ) : (
                                    <>
                                        {trip.status === 'in-progress' && (
                                            <>
                                                <button onClick={handleEndTripClick} className="w-full py-4 bg-red-600 text-white rounded-xl flex justify-center gap-2 hover:bg-red-700 transition-all font-semibold mb-4">
                                                    <Square className="w-5 h-5" /> End Trip (Complete)
                                                </button>
                                                <button 
                                                    onClick={() => setShowBreakdownModal(true)} 
                                                    className="w-full py-3 border border-yellow-500 text-yellow-700 rounded-xl flex justify-center gap-2 hover:bg-yellow-50 transition-all font-medium"
                                                >
                                                    <Wrench className="w-5 h-5" /> Report Breakdown / Cancel
                                                </button>
                                            </>
                                        )}
                                        {/* Display read-only status for active but non-actionable states */}
                                        {(trip.status === 'approved' || trip.status === 'reassigned') && trip.odometerStart && (
                                            <div className="w-full py-3 bg-blue-100 text-blue-700 rounded-xl flex justify-center gap-2 font-bold">
                                                <CheckCircle className="w-5 h-5" /> Trip Started: In-Progress
                                            </div>
                                        )}
                                        {/* Display message for future trips or trips waiting for start ODO */}
                                        {(!isReadyToStart && !isTripCompleted && !trip.odometerStart) && (
                                            <div className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl flex justify-center text-sm font-medium">
                                                Awaiting Start Day ({trip.date})
                                            </div>
                                        )}
                                    </>
                                )}
                            </Card>
                        )}
                    </div>
                </div>

                {/* --- Summary View (After Completion/Breakdown) --- */}
                {showSummary && (
                    <Card className="p-8 max-w-2xl mx-auto text-center mt-6">
                        <div className={`w-20 h-20 ${isTripCompleted ? 'bg-green-100' : 'bg-yellow-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                            {isTripCompleted ? <CheckCircle className="w-10 h-10 text-green-600" /> : <AlertTriangle className="w-10 h-10 text-yellow-600" />} 
                        </div>
                        <h2 className="text-2xl font-bold mb-2 text-gray-900">
                            {isTripCompleted ? 'Trip Completed Successfully' : 'Trip Interrupted'}
                        </h2>
                        {(isTripCompleted || trip.status === 'broken-down') ? (
                            <>
                                <p className="text-gray-700 mb-6">
                                    **Distance Traveled:** {trip.kmRun || 'N/A'} km.
                                    <span className='block mt-1 text-sm'>Vehicle and driver status updated to **Available**.</span>
                                </p>
                                
                                {/* Report Police Fine Button - Now visible if completed or broken down */}
                                <button 
                                    onClick={() => setShowFineClaimModal(true)} 
                                    className="mt-4 w-full py-3 bg-red-600 text-white rounded-xl flex justify-center gap-2 hover:bg-red-700 transition-all font-semibold mb-4"
                                >
                                    <Banknote className="w-5 h-5"/> Report Police Fine
                                </button>
                                
                                <button onClick={handleCompleteSummary} className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold">Back to Dashboard</button>
                            </>
                        ) : (
                            <div className="text-sm text-gray-700">
                                <p className="font-medium text-yellow-700 text-lg">Vehicle Breakdown Reported.</p>
                                <p className="mt-2 text-base">**Reason:** <span className="font-semibold">{trip.breakdownReason}</span></p>
                                <p className="mt-3 text-red-600 font-medium">The Admin has been notified and is arranging a replacement vehicle/maintenance.</p>
                                <button onClick={handleCompleteSummary} className="mt-6 w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold">Back to Dashboard</button>
                            </div>
                        )}
                    </Card>
                )}
                
                {/* --- MODALS (Standardized Layout and Form Elements) --- */}

                {/* Police Fine Claim Modal (Retained) */}
                {showFineClaimModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center pb-4 border-b">
                                <h3 className="text-2xl font-bold flex items-center gap-2 text-red-700">
                                    <Banknote className="w-6 h-6"/> Report Police Fine Claim
                                </h3>
                                <button onClick={() => setShowFineClaimModal(false)} className="text-gray-500 hover:text-red-700 p-1"><X className="w-6 h-6"/></button>
                            </div>
                            
                            <div className="bg-red-50 p-3 rounded-lg text-sm my-4 space-y-1 border border-red-200">
                                <p><strong>Trip:</strong> #{trip.serialNumber || trip.id.slice(0, 8)} | **Vehicle:** {trip.vehicleNumber}</p>
                                <p><strong>Driver:</strong> {user.fullName || user.name}</p>
                            </div>

                            <div className="space-y-4">
                                {/* Date of Fine */}
                                <div><label className="text-sm font-medium block mb-1">Date Fine Occurred <span className="text-red-500">*</span></label><input type="date" value={fineClaimData.fineDate} onChange={e => setFineClaimData({...fineClaimData, fineDate: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" required /></div>
                                {/* Police Station/Place */}
                                <div><label className="text-sm font-medium block mb-1">Police Station/Place <span className="text-red-500">*</span></label><input type="text" value={fineClaimData.policeStationPlace} onChange={e => setFineClaimData({...fineClaimData, policeStationPlace: e.target.value})} placeholder="E.g., Colombo Central Police" className="w-full p-2.5 border border-gray-300 rounded-lg" required /></div>
                                {/* Fine Amount */}
                                <div><label className="text-sm font-medium block mb-1">Fine Amount (LKR) <span className="text-red-500">*</span></label><input type="number" value={fineClaimData.amount} onChange={e => setFineClaimData({...fineClaimData, amount: e.target.value})} placeholder="E.g. 5000" className="w-full p-2.5 border border-gray-300 rounded-lg" required /></div>
                                {/* Reason for Fine (Brief) */}
                                <div><label className="text-sm font-medium block mb-1">Reason for the Fine (Brief) <span className="text-red-500">*</span></label><input type="text" value={fineClaimData.reason} onChange={e => setFineClaimData({...fineClaimData, reason: e.target.value})} placeholder="E.g., Speeding violation" className="w-full p-2.5 border border-gray-300 rounded-lg" required /></div>
                                {/* Details/Description */}
                                <div><label className="text-sm font-medium block mb-1">Fine Details/Description</label><textarea value={fineClaimData.fineDescription} onChange={e => setFineClaimData({...fineClaimData, fineDescription: e.target.value})} placeholder="Detailed description of the incident" rows={2} className="w-full p-2.5 border border-gray-300 rounded-lg" /></div>
                                {/* Fine Ticket Photo Upload */}
                                <div>
                                    <label className="text-sm font-medium block mb-1">Upload Fine Ticket Photo (URL)</label>
                                    <div className="flex items-center gap-2">
                                        <input type="text" value={fineClaimData.photoUrl} onChange={e => setFineClaimData({...fineClaimData, photoUrl: e.target.value})} placeholder="Link or URL of the fine ticket photo" className="flex-grow p-2.5 border border-gray-300 rounded-lg" />
                                        <button type="button" className="p-2.5 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-200" title="Simulate File Upload">
                                            <Upload className="w-5 h-5"/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowFineClaimModal(false)} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                                <button 
                                    onClick={handleReportFine} 
                                    disabled={!fineClaimData.policeStationPlace || !fineClaimData.amount || !fineClaimData.reason || !fineClaimData.fineDate}
                                    className="flex-1 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 font-semibold"
                                >
                                    Submit Fine Claim
                                </button>
                            </div>
                        </Card>
                    </div>
                )}
                
                {/* Breakdown Reporting Modal */}
                {showBreakdownModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"> {/* Added max-height and overflow */}
                            <div className="flex justify-between items-center pb-4 border-b">
                                <h3 className="text-2xl font-bold flex items-center gap-2 text-yellow-700">
                                    <Wrench className="w-6 h-6"/> Report Vehicle Breakdown
                                </h3>
                                <button onClick={() => setShowBreakdownModal(false)} className="text-gray-500 hover:text-yellow-700 p-1"><X className="w-6 h-6"/></button>
                            </div>
                            
                            <p className="my-4 text-sm text-gray-700 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                                This action will immediately **halt the trip** and notify the administrator for vehicle replacement.
                            </p>
                            
                            <div className='space-y-4'>
                                {/* 1. Odometer Input */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Breakdown Odometer (km): <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="number" 
                                        value={breakdownOdometer} 
                                        onChange={e => setBreakdownOdometer(e.target.value)} 
                                        placeholder="Current Mileage"
                                        className='w-full p-2.5 border border-gray-300 rounded-lg text-base'
                                    />
                                </div>

                                {/* 2. Last Place Visited (Improved Select) */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Last Place Visited/Nearest Stop: <span className="text-red-500">*</span>
                                    </label>
                                    <select 
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-base appearance-none bg-white" 
                                        value={lastVisitedStop} 
                                        onChange={e => setLastVisitedStop(e.target.value)}
                                    >
                                        <option value="">Select Last Stop Reached (or nearest in route)</option>
                                        {allTripStops.map((stop, index) => (
                                            <option key={index} value={stop}>{stop} ({index === 0 ? 'Start/Pickup' : index === allTripStops.length - 1 ? 'Final Drop-off' : `Stop ${index}`})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* 3. Breakdown Location Address (FIXED for standard UI and Suggestions) */}
                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Breakdown Location Address: <span className="text-red-500">*</span></label>
                                    <div className="flex gap-2 w-full items-center">
                                        <input
                                            type="text"
                                            className="flex-1 w-full p-2.5 border border-gray-300 rounded-lg text-base outline-none" 
                                            value={breakdownAddress}
                                            onChange={(e) => handleLocationSearch(e.target.value)}
                                            placeholder="Enter nearest address or search"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={handleUseGPS} 
                                            disabled={gpsLoading || !driverLocation}
                                            className="p-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 w-12 flex justify-center items-center disabled:opacity-50 transition-colors" 
                                            title="Autofill GPS Location"
                                        >
                                            {gpsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
                                        </button>
                                    </div>
                                    {/* Suggestions Dropdown */}
                                    {locationSuggestions.length > 0 && (
                                        <div className="absolute left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow-xl max-h-48 overflow-y-auto z-10">
                                            {locationSuggestions.map((place, idx) => (
                                                <div key={idx} onClick={() => handleSelectLocation(place.display_name || place.address)} className="p-3 hover:bg-gray-100 cursor-pointer text-sm border-b last:border-0 flex items-center gap-2 transition-colors">
                                                    <MapPin className="w-4 h-4 text-gray-400" />
                                                    {place.display_name || place.address}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                {/* 4. Reason for Breakdown (Improved Select) */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Reason for Breakdown: <span className="text-red-500">*</span>
                                    </label>
                                    <select 
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-base appearance-none bg-white" 
                                        value={breakdownReason} 
                                        onChange={e => setBreakdownReason(e.target.value)}
                                    >
                                        <option value="">Select Reason</option>
                                        <option value="Engine Failure">Engine Failure</option>
                                        <option value="Flat Tire">Flat Tire</option>
                                        <option value="Overheating">Overheating</option>
                                        <option value="Accident">Accident</option>
                                        <option value="Other Mechanical Issue">Other Mechanical Issue</option>
                                    </select>
                                </div>
                                
                                <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg">
                                    <p className="text-sm font-semibold text-blue-700 flex items-center gap-1">
                                        <MapPin className='w-4 h-4'/> GPS Location Sent to Admin:
                                    </p>
                                    <p className="text-xs text-blue-600 mt-1">{driverLocation ? `${driverLocation.lat.toFixed(4)}, ${driverLocation.lng.toFixed(4)}` : 'Fetching...'}</p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowBreakdownModal(false)} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">Go Back</button>
                                <button 
                                    onClick={handleReportBreakdown} 
                                    disabled={!breakdownReason || !driverLocation || !breakdownOdometer || !lastVisitedStop || !breakdownAddress} 
                                    className="flex-1 py-3 bg-yellow-600 text-white rounded-xl hover:bg-yellow-700 disabled:opacity-50 font-semibold"
                                >
                                    Confirm Breakdown
                                </button>
                            </div>
                        </Card>
                    </div>
                )}
                
                {/* ODOMETER INPUT MODAL (Retained) */}
                {showOdometerModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <Card className="w-full max-w-md p-6">
                            <div className="flex justify-between items-center pb-4 border-b">
                                <h3 className="text-2xl font-bold flex items-center gap-2 text-blue-600">
                                    <Gauge className='w-6 h-6'/> {modalActionType === 'start' ? 'Start Trip Odometer' : 'End Trip Odometer'}
                                </h3>
                                <button onClick={() => setShowOdometerModal(false)} className="text-gray-500 hover:text-blue-700 p-1"><X className="w-6 h-6"/></button>
                            </div>
                            <p className='text-sm text-gray-600 my-4'>
                                Please enter the vehicle's current mileage reading (in km).
                                {modalActionType === 'end' && trip.odometerStart && (
                                    <span className='block mt-1 font-medium text-gray-800'>
                                        **Start Odo:** {trip.odometerStart} km
                                    </span>
                                )}
                            </p>
                            
                            <input 
                                type='number'
                                value={odometerInput}
                                onChange={e => setOdometerInput(e.target.value)}
                                placeholder='Enter mileage (km)'
                                className='w-full p-3 border border-gray-300 rounded-xl text-lg mb-6 focus:ring-blue-500 focus:border-blue-500'
                            />
                            
                            <div className="flex gap-3">
                                <button onClick={() => setShowOdometerModal(false)} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                                <button 
                                    onClick={handleSubmitOdometer} 
                                    disabled={!odometerInput || (modalActionType === 'end' && Number(odometerInput) <= (trip.odometerStart || 0))} 
                                    className="flex-1 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 font-semibold"
                                >
                                    {modalActionType === 'start' ? 'Confirm Start' : 'Confirm End'}
                                </button>
                            </div>
                        </Card>
                    </div>
                )}

            </div>
        </div>
    );
}