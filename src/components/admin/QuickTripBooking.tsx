import { useState, useEffect, useMemo, useCallback } from 'react';
import { MapPin, Calendar, Clock, Car, Check, Navigation, ArrowRight, Search, Map as MapIcon, X, Plus, Trash2, ArrowDownUp, Loader2, Building2, Users, UserPlus, Send, AlertCircle } from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc, query, getDocs, where } from 'firebase/firestore';
import { logAction } from '../../utils/auditLogger'; // 💥 LOG ACTION IMPORTED

// Note: Assuming 'Card' and 'Badge' components are available from shared/
// If not, you may need to define simple div structures for them.

// Leaflet Imports
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- Helper Functions and Mock Data (Retained/Adapted from BookVehicle) ---

// --- FIX: Use CDN Icons to prevent missing marker images ---
const DefaultIcon = L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Numbered Icon for Stops (Red for Admin/Stops)
const createNumberIcon = (number: number) => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #EF4444; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${number}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
};

// SPECIAL COMPANY LOCATIONS DATABASE
const SPECIAL_LOCATIONS = [
    { display_name: "Carlos Embellishers (Pvt) Ltd - Veyangoda (Head Office)", keywords: ["carlos", "embellishers", "veyangoda", "head office", "main"], lat: "7.1667", lon: "80.0500", type: "special" },
    { display_name: "Carlos Embellishers - Katunayake Factory", keywords: ["carlos", "embellishers", "katunayake", "factory", "ftz"], lat: "7.1725", lon: "79.8853", type: "special" },
    { display_name: "Eskimo Fashion Knitwear - Negombo (Main)", keywords: ["eskimo", "fashion", "knitwear", "negombo", "main", "kadirana"], lat: "7.2008", lon: "79.8737", type: "special" },
];

// Mock/Simple Serial Number Generator
const generateNextSerialNumber = async (prefix: string): Promise<string> => {
    // Unique, timestamp-based ID for client-side admin booking
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const mockIncrement = String(Math.floor(Math.random() * 900) + 100); 
    return `ATR-${datePart}${timePart}${mockIncrement}`; // ATR = Admin Trip Request
};

// Helper: Fix Map View
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
    const map = useMap();
    map.setView(center, zoom);
    return null;
}

// Helper: Handle Map Clicks (Picker Modal)
function LocationMarker({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onLocationSelect(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

// 💥 UPDATED Interface: Added licenseType
interface Driver {
    id: string; // The user document ID (uid)
    name: string; // FullName
    phone: string;
    status: string; // driverStatus or status
    licenseType: string; // e.g., 'B'
}

// --- Component Interface (from QuickTripBooking) ---

interface QuickTripBookingProps {
    adminUser: {
        uid: string;
        email: string;
        name?: string;
        phone?: string;
        epfNumber?: string;
    };
    onTripCreated: () => void; // Callback to refresh dashboard list
}

type Step = 1 | 2 | 3 | 4 | 5;

// --- Badge Component (Simplified) ---
// Since we don't have the external Card/Badge, defining a minimal version
const Badge = ({ label, isCurrent, isComplete }: { label: string, isCurrent: boolean, isComplete: boolean }) => (
    <div className={`text-sm font-medium flex items-center gap-1 ${isComplete ? 'text-green-600' : isCurrent ? 'text-green-800' : 'text-gray-400'}`}>
        {isComplete ? <Check className="w-4 h-4" /> : <div className={`w-3 h-3 rounded-full ${isCurrent ? 'bg-green-600' : 'bg-gray-400'}`}></div>}
        <span className="hidden sm:inline">{label}</span>
    </div>
);

// --- Main Component ---

export function QuickTripBooking({ adminUser, onTripCreated }: QuickTripBookingProps) {
    const [currentStep, setCurrentStep] = useState<Step>(1);
    const [allVehicles, setAllVehicles] = useState<any[]>([]); 
    const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(false);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Vehicle/Driver Availability State
    const [bookedVehicleIds, setBookedVehicleIds] = useState<string[]>([]);
    const [bookedDriverIds, setBookedDriverIds] = useState<string[]>([]);
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    
    // Form State
    const [passengers, setPassengers] = useState(1);
    
    // Search & Location State
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [activeSearchIndex, setActiveSearchIndex] = useState<number | 'pickup' | null>(null);

    // Map State
    const [mapCenter, setMapCenter] = useState<[number, number]>([6.9271, 79.8612]); // Colombo
    const [mapZoom, setMapZoom] = useState(12);
    const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);

    // Map Picker Modal State
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<number | 'pickup' | null>(null);
    const [tempPickedLocation, setTempPickedLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [mapSearchQuery, setMapSearchQuery] = useState(''); 

    // Booking Data (Multi-Stop)
    const [pickup, setPickup] = useState<{ address: string, coords: { lat: number, lng: number } | null }>({ address: '', coords: null });
    const [stops, setStops] = useState<{ id: number, address: string, coords: { lat: number, lng: number } | null }[]>([
        { id: Date.now(), address: '', coords: null }
    ]);

    const [bookingDetails, setBookingDetails] = useState({
        date: '',
        time: '',
        vehicleId: '',
        driverId: '', 
        distanceText: '',
        distanceValueKm: 0,
        estimatedCost: 0,
    });
    
    // --- Draggable Marker Handlers (Retained) ---
    const handleDragEnd = async (e: any, target: 'pickup' | number) => { 
        const marker = e.target;
        const position = marker.getLatLng();
        const lat = position.lat;
        const lng = position.lng;

        let address = `Lat: ${lat.toFixed(4)}, Lon: ${lng.toFixed(4)}`;
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await response.json();
            if (data.display_name) address = data.display_name;
        } catch (err) { console.error(err); }

        if (target === 'pickup') {
            setPickup({ address, coords: { lat, lng } });
            recalculateTotalRoute({ lat, lng }, stops);
        } else {
            const index = target as number;
            const newStops = [...stops];
            newStops[index] = { ...newStops[index], address, coords: { lat, lng } };
            setStops(newStops);
            recalculateTotalRoute(pickup.coords, newStops);
        }
    };

    const pickupDragHandler = useMemo(() => ({ dragend: (e: any) => handleDragEnd(e, 'pickup') }), [stops, pickup]);
    const stopDragHandlers = useMemo(() => stops.map((_, index) => ({ dragend: (e: any) => handleDragEnd(e, index) })), [stops, pickup]);
    
    // --- Data Fetching ---
    
    // 1. Fetch ALL Vehicles and Drivers (from 'users' collection)
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Vehicles
                const qVehicles = query(collection(db, "vehicles"));
                const querySnapshotVehicles = await getDocs(qVehicles);
                const vehicleData = querySnapshotVehicles.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    ratePerKm: Number(doc.data().ratePerKm || 0),
                    seats: Number(doc.data().seats || 0),
                    status: doc.data().status || 'available', 
                    // 💥 Vehicle requires 'licenseTypeRequired' field for filtering (assuming 'licenseType' field on vehicle document)
                    licenseTypeRequired: doc.data().licenseType || 'B', 
                }));
                setAllVehicles(vehicleData);

                // 💥 Fetch Drivers from the 'users' collection where role == 'driver' and map fields correctly
                const qDrivers = query(collection(db, "users"), where("role", "==", "driver")); 
                const querySnapshotDrivers = await getDocs(qDrivers);
                const driverData = querySnapshotDrivers.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().fullName || 'N/A Driver', 
                    phone: doc.data().phone || 'N/A',
                    status: doc.data().driverStatus || doc.data().status || 'available', 
                    licenseType: doc.data().licenseType || 'B', 
                })) as Driver[];
                setAllDrivers(driverData);

            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);


    // 2. Check Trip Conflicts on Date Change (Vehicle AND Driver)
    useEffect(() => {
        if (!bookingDetails.date) {
            setBookedVehicleIds([]);
            setBookedDriverIds([]); 
            return;
        }

        setCheckingAvailability(true);
        const checkConflicts = async () => {
            try {
                const q = query(
                    collection(db, "trip_requests"),
                    where("date", "==", bookingDetails.date),
                    where("status", "in", ["approved", "in-progress", "reassigned"])
                );
                const querySnapshot = await getDocs(q);
                
                const lockedVehicleIds = querySnapshot.docs.map(doc => doc.data().vehicleId).filter(id => id);
                setBookedVehicleIds(lockedVehicleIds);

                const lockedDriverIds = querySnapshot.docs.map(doc => doc.data().driverId).filter(id => id);
                setBookedDriverIds(lockedDriverIds);

            } catch (error) {
                console.error("Error checking conflicts:", error);
                setBookedVehicleIds([]);
                setBookedDriverIds([]); 
            } finally {
                setCheckingAvailability(false);
            }
        };
        
        checkConflicts();
        setBookingDetails(prev => ({ ...prev, vehicleId: '', driverId: '', estimatedCost: 0 }));

    }, [bookingDetails.date]);


    // Helper: Filter vehicles based on passenger count AND date availability (Retained)
    const getFilteredVehicles = useCallback(() => {
        if (passengers === 0) return [];
        
        const available = allVehicles.filter(v => {
            // 1. Capacity Check
            if (v.seats < passengers) return false;

            // 2. Maintenance Check
            if (v.status === 'in-maintenance') return false;

            // 3. Date Conflict Check
            if (bookedVehicleIds.includes(v.id)) return false;

            return true;
        });
        
        return available;
    }, [allVehicles, passengers, bookedVehicleIds]);


    // 💥 Helper function to filter drivers (Filters by status, date conflict, AND vehicle license)
    const getFilteredDrivers = useCallback(() => {
        const selectedVehicle = allVehicles.find(v => v.id === bookingDetails.vehicleId);
        const requiredLicenseType = selectedVehicle?.licenseTypeRequired;

        return allDrivers.filter(d => {
            // 1. Status Check (Must be 'approved' or 'available' from the user document)
            if (d.status !== 'approved' && d.status !== 'available') return false; 
            
            // 2. Date Conflict Check (driver not assigned to an approved trip on this date)
            if (bookedDriverIds.includes(d.id)) return false;

            // 3. License Match Check (Only if a vehicle is selected and has a license type requirement)
            if (requiredLicenseType && d.licenseType !== requiredLicenseType) {
                return false;
            }

            return true;
        });
    }, [allDrivers, bookedDriverIds, bookingDetails.vehicleId, allVehicles]);
    
    // --- Route & Location Handlers (Retained) ---
    const addStop = () => setStops([...stops, { id: Date.now(), address: '', coords: null }]);

    const removeStop = (index: number) => { 
        if (stops.length === 1) { updateStop(index, '', null); return; }
        const newStops = stops.filter((_, i) => i !== index);
        setStops(newStops);
        recalculateTotalRoute(pickup.coords, newStops);
    };

    const updateStop = (index: number, address: string, coords: { lat: number, lng: number } | null) => {
        const newStops = [...stops];
        newStops[index] = { ...newStops[index], address, coords };
        setStops(newStops);
        if (coords) recalculateTotalRoute(pickup.coords, newStops);
    };

    const optimizeRoute = () => { 
        if (!pickup.coords || stops.length < 2) return;
        const unvisited = [...stops];
        const optimized = [];
        let currentPos = pickup.coords;

        while (unvisited.length > 0) {
            let nearestIndex = -1;
            let minDist = Infinity;
            for (let i = 0; i < unvisited.length; i++) {
                const stop = unvisited[i];
                if (!stop.coords) continue;
                const dist = Math.sqrt(Math.pow(stop.coords.lat - currentPos.lat, 2) + Math.pow(stop.coords.lng - currentPos.lng, 2));
                if (dist < minDist) { minDist = dist; nearestIndex = i; }
            }
            if (nearestIndex !== -1) {
                const nextStop = unvisited[nearestIndex];
                optimized.push(nextStop);
                if (nextStop.coords) currentPos = nextStop.coords;
                unvisited.splice(nearestIndex, 1);
            } else {
                optimized.push(...unvisited);
                break;
            }
        }
        setStops(optimized);
        recalculateTotalRoute(pickup.coords, optimized);
        alert("Route optimized!");
    };

    const handleSearch = async (query: string, target: number | 'pickup') => {
        if (target === 'pickup') setPickup(prev => ({ ...prev, address: query }));
        else {
            const newStops = [...stops];
            newStops[target].address = query;
            setStops(newStops);
        }
        setActiveSearchIndex(target);

        if (!query) { setSuggestions([]); return; }
        const lowerQuery = query.toLowerCase();
        const specialMatches = SPECIAL_LOCATIONS.filter(loc =>
            loc.keywords.some(k => k.includes(lowerQuery)) ||
            loc.display_name.toLowerCase().includes(lowerQuery)
        );

        let apiMatches: any[] = [];
        if (query.length > 2) {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=lk&addressdetails=1&limit=5`);
                const apiMatchesRaw = await response.json();
                apiMatches = apiMatchesRaw;
            } catch (error) { console.error("Search error:", error); }
        }
        setSuggestions([...specialMatches, ...apiMatches]);
    };

    const selectSuggestion = (place: any) => {
        if (activeSearchIndex === null) return;
        const lat = parseFloat(place.lat);
        const lng = parseFloat(place.lon);
        const displayName = place.display_name;

        if (activeSearchIndex === 'pickup') {
            setPickup({ address: displayName, coords: { lat, lng } });
            recalculateTotalRoute({ lat, lng }, stops);
        } else {
            updateStop(activeSearchIndex as number, displayName, { lat, lng });
        }
        setMapCenter([lat, lng]);
        setSuggestions([]);
        setActiveSearchIndex(null);
    };

    const recalculateTotalRoute = async (startCoords: { lat: number, lng: number } | null, currentStops: typeof stops) => { 
        if (!startCoords) return;
        const validStops = currentStops.filter(s => s.coords !== null);
        if (validStops.length === 0) {
            setBookingDetails(prev => ({ ...prev, distanceText: '0 km', distanceValueKm: 0 }));
            setRoutePolyline([]);
            return;
        }

        const coordsUrl = [`${startCoords.lng},${startCoords.lat}`, ...validStops.map(s => `${s.coords!.lng},${s.coords!.lat}`)].join(';');
        try {
            const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsUrl}?overview=full&geometries=geojson`);
            const data = await response.json();
            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const km = (route.distance / 1000);
                setBookingDetails(prev => ({ ...prev, distanceText: `${km.toFixed(1)} km`, distanceValueKm: km }));
                const coordinates = route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
                setRoutePolyline(coordinates);
                setMapCenter([startCoords.lat, startCoords.lng]);
                setMapZoom(11);
            }
        } catch (error) { console.error("Routing error:", error); }
    };
    
    // --- Map Picker (Retained) ---
    const openMapPicker = (target: number | 'pickup') => {
        setPickerTarget(target);
        setTempPickedLocation(null);
        setMapSearchQuery('');
        setShowMapPicker(true);
    };
    const onMapClick = (lat: number, lng: number) => { setTempPickedLocation({ lat, lng }); };

    const handleMapModalSearch = async () => {
        try {
            const lowerQuery = mapSearchQuery.toLowerCase();
            const specialMatch = SPECIAL_LOCATIONS.find(loc => loc.keywords.some(k => k.includes(lowerQuery)));

            if (specialMatch) {
                const lat = parseFloat(specialMatch.lat);
                const lng = parseFloat(specialMatch.lon);
                setMapCenter([lat, lng]);
                setMapZoom(15);
                return;
            }

            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery)}&countrycodes=lk&limit=1`);
            const data = await response.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                setMapCenter([lat, lng]);
                setMapZoom(15);
            } else {
                alert("Location not found");
            }
        } catch (e) { console.error(e); }
    };

    const confirmLocation = async () => {
        if (!tempPickedLocation || pickerTarget === null) return;
        const { lat, lng } = tempPickedLocation;
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await response.json();
            const address = data.display_name || `Lat: ${lat.toFixed(4)}, Lon: ${lng.toFixed(4)}`;

            if (pickerTarget === 'pickup') {
                setPickup({ address, coords: { lat, lng } });
                recalculateTotalRoute({ lat, lng }, stops);
            } else {
                updateStop(pickerTarget as number, address, { lat, lng });
            }
        } catch (error) {
            const address = `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            if (pickerTarget === 'pickup') {
                setPickup({ address, coords: { lat, lng } });
                recalculateTotalRoute({ lat, lng }, stops);
            } else {
                updateStop(pickerTarget as number, address, { lat, lng });
            }
        }
        setShowMapPicker(false);
    };

    // --- GPS Handler (Retained) ---
    const handleUseCurrentLocation = () => {
        if (navigator.geolocation) {
            setGpsLoading(true);
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                        const data = await response.json();
                        const address = data.display_name || "Current Location";
                        setPickup({ address, coords: { lat, lng } });
                        setMapCenter([lat, lng]);
                        setMapZoom(15);
                        recalculateTotalRoute({ lat, lng }, stops);
                    } catch (e) {
                        setPickup({ address: `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, coords: { lat, lng } });
                        recalculateTotalRoute({ lat, lng }, stops);
                    }
                    setGpsLoading(false);
                },
                (error) => { alert("GPS Error: " + error.message); setGpsLoading(false); },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else { alert("Geolocation not supported."); }
    };
    
    // --- Cost Calculation (Retained) ---
    useEffect(() => {
        if (bookingDetails.vehicleId && bookingDetails.distanceValueKm > 0) {
            const vehicle = allVehicles.find(v => v.id === bookingDetails.vehicleId);
            const rate = vehicle?.ratePerKm ? Number(vehicle.ratePerKm) : 0;
            const cost = rate > 0 ? Math.round(bookingDetails.distanceValueKm * rate) : 0;
            setBookingDetails(prev => ({ ...prev, estimatedCost: cost }));
        }
    }, [bookingDetails.vehicleId, bookingDetails.distanceValueKm, allVehicles]);

    // --- Admin Booking Submission (MODIFIED with Audit Log) ---
    const handleAdminBooking = async () => {
        setError('');
        if (!bookingDetails.vehicleId || !bookingDetails.driverId || bookingDetails.distanceValueKm === 0) {
            setError("Please select a vehicle and a driver, and ensure the route distance is calculated.");
            return;
        }

        setLoading(true);
        try {
            const serialNumber = await generateNextSerialNumber('TRP'); 

            const vehicle = allVehicles.find(v => v.id === bookingDetails.vehicleId);
            const driver = allDrivers.find(d => d.id === bookingDetails.driverId);
            
            const tripData = {
                serialNumber: serialNumber,
                userId: adminUser.uid,
                customer: adminUser.name || adminUser.email,
                customerName: adminUser.name || adminUser.email,
                customerPhone: adminUser.phone || 'N/A',
                email: adminUser.email,
                epf: adminUser.epfNumber || 'N/A',
                
                passengers: passengers, 
                pickup: pickup.address,
                pickupCoords: pickup.coords,
                destinations: stops.map(s => s.address).filter(a => a), 
                destinationCoords: stops.map(s => s.coords).filter(c => c),
                destination: stops[stops.length - 1].address,
                
                date: bookingDetails.date,
                time: bookingDetails.time,
                
                vehicleId: bookingDetails.vehicleId, 
                vehicleModel: vehicle?.model || 'N/A', 
                vehicleNumber: vehicle?.number || 'N/A',
                driverId: bookingDetails.driverId,
                driverName: driver?.name || 'N/A',
                driverPhone: driver?.phone || 'N/A',
                
                distance: bookingDetails.distanceText,
                cost: `LKR ${bookingDetails.estimatedCost}`,
                
                // Set status to approved immediately
                status: 'approved', 
                requestedAt: new Date().toISOString(),
                approvedBy: adminUser.name || adminUser.email,
                approvedAt: new Date().toISOString(),
            };

            await addDoc(collection(db, "trip_requests"), tripData);
            
            // 💥 AUDIT LOG: Admin Quick Booking
            await logAction(
                adminUser.email, 
                'TRIP_BOOKING_ADMIN', 
                'Created & Auto-Approved Trip', 
                `Admin booked and approved trip #${serialNumber} for self/approved user ${adminUser.name || adminUser.email}. Vehicle: ${vehicle?.number}, Driver: ${driver?.name}.`, 
                { 
                    adminName: adminUser.name,
                    targetId: serialNumber, 
                    targetName: `Trip #${serialNumber}`, 
                    vehicleId: bookingDetails.vehicleId, 
                    driverId: bookingDetails.driverId 
                }
            );

            alert(`Trip #${serialNumber} successfully created and approved!`);
            onTripCreated(); 
            
            // Reset form state
            setPickup({ address: '', coords: null });
            setStops([{ id: Date.now(), address: '', coords: null }]);
            setPassengers(1);
            setBookingDetails({ date: '', time: '', vehicleId: '', driverId: '', distanceText: '', distanceValueKm: 0, estimatedCost: 0 });
            setCurrentStep(1); 
            
        } catch (err) {
            console.error("Admin booking failed:", err);
            setError("Failed to create trip. Check console for details.");
        } finally {
            setLoading(false);
        }
    };


    const availableVehicles = getFilteredVehicles();
    const availableDrivers = getFilteredDrivers();

    return (
        <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Car className="w-5 h-5 text-green-600"/> Admin Multi-Step Booking (Self/Approved)
            </h3>
            <p className="text-sm text-gray-500 mb-4">Book a trip, assign a vehicle/driver, and automatically approve it.</p>
            
            {error && (
                 <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="text-left">{error}</div>
                 </div>
            )}
            
            {/* Step Indicators */}
            <div className="flex justify-between items-center mb-6">
                <Badge label="Route" isCurrent={currentStep === 1 || currentStep === 2} isComplete={currentStep > 2} />
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <Badge label="Date/Time" isCurrent={currentStep === 3} isComplete={currentStep > 3} />
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <Badge label="Vehicle/Driver" isCurrent={currentStep === 4} isComplete={currentStep > 4} />
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <Badge label="Confirm" isCurrent={currentStep === 5} isComplete={currentStep === 5} />
            </div>

            {/* --- Step 1 & 2: Route Selection (Combined) --- */}
            {(currentStep === 1 || currentStep === 2) && (
                <div>
                    <h2 className="text-xl text-gray-900 mb-6">Set Route & Passengers</h2>

                    {/* Passenger Input */}
                    <div className="mb-6">
                        <label className="block text-sm text-gray-700 mb-1 font-medium">Number of Passengers</label>
                        <div className="flex gap-2 items-center">
                            <div className="p-3 bg-gray-100 border border-gray-300 rounded-xl w-12 flex justify-center items-center">
                                <Users className="w-5 h-5 text-gray-600" />
                            </div>
                            <input
                                type="number"
                                name="passengers"
                                min="1"
                                value={passengers}
                                onChange={(e) => setPassengers(Math.max(1, parseInt(e.target.value) || 1))}
                                placeholder="1"
                                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl outline-none"
                            />
                        </div>
                    </div>

                    {/* Pickup Input */}
                    <div className="relative z-[60] mb-6">
                        <label className="block text-sm text-gray-700 mb-1 font-medium">Pickup Location</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActiveSearchIndex(activeSearchIndex === 'pickup' ? null : 'pickup')}
                                className="p-3 bg-gray-100 border border-gray-300 rounded-xl hover:bg-gray-200 w-12 flex justify-center items-center"
                                title="Search Location"
                            >
                                <Search className="w-5 h-5 text-gray-600" />
                            </button>

                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={pickup.address}
                                    onChange={(e) => handleSearch(e.target.value, 'pickup')}
                                    placeholder="Start location..."
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none"
                                />
                                {activeSearchIndex === 'pickup' && suggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg max-h-60 overflow-y-auto z-[100]">
                                        {suggestions.map((place, idx) => (
                                            <div key={idx} onClick={() => selectSuggestion(place)} className="p-3 hover:bg-gray-50 cursor-pointer text-sm border-b last:border-0 flex items-center gap-2">
                                                {place.type === 'special' ? <Building2 className="w-4 h-4 text-blue-600" /> : <MapPin className="w-4 h-4 text-gray-400" />}
                                                {place.display_name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => openMapPicker('pickup')} className="p-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100" title="Map"><MapIcon className="w-5 h-5 text-[#2563EB]" /></button>
                            <button type="button" onClick={handleUseCurrentLocation} className="p-3 bg-gray-100 border border-gray-200 rounded-xl hover:bg-gray-200 w-12 flex justify-center items-center" title="GPS">
                                {gpsLoading ? <Loader2 className="w-5 h-5 text-gray-600 animate-spin" /> : <Navigation className="w-5 h-5 text-gray-600" />}
                            </button>
                        </div>
                    </div>

                    {/* Dynamic Stops */}
                    <div className="space-y-4 mb-6">
                        <label className="block text-sm text-gray-700 font-medium">Destinations / Stops</label>
                        {stops.map((stop, index) => (
                            <div key={stop.id} className="relative z-[50]">
                                <div className="flex gap-2 items-center">
                                    <button
                                        onClick={() => setActiveSearchIndex(activeSearchIndex === index ? null : index)}
                                        className="p-3 bg-gray-100 border border-gray-300 rounded-xl hover:bg-gray-200 w-12 flex justify-center items-center"
                                        title="Search Stop"
                                    >
                                        <MapPin className="w-5 h-5 text-red-500" />
                                    </button>

                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={stop.address}
                                            onChange={(e) => handleSearch(e.target.value, index)}
                                            placeholder={`Stop ${index + 1} location...`}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none"
                                        />
                                        {activeSearchIndex === index && suggestions.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg max-h-60 overflow-y-auto z-[100]">
                                                {suggestions.map((place, idx) => (
                                                    <div key={idx} onClick={() => selectSuggestion(place)} className="p-3 hover:bg-gray-50 cursor-pointer text-sm border-b last:border-0 flex items-center gap-2">
                                                        {place.type === 'special' ? <Building2 className="w-4 h-4 text-blue-600" /> : <MapPin className="w-4 h-4 text-gray-400" />}
                                                        {place.display_name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => openMapPicker(index)} className="p-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100" title="Map"><MapIcon className="w-5 h-5 text-[#2563EB]" /></button>
                                    <button onClick={() => removeStop(index)} className="p-3 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100" title="Remove"><Trash2 className="w-5 h-5 text-red-500" /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between mb-6">
                        <button onClick={addStop} className="flex items-center gap-2 text-sm text-[#2563EB] font-medium hover:underline"><Plus className="w-4 h-4"/> Add Another Stop</button>
                        <button onClick={optimizeRoute} disabled={!pickup.coords || stops.length < 2 || stops.some(s => !s.coords)} className="flex items-center gap-2 text-sm text-green-600 font-medium disabled:opacity-50 hover:underline"><ArrowDownUp className="w-4 h-4"/> Optimize Route</button>
                    </div>

                    {/* Map Preview (Draggable Markers) */}
                    <div className="w-full h-80 bg-gray-100 rounded-xl mb-6 overflow-hidden border border-gray-200 relative z-0">
                        <MapContainer key={routePolyline.length} center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }}>
                            <ChangeView center={mapCenter} zoom={mapZoom} />
                            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                            {pickup.coords && (
                                <Marker draggable={true} eventHandlers={pickupDragHandler} position={[pickup.coords.lat, pickup.coords.lng]}><Popup>Pickup (Drag)</Popup></Marker>
                            )}

                            {stops.map((s, i) => s.coords && (
                                <Marker key={s.id} draggable={true} eventHandlers={stopDragHandlers[i]} position={[s.coords.lat, s.coords.lng]} icon={createNumberIcon(i + 1)}><Popup>Stop {i + 1} (Drag)</Popup></Marker>
                            ))}

                            {routePolyline.length > 0 && <Polyline positions={routePolyline} color="blue" />}
                        </MapContainer>
                    </div>

                    <div className="bg-green-50 p-4 rounded-xl mb-6 text-green-800 border border-green-100 flex items-center gap-2">
                        <Check className="w-5 h-5" />
                        <span>Total Distance: <strong>{bookingDetails.distanceText || '0 km'}</strong></span>
                    </div>

                    <button onClick={() => setCurrentStep(3)} disabled={!pickup.address || stops.some(s => !s.address) || bookingDetails.distanceValueKm === 0} className="w-full py-3 bg-green-600 text-white rounded-xl disabled:opacity-50 hover:bg-green-700">
                        Next: Date & Time
                    </button>
                </div>
            )}

            {/* --- Step 3: Date & Time --- */}
            {currentStep === 3 && (
                <div>
                    <h2 className="text-xl text-gray-900 mb-6">Select Date & Time</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            <input type="date" value={bookingDetails.date} onChange={(e) => setBookingDetails({...bookingDetails, date: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl appearance-none" />
                        </div>
                        <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            <input type="time" value={bookingDetails.time} onChange={(e) => setBookingDetails({...bookingDetails, time: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl appearance-none" />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setCurrentStep(2)} className="flex-1 py-3 border border-gray-300 rounded-xl">Back</button>
                        <button onClick={() => setCurrentStep(4)} disabled={!bookingDetails.date || !bookingDetails.time} className="flex-1 py-3 bg-green-600 text-white rounded-xl disabled:opacity-50">Next</button>
                    </div>
                </div>
            )}

            {/* --- Step 4: Vehicle & Driver Selection --- */}
            {currentStep === 4 && (
                <div>
                    <h2 className="text-xl text-gray-900 mb-6">Select Vehicle & Driver</h2>
                    
                    {/* Availability Status / Loader (Vehicle) */}
                    <div className={`mb-4 p-3 rounded-xl border ${checkingAvailability ? 'bg-gray-50' : availableVehicles.length === 0 || availableDrivers.length === 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                        {checkingAvailability ? (
                            <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Checking vehicle/driver availability for **{bookingDetails.date}**...</div>
                        ) : (
                            `Found ${availableVehicles.length} available vehicle(s) and ${availableDrivers.length} available driver(s).`
                        )}
                    </div>
                    
                    {/* Vehicle Selection */}
                    <h3 className="text-lg font-medium text-gray-700 mb-3">Vehicle (Capacity: {passengers}+, Distance: {bookingDetails.distanceText})</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                        {availableVehicles.length === 0 && !checkingAvailability ? (
                            <div className="col-span-full p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-100">
                                No available vehicles meet the capacity requirement for {passengers} passengers or are free on this date.
                            </div>
                        ) : (
                            availableVehicles.map((vehicle) => {
                                const previewCost = vehicle.ratePerKm ? Math.round(bookingDetails.distanceValueKm * vehicle.ratePerKm) : 0;
                                return (
                                    <div key={vehicle.id} onClick={() => setBookingDetails({ ...bookingDetails, vehicleId: vehicle.id })} className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${bookingDetails.vehicleId === vehicle.id ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-green-200'}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-gray-900">{vehicle.model}</div>
                                                <div className="text-xs text-gray-500">{vehicle.number} / {vehicle.seats} Seats</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-semibold text-green-600">LKR {previewCost}</div>
                                                <div className="text-xs text-gray-500">({vehicle.ratePerKm}/km)</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Driver Selection - 💥 FIXED: Uses availableDrivers, shows name/license */}
                    <h3 className="text-lg font-medium text-gray-700 mb-3 mt-6">Assign Driver</h3>
                    {!bookingDetails.vehicleId && availableDrivers.length > 0 && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-xl flex items-center gap-2">
                             <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            Please select a **Vehicle** first to filter drivers by **License Type**.
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                        {availableDrivers.length === 0 && !checkingAvailability ? (
                             <div className="col-span-full p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-100">
                                No available drivers found or all are booked on this date/license mismatch.
                            </div>
                        ) : (
                            availableDrivers.map((driver) => {
                                const isLicenseMatch = !bookingDetails.vehicleId || driver.licenseType === allVehicles.find(v => v.id === bookingDetails.vehicleId)?.licenseTypeRequired;
                                return (
                                <div 
                                    key={driver.id} 
                                    onClick={() => {
                                        if (isLicenseMatch) {
                                            setBookingDetails({ ...bookingDetails, driverId: driver.id });
                                        } else {
                                            setError(`Driver ${driver.name} cannot drive the selected vehicle (requires license type ${allVehicles.find(v => v.id === bookingDetails.vehicleId)?.licenseTypeRequired}).`);
                                        }
                                    }} 
                                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all flex items-center gap-3 
                                        ${bookingDetails.driverId === driver.id ? 'border-green-600 bg-green-50' : 
                                        !isLicenseMatch ? 'border-red-400 bg-red-50 opacity-60' : // Visually indicate mismatch
                                        'border-gray-200 hover:border-green-200'}`}
                                >
                                    <UserPlus className="w-5 h-5 text-gray-600"/>
                                    <div>
                                        {/* 💥 Display Full Name */}
                                        <div className="font-bold text-gray-900">{driver.name}</div>
                                        {/* 💥 Display License Type */}
                                        <div className="text-xs text-gray-500">{driver.phone} | License: {driver.licenseType} 
                                            {!isLicenseMatch && <span className='text-red-500 ml-2'>(Mismatch!)</span>}
                                        </div>
                                    </div>
                                </div>
                                );
                            })
                        )}
                    </div>


                    <div className="flex gap-3">
                        <button onClick={() => setCurrentStep(3)} className="flex-1 py-3 border border-gray-300 rounded-xl">Back</button>
                        <button onClick={() => setCurrentStep(5)} disabled={!bookingDetails.vehicleId || !bookingDetails.driverId || checkingAvailability} className="flex-1 py-3 bg-green-600 text-white rounded-xl disabled:opacity-50">Review</button>
                    </div>
                </div>
            )}

            {/* --- Step 5: Confirm --- */}
            {currentStep === 5 && (
                <div>
                    <h2 className="text-xl text-gray-900 mb-6">Confirm & Approve Booking</h2>
                    <div className="space-y-4 mb-6">
                        <div className="p-4 bg-gray-50 rounded-xl">
                            <div className="text-sm text-gray-500 mb-1">Route Summary</div>
                            <div className="font-medium">Start: {pickup.address}</div>
                            {stops.map((s, i) => (
                                <div key={s.id} className="text-sm text-gray-600 ml-2 my-1">↓ Stop {i+1}: {s.address}</div>
                            ))}
                            <div className="mt-2 text-xs bg-white inline-block px-2 py-1 rounded border">Total: {bookingDetails.distanceText}</div>
                        </div>
                        
                        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex justify-between items-center">
                            <span className="text-green-800 font-medium">Total Estimated Cost</span>
                            <span className="text-2xl text-green-600 font-bold">LKR {bookingDetails.estimatedCost}</span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-3 border rounded-lg"><div className="text-xs text-gray-500">Date</div><div>{bookingDetails.date}</div></div>
                            <div className="p-3 border rounded-lg"><div className="text-xs text-gray-500">Time</div><div>{bookingDetails.time}</div></div>
                            <div className="p-3 border rounded-lg"><div className="text-xs text-gray-500">Passengers</div><div>{passengers}</div></div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setCurrentStep(4)} className="flex-1 py-3 border border-gray-300 rounded-xl">Back</button>
                        <button onClick={handleAdminBooking} disabled={loading} className="flex-1 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-70">
                            <Send className="w-5 h-5 inline-block mr-2" /> {loading ? 'Approving...' : 'Confirm & Auto-Approve'}
                        </button>
                    </div>
                </div>
            )}
            
            {/* MAP PICKER MODAL */}
            {showMapPicker && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
                    <div className="w-full max-w-3xl p-6 bg-white rounded-xl shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold">Choose Location on Map</h3>
                            <button onClick={() => setShowMapPicker(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
                        </div>
                        {/* Search inside Modal */}
                        <div className="flex gap-2 mb-3">
                            <input
                                className="flex-1 border p-2 rounded-lg"
                                placeholder="Search place (e.g. Kandy)"
                                value={mapSearchQuery}
                                onChange={(e) => setMapSearchQuery(e.target.value)}
                            />
                            <button onClick={handleMapModalSearch} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Search</button>
                        </div>

                        <div className="h-[400px] border rounded-xl overflow-hidden mb-4 relative">
                            <MapContainer key={showMapPicker ? "open" : "closed"} center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <LocationMarker onLocationSelect={onMapClick} />
                                {tempPickedLocation && (
                                    <Marker position={[tempPickedLocation.lat, tempPickedLocation.lng]}><Popup>Selected</Popup></Marker>
                                )}
                            </MapContainer>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowMapPicker(false)} className="px-4 py-2 border rounded-xl">Cancel</button>
                            <button onClick={confirmLocation} disabled={!tempPickedLocation} className="px-6 py-2 bg-green-600 text-white rounded-xl disabled:opacity-50">Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}