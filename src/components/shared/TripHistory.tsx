import { useState, useEffect } from 'react';
import { Search, Calendar, Car, User as UserIcon, MapPin, Download, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from './TopNav';
import { Card } from './Card';
import { Badge } from './Badge';
// Firebase Imports
import { collection, getDocs, query, where } from 'firebase/firestore'; 
import { db } from '../../firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TripHistoryProps {
  user: User;
  onNavigate: (screen: string, tripId?: string) => void;
  onLogout: () => void;
}

// Helper Component for Route Display
const RouteDisplay = ({ pickup, destinations, destination }: { pickup: string, destinations?: string[], destination: string }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (!destinations || destinations.length === 0) {
    return (
      <div className="space-y-1">
         <div className="flex items-start gap-2">
            <MapPin className="w-3 h-3 text-green-600 mt-1 shrink-0" />
            <span className="text-sm text-gray-900">{pickup}</span>
         </div>
         <div className="ml-1.5 border-l border-gray-300 pl-4 py-1"></div>
         <div className="flex items-start gap-2">
            <MapPin className="w-3 h-3 text-blue-600 mt-1 shrink-0" />
            <span className="text-sm text-gray-900">{destination}</span>
         </div>
      </div>
    );
  }

  const allPoints = [pickup, ...destinations];
  const showAll = expanded || allPoints.length <= 3;

  return (
    <div className="space-y-0">
       <div className="flex items-start gap-2">
          <div className="flex flex-col items-center mt-1">
             <div className="w-2 h-2 bg-green-600 rounded-full"/>
             <div className="w-0.5 h-full bg-gray-200 min-h-[16px]"/>
          </div>
          <span className="text-sm text-gray-900">{allPoints[0]}</span>
       </div>

       {showAll && allPoints.slice(1, -1).map((stop, i) => (
          <div key={i} className="flex items-start gap-2">
             <div className="flex flex-col items-center">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full border border-white shadow-sm"/>
                <div className="w-0.5 h-full bg-gray-200 min-h-[16px]"/>
             </div>
             <span className="text-xs text-gray-600 pt-0.5">{stop}</span>
          </div>
       ))}

       {!showAll && (
          <div className="pl-5 py-1">
             <button 
               onClick={(e) => { e.stopPropagation(); setExpanded(true); }} 
               className="text-[10px] text-blue-600 hover:underline bg-blue-50 px-2 py-0.5 rounded-full w-fit flex items-center gap-1"
             >
               <ChevronDown className="w-3 h-3"/> +{allPoints.length - 2} stops
             </button>
          </div>
       )}

       <div className="flex items-start gap-2">
          <div className="flex flex-col items-center">
             {!showAll && <div className="w-0.5 h-2 bg-gray-200 -mt-2 mb-0.5"/>}
             <div className="w-2 h-2 bg-blue-600 rounded-full"/>
          </div>
          <span className="text-sm text-gray-900 font-medium">{allPoints[allPoints.length - 1]}</span>
       </div>
       
       {expanded && allPoints.length > 3 && (
          <div className="pl-4 mt-1">
             <button 
                onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
                className="text-[10px] text-gray-500 hover:underline flex items-center gap-1"
             >
                <ChevronUp className="w-3 h-3"/> Show Less
             </button>
          </div>
       )}
    </div>
  );
};

export function TripHistory({ user, onNavigate, onLogout }: TripHistoryProps) {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    vehicleNumber: '',
    epfNumber: '',
    dateRange: '',
  });
  const [selectedTrip, setSelectedTrip] = useState<any>(null);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        let q;
        const tripsRef = collection(db, "trip_requests");

        if (user.role === 'admin') {
          q = query(tripsRef); 
        } else if (user.role === 'driver') {
          q = query(tripsRef, where('driverId', '==', user.id));
        } else {
          q = query(tripsRef, where('userId', '==', user.id));
        }

        const querySnapshot = await getDocs(q);
        const fetchedTrips = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        fetchedTrips.sort((a: any, b: any) => {
            const timeA = new Date(a.requestedAt || a.date).getTime() || 0;
            const timeB = new Date(b.requestedAt || b.date).getTime() || 0;
            return timeB - timeA; 
        });

        setTrips(fetchedTrips);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching trip history:", error);
        setLoading(false);
      }
    };

    fetchTrips();
  }, [user]);

  const filteredTrips = trips.filter((trip) => {
    const vehicle = trip.vehicleNumber || trip.vehicle || '';
    const epf = trip.epfNumber || trip.epf || '';
    
    if (filters.vehicleNumber && !vehicle.toLowerCase().includes(filters.vehicleNumber.toLowerCase())) return false;
    if (filters.epfNumber && !epf.toLowerCase().includes(filters.epfNumber.toLowerCase())) return false;
    if (filters.dateRange && trip.date !== filters.dateRange) return false;
    
    return true;
  });

  // --- PDF Export Functionality (Robust) ---
  const handleDownloadPDF = async (trip: any) => {
      try {
        console.log("Generating PDF for trip:", trip.id);
        const doc = new jsPDF();
        
        // Helper: Convert Image URL to Base64
        const getBase64ImageFromUrl = async (imageUrl: string) => {
            const res = await fetch(imageUrl);
            const blob = await res.blob();
            return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.addEventListener("load", () => {
                    resolve(reader.result as string);
                }, false);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
            });
        };

        // 1. Load Images as Base64 Data URLs
        let hImgData: string | null = null;
        let fImgData: string | null = null;
        let hImgDims = { width: 0, height: 0 };
        let fImgDims = { width: 0, height: 0 };

        try {
            // Use absolute paths or imported images if possible. For public folder:
            hImgData = await getBase64ImageFromUrl('/report-header.jpg');
            
            // Get dimensions to calculate ratio
            const img = new Image();
            img.src = hImgData;
            await new Promise(r => img.onload = r);
            hImgDims = { width: img.width, height: img.height };
        } catch (e) { console.warn("Header image failed to load", e); }

        try {
            fImgData = await getBase64ImageFromUrl('/report-footer.png');
            
            const img = new Image();
            img.src = fImgData;
            await new Promise(r => img.onload = r);
            fImgDims = { width: img.width, height: img.height };
        } catch (e) { console.warn("Footer image failed to load", e); }


        // 2. Define Draw Function
        const addHeaderFooter = (data: any) => {
            const pageWidth = doc.internal.pageSize.width; // 210mm
            const pageHeight = doc.internal.pageSize.height; // 297mm
            
            // --- HEADER ---
            if (hImgData && hImgDims.width > 0) {
                // Target height ~25mm, calculate width to keep ratio
                // Ratio = W / H
                const ratio = hImgDims.width / hImgDims.height;
                const targetHeight = 25;
                const targetWidth = targetHeight * ratio;
                
                // Center it: (PageWidth - ImageWidth) / 2
                const xPos = (pageWidth - targetWidth) / 2;
                
                doc.addImage(hImgData, 'JPEG', xPos, 5, targetWidth, targetHeight);
            }
            
            // --- FOOTER ---
            if (fImgData && fImgDims.width > 0) {
                 // Target width = PageWidth (210mm), calculate height
                 const ratio = fImgDims.height / fImgDims.width;
                 const targetWidth = pageWidth;
                 const targetHeight = targetWidth * ratio;

                 // Place at bottom
                 // Ensure we don't go off page if ratio is weird, cap height at 30mm
                 const finalHeight = Math.min(targetHeight, 30); 
                 const finalWidth = finalHeight / ratio;
                 
                 // Center footer if we had to cap height, otherwise full width
                 const xPos = (pageWidth - finalWidth) / 2;
                 const yPos = pageHeight - finalHeight - 5; // 5mm padding from bottom edge

                 doc.addImage(fImgData, 'PNG', xPos, yPos, finalWidth, finalHeight);
            }
        };

        // 3. Content
        // Move content down to Y=45 to clear header
        doc.setFontSize(16);
        doc.text(`Trip Receipt #${trip.serialNumber || trip.id}`, 14, 45);
        
        doc.setFontSize(10);
        doc.text(`Date: ${trip.date}`, 14, 52);
        doc.text(`Status: ${trip.status ? trip.status.toUpperCase() : 'UNKNOWN'}`, 14, 58);

        const rows = [
            ['Customer', trip.customerName || trip.customer || '-'],
            ['EPF Number', trip.epfNumber || trip.epf || '-'],
            ['Pickup', trip.pickup || '-'],
            ['Destination', trip.destination || '-'],
            ['Vehicle', trip.vehicleNumber || 'Not Assigned'],
            ['Driver', trip.driverName || 'Not Assigned'],
            ['Distance', trip.distance || '-'],
            ['Total Cost', trip.cost || '-']
        ];

        if(trip.destinations && trip.destinations.length > 0) {
            trip.destinations.forEach((stop: string, i: number) => {
                rows.splice(4 + i, 0, [`Stop ${i+1}`, stop]);
            });
        }

        autoTable(doc, {
            startY: 65,
            head: [['Item', 'Details']],
            body: rows,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235] },
            didDrawPage: addHeaderFooter,
            margin: { top: 40, bottom: 35 } 
        });

        doc.save(`Trip_${trip.serialNumber || trip.id}.pdf`);
        
      } catch (error: any) {
          console.error("PDF Generation Error:", error);
          alert("Failed to generate PDF. Check console for details.");
      }
  };

  if (loading) return <div className="p-10 text-center">Loading Trip History...</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="trip-history" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-3xl text-gray-900 mb-2">Trip History</h1>
          <p className="text-gray-600">View and search past trips</p>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg text-gray-900">Search Filters</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">Vehicle Number</label>
              <div className="relative">
                <input type="text" value={filters.vehicleNumber} onChange={(e) => setFilters({ ...filters, vehicleNumber: e.target.value })} placeholder="CAB-2345" className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl" />
                <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>

            {user.role !== 'user' && (
              <div>
                <label className="block text-sm text-gray-700 mb-2">EPF Number</label>
                <div className="relative">
                  <input type="text" value={filters.epfNumber} onChange={(e) => setFilters({ ...filters, epfNumber: e.target.value })} placeholder="EPF12345" className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl" />
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-700 mb-2">Date</label>
              <div className="relative">
                <input type="date" value={filters.dateRange} onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })} className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl" />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>

          {(filters.vehicleNumber || filters.epfNumber || filters.dateRange) && (
            <button onClick={() => setFilters({ vehicleNumber: '', epfNumber: '', dateRange: '' })} className="mt-4 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50">
              Clear Filters
            </button>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trip List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="text-sm text-gray-600 mb-4">Showing {filteredTrips.length} trip{filteredTrips.length !== 1 ? 's' : ''}</div>

            {filteredTrips.map((trip) => (
              <Card key={trip.id} onClick={() => setSelectedTrip(trip)} className={`p-6 cursor-pointer transition-all ${selectedTrip?.id === trip.id ? 'ring-2 ring-[#2563EB]' : ''}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-lg text-gray-900 mb-1">Trip #{trip.serialNumber || trip.id}</div>
                    <div className="flex items-center gap-3">
                      <Badge status={trip.status} size="sm" />
                      <div className="text-sm text-gray-600">{trip.date} • {trip.time}</div>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDownloadPDF(trip); }} className="p-2 hover:bg-gray-100 rounded-lg" title="Download Receipt">
                    <Download className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Route Display */}
                  <div className="space-y-2">
                    <RouteDisplay pickup={trip.pickup} destinations={trip.destinations} destination={trip.destination} />
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-gray-500">Vehicle:</span>
                      <span className="text-gray-900 ml-2">{trip.vehicleNumber || trip.vehicle || 'Pending'}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Driver:</span>
                      <span className="text-gray-900 ml-2">{trip.driverName || trip.driver || 'Pending'}</span>
                    </div>
                    {user.role !== 'user' && (
                      <div className="text-sm">
                        <span className="text-gray-500">Customer:</span>
                        <span className="text-gray-900 ml-2">{trip.customerName || trip.customer}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            {filteredTrips.length === 0 && (
              <Card className="p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No trips found matching your filters</p>
              </Card>
            )}
          </div>

          {/* Trip Details Sidebar */}
          <div className="lg:col-span-1">
            {selectedTrip ? (
              <Card className="p-6 sticky top-24">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg text-gray-900">Trip Details</h2>
                  <Badge status={selectedTrip.status} />
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">Trip ID</div>
                    <div className="text-gray-900">{selectedTrip.serialNumber || selectedTrip.id}</div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-xs text-gray-500 mb-2">Full Route</div>
                    <RouteDisplay pickup={selectedTrip.pickup} destinations={selectedTrip.destinations} destination={selectedTrip.destination} />
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">Vehicle</div>
                    <div className="text-gray-900">{selectedTrip.vehicleNumber || selectedTrip.vehicle || 'Not assigned'}</div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">Driver</div>
                    <div className="text-gray-900">{selectedTrip.driverName || selectedTrip.driver || 'Not assigned'}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="text-xs text-gray-500 mb-1">Distance</div>
                      <div className="text-gray-900">{selectedTrip.distance || '-'}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="text-xs text-gray-500 mb-1">Cost</div>
                      <div className="text-gray-900 font-bold text-green-600">{selectedTrip.cost || '-'}</div>
                    </div>
                  </div>
                </div>

                <button onClick={() => handleDownloadPDF(selectedTrip)} className="w-full mt-6 flex items-center justify-center gap-2 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all">
                  <Download className="w-5 h-5" /> Download PDF
                </button>
              </Card>
            ) : (
              <Card className="p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Select a trip to view details</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}