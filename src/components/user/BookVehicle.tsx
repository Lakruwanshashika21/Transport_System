import { useState, useEffect, useRef } from 'react';
import { MapPin, Calendar, Clock, Car, Check, Navigation, ArrowRight, Search, Map as MapIcon, X } from 'lucide-react';
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

// Fix Leaflet Marker Icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

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

// Helper: Handle Map Clicks
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
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Search & Location State
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeField, setActiveField] = useState<'pickup' | 'destination' | null>(null);
  
  // Map State
  const [mapCenter, setMapCenter] = useState<[number, number]>([6.9271, 79.8612]); // Colombo
  const [mapZoom, setMapZoom] = useState(12);
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  
  // Map Picker Modal State
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'pickup' | 'destination' | null>(null);
  const [tempPickedLocation, setTempPickedLocation] = useState<{ lat: number, lng: number } | null>(null);

  const [bookingData, setBookingData] = useState({
    pickup: '',
    pickupCoords: null as { lat: number, lon: number } | null,
    destination: '',
    destCoords: null as { lat: number, lon: number } | null,
    date: '',
    time: '',
    vehicleId: '',
    distanceText: '',
    estimatedCost: 0,
  });

  // 1. Fetch Vehicles
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const q = query(collection(db, "vehicles"), where("status", "==", "available"));
        const querySnapshot = await getDocs(q);
        // Ensure ratePerKm is a number
        const data = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          ratePerKm: Number(doc.data().ratePerKm || 0) 
        }));
        setAvailableVehicles(data);
      } catch (error) {
        console.error("Error fetching vehicles:", error);
      }
    };
    fetchVehicles();
  }, []);

  // 2. Search Address (Broader Search for Places/Companies)
  const handleSearch = async (query: string, field: 'pickup' | 'destination') => {
    setBookingData(prev => ({ ...prev, [field]: query }));
    setActiveField(field);

    if (query.length < 3) {
        setSuggestions([]);
        return;
    }

    try {
        // Removed countrycodes to allow broader search, added addressdetails
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=lk&addressdetails=1&limit=5`);
        const data = await response.json();
        setSuggestions(data);
    } catch (error) {
        console.error("Search error:", error);
    }
  };

  const selectSuggestion = (place: any) => {
      if (!activeField) return;
      const lat = parseFloat(place.lat);
      const lon = parseFloat(place.lon);

      // Use display_name or build a shorter name from address details
      const displayName = place.display_name; 

      setBookingData(prev => ({
          ...prev,
          [activeField]: displayName,
          [activeField === 'pickup' ? 'pickupCoords' : 'destCoords']: { lat, lon }
      }));
      
      setMapCenter([lat, lon]);
      setMapZoom(14);
      setSuggestions([]);
      setActiveField(null);

      if (activeField === 'destination' && bookingData.pickupCoords) {
          calculateRoute(bookingData.pickupCoords, { lat, lon });
      } else if (activeField === 'pickup' && bookingData.destCoords) {
          calculateRoute({ lat, lon }, bookingData.destCoords);
      }
  };

  // 3. Calculate Route (OSRM)
  const calculateRoute = async (start: { lat: number, lon: number }, end: { lat: number, lon: number }) => {
      try {
          const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`);
          const data = await response.json();
          
          if (data.routes && data.routes.length > 0) {
              const route = data.routes[0];
              const meters = route.distance;
              const km = (meters / 1000).toFixed(1);
              
              setBookingData(prev => ({ ...prev, distanceText: `${km} km` }));

              // Draw Route
              const coordinates = route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
              setRoutePolyline(coordinates);

              // Center map
              const midIndex = Math.floor(coordinates.length / 2);
              setMapCenter(coordinates[midIndex] as [number, number]);
              setMapZoom(11);
          }
      } catch (error) {
          console.error("Route calc error:", error);
      }
  };

  // 4. Map Picker Logic
  const openMapPicker = (mode: 'pickup' | 'destination') => {
    setPickerMode(mode);
    setTempPickedLocation(null);
    setShowMapPicker(true);
  };

  const onMapClick = (lat: number, lng: number) => {
    setTempPickedLocation({ lat, lng });
  };

  const confirmLocation = async () => {
    if (!tempPickedLocation || !pickerMode) return;
    const { lat, lng } = tempPickedLocation;
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        const address = data.display_name || `Lat: ${lat.toFixed(4)}, Lon: ${lng.toFixed(4)}`;

        setBookingData(prev => ({
            ...prev,
            [pickerMode]: address,
            [pickerMode === 'pickup' ? 'pickupCoords' : 'destCoords']: { lat, lon: lng }
        }));

        // Auto calculate route if we have both points now
        if (pickerMode === 'pickup' && bookingData.destCoords) {
            calculateRoute({ lat, lon: lng }, bookingData.destCoords);
        } else if (pickerMode === 'destination' && bookingData.pickupCoords) {
            calculateRoute(bookingData.pickupCoords, { lat, lon: lng });
        }
    } catch (error) {
        // Fallback
        setBookingData(prev => ({
            ...prev,
            [pickerMode]: `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            [pickerMode === 'pickup' ? 'pickupCoords' : 'destCoords']: { lat, lon: lng }
        }));
    }
    setShowMapPicker(false);
  };

  // 5. GPS Handler
  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          
          try {
             const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
             const data = await response.json();
             const address = data.display_name || "Current Location";

             setBookingData(prev => ({ 
                 ...prev, 
                 pickup: address,
                 pickupCoords: { lat, lon }
             }));
             setMapCenter([lat, lon]);
             setMapZoom(15);
          } catch (e) {
             setBookingData(prev => ({ 
                 ...prev, 
                 pickup: `GPS: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
                 pickupCoords: { lat, lon }
             }));
          }

          if (bookingData.destCoords) {
              calculateRoute({ lat, lon }, bookingData.destCoords);
          }
        },
        (error) => alert("GPS Error: " + error.message)
      );
    }
  };

  // 6. ROBUST COST CALCULATION
  // Trigger this whenever distance or vehicle changes
  useEffect(() => {
    // Extract numeric distance from string "22.9 km" -> 22.9
    const distMatch = (bookingData.distanceText || '').match(/([\d.]+)/);
    const distKm = distMatch ? parseFloat(distMatch[0]) : 0;

    if (bookingData.vehicleId && distKm > 0) {
      const vehicle = availableVehicles.find(v => v.id === bookingData.vehicleId);
      
      // Ensure rate is treated as a number
      const rate = vehicle?.ratePerKm ? Number(vehicle.ratePerKm) : 0;

      if (rate > 0) {
        const cost = Math.round(distKm * rate);
        setBookingData(prev => ({ ...prev, estimatedCost: cost }));
      } else {
        setBookingData(prev => ({ ...prev, estimatedCost: 0 }));
      }
    }
  }, [bookingData.vehicleId, bookingData.distanceText, availableVehicles]);

  // 7. Submit
  const handleBooking = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "trip_requests"), orderBy('createdAt', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);
      let nextId = "TRP-001";
      if (!querySnapshot.empty) {
        const lastTrip = querySnapshot.docs[0].data();
        if (lastTrip.serialNumber) {
          const lastNum = parseInt(lastTrip.serialNumber.split('-')[1]);
          nextId = `TRP-${String(lastNum + 1).padStart(3, '0')}`;
        }
      }

      const tripData = {
        serialNumber: nextId,
        userId: user.id,
        customer: user.name,
        customerPhone: user.phone || 'N/A',
        email: user.email,
        epf: user.epfNumber || 'N/A',
        pickup: bookingData.pickup,
        destination: bookingData.destination,
        pickupCoords: bookingData.pickupCoords,
        destCoords: bookingData.destCoords,
        date: bookingData.date,
        time: bookingData.time,
        requestedVehicleId: bookingData.vehicleId,
        distance: bookingData.distanceText,
        cost: `LKR ${bookingData.estimatedCost}`,
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "trip_requests"), tripData);
      await sendTripBookingEmail(tripData); 

      alert(`Booking ${nextId} submitted successfully!`);
      onNavigate('user-dashboard');
    } catch (error) {
      console.error("Error creating booking:", error);
      alert("Failed to submit booking.");
    } finally {
      setLoading(false);
    }
  };

  const selectedVehicle = availableVehicles.find(v => v.id === bookingData.vehicleId);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="book-vehicle" />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-3xl text-gray-900 mb-2">Book a Vehicle</h1>
          <p className="text-gray-600">Schedule your trip</p>
        </div>

        <Card className="p-6 sm:p-8">
          {/* Step 1 & 2: Route Selection */}
          {(currentStep === 1 || currentStep === 2) && (
            <div>
              <h2 className="text-xl text-gray-900 mb-6">Set Route</h2>
              <div className="space-y-4 mb-6">
                
                {/* Pickup Input */}
                <div className="relative z-50">
                  <label className="block text-sm text-gray-700 mb-1">Pickup</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                       <input
                          type="text"
                          value={bookingData.pickup}
                          onChange={(e) => handleSearch(e.target.value, 'pickup')}
                          placeholder="Search or use map..."
                          className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2563EB] outline-none"
                       />
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                       
                       {/* Suggestions */}
                       {activeField === 'pickup' && suggestions.length > 0 && (
                         <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg max-h-60 overflow-y-auto">
                           {suggestions.map((place, idx) => (
                             <div key={idx} onClick={() => selectSuggestion(place)} className="p-3 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-100 last:border-0">
                               {place.display_name}
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                    <button 
                        onClick={() => openMapPicker('pickup')} 
                        className="p-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100" 
                        title="Choose on Map"
                    >
                      <MapIcon className="w-5 h-5 text-[#2563EB]" />
                    </button>
                    <button onClick={handleUseCurrentLocation} className="p-3 bg-gray-100 border border-gray-200 rounded-xl hover:bg-gray-200" title="Use My Location">
                      <Navigation className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                {/* Destination Input */}
                <div className="relative z-40">
                  <label className="block text-sm text-gray-700 mb-1">Destination</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={bookingData.destination}
                        onChange={(e) => handleSearch(e.target.value, 'destination')}
                        placeholder="Search or use map..."
                        className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2563EB] outline-none"
                      />
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500 pointer-events-none" />
                       
                       {activeField === 'destination' && suggestions.length > 0 && (
                         <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg max-h-60 overflow-y-auto">
                           {suggestions.map((place, idx) => (
                             <div key={idx} onClick={() => selectSuggestion(place)} className="p-3 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-100 last:border-0">
                               {place.display_name}
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                    <button 
                        onClick={() => openMapPicker('destination')}
                        className="p-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100"
                        title="Choose on Map"
                    >
                      <MapIcon className="w-5 h-5 text-[#2563EB]" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Leaflet Map (Read-Only View of Route) */}
              <div className="w-full h-80 bg-gray-100 rounded-xl mb-6 overflow-hidden border border-gray-200 relative z-0">
                <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }}>
                  <ChangeView center={mapCenter} zoom={mapZoom} />
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {/* Markers */}
                  {bookingData.pickupCoords && (
                    <Marker position={[bookingData.pickupCoords.lat, bookingData.pickupCoords.lon]}>
                       <Popup>Pickup: {bookingData.pickup}</Popup>
                    </Marker>
                  )}
                  {bookingData.destCoords && (
                    <Marker position={[bookingData.destCoords.lat, bookingData.destCoords.lon]}>
                       <Popup>Destination: {bookingData.destination}</Popup>
                    </Marker>
                  )}

                  {/* Route Line */}
                  {routePolyline.length > 0 && (
                      <Polyline positions={routePolyline} color="blue" />
                  )}
                </MapContainer>
              </div>

              {bookingData.distanceText && (
                <div className="bg-green-50 p-4 rounded-xl mb-6 text-green-800 border border-green-100 flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  <span>Route Distance: <strong>{bookingData.distanceText}</strong></span>
                </div>
              )}

              <button 
                onClick={() => setCurrentStep(3)} 
                disabled={!bookingData.pickup || !bookingData.destination} 
                className="w-full py-3 bg-[#2563EB] text-white rounded-xl disabled:opacity-50 hover:bg-[#1E40AF] transition-all"
              >
                Next: Date & Time
              </button>
            </div>
          )}

          {/* Step 3: Date & Time */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-xl text-gray-900 mb-6">Select Date & Time</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <input type="date" value={bookingData.date} onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl" />
                <input type="time" value={bookingData.time} onChange={(e) => setBookingData({ ...bookingData, time: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setCurrentStep(2)} className="flex-1 py-3 border border-gray-300 rounded-xl">Back</button>
                <button onClick={() => setCurrentStep(4)} className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl">Next</button>
              </div>
            </div>
          )}

          {/* Step 4: Vehicle Selection */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-xl text-gray-900 mb-6">Select Vehicle</h2>
              {availableVehicles.length === 0 ? (
                <p className="text-gray-500 mb-6">No specific vehicles available. Proceed to assign later.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {availableVehicles.map((vehicle) => {
                     // Calculate preview cost
                     const rate = Number(vehicle.ratePerKm || 0);
                     const distMatch = (bookingData.distanceText || '').match(/([\d.]+)/);
                     const distKm = distMatch ? parseFloat(distMatch[0]) : 0;
                     const previewCost = Math.round(distKm * rate);
                     
                     return (
                      <div 
                        key={vehicle.id} 
                        onClick={() => setBookingData({ ...bookingData, vehicleId: vehicle.id })} 
                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${bookingData.vehicleId === vehicle.id ? 'border-[#2563EB] bg-blue-50' : 'border-gray-200 hover:border-blue-200'}`}
                      >
                        <div className="flex justify-between items-start">
                           <div>
                              <div className="font-bold text-gray-900">{vehicle.model}</div>
                              <div className="text-xs text-gray-500">{vehicle.number}</div>
                           </div>
                           <div className="text-right">
                              <div className="text-sm font-semibold text-[#2563EB]">LKR {previewCost}</div>
                              <div className="text-xs text-gray-500">({rate}/km)</div>
                           </div>
                        </div>
                        <div className="mt-3 text-xs text-gray-600 flex gap-2">
                           <span className="px-2 py-1 bg-gray-100 rounded">{vehicle.type}</span>
                           <span className="px-2 py-1 bg-gray-100 rounded">{vehicle.seats} Seats</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setCurrentStep(3)} className="flex-1 py-3 border border-gray-300 rounded-xl">Back</button>
                <button onClick={() => setCurrentStep(5)} className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl">Review</button>
              </div>
            </div>
          )}

          {/* Step 5: Confirm */}
          {currentStep === 5 && (
            <div>
              <h2 className="text-xl text-gray-900 mb-6">Confirm Booking</h2>
              <div className="space-y-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-sm text-gray-500 mb-1">Route</div>
                  <div className="font-medium">{bookingData.pickup}</div>
                  <div className="text-gray-400 text-xs my-1">to</div>
                  <div className="font-medium">{bookingData.destination}</div>
                  <div className="mt-2 text-xs bg-white inline-block px-2 py-1 rounded border">Distance: {bookingData.distanceText}</div>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
                  <div>
                    <div className="text-blue-800 font-medium">Total Estimated Cost</div>
                    <div className="text-blue-600 text-xs">Based on vehicle rate & distance</div>
                  </div>
                  <span className="text-2xl text-[#2563EB] font-bold">LKR {bookingData.estimatedCost}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-3 border rounded-lg"><div className="text-xs text-gray-500">Date</div><div>{bookingData.date}</div></div>
                   <div className="p-3 border rounded-lg"><div className="text-xs text-gray-500">Time</div><div>{bookingData.time}</div></div>
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

      {/* MAP PICKER MODAL - Using Key to Force Re-render */}
      {showMapPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl p-6 bg-white">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-semibold">
                 Choose Location on Map
               </h3>
               <button onClick={() => setShowMapPicker(false)} className="p-2 hover:bg-gray-100 rounded-full">
                 <X className="w-6 h-6" />
               </button>
             </div>
             
             {/* Added key prop here to force re-mount when modal opens */}
             <div className="h-[400px] border rounded-xl overflow-hidden mb-4 relative">
                <MapContainer key={showMapPicker ? "open" : "closed"} center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationMarker onLocationSelect={onMapClick} />
                  {tempPickedLocation && (
                    <Marker position={[tempPickedLocation.lat, tempPickedLocation.lng]}>
                       <Popup>Selected</Popup>
                    </Marker>
                  )}
                </MapContainer>
                <div className="absolute bottom-4 right-4 bg-white px-3 py-1 rounded shadow text-xs z-[1000]">
                    Click to Drop Pin
                </div>
             </div>

             <div className="flex justify-between items-center">
               <div className="text-sm text-gray-600">
                  {tempPickedLocation 
                    ? `Lat: ${tempPickedLocation.lat.toFixed(4)}, Lon: ${tempPickedLocation.lng.toFixed(4)}`
                    : "No location selected"}
               </div>
               <div className="flex gap-2">
                 <button onClick={() => setShowMapPicker(false)} className="px-4 py-2 border rounded-xl">Cancel</button>
                 <button 
                   onClick={confirmLocation} 
                   disabled={!tempPickedLocation}
                   className="px-6 py-2 bg-[#2563EB] text-white rounded-xl disabled:opacity-50"
                 >
                   Confirm
                 </button>
               </div>
             </div>
          </Card>
        </div>
      )}
    </div>
  );
}