import { useState, useEffect } from 'react';
import { MapPin, User as UserIcon, Phone, Navigation, Play, Square, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
// Firebase Imports
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface DriverTripDetailProps {
  user: User;
  tripId: string | null;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

// Helper Component for Collapsible Stops
const DriverStopList = ({ destinations, finalDestination }: { destinations?: string[], finalDestination: string }) => {
  const [expanded, setExpanded] = useState(false);

  // Legacy support: if no destinations array, just show single destination
  if (!destinations || destinations.length === 0) {
    return (
       <div className="flex gap-4">
          <div className="flex flex-col items-center">
             <div className="w-3 h-3 bg-red-500 rounded-full"/>
          </div>
          <div>
             <div className="text-xs text-gray-500 uppercase">Drop-off</div>
             <div className="text-gray-900 font-medium">{finalDestination}</div>
          </div>
       </div>
    );
  }

  // Combine intermediate stops + final destination for display list
  // Assuming 'destinations' in DB might contain all stops including final
  // or just intermediate. We'll treat the last one as final if needed.
  // Based on BookVehicle logic: 'destinations' contains all stops.
  
  const allStops = [...destinations];

  // If few stops, show all
  if (allStops.length <= 3) {
      return (
        <>
          {allStops.map((stop, i) => (
             <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                   {/* If it's the last stop, make it Red, else Blue */}
                   <div className={`w-3 h-3 rounded-full ${i === allStops.length - 1 ? 'bg-red-500' : 'bg-blue-500 border-2 border-white shadow-sm'}`}/>
                   {i !== allStops.length - 1 && <div className="w-0.5 h-full bg-gray-200"/>}
                </div>
                <div>
                   <div className="text-xs text-gray-500 uppercase">{i === allStops.length - 1 ? 'Drop-off' : `Stop ${i + 1}`}</div>
                   <div className="text-gray-900">{stop}</div>
                </div>
             </div>
          ))}
        </>
      );
  }

  // If many stops, collapse middle ones
  return (
    <>
      {/* First Stop */}
      <div className="flex gap-4">
          <div className="flex flex-col items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm"/>
              <div className="w-0.5 h-full bg-gray-200"/>
          </div>
          <div>
              <div className="text-xs text-gray-500 uppercase">Stop 1</div>
              <div className="text-gray-900">{allStops[0]}</div>
          </div>
      </div>

      {/* Expanded Middle Stops */}
      {expanded && allStops.slice(1, -1).map((stop, i) => (
         <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
               <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm"/>
               <div className="w-0.5 h-full bg-gray-200"/>
            </div>
            <div>
               <div className="text-xs text-gray-500 uppercase">Stop {i + 2}</div>
               <div className="text-gray-900">{stop}</div>
            </div>
         </div>
      ))}

      {/* Toggle Button */}
      {!expanded && (
        <div className="pl-7 my-2">
           <button 
             onClick={() => setExpanded(true)} 
             className="text-sm text-blue-600 flex items-center gap-1 hover:underline"
           >
             <ChevronDown className="w-4 h-4" />
             Show {allStops.length - 2} intermediate stops
           </button>
           <div className="ml-[5px] w-0.5 h-4 bg-gray-200 -mt-1 mb-1"></div>
        </div>
      )}

      {/* Last Stop */}
      <div className="flex gap-4">
          <div className="flex flex-col items-center">
              <div className="w-3 h-3 bg-red-500 rounded-full"/>
          </div>
          <div>
              <div className="text-xs text-gray-500 uppercase">Drop-off</div>
              <div className="text-gray-900 font-medium">{allStops[allStops.length - 1]}</div>
          </div>
      </div>

      {expanded && (
         <div className="pl-7 mt-2">
           <button onClick={() => setExpanded(false)} className="text-sm text-gray-500 flex items-center gap-1 hover:underline">
             <ChevronUp className="w-4 h-4" /> Show Less
           </button>
         </div>
      )}
    </>
  );
};

export function DriverTripDetail({ user, tripId, onNavigate, onLogout }: DriverTripDetailProps) {
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);

  // 1. Fetch Trip Data
  useEffect(() => {
    const fetchTrip = async () => {
      if (!tripId) return;

      try {
        const docRef = doc(db, "trip_requests", tripId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setTrip(data);
          
          if (data.status === 'completed') {
            setShowSummary(true);
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
  }, [tripId, onNavigate]);

  // 2. Handlers
  const handleStartTrip = async () => {
    if (!trip) return;
    try {
      const tripRef = doc(db, "trip_requests", trip.id);
      await updateDoc(tripRef, {
        status: 'in-progress',
        startedAt: new Date().toISOString()
      });
      
      setTrip((prev: any) => ({ ...prev, status: 'in-progress' }));
      alert('Trip started! GPS tracking enabled.');
    } catch (error) {
      console.error("Error starting trip:", error);
      alert("Failed to start trip. Please try again.");
    }
  };

  const handleEndTrip = async () => {
    if (!trip) return;
    try {
      const tripRef = doc(db, "trip_requests", trip.id);
      await updateDoc(tripRef, {
        status: 'completed',
        endedAt: new Date().toISOString()
      });

      if (trip.vehicleId) {
        const vehicleRef = doc(db, "vehicles", trip.vehicleId);
        await updateDoc(vehicleRef, { status: 'available' });
      }
      if (user.id) {
         const userRef = doc(db, "users", user.id);
         await updateDoc(userRef, { status: 'available' });
      }

      setTrip((prev: any) => ({ ...prev, status: 'completed' }));
      setShowSummary(true);
    } catch (error) {
      console.error("Error ending trip:", error);
      alert("Failed to end trip. Please try again.");
    }
  };

  const handleCompleteSummary = () => {
    onNavigate('driver-dashboard');
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;
  if (!trip) return <div className="p-10 text-center">Trip not found</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6">
          <button onClick={() => onNavigate('driver-dashboard')} className="text-[#2563EB] mb-4">← Back</button>
          <h1 className="text-3xl text-gray-900">Trip #{trip.serialNumber || trip.id}</h1>
        </div>

        {!showSummary ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <div className="lg:col-span-2 space-y-6">
                  {/* Route Details Card */}
                  <Card className="p-6">
                     <h2 className="text-lg font-bold mb-4">Route</h2>
                     <div className="space-y-0">
                        {/* Pickup */}
                        <div className="flex gap-4">
                           <div className="flex flex-col items-center">
                              <div className="w-3 h-3 bg-green-500 rounded-full"/>
                              <div className="w-0.5 h-full bg-gray-200"/>
                           </div>
                           <div>
                              <div className="text-xs text-gray-500 uppercase">Pickup</div>
                              <div className="text-gray-900 font-medium">{trip.pickup}</div>
                           </div>
                        </div>

                        {/* Collapsible Stop List */}
                        <DriverStopList destinations={trip.destinations} finalDestination={trip.destination} />
                     </div>
                  </Card>

                  {/* Actions Card */}
                  <Card className="p-6">
                     <h2 className="text-lg font-bold mb-4">Actions</h2>
                     {trip.status === 'approved' && (
                        <button onClick={handleStartTrip} className="w-full py-4 bg-green-600 text-white rounded-xl flex justify-center gap-2 hover:bg-green-700 transition-all">
                           <Play className="w-5 h-5" /> Start Trip
                        </button>
                     )}
                     {trip.status === 'in-progress' && (
                        <button onClick={handleEndTrip} className="w-full py-4 bg-red-600 text-white rounded-xl flex justify-center gap-2 hover:bg-red-700 transition-all">
                           <Square className="w-5 h-5" /> End Trip
                        </button>
                     )}
                     {trip.status === 'completed' && (
                        <div className="w-full py-4 bg-gray-100 text-green-700 rounded-xl flex justify-center gap-2 font-bold">
                           <CheckCircle className="w-5 h-5" /> Trip Completed
                        </div>
                     )}
                  </Card>
               </div>

               {/* Customer Card */}
               <div className="space-y-6">
                  <Card className="p-6">
                     <h2 className="text-lg font-bold mb-4">Customer</h2>
                     <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center"><UserIcon className="w-6 h-6 text-gray-500"/></div>
                        <div>
                           <div className="font-bold">{trip.customer || trip.customerName}</div>
                           <div className="text-sm text-gray-500">{trip.epf || trip.epfNumber}</div>
                        </div>
                     </div>
                     <a href={`tel:${trip.customerPhone || trip.phone}`} className="flex items-center justify-center gap-2 w-full py-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all">
                        <Phone className="w-4 h-4"/> Call Customer
                     </a>
                  </Card>
               </div>
            </div>
        ) : (
            <Card className="p-8 max-w-2xl mx-auto text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                   <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Trip Completed</h2>
                <button onClick={handleCompleteSummary} className="mt-6 w-full py-3 bg-[#2563EB] text-white rounded-xl">Back to Dashboard</button>
            </Card>
        )}
      </div>
    </div>
  );
}