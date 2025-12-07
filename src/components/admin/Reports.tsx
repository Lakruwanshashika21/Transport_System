import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Download, Calendar, Car, FileText, Edit, X, Check, Banknote, ChevronDown, ChevronUp, Users, Truck, DollarSign, Activity, Settings, BarChart3, TrendingUp, Info, 
    User as UserIcon, Loader2, Filter, AlertTriangle
} from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';

// Firebase Imports
import { collection, getDocs, query, doc, updateDoc, where, orderBy as orderDB } from 'firebase/firestore';
import { db } from '../../firebase';
// PDF Imports
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Interfaces & Constants ---

interface ReportsProps {
    user: User;
    onNavigate: (screen: string) => void;
    onLogout: () => void;
}

type ReportData = any[];
type MainTab = 'trips' | 'vehicles' | 'drivers' | 'users' | 'payroll';
type VehicleSubTab = 'data' | 'performance' | 'history';

const TIME_PERIODS = [
    { label: 'All Time', value: 'all' },
    { label: 'Last Week', value: 'last_week' },
    { label: 'Last Month', value: 'last_month' },
    { label: 'Last 6 Months', value: 'last_six_months' },
    { label: 'Last Year', value: 'last_year' },
    { label: 'Current Quarter', value: 'current_quarter' },
    { label: 'Custom Range', value: 'custom' },
];

// --- Helper Functions (Date, Cost, Parsing) ---

const getWeekNumber = (d: Date): number => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
};

const getDateRange = (period: string): { start: string, end: string } => { 
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    end.setHours(23, 59, 59, 999); 

    switch (period) {
        case 'last_week':
            start.setDate(now.getDate() - 7);
            break;
        case 'last_month':
            start.setMonth(now.getMonth() - 1);
            break;
        case 'last_six_months':
            start.setMonth(now.getMonth() - 6);
            break;
        case 'last_year':
            start.setFullYear(now.getFullYear() - 1);
            break;
        case 'current_quarter':
            const currentMonth = now.getMonth();
            const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
            start.setMonth(quarterStartMonth, 1);
            end.setMonth(quarterStartMonth + 3, 0); 
            break;
        default: 
            return { start: '', end: '' };
    }

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    return { 
        start: formatDate(start), 
        end: formatDate(end)
    };
};

const parseCost = (c: any) => parseFloat((c || '0').toString().replace(/[^0-9.]/g, '')) || 0;
const parseDist = (d: any) => parseFloat((d || '0').toString().replace(/[^0-9.]/g, '')) || 0;

// Helper for Table Route Display (Retained)
const RouteCell = ({ pickup, destinations, destination }: { pickup: string, destinations?: string[], destination: string }) => { 
    const [expanded, setExpanded] = useState(false);
    
    if (!destinations || destinations.length === 0) {
        return (
            <div>
                <div className="font-medium text-xs text-gray-900">TO: {destination}</div>
                <div className="text-xs ml-2 pl-2 border-l border-gray-300">from {pickup}</div>
            </div>
        );
    }
    const showAll = expanded || destinations.length <= 2;
    return (
        <div>
            <div className="font-medium text-xs text-gray-900">FROM: {pickup}</div>
            
            {destinations.length > 0 && (
                <div className="text-xs ml-2 pl-2 border-l-2 border-gray-200 my-1">
                    <span className="text-gray-500 font-mono mr-1">1.</span> {destinations[0]}
                </div>
            )} 

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


// --- API Fetchers (Aggregation and Data Retrieval) ---

const fetchTripRequests = async () => { 
    const q = query(collection(db, "trip_requests")); 
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const fetchFuelLogs = async () => {
    const q = query(collection(db, "fuel_logs")); 
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
};

const fetchDriverPayrollHistory = async () => {
    // Fetch all payroll history, ordered by period descending (most recent first)
    const q = query(collection(db, "driver_payroll"), orderDB("period", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
};

// 🌟 FIX: Corrected typo (ArrayOf -> Array.isArray) 🌟
const sumCostsFromHistory = (historyArray: any[] | undefined) => {
    if (!Array.isArray(historyArray)) return 0;
    return historyArray.reduce((sum, item) => {
        const costStr = item.cost || 'LKR 0';
        return sum + parseCost(costStr); 
    }, 0);
};

const fetchVehicles = async () => { 
    const allTrips = await fetchTripRequests();
    const q = query(collection(db, "vehicles")); 
    const querySnapshot = await getDocs(q);

    const vehiclesData = querySnapshot.docs.map(doc => {
        const baseV = { id: doc.id, ...doc.data() };
        
        const vehicleTrips = allTrips.filter(trip => 
            (trip.vehicleNumber === baseV.number) && (trip.status === 'completed')
        );
        
        const totalKmRun = vehicleTrips.reduce((sum, trip) => sum + parseDist(trip.distance), 0);
        
        return {
            ...baseV,
            totalKm: totalKmRun, 
            serviceHistory: baseV.serviceHistory || [],
            licenseExpiry: baseV.licenseExpiry || 'N/A',
            avgKmLtr: baseV.avgKmLtr || 0,
            costPerKm: baseV.costPerKm || 0,
            plant: baseV.plant || 'Unassigned',
        };
    });
    return vehiclesData;
};

// 🌟 FIXED LOGIC: Calculate Vehicle Operating Costs (Weekly and Aggregated) 🌟
const fetchVehicleOperatingCosts = async (masterVehicles: any[], periodFilter: number) => {
    const allTrips = await fetchTripRequests(); 
    const allFuelLogs = await fetchFuelLogs();
    
    const costSummaryMap = new Map<string, any>();
    const currentYear = new Date().getFullYear();

    masterVehicles.forEach(vehicle => {
        
        // --- Filter Trips/Logs by Week ---
        let filteredTrips = allTrips.filter(t => t.vehicleNumber === vehicle.number);
        let filteredFuelLogs = allFuelLogs.filter(f => f.vehicleNumber === vehicle.number);
        
        if (periodFilter > 0) { // Apply Week Filter (1-52)
            filteredTrips = filteredTrips.filter(t => {
                const tripDate = new Date(t.date);
                return getWeekNumber(tripDate) === periodFilter && tripDate.getFullYear() === currentYear;
            });
            filteredFuelLogs = filteredFuelLogs.filter(f => {
                const fuelDate = new Date(f.date || f.timestamp);
                return getWeekNumber(fuelDate) === periodFilter && fuelDate.getFullYear() === currentYear;
            });
        }


        const key = `${vehicle.type || 'N/A'}-${vehicle.plant || 'N/A'}`;
        
        // Use existing map entry or create new one
        let summary = costSummaryMap.get(key) || { 
            vehicleType: vehicle.type, 
            plant: vehicle.plant, 
            fuelCost: 0, 
            maintenance: 0, 
            tripCost: 0,
            totalOperatingCost: 0,
            id: key,
            period: (periodFilter > 0) ? `Week ${periodFilter} ${currentYear}` : 'Aggregated All Time'
        };

        // Aggregate Fuel Cost (from fuel_logs)
        summary.fuelCost += filteredFuelLogs.reduce((sum, log) => sum + parseCost(log.cost), 0);
        
        // Aggregate Trip Cost (from trip_requests)
        summary.tripCost += filteredTrips.reduce((sum, trip) => sum + parseCost(trip.cost), 0);
        
        // Aggregate Maintenance (0 for weekly view, full sum for aggregated view)
        summary.maintenance += (periodFilter > 0) ? 0 : sumCostsFromHistory(vehicle.repairs) + sumCostsFromHistory(vehicle.services);
        
        summary.totalOperatingCost = summary.fuelCost + summary.maintenance + summary.tripCost;

        costSummaryMap.set(key, summary);
    });

    return Array.from(costSummaryMap.values());
};


const fetchUsersWithTripAggregation = async (isDriverQuery: boolean = false) => { 
    const allTrips = await fetchTripRequests(); 
    const masterPayroll = await fetchDriverPayrollHistory();
    const payrollMap = new Map(); // Store payroll by driverId

    // Populate payroll map, ensuring the MOST RECENT record is kept for each driver
    masterPayroll.forEach((p: any) => {
        const existing = payrollMap.get(p.driverId);
        // Only keep the record if the current record is newer (based on period string YYYY-MM)
        if (!existing || p.period > existing.period) {
            payrollMap.set(p.driverId, p);
        }
    });

    let q = collection(db, "users");
    if (isDriverQuery) {
        q = query(q, where('role', '==', 'driver'));
    } else {
        q = query(q, where('role', '!=', 'driver'));
    }
    
    const userSnapshot = await getDocs(q);
    const usersData = userSnapshot.docs.map(doc => {
        const userData = doc.data();
        return { id: doc.id, uid: doc.id, name: userData.fullName || userData.name || 'N/A', ...userData };
    });

    const aggregatedUsers = usersData.map(user => {
        let completedTrips = 0;
        let totalKmRun = 0;
        let lastUsedVehicle = 'N/A'; 
        let lastTripDate = new Date(0); 

        const userTrips = allTrips.filter(trip => 
            (isDriverQuery ? (trip.driverId === user.uid) : (trip.userId === user.uid))
        );

        userTrips.forEach(trip => {
            if (trip.status === 'completed') {
                completedTrips++;
                totalKmRun += parseDist(trip.distance);
                
                // 🌟 FIX: Determine Last Used Vehicle 🌟
                const tripDate = new Date(trip.date);
                if (tripDate > lastTripDate) {
                    lastTripDate = tripDate;
                    lastUsedVehicle = trip.vehicleNumber || trip.requestedVehicleModel || 'N/A';
                }
            }
        });
        
        // Driver Payroll Enrichment 
        const payrollRecord = payrollMap.get(user.uid);

        return {
            ...user,
            totalRequests: user.totalRequests || completedTrips, 
            totalTrips: completedTrips,      
            totalKmRun: totalKmRun,          
            fineClaims: user.fineClaims || 0,
            lastUsedVehicle: lastUsedVehicle,
            // Get last recorded financial data
            lastSalary: payrollRecord?.salary || 0,
            lastFineReimbursement: payrollRecord?.fineReimbursement || 0
        };
    });

    return aggregatedUsers;
};

// 🌟 NEW PDF HEADER HELPER 🌟
// Centralized function to add the company logo and report title/filter summary
const applyReportHeader = (doc: jsPDF, reportName: string, filters: any) => {
    // Image Path (Assuming 'report-header.jpg' is in the public folder)
    const imgData = 'report-header.jpg'; 
    const imgWidth = 50; // Set desired width for logo
    const imgHeight = 25; // Set desired height for logo
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 14;
    const centerOffset = (pageWidth - imgWidth) / 2; // Center the image

    // Add Logo (Centrally aligned)
    // NOTE: In a real environment, you must convert the image to a base64 string 
    // or use jspdf's external image loading logic (doc.addImage(url, format, x, y, w, h)).
    // For local file access, this line is typically mocked or requires specific build config.
    try {
        doc.addImage(imgData, 'JPEG', centerOffset, 5, imgWidth, imgHeight); 
    } catch (e) {
        // Fallback text if image fails to load/render
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text("Company Logo Placeholder", centerOffset, 15);
    }

    let y = 35; // Start main content below the header image/placeholder

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(`Transport Admin Report: ${reportName}`, marginX, y);
    y += 8;
    
    // Filter Summary
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Active Filters: ${getFilterSummaryText(filters)}`, marginX, y); 
    y += 5;

    return y; // Return the new starting Y position for the content (e.g., autotable)
}


const getFilterSummaryText = (filters: any) => {
    const activeFilters = [];
    
    // 1. Date/Period Filter
    if (filters.period === 'all' || filters.week === 0) {
        activeFilters.push('Time Period: All Time');
    } else if (filters.period === 'week' && filters.week) {
        const weekText = filters.week === 'current' ? `Week ${getWeekNumber(new Date())}` : `Week ${filters.week}`;
        activeFilters.push(`Time Period: ${weekText} (${new Date().getFullYear()})`);
    } else if (filters.startDate) {
        const formatDisplayDate = (date: string) => date.split('-').reverse().join('/');
        const start = formatDisplayDate(filters.startDate);
        const end = formatDisplayDate(filters.endDate);
        activeFilters.push(`Date Range: ${start} to ${end}`);
    }

    // 2. Keyword/Dropdown Filters
    if (filters.vehicleNumber) activeFilters.push(`Vehicle No.: ${filters.vehicleNumber}`);
    if (filters.epfNumber) activeFilters.push(`EPF No.: ${filters.epfNumber}`);
    if (filters.driverName) activeFilters.push(`Driver/Customer: ${filters.driverName}`);
    if (filters.vehicleType) activeFilters.push(`Vehicle Type: ${filters.vehicleType}`);
    if (filters.plant) activeFilters.push(`Plant: ${filters.plant}`);
    
    if (activeFilters.length === 0) {
        return 'No filters applied (Showing All Time Data)';
    }

    return activeFilters.join(' | ');
};

// --- Main Component ---

export function Reports({ user, onNavigate, onLogout }: ReportsProps) {
    const [activeTab, setActiveTab] = useState<MainTab>('trips');
    const [activeSubTab, setActiveSubTab] = useState<VehicleSubTab>('data'); 
    const [data, setData] = useState<any>({ 
        trips: [], 
        vehicles: [], 
        drivers: [], 
        users: [],
        costSummary: []
    });
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null); // State for explicit fetch errors
    const [filters, setFilters] = useState({ 
        period: 'all', 
        startDate: '', 
        endDate: '', 
        vehicleNumber: '', 
        epfNumber: '',
        vehicleType: '', 
        plant: '',       
        driverName: '',  
        week: 0 as number | string, // 🌟 NEW WEEK FILTER 🌟
    });
    const [editingTripId, setEditingTripId] = useState<string | null>(null);
    const [editCostValue, setEditCostValue] = useState('');

    // Handle Period Change -> Update Start/End Dates
    useEffect(() => { 
        if (filters.period !== 'custom' && filters.period !== 'all' && filters.period !== 'week') {
            const { start, end } = getDateRange(filters.period);
            setFilters(prev => ({ ...prev, startDate: start, endDate: end, week: 0 }));
        } else if (filters.period === 'all') {
             setFilters(prev => ({ ...prev, startDate: '', endDate: '', week: 0 }));
        } else if (filters.period === 'week') {
             setFilters(prev => ({ ...prev, startDate: '', endDate: '' }));
        }
    }, [filters.period]);
    
    // Rerunning logic when week filter changes (only for Cost Summary tab)
    useEffect(() => {
        if (activeTab === 'vehicles' && activeSubTab === 'history' && filters.week !== 0) {
            const updateCostSummary = async () => {
                const weekNumber = filters.week === 'current' ? getWeekNumber(new Date()) : Number(filters.week);
                const masterVehicles = data.vehicles || await fetchVehicles();
                const masterCostSummary = await fetchVehicleOperatingCosts(masterVehicles, weekNumber);
                setData(prev => ({ ...prev, costSummary: masterCostSummary }));
            };
            updateCostSummary();
        } else if (activeTab === 'vehicles' && activeSubTab === 'history' && filters.week === 0) {
             const updateCostSummary = async () => {
                const masterVehicles = data.vehicles || await fetchVehicles();
                const masterCostSummary = await fetchVehicleOperatingCosts(masterVehicles, 0);
                setData(prev => ({ ...prev, costSummary: masterCostSummary }));
            };
            updateCostSummary();
        }
    }, [filters.week, activeTab, activeSubTab]);


    // Fetch Data for Active Tab/SubTab
    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            setFetchError(null); 
            try {
                // Fetch all master data needed for aggregation/filtering
                const masterVehicles = await fetchVehicles();
                const masterDrivers = await fetchUsersWithTripAggregation(true);
                const masterUsers = await fetchUsersWithTripAggregation(false);
                const masterCostSummary = await fetchVehicleOperatingCosts(masterVehicles, 0); // Aggregate All Time initially
                const masterTrips = await fetchTripRequests(); 
                const masterPayroll = await fetchDriverPayrollHistory();
                
                // --- Enrichment Logic ---
                const vehicleMap = new Map(masterVehicles.map((v: any) => [v.number, v]));
                const driverMap = new Map(masterDrivers.map((d: any) => [d.id, d]));
                
                const enrichedTrips = masterTrips.map((trip: any) => {
                    const vehicleDetails = vehicleMap.get(trip.vehicleNumber) || {};
                    const driverDetails = driverMap.get(trip.driverId) || {};
                    return {
                        ...trip,
                        vehicleType: vehicleDetails.type,
                        plant: vehicleDetails.plant,
                        driverName: driverDetails.name || trip.driverName,
                        customerName: driverMap.get(trip.userId)?.name || trip.customer,
                    }
                });
                
                // Add payroll data to drivers
                const driversWithPayroll = masterDrivers.map((d: any) => {
                    // Find the single most recent payroll record for this driver
                    const payrollRecord = masterPayroll.find((p: any) => p.driverId === d.id);
                    return {
                        ...d,
                        lastSalary: payrollRecord?.salary || 0,
                        lastFineReimbursement: payrollRecord?.fineReimbursement || 0,
                    }
                });
                
                setData({ 
                    trips: enrichedTrips, 
                    vehicles: masterVehicles, 
                    drivers: driversWithPayroll, 
                    users: masterUsers,
                    costSummary: masterCostSummary,
                    payroll: masterPayroll, // Store full payroll history for the Payroll Summary tab
                });

            } catch (error: any) { 
                console.error(`Error fetching data during report initialization:`, error);
                setFetchError(`Database fetch failed. Details: ${error.message}`);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, [activeTab, activeSubTab]);


    // Derive unique filter options dynamically from current master lists
    const filterOptions = useMemo(() => {
        const vehicles = data.vehicles || [];
        const drivers = data.drivers || [];
        const unique = (arr: any[]) => Array.from(new Set(arr)).filter(Boolean).sort();

        return {
            vehicleTypes: unique(vehicles.map((v: any) => v.type)),
            plants: unique(vehicles.map((v: any) => v.plant)),
            driverNames: unique(drivers.map((d: any) => d.name)),
        };
    }, [data.vehicles, data.drivers]);


    // Determine which dataset to filter (Retained)
    const currentDatasetKey = useMemo(() => {
        if (activeTab === 'trips') return 'trips';
        if (activeTab === 'vehicles') {
            if (activeSubTab === 'data' || activeSubTab === 'performance') return 'vehicles';
            if (activeSubTab === 'history') return 'costSummary';
        }
        if (activeTab === 'drivers') return 'drivers';
        if (activeTab === 'users') return 'users';
        if (activeTab === 'payroll') return 'payroll';
        return 'trips';
    }, [activeTab, activeSubTab]);

    // Filtering Logic (UPDATED)
    const filteredData = useMemo(() => {
        const currentData = data[currentDatasetKey];
        if (!currentData) return [];

        return currentData.filter((item: any) => {
            const vehicle = item.vehicleNumber || item.vehicle || item.number || item.lastUsedVehicle || '';
            const epf = item.epfNumber || item.epf || '';
            const driverOrCustomerName = item.driverName || item.name || item.customerName || '';
            
            // 1. Time Filters (only for trips and payroll)
            if (currentDatasetKey === 'trips' && item.date) {
                 // 🌟 FIX: 'All Time' works because the date checks are only applied if startDate is set 🌟
                 if (filters.startDate && item.date < filters.startDate) return false;
                 if (filters.endDate && item.date > filters.endDate) return false;
            }
            if (currentDatasetKey === 'payroll' && item.period) {
                if (filters.startDate && item.period < filters.startDate.substring(0, 7)) return false;
                if (filters.endDate && item.period > filters.endDate.substring(0, 7)) return false;
            }
            
            // 2. Keyword Filters
            if (filters.vehicleNumber && !vehicle.toLowerCase().includes(filters.vehicleNumber.toLowerCase())) return false;
            if (filters.epfNumber && !epf.toLowerCase().includes(filters.epfNumber.toLowerCase())) return false;
            
            // 3. Dropdown Filters
            const itemVehicleType = item.vehicleType || item.type; // Check trip.vehicleType or vehicle.type
            if (filters.vehicleType && itemVehicleType && itemVehicleType !== filters.vehicleType) return false;
            if (filters.plant && item.plant && item.plant !== filters.plant) return false;
            if (filters.driverName && !driverOrCustomerName.toLowerCase().includes(filters.driverName.toLowerCase())) return false;
            
            return true;
        });
    }, [data, currentDatasetKey, filters]);

    // Handle Trip Cost Update (Retained)
    const handleUpdateCost = async (id: string) => { 
        try {
            const formattedCost = editCostValue.startsWith('LKR') ? editCostValue : `LKR ${editCostValue}`;
            await updateDoc(doc(db, "trip_requests", id), { cost: formattedCost });
            setData((prev: any) => ({
                ...prev, 
                trips: prev.trips.map((trip: any) => trip.id === id ? { ...trip, cost: formattedCost } : trip)
            }));
            setEditingTripId(null);
        } catch (error) {
            console.error("Failed to update cost:", error);
            alert("Failed to update cost.");
        }
    };
    
    // Summary Stats (Retained)
    const totalCost = filteredData.reduce((sum, t) => sum + parseCost(t.cost || t.totalExp), 0);
    const totalDist = filteredData.reduce((sum, t) => sum + parseDist(t.distance), 0);

    // --- PDF Export Functionality (UPDATED to use applyReportHeader) ---
    const handleExportPDF = useCallback(async (reportData: ReportData, reportName: string) => { 
        const doc = new jsPDF();
        
        // 🌟 Apply Report Header and get starting Y coordinate 🌟
        const startY = applyReportHeader(doc, reportName, filters); 
        
        let head: string[][] = [];
        let body: (string | number)[][] = [];

        if (reportName === 'Trip History') {
            head = [['ID', 'Date', 'Route', 'Vehicle', 'Type/Plant', 'Driver/Customer', 'Cost']]; 
            body = reportData.map(trip => [
                trip.serialNumber || trip.id.substring(0, 5), 
                trip.date, 
                'See UI for route', 
                trip.vehicleNumber || trip.requestedVehicleModel || '-', 
                `${trip.vehicleType || 'N/A'} / ${trip.plant || 'N/A'}`, 
                `${trip.customerName || 'N/A'} / Dr: ${trip.driverName || 'Unassigned'}`,
                trip.cost || '-'
            ]);
        } 
        else if (reportName === 'Vehicle Data') {
            head = [['Vehicle No', 'Model', 'Type', 'Plant', 'Seats', 'Rate/Km', 'License Exp']]; 
            body = reportData.map(v => [
                v.number || v.model, 
                v.model || '-', 
                v.type || '-', 
                v.plant || 'N/A', 
                v.seats || '-', 
                `LKR ${v.ratePerKm || '0'}`, 
                v.licenseExpiry || 'N/A'
            ]);
        }
        else if (reportName === 'Vehicle Performance') {
            head = [['Vehicle', 'Type', 'Plant', 'Total KM', 'KM/L', 'Cost/KM']]; 
            body = reportData.map(v => [
                v.number, 
                v.type || '-', 
                v.plant || 'N/A', 
                v.totalKm || 0, 
                v.avgKmLtr || 0, 
                `LKR ${v.costPerKm || 0}`
            ]);
        }
        else if (reportName === 'Vehicle Operating Costs') {
            head = [['Period', 'Type/Plant', 'Fuel Cost', 'Maintenance', 'Trip Cost', 'Total Op. Cost']];
            body = reportData.map(c => [
                c.period || 'Aggregated', 
                `${c.vehicleType || 'N/A'} / ${c.plant || 'N/A'}`,
                `LKR ${c.fuelCost || 0}`, 
                `LKR ${c.maintenance || 0}`, 
                `LKR ${c.tripCost || 0}`, 
                `LKR ${c.totalOperatingCost || 0}`
            ]);
        }
        else if (reportName === 'Driver Data') {
            head = [['Name', 'Phone', 'Salary', 'Reimb.', 'Total Trips', 'KM Run', 'Status']]; 
            body = reportData.map(d => [
                d.name, 
                d.phone || 'N/A', 
                `LKR ${d.lastSalary || 0}`, 
                `LKR ${d.lastFineReimbursement || 0}`, 
                d.totalTrips || 0, 
                d.totalKmRun || 0, 
                d.status
            ]);
        }
        else if (reportName === 'User Requests') {
            head = [['User Name', 'Email', 'EPF', 'Phone', 'Role', 'Total Requests']]; // 🌟 ADDED ROLE 🌟
            body = reportData.map(u => [
                u.name, 
                u.email, 
                u.epfNumber || 'N/A', 
                u.phone || 'N/A', 
                u.role || 'user', // Display role
                u.totalRequests || 0
            ]);
        }
        // 🌟 NEW PAYROLL PDF 🌟
        else if (reportName === 'Payroll Summary') {
            head = [['Driver', 'Period', 'Salary', 'Allowances', 'Reimb.', 'Expenses', 'Net Payout']]; 
            body = reportData.map(p => [
                p.driverName || 'N/A', 
                p.period || 'N/A', 
                `LKR ${p.salary || 0}`, 
                `LKR ${((p.fuelAllowance || 0) + (p.mobileAllowance || 0))}`,
                `LKR ${p.fineReimbursement || 0}`,
                `LKR ${((p.mealExpenses || 0) + (p.otherExpenses || 0))}`,
                `LKR ${p.totalPayout || 0}`
            ]);
        }

        autoTable(doc, { head, body, startY: startY + 5, theme: 'grid' }); // Use the returned Y coordinate
        doc.save(`${reportName.toLowerCase().replace(/\s/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
    }, [filters]);


    // --- Individual Renderer Functions ---

    const renderTripReports = (reports: ReportData) => (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] divide-y divide-gray-200">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase w-64">Route</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Vehicle/Plant</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Driver/Customer</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Cost (Edit)</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {reports.map((trip) => (
                        <tr key={trip.id}>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{trip.serialNumber || trip.id.substring(0, 5)}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{trip.date}<br/>{trip.time}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                                <RouteCell pickup={trip.pickup} destinations={trip.destinations} destination={trip.destination} />
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                                <span className="font-medium text-gray-900">{trip.vehicleNumber || trip.requestedVehicleModel || 'N/A'} ({trip.vehicleType})</span>
                                <br/>
                                <span className="text-xs text-gray-400">Plant: {trip.plant || 'N/A'}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                                <span className="font-medium text-gray-900">{trip.customer || trip.customerName || 'N/A'}</span>
                                <br/>
                                <span className="text-xs text-gray-400">Dr: {trip.driverName || 'Unassigned'}</span>
                            </td>
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
    );

    const renderVehicleMasterData = (vehicles: ReportData) => (
        <div className="overflow-x-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Master Vehicle Data</h3>
            <table className="w-full min-w-[1000px] divide-y divide-gray-200">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Vehicle No / Model</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Type / Plant</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Capacity/Rate</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Service Status</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">License Expiry</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {vehicles.map((v) => (
                        <tr key={v.id}>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{v.number || v.model}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                                <span className="font-medium text-gray-900">{v.type || 'N/A'}</span>
                                <br/>
                                <span className="text-xs text-gray-400">Plant: {v.plant || 'N/A'}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{v.seats || 'N/A'} Seats | LKR {v.ratePerKm || 'N/A'}/km</td>
                            <td className="px-6 py-4"><Badge status={v.status} size="sm" /></td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                                {v.serviceHistory && v.serviceHistory.length > 0 ? 
                                    `${v.serviceHistory[0].date} - ${v.serviceHistory[0].details}` : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-red-600">{v.licenseExpiry}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderVehiclePerformance = (performanceData: ReportData) => (
        <div className="overflow-x-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Fuel Rate & Cost per KM</h3>
            <table className="w-full min-w-[800px] divide-y divide-gray-200">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Plant</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Total KM Run (Life)</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Avg. KM/Liter</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Avg. Cost/KM</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {performanceData.map((v) => (
                        <tr key={v.number}>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{v.number || v.model || 'N/A'}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{v.plant || 'N/A'}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{v.totalKm ? v.totalKm.toLocaleString() : 'N/A'}</td>
                            <td className="px-6 py-4 text-sm font-bold text-green-600">{v.avgKmLtr || 'N/A'}</td>
                            <td className="px-6 py-4 text-sm font-bold text-red-600">LKR {v.costPerKm || 'N/A'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderCostSummary = (summaryData: ReportData) => (
        <div className="overflow-x-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Vehicle Operating Costs Summary</h3>
            <table className="w-full min-w-[1000px] divide-y divide-gray-200">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Group (Type / Plant)</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fuel Cost</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Maintenance</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Trip Cost</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Op. Cost</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {summaryData.map((s) => (
                        <tr key={s.id}>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">{`${s.vehicleType || 'N/A'} / ${s.plant || 'N/A'}`}</td>
                            <td className="px-3 py-2 text-sm font-bold text-red-600">LKR {s.fuelCost ? s.fuelCost.toLocaleString() : '0'}</td>
                            <td className="px-3 py-2 text-sm text-gray-500">LKR {s.maintenance ? s.maintenance.toLocaleString() : '0'}</td>
                            <td className="px-3 py-2 text-sm text-gray-500">LKR {s.tripCost ? s.tripCost.toLocaleString() : '0'}</td>
                            <td className="px-3 py-2 text-sm font-bold text-green-600">LKR {s.totalOperatingCost ? s.totalOperatingCost.toLocaleString() : '0'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderDriverReports = (drivers: ReportData) => (
        <div className="overflow-x-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Driver Master Data & Performance</h3>
            <table className="w-full min-w-[1000px] divide-y divide-gray-200">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Driver Name/Phone</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Salary (Last Month)</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Fine Reimb. (Last Month)</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Total Trips/KM Run</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Last Used Vehicle</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {drivers.map((d) => (
                        <tr key={d.id}>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{d.name || 'N/A'}<br/><span className="text-xs text-gray-500">{d.phone || 'N/A'}</span></td>
                            <td className="px-6 py-4 text-sm text-gray-500">LKR {d.lastSalary?.toLocaleString() || '0'}</td>
                            <td className="px-6 py-4 text-sm font-bold text-green-600">LKR {d.lastFineReimbursement?.toLocaleString() || '0'}</td>
                            <td className="px-6 py-4 text-sm font-bold text-blue-600">{d.totalTrips || 0} Trips<br/><span className="text-xs text-gray-500">{d.totalKmRun ? d.totalKmRun.toLocaleString() : 0} KM</span></td>
                            <td className="px-6 py-4 text-sm text-gray-500">{d.lastUsedVehicle}</td>
                            <td className="px-6 py-4"><Badge status={d.status} size="sm" /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderUserReports = (users: ReportData) => (
        <div className="overflow-x-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">User Master Data and Trip Aggregation</h3>
            <table className="w-full min-w-[600px] divide-y divide-gray-200">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Email/Phone</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Role</th> {/* 🌟 ADDED ROLE 🌟 */}
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">EPF</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Total Requests (Completed)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {users.map((u) => (
                        <tr key={u.id}>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{u.name || 'N/A'}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{u.email}<br/><span className="text-xs text-gray-400">{u.phone || 'N/A'}</span></td>
                            <td className="px-6 py-4 text-sm text-gray-500">{u.role || 'user'}</td> {/* 🌟 DISPLAY ROLE 🌟 */}
                            <td className="px-6 py-4 text-sm text-gray-500">{u.epfNumber || 'N/A'}</td>
                            <td className="px-6 py-4 text-sm font-bold text-green-600">{u.totalRequests || 0}</td>
                            
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderPayrollSummary = (payroll: ReportData) => (
        <div className="overflow-x-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Driver Payroll & Allowances Summary</h3>
            <table className="w-full min-w-[1200px] divide-y divide-gray-200">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Salary</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">F/M Allowance</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Meals/Other Exp</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reimb. (Fine)</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">NET PAYOUT</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {payroll.map((p) => (
                        <tr key={p.id}>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">{p.driverName || 'N/A'}</td>
                            <td className="px-3 py-2 text-sm text-gray-500">{p.period || 'N/A'}</td>
                            <td className="px-3 py-2 text-sm text-gray-500">LKR {p.salary?.toLocaleString() || '0'}</td>
                            <td className="px-3 py-2 text-sm text-gray-500">LKR {(p.fuelAllowance + p.mobileAllowance)?.toLocaleString() || '0'}</td>
                            <td className="px-3 py-2 text-sm text-gray-500">LKR {(p.mealExpenses + p.otherExpenses)?.toLocaleString() || '0'}</td>
                            <td className="px-3 py-2 text-sm font-bold text-green-600">LKR {p.fineReimbursement?.toLocaleString() || '0'}</td>
                            <td className="px-3 py-2 text-sm font-bold text-blue-600">LKR {p.totalPayout?.toLocaleString() || '0'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderReportContent = () => {
        if (loading) return <div className="p-12 text-center text-gray-500 flex justify-center items-center gap-2"><Loader2 className="w-5 h-5 animate-spin"/> Loading data...</div>;
        
        // Display generic error if fetch failed
        if (fetchError) {
             return <div className="p-12 text-center text-red-600 bg-red-50 border border-red-200 rounded-xl">
                 <AlertTriangle className="w-6 h-6 inline-block mr-2"/> Error: {fetchError}
             </div>
        }

        if (filteredData.length === 0) return <div className="p-12 text-center text-gray-500">No data found matching the current filters.</div>;

        if (activeTab === 'trips') return renderTripReports(filteredData);
        if (activeTab === 'vehicles') {
            if (activeSubTab === 'data') return renderVehicleMasterData(filteredData);
            if (activeSubTab === 'performance') return renderVehiclePerformance(filteredData);
            if (activeSubTab === 'history') return renderCostSummary(filteredData);
        }
        if (activeTab === 'drivers') return renderDriverReports(filteredData);
        if (activeTab === 'users') return renderUserReports(filteredData);
        if (activeTab === 'payroll') return renderPayrollSummary(filteredData); 
        
        return <div className="p-12 text-center text-gray-500">Select a report type.</div>;
    };

    // --- Main Render ---
    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="reports" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="mb-8">
                    <h1 className="text-3xl text-gray-900 mb-2">Transport Fleet Reporting</h1>
                    {/* Main Tabs */}
                    <div className="flex space-x-4 border-b border-gray-200 mb-4">
                        <MainTabButton label="Trip History" tab="trips" icon={<FileText className="w-4 h-4"/>} activeTab={activeTab} setActiveTab={setActiveTab} />
                        <MainTabButton label="Vehicle Data" tab="vehicles" icon={<Truck className="w-4 h-4"/>} activeTab={activeTab} setActiveTab={setActiveTab} />
                        <MainTabButton label="Driver Data" tab="drivers" icon={<UserIcon className="w-4 h-4"/>} activeTab={activeTab} setActiveTab={setActiveTab} />
                        <MainTabButton label="User Requests" tab="users" icon={<Users className="w-4 h-4"/>} activeTab={activeTab} setActiveTab={setActiveTab} />
                        <MainTabButton label="Payroll Summary" tab="payroll" icon={<DollarSign className="w-4 h-4"/>} activeTab={activeTab} setActiveTab={setActiveTab} />
                    </div>
                    
                    {/* Nested Tabs for Vehicles */}
                    {activeTab === 'vehicles' && (
                        <div className="flex space-x-4 border-b border-gray-200 ml-6">
                            <SubTabButton label="Master Data & Documents" subTab="data" activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} />
                            <SubTabButton label="Performance (KM/L & Cost/KM)" subTab="performance" activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} />
                            <SubTabButton label="Operating Costs (Fuel/Maint/Trip)" subTab="history" activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} />
                        </div>
                    )}
                </div>

                {/* Filters */}
                <Card className="p-6 mb-8">
                    <h2 className="text-lg font-semibold mb-4">Report Filters</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        
                        {/* Time Period Selector */}
                        <div className="relative">
                            <select
                                value={filters.period}
                                onChange={(e) => setFilters({ ...filters, period: e.target.value, week: 0 })}
                                className="w-full px-4 py-3 border rounded-xl bg-white appearance-none pr-10"
                            >
                                {TIME_PERIODS.map(p => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"/>
                        </div>
                        
                        {/* Week Filter (1-52) */}
                        <div className="relative">
                            <select
                                value={filters.week}
                                onChange={(e) => setFilters({ ...filters, period: 'week', week: e.target.value === 'current' ? 'current' : Number(e.target.value) })}
                                className="w-full px-4 py-3 border rounded-xl bg-white appearance-none pr-10"
                            >
                                <option value={0}>-- Filter by Week (1-52) --</option>
                                <option value="current">Current Week ({getWeekNumber(new Date())})</option>
                                {Array.from({ length: 52 }, (_, i) => i + 1).map(w => (
                                    <option key={w} value={w}>Week {w}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"/>
                        </div>
                        
                        {/* Custom Dates */}
                        {filters.period === 'custom' && (
                            <>
                                <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} placeholder="Start Date" className="w-full px-4 py-3 border rounded-xl" />
                                <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} placeholder="End Date" className="w-full px-4 py-3 border rounded-xl" />
                            </>
                        )}
                        
                        {/* 🌟 Dropdown Filters 🌟 */}
                        <div className="relative">
                            <select
                                value={filters.vehicleType}
                                onChange={(e) => setFilters({ ...filters, vehicleType: e.target.value })}
                                className="w-full px-4 py-3 border rounded-xl bg-white appearance-none pr-10"
                            >
                                <option value="">Vehicle Type (All)</option>
                                {filterOptions.vehicleTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"/>
                        </div>
                        
                        <div className="relative">
                            <select
                                value={filters.plant}
                                onChange={(e) => setFilters({ ...filters, plant: e.target.value })}
                                className="w-full px-4 py-3 border rounded-xl bg-white appearance-none pr-10"
                            >
                                <option value="">Registered Plant (All)</option>
                                {filterOptions.plants.map(plant => (
                                    <option key={plant} value={plant}>{plant}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"/>
                        </div>

                        {/* Keyword Filters */}
                        <input type="text" value={filters.vehicleNumber} onChange={(e) => setFilters({ ...filters, vehicleNumber: e.target.value })} placeholder="Vehicle No. Filter" className="w-full px-4 py-3 border rounded-xl" />
                        <input type="text" value={filters.driverName} onChange={(e) => setFilters({ ...filters, driverName: e.target.value })} placeholder="Driver/Customer Name Filter" className="w-full px-4 py-3 border rounded-xl" />
                        <input type="text" value={filters.epfNumber} onChange={(e) => setFilters({ ...filters, epfNumber: e.target.value })} placeholder="EPF No. Filter" className="w-full px-4 py-3 border rounded-xl" />
                        
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setFilters({ period: 'all', startDate: '', endDate: '', vehicleNumber: '', epfNumber: '', vehicleType: '', plant: '', driverName: '', week: 0 })} className="px-6 py-2 border rounded-xl hover:bg-gray-50">Clear Filters</button>
                    </div>
                </Card>

                {/* Summary Stats (Only for Trips Tab) */}
                {activeTab === 'trips' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                        <SummaryCard icon={<FileText className="w-6 text-blue-600" />} title="Total Filtered Trips" value={filteredData.length} />
                        <SummaryCard icon={<Car className="w-6 text-purple-600" />} title="Total Distance" value={`${totalDist.toFixed(1)} km`} />
                        <SummaryCard icon={<Banknote className="w-6 text-green-600" />} title="Total Cost" value={`LKR ${totalCost.toLocaleString()}`} />
                    </div>
                )}

                {/* Report Table */}
                <Card className="overflow-hidden mb-6">
                    <div className="p-6 border-b flex justify-between items-center">
                        <h2 className="text-lg text-gray-900 font-semibold">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report {activeTab === 'vehicles' ? ` - ${activeSubTab.charAt(0).toUpperCase() + activeSubTab.slice(1)}` : ''}</h2>
                        <button 
                            onClick={() => {
                                const reportName = activeTab === 'vehicles' ? 
                                    (activeSubTab === 'data' ? 'Vehicle Data' : activeSubTab === 'performance' ? 'Vehicle Performance' : 'Vehicle Operating Costs') : 
                                    (activeTab === 'trips' ? 'Trip History' : activeTab === 'drivers' ? 'Driver Data' : activeTab === 'payroll' ? 'Payroll Summary' : 'User Requests');
                                handleExportPDF(filteredData, reportName);
                            }} 
                            className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-xl hover:bg-blue-700"
                        >
                            <Download className="w-4 h-4" /> Export PDF
                        </button>
                    </div>

                    {renderReportContent()}
                </Card>

                {/* Data Collection Suggestion Section */}
                <DataCollectionSuggestions activeTab={activeTab} subTab={activeSubTab} />
            </div>
        </div>
    );
}


// --- Component Helpers (Retained) ---

const MainTabButton = ({ label, tab, icon, activeTab, setActiveTab }: { label: string, tab: MainTab, icon: JSX.Element, activeTab: MainTab, setActiveTab: (tab: MainTab) => void }) => (
    <button
        onClick={() => { setActiveTab(tab); if (tab === 'vehicles') setActiveSubTab('data'); }}
        className={`px-3 py-2 text-sm font-medium transition-colors duration-150 flex items-center gap-2 rounded-t-lg ${
            activeTab === tab 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
        }`}
    >
        {icon} {label}
    </button>
);

const SubTabButton = ({ label, subTab, activeSubTab, setActiveSubTab }: { label: string, subTab: VehicleSubTab, activeSubTab: VehicleSubTab, setActiveSubTab: (tab: VehicleSubTab) => void }) => (
    <button
        onClick={() => setActiveSubTab(subTab)}
        className={`px-3 py-1.5 text-xs font-medium transition-colors duration-150 rounded-t ${
            activeSubTab === subTab 
                ? 'text-green-600 border-b-2 border-green-600' 
                : 'text-gray-500 hover:text-gray-700'
        }`}
    >
        {label}
    </button>
);

const SummaryCard = ({ icon, title, value }: { icon: JSX.Element, title: string, value: string | number }) => (
    <Card className="p-6 flex items-center gap-4">
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">{icon}</div>
        <div><div className="text-2xl font-bold">{value}</div><div className="text-sm text-gray-500">{title}</div></div>
    </Card>
);

const DataCollectionSuggestions = ({ activeTab, subTab }: { activeTab: MainTab, subTab: VehicleSubTab }) => {
    let suggestions: { title: string, description: string }[] = [];

    if (activeTab === 'vehicles' && subTab === 'data') {
        suggestions = [
            { title: "Service Data History", description: "You need a dedicated 'MaintenanceLog' collection linked by `vehicleId` to track date, mileage, service type, and cost. This must be populated by the administrator." },
            { title: "License/Insurance History", description: "The `licenseExpiry` field must be manually tracked and updated in the main `vehicles` collection." },
        ];
    } else if (activeTab === 'vehicles' && subTab === 'performance') {
        suggestions = [
             { title: "KM/L & Cost/KM Aggregation", description: "The fields `avgKmLtr` and `costPerKm` are read directly from the `vehicles` collection. You must implement a Cloud Function or a batch job to process your fuel logs (like your uploaded spreadsheets) and write these aggregate figures to the main vehicle document." }
        ];
    } else if (activeTab === 'drivers') {
        suggestions = [
            { title: "Aggregated Driver Metrics (Critical)", description: "The fields `totalTrips`, `totalKmRun`, and `fineClaims` are read from the **user documents** filtered by role='driver'. You **must** implement a **Cloud Function** to calculate these totals from the `trip_requests` and `fines` collection and write them back to the driver's user document."}
        ];
    } else if (activeTab === 'users') {
        suggestions = [
            { title: "Total Requests Counter (Critical)", description: "The `totalRequests` field is now calculated on the front-end by summing **completed** trips. For better performance and accuracy, implement a **Cloud Function** to maintain this count directly on the user's document." }
        ];
    } else {
        return null;
    }

    return (
        <Card className="p-6 mb-8 border-l-4 border-yellow-500 bg-yellow-50">
            <h3 className="text-lg font-bold text-yellow-800 mb-3 flex items-center gap-2"><Info className="w-5 h-5"/> Data Collection Requirement Notice</h3>
            <p className="text-sm text-yellow-700 mb-4">To ensure the **accuracy** of these reports (metrics like KM, Cost, Fines), you must implement the following data population strategy:</p>
            <ul className="space-y-3">
                {suggestions.map((s, i) => (
                    <li key={i} className="text-sm text-gray-700">
                        <span className="font-semibold">{s.title}:</span> {s.description}
                    </li>
                ))}
            </ul>
        </Card>
    );
};