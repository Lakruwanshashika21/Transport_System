import { useState, useEffect } from 'react';
import { Download, Mail, Calendar, Car, User as UserIcon, FileText, Filter, Edit, X, Check, Banknote } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
// PDF Imports
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportsProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export function Reports({ user, onNavigate, onLogout }: ReportsProps) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    vehicleNumber: '',
    epfNumber: '',
    startDate: '',
    endDate: '',
  });

  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editCostValue, setEditCostValue] = useState('');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const q = query(collection(db, "trip_requests")); 
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setReports(data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching reports:", error);
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  // Update Cost Function
  const handleUpdateCost = async (id: string) => {
    try {
        const formattedCost = editCostValue.startsWith('LKR') ? editCostValue : `LKR ${editCostValue}`;
        const tripRef = doc(db, "trip_requests", id);
        await updateDoc(tripRef, { cost: formattedCost });
        setReports(prev => prev.map(trip => trip.id === id ? { ...trip, cost: formattedCost } : trip));
        setEditingTripId(null);
        setEditCostValue('');
        alert("Cost updated successfully!");
    } catch (error) {
        console.error("Error updating cost:", error);
        alert("Failed to update cost.");
    }
  };

  const startEditing = (trip: any) => {
      const numericCost = (trip.cost || '').toString().replace(/[^0-9.]/g, '');
      setEditCostValue(numericCost);
      setEditingTripId(trip.id);
  };

  // --- PDF with Header & Footer ---
  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    const headerImg = '/report-header.jpg';
    const footerImg = '/report-footer.png';

    const addHeaderFooter = (data: any) => {
        const pageHeight = doc.internal.pageSize.height;
        try { doc.addImage(headerImg, 'JPG', 10, 5, 100, 20); } catch(e) {}
        try { doc.addImage(footerImg, 'PNG', 10, pageHeight - 25, 190, 20); } catch(e) {}
    };

    doc.setFontSize(18);
    doc.text("Transport Trip Report", 14, 40);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 47);

    const tableData = filteredData.map(trip => [
      trip.serialNumber || trip.id,
      trip.date,
      trip.vehicleNumber || '-',
      trip.driverName || '-',
      trip.epf || '-',
      trip.distance || '-',
      trip.cost || '-'
    ]);

    autoTable(doc, {
      head: [['Trip ID', 'Date', 'Vehicle', 'Driver', 'EPF', 'Distance', 'Cost']],
      body: tableData,
      startY: 55,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      didDrawPage: addHeaderFooter,
      margin: { top: 35, bottom: 30 }
    });

    doc.save(`transport-report-${new Date().toISOString().split('T')[0]}.pdf`);
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

  const parseCost = (cost: any) => {
    if (!cost) return 0;
    const numeric = cost.toString().replace(/[^0-9.]/g, '');
    return parseFloat(numeric) || 0;
  };
  const parseDistance = (dist: any) => {
    if (!dist) return 0;
    return parseFloat(dist.toString().replace(/[^0-9.]/g, '') || '0');
  };

  const totalDistance = filteredData.reduce((sum, item) => sum + parseDistance(item.distance), 0);
  const totalCost = filteredData.reduce((sum, item) => sum + parseCost(item.cost), 0);

  if (loading) return <div className="p-10 text-center">Loading Reports...</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="reports" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-3xl text-gray-900 mb-2">Reports & Analytics</h1>
          <p className="text-gray-600">Generate and export trip reports</p>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-8">
          <h2 className="text-lg text-gray-900 mb-4">Report Filters</h2>
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
             <div><div className="text-2xl font-bold">{totalDistance.toFixed(1)} km</div><div className="text-sm text-gray-500">Total Distance</div></div>
          </Card>
          <Card className="p-6 flex items-center gap-4">
             <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center"><Banknote className="w-6 text-green-600" /></div>
             <div><div className="text-2xl font-bold">LKR {totalCost.toLocaleString()}</div><div className="text-sm text-gray-500">Total Cost</div></div>
          </Card>
        </div>

        {/* Report Table */}
        <Card className="overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg text-gray-900">Trip Report</h2>
            <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-xl hover:bg-blue-700">
              <Download className="w-4 h-4" /> Export PDF
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Trip ID</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Date</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Vehicle</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Driver</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">EPF</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Distance</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Cost (LKR)</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredData.map((trip) => (
                  <tr key={trip.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-900">{trip.serialNumber || trip.id}</td>
                    <td className="px-6 py-4 text-gray-600">{trip.date}</td>
                    <td className="px-6 py-4 text-gray-900">{trip.vehicleNumber || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{trip.driverName || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{trip.epfNumber || trip.epf || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{trip.distance || '-'}</td>
                    
                    {/* Cost Column with Inline Editing */}
                    <td className="px-6 py-4 font-medium text-green-600">
                      {editingTripId === trip.id ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            className="w-20 p-1 border rounded text-sm" 
                            value={editCostValue} 
                            onChange={(e) => setEditCostValue(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => handleUpdateCost(trip.id)} className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"><Check className="w-3 h-3"/></button>
                          <button onClick={() => setEditingTripId(null)} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"><X className="w-3 h-3"/></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => startEditing(trip)} title="Click to edit cost">
                          {trip.cost || '0'}
                          <Edit className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100" />
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