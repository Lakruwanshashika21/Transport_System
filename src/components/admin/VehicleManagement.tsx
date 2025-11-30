import { useState, useEffect } from 'react';
import { Car, Plus, Edit, Wrench, DollarSign, Trash2, X, FileText, AlertTriangle, History, CheckCircle, TrendingUp, Mail, Printer, ShieldAlert, ShieldCheck } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase';
// PDF Imports
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface VehicleManagementProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export function VehicleManagement({ user, onNavigate, onLogout }: VehicleManagementProps) {
  // 1. State
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRepairModal, setShowRepairModal] = useState(false); // Initial Repair Log
  const [showRepairDoneModal, setShowRepairDoneModal] = useState(false); // Complete Repair
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showRateHistoryModal, setShowRateHistoryModal] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false); 
  
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  
  // Forms
  const [formData, setFormData] = useState({
    number: '',
    model: '',
    type: 'Car',
    seats: '',
    rate: '',
    serviceInterval: '5000',
    licenseExpiry: '',
    insuranceExpiry: '',
    ownerName: '',
    ownerPhone: '',
    chassisNumber: '',
    engineNumber: ''
  });

  const [newRate, setNewRate] = useState('');

  // Initial Repair Data (Starting the repair)
  const [repairStartData, setRepairStartData] = useState({
    issue: '',
    date: new Date().toISOString().split('T')[0],
    reportedBy: 'Admin'
  });

  // Complete Repair Data (Finishing the repair)
  const [repairEndData, setRepairEndData] = useState({
    date: new Date().toISOString().split('T')[0],
    cost: '',
    description: '',
  });

  const [serviceData, setServiceData] = useState({
    date: new Date().toISOString().split('T')[0],
    cost: '',
    mileage: '',
    notes: ''
  });

  const [licenseData, setLicenseData] = useState({
    renewalDate: new Date().toISOString().split('T')[0],
    newLicenseExpiry: '',
    licenseCost: '',
    newInsuranceExpiry: '',
    insurancePolicyNo: '',
    insuranceProvider: '',
    insuranceCost: '',
    notes: ''
  });

  // 1. Real-Time Fetch
  useEffect(() => {
    setLoading(true);
    const unsubVehicles = onSnapshot(collection(db, "vehicles"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVehicles(list);
    });
    
    const unsubTrips = onSnapshot(collection(db, "trip_requests"), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data());
      setTrips(list);
      setLoading(false);
    });

    return () => { unsubVehicles(); unsubTrips(); };
  }, []);

  // 2. Helper: Calculate Stats
  const getVehicleStats = (vehicle: any) => {
    const vehicleTrips = trips.filter(t => (t.vehicleId === vehicle.id || t.vehicleNumber === vehicle.number) && t.status === 'completed');
    let totalKm = 0;
    vehicleTrips.forEach(t => {
      const dist = parseFloat((t.distance || '0').toString().replace(/[^0-9.]/g, ''));
      if (!isNaN(dist)) totalKm += dist;
    });

    const lastServiceKm = vehicle.lastServiceMileage || 0;
    const serviceInterval = parseFloat(vehicle.serviceInterval) || 5000;
    const kmSinceService = totalKm - lastServiceKm;
    const isServiceDue = kmSinceService >= serviceInterval;
    const remainingKm = Math.max(0, serviceInterval - kmSinceService);

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

    // Critical Risk Check (500km left AND < 3 months license)
    const isCriticalRisk = remainingKm <= 500 && (licenseStatus === 'warning' || licenseStatus === 'expired');

    return { totalKm, kmSinceService, isServiceDue, remainingKm, serviceInterval, licenseStatus, daysToExpiry, isCriticalRisk };
  };

  // 3. Actions & Handlers

  // --- Vehicle CRUD ---
  const openAddModal = () => {
    setIsEditing(false);
    setFormData({ 
        number: '', model: '', type: 'Car', seats: '', rate: '', serviceInterval: '5000',
        licenseExpiry: '', insuranceExpiry: '', ownerName: '', ownerPhone: '', chassisNumber: '', engineNumber: ''
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
      engineNumber: vehicle.engineNumber || ''
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
        ...(isEditing ? {} : { chassisNumber: formData.chassisNumber, engineNumber: formData.engineNumber })
      };

      if (isEditing && selectedVehicleId) {
        await updateDoc(doc(db, "vehicles", selectedVehicleId), data);
        alert('Vehicle updated!');
      } else {
        const initialLog = { rate: parseFloat(formData.rate.toString()), changedBy: `${user.name} (Admin)`, date: new Date().toISOString(), previousRate: 0 };
        await addDoc(collection(db, "vehicles"), {
          ...data,
          chassisNumber: formData.chassisNumber,
          engineNumber: formData.engineNumber,
          status: 'available',
          lastServiceMileage: 0, 
          repairs: [],
          services: [],
          rateHistory: [initialLog],
          licenseHistory: [],
          createdAt: new Date().toISOString()
        });
        alert('Vehicle added!');
      }
      setShowAddModal(false);
    } catch (error) { console.error(error); }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this vehicle?")) {
      try { await deleteDoc(doc(db, "vehicles", id)); } 
      catch (error) { console.error("Error deleting:", error); alert("Failed to delete."); }
    }
  };

  // --- Rate Logic ---
  const handleUpdateRate = async () => {
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

          alert(`Rate updated to LKR ${rateVal}/km`);
          setShowRateModal(false);
          setNewRate('');
      } catch(e) { alert("Failed to update rate"); }
  };

  // --- Repair Logic ---
  const handleStartRepair = async () => {
    if (!selectedVehicle || !repairStartData.issue) return;
    try {
      const vehicleRef = doc(db, "vehicles", selectedVehicle.id);
      // We just mark it as maintenance and save the "issue" temporarily in the vehicle status or a 'currentRepair' field
      await updateDoc(vehicleRef, {
        status: 'maintenance', 
        currentRepair: {
            issue: repairStartData.issue,
            startDate: repairStartData.date,
            reportedBy: repairStartData.reportedBy
        }
      });
      
      alert(`Vehicle marked as Maintenance: ${repairStartData.issue}`);
      setShowRepairModal(false);
      setRepairStartData({ date: new Date().toISOString().split('T')[0], issue: '', reportedBy: 'Admin' });
    } catch (error) { console.error(error); }
  };

  const handleFinishRepair = async () => {
      if (!selectedVehicle) return;
      try {
          const vehicleRef = doc(db, "vehicles", selectedVehicle.id);
          // Combine start data (from DB or state if persistent) with end data
          const repairLog = {
              issue: selectedVehicle.currentRepair?.issue || 'Unknown Issue',
              startDate: selectedVehicle.currentRepair?.startDate || new Date().toISOString(),
              endDate: repairEndData.date,
              cost: repairEndData.cost,
              description: repairEndData.description,
              reportedBy: selectedVehicle.currentRepair?.reportedBy || 'Admin',
              completedBy: `${user.name} (Admin)`
          };

          await updateDoc(vehicleRef, {
              status: 'available', // Mark available again
              currentRepair: null, // Clear current repair
              repairs: arrayUnion(repairLog) // Add to history
          });

          alert("Repair completed & logged. Vehicle is now Available.");
          setShowRepairDoneModal(false);
          setRepairEndData({ date: new Date().toISOString().split('T')[0], cost: '', description: '' });
      } catch(e) { console.error(e); }
  };

  // --- Service Logic ---
  const handleLogService = async () => {
    if (!selectedVehicle) return;
    try {
      const stats = getVehicleStats(selectedVehicle);
      const vehicleRef = doc(db, "vehicles", selectedVehicle.id);
      const newService = { 
          ...serviceData, 
          type: 'Regular Service',
          loggedBy: `${user.name} (Admin)`
      };

      await updateDoc(vehicleRef, {
        status: 'available', 
        lastServiceMileage: stats.totalKm, 
        services: arrayUnion(newService)
      });

      alert(`Service recorded. Mileage reset!`);
      setShowServiceModal(false);
      setServiceData({ date: new Date().toISOString().split('T')[0], cost: '', mileage: '', notes: '' });
    } catch (error) { console.error(error); }
  };

  // --- License Logic ---
  const handleRenewLicense = async () => {
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
          alert("License details updated.");
          setShowLicenseModal(false);
      } catch(e) { alert("Failed to update license."); }
  };

  const openLicenseModal = (vehicle: any) => {
    setSelectedVehicle(vehicle);
    // Pre-fill with existing or empty
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

  // --- Reports ---
  const generateReport = async (v: any) => {
    const stats = getVehicleStats(v);
    const doc = new jsPDF();
    const headerImgPath = '/report-header.jpg'; 
    const footerImgPath = '/report-footer.png'; 

    // Load images
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
        } catch (error) { return ""; }
    };
    const [hImg, fImg] = await Promise.all([getBase64ImageFromUrl(headerImgPath), getBase64ImageFromUrl(footerImgPath)]);

    const addHeaderFooter = (data: any) => {
        if(hImg) doc.addImage(hImg, 'JPEG', 10, 5, 190, 25);
        if(fImg) doc.addImage(fImg, 'PNG', 10, doc.internal.pageSize.height - 25, 190, 15);
    };

    let y = 45;
    doc.setFontSize(18); doc.text(`Vehicle Report: ${v.number}`, 14, y); y += 10;
    
    doc.setFontSize(10);
    doc.text(`Model: ${v.model} (${v.type})`, 14, y); y+=6;
    doc.text(`Chassis: ${v.chassisNumber || '-'}`, 14, y); y+=6;
    doc.text(`Engine: ${v.engineNumber || '-'}`, 14, y); y+=6;
    doc.text(`Owner: ${v.ownerName || '-'} (${v.ownerPhone || '-'})`, 14, y); y+=6;
    doc.text(`Current License Exp: ${v.licenseExpiry || '-'}`, 14, y); y+=6;
    doc.text(`Current Insurance Exp: ${v.insuranceExpiry || '-'}`, 14, y); y+=10;

    doc.setFontSize(12);
    doc.text(`Total Mileage: ${stats.totalKm.toFixed(1)} km`, 14, y); y+=8;
    doc.text(`Status: ${v.status.toUpperCase()}`, 14, y); y+=15;

    // NEW: License History in Report
    doc.text("License History", 14, y);
    const licenses = v.licenseHistory || [];
    autoTable(doc, {
      startY: y + 5,
      head: [['Date', 'Lic Exp', 'Ins Exp', 'Policy', 'Cost (Lic/Ins)']],
      body: licenses.map((l: any) => [l.renewalDate, l.licenseExpiry, l.insuranceExpiry, l.policyNo, `L ${l.licenseCost}/I ${l.insuranceCost}`]),
      didDrawPage: addHeaderFooter,
      margin: { top: 40, bottom: 35 },
      headStyles: { fillColor: [79, 70, 229] } // Indigo
    });

    // Repair Table
    let lastY = (doc as any).lastAutoTable.finalY + 15;
    doc.text("Repair History", 14, lastY);
    autoTable(doc, {
      startY: lastY + 5,
      head: [['Date', 'Issue', 'Cost', 'Desc']],
      body: (v.repairs || []).map((r: any) => [r.endDate || r.date, r.issue, `LKR ${r.cost}`, r.description]),
      didDrawPage: addHeaderFooter,
      margin: { top: 40, bottom: 35 },
      headStyles: { fillColor: [220, 38, 38] }
    });

    // Service Table
    lastY = (doc as any).lastAutoTable.finalY + 15;
    doc.text("Service History", 14, lastY);
    autoTable(doc, {
      startY: lastY + 5,
      head: [['Date', 'Mileage', 'Cost', 'Notes']],
      body: (v.services || []).map((s: any) => [s.date, s.mileage, `LKR ${s.cost}`, s.notes]),
      didDrawPage: addHeaderFooter,
      margin: { top: 40, bottom: 35 },
      headStyles: { fillColor: [22, 163, 74] }
    });

    doc.save(`Vehicle_Report_${v.number}.pdf`);
  };

  // --- Pass ---
  const generateVehiclePass = async (v: any) => {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [150, 100] });
      const headerImgPath = '/report-header.jpg'; 
      const footerImgPath = '/report-footer.png'; 

      const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve) => {
          const img = new Image(); img.src = url; img.onload = () => resolve(img); img.onerror = () => resolve(new Image());
      });
      const [hImg, fImg] = await Promise.all([loadImage(headerImgPath), loadImage(footerImgPath)]);

      if(hImg.src) doc.addImage(hImg, 'JPEG', 5, 5, 140, 20);

      doc.setFontSize(22); doc.setTextColor(37, 99, 235); doc.text("VEHICLE PASS", 75, 40, { align: 'center' });
      doc.setFontSize(40); doc.setTextColor(0, 0, 0); doc.text(v.number, 75, 55, { align: 'center' });
      doc.setFontSize(10); doc.text(`Owner: ${v.ownerName || 'Company'}`, 75, 65, { align: 'center' });
      
      const expiry = v.licenseExpiry ? new Date(v.licenseExpiry).toLocaleDateString() : 'N/A';
      doc.setTextColor(100);
      doc.text(`Valid Until: ${expiry}`, 75, 72, { align: 'center' });

      if(fImg.src) doc.addImage(fImg, 'PNG', 5, 80, 140, 10);
      doc.save(`Pass_${v.number}.pdf`);
  };

  const sendServiceAlert = (v: any) => { alert(`Alert sent for ${v.number}`); };
  const generateRateReport = (v: any) => { /* ... */ };
  const handleMarkAvailable = async (id: string) => { await updateDoc(doc(db, "vehicles", id), { status: 'available' }); };

  if (loading) return <div className="p-10 text-center">Loading Fleet...</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="vehicle-management" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl text-gray-900 mb-2">Fleet Maintenance</h1>
            <p className="text-gray-600">Manage fleet, repairs, service and pricing</p>
          </div>
          <button onClick={openAddModal} className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF]">
            <Plus className="w-5 h-5" /> Add Vehicle
          </button>
        </div>

        {/* Alerts Section */}
        {vehicles.some(v => {
            const s = getVehicleStats(v);
            return s.licenseStatus !== 'valid' || s.isCriticalRisk;
        }) && (
            <div className="mb-8 grid gap-4 animate-in slide-in-from-top">
                {vehicles.filter(v => {
                    const s = getVehicleStats(v);
                    return s.licenseStatus !== 'valid' || s.isCriticalRisk;
                }).map(v => {
                    const stats = getVehicleStats(v);
                    const isCritical = stats.isCriticalRisk;
                    return (
                        <div key={v.id} className={`p-4 border-l-4 rounded-r-xl flex justify-between ${isCritical ? 'bg-red-50 border-red-600' : 'bg-yellow-50 border-yellow-500'}`}>
                            <div className="flex gap-3">
                                <ShieldAlert className={`w-6 h-6 ${isCritical ? 'text-red-600' : 'text-yellow-600'}`} />
                                <div>
                                    <div className="font-bold text-gray-900">
                                        {v.number} - {isCritical ? "CRITICAL ATTENTION REQUIRED" : "License Alert"}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                        {isCritical 
                                           ? "Error Code: LIC-KM-CRITICAL (High Mileage & Expiring License)" 
                                           : stats.licenseStatus === 'expired' ? `License Expired on ${v.licenseExpiry}` : `License Expires in ${stats.daysToExpiry} days`}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => openLicenseModal(v)} className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 font-medium">Resolve Issue</button>
                        </div>
                    );
                })}
            </div>
        )}

        <div className="grid gap-4">
          {vehicles.map((vehicle) => {
            const stats = getVehicleStats(vehicle);
            const percentage = Math.min((stats.kmSinceService / stats.serviceInterval) * 100, 100);
            
            // Dynamic Background for Critical Vehicles
            const cardClass = stats.isCriticalRisk ? 'bg-red-50 border-2 border-red-200' : 'bg-white';

            return (
              <Card key={vehicle.id} className={`p-6 ${cardClass}`}>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stats.isServiceDue ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}><Car className="w-6 h-6" /></div>
                    <div>
                      <div className="flex items-center gap-2"><h3 className="text-lg font-bold">{vehicle.number}</h3><Badge status={vehicle.status} size="sm" /></div>
                      <div className="text-sm text-gray-500">{vehicle.model} • {vehicle.type}</div>
                      <div className="text-sm text-green-600 font-bold">LKR {vehicle.ratePerKm}/km</div>
                      {/* License Date Display */}
                      <div className={`text-xs font-medium mt-1 ${stats.licenseStatus !== 'valid' ? 'text-red-600' : 'text-gray-400'}`}>
                          Lic: {vehicle.licenseExpiry || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 w-full md:w-auto hidden sm:block px-4">
                     <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Service Health</span><span className={stats.remainingKm < 500 ? "text-red-600 font-bold" : ""}>{stats.remainingKm.toFixed(0)} km left</span></div>
                     <div className="w-full bg-gray-200 rounded-full h-2.5"><div className={`h-2.5 rounded-full ${stats.isServiceDue ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${percentage}%` }}></div></div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {/* License Button */}
                    <button onClick={() => openLicenseModal(vehicle)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="Renew License/Insurance">
                       <ShieldCheck className="w-5 h-5" />
                    </button>
                    
                    <button onClick={() => generateVehiclePass(vehicle)} className="p-2 bg-gray-100 text-gray-600 rounded-lg" title="Print Pass"><Printer className="w-5 h-5" /></button>
                    
                    {/* Rate Buttons */}
                    <button onClick={() => { setSelectedVehicle(vehicle); setShowRateModal(true); }} className="p-2 bg-green-50 text-green-600 rounded-lg" title="Change Rate"><DollarSign className="w-5 h-5" /></button>
                    <button onClick={() => { setSelectedVehicle(vehicle); setShowRateHistoryModal(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-lg" title="Rate History"><TrendingUp className="w-5 h-5" /></button>

                    {/* Maintenance Logic */}
                    {vehicle.status === 'maintenance' ? (
                        <button onClick={() => { setSelectedVehicle(vehicle); setShowRepairDoneModal(true); }} className="p-2 bg-green-600 text-white rounded-lg animate-pulse" title="Mark Repair Done"><CheckCircle className="w-5 h-5" /></button>
                    ) : (
                        <button onClick={() => { setSelectedVehicle(vehicle); setShowRepairModal(true); }} className="p-2 bg-orange-50 text-orange-600 rounded-lg" title="Log Repair"><Wrench className="w-5 h-5" /></button>
                    )}

                    <button onClick={() => { setSelectedVehicle(vehicle); setShowServiceModal(true); }} className="p-2 bg-green-50 text-green-600 rounded-lg" title="Log Service"><CheckCircle className="w-5 h-5" /></button>
                    <button onClick={() => { setSelectedVehicle(vehicle); generateReport(vehicle); }} className="p-2 bg-gray-100 text-gray-700 rounded-lg" title="Report"><FileText className="w-5 h-5" /></button>
                    <button onClick={() => openEditModal(vehicle)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg" title="Edit"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(vehicle.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* --- MODALS --- */}
      
      {/* License Modal */}
      {showLicenseModal && selectedVehicle && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
             <Card className="w-full max-w-lg p-6 flex flex-col max-h-[90vh]">
                <h3 className="text-xl font-bold mb-4">Renew License & Insurance</h3>
                <div className="overflow-y-auto flex-1 space-y-4 pr-2">
                   <div className="p-3 bg-gray-50 rounded mb-2 text-sm text-gray-500">Current Expiry: {selectedVehicle.licenseExpiry}</div>
                   <h4 className="font-bold text-sm text-gray-700 border-b pb-1">Revenue License</h4>
                   <div><label className="text-xs">Renewal Date</label><input type="date" className="w-full p-2 border rounded" value={licenseData.renewalDate} onChange={e => setLicenseData({...licenseData, renewalDate: e.target.value})} /></div>
                   <div><label className="text-xs">New Expiry</label><input type="date" className="w-full p-2 border rounded" value={licenseData.newLicenseExpiry} onChange={e => setLicenseData({...licenseData, newLicenseExpiry: e.target.value})} /></div>
                   <div><label className="text-xs">Cost (LKR)</label><input type="number" className="w-full p-2 border rounded" value={licenseData.licenseCost} onChange={e => setLicenseData({...licenseData, licenseCost: e.target.value})} /></div>

                   <h4 className="font-bold text-sm text-gray-700 border-b pb-1 mt-4">Insurance</h4>
                   <div><label className="text-xs">Provider</label><input className="w-full p-2 border rounded" value={licenseData.insuranceProvider} onChange={e => setLicenseData({...licenseData, insuranceProvider: e.target.value})} /></div>
                   <div><label className="text-xs">Policy No</label><input className="w-full p-2 border rounded" value={licenseData.insurancePolicyNo} onChange={e => setLicenseData({...licenseData, insurancePolicyNo: e.target.value})} /></div>
                   <div><label className="text-xs">New Expiry</label><input type="date" className="w-full p-2 border rounded" value={licenseData.newInsuranceExpiry} onChange={e => setLicenseData({...licenseData, newInsuranceExpiry: e.target.value})} /></div>
                   <div><label className="text-xs">Cost (LKR)</label><input type="number" className="w-full p-2 border rounded" value={licenseData.insuranceCost} onChange={e => setLicenseData({...licenseData, insuranceCost: e.target.value})} /></div>
                </div>
                <div className="flex gap-3 mt-4 pt-4 border-t"><button onClick={() => setShowLicenseModal(false)} className="flex-1 py-2 border rounded">Cancel</button><button onClick={handleRenewLicense} className="flex-1 py-2 bg-blue-600 text-white rounded">Save Renewal</button></div>
             </Card>
          </div>
      )}

      {/* Rate Modal */}
      {showRateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><Card className="w-full max-w-sm p-6"><h3 className="text-xl font-bold mb-4">Change Rate</h3><div className="mb-4"><label className="block text-sm text-gray-700 mb-1">New Rate (LKR)</label><input type="number" className="w-full p-3 border rounded-xl" value={newRate} onChange={e => setNewRate(e.target.value)} /></div><div className="flex gap-3"><button onClick={() => setShowRateModal(false)} className="flex-1 py-2 border rounded-xl">Cancel</button><button onClick={handleUpdateRate} className="flex-1 py-2 bg-green-600 text-white rounded-xl">Update</button></div></Card></div>
      )}

      {/* Rate History Modal */}
      {showRateHistoryModal && selectedVehicle && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
             <Card className="w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between mb-4">
                   <h3 className="text-xl font-bold">Rate History: {selectedVehicle.number}</h3>
                   <button onClick={() => setShowRateHistoryModal(false)}><X className="w-6 h-6"/></button>
                </div>
                <div className="overflow-x-auto mb-4">
                   <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50">
                         <tr><th className="p-2">Date</th><th className="p-2">Old Rate</th><th className="p-2">New Rate</th><th className="p-2">Changed By</th></tr>
                      </thead>
                      <tbody>
                         {selectedVehicle.rateHistory && selectedVehicle.rateHistory.length > 0 ? (
                             [...selectedVehicle.rateHistory].reverse().map((log: any, i: number) => (
                                <tr key={i} className="border-t">
                                   <td className="p-2">{new Date(log.date).toLocaleDateString()}</td>
                                   <td className="p-2 text-gray-500">LKR {log.previousRate}</td>
                                   <td className="p-2 font-bold text-green-600">LKR {log.rate}</td>
                                   <td className="p-2 text-xs">{log.changedBy}</td>
                                </tr>
                             ))
                         ) : ( <tr><td colSpan={4} className="p-4 text-center">No history found.</td></tr> )}
                      </tbody>
                   </table>
                </div>
             </Card>
          </div>
      )}

      {/* Repair Start Modal */}
      {showRepairModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><Card className="w-full max-w-md p-6"><h3 className="text-xl font-bold mb-4 text-red-600">Log Repair Issue</h3><div className="space-y-4"><div><label className="text-sm">Issue Description</label><input className="w-full p-3 border rounded-xl" value={repairStartData.issue} onChange={e => setRepairStartData({...repairStartData, issue: e.target.value})} /></div><div><label className="text-sm">Date</label><input type="date" className="w-full p-3 border rounded-xl" value={repairStartData.date} onChange={e => setRepairStartData({...repairStartData, date: e.target.value})} /></div></div><div className="flex gap-3 mt-6"><button onClick={() => setShowRepairModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button><button onClick={handleStartRepair} className="flex-1 py-3 bg-red-600 text-white rounded-xl">Mark Maintenance</button></div></Card></div>
      )}

      {/* Repair Finish Modal */}
      {showRepairDoneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><Card className="w-full max-w-md p-6"><h3 className="text-xl font-bold mb-4 text-green-600">Complete Repair</h3><p className="text-sm text-gray-500 mb-4">Issue: {selectedVehicle?.currentRepair?.issue}</p><div className="space-y-4"><div><label className="text-sm">Final Cost (LKR)</label><input type="number" className="w-full p-3 border rounded-xl" value={repairEndData.cost} onChange={e => setRepairEndData({...repairEndData, cost: e.target.value})} /></div><div><label className="text-sm">Details</label><textarea className="w-full p-3 border rounded-xl" rows={3} value={repairEndData.description} onChange={e => setRepairEndData({...repairEndData, description: e.target.value})} /></div><div><label className="text-sm">Completion Date</label><input type="date" className="w-full p-3 border rounded-xl" value={repairEndData.date} onChange={e => setRepairEndData({...repairEndData, date: e.target.value})} /></div></div><div className="flex gap-3 mt-6"><button onClick={() => setShowRepairDoneModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button><button onClick={handleFinishRepair} className="flex-1 py-3 bg-green-600 text-white rounded-xl">Mark Available</button></div></Card></div>
      )}
      
      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><Card className="w-full max-w-md p-6"><h3 className="text-xl font-bold mb-4 text-green-600">Log Service</h3><div className="space-y-4"><div><label className="text-sm">Mileage</label><input type="number" className="w-full p-3 border rounded-xl" value={serviceData.mileage} onChange={e => setServiceData({...serviceData, mileage: e.target.value})} /></div><div><label className="text-sm">Cost</label><input type="number" className="w-full p-3 border rounded-xl" value={serviceData.cost} onChange={e => setServiceData({...serviceData, cost: e.target.value})} /></div><div><label className="text-sm">Notes</label><textarea className="w-full p-3 border rounded-xl" rows={2} value={serviceData.notes} onChange={e => setServiceData({...serviceData, notes: e.target.value})} /></div><div><label className="text-sm">Date</label><input type="date" className="w-full p-3 border rounded-xl" value={serviceData.date} onChange={e => setServiceData({...serviceData, date: e.target.value})} /></div></div><div className="flex gap-3 mt-6"><button onClick={() => setShowServiceModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button><button onClick={handleLogService} className="flex-1 py-3 bg-green-600 text-white rounded-xl">Save & Reset</button></div></Card></div>
      )}

      {/* Add/Edit Vehicle Modal (Simplified to save space, full logic is similar) */}
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
                   <label className="block text-xs font-semibold text-gray-700 mb-1">Service Interval (km)</label>
                   <input type="number" className="w-full p-2 border rounded" value={formData.serviceInterval} onChange={e => setFormData({...formData, serviceInterval: e.target.value})} />
                 </div>
               </div>
             </div>

             <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100 flex-shrink-0">
               <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50">Cancel</button>
               <button 
                 onClick={handleSubmitVehicle} 
                 className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-sm"
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