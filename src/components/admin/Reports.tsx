import { useState, useEffect } from 'react';
import { Download, Mail, Calendar, Car, User as UserIcon, FileText, Edit, X, Check, Banknote, Navigation, ChevronDown, ChevronUp } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, getDocs, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
// PDF Imports
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportsProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

// Helper for Table Route Display (Shared logic)
const RouteCell = ({ pickup, destinations, destination }: { pickup: string, destinations?: string[], destination: string }) => {
  const [expanded, setExpanded] = useState(false);
  
  // If no multi-stop array, just show legacy format
  if (!destinations || destinations.length === 0) {
    return (
      <div>
        <div className="font-medium text-xs text-gray-900">FROM: {pickup}</div>
        <div className="text-xs ml-2 pl-2 border-l border-gray-300">to {destination}</div>
      </div>
    );
  }

  // Show first and last, hide middle if not expanded
  const showAll = expanded || destinations.length <= 2;

  return (
    <div>
      <div className="font-medium text-xs text-gray-900">FROM: {pickup}</div>
      
      {/* Always show first stop */}
      {destinations.length > 0 && (
        <div className="text-xs ml-2 pl-2 border-l-2 border-gray-200 my-1">
          <span className="text-gray-500 font-mono mr-1">1.</span> {destinations[0]}
        </div>
      )}

      {/* Middle Stops */}
      {showAll && destinations.slice(1, -1).map((stop, i) => (
        <div key={i} className="text-xs ml-2 pl-2 border-l-2 border-gray-200 my-1">
          <span className="text-gray-500 font-mono mr-1">{i + 2}.</span> {stop}
        </div>
      ))}

      {!showAll && destinations.length > 2 && (
        <div className="text-xs ml-2 pl-2 border-l-2 border-gray-200 my-1 text-gray-400 italic">
          ... {destinations.length - 2} more stops ...
        </div>
      )}

      {/* Last Stop (if more than 1 stop) */}
      {destinations.length > 1 && (
        <div className="text-xs ml-2 pl-2 border-l-2 border-blue-200 my-1 font-medium">
          <span className="text-blue-600 font-mono mr-1">{destinations.length}.</span> {destinations[destinations.length - 1]}
        </div>
      )}

      {destinations.length > 2 && (
        <button 
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="text-[10px] text-blue-600 flex items-center gap-1 ml-2 mt-1 hover:underline"
        >
          {expanded ? <><ChevronUp className="w-3 h-3"/> Show Less</> : <><ChevronDown className="w-3 h-3"/> View Full Route</>}
        </button>
      )}
    </div>
  );
};

export function Reports({ user, onNavigate, onLogout }: ReportsProps) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ vehicleNumber: '', epfNumber: '', startDate: '', endDate: '' });
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editCostValue, setEditCostValue] = useState('');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const q = query(collection(db, "trip_requests")); 
        const querySnapshot = await getDocs(q);
        setReports(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      } catch (error) { console.error(error); setLoading(false); }
    };
    fetchReports();
  }, []);

  // --- PDF Export Functionality ---
  const handleExportPDF = async () => {
    const doc = new jsPDF();
    
    // --- UPDATED IMAGE PATHS (Matching TripHistory) ---
    const headerImgPath = '/report-header.jpg';
    const footerImgPath = '/report-footer.png';

    // Helper to load image safely
    const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
        try {
            const res = await fetch(imageUrl);
            if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
            const blob = await res.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.warn("Image load error:", error);
            return ""; 
        }
    };

    // Load images as Base64
    const hImgData = await getBase64ImageFromUrl(headerImgPath);
    const fImgData = await getBase64ImageFromUrl(footerImgPath);

    // Get dimensions
    const getImageDims = (base64: string): Promise<{width: number, height: number}> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64;
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.onerror = () => resolve({ width: 0, height: 0 });
        });
    };

    let hImgDims = { width: 0, height: 0 };
    let fImgDims = { width: 0, height: 0 };

    if (hImgData) hImgDims = await getImageDims(hImgData);
    if (fImgData) fImgDims = await getImageDims(fImgData);

    const addHeaderFooter = (data: any) => {
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        
        // --- HEADER (JPG) ---
        if (hImgData && hImgDims.width > 0) {
            try {
                const targetHeight = 20; 
                const targetWidth = (hImgDims.width * targetHeight) / hImgDims.height;
                const xPos = (pageWidth - targetWidth) / 2; 
                doc.addImage(hImgData, 'JPEG', xPos, 5, targetWidth, targetHeight);
            } catch (e) { console.error("Header draw error", e); }
        }
        
        // --- FOOTER (PNG) ---
        if (fImgData && fImgDims.width > 0) {
            try {
                const targetWidth = 190;
                const targetHeight = (fImgDims.height * targetWidth) / fImgDims.width;
                const yPos = pageHeight - targetHeight - 10; 
                const xPos = (pageWidth - targetWidth) / 2;
                doc.addImage(fImgData, 'PNG', xPos, yPos, targetWidth, targetHeight);
            } catch (e) { console.error("Footer draw error", e); }
        }
    };

    doc.setFontSize(18);
    doc.text("Transport Admin Report", 14, 40);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 47);

    const tableData = filteredData.map(trip => {
      // Build Multi-Line Route String for PDF Table
      let routeStr = `START: ${trip.pickup}`;
      if (trip.destinations && trip.destinations.length > 0) {
         trip.destinations.forEach((stop: string, i: number) => { 
             routeStr += `\n${i+1}. ${stop}`; 
         });
      } else {
         routeStr += `\nEND: ${trip.destination}`;
      }

      return [
        trip.serialNumber || trip.id,
        trip.date,
        routeStr, // Full route list
        trip.vehicleNumber || '-',
        trip.driverName || '-',
        trip.epf || '-',
        trip.distance || '-',
        trip.cost || '-'
      ];
    });

    autoTable(doc, {
      head: [['ID', 'Date', 'Route', 'Vehicle', 'Driver', 'EPF', 'Dist', 'Cost']],
      body: tableData,
      startY: 55,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      didDrawPage: addHeaderFooter,
      margin: { top: 35, bottom: 30 },
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' }, // Enable text wrap for long routes
      columnStyles: { 2: { cellWidth: 50 } } // Make Route column wider
    });

    doc.save(`admin-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };
  
  const filteredData = reports.filter((item) => {
    const vehicle = item.vehicleNumber || item.vehicle || '';
    const epf = item.epfNumber || item.epf || '';
    const date = item.date || '';

    if (filters.vehicleNumber && !vehicle.toLowerCase().includes(filters.vehicleNumber.toLowerCase())) return false;
    if (filters.epfNumber && !epf.toLowerCase().includes(filters.epfNumber.toLowerCase())) return false;
    if (filters.startDate && date < filters.startDate) return false;
    if (filters.endDate && date > filters.endDate) return false;
    return true;
  });

  const handleUpdateCost = async (id: string) => {
      const formattedCost = editCostValue.startsWith('LKR') ? editCostValue : `LKR ${editCostValue}`;
      await updateDoc(doc(db, "trip_requests", id), { cost: formattedCost });
      setReports(prev => prev.map(trip => trip.id === id ? { ...trip, cost: formattedCost } : trip));
      setEditingTripId(null);
  };

  // Summary Stats Helpers
  const parseCost = (c: any) => parseFloat((c || '0').toString().replace(/[^0-9.]/g, '')) || 0;
  const parseDist = (d: any) => parseFloat((d || '0').toString().replace(/[^0-9.]/g, '')) || 0;
  
  const totalCost = filteredData.reduce((sum, t) => sum + parseCost(t.cost), 0);
  const totalDist = filteredData.reduce((sum, t) => sum + parseDist(t.distance), 0);

  if (loading) return <div className="p-10 text-center">Loading Reports...</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="reports" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-3xl text-gray-900 mb-2">Reports & Analytics</h1>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <input type="text" value={filters.vehicleNumber} onChange={(e) => setFilters({ ...filters, vehicleNumber: e.target.value })} placeholder="Vehicle Number" className="w-full px-4 py-3 border rounded-xl" />
            <input type="text" value={filters.epfNumber} onChange={(e) => setFilters({ ...filters, epfNumber: e.target.value })} placeholder="EPF Number" className="w-full px-4 py-3 border rounded-xl" />
            <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="w-full px-4 py-3 border rounded-xl" />
            <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="w-full px-4 py-3 border rounded-xl" />
          </div>
           <div className="flex gap-3">
             <button onClick={() => setFilters({ vehicleNumber: '', epfNumber: '', startDate: '', endDate: '' })} className="px-6 py-2 border rounded-xl hover:bg-gray-50">Clear Filters</button>
           </div>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
           <Card className="p-6 flex items-center gap-4">
             <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center"><FileText className="w-6 text-blue-600" /></div>
             <div><div className="text-2xl font-bold">{filteredData.length}</div><div className="text-sm text-gray-500">Total Trips</div></div>
           </Card>
           <Card className="p-6 flex items-center gap-4">
             <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center"><Car className="w-6 text-purple-600" /></div>
             <div><div className="text-2xl font-bold">{totalDist.toFixed(1)} km</div><div className="text-sm text-gray-500">Total Distance</div></div>
           </Card>
           <Card className="p-6 flex items-center gap-4">
             <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center"><Banknote className="w-6 text-green-600" /></div>
             <div><div className="text-2xl font-bold">LKR {totalCost.toLocaleString()}</div><div className="text-sm text-gray-500">Total Cost</div></div>
           </Card>
        </div>

        {/* Report Table */}
        <Card className="overflow-hidden mb-6">
          <div className="p-6 border-b flex justify-between">
            <h2 className="text-lg text-gray-900">Trip Report</h2>
            <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-xl hover:bg-blue-700">
              <Download className="w-4 h-4" /> Export PDF
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase w-64">Route</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredData.map((trip) => (
                  <tr key={trip.id}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{trip.serialNumber || trip.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{trip.date}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                        {/* Use RouteCell Component for nice display */}
                        <RouteCell pickup={trip.pickup} destinations={trip.destinations} destination={trip.destination} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{trip.vehicleNumber}</td>
                    
                    {/* Editable Cost */}
                    <td className="px-6 py-4 text-sm text-green-600 font-bold">
                        {editingTripId === trip.id ? (
                            <div className="flex items-center gap-1">
                                <input className="w-16 border rounded p-1" value={editCostValue} onChange={e => setEditCostValue(e.target.value)} autoFocus />
                                <button onClick={() => handleUpdateCost(trip.id)} className="text-green-600"><Check className="w-4 h-4"/></button>
                                <button onClick={() => setEditingTripId(null)} className="text-red-600"><X className="w-4 h-4"/></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => { setEditCostValue(trip.cost?.replace(/[^0-9.]/g, '') || ''); setEditingTripId(trip.id); }}>
                                {trip.cost || 'LKR 0'} <Edit className="w-3 h-3 opacity-0 group-hover:opacity-100"/>
                            </div>
                        )}
                    </td>
                    <td className="px-6 py-4"><Badge status={trip.status} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredData.length === 0 && <div className="p-12 text-center text-gray-500">No trips found matching the filters</div>}
        </Card>
      </div>
    </div>
  );
}