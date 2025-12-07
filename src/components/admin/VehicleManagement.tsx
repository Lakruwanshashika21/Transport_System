import { useState, useEffect } from 'react';
import { Car, Plus, Edit, Wrench, DollarSign, Trash2, X, FileText, ShieldAlert, ShieldCheck, TrendingUp, Printer, CheckCircle, Fuel, Clock, ArrowLeft, AlertTriangle, Check } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, arrayUnion, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase';
// Logger Import
import { logAction } from '../../utils/auditLogger';
// PDF Imports
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- CONSTANTS ---
const LICENSE_TYPES_VEHICLE = {
    'A': 'Motorcycle (A)',
    'B': 'Light Vehicle (B)',
    'C': 'Heavy Motor Vehicle (C)',
};

// Placeholder list for plants/locations (Customize this list)
const PLANT_LOCATIONS = [
    'Veyangoda (Head Office)',
    'Katunayake Factory',
    'Horana Plant',
    'Trincomalee Branch',
    'Pallekele',
    'Negombo (Kadirana)',
    'Koggala',
    'Unassigned'
];

interface VehicleManagementProps {
    user: User;
    onNavigate: (screen: string) => void;
    onLogout: () => void;
}

// --- PDF Image Helper (Retained) ---
const loadBase64Image = async (url: string): Promise<{ data: string; width: number; height: number; type: string } | null> => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Image not found or network error.");
        
        const blob = await response.blob();
        const type = url.endsWith('.png') ? 'PNG' : 'JPEG';
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                const img = new Image();
                img.onload = () => resolve({
                    data: dataUrl,
                    width: img.width,
                    height: img.height,
                    type: type
                });
                img.onerror = reject;
                img.src = dataUrl;
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn(`Failed to load image at ${url}. Using placeholder text.`);
        return null;
    }
};


export function VehicleManagement({ user, onNavigate, onLogout }: VehicleManagementProps) {
    // 1. State
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [trips, setTrips] = useState<any[]>([]); // All trips for calculation and status check
    const [fuelLogs, setFuelLogs] = useState<any[]>([]); 
    const [loading, setLoading] = useState(true);
    
    // Updated to store both header and footer image data
    const [headerImageData, setHeaderImageData] = useState<{ data: string; width: number; height: number; type: string } | null>(null);
    const [footerImageData, setFooterImageData] = useState<{ data: string; width: number; height: number; type: string } | null>(null);
    
    const [criticalVehicles, setCriticalVehicles] = useState<any[]>([]); 
    const [licenseAlerts, setLicenseAlerts] = useState<any[]>([]); 

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showRepairModal, setShowRepairModal] = useState(false); 
    const [showRepairDoneModal, setShowRepairDoneModal] = useState(false); 
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [showRateModal, setShowRateModal] = useState(false); 
    const [showRateHistoryModal, setShowRateHistoryModal] = useState(false); 
    const [showLicenseModal, setShowLicenseModal] = useState(false); 
    const [showFuelLogModal, setShowFuelLogModal] = useState(false); 
    const [showReportOptionsModal, setShowReportOptionsModal] = useState(false);
    
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
    
    // Forms
    const [formData, setFormData] = useState({
        number: '', model: '', type: 'Car', seats: '', rate: '', serviceInterval: '5000',
        licenseExpiry: '', insuranceExpiry: '', ownerName: '', ownerPhone: '', chassisNumber: '', engineNumber: '',
        requiredLicenseType: 'B', // Default to Light Vehicle
        plant: PLANT_LOCATIONS[0] || 'Unassigned' // 🌟 NEW PLANT FIELD 🌟
    });

    const [newRate, setNewRate] = useState(''); // Rate Update State

    const [repairStartData, setRepairStartData] = useState({
        issue: '', date: new Date().toISOString().split('T')[0], reportedBy: 'Admin'
    });

    const [repairEndData, setRepairEndData] = useState({
        date: new Date().toISOString().split('T')[0], cost: '', description: '',
    });

    const [serviceData, setServiceData] = useState({
        date: new Date().toISOString().split('T')[0], cost: '', mileage: '', notes: ''
    });

    // License Data State
    const [licenseData, setLicenseData] = useState({
        renewalDate: new Date().toISOString().split('T')[0], newLicenseExpiry: '', licenseCost: '',
        newInsuranceExpiry: '', insurancePolicyNo: '', insuranceProvider: '', insuranceCost: '', notes: ''
    });
    
    // Fuel Log Data
    const [fuelData, setFuelData] = useState({
        date: new Date().toISOString().split('T')[0],
        odometer: '',
        liters: '',
        cost: '',
        location: '',
    });

    // Report Filter State
    const [reportSections, setReportSections] = useState({
        repair: true,
        service: true,
        fuel: true,
        license: true,
    });
    
    // 2. Helper: Check if a trip is active today (in-progress or starting today) (Retained)
    const isTodayOrInProgress = (trip: any) => {
        if (trip.status === 'in-progress') return true;
        
        if (['approved', 'reassigned', 'approved_merge_request'].includes(trip.status)) { 
            const tripDate = new Date(trip.date).setHours(0, 0, 0, 0);
            const today = new Date().setHours(0, 0, 0, 0);
            return tripDate === today;
        }
        return false;
    };
    
    // 2. Helper: Calculate Stats & Determine EFFECTIVE STATUS (Retained)
    const getVehicleStats = (vehicle: any, allTrips: any[]) => {
        // --- Mileage Calculation ---
        const vehicleTrips = allTrips.filter(t => (t.vehicleId === vehicle.id || t.vehicleNumber === vehicle.number) && 
            (t.status === 'completed' || t.status === 'broken-down' || t.status === 'reassigned')
        );
        
        let totalKmRun = 0;
        
        vehicleTrips.forEach(t => {
            let kmRun = 0;
            if (t.odometerEnd && t.odometerStart) {
                kmRun = t.odometerEnd - t.odometerStart;
            } else if (t.breakdownOdometer && t.odometerStart) {
                kmRun = t.breakdownOdometer - t.odometerStart;
            }
            if (t.kmRun) { 
                kmRun = Number(t.kmRun);
            }
            totalKmRun += kmRun;
        });

        const totalVehicleMileage = vehicle.initialMileage ? Number(vehicle.initialMileage) + totalKmRun : totalKmRun;
        const lastServiceMileage = Number(vehicle.lastServiceMileage || 0);
        const serviceInterval = parseFloat(vehicle.serviceInterval) || 5000;
        const kmSinceService = totalVehicleMileage - lastServiceMileage;
        const isServiceDue = kmSinceService >= serviceInterval;
        const remainingKm = Math.max(0, serviceInterval - kmSinceService);

        // --- License Status Check ---
        const today = new Date();
        const expiryDate = vehicle.licenseExpiry ? new Date(vehicle.licenseExpiry) : null;
        let licenseStatus = 'valid';
        let daysToExpiry = 0;

        if (expiryDate) {
            const diffTime = expiryDate.getTime() - today.getTime();
            daysToExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (daysToExpiry < 0) licenseStatus = 'expired';
            else if (daysToExpiry <= 90) licenseStatus = 'warning';
        }

        const isServiceCritical = remainingKm <= 500;
        const isCriticalRisk = isServiceCritical || licenseStatus !== 'valid';

        // --- EFFECTIVE STATUS OVERRIDE ---
        const relevantTripsForStatus = allTrips.filter(t => !['completed', 'cancelled', 'rejected', 'broken-down'].includes(t.status));

        const isVehicleInActiveTrip = relevantTripsForStatus.some(t => 
            (t.vehicleId === vehicle.id || t.vehicleNumber === vehicle.number) && 
            isTodayOrInProgress(t)
        );

        let effectiveStatus = 'available'; // Default to Available

        if (vehicle.status === 'in-maintenance') {
            effectiveStatus = 'in-maintenance'; 
        } else if (isVehicleInActiveTrip) {
            effectiveStatus = 'in-use'; 
        } else if (vehicle.status === 'assigned' || vehicle.status === 'available') { 
            effectiveStatus = 'available'; 
        }
        
        const displayStatus = effectiveStatus; // Final status for the UI badge

        return { totalKm: totalVehicleMileage, kmSinceService, isServiceDue, remainingKm, serviceInterval, licenseStatus, daysToExpiry, isCriticalRisk, displayStatus };
    };


    // 1. Real-Time Fetch (Retained)
    useEffect(() => {
        setLoading(true);
        
        // --- Image Loading (Errors handled by .catch) ---
        loadBase64Image('/report-header.png').then(data => { setHeaderImageData(data); }).catch(e => console.error("Header image loading error:", e));
        loadBase64Image('/report-footer.png').then(data => { setFooterImageData(data); }).catch(e => console.error("Footer image loading error:", e));
        
        
        const unsubscribers: (() => void)[] = [];
        let latestVehicles: any[] = [];
        let latestTrips: any[] = [];

        const recalculateStatus = () => {
            const vehiclesWithStats = latestVehicles.map(v => ({ ...v, stats: getVehicleStats(v, latestTrips) }));
            
            // Spread stats onto vehicle object and use the calculated displayStatus
            const vehiclesForState = vehiclesWithStats.map(v => ({ 
                ...v, 
                ...v.stats,
                status: v.stats.displayStatus 
            }));
            
            setVehicles(vehiclesForState); 
            
            const criticals = vehiclesWithStats.filter(v => v.stats.isCriticalRisk);
            setCriticalVehicles(criticals);
            
            const alerts = vehiclesWithStats
                .filter(v => v.stats.licenseStatus !== 'valid')
                .map(v => ({
                    number: v.number,
                    daysToExpiry: v.stats.daysToExpiry,
                    status: v.stats.licenseStatus,
                }));
            setLicenseAlerts(alerts);
        };

        const unsubVehicles = onSnapshot(collection(db, "vehicles"), (snapshot) => {
            latestVehicles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (latestTrips.length > 0) {
                recalculateStatus();
            } else {
                setVehicles(latestVehicles);
            }
        });
        unsubscribers.push(unsubVehicles);
        
        const unsubTrips = onSnapshot(collection(db, "trip_requests"), (snapshot) => {
            latestTrips = snapshot.docs.map(doc => doc.data());
            setTrips(latestTrips);
            recalculateStatus(); // Recalculate whenever trips change
            setLoading(false);
        });
        unsubscribers.push(unsubTrips);
        
        // Fetch Fuel Logs for Report Generation
        const unsubFuelLogs = onSnapshot(query(collection(db, "fuel_logs"), orderBy("timestamp", "desc"), limit(100)), (snapshot) => {
            setFuelLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        unsubscribers.push(unsubFuelLogs);
        

        return () => unsubscribers.forEach(unsub => unsub());
    }, []);
    

    // 3. Image Header Function for PDF (Retained)
    const addHeader = (doc: jsPDF, imageData: typeof headerImageData) => {
        const pageWidth = doc.internal.pageSize.width;
        const fixedWidth = 180; 
        let y = 5;

        if (imageData && imageData.data) {
            const aspectRatio = imageData.height / imageData.width;
            const calculatedHeight = fixedWidth * aspectRatio;
            // PDF Fix: Use the cached image data and type
            doc.addImage(imageData.data, imageData.type, (pageWidth - fixedWidth) / 2, y, fixedWidth, calculatedHeight);
            y += calculatedHeight + 5; 
            return y; 
        } else {
            // Fallback text header
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text("Carlos Transport System", pageWidth / 2, 15, { align: 'center' });
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text("Veyangoda | Katunayake | Horana | Trincomalee", pageWidth / 2, 25, { align: 'center' });
            return 35;
        }
    };

    // NEW: Image Footer Function for PDF (Retained)
    const addFooter = (doc: jsPDF, imageData: typeof footerImageData) => {
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const fixedWidth = 190;
        
        if (imageData && imageData.data) {
            const aspectRatio = imageData.height / imageData.width;
            const calculatedHeight = fixedWidth * aspectRatio;
            // PDF Fix: Use the cached image data and type
            doc.addImage(imageData.data, imageData.type, (pageWidth - fixedWidth) / 2, pageHeight - calculatedHeight - 5, fixedWidth, calculatedHeight);
            return pageHeight - calculatedHeight - 10;
        } else {
            // Fallback text footer
            doc.setFontSize(10);
            doc.text("Healthier ...... WealthIER...... HAPPIER Carlos", pageWidth / 2, pageHeight - 10, { align: 'center' });
            return pageHeight - 20;
        }
    };


    // 4. Actions & Handlers
    
    // --- Fuel Log Logic (Retained) ---
    const openFuelLogModal = (vehicle: any) => { /* ... (Logic retained) ... */
        setSelectedVehicle(vehicle);
        setFuelData({
            date: new Date().toISOString().split('T')[0],
            odometer: '',
            liters: '',
            cost: '',
            location: '',
        });
        setShowFuelLogModal(true);
    };
    
    const handleLogFuel = async () => { /* ... (Logic retained) ... */
        if (!selectedVehicle || !fuelData.odometer || !fuelData.liters || !fuelData.cost) {
            alert('Please fill in Odometer, Liters, and Cost.');
            return;
        }
        
        const odometer = Number(fuelData.odometer);
        const liters = Number(fuelData.liters);
        const cost = Number(fuelData.cost);
        
        if (odometer <= 0 || liters <= 0 || cost <= 0) {
            alert('Values must be greater than zero.');
            return;
        }
        
        try {
            await addDoc(collection(db, "fuel_logs"), {
                vehicleId: selectedVehicle.id,
                vehicleNumber: selectedVehicle.number,
                date: fuelData.date,
                odometer: odometer,
                liters: liters,
                cost: cost,
                location: fuelData.location,
                loggedBy: user.name || user.email,
                timestamp: new Date().toISOString()
            });
            
            console.log(`Fuel log saved for ${selectedVehicle.number}.`);
            alert(`Fuel log saved for ${selectedVehicle.number}.`);
            setShowFuelLogModal(false);
            
        } catch(e) {
            console.error(e);
            alert("Failed to save fuel log.");
        }
    };

    // --- Core Action: Force Set Vehicle to Available (Retained) ---
    const handleForceAvailable = async (vehicle: any) => { /* ... (Logic retained) ... */
        if (vehicle.status === 'in-use') {
            alert("Vehicle is currently IN USE (on an active trip today). Cannot be set to available.");
            return;
        }
        if (vehicle.status === 'in-maintenance') {
            alert("Vehicle is IN MAINTENANCE. Please mark the repair as complete first.");
            return;
        }

        if (!confirm(`Are you sure you want to manually set vehicle ${vehicle.number} status to 'Available'? This overrides the current assigned status.`)) {
            return;
        }

        try {
            // Update Firestore status to 'available'
            await updateDoc(doc(db, "vehicles", vehicle.id), {
                status: 'available',
            });
            
            await logAction(user.email, 'VEHICLE_FORCE_AVAILABLE', `Manually set vehicle ${vehicle.number} to 'Available'.`, { targetId: vehicle.id });
            alert(`Vehicle ${vehicle.number} status set to Available.`);
            
        } catch (error) {
            console.error("Error setting vehicle available:", error);
            alert("Failed to update vehicle status.");
        }
    };


    // --- Vehicle CRUD ---
    const openAddModal = () => {
        setIsEditing(false);
        setFormData({ 
            number: '', model: '', type: 'Car', seats: '', rate: '', serviceInterval: '5000',
            licenseExpiry: '', insuranceExpiry: '', ownerName: '', ownerPhone: '', chassisNumber: '', engineNumber: '',
            requiredLicenseType: 'B',
            plant: PLANT_LOCATIONS[0] || 'Unassigned' // 🌟 NEW DEFAULT 🌟
        });
        setShowAddModal(true);
    };

    const openEditModal = (vehicle: any) => {
        setIsEditing(true);
        setSelectedVehicleId(vehicle.id);
        setSelectedVehicle(vehicle);
        setFormData({
            number: vehicle.number,
            model: vehicle.model,
            type: vehicle.type,
            seats: vehicle.seats,
            rate: vehicle.ratePerKm || '',
            serviceInterval: vehicle.serviceInterval || '5000', 
            licenseExpiry: vehicle.licenseExpiry || '',
            insuranceExpiry: vehicle.insuranceExpiry || '',
            ownerName: vehicle.ownerName || '',
            ownerPhone: vehicle.ownerPhone || '',
            chassisNumber: vehicle.chassisNumber || '',
            engineNumber: vehicle.engineNumber || '',
            requiredLicenseType: vehicle.requiredLicenseType || 'B',
            plant: vehicle.plant || PLANT_LOCATIONS[0] || 'Unassigned' // 🌟 NEW LOAD VALUE 🌟
        });
        setShowAddModal(true);
    };

    const handleSubmitVehicle = async () => {
        if (!formData.number || !formData.rate) { alert('Fill required fields'); return; }
        try {
            const data = {
                number: formData.number,
                model: formData.model,
                type: formData.type,
                seats: parseInt(formData.seats.toString()),
                ratePerKm: parseFloat(formData.rate.toString()),
                serviceInterval: parseFloat(formData.serviceInterval.toString()),
                licenseExpiry: formData.licenseExpiry,
                insuranceExpiry: formData.insuranceExpiry,
                ownerName: formData.ownerName,
                ownerPhone: formData.ownerPhone,
                requiredLicenseType: formData.requiredLicenseType,
                plant: formData.plant, // 🌟 SAVE PLANT FIELD 🌟
                ...(isEditing ? {} : { chassisNumber: formData.chassisNumber, engineNumber: formData.engineNumber })
            };

            if (isEditing && selectedVehicleId) {
                await updateDoc(doc(db, "vehicles", selectedVehicleId), data);
                await logAction(user.email, 'VEHICLE_UPDATE', `Updated vehicle ${formData.number} (Plant: ${formData.plant})`, { targetId: selectedVehicleId });
                alert('Vehicle updated!');
            } else {
                const initialLog = { rate: parseFloat(formData.rate.toString()), changedBy: `${user.name} (Admin)`, date: new Date().toISOString(), previousRate: 0 };
                const newDocRef = await addDoc(collection(db, "vehicles"), {
                    ...data,
                    chassisNumber: formData.chassisNumber,
                    engineNumber: formData.engineNumber,
                    status: 'available',
                    lastServiceMileage: 0, 
                    initialMileage: 0, 
                    repairs: [], services: [], rateHistory: [initialLog], licenseHistory: [], fuelHistory: [],
                    createdAt: new Date().toISOString()
                });
                await logAction(user.email, 'VEHICLE_ADD', `Added vehicle ${formData.number} (Plant: ${formData.plant})`, { targetId: newDocRef.id });
                alert('Vehicle added!');
            }
            setShowAddModal(false);
        } catch (error) { console.error(error); }
    };
    
    const handleDelete = async (id: string) => { /* ... (Logic retained) ... */
        const vehicle = vehicles.find(v => v.id === id);
        if (confirm(`Are you sure you want to delete vehicle ${vehicle?.number}?`)) {
            try { 
                await deleteDoc(doc(db, "vehicles", id)); 
                await logAction(user.email, 'DELETE_VEHICLE', `Deleted vehicle ID: ${id} (${vehicle?.number})`, { targetId: id });
            } catch (error) { console.error("Error deleting:", error); alert("Failed to delete."); }
        }
    };
    
    // --- Rate Logic (Retained) ---
    const handleUpdateRate = async () => { /* ... (Logic retained) ... */
        if (!selectedVehicle || !newRate) return;
        try {
            const rateVal = parseFloat(newRate);
            const vehicleRef = doc(db, "vehicles", selectedVehicle.id); 
            const newLog = {
                rate: rateVal,
                previousRate: selectedVehicle.ratePerKm || 0,
                changedBy: `${user.name} (Admin)`,
                date: new Date().toISOString()
            };
            await updateDoc(vehicleRef, {
                ratePerKm: rateVal,
                rateHistory: arrayUnion(newLog)
            });
            await logAction(user.email, 'RATE_UPDATE', `Updated rate for ${selectedVehicle.number} from ${selectedVehicle.ratePerKm} to ${rateVal}`, { targetId: selectedVehicle.id });
            alert(`Rate updated to LKR ${rateVal}/km`);
            setShowRateModal(false);
            setNewRate('');
        } catch(e) { console.error(e); alert("Failed to update rate"); }
    };
    
    // --- Repair Logic (Retained) ---
    const handleStartRepair = async () => { /* ... (Logic retained) ... */
        if (!selectedVehicle || !repairStartData.issue) return;
        try {
            const vehicleRef = doc(db, "vehicles", selectedVehicle.id);
            const startLog = {
                status: 'in-progress',
                issue: repairStartData.issue,
                date: repairStartData.date,
                reportedBy: repairStartData.reportedBy,
                timestamp: new Date().toISOString()
            };

            await updateDoc(vehicleRef, {
                status: 'in-maintenance', 
                repairs: arrayUnion(startLog) 
            });
            
            await logAction(user.email, 'MAINTENANCE_START', `Vehicle ${selectedVehicle.number} maintenance started: ${repairStartData.issue}`, { targetId: selectedVehicle.id });
            alert(`Vehicle marked as Maintenance: ${repairStartData.issue}`);
            setShowRepairModal(false);
            setRepairStartData({ date: new Date().toISOString().split('T')[0], issue: '', reportedBy: 'Admin' });
        } catch (error) { console.error(error); }
    };

    const handleFinishRepair = async () => { /* ... (Logic retained) ... */
        if (!selectedVehicle) return;
        try {
            const vehicleRef = doc(db, "vehicles", selectedVehicle.id);
            
            const repairs = selectedVehicle.repairs || [];
            let updatedRepairs = [...repairs];
            const lastInProgressIndex = updatedRepairs.findIndex((r: any) => r.status === 'in-progress');

            const completionLog = {
                cost: `LKR ${parseFloat(repairEndData.cost).toFixed(2)}`,
                description: repairEndData.description,
                endDate: repairEndData.date,
                status: 'completed',
                completedBy: `${user.name} (Admin)`,
                timestamp: new Date().toISOString()
            };
            
            if (lastInProgressIndex !== -1) {
                updatedRepairs[lastInProgressIndex] = { ...updatedRepairs[lastInProgressIndex], ...completionLog };
            } else {
                updatedRepairs.push({ issue: repairEndData.description, ...completionLog });
            }

            await updateDoc(vehicleRef, {
                status: 'available', // Mark available again
                repairs: updatedRepairs 
            });

            await logAction(user.email, 'MAINTENANCE_END', `Vehicle ${selectedVehicle.number} maintenance finished. Cost: ${completionLog.cost}`, { targetId: selectedVehicle.id });
            alert("Repair completed & logged. Vehicle is now Available.");
            setShowRepairDoneModal(false);
            setRepairEndData({ date: new Date().toISOString().split('T')[0], cost: '', description: '' });
        } catch(e) { console.error(e); alert("Failed to finish repair."); }
    };

    // --- Service Logic (Retained) ---
    const handleLogService = async () => { /* ... (Logic retained) ... */
        if (!selectedVehicle) return;
        
        const mileage = parseFloat(serviceData.mileage);
        const cost = parseFloat(serviceData.cost);
        
        if (mileage <= (selectedVehicle.lastServiceMileage || 0)) {
            alert(`New service mileage (${mileage} km) must be greater than the last recorded service mileage (${selectedVehicle.lastServiceMileage || 0} km).`);
            return;
        }

        try {
            const vehicleRef = doc(db, "vehicles", selectedVehicle.id);
            
            const newService = { 
                ...serviceData, 
                mileage: mileage,
                cost: `LKR ${cost.toFixed(2)}`,
                loggedBy: `${user.name} (Admin)`,
                timestamp: new Date().toISOString()
            };

            await updateDoc(vehicleRef, {
                status: 'available', 
                lastServiceMileage: mileage, // CRITICAL FIX: Reset service tracking to current odometer
                services: arrayUnion(newService)
            });

            await logAction(user.email, 'SERVICE_LOG', `Vehicle ${selectedVehicle.number} serviced at ${mileage} km. Cost: ${newService.cost}`, { targetId: selectedVehicle.id });
            alert(`Service recorded. Next service due at ${mileage + (parseFloat(selectedVehicle.serviceInterval) || 5000)} km.`);
            setShowServiceModal(false);
            setServiceData({ date: new Date().toISOString().split('T')[0], cost: '', mileage: '', notes: '' });
        } catch (error) { console.error(error); }
    };

    // --- License Logic (Retained) ---
    const handleRenewLicense = async () => { /* ... (Logic retained) ... */
        if(!selectedVehicle) return;
        try {
            const vehicleRef = doc(db, "vehicles", selectedVehicle.id); 
            const newLog = {
                ...licenseData,
                updatedBy: `${user.name} (Admin)`,
                previousLicenseExpiry: selectedVehicle.licenseExpiry || 'N/A'
            };
            await updateDoc(vehicleRef, {
                licenseExpiry: licenseData.newLicenseExpiry,
                insuranceExpiry: licenseData.newInsuranceExpiry,
                insurancePolicyNo: licenseData.insurancePolicyNo, 
                insuranceProvider: licenseData.insuranceProvider,
                licenseHistory: arrayUnion(newLog)
            });

            await logAction(user.email, 'LICENSE_UPDATE', `Vehicle ${selectedVehicle.number} license/insurance renewed. New expiry: ${licenseData.newLicenseExpiry}`, { targetId: selectedVehicle.id });
            alert("License details updated.");
            setShowLicenseModal(false);
        } catch(e) { console.error(e); alert("Failed to update license."); }
    };

    const openLicenseModal = (vehicle: any) => { /* ... (Logic retained) ... */
        setSelectedVehicle(vehicle);
        setLicenseData({
            renewalDate: new Date().toISOString().split('T')[0],
            newLicenseExpiry: vehicle.licenseExpiry || '',
            licenseCost: '',
            newInsuranceExpiry: vehicle.insuranceExpiry || '',
            insurancePolicyNo: vehicle.insurancePolicyNo || '',
            insuranceProvider: vehicle.insuranceProvider || '',
            insuranceCost: '',
            notes: ''
        });
        setShowLicenseModal(true);
    };

    // --- Reports (Retained) ---
    const generateVehiclePass = async (v: any) => { /* ... (Logic retained) ... */
        try {
            const doc = new jsPDF();
            const marginX = 14; 
            const today = new Date().toLocaleDateString();
            
            const header = headerImageData;
            const footer = footerImageData;

            let y = addHeader(doc, header);
            y += 10;
            
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text(`Vehicle Pass: ${v.number}`, marginX, y); 
            y += 10;
            
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Date Generated: ${today}`, marginX, y);
            y += 10;

            doc.setFontSize(12);
            doc.text(`Model: ${v.model || 'N/A'}`, marginX, y);
            y += 7;
            doc.text(`Chassis: ${v.chassisNumber || '-'}`, marginX, y);
            y += 7;
            doc.text(`Engine: ${v.engineNumber || '-'}`, marginX, y);
            y += 7;
            doc.text(`Owner: ${v.ownerName || '-'} (${v.ownerPhone || '-'})`, marginX, y);
            y += 7;
            doc.text(`Required License Type: ${v.requiredLicenseType || 'N/A'}`, marginX, y); 
            y += 7;
            doc.text(`Current License Exp: ${v.licenseExpiry || 'N/A'}`, marginX, y);
            y += 7;
            doc.text(`Current Insurance Exp: ${v.insuranceExpiry || 'N/A'}`, marginX, y);
            y += 7; // 🌟 NEW: ADD PLANT LOCATION 🌟
            doc.text(`Registered Plant: ${v.plant || 'N/A'}`, marginX, y);
            y += 10;

            doc.setFontSize(16);
            doc.text(`Total Mileage: ${getVehicleStats(v, trips).totalKm.toFixed(1)} km`, marginX, y);
            y += 7;
            doc.text(`Status: ${v.status.toUpperCase()}`, marginX, y);
            y += 10;

            doc.setFontSize(10);
            doc.text("This pass authorizes the vehicle listed above for official company travel.", marginX, y);
            y += 5;
            doc.text("Issued by Transport Management.", marginX, y);
            y += 5;
            doc.text(`Plant of Registration: ${v.plant || 'N/A'}`, marginX, y); // 🌟 ADD PLANT LOCATION 🌟
            
            doc.save(`Pass_${v.number}_${today}.pdf`);
        } catch (error) {
            console.error("PDF generation failed:", error);
            alert("Failed to generate PDF. Check console for details.");
        }
    };
    
    // --- GENERATE REPORT (Retained) ---
    const generateReport = async (v: any, selectedSections?: ('repair' | 'service' | 'fuel' | 'license')[] | undefined) => { /* ... (Logic retained) ... */
        const doc = new jsPDF();
        
        const marginX = 14; 
        
        const sectionsToInclude = selectedSections || ['repair', 'service', 'fuel', 'license'];

        const imageData = headerImageData;

        let vehicleFuelLogs: any[] = [];
        if (sectionsToInclude.includes('fuel')) {
            try {
                const q = query(collection(db, "fuel_logs"), where("vehicleId", "==", v.id), orderBy("timestamp", "desc"));
                const fuelSnap = await getDocs(q);
                vehicleFuelLogs = fuelSnap.docs.map(doc => doc.data());
            } catch (error) { console.error("Failed to fetch Fuel Logs:", error); }
        }

        const stats = getVehicleStats(v, trips);
        let currentY = 0;
        let tableCounter = 0; 

        const drawHeaderForPage = (data: any) => {
            tableCounter = 0;
            let startY = addHeader(doc, imageData); 
            startY += 5;

            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text(`Vehicle Report: ${v.number}`, marginX, startY);
            startY += 8;

            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Model: ${v.model || 'N/A'} (${v.type || 'N/A'})`, marginX, startY);
            startY += 5;
            doc.text(`Chassis: ${v.chassisNumber || '-'}`, marginX, startY);
            startY += 5;
            doc.text(`Engine: ${v.engineNumber || '-'}`, marginX, startY);
            startY += 5;
            doc.text(`Owner: ${v.ownerName || '-'} (${v.ownerPhone || '-'})`, marginX, startY);
            startY += 5;
            doc.text(`Required License Type: ${v.requiredLicenseType || 'N/A'}`, marginX, startY); 
            startY += 5;
            doc.text(`Current License Exp: ${v.licenseExpiry || 'N/A'}`, marginX, startY);
            startY += 5;
            doc.text(`Current Insurance Exp: ${v.insuranceExpiry || 'N/A'}`, marginX, startY);
            startY += 5; // 🌟 NEW: ADD PLANT LOCATION 🌟
            doc.text(`Registered Plant: ${v.plant || 'N/A'}`, marginX, startY);
            startY += 8;
            
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`Total Mileage: ${stats.totalKm.toFixed(1)} km`, marginX, startY);
            startY += 5;
            doc.text(`Status: ${v.status.toUpperCase()}`, marginX, startY);
            startY += 10;
            doc.setFont(undefined, 'normal');
            
            return startY; 
        }

        try {
            currentY = drawHeaderForPage({ pageNumber: 1 });
            
            // --- SECTION 1: LICENSE HISTORY ---
            if (sectionsToInclude.includes('license')) {
                if (currentY > 260) { doc.addPage(); currentY = drawHeaderForPage({ pageNumber: doc.internal.pages.length }); }
                
                doc.setFontSize(14);
                doc.text(`${tableCounter + 1}. License History`, marginX, currentY);
                currentY += 5;

                const licenseData = (v.licenseHistory || []).filter((l: any) => l).map((l: any) => [
                    (l.renewalDate || l.date) ? new Date(l.renewalDate || l.date).toLocaleDateString() : 'N/A', 
                    l.newLicenseExpiry || '-',
                    l.newInsuranceExpiry || '-',
                    l.insurancePolicyNo || '-',
                    `L ${l.licenseCost || 'N/A'}/${l.insuranceCost || 'N/A'}` 
                ]);
                
                autoTable(doc, {
                    startY: currentY,
                    head: [['Date', 'Lic Exp', 'Ins Exp', 'Policy', 'Cost (Lic/Ins)']],
                    body: licenseData,
                    theme: 'grid',
                    headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255] },
                    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
                    didDrawPage: (data) => { 
                        if (data.pageNumber > 1 && data.cursor.y < 35) {
                            currentY = drawHeaderForPage(data);
                            data.cursor.y = currentY; 
                        }
                    },
                    margin: { top: 30, left: marginX, right: marginX } 
                });
                currentY = (doc as any).lastAutoTable.finalY + 10;
                tableCounter++;
            }

            
            // --- SECTION 2: REPAIR HISTORY ---
            if (sectionsToInclude.includes('repair')) {
                if (currentY > 260 || (tableCounter > 0 && currentY < 35)) { doc.addPage(); currentY = drawHeaderForPage({ pageNumber: doc.internal.pages.length }); }
                
                doc.setFontSize(14);
                doc.text(`${tableCounter + 1}. Repair History`, marginX, currentY);
                currentY += 5;

                const repairData = (v.repairs || []).filter((r: any) => r && (r.timestamp || r.date)).map((r: any) => [
                    (r.timestamp || r.date) ? new Date(r.timestamp || r.date).toLocaleDateString() : 'N/A', 
                    r.issue || '-', 
                    r.cost || 'N/A', 
                    r.description || '-' 
                ]);
                
                autoTable(doc, {
                    startY: currentY,
                    head: [['Date', 'Issue', 'Cost', 'Desc']], 
                    body: repairData,
                    theme: 'grid',
                    headStyles: { fillColor: [249, 115, 22] },
                    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
                    didDrawPage: (data) => { 
                        if (data.pageNumber > 1 && data.cursor.y < 35) {
                            currentY = drawHeaderForPage(data);
                            data.cursor.y = currentY; 
                        }
                    },
                    margin: { top: 30, left: marginX, right: marginX }
                });
                currentY = (doc as any).lastAutoTable.finalY + 10;
                tableCounter++;
            }
            
            // --- SECTION 3: SERVICE HISTORY ---
            if (sectionsToInclude.includes('service')) {
                if (currentY > 260 || (tableCounter > 0 && currentY < 35)) { doc.addPage(); currentY = drawHeaderForPage({ pageNumber: doc.internal.pages.length }); }
                
                doc.setFontSize(14);
                doc.text(`${tableCounter + 1}. Service History`, marginX, currentY);
                currentY += 5;

                const serviceData = (v.services || []).filter((s: any) => s && (s.timestamp || s.date)).map((s: any) => [
                    new Date(s.timestamp || s.date).toLocaleDateString() || 'N/A', s.mileage || 'N/A', s.cost || 'N/A', s.notes || '-'
                ]);

                autoTable(doc, {
                    startY: currentY,
                    head: [['Date', 'Mileage Logged', 'Cost', 'Notes']],
                    body: serviceData,
                    theme: 'grid',
                    headStyles: { fillColor: [34, 197, 94] },
                    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
                    didDrawPage: (data) => { 
                        if (data.pageNumber > 1 && data.cursor.y < 35) {
                            currentY = drawHeaderForPage(data);
                            data.cursor.y = currentY; 
                        }
                    },
                    margin: { top: 30, left: marginX, right: marginX } 
                });
                currentY = (doc as any).lastAutoTable.finalY + 10;
                tableCounter++;
            }
            
            // --- SECTION 4: FUEL LOG HISTORY ---
            if (sectionsToInclude.includes('fuel') && vehicleFuelLogs.length > 0) {
                if (currentY > 260 || (tableCounter > 0 && currentY < 35)) { doc.addPage(); currentY = drawHeaderForPage({ pageNumber: doc.internal.pages.length }); }
                
                doc.setFontSize(14);
                doc.text(`${tableCounter + 1}. Fuel Log History`, marginX, currentY);
                currentY += 5;

                const fuelTableData = vehicleFuelLogs.filter((f: any) => f && f.timestamp).map((f: any) => [
                    new Date(f.timestamp).toLocaleDateString(), 
                    f.odometer || 'N/A', 
                    f.liters ? `${f.liters} L` : 'N/A', 
                    f.cost ? `LKR ${f.cost.toFixed(2)}` : 'N/A', 
                    f.location || '-'
                ]);

                autoTable(doc, {
                    startY: currentY,
                    head: [['Date', 'Odometer (km)', 'Liters', 'Cost (LKR)', 'Location']],
                    body: fuelTableData,
                    theme: 'grid',
                    headStyles: { fillColor: [251, 191, 36] }, 
                    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
                    didDrawPage: (data) => { 
                        if (data.pageNumber > 1 && data.cursor.y < 35) {
                            currentY = drawHeaderForPage(data);
                            data.cursor.y = currentY; 
                        }
                    },
                    margin: { top: 30, left: marginX, right: marginX } 
                });
            }

            // Save PDF
            doc.save(`Vehicle_Report_${v.number}.pdf`);

        } catch (error) {
            console.error("PDF drawing crashed unexpectedly:", error);
            alert("CRITICAL ERROR: The report generator failed. Please check the console for index errors or contact support.");
        }
    };

    // Handler to open modal and select vehicle (Retained)
    const handleOpenReportModal = (vehicle: any) => {
        setSelectedVehicle(vehicle);
        setReportSections({ repair: true, service: true, fuel: true, license: true }); // Default selection
        setShowReportOptionsModal(true);
    };
    
    // Handler to execute report from modal (Retained)
    const handleGenerateFilteredReport = () => {
        if (!selectedVehicle) return;
        const sections: ('repair' | 'service' | 'fuel' | 'license')[] = [];
        if (reportSections.repair) sections.push('repair');
        if (reportSections.service) sections.push('service');
        if (reportSections.fuel) sections.push('fuel');
        if (reportSections.license) sections.push('license');

        setShowReportOptionsModal(false);
        generateReport(selectedVehicle, sections);
    };

    if (loading) return <div className="p-10 text-center">Loading Fleet...</div>;

    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="vehicle-management" />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <button onClick={() => onNavigate('admin-dashboard')} className="mb-2 text-gray-500 hover:text-gray-900 flex items-center gap-1 font-medium transition-colors"><ArrowLeft size={18}/> Back to Dashboard</button>
                        <h1 className="text-3xl text-gray-900 mb-2">Fleet Maintenance</h1>
                        <p className="text-gray-600">Manage fleet, repairs, service and pricing</p>
                    </div>
                    <button onClick={openAddModal} className="px-6 py-3 bg-[#2563EB] text-white rounded-xl flex items-center gap-2 hover:bg-[#1E40AF]">
                        <Plus className="w-5 h-5" /> Add Vehicle
                    </button>
                </div>
                
                {/* 🚨 ALERT SECTIONS (Retained) */}
                {licenseAlerts.length > 0 && (
                    <div className="space-y-4 mb-8">
                        {licenseAlerts.map((alert: any) => (
                            <Card key={alert.number} className="p-4 flex justify-between items-center border-l-4 border-red-500 bg-red-50/70">
                                <div className="flex items-center gap-4">
                                    <ShieldAlert className="w-6 h-6 text-red-600 flex-shrink-0" />
                                    <div>
                                        <h3 className="font-bold text-gray-900">{alert.number} - License Alert</h3>
                                        <p className="text-sm text-gray-700">
                                            {alert.status === 'expired' ? (
                                                <span className="font-semibold text-red-700">License Expired!</span>
                                            ) : (
                                                <span className="font-semibold">License Expires in {alert.daysToExpiry} days</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => {
                                        const vehicle = vehicles.find(v => v.number === alert.number);
                                        if (vehicle) openLicenseModal(vehicle);
                                    }}
                                    className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm hover:bg-red-700"
                                >
                                    Resolve Issue
                                </button>
                            </Card>
                        ))}
                    </div>
                )}

                {criticalVehicles.length > 0 && (
                    <div className="mb-8">
                        <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="w-6 h-6 text-orange-600 animate-pulse" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg text-gray-900 mb-2 font-bold">SERVICE/MILEAGE ALERT! ({criticalVehicles.length})</h3>
                                    <p className="text-gray-600 mb-4 text-sm">
                                        {criticalVehicles.length} vehicle(s) require immediate attention due to service or license issues.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* 🚨 END ALERT SECTIONS */}

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"> 
                    {vehicles.map((vehicle) => {
                        const stats = getVehicleStats(vehicle, trips);
                        const percentage = Math.min((stats.kmSinceService / stats.serviceInterval) * 100, 100);
                        
                        const cardClass = stats.isCriticalRisk ? 'bg-red-50 border-2 border-red-200' : 'bg-white';
                        
                        const displayStatus = vehicle.status; 
                        const isUnavailable = displayStatus === 'in-maintenance' || displayStatus === 'in-use';
                        
                        // Set Icon colors based on the resolved status (in-maintenance should be orange)
                        const iconClass = displayStatus === 'in-maintenance' ? 
                            'bg-orange-100 text-orange-600' : 
                            displayStatus === 'in-use' ? 
                            'bg-yellow-100 text-yellow-600' : 
                            'bg-blue-100 text-blue-600';


                        return (
                            <Card key={vehicle.id} className={`p-6 ${cardClass}`}>
                                <div className="flex flex-col justify-between items-start gap-4 h-full"> 
                                    
                                    {/* Top Section */}
                                    <div className="flex flex-col gap-3 w-full flex-shrink-0">
                                        <div className="flex items-start gap-4 w-full"> 
                                            {/* Vehicle Icon and Status */}
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
                                                <Car className="w-6 h-6" />
                                            </div>
                                            <div className='flex-1'>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-bold">{vehicle.number}</h3>
                                                    <Badge status={displayStatus} size="sm" />
                                                </div>
                                                <div className="text-sm text-gray-500">{vehicle.model} • {vehicle.type}</div>
                                                <div className="text-sm text-green-600 font-bold">LKR {vehicle.ratePerKm}/km</div>
                                            </div>
                                        </div>

                                        {/* License & Service Health */}
                                        <div className="w-full pt-1">
                                            <div className="text-sm text-gray-500 mb-1">
                                                Plant: <span className="font-semibold text-gray-700">{vehicle.plant || 'N/A'}</span>
                                            </div>
                                            <div className={`text-xs font-medium ${stats.licenseStatus !== 'valid' ? 'text-red-600' : 'text-gray-400'} mb-1`}>
                                                Lic. Exp: {vehicle.licenseExpiry || 'N/A'} (Req: {vehicle.requiredLicenseType || 'N/A'})
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                <span>Service Health ({stats.totalKm.toFixed(0)} km)</span>
                                                <span className={stats.remainingKm < 500 ? "text-red-600 font-bold" : ""}>{stats.remainingKm.toFixed(0)} km left</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2.5"><div className={`h-2.5 rounded-full ${stats.isServiceDue ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${percentage}%` }}></div></div>
                                        </div>
                                    </div>
                                    
                                    {/* Action Buttons (Middle/Bottom) */}
                                    <div className="flex flex-col w-full pt-4 border-t border-gray-100 mt-auto">
                                        
                                        {/* 💥 NEW ACTION BUTTON: Force Available 💥 */}
                                        {displayStatus !== 'available' && (
                                            <button
                                                onClick={() => handleForceAvailable(vehicle)}
                                                disabled={isUnavailable}
                                                className={`w-full mb-3 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-xl transition-colors ${
                                                    isUnavailable 
                                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                                                        : 'bg-green-600 text-white hover:bg-green-700'
                                                }`}
                                                title={isUnavailable ? `Cannot make available while ${displayStatus.toUpperCase().replace('-', ' ')}` : 'Force set status to Available'}
                                            >
                                                <Check className="w-4 h-4" /> Make Available
                                            </button>
                                        )}
                                        
                                        {/* Maintenance/Rate/Report Quick Icons */}
                                        <div className="flex gap-2 flex-wrap mb-2">
                                            <button onClick={() => openFuelLogModal(vehicle)} className="p-2 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100" title="Log Fuel"><Fuel className="w-5 h-5" /></button>
                                            <button onClick={() => openLicenseModal(vehicle)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="Renew License/Insurance"><ShieldCheck className="w-5 h-5" /></button>
                                            <button onClick={() => generateVehiclePass(vehicle)} className="p-2 bg-gray-100 text-gray-600 rounded-lg" title="Print Pass"><Printer className="w-5 h-5" /></button>
                                            <button onClick={() => { setSelectedVehicle(vehicle); setNewRate(vehicle.ratePerKm || ''); setShowRateModal(true); }} className="p-2 bg-green-50 text-green-600 rounded-lg" title="Change Rate"><DollarSign className="w-5 h-5" /></button>
                                            <button onClick={() => { setSelectedVehicle(vehicle); setShowRateHistoryModal(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-lg" title="Rate History"><TrendingUp className="w-5 h-5" /></button>
                                        </div>

                                        {/* CRUD/Repair Icons */}
                                        <div className="flex gap-2 flex-wrap">
                                            {vehicle.status === 'in-maintenance' ? (
                                                <button onClick={() => { setSelectedVehicle(vehicle); setShowRepairDoneModal(true); }} className="p-2 bg-orange-600 text-white rounded-lg animate-pulse" title="Mark Repair Done"><CheckCircle className="w-5 h-5" /></button>
                                            ) : (
                                                <button onClick={() => { setSelectedVehicle(vehicle); setShowRepairModal(true); }} className="p-2 bg-orange-50 text-orange-600 rounded-lg" title="Log Repair"><Wrench className="w-5 h-5" /></button>
                                            )}

                                            <button onClick={() => { setSelectedVehicle(vehicle); setShowServiceModal(true); }} className="p-2 bg-green-50 text-green-600 rounded-lg" title="Log Service"><Clock className="w-5 h-5" /></button>
                                            
                                            <button onClick={() => handleOpenReportModal(vehicle)} className="p-2 bg-gray-100 text-gray-700 rounded-lg" title="Generate Report"><FileText className="w-5 h-5" /></button>
                                            
                                            <button onClick={() => openEditModal(vehicle)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg" title="Edit"><Edit className="w-4 h-4" /></button>
                                            
                                            <button onClick={() => handleDelete(vehicle.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* MODALS SECTION */}
            
            {showRateModal && selectedVehicle && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-600"><DollarSign className="w-6 h-6"/> Update Rate for {selectedVehicle.number}</h3>
                        <p className="text-sm text-gray-500 mb-4">Current Rate: LKR {selectedVehicle.ratePerKm}/km</p>
                        
                        <label className="text-sm font-medium">New Rate (LKR/km)</label>
                        <input 
                            type="number" 
                            className="w-full p-3 border rounded-xl mt-1" 
                            value={newRate} 
                            onChange={e => setNewRate(e.target.value)} 
                            placeholder="e.g. 85.00" 
                        />
                        
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowRateModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
                            <button onClick={handleUpdateRate} className="flex-1 py-3 bg-green-600 text-white rounded-xl">Update Rate</button>
                        </div>
                    </Card>
                </div>
            )}
            
            {showLicenseModal && selectedVehicle && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-indigo-600"><ShieldCheck className="w-6 h-6"/> Renew License/Insurance: {selectedVehicle.number}</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2"><h4 className="text-sm font-bold text-gray-500 border-b pb-1 mb-2">License Details</h4></div>
                            <div><label className="text-xs">Renewal Date</label><input type="date" className="w-full p-2 border rounded-xl" value={licenseData.renewalDate} onChange={e => setLicenseData({...licenseData, renewalDate: e.target.value})} /></div>
                            <div><label className="text-xs">New License Expiry</label><input type="date" className="w-full p-2 border rounded-xl" value={licenseData.newLicenseExpiry} onChange={e => setLicenseData({...licenseData, newLicenseExpiry: e.target.value})} /></div>
                            <div className="col-span-1"><label className="text-xs">License Cost (LKR)</label><input type="number" className="w-full p-2 border rounded-xl" value={licenseData.licenseCost} onChange={e => setLicenseData({...licenseData, licenseCost: e.target.value})} placeholder="Cost" /></div>

                            <div className="col-span-2 mt-2"><h4 className="text-sm font-bold text-gray-500 border-b pb-1 mb-2">Insurance Details</h4></div>
                            <div><label className="text-xs">New Insurance Expiry</label><input type="date" className="w-full p-2 border rounded-xl" value={licenseData.newInsuranceExpiry} onChange={e => setLicenseData({...licenseData, newInsuranceExpiry: e.target.value})} /></div>
                            <div><label className="text-xs">Policy No.</label><input type="text" className="w-full p-2 border rounded-xl" value={licenseData.insurancePolicyNo} onChange={e => setLicenseData({...licenseData, insurancePolicyNo: e.target.value})} /></div>
                            <div><label className="text-xs">Provider</label><input type="text" className="w-full p-2 border rounded-xl" value={licenseData.insuranceProvider} onChange={e => setLicenseData({...licenseData, insuranceProvider: e.target.value})} /></div>
                            <div><label className="text-xs">Insurance Cost (LKR)</label><input type="number" className="w-full p-2 border rounded-xl" value={licenseData.insuranceCost} onChange={e => setLicenseData({...licenseData, insuranceCost: e.target.value})} placeholder="Cost" /></div>
                            
                            <div className="col-span-2"><label className="text-xs">Notes</label><textarea className="w-full p-2 border rounded-xl" rows={2} value={licenseData.notes} onChange={e => setLicenseData({...licenseData, notes: e.target.value})} /></div>

                        </div>
                        
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowLicenseModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
                            <button onClick={handleRenewLicense} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl">Save Renewal Details</button>
                        </div>
                    </Card>
                </div>
            )}

            {showReportOptionsModal && selectedVehicle && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">Generate Report Options</h3>
                        <p className="text-gray-600 mb-4">Select sections to include for **{selectedVehicle.number}**:</p>
                        
                        <div className="space-y-3 mb-6">
                            <div className="flex items-center gap-3">
                                <input type="checkbox" id="report_license" checked={reportSections.license} onChange={(e) => setReportSections({...reportSections, license: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                                <label htmlFor="report_license" className="font-medium text-gray-700">License/Insurance History</label>
                            </div>
                            <div className="flex items-center gap-3">
                                <input type="checkbox" id="report_repair" checked={reportSections.repair} onChange={(e) => setReportSections({...reportSections, repair: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                                <label htmlFor="report_repair" className="font-medium text-gray-700">Repair History</label>
                            </div>
                            <div className="flex items-center gap-3">
                                <input type="checkbox" id="report_service" checked={reportSections.service} onChange={(e) => setReportSections({...reportSections, service: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                                <label htmlFor="report_service" className="font-medium text-gray-700">Service History</label>
                            </div>
                            <div className="flex items-center gap-3">
                                <input type="checkbox" id="report_fuel" checked={reportSections.fuel} onChange={(e) => setReportSections({...reportSections, fuel: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                                <label htmlFor="report_fuel" className="font-medium text-gray-700">Fuel Log History</label>
                            </div>
                        </div>
                        
                        <div className="flex gap-3">
                            <button onClick={() => setShowReportOptionsModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
                            <button 
                                onClick={handleGenerateFilteredReport} 
                                disabled={!reportSections.repair && !reportSections.service && !reportSections.fuel && !reportSections.license}
                                className="flex-1 py-3 bg-blue-600 text-white rounded-xl disabled:opacity-50"
                            >
                                Generate PDF
                            </button>
                        </div>
                    </Card>
                </div>
            )}

            {showFuelLogModal && selectedVehicle && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4 text-yellow-700 flex items-center gap-2">
                            <Fuel className="w-6 h-6"/> Log Fuel for {selectedVehicle.number}
                        </h3>
                        <div className="space-y-4">
                            <div><label className="text-sm">Date</label><input type="date" className="w-full p-3 border rounded-xl" value={fuelData.date} onChange={e => setFuelData({...fuelData, date: e.target.value})} /></div>
                            <div><label className="text-sm">Current Odometer (km)</label><input type="number" className="w-full p-3 border rounded-xl" value={fuelData.odometer} onChange={e => setFuelData({...fuelData, odometer: e.target.value})} placeholder="e.g. 528735" /></div>
                            <div><label className="text-sm">Liters Purchased</label><input type="number" className="w-full p-3 border rounded-xl" value={fuelData.liters} onChange={e => setFuelData({...fuelData, liters: e.target.value})} placeholder="e.g. 35.5" /></div>
                            <div><label className="text-sm">Total Cost (LKR)</label><input type="number" className="w-full p-3 border rounded-xl" value={fuelData.cost} onChange={e => setFuelData({...fuelData, cost: e.target.value})} placeholder="e.g. 9826" /></div>
                            <div><label className="text-sm">Location/Station</label><input type="text" className="w-full p-3 border rounded-xl" value={fuelData.location} onChange={e => setFuelData({...fuelData, location: e.target.value})} placeholder="e.g. Negombo Filling Station" /></div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowFuelLogModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
                            <button onClick={handleLogFuel} className="flex-1 py-3 bg-yellow-600 text-white rounded-xl">Save Fuel Log</button>
                        </div>
                    </Card>
                </div>
            )}

            {showRateHistoryModal && selectedVehicle && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-600"><TrendingUp className="w-6 h-6"/> Rate History: {selectedVehicle.number}</h3>
                        
                        <div className="space-y-3">
                            {(selectedVehicle.rateHistory || []).slice().reverse().map((log: any, index: number) => (
                                <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="flex justify-between items-center text-sm font-medium">
                                        <span className="text-gray-900">LKR {log.rate}/km</span>
                                        <span className="text-xs text-gray-500">{new Date(log.date).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">
                                        Changed from LKR {log.previousRate || 0}/km by {log.changedBy}
                                    </div>
                                </div>
                            ))}
                            {(selectedVehicle.rateHistory || []).length === 0 && <p className="text-center text-gray-500">No rate history found.</p>}
                        </div>

                        <div className="flex justify-end mt-6">
                            <button onClick={() => setShowRateHistoryModal(false)} className="px-6 py-2 border rounded-xl">Close</button>
                        </div>
                    </Card>
                </div>
            )}
            
            {showRepairModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4 text-orange-600">Log Repair Issue</h3>
                        <div className="space-y-4">
                            <div><label className="text-sm">Issue Description</label><input className="w-full p-3 border rounded-xl" value={repairStartData.issue} onChange={e => setRepairStartData({...repairStartData, issue: e.target.value})} /></div>
                            <div><label className="text-sm">Date</label><input type="date" className="w-full p-3 border rounded-xl" value={repairStartData.date} onChange={e => setRepairStartData({...repairStartData, date: e.target.value})} /></div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowRepairModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
                            <button onClick={handleStartRepair} className="flex-1 py-3 bg-orange-600 text-white rounded-xl">Mark Maintenance</button>
                        </div>
                    </Card>
                </div>
            )}

            {showRepairDoneModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4 text-green-600">Complete Repair</h3>
                        <p className="text-sm text-gray-500 mb-4">Issue: {selectedVehicle?.repairs?.find((r:any) => r.status === 'in-progress')?.issue || 'N/A'}</p>
                        <div className="space-y-4">
                            <div><label className="text-sm">Final Cost (LKR)</label><input type="number" className="w-full p-3 border rounded-xl" value={repairEndData.cost} onChange={e => setRepairEndData({...repairEndData, cost: e.target.value})} /></div>
                            <div><label className="text-sm">Details</label><textarea className="w-full p-3 border rounded-xl" rows={3} value={repairEndData.description} onChange={e => setRepairEndData({...repairEndData, description: e.target.value})} /></div>
                            <div><label className="text-sm">Completion Date</label><input type="date" className="w-full p-3 border rounded-xl" value={repairEndData.date} onChange={e => setRepairEndData({...repairEndData, date: e.target.value})} /></div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowRepairDoneModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
                            <button onClick={handleFinishRepair} className="flex-1 py-3 bg-green-600 text-white rounded-xl">Mark Available</button>
                        </div>
                    </Card>
                </div>
            )}
            
            {showServiceModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4 text-green-600">Log Service</h3>
                        <div className="space-y-4">
                            <div><label className="text-sm">Mileage</label><input type="number" className="w-full p-3 border rounded-xl" value={serviceData.mileage} onChange={e => setServiceData({...serviceData, mileage: e.target.value})} /></div>
                            <div><label className="text-sm">Cost</label><input type="number" className="w-full p-3 border rounded-xl" value={serviceData.cost} onChange={e => setServiceData({...serviceData, cost: e.target.value})} /></div>
                            <div><label className="text-sm">Notes</label><textarea className="w-full p-3 border rounded-xl" rows={2} value={serviceData.notes} onChange={e => setServiceData({...serviceData, notes: e.target.value})} /></div>
                            <div><label className="text-sm">Date</label><input type="date" className="w-full p-3 border rounded-xl" value={serviceData.date} onChange={e => setServiceData({...serviceData, date: e.target.value})} /></div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowServiceModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
                            <button onClick={handleLogService} className="flex-1 py-3 bg-green-600 text-white rounded-xl">Save & Reset</button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Add/Edit Vehicle Modal (FIXED) */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
                    <h3 className="text-xl mb-4 font-bold flex-shrink-0">{isEditing ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
                    
                    <div className="overflow-y-auto flex-1 pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-2"><h4 className="text-sm font-bold text-gray-500 border-b pb-1 mb-2">Basic Info</h4></div>
                            
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Vehicle Number</label>
                                <input className="w-full p-2 border rounded" value={formData.number} onChange={e => setFormData({...formData, number: e.target.value})} placeholder="CAB-1234" />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Model</label>
                                <input className="w-full p-2 border rounded" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} placeholder="Toyota Prius" />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
                                <select className="w-full p-2 border rounded" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                    {['Car', 'Van', 'Bike', 'Bus', 'Lorry', 'Jeep', 'Three Wheeler'].map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            {/* 🌟 NEW PLANT LOCATION FIELD 🌟 */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Registered Plant/Location</label>
                                <select className="w-full p-2 border rounded" value={formData.plant} onChange={e => setFormData({...formData, plant: e.target.value})}>
                                    {PLANT_LOCATIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            {/* 🌟 END NEW FIELD 🌟 */}

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Required License (Type)</label>
                                <select className="w-full p-2 border rounded" value={formData.requiredLicenseType} onChange={e => setFormData({...formData, requiredLicenseType: e.target.value})}>
                                    {Object.entries(LICENSE_TYPES_VEHICLE).map(([code, name]) => (
                                        <option key={code} value={code}>{code} - {name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Seats</label>
                                <input type="number" className="w-full p-2 border rounded" value={formData.seats} onChange={e => setFormData({...formData, seats: e.target.value})} />
                            </div>
                            
                            <div className="col-span-2 mt-2"><h4 className="text-sm font-bold text-gray-500 border-b pb-1 mb-2">Technical (Locked after create)</h4></div>
                            
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Chassis Number</label>
                                <input className="w-full p-2 border rounded bg-gray-50" value={formData.chassisNumber} onChange={e => setFormData({...formData, chassisNumber: e.target.value})} disabled={isEditing} placeholder="Chassis No." />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Engine Number</label>
                                <input className="w-full p-2 border rounded bg-gray-50" value={formData.engineNumber} onChange={e => setFormData({...formData, engineNumber: e.target.value})} disabled={isEditing} placeholder="Engine No." />
                            </div>

                            <div className="col-span-2 mt-2"><h4 className="text-sm font-bold text-gray-500 border-b pb-1 mb-2">License & Ownership</h4></div>
                            
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Owner Name</label>
                                <input className="w-full p-2 border rounded" value={formData.ownerName} onChange={e => setFormData({...formData, ownerName: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Owner Phone</label>
                                <input className="w-full p-2 border rounded" value={formData.ownerPhone} onChange={e => setFormData({...formData, ownerPhone: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">License Expiry</label>
                                <input type="date" className="w-full p-2 border rounded" value={formData.licenseExpiry} onChange={e => setFormData({...formData, licenseExpiry: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Insurance Expiry</label>
                                <input type="date" className="w-full p-2 border rounded" value={formData.insuranceExpiry} onChange={e => setFormData({...formData, insuranceExpiry: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Rate (LKR/km)</label>
                                <input type="number" className="w-full p-2 border rounded" value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} />
                            </div>

                            <div>
                                {/* Service Interval is included here for editing */}
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Service Interval (km)</label>
                                <input type="number" className="w-full p-2 border rounded" value={formData.serviceInterval} onChange={e => setFormData({...formData, serviceInterval: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100 flex-shrink-0">
                        <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50">Cancel</button>
                        <button 
                            onClick={handleSubmitVehicle} 
                            className="flex-1 py-3 bg-blue-600 text-gray-700 text-white font-medium rounded-xl hover:bg-blue-700 shadow-sm"
                        >
                            {isEditing ? 'Update Vehicle' : 'Save Vehicle'}
                        </button>
                    </div>
                    </Card>
                </div>
            )}
        </div>
    );
}