import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MapPin, Calendar, Clock, Car, Check, Navigation, ArrowRight, Search, Map as MapIcon, X, Plus, Trash2, ArrowDownUp, Loader2, Building2, Users } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, getDocs, addDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { sendTripBookingEmail } from '../../utils/emailService';

// Leaflet Imports
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

// Custom Numbered Icon for Stops
const createNumberIcon = (number: number) => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #2563EB; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${number}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
};

// --- SPECIAL COMPANY LOCATIONS DATABASE (Retained) ---
const SPECIAL_LOCATIONS = [
     { display_name: "Carlos Embellishers (Pvt) Ltd - Veyangoda (Head Office)", keywords: ["carlos", "embellishers", "veyangoda", "head office", "main"], lat: "7.1667", lon: "80.0500", type: "special" },
     { display_name: "Carlos Embellishers - Katunayake Factory", keywords: ["carlos", "embellishers", "katunayake", "factory", "ftz"], lat: "7.1725", lon: "79.8853", type: "special" },
     { display_name: "Carlos Embellishers - Horana Plant", keywords: ["carlos", "embellishers", "horana", "plant"], lat: "6.7167", lon: "80.0667", type: "special" },
     { display_name: "Carlos Embellishers - Trincomalee Branch", keywords: ["carlos", "embellishers", "trincomalee", "trinco"], lat: "8.5874", lon: "81.2152", type: "special" },
     { display_name: "Eskimo Fashion Knitwear - Negombo (Main)", keywords: ["eskimo", "fashion", "knitwear", "negombo", "main", "kadirana"], lat: "7.2008", lon: "79.8737", type: "special" },
     { display_name: "Eskimo Fashion Knitwear - Pallekele", keywords: ["eskimo", "fashion", "knitwear", "pallekele", "kandy"], lat: "7.2803", lon: "80.7062", type: "special" },
     { display_name: "Eskimo Fashion Knitwear - Koggala", keywords: ["eskimo", "fashion", "knitwear", "koggala", "galle"], lat: "5.9936", lon: "80.3236", type: "special" }
];

interface BookVehicleProps {
    user: User;
    onNavigate: (screen: string) => void;
    onLogout: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

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

export function BookVehicle({ user, onNavigate, onLogout }: BookVehicleProps) {
    const [currentStep, setCurrentStep] = useState<Step>(1);
    const [allVehicles, setAllVehicles] = useState<any[]>([]); // All vehicles in fleet (Master List)
    const [loading, setLoading] = useState(false);
    const [gpsLoading, setGpsLoading] = useState(false);
    // 💥 NEW STATE: IDs of vehicles booked on the selected date
    const [bookedVehicleIds, setBookedVehicleIds] = useState<string[]>([]);
    // 💥 NEW STATE: Loading state for vehicle availability check
    const [checkingAvailability, setCheckingAvailability] = useState(false);


    // New State for Passengers
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
    const [mapSearchQuery, setMapSearchQuery] = useState(''); // Search inside map modal

    // Booking Data (Multi-Stop)
    const [pickup, setPickup] = useState<{ address: string, coords: { lat: number, lng: number } | null }>({ address: '', coords: null });
    const [stops, setStops] = useState<{ id: number, address: string, coords: { lat: number, lng: number } | null }[]>([
        { id: Date.now(), address: '', coords: null }
    ]);

    const [bookingDetails, setBookingDetails] = useState({
        date: '',
        time: '',
        vehicleId: '',
        distanceText: '',
        distanceValueKm: 0,
        estimatedCost: 0,
    });

    // --- Draggable Marker Handlers (Retained) ---
    const handleDragEnd = async (e: any, target: 'pickup' | number) => { /* ... (Logic retained) ... */
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


    // 1. Fetch ALL Vehicles
    useEffect(() => {
        const fetchVehicles = async () => {
            try {
                // Fetch ALL vehicles (regardless of status, we filter later)
                const q = query(collection(db, "vehicles"));
                const querySnapshot = await getDocs(q);
                const data = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    ratePerKm: Number(doc.data().ratePerKm || 0),
                    seats: Number(doc.data().seats || 0),
                    status: doc.data().status || 'available', // Use database status as baseline
                }));
                setAllVehicles(data);
            } catch (error) {
                console.error("Error fetching vehicles:", error);
            }
        };
        fetchVehicles();
    }, []);

    // 💥 EFFECT 2: Check Trip Conflicts on Date Change
    useEffect(() => {
        if (!bookingDetails.date) {
            setBookedVehicleIds([]);
            return;
        }

        setCheckingAvailability(true);
        const checkConflicts = async () => {
            try {
                // Fetch all APPROVED/IN-PROGRESS trips for the selected date
                const q = query(
                    collection(db, "trip_requests"),
                    where("date", "==", bookingDetails.date),
                    where("status", "in", ["approved", "in-progress", "reassigned"])
                );
                const querySnapshot = await getDocs(q);
                
                // Collect IDs of vehicles that are locked on this specific date
                const lockedIds = querySnapshot.docs.map(doc => doc.data().vehicleId).filter(id => id);
                setBookedVehicleIds(lockedIds);

            } catch (error) {
                console.error("Error checking conflicts:", error);
                setBookedVehicleIds([]);
            } finally {
                setCheckingAvailability(false);
            }
        };
        
        checkConflicts();
        // Recalculate estimated cost and reset vehicle ID on date change
        setBookingDetails(prev => ({ ...prev, vehicleId: '', estimatedCost: 0 }));

    }, [bookingDetails.date]);


    // Helper: Filter vehicles based on passenger count AND date availability
    const getFilteredVehicles = useCallback(() => {
        if (passengers === 0) return [];
        
        const available = allVehicles.filter(v => {
            // 1. Capacity Check
            if (v.seats < passengers) return false;

            // 2. Maintenance Check
            if (v.status === 'in-maintenance') return false;

            // 3. Date Conflict Check (Only show vehicles that are NOT booked for the selected date)
            if (bookedVehicleIds.includes(v.id)) return false;

            return true;
        });
        
        return available;
    }, [allVehicles, passengers, bookedVehicleIds]);


    // 2. Stop Management (Retained)
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

    // 3. Route Optimization (Retained)
    const optimizeRoute = () => { /* ... (Logic retained) ... */
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

    // 4. Search Handlers (Retained)
    const handleSearch = async (query: string, target: number | 'pickup') => {
        if (target === 'pickup') setPickup(prev => ({ ...prev, address: query }));
        else {
            const newStops = [...stops];
            newStops[target].address = query;
            setStops(newStops);
        }
        setActiveSearchIndex(target);

        if (!query) {
            setSuggestions([]);
            return;
        }

        // Special Locations + API
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

    // 5. Route Calculation (Retained)
    const recalculateTotalRoute = async (startCoords: { lat: number, lng: number } | null, currentStops: typeof stops) => {
        if (!startCoords) return;
        const validStops = currentStops.filter(s => s.coords !== null);
        if (validStops.length === 0) return;

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

    // 6. Map Picker (Retained)
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

    // 7. GPS Handler (Retained)
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

    // 8. Cost Calculation (Retained)
    useEffect(() => {
        if (bookingDetails.vehicleId && bookingDetails.distanceValueKm > 0) {
            const vehicle = allVehicles.find(v => v.id === bookingDetails.vehicleId);
            const rate = vehicle?.ratePerKm ? Number(vehicle.ratePerKm) : 0;
            const cost = rate > 0 ? Math.round(bookingDetails.distanceValueKm * rate) : 0;
            setBookingDetails(prev => ({ ...prev, estimatedCost: cost }));
        }
    }, [bookingDetails.vehicleId, bookingDetails.distanceValueKm, allVehicles]);

    // 9. Submit (Updated to include passengers)
    const handleBooking = async () => {
        setLoading(true);
        try {
            // 1. Fetch ALL trip requests to find the true max ID
            const q = query(collection(db, "trip_requests"));
            const querySnapshot = await getDocs(q);

            let maxNum = 0;
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.serialNumber && data.serialNumber.startsWith('TRP-')) {
                    const numPart = parseInt(data.serialNumber.split('-')[1]);
                    if (!isNaN(numPart) && numPart > maxNum) {
                        maxNum = numPart;
                    }
                }
            });

            const nextId = `TRP-${String(maxNum + 1).padStart(3, '0')}`;

            const vehicle = allVehicles.find(v => v.id === bookingDetails.vehicleId);


            const tripData = {
                serialNumber: nextId,
                userId: user.id,
                customer: user.name,
                customerPhone: user.phone || 'N/A',
                email: user.email,
                epf: user.epfNumber || 'N/A',
                passengers: passengers, // 🌟 New: Passenger count included
                pickup: pickup.address,
                pickupCoords: pickup.coords,
                destinations: stops.map(s => s.address).filter(a => a), // Filter out empty stops
                destinationCoords: stops.map(s => s.coords).filter(c => c),
                destination: stops[stops.length - 1].address,
                date: bookingDetails.date,
                time: bookingDetails.time,
                requestedVehicleId: bookingDetails.vehicleId,
                requestedVehicleModel: vehicle?.model || 'N/A', // Added model for admin view
                distance: bookingDetails.distanceText,
                cost: `LKR ${bookingDetails.estimatedCost}`,
                status: 'pending',
                requestedAt: new Date().toISOString(),
            };

            await addDoc(collection(db, "trip_requests"), tripData);
            // await sendTripBookingEmail(tripData); // MOCK: Email service assumed
            alert(`Booking ${nextId} submitted!`);
            onNavigate('user-dashboard');
        } catch (error) {
            console.error("Error creating booking:", error);
            alert("Failed to submit.");
        } finally {
            setLoading(false);
        }
    };

    const availableVehicles = getFilteredVehicles();

    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="book-vehicle" />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="mb-8">
                    <h1 className="text-3xl text-gray-900 mb-2">Book a Vehicle</h1>
                    <p className="text-gray-600">Schedule your multi-stop trip</p>
                </div>

                <Card className="p-6 sm:p-8">
                    {/* Step 1 & 2: Route Selection (Combined) */}
                    {(currentStep === 1 || currentStep === 2) && (
                        <div>
                            <h2 className="text-xl text-gray-900 mb-6">Set Route & Passengers</h2>

                            {/* Passenger Input - FIXED ICON PLACEMENT */}
                            <div className="mb-6">
                                <label className="block text-sm text-gray-700 mb-1 font-medium">Number of Passengers</label>
                                <div className="flex gap-2 items-center">
                                    {/* Users Icon moved outside */}
                                    <div className="p-3 bg-gray-100 border border-gray-300 rounded-xl w-12 flex justify-center items-center">
                                        <Users className="w-5 h-5 text-gray-600" />
                                    </div>
                                    <input
                                        type="number"
                                        min="1"
                                        value={passengers}
                                        onChange={(e) => setPassengers(Math.max(1, parseInt(e.target.value) || 1))}
                                        placeholder="1"
                                        className="flex-1 px-4 py-3 border border-gray-300 rounded-xl outline-none"
                                    />
                                </div>
                            </div>

                            {/* Pickup Input - FIXED ICON PLACEMENT */}
                            <div className="relative z-[60] mb-6">
                                <label className="block text-sm text-gray-700 mb-1 font-medium">Pickup Location</label>
                                <div className="flex gap-2">
                                    {/* Search Icon moved outside input wrapper */}
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

                            {/* Dynamic Stops - FIXED ICON PLACEMENT */}
                            <div className="space-y-4 mb-6">
                                <label className="block text-sm text-gray-700 font-medium">Destinations / Stops</label>
                                {stops.map((stop, index) => (
                                    <div key={stop.id} className="relative z-[50]">
                                        <div className="flex gap-2 items-center">
                                            {/* MapPin/Search Icon moved outside input wrapper */}
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
                                <button onClick={optimizeRoute} className="flex items-center gap-2 text-sm text-green-600 font-medium hover:underline"><ArrowDownUp className="w-4 h-4"/> Optimize Route</button>
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

                            <button onClick={() => setCurrentStep(3)} disabled={!pickup.address || stops.some(s => !s.address)} className="w-full py-3 bg-[#2563EB] text-white rounded-xl disabled:opacity-50 hover:bg-[#1E40AF]">
                                Next: Date & Time
                            </button>
                        </div>
                    )}

                    {/* Step 3: Date & Time (Retained) */}
                    {currentStep === 3 && (
                        <div>
                            <h2 className="text-xl text-gray-900 mb-6">Select Date & Time</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                <input type="date" value={bookingDetails.date} onChange={(e) => setBookingDetails({...bookingDetails, date: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-xl" />
                                <input type="time" value={bookingDetails.time} onChange={(e) => setBookingDetails({...bookingDetails, time: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-xl" />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setCurrentStep(2)} className="flex-1 py-3 border border-gray-300 rounded-xl">Back</button>
                                <button onClick={() => setCurrentStep(4)} disabled={!bookingDetails.date || !bookingDetails.time} className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl disabled:opacity-50">Next</button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Vehicle Selection (Updated to filter by passengers AND availability) */}
                    {currentStep === 4 && (
                        <div>
                            <h2 className="text-xl text-gray-900 mb-6">Select Vehicle (Capacity: {passengers}+)</h2>
                            
                            {/* Availability Status / Loader */}
                            <div className={`mb-4 p-3 rounded-xl border ${checkingAvailability ? 'bg-gray-50' : availableVehicles.length === 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                                {checkingAvailability ? (
                                    <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Checking vehicle availability for **{bookingDetails.date}**...</div>
                                ) : (
                                    availableVehicles.length > 0 ? (
                                        `Found ${availableVehicles.length} available vehicle(s) meeting capacity.`
                                    ) : (
                                        `No vehicles available on ${bookingDetails.date} that meet capacity or are free.`
                                    )
                                )}
                            </div>


                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                {availableVehicles.length === 0 && !checkingAvailability ? (
                                    <div className="col-span-full p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-100">
                                        No available vehicles meet the capacity requirement for {passengers} passengers.
                                    </div>
                                ) : (
                                    availableVehicles.map((vehicle) => {
                                        const previewCost = vehicle.ratePerKm ? Math.round(bookingDetails.distanceValueKm * vehicle.ratePerKm) : 0;
                                        return (
                                            <div key={vehicle.id} onClick={() => setBookingDetails({ ...bookingDetails, vehicleId: vehicle.id })} className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${bookingDetails.vehicleId === vehicle.id ? 'border-[#2563EB] bg-blue-50' : 'border-gray-200 hover:border-blue-200'}`}>
                                                <div className="flex justify-between items-start">
                                                    <div><div className="font-bold text-gray-900">{vehicle.model}</div><div className="text-xs text-gray-500">{vehicle.number} / {vehicle.seats} Seats</div></div>
                                                    <div className="text-right"><div className="text-sm font-semibold text-[#2563EB]">LKR {previewCost}</div><div className="text-xs text-gray-500">({vehicle.ratePerKm}/km)</div></div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setCurrentStep(3)} className="flex-1 py-3 border border-gray-300 rounded-xl">Back</button>
                                <button onClick={() => setCurrentStep(5)} disabled={!bookingDetails.vehicleId || checkingAvailability} className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl disabled:opacity-50">Review</button>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Confirm (Updated to show passengers) */}
                    {currentStep === 5 && (
                        <div>
                            <h2 className="text-xl text-gray-900 mb-6">Confirm Booking</h2>
                            <div className="space-y-4 mb-6">
                                <div className="p-4 bg-gray-50 rounded-xl">
                                    <div className="text-sm text-gray-500 mb-1">Route Summary</div>
                                    <div className="font-medium">Start: {pickup.address}</div>
                                    {stops.map((s, i) => (
                                        <div key={s.id} className="text-sm text-gray-600 ml-2 my-1">↓ Stop {i+1}: {s.address}</div>
                                    ))}
                                    <div className="mt-2 text-xs bg-white inline-block px-2 py-1 rounded border">Total: {bookingDetails.distanceText}</div>
                                </div>
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
                                    <span className="text-blue-800 font-medium">Total Estimated Cost</span>
                                    <span className="text-2xl text-[#2563EB] font-bold">LKR {bookingDetails.estimatedCost}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-3 border rounded-lg"><div className="text-xs text-gray-500">Date</div><div>{bookingDetails.date}</div></div>
                                    <div className="p-3 border rounded-lg"><div className="text-xs text-gray-500">Time</div><div>{bookingDetails.time}</div></div>
                                    <div className="p-3 border rounded-lg"><div className="text-xs text-gray-500">Passengers</div><div>{passengers}</div></div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setCurrentStep(4)} className="flex-1 py-3 border border-gray-300 rounded-xl">Back</button>
                                <button onClick={handleBooking} disabled={loading} className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] disabled:opacity-70">
                                    {loading ? 'Submitting...' : 'Confirm Booking'}
                                </button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            {/* MAP PICKER MODAL */}
            {showMapPicker && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
                    <Card className="w-full max-w-3xl p-6 bg-white">
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
                            <button onClick={confirmLocation} disabled={!tempPickedLocation} className="px-6 py-2 bg-[#2563EB] text-white rounded-xl disabled:opacity-50">Confirm</button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}