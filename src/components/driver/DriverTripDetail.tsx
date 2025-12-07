import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
// 💥 CRITICAL FIX: Ensure all required Lucide icons are imported on this line 💥
import { 
    MapPin, User as UserIcon, Phone, Navigation, Play, Square, CheckCircle, ChevronDown, ChevronUp, AlertTriangle, 
    Wrench, ArrowLeft, Gauge, MessageSquare, Plus, Users as CombinedUsers, Search, Phone as PhoneIcon, Mail, Loader2, 
    Trash2, Car, Calendar, Clock, FileText, Banknote, Upload, X 
} from 'lucide-react'; 
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { doc, getDoc, updateDoc, addDoc, collection } from 'firebase/firestore';
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

// Helper Component for Collapsible Stops (REFINED STYLES)
const DriverStopList = ({ destinations, finalDestination }: { destinations?: string[], finalDestination: string }) => {
    const [expanded, setExpanded] = useState(false);
    
    // Ensure the destinations array is safe to iterate
    const validDestinations = destinations?.filter(d => d && d.trim()) || [];
    
    // Fallback display for zero stops (Only the final destination)
    if (validDestinations.length === 0) {
      return (
            <div className="flex gap-4 items-start py-2">
             <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0 mt-2"/>
             <div>
                 <div className="text-xs text-gray-500 uppercase">Drop-off</div>
                 <div className="text-gray-900 font-medium">{finalDestination}</div>
             </div>
            </div>
      );
    }
    
    // All points including the final drop-off
    const allPoints = [...validDestinations, finalDestination];

    // Component for a single stop row
    const StopRow = ({ stopName, index, isFinal, isHidden }: { stopName: string, index: number, isFinal: boolean, isHidden: boolean }) => {
        const isMiddleStop = index > 0 && index < allPoints.length - 1;
        const stopLabel = index === allPoints.length - 1 
            ? 'Drop-off' 
            : index === 0 
                ? 'Stop 1' 
                : `Stop ${index + 1}`;
        const pointColor = isFinal ? 'bg-red-500' : 'bg-blue-500';

        return (
            <div className={`flex gap-4 items-start ${index > 0 ? 'pt-2' : ''} ${isHidden ? 'hidden' : ''}`}>
                <div className="flex flex-col items-center mt-0.5 flex-shrink-0">
                    {index > 0 && <div className="w-0.5 h-full bg-gray-200" style={{ height: 'calc(100% + 4px)' }} />}
                    <div className={`w-3 h-3 ${pointColor} rounded-full ${!isFinal ? 'border-2 border-white shadow-sm' : ''} flex-shrink-0`}/>
                    {!isFinal && <div className="w-0.5 h-full bg-gray-200" style={{ height: 'calc(100% + 4px)' }} />}
                </div>
                <div className={`${isFinal ? 'mt-0.5' : ''}`}>
                    <div className="text-xs text-gray-500 uppercase">{stopLabel}</div>
                    <div className={`text-gray-900 ${isFinal ? 'font-semibold' : ''}`}>{stopName}</div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-1">
            {/* First Stop (Pickup is assumed before the list starts in the parent component) */}
            {validDestinations.length > 0 && (
                <StopRow 
                    stopName={validDestinations[0]} 
                    index={0} 
                    isFinal={false} 
                    isHidden={false}
                />
            )}
            
            {/* Render rest of stops if expanded */}
            {validDestinations.slice(1).map((stop, index) => (
                <StopRow 
                    key={`stop-${index + 1}`}
                    stopName={stop} 
                    index={index + 1} // Actual index starts from 1 (Stop 2)
                    isFinal={false} 
                    isHidden={!expanded}
                />
            ))}
            
            {/* Toggle Button */}
            {validDestinations.length > 1 && (
                <div className="flex justify-start my-2 ml-7">
                    <button 
                        onClick={() => setExpanded(!expanded)} 
                        className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors p-1 -ml-1 rounded-md"
                    >
                        {expanded ? 'Show Less Stops' : `Show ${validDestinations.length - 1} More Stops`}
                        {expanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                    </button>
                </div>
            )}
            
            {/* Final Drop-off */}
            <StopRow 
                stopName={finalDestination} 
                index={validDestinations.length} // Index is length of destinations array
                isFinal={true} 
                isHidden={false}
            />
        </div>
    );
};
    

export function DriverTripDetail({ user, tripId, onNavigate, onLogout }: DriverTripDetailProps) {
    const [trip, setTrip] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showSummary, setShowSummary] = useState(false);
    
    // Odometer Modal State
    const [showOdometerModal, setShowOdometerModal] = useState(false);
    const [odometerInput, setOdometerInput] = useState('');
    const [modalActionType, setModalActionType] = useState<'start' | 'end' | null>(null);

    // Breakdown Modal State
    const [showBreakdownModal, setShowBreakdownModal] = useState(false);
    const [breakdownReason, setBreakdownReason] = useState('');
    const [breakdownOdometer, setBreakdownOdometer] = useState('');
    const [lastVisitedStop, setLastVisitedStop] = useState('');
    const [breakdownAddress, setBreakdownAddress] = useState('');
    const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]); 
    const [gpsLoading, setGpsLoading] = useState(false); 
    
    // Fine Claim Modal state
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
    const allTripStops = useMemo(() => {
        return trip ? [
            trip.pickup, 
            ...(trip.destinations?.filter((d: string) => d && d.trim()) || []), // Filter out empty destinations
            trip.destination // Include final drop-off
        ] : [];
    }, [trip]);


    // --- 🎯 CORRECTED LOCATION HANDLERS for Breakdown Modal ---
    const handleLocationSearch = async (query: string) => {
        setBreakdownAddress(query);
        if (query.length < 3) { setLocationSuggestions([]); return; }
        
        const lowerQuery = query.toLowerCase();
        // Mocked results
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

        const resolveAddress = (lat: number, lng: number, isReal: boolean) => {
            // MOCK: Reverse geocoding
            const address = isReal 
                ? `Current GPS Location (${lat.toFixed(4)})` 
                : `Simulated Handover Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
            setBreakdownAddress(address);
            setGpsLoading(false);
            setLocationSuggestions([]);
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolveAddress(position.coords.latitude, position.coords.longitude, true);
                },
                (error) => {
                    alert("GPS Error: " + error.message);
                    resolveAddress(driverLocation.lat, driverLocation.lng, false); // Fallback to hook location
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            resolveAddress(driverLocation.lat, driverLocation.lng, false); // Fallback for simulated hook location
        }
    };
    // --- END CORRECTED LOCATION HANDLERS ---


    // 1. Fetch Trip Data 
    useEffect(() => {
        const fetchTrip = async () => {
            if (!tripId) return;

            try {
                const docRef = doc(db, "trip_requests", tripId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    let data: any = { id: docSnap.id, ...docSnap.data() };
                        
                    // 🚨 Fetch Customer details 
                    if (data.userId) {
                        const userSnap = await getDoc(doc(db, "users", data.userId));
                        if (userSnap.exists()) {
                            const userData = userSnap.data();
                            data = { ...data, customerName: userData.fullName || userData.name, customerPhone: userData.phone };
                        }
                    }

                    // 🚨 Fetch Original Driver details
                    if (data.originalDriverId) {
                        const driverSnap = await getDoc(doc(db, "users", data.originalDriverId));
                        if (driverSnap.exists()) {
                            const driverData = driverSnap.data();
                            data = { ...data, originalDriverName: driverData.fullName, originalDriverPhone: driverData.phone };
                        }
                    }

                    setTrip(data);
                    
                    // 🚨 FIX 1: Show summary ONLY for terminal states
                    if (['completed', 'broken-down', 'cancelled', 'rejected'].includes(data.status)) {
                        setShowSummary(true);
                    } else {
                        setShowSummary(false);
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

    // 2. Handlers
    const handleStartTripClick = () => {
        setOdometerInput(trip?.odometerStart || '');
        setModalActionType('start');
        setShowOdometerModal(true);
    };

    const handleEndTripClick = () => {
        setOdometerInput(''); 
        setModalActionType('end');
        setShowOdometerModal(true);
    };
    
    // Submits Odometer and updates trip status
    const handleSubmitOdometer = async () => {
        if (!trip || !odometerInput) { alert("Odometer reading required."); return; }
        const odometer = Number(odometerInput);
        if (isNaN(odometer) || odometer <= 0) { alert("Invalid odometer value."); return; }
        
        try {
            const tripRef = doc(db, "trip_requests", trip.id);
            
            if (modalActionType === 'start') {
                if (odometer <= (trip.odometerEndPrevious || 0) && trip.odometerEndPrevious > 0) {
                     alert(`Error: Start Odometer (${odometer}) cannot be less than or equal to the last recorded End Odometer (${trip.odometerEndPrevious}).`);
                     return;
                }
                
                await updateDoc(tripRef, {
                    status: 'in-progress',
                    startedAt: new Date().toISOString(),
                    odometerStart: odometer 
                });

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
                    status: 'completed', 
                    endedAt: new Date().toISOString(),
                    odometerEnd: odometer, 
                    kmRun: distanceRun
                });

                if (trip.vehicleId) { await updateDoc(doc(db, "vehicles", trip.vehicleId), { status: 'available' }); }
                if (user.id) { await updateDoc(doc(db, "users", user.id), { status: 'available', currentTripId: null }); }
                
                setTrip((prev: any) => ({ ...prev, status: 'completed', odometerEnd: odometer, kmRun: distanceRun }));
                
                // 💥 FIX 2: Upon successful trip completion, close Odometer modal, show Summary, and prompt for Fine Claim 💥
                setShowOdometerModal(false); 
                setShowSummary(true);
                setShowFineClaimModal(true); 
                return; 
            }
            
            setShowOdometerModal(false);
            setOdometerInput('');
            setModalActionType(null);

        } catch (error) {
            console.error(`Error ${modalActionType}ing trip:`, error);
            alert(`Failed to ${modalActionType} trip. Please try again.`);
        }
    };

    // Breakdown/Cancel Trip
    const handleReportBreakdown = async () => {
        if (!trip || !breakdownReason.trim() || !breakdownOdometer || !lastVisitedStop || !breakdownAddress) {
          alert("Please provide all required breakdown details.");
          return;
        }
        if (!driverLocation) {
             alert("Cannot report breakdown: GPS location unavailable.");
             return;
        }
        if (Number(breakdownOdometer) < (trip.odometerStart || 0)) {
             alert(`Error: Breakdown Odometer (${breakdownOdometer}) cannot be less than Start Odometer (${trip.odometerStart || 0}).`);
             return;
        }

        const confirmStop = window.confirm(`Confirm breakdown for ${trip.vehicleNumber}? This will halt the trip and notify admin for reassignment/maintenance.`);
        if (!confirmStop) return;

        try {
          const tripRef = doc(db, "trip_requests", trip.id);
          
          const breakdownLocationGPS = `${driverLocation.lat},${driverLocation.lng}`;
          
          // 1. Update Trip Status
          await updateDoc(tripRef, {
            status: 'broken-down', 
            cancelledAt: new Date().toISOString(),
            breakdownReason: breakdownReason, 
            breakdownLocation: breakdownAddress, 
            breakdownGPS: breakdownLocationGPS, 
            breakdownOdometer: Number(breakdownOdometer), 
            lastVisitedStop: lastVisitedStop, 
            // Store the current Odometer reading to be used as 'odometerEndPrevious' for the next driver
            odometerEndPrevious: Number(breakdownOdometer)
          });

          // 2. Update Vehicle Status for maintenance
          if (trip.vehicleId) {
            const vehicleRef = doc(db, "vehicles", trip.vehicleId);
            await updateDoc(vehicleRef, { 
                status: 'in-maintenance', 
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
          setShowSummary(true); 
          alert('Breakdown reported. Admin has been notified for vehicle replacement.');

        } catch (error) {
          console.error("Error reporting breakdown:", error);
          alert("Failed to report breakdown. Please try again.");
        }
    };
    
    // Submit Police Fine Claim
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
                status: 'pending', 
                claimedDate: new Date().toISOString()
            });

            alert("Fine claim submitted successfully! Admin will review.");
            setShowFineClaimModal(false);
            setShowSummary(true); 
            
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

    const isTripCompleted = trip.status === 'completed';
    const isReadyToStart = (trip.status === 'approved' || trip.status === 'reassigned') && !trip.odometerStart && isToday(trip.date);
    const isTripActive = trip.status === 'in-progress';

    // Determine the pickup location for the route overview
    const effectivePickup = trip.status === 'reassigned' && trip.breakdownLocation 
                               ? trip.breakdownLocation 
                               : trip.pickup;


    return (
        <div className="min-h-screen bg-gray-50"> 
            <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} />
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                
                {/* Header and Status */}
                <div className="mb-6">
                    <button onClick={() => onNavigate('driver-dashboard')} className="text-blue-600 mb-4 font-medium hover:text-blue-800 transition-colors flex items-center gap-1">
                        <ArrowLeft className='w-4 h-4' /> Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-extrabold text-gray-900 flex items-baseline gap-2">
                        Trip Details 
                        <span className="text-gray-500 font-medium text-xl">#{trip.serialNumber || trip.id.slice(0, 8)}</span>
                    </h1>
                    <Badge status={trip.status} />
                    
                    {trip.status === 'reassigned' && (
                        <p className='text-orange-600 font-semibold mt-2 flex items-center gap-1'>
                            <AlertTriangle className='w-4 h-4'/> This trip was re-assigned to you due to a breakdown.
                        </p>
                    )}
                </div>
                
                {/* --- Main Content Layout --- */}
                <div className='lg:flex lg:gap-8'>
                    
                    {/* Left Column: Route Details and Odometer */}
                    <div className="lg:flex-1 space-y-6">
                        
                        {/* Route Details Card */}
                        <Card className="p-6">
                            <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2"><MapPin className='w-5 h-5'/> Route Overview</h2>
                            <div className="space-y-4">
                                {/* Pickup (Effective Pickup Location) */}
                                <div className="flex gap-4 items-start">
                                    <div className="flex flex-col items-center mt-0.5 flex-shrink-0">
                                        <div className="w-3 h-3 bg-green-600 rounded-full border-2 border-white shadow-sm"/>
                                        <div className="w-0.5 h-full bg-gray-200" style={{ height: 'calc(100% + 4px)' }}/>
                                    </div>
                                    <div className='mt-0.5'>
                                        <div className="text-xs text-gray-500 uppercase">Start/Pickup</div>
                                        <div className="text-gray-900 font-semibold">{effectivePickup}</div>
                                    </div>
                                </div>

                                {/* Stop List (Refined Component) */}
                                <DriverStopList destinations={trip.destinations} finalDestination={trip.destination} />
                                
                            </div>
                        </Card>
                        
                        {/* Odometer Summary (Conditional Card) */}
                        {trip.odometerStart && (
                            <Card className="p-4 border-l-4 border-blue-500 bg-blue-50">
                                <h3 className="text-base font-semibold text-blue-700 flex items-center gap-2">
                                    <Gauge className='w-4 h-4'/> Odometer Readings
                                </h3>
                                <div className='grid grid-cols-2 gap-2 text-sm text-gray-700 mt-2'>
                                    <p>
                                        **Start Odo:** <span className='font-semibold'>{trip.odometerStart} km</span>
                                    </p>
                                    <p>
                                        **End Odo:** <span className='font-semibold'>{trip.odometerEnd ? `${trip.odometerEnd} km` : 'N/A'}</span>
                                    </p>
                                    {isTripCompleted && (
                                        <p className='col-span-2 font-bold text-green-700 pt-2 border-t border-blue-200'>
                                            **Distance Run:** {trip.kmRun} km
                                        </p>
                                    )}
                                </div>
                            </Card>
                        )}
                        
                    </div>
                    
                    {/* Right Column: Customer and Actions */}
                    <div className="lg:w-1/3 mt-6 lg:mt-0 space-y-6">
                        
                        {/* Customer Card */}
                        <Card className="p-6">
                            <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2"><UserIcon className='w-5 h-5'/> Customer Details</h2>
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
                            <Card className="p-6 space-y-4">
                                <h2 className="text-xl font-bold text-gray-800">Trip Actions</h2>
                                
                                {isReadyToStart && (
                                    <button onClick={handleStartTripClick} className="w-full py-4 bg-green-600 text-white rounded-xl flex justify-center gap-2 hover:bg-green-700 transition-all font-semibold shadow-lg">
                                        <Play className="w-5 h-5" /> Start Trip (Record Odometer)
                                    </button>
                                )}
                                
                                {isTripActive && (
                                    <>
                                        <button onClick={handleEndTripClick} className="w-full py-4 bg-red-600 text-white rounded-xl flex justify-center gap-2 hover:bg-red-700 transition-all font-semibold shadow-lg">
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
                                
                                {/* Status Messages */}
                                {(!isReadyToStart && !isTripCompleted && !isTripActive) && (
                                     <div className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl flex justify-center text-sm font-medium">
                                         Awaiting Start Day ({trip.date})
                                     </div>
                                )}
                                
                            </Card>
                        )}
                        
                    </div>
                </div>

                {/* --- SUMMARY VIEW (After Completion/Breakdown) --- */}
                {showSummary && (
                    <Card className="p-8 max-w-xl mx-auto mt-8 shadow-2xl">
                        <div className="text-center mb-6">
                            {/* Icon & Title */}
                            <div className={`w-20 h-20 ${isTripCompleted ? 'bg-green-100' : 'bg-yellow-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                                {isTripCompleted ? <CheckCircle className="w-10 h-10 text-green-600" /> : <AlertTriangle className="w-10 h-10 text-yellow-600" />} 
                            </div>
                            <h2 className="text-2xl font-bold mb-2 text-gray-900">
                                {isTripCompleted ? 'Trip Completed Successfully' : `Trip Ended: ${trip.status.toUpperCase().replace('-', ' ')}`}
                            </h2>
                            <p className="text-gray-700 text-sm max-w-sm mx-auto">
                                {isTripCompleted 
                                    ? `Total distance traveled: **${trip.kmRun || 'N/A'} km**. The trip is now closed.`
                                    : `Vehicle breakdown reported at **${trip.breakdownLocation}**. Admin has been notified for reassignment/maintenance.`
                                }
                            </p>
                        </div>
                        
                        {/* Summary Details Table (Refined) */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 space-y-2 text-sm">
                            <div className="flex justify-between border-b pb-1">
                                <span className="text-gray-600 font-medium">Trip:</span>
                                <span className="font-semibold text-gray-800">#{trip.serialNumber || trip.id.slice(0, 8)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 font-medium">Vehicle:</span>
                                <span className="font-semibold text-gray-800">{trip.vehicleNumber || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 font-medium">Final Odometer:</span>
                                <span>{trip.odometerEnd || trip.breakdownOdometer || 'N/A'} km</span>
                            </div>
                            {isTripCompleted && (
                                <div className="flex justify-between font-bold text-green-700 pt-2 border-t border-gray-200">
                                    <span>Distance Run:</span>
                                    <span>{trip.kmRun || 'N/A'} km</span>
                                </div>
                            )}
                            {trip.status === 'broken-down' && (
                                <div className="pt-2 border-t border-gray-200">
                                    <span className="font-semibold text-yellow-700 block mb-1">Breakdown Report:</span>
                                    <p className='text-xs text-gray-600'>**Reason:** {trip.breakdownReason || 'N/A'}</p>
                                    <p className='text-xs text-gray-600'>**Location:** {trip.breakdownLocation || 'N/A'}</p>
                                </div>
                            )}
                        </div>

                        {/* Standardized Action Buttons */}
                        <div className="space-y-3">
                            {/* 1. Report Police Fine Button (Primary Action) */}
                            <button 
                                onClick={() => setShowFineClaimModal(true)} 
                                className="w-full py-3 bg-red-600 text-white rounded-xl flex justify-center gap-2 items-center hover:bg-red-700 transition-all font-semibold shadow-md"
                            >
                                <Banknote className="w-5 h-5"/> Report Police Fine Claim
                            </button>
                            
                            {/* 2. Back to Dashboard Button (Secondary Action) */}
                            <button onClick={handleCompleteSummary} className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold shadow-md flex justify-center gap-2 items-center">
                                <ArrowLeft className="w-5 h-5"/> Finish & Go to Dashboard
                            </button>
                        </div>
                    </Card>
                )}
                
                {/* --- MODALS --- */}

                {/* Police Fine Claim Modal */}
                {showFineClaimModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center pb-4 border-b">
                                <h3 className="text-2xl font-bold flex items-center gap-2 text-red-700">
                                    <Banknote className="w-6 h-6"/> Report Police Fine Claim
                                </h3>
                                <button onClick={() => setShowFineClaimModal(false)} className="text-gray-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50"><X className="w-6 h-6"/></button>
                            </div>
                            
                            <div className="bg-red-50 p-3 rounded-lg text-sm my-4 space-y-1 border border-red-200">
                                <p><strong>Trip:</strong> #{trip.serialNumber || trip.id.slice(0, 8)} | **Vehicle:** {trip.vehicleNumber}</p>
                                <p><strong>Driver:</strong> {user.fullName || user.name}</p>
                                <p className='text-xs font-medium mt-1 text-red-600'>Submit this form *only* if you received a fine during this completed trip.</p>
                            </div>

                            <div className="space-y-4">
                                {/* Date of Fine */}
                                <div><label className="text-sm font-medium block mb-1">Date Fine Occurred <span className="text-red-500">*</span></label><input type="date" value={fineClaimData.fineDate} onChange={e => setFineClaimData({...fineClaimData, fineDate: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500" required /></div>
                                {/* Police Station/Place */}
                                <div><label className="text-sm font-medium block mb-1">Police Station/Place <span className="text-red-500">*</span></label><input type="text" value={fineClaimData.policeStationPlace} onChange={e => setFineClaimData({...fineClaimData, policeStationPlace: e.target.value})} placeholder="E.g., Colombo Central Police" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500" required /></div>
                                {/* Fine Amount and Reason (Side-by-side on larger screens) */}
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                    <div><label className="text-sm font-medium block mb-1">Fine Amount (LKR) <span className="text-red-500">*</span></label><input type="number" value={fineClaimData.amount} onChange={e => setFineClaimData({...fineClaimData, amount: e.target.value})} placeholder="E.g. 5000" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500" required /></div>
                                    <div><label className="text-sm font-medium block mb-1">Reason (Brief) <span className="text-red-500">*</span></label><input type="text" value={fineClaimData.reason} onChange={e => setFineClaimData({...fineClaimData, reason: e.target.value})} placeholder="E.g., Speeding violation" className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500" required /></div>
                                </div>
                                {/* Details/Description */}
                                <div><label className="text-sm font-medium block mb-1">Fine Details/Description</label><textarea value={fineClaimData.fineDescription} onChange={e => setFineClaimData({...fineClaimData, fineDescription: e.target.value})} placeholder="Detailed description of the incident" rows={2} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500" /></div>
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
                                {/* Added Cancel/No Fine button here */}
                                <button onClick={() => setShowFineClaimModal(false)} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">Cancel / No Fine</button>
                                <button 
                                    onClick={handleReportFine} 
                                    disabled={!fineClaimData.policeStationPlace || !fineClaimData.amount || !fineClaimData.reason || !fineClaimData.fineDate}
                                    className="flex-1 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 font-semibold flex justify-center items-center gap-2"
                                >
                                    <Banknote className="w-5 h-5"/> Submit Fine Claim
                                </button>
                            </div>
                        </Card>
                    </div>
                )}
                
                {/* Breakdown Reporting Modal */}
                {showBreakdownModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center pb-4 border-b">
                                <h3 className="text-2xl font-bold flex items-center gap-2 text-yellow-700">
                                    <Wrench className="w-6 h-6"/> Report Vehicle Breakdown
                                </h3> 
                                <button onClick={() => setShowBreakdownModal(false)} className="text-gray-500 hover:text-yellow-700 p-1 rounded-full hover:bg-yellow-50"><X className="w-6 h-6"/></button>
                            </div>
                            
                            <p className="my-4 text-sm text-gray-700 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                                This action will immediately **halt the trip**, mark the **vehicle for maintenance**, and notify the administrator for vehicle replacement.
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
                                        placeholder={`Enter current mileage (must be > ${trip.odometerStart || 0} km)`}
                                        className='w-full p-2.5 border border-gray-300 rounded-lg text-base focus:ring-yellow-500 focus:border-yellow-500'
                                    />
                                </div>

                                {/* 2. Last Place Visited (Improved Select) */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Last Place Visited/Nearest Stop: <span className="text-red-500">*</span>
                                    </label>
                                    <select 
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-base appearance-none bg-white focus:ring-yellow-500 focus:border-yellow-500" 
                                        value={lastVisitedStop} 
                                        onChange={e => setLastVisitedStop(e.target.value)}
                                    >
                                        <option value="">Select Last Stop Reached (or nearest in route)</option>
                                        {allTripStops.map((stop, index) => (
                                            <option key={index} value={stop}>{stop} ({index === 0 ? 'Start/Pickup' : index === allTripStops.length - 1 ? 'Final Drop-off' : `Stop ${index + 1}`})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* 3. Breakdown Location Address (FIXED for standard UI and Suggestions) */}
                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Breakdown Location Address: <span className="text-red-500">*</span></label>
                                    <div className="flex gap-2 w-full items-center">
                                        <input
                                            type="text"
                                            className="flex-1 w-full p-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-yellow-500 focus:border-yellow-500" 
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
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-base appearance-none bg-white focus:ring-yellow-500 focus:border-yellow-500" 
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
                                    className="flex-1 py-3 bg-yellow-600 text-white rounded-xl hover:bg-yellow-700 disabled:opacity-50 font-semibold flex justify-center items-center gap-2"
                                >
                                    <Wrench className="w-5 h-5"/> Confirm Breakdown
                                </button>
                            </div>
                        </Card>
                    </div>
                )}
                
                {/* ODOMETER INPUT MODAL */}
                {showOdometerModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <Card className="w-full max-w-md p-6">
                            <div className="flex justify-between items-center pb-4 border-b">
                                <h3 className="text-2xl font-bold flex items-center gap-2 text-blue-600">
                                    <Gauge className='w-6 h-6'/> {modalActionType === 'start' ? 'Start Trip Odometer' : 'End Trip Odometer'}
                                </h3>
                                <button onClick={() => setShowOdometerModal(false)} className="text-gray-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50"><X className="w-6 h-6"/></button>
                            </div>
                            <p className='text-sm text-gray-600 my-4'>
                                Please enter the vehicle's current mileage reading (in km).
                            </p>
                            {modalActionType === 'end' && trip.odometerStart && (
                                <div className='bg-blue-50 border border-blue-200 p-3 rounded-lg mb-4 text-sm'>
                                    <p className='font-semibold text-gray-800'>
                                        **Trip Start Odometer:** <span className='text-blue-700'>{trip.odometerStart} km</span>
                                    </p>
                                </div>
                            )}
                            {modalActionType === 'start' && trip.odometerEndPrevious && (
                                <div className='bg-yellow-50 border border-yellow-200 p-3 rounded-lg mb-4 text-sm'>
                                    <p className='font-semibold text-gray-800'>
                                        **Last Recorded End Odometer:** <span className='text-yellow-700'>{trip.odometerEndPrevious} km</span>
                                    </p>
                                </div>
                            )}
                            
                            <input 
                                type='number'
                                value={odometerInput}
                                onChange={e => setOdometerInput(e.target.value)}
                                placeholder='Enter mileage (km)'
                                className='w-full p-3 border border-gray-300 rounded-xl text-lg mb-6 focus:ring-blue-500 focus:border-blue-500 font-mono'
                            />
                            
                            <div className="flex gap-3">
                                <button onClick={() => setShowOdometerModal(false)} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                                <button 
                                    onClick={handleSubmitOdometer} 
                                    disabled={!odometerInput || (modalActionType === 'end' && Number(odometerInput) <= (trip.odometerStart || 0)) || (modalActionType === 'start' && Number(odometerInput) <= (trip.odometerEndPrevious || 0) && trip.odometerEndPrevious > 0)} 
                                    className="flex-1 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 font-semibold flex justify-center items-center gap-2"
                                >
                                    <CheckCircle className='w-5 h-5'/> {modalActionType === 'start' ? 'Confirm Start' : 'Confirm End'}
                                </button>
                            </div>
                        </Card>
                    </div>
                )}

            </div>
        </div>
    );
}