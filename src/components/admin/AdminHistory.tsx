import { useState, useEffect } from 'react';
import { Clock, Search, Filter, Calendar, ArrowLeft, RefreshCw } from 'lucide-react';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { db } from '../../firebase';
import type { User as AppUser } from '../../App'; 
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

interface AdminHistoryProps {
  user: AppUser;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

// Comprehensive list of audit sections across all admin features
const AUDIT_SECTIONS = [
    'All',
    'User Management',
    'Vehicle Management', 
    'Driver Management',
    'Trip Approval',
    'Admin Management',
    'Payroll Management',
    'TRIP_BOOKING_ADMIN', 
];


export function AdminHistory({ user, onNavigate, onLogout }: AdminHistoryProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterSection, setFilterSection] = useState('All');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let data = [];
      try {
        // Fetch logs ordered by newest first
        const q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc')); 
        const snapshot = await getDocs(q);
        // 💥 FIX 1: Add fallbacks for potentially undefined fields during mapping
        data = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            section: doc.data().section || 'Unknown Section', // Safe default
            adminName: doc.data().adminName || 'N/A',
            adminEmail: doc.data().adminEmail || 'N/A',
            action: doc.data().action || 'No action defined',
            details: doc.data().details || 'No details provided'
        }));
      } catch (indexError) {
        console.warn("Index missing, falling back to manual sort");
        const q = query(collection(db, 'system_logs'));
        const snapshot = await getDocs(q);
        data = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            section: doc.data().section || 'Unknown Section', // Safe default
            adminName: doc.data().adminName || 'N/A',
            adminEmail: doc.data().adminEmail || 'N/A',
            action: doc.data().action || 'No action defined',
            details: doc.data().details || 'No details provided'
        }));
        data.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
      }
      setLogs(data);
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setLoading(false);
    }
  };

  // In-Memory Filtering Logic
  const filteredLogs = logs.filter(log => {
    const matchesSection = filterSection === 'All' || log.section === filterSection;
    
    const searchLower = filterSearch.toLowerCase();
    const matchesSearch = filterSearch === '' || 
                         log.adminName?.toLowerCase().includes(searchLower) || 
                         log.adminEmail?.toLowerCase().includes(searchLower) ||
                         log.action?.toLowerCase().includes(searchLower) ||
                         log.details?.toLowerCase().includes(searchLower);
                         
    const matchesDate = filterDate === '' || log.timestamp.startsWith(filterDate);

    return matchesSection && matchesSearch && matchesDate;
  });

  // Helper to determine the badge style based on section
  const getBadgeClass = (section: string) => {
      switch (section) {
          case 'Admin Management':
              return 'bg-purple-50 text-purple-700 border-purple-100';
          case 'Trip Approval':
              return 'bg-orange-50 text-orange-700 border-orange-100';
          case 'TRIP_BOOKING_ADMIN':
              return 'bg-green-100 text-green-800 border-green-200';
          case 'Vehicle Management':
              return 'bg-green-50 text-green-700 border-green-100';
          case 'Driver Management':
              return 'bg-indigo-50 text-indigo-700 border-indigo-100';
          case 'Payroll Management':
              return 'bg-yellow-50 text-yellow-700 border-yellow-100';
          default: // Handles 'Unknown Section' or future additions safely
              return 'bg-gray-200 text-gray-700 border-gray-300';
      }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="admin-history" />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
            <div>
                <button onClick={() => onNavigate('admin-dashboard')} className="text-gray-500 hover:text-gray-900 mb-2 flex items-center gap-1 transition-colors">
                    <ArrowLeft size={16}/> Back
                </button>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <Clock className="w-8 h-8 text-blue-600" /> System Audit History
                </h1>
                <p className="text-gray-600 text-sm mt-1">Immutable record of all administrative actions. Logs cannot be deleted.</p>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="bg-blue-50 text-blue-800 px-4 py-2 rounded-lg text-sm font-medium border border-blue-100 shadow-sm">
                    Records: {filteredLogs.length}
                </div>
                <button onClick={fetchLogs} className="p-2 bg-white border rounded-lg hover:bg-gray-50 text-gray-600 shadow-sm transition-colors" title="Refresh Logs">
                    <RefreshCw size={20}/>
                </button>
            </div>
        </div>

        {/* Filters Panel */}
        <Card className="p-5 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 shadow-sm border border-gray-200">
            <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
                    <Filter className="w-4 h-4" /> Filter by Section
                </label>
                <select 
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white text-sm"
                >
                    {AUDIT_SECTIONS.map(section => (
                        <option key={section} value={section}>
                            {section.replace(/_/g, ' ')}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
                    <Search className="w-4 h-4" /> Search Details
                </label>
                <input 
                    type="text" 
                    placeholder="Search admin, action, details..." 
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
            </div>

            <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
                    <Calendar className="w-4 h-4" /> Filter by Date
                </label>
                <input 
                    type="date" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-600"
                />
            </div>
            
            <div className="flex items-end">
                <button 
                    onClick={() => { setFilterSection('All'); setFilterSearch(''); setFilterDate(''); }}
                    className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium border border-gray-200"
                >
                    Reset Filters
                </button>
            </div>
        </Card>

        {/* Logs Table */}
        <Card className="overflow-hidden border border-gray-200 shadow-md">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date & Time</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Admin</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Section</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Action Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {loading ? (
                            <tr><td colSpan={4} className="p-12 text-center text-gray-500">Loading history logs...</td></tr>
                        ) : filteredLogs.length === 0 ? (
                            <tr><td colSpan={4} className="p-12 text-center text-gray-500">No records found matching your filters.</td></tr>
                        ) : (
                            filteredLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 uppercase">
                                                {log.adminName ? log.adminName.charAt(0) : 'A'}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{log.adminName}</div>
                                                <div className="text-xs text-gray-400">{log.adminEmail}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getBadgeClass(log.section)}`}>
                                            {/* 💥 FIX 2: Safe replace call 💥 */}
                                            {log.section.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-900 font-semibold">{log.action}</div>
                                        <div className="text-sm text-gray-600 mt-0.5">{log.details}</div>
                                        {log.targetId && log.targetId !== 'N/A' && (
                                            <div className="text-xs text-gray-400 mt-1 font-mono">Ref ID: {log.targetId}</div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
      </div>
    </div>
  );
}