import { useState, useEffect } from 'react';
import { Car, Plus, Edit, Wrench, DollarSign, Trash2, X, FileText, AlertTriangle, History, CheckCircle } from 'lucide-react';
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
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Forms
  const [formData, setFormData] = useState({
    number: '',
    model: '',
    type: '',
    seats: '',
    rate: '',
    serviceInterval: '5000', 
  });

  const [repairData, setRepairData] = useState({
    date: new Date().toISOString().split('T')[0],
    cost: '',
    issue: '',
    description: '',
    reportedBy: 'Admin'
  });

  const [serviceData, setServiceData] = useState({
    date: new Date().toISOString().split('T')[0],
    cost: '',
    mileage: '',
    notes: ''
  });

  // 1. Real-Time Fetch (Vehicles & Trips)
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

  // 2. Helper: Calculate Mileage & Status
  const getVehicleStats = (vehicle: any) => {
    const vehicleTrips = trips.filter(t => 
      (t.vehicleId === vehicle.id || t.vehicleNumber === vehicle.number) && 
      t.status === 'completed'
    );
    
    let totalKm = 0;
    vehicleTrips.forEach(t => {
      const dist = parseFloat((t.distance || '0').toString().replace(/[^0-9.]/g, ''));
      if (!isNaN(dist)) totalKm += dist;
    });

    const lastServiceKm = vehicle.lastServiceMileage || 0;
    const serviceInterval = vehicle.serviceInterval || 5000;
    const kmSinceService = totalKm - lastServiceKm;
    const isServiceDue = kmSinceService >= serviceInterval;
    const remainingKm = Math.max(0, serviceInterval - kmSinceService);

    return { totalKm, kmSinceService, isServiceDue, remainingKm, serviceInterval };
  };

  // 3. Actions
  const handleSubmitVehicle = async () => {
    if (!formData.number || !formData.rate) { alert('Fill required fields'); return; }
    try {
      const data = {
        number: formData.number,
        model: formData.model,
        type: formData.type,
        seats: parseInt(formData.seats),
        ratePerKm: parseFloat(formData.rate),
        serviceInterval: parseFloat(formData.serviceInterval),
      };

      if (isEditing && selectedVehicle) {
        await updateDoc(doc(db, "vehicles", selectedVehicle.id), data);
        alert('Vehicle updated!');
      } else {
        await addDoc(collection(db, "vehicles"), {
          ...data,
          status: 'available',
          lastServiceMileage: 0, 
          repairs: [],
          services: [],
          createdAt: new Date().toISOString()
        });
        alert('Vehicle added!');
      }
      setShowAddModal(false);
    } catch (error) { console.error(error); }
  };

  const handleLogRepair = async () => {
    if (!selectedVehicle || !repairData.issue) return;
    try {
      const vehicleRef = doc(db, "vehicles", selectedVehicle.id);
      const newRepair = { ...repairData, timestamp: new Date().toISOString() };
      
      await updateDoc(vehicleRef, {
        status: 'maintenance', 
        repairs: arrayUnion(newRepair)
      });
      
      alert(`Repair logged. Vehicle set to Maintenance.`);
      setShowRepairModal(false);
      setRepairData({ date: '', cost: '', issue: '', description: '', reportedBy: 'Admin' });
    } catch (error) { console.error(error); }
  };

  const handleLogService = async () => {
    if (!selectedVehicle) return;
    try {
      const stats = getVehicleStats(selectedVehicle);
      const vehicleRef = doc(db, "vehicles", selectedVehicle.id);
      const newService = { ...serviceData, timestamp: new Date().toISOString() };

      await updateDoc(vehicleRef, {
        status: 'available', 
        lastServiceMileage: stats.totalKm, 
        services: arrayUnion(newService)
      });

      alert(`Service recorded. Mileage reset! Vehicle good for another ${selectedVehicle.serviceInterval || 5000} km.`);
      setShowServiceModal(false);
      setServiceData({ date: new Date().toISOString().split('T')[0], cost: '', mileage: '', notes: '' });
    } catch (error) { console.error(error); }
  };

  const handleMarkAvailable = async (id: string) => {
    await updateDoc(doc(db, "vehicles", id), { status: 'available' });
  };

  // 4. Generate PDF Report with Header/Footer
  const generateReport = (v: any) => {
    const stats = getVehicleStats(v);
    const doc = new jsPDF();
    
    // Define Header/Footer Images
    const headerImg = '/report-header.jpg'; // Needs to be in public folder
    const footerImg = '/report-footer.png'; // Needs to be in public folder

    // Helper to add Header/Footer on every page
    const addHeaderFooter = (data: any) => {
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Add Header (10mm margin, adjusted width/height to aspect ratio)
      try {
        doc.addImage(headerImg, 'JPG', 10, 5, 190, 20); 
      } catch(e) { console.error("Header image missing"); }

      // Add Footer at bottom
      try {
        doc.addImage(footerImg, 'PNG', 10, pageHeight - 25, 190, 20);
      } catch(e) { console.error("Footer image missing"); }
    };

    // Content - Start Y lower to avoid header
    let finalY = 40;

    doc.setFontSize(18);
    doc.text(`Vehicle Report: ${v.number} (${v.model})`, 14, finalY);
    finalY += 10;
    
    doc.setFontSize(12);
    doc.text(`Total Mileage: ${stats.totalKm.toFixed(1)} km`, 14, finalY);
    finalY += 8;
    doc.text(`Next Service In: ${stats.remainingKm.toFixed(1)} km`, 14, finalY);
    finalY += 8;
    doc.text(`Status: ${v.status.toUpperCase()}`, 14, finalY);
    finalY += 15;

    // Repair Table
    doc.text("Repair History", 14, finalY);
    const repairs = v.repairs || [];
    autoTable(doc, {
      startY: finalY + 5,
      head: [['Date', 'Issue', 'Cost', 'Reported By']],
      body: repairs.map((r: any) => [r.date, r.issue, `LKR ${r.cost}`, r.reportedBy]),
      didDrawPage: addHeaderFooter, // Applies header/footer
      margin: { top: 35, bottom: 30 } // Margins to prevent overlap
    });

    // Service Table
    const lastY = (doc as any).lastAutoTable.finalY + 15;
    doc.text("Service History", 14, lastY);
    const services = v.services || [];
    autoTable(doc, {
      startY: lastY + 5,
      head: [['Date', 'Mileage Logged', 'Cost', 'Notes']],
      body: services.map((s: any) => [s.date, s.mileage, `LKR ${s.cost}`, s.notes]),
      didDrawPage: addHeaderFooter, // Applies header/footer
      margin: { top: 35, bottom: 30 }
    });

    doc.save(`Vehicle_Report_${v.number}.pdf`);
  };

  // 5. Send Alert Email
  const sendServiceAlert = (v: any) => {
    alert(`Alert sent: Vehicle ${v.number} needs service immediately!`);
  };

  if (loading) return <div className="p-10 text-center">Loading Fleet...</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="vehicle-management" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl text-gray-900 mb-2">Fleet Maintenance</h1>
            <p className="text-gray-600">Manage repairs, services, and vehicle health</p>
          </div>
          <button onClick={() => { setIsEditing(false); setShowAddModal(true); }} className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF]">
            <Plus className="w-5 h-5" /> Add Vehicle
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {vehicles.map((vehicle) => {
            const stats = getVehicleStats(vehicle);
            const percentage = Math.min((stats.kmSinceService / stats.serviceInterval) * 100, 100);
            
            return (
              <Card key={vehicle.id} className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  {/* Info */}
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stats.isServiceDue ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                      <Car className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900">{vehicle.number}</h3>
                        <Badge status={vehicle.status} size="sm" />
                        {stats.isServiceDue && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Service Due
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {vehicle.model} • {vehicle.type}
                      </div>
                    </div>
                  </div>

                  {/* Stats Bar */}
                  <div className="flex-1 px-4 w-full md:w-auto">
                     <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Service Health</span>
                        <span className={stats.remainingKm < 500 ? "text-red-600 font-bold" : "text-gray-700"}>
                           {stats.remainingKm.toFixed(0)} km to go
                        </span>
                     </div>
                     <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className={`h-2.5 rounded-full ${stats.isServiceDue ? 'bg-red-500' : 'bg-green-500'}`} 
                          style={{ width: `${percentage}%` }}
                        ></div>
                     </div>
                     <div className="text-xs text-gray-400 mt-1 text-right">
                        {stats.kmSinceService.toFixed(0)} / {stats.serviceInterval} km used
                     </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {stats.isServiceDue && (
                       <button onClick={() => sendServiceAlert(vehicle)} className="p-2 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100" title="Send Service Alert Email">
                         <Mail className="w-5 h-5" />
                       </button>
                    )}
                    
                    <button onClick={() => { setSelectedVehicle(vehicle); setShowRepairModal(true); }} className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100" title="Log Repair">
                      <Wrench className="w-5 h-5" />
                    </button>
                    
                    <button onClick={() => { setSelectedVehicle(vehicle); setShowServiceModal(true); }} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100" title="Log Service & Reset">
                      <CheckCircle className="w-5 h-5" />
                    </button>

                    <button onClick={() => { setSelectedVehicle(vehicle); generateReport(vehicle); }} className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200" title="Download Report PDF">
                      <FileText className="w-5 h-5" />
                    </button>

                    {vehicle.status === 'maintenance' && (
                       <button onClick={() => handleMarkAvailable(vehicle.id)} className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">
                         Mark Fixed
                       </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      
      {/* Repair Modal */}
      {showRepairModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4 text-red-600">Log Vehicle Repair</h3>
            <div className="space-y-4">
               <input type="text" placeholder="Issue (e.g. Brake Failure)" className="w-full p-3 border rounded-xl" value={repairData.issue} onChange={e => setRepairData({...repairData, issue: e.target.value})} />
               <input type="number" placeholder="Cost (LKR)" className="w-full p-3 border rounded-xl" value={repairData.cost} onChange={e => setRepairData({...repairData, cost: e.target.value})} />
               <textarea placeholder="Description & What was done" className="w-full p-3 border rounded-xl" rows={3} value={repairData.description} onChange={e => setRepairData({...repairData, description: e.target.value})} />
               <input type="text" placeholder="Reported By (Driver/Admin Name)" className="w-full p-3 border rounded-xl" value={repairData.reportedBy} onChange={e => setRepairData({...repairData, reportedBy: e.target.value})} />
               <input type="date" className="w-full p-3 border rounded-xl" value={repairData.date} onChange={e => setRepairData({...repairData, date: e.target.value})} />
            </div>
            <div className="flex gap-3 mt-6">
               <button onClick={() => setShowRepairModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
               <button onClick={handleLogRepair} className="flex-1 py-3 bg-red-600 text-white rounded-xl">Save & Mark Maintenance</button>
            </div>
          </Card>
        </div>
      )}

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4 text-green-600">Log Regular Service</h3>
            <p className="text-sm text-gray-600 mb-4">Logging this will reset the 'Km to go' counter to full.</p>
            <div className="space-y-4">
               <input type="number" placeholder="Current Odometer Reading (km)" className="w-full p-3 border rounded-xl" value={serviceData.mileage} onChange={e => setServiceData({...serviceData, mileage: e.target.value})} />
               <input type="number" placeholder="Cost (LKR)" className="w-full p-3 border rounded-xl" value={serviceData.cost} onChange={e => setServiceData({...serviceData, cost: e.target.value})} />
               <textarea placeholder="Notes (Oil changed, filters replaced...)" className="w-full p-3 border rounded-xl" rows={3} value={serviceData.notes} onChange={e => setServiceData({...serviceData, notes: e.target.value})} />
               <input type="date" className="w-full p-3 border rounded-xl" value={serviceData.date} onChange={e => setServiceData({...serviceData, date: e.target.value})} />
            </div>
            <div className="flex gap-3 mt-6">
               <button onClick={() => setShowServiceModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
               <button onClick={handleLogService} className="flex-1 py-3 bg-green-600 text-white rounded-xl">Save & Reset</button>
            </div>
          </Card>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
           <Card className="w-full max-w-md p-6">
             <h3 className="text-xl mb-4">Add Vehicle</h3>
             <div className="space-y-3">
               <input placeholder="Number" className="w-full p-3 border rounded" value={formData.number} onChange={e => setFormData({...formData, number: e.target.value})} />
               <input placeholder="Model" className="w-full p-3 border rounded" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
               <select className="w-full p-3 border rounded" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}><option value="">Type</option><option value="Car">Car</option><option value="Van">Van</option></select>
               <input placeholder="Seats" className="w-full p-3 border rounded" value={formData.seats} onChange={e => setFormData({...formData, seats: e.target.value})} />
               <input placeholder="Rate (LKR/km)" className="w-full p-3 border rounded" value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} />
               <input placeholder="Service Interval (km)" className="w-full p-3 border rounded" value={formData.serviceInterval} onChange={e => setFormData({...formData, serviceInterval: e.target.value})} />
             </div>
             <div className="flex gap-3 mt-4">
               <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
               <button onClick={handleSubmitVehicle} className="flex-1 py-3 bg-blue-600 text-white rounded-xl">Save</button>
             </div>
           </Card>
        </div>
      )}
    </div>
  );
}