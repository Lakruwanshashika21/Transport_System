import { useState, useEffect } from 'react';
import { MapPin, Calendar, Clock, Car, Check, Navigation, ArrowRight } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
import { MapComponent } from '../shared/MapComponent';
// Firebase Imports
import { collection, getDocs, addDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { sendTripBookingEmail } from '../../utils/emailService'; // Import Email Service

interface BookVehicleProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

export function BookVehicle({ user, onNavigate, onLogout }: BookVehicleProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculatedDistanceKm, setCalculatedDistanceKm] = useState(0);
  
  const [bookingData, setBookingData] = useState({
    pickup: '',
    destination: '',
    date: '',
    time: '',
    vehicleId: '',
    distanceText: '',
    estimatedCost: 0,
  });

  // 1. Fetch Available Vehicles
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const q = query(collection(db, "vehicles"), where("status", "==", "available"));
        const querySnapshot = await getDocs(q);
        const vehicles = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAvailableVehicles(vehicles);
      } catch (error) {
        console.error("Error fetching vehicles:", error);
      }
    };
    fetchVehicles();
  }, []);

  // 2. Helper: Generate Serial Number (e.g., TRP-001)
  const generateTripSerial = async () => {
    try {
      // Get the most recent trip to find the last number
      const q = query(collection(db, "trip_requests"), orderBy('createdAt', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);
      let nextId = "TRP-001";

      if (!querySnapshot.empty) {
        const lastTrip = querySnapshot.docs[0].data();
        if (lastTrip.serialNumber) {
          // Extract number part (e.g., 001) and increment
          const lastNum = parseInt(lastTrip.serialNumber.split('-')[1]);
          nextId = `TRP-${String(lastNum + 1).padStart(3, '0')}`;
        }
      }
      return nextId;
    } catch (error) {
      console.error("Error generating serial:", error);
      return `TRP-${Date.now().toString().slice(-4)}`; // Fallback ID if sort fails
    }
  };

  // 3. GPS Handler
  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Store coordinates for the map
          const coords = `${position.coords.latitude}, ${position.coords.longitude}`;
          setBookingData({ ...bookingData, pickup: coords });
          alert("Location found!");
        },
        (error) => alert("Error getting location: " + error.message)
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  // 4. Map Callback (Gets distance from Google Maps component)
  const handleDistanceCalculated = (text: string, valueInMeters: number) => {
    const km = valueInMeters / 1000;
    setCalculatedDistanceKm(km);
    setBookingData(prev => ({ ...prev, distanceText: text }));
  };

  // 5. Update Cost Calculation
  useEffect(() => {
    if (bookingData.vehicleId && calculatedDistanceKm > 0) {
      const vehicle = availableVehicles.find(v => v.id === bookingData.vehicleId);
      if (vehicle && vehicle.ratePerKm) {
        const cost = Math.round(calculatedDistanceKm * vehicle.ratePerKm);
        setBookingData(prev => ({ ...prev, estimatedCost: cost }));
      }
    }
  }, [bookingData.vehicleId, calculatedDistanceKm, availableVehicles]);

  // 6. Submit Booking
  const handleBooking = async () => {
    setLoading(true);
    try {
      const serialNumber = await generateTripSerial();

      const tripData = {
        serialNumber: serialNumber, // Save the generated ID
        userId: user.id,
        customer: user.name,
        customerPhone: user.phone || 'N/A',
        email: user.email,
        epf: user.epfNumber || 'N/A',
        
        pickup: bookingData.pickup,
        destination: bookingData.destination,
        date: bookingData.date,
        time: bookingData.time,
        requestedVehicleId: bookingData.vehicleId,
        
        distance: bookingData.distanceText,
        cost: `LKR ${bookingData.estimatedCost}`,
        status: 'pending', // Waiting for Admin Approval
        requestedAt: new Date().toISOString(),
      };

      // Save to Firestore
      await addDoc(collection(db, "trip_requests"), tripData);
      
      // Send Email Notification
      await sendTripBookingEmail(tripData);

      alert(`Booking ${serialNumber} submitted successfully! Admin has been notified.`);
      onNavigate('user-dashboard');
    } catch (error) {
      console.error("Error creating booking:", error);
      alert("Failed to submit booking. Please check your connection.");
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
          <p className="text-gray-600">Schedule your trip in a few simple steps</p>
        </div>

        <Card className="p-6 sm:p-8">
          {/* Step 1 & 2: Route Selection */}
          {(currentStep === 1 || currentStep === 2) && (
            <div>
              <h2 className="text-xl text-gray-900 mb-6">Set Route</h2>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Pickup</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={bookingData.pickup}
                      onChange={(e) => setBookingData({ ...bookingData, pickup: e.target.value })}
                      placeholder="Enter pickup address"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl"
                    />
                    <button onClick={handleUseCurrentLocation} className="p-3 bg-gray-100 rounded-xl">
                      <Navigation className="w-5 h-5 text-[#2563EB]" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Destination</label>
                  <input
                    type="text"
                    value={bookingData.destination}
                    onChange={(e) => setBookingData({ ...bookingData, destination: e.target.value })}
                    placeholder="Enter destination address"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Map Component */}
              <div className="w-full h-80 bg-gray-200 rounded-xl mb-6 overflow-hidden">
                <MapComponent 
                  pickup={bookingData.pickup} 
                  destination={bookingData.destination}
                  onDistanceCalculated={handleDistanceCalculated}
                />
              </div>

              {bookingData.distanceText && (
                <div className="bg-green-50 p-4 rounded-xl mb-6 text-green-800">
                  Route Found: <strong>{bookingData.distanceText}</strong>
                </div>
              )}

              <button 
                onClick={() => setCurrentStep(3)} 
                disabled={!bookingData.pickup || !bookingData.destination} 
                className="w-full py-3 bg-[#2563EB] text-white rounded-xl disabled:opacity-50"
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
                <input 
                  type="date" 
                  value={bookingData.date} 
                  onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })} 
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl" 
                />
                <input 
                  type="time" 
                  value={bookingData.time} 
                  onChange={(e) => setBookingData({ ...bookingData, time: e.target.value })} 
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl" 
                />
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
              <h2 className="text-xl text-gray-900 mb-6">Select Vehicle Preference</h2>
              
              {availableVehicles.length === 0 ? (
                <p className="text-gray-500 mb-6">No specific vehicles available right now. You can proceed, and an Admin will assign one manually.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {availableVehicles.map((vehicle) => (
                    <div 
                      key={vehicle.id} 
                      onClick={() => setBookingData({ ...bookingData, vehicleId: vehicle.id })} 
                      className={`p-4 border-2 rounded-xl cursor-pointer ${bookingData.vehicleId === vehicle.id ? 'border-[#2563EB] bg-blue-50' : 'border-gray-200'}`}
                    >
                      <div className="font-bold">{vehicle.number}</div>
                      <div className="text-sm text-gray-600">{vehicle.model}</div>
                      <div className="text-sm text-[#2563EB] mt-1">Rate: LKR {vehicle.ratePerKm}/km</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setCurrentStep(3)} className="flex-1 py-3 border border-gray-300 rounded-xl">Back</button>
                <button onClick={() => setCurrentStep(5)} className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl">Review</button>
              </div>
            </div>
          )}

          {/* Step 5: Confirmation */}
          {currentStep === 5 && (
            <div>
              <h2 className="text-xl text-gray-900 mb-6">Confirm Booking</h2>
              <div className="space-y-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-sm text-gray-500 mb-1">Route</div>
                  <div>{bookingData.pickup} to {bookingData.destination}</div>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
                  <span className="text-gray-700">Estimated Cost</span>
                  <span className="text-xl text-gray-900 font-bold">LKR {bookingData.estimatedCost}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setCurrentStep(4)} className="flex-1 py-3 border border-gray-300 rounded-xl">Back</button>
                <button onClick={handleBooking} disabled={loading} className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl">
                  {loading ? 'Submitting...' : 'Confirm Booking'}
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}