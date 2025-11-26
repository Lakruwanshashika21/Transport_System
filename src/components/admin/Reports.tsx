import { useState, useEffect } from 'react';
import { Download, Mail, Calendar, Car, User as UserIcon, FileText } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';

interface ReportsProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export function Reports({ user, onNavigate, onLogout }: ReportsProps) {
  // 1. State
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    vehicleNumber: '',
    epfNumber: '',
    startDate: '',
    endDate: '',
  });

  // 2. Fetch Data
  useEffect(() => {
    const fetchReports = async () => {
      try {
        // Fetch all trip requests
        const q = query(collection(db, "trip_requests"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setReports(data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching reports:", error);
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  // 3. Filter Logic
  const filteredData = reports.filter((item) => {
    // Handle potential field name differences (e.g. vehicle vs vehicleNumber)
    const vehicle = item.vehicleNumber || item.vehicle || '';
    const epf = item.epfNumber || item.epf || '';
    const date = item.date || '';

    if (filters.vehicleNumber && !vehicle.toLowerCase().includes(filters.vehicleNumber.toLowerCase())) return false;
    if (filters.epfNumber && !epf.toLowerCase().includes(filters.epfNumber.toLowerCase())) return false;
    if (filters.startDate && date < filters.startDate) return false;
    if (filters.endDate && date > filters.endDate) return false;
    return true;
  });

  // 4. Calculations
  const parseCost = (cost: any) => {
    if (typeof cost === 'number') return cost;
    if (typeof cost === 'string') return parseInt(cost.replace(/[^0-9]/g, '') || '0');
    return 0;
  };

  const parseDistance = (dist: any) => {
    if (typeof dist === 'number') return dist;
    if (typeof dist === 'string') return parseFloat(dist.replace(/[^0-9.]/g, '') || '0');
    return 0;
  };

  const totalDistance = filteredData.reduce((sum, item) => sum + parseDistance(item.distance), 0);
  const totalCost = filteredData.reduce((sum, item) => sum + parseCost(item.cost), 0);

  const handleExportPDF = () => {
    alert('Report exported as PDF successfully!');
  };

  const handleSendEmail = () => {
    alert('Report sent via email successfully!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-gray-500">Loading Reports...</div>
      </div>
    );
  }

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
            <div>
              <label className="block text-sm text-gray-700 mb-2">Vehicle Number</label>
              <div className="relative">
                <input
                  type="text"
                  value={filters.vehicleNumber}
                  onChange={(e) => setFilters({ ...filters, vehicleNumber: e.target.value })}
                  placeholder="CAB-2345"
                  className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">EPF Number</label>
              <div className="relative">
                <input
                  type="text"
                  value={filters.epfNumber}
                  onChange={(e) => setFilters({ ...filters, epfNumber: e.target.value })}
                  placeholder="EPF12345"
                  className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Start Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">End Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setFilters({ vehicleNumber: '', epfNumber: '', startDate: '', endDate: '' })}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
            >
              Clear Filters
            </button>
          </div>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">{filteredData.length}</div>
                <div className="text-sm text-gray-500">Total Trips</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Car className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">{totalDistance.toFixed(1)} km</div>
                <div className="text-sm text-gray-500">Total Distance</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">LKR {totalCost.toLocaleString()}</div>
                <div className="text-sm text-gray-500">Total Cost</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Report Table */}
        <Card className="overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg text-gray-900">Trip Report</h2>
            <div className="flex gap-3">
              <button
                onClick={handleSendEmail}
                className="flex items-center gap-2 px-4 py-2 border border-[#2563EB] text-[#2563EB] rounded-xl hover:bg-blue-50 transition-all"
              >
                <Mail className="w-4 h-4" />
                Send Email
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Trip ID</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Date</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Vehicle</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Driver</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">User</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">EPF</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Distance</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Cost</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredData.map((trip) => (
                  <tr key={trip.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-900">{trip.id}</td>
                    <td className="px-6 py-4 text-gray-600">{trip.date}</td>
                    <td className="px-6 py-4 text-gray-900">{trip.vehicleNumber || trip.vehicle || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{trip.driverName || trip.driver || '-'}</td>
                    <td className="px-6 py-4 text-gray-900">{trip.passengerName || trip.user || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{trip.epfNumber || trip.epf || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{trip.distance ? `${trip.distance} km` : '-'}</td>
                    <td className="px-6 py-4 text-gray-900">{trip.cost ? `LKR ${trip.cost}` : '-'}</td>
                    <td className="px-6 py-4">
                      <Badge status={trip.status} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredData.length === 0 && (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No trips found matching the filters</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}