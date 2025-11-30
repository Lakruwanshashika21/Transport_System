import { useState, useEffect } from 'react';
import { User as UserIcon, Plus, Car, Phone, Mail, Trash2, Key, FileText, X, Download, MinusCircle } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, getDocs, query, where, doc, updateDoc, setDoc, deleteDoc, onSnapshot, addDoc, orderBy } from 'firebase/firestore';
import { initializeApp, deleteApp, getApp, getApps } from 'firebase/app'; 
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { db, firebaseConfig, auth as mainAuth } from '../../firebase';
import { sendVehicleAssignmentEmail, sendVehicleUnassignmentEmail } from '../../utils/emailService';
// PDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DriverManagementProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export function DriverManagement({ user, onNavigate, onLogout }: DriverManagementProps) {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [driverHistory, setDriverHistory] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', license: '', nic: '', password: '' });

  // --- Real-Time Fetch ---
  useEffect(() => {
    setLoading(true);
    const unsubDrivers = onSnapshot(query(collection(db, "users"), where("role", "==", "driver")), (snap) => {
      setDrivers(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), status: doc.data().vehicle ? 'in-use' : 'available' })));
    });
    const unsubVehicles = onSnapshot(collection(db, "vehicles"), (snap) => {
      setAvailableVehicles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => { unsubDrivers(); unsubVehicles(); };
  }, []);

  // --- Helper: Fetch History (FIXED SORTING) ---
  const fetchAssignmentHistory = async (driverId: string) => {
     try {
        const q = query(collection(db, "assignment_logs"), where("driverId", "==", driverId));
        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setDriverHistory(logs);
     } catch (error) {
        console.error("Error fetching history:", error);
        setDriverHistory([]); 
     }
  };

  const handleViewHistory = async (driver: any) => {
      setSelectedDriver(driver);
      await fetchAssignmentHistory(driver.id);
      setShowHistoryModal(true);
  };

  const handleDeleteLog = async (logId: string) => {
      if(!confirm("Are you sure you want to delete this history record?")) return;
      try {
          await deleteDoc(doc(db, "assignment_logs", logId));
          if(selectedDriver) await fetchAssignmentHistory(selectedDriver.id);
      } catch(e) {
          alert("Failed to delete log.");
      }
  };

  // --- Generate PDF Report ---
  const handleExportPDF = async () => {
      const doc = new jsPDF();
      const headerImgPath = '/report-header.jpg';
      const footerImgPath = '/report-footer.png';

      const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve) => {
          const img = new Image(); img.src = url; img.onload = () => resolve(img); img.onerror = () => resolve(new Image());
      });

      const [hImg, fImg] = await Promise.all([loadImage(headerImgPath), loadImage(footerImgPath)]);

      const addHeaderFooter = (data: any) => {
          const pw = doc.internal.pageSize.width;
          const ph = doc.internal.pageSize.height;
          if(hImg.src) doc.addImage(hImg, 'JPEG', (pw-150)/2, 5, 150, 25);
          if(fImg.src) doc.addImage(fImg, 'PNG', 10, ph-20, 190, 15);
      };

      doc.setFontSize(16);
      doc.text(`Assignment History: ${selectedDriver.fullName || selectedDriver.name}`, 14, 40);
      
      const tableData = driverHistory.map(log => [
          new Date(log.timestamp).toLocaleDateString(),
          new Date(log.timestamp).toLocaleTimeString(),
          log.vehicleNumber,
          log.action,
          log.assignedBy
      ]);

      autoTable(doc, {
          startY: 50,
          head: [['Date', 'Time', 'Vehicle', 'Action', 'Assigned By']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [37, 99, 235] },
          didDrawPage: addHeaderFooter,
          margin: { top: 40, bottom: 30 }
      });

      doc.save(`Assignment_History_${selectedDriver.name}.pdf`);
  };

  // --- Add Driver ---
  const handleAddDriver = async () => {
    if (!formData.name || !formData.email || !formData.password) { alert("Please fill required fields"); return; }
    let secondaryApp;
    try {
      if (getApps().some(app => app.name === "SecondaryDriver")) { await deleteApp(getApp("SecondaryDriver")); }
      secondaryApp = initializeApp(firebaseConfig, "SecondaryDriver");
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
      
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        fullName: formData.name,
        email: formData.email,
        phone: formData.phone,
        licenseNumber: formData.license,
        nic: formData.nic,
        role: 'driver',
        driverStatus: 'approved',
        createdAt: new Date().toISOString()
      });
      
      await addDoc(collection(db, "assignment_logs"), {
          driverId: cred.user.uid,
          driverName: formData.name,
          action: "Account Created",
          vehicleNumber: "N/A",
          assignedBy: `${user.name} (Admin)`,
          timestamp: new Date().toISOString()
      });

      alert('Driver created!');
      setShowAddModal(false);
      setFormData({ name: '', email: '', phone: '', license: '', nic: '', password: '' });
    } catch (err: any) { alert("Failed: " + err.message); } 
    finally { if (secondaryApp) await deleteApp(secondaryApp).catch(console.error); }
  };

  // --- ASSIGN VEHICLE (Preserves History) ---
  const handleAssignVehicle = async () => {
    if (!selectedVehicle || !selectedDriver) { alert('Select vehicle'); return; }
    
    try {
      // 1. Check if vehicle is assigned to someone else
      const previousDriver = drivers.find(d => d.vehicle === selectedVehicle && d.id !== selectedDriver.id);
      
      if (previousDriver) {
          const confirmSwitch = window.confirm(
              `Vehicle ${selectedVehicle} is currently assigned to ${previousDriver.fullName}.\n\nDo you want to UNASSIGN them and give it to ${selectedDriver.fullName}?`
          );
          if (!confirmSwitch) return;

          // Unassign previous driver (update their status but DO NOT delete their history logs)
          await updateDoc(doc(db, "users", previousDriver.id), { vehicle: null, status: 'available' });
          
          if (previousDriver.email) {
              await sendVehicleUnassignmentEmail(previousDriver.email, previousDriver.fullName, selectedVehicle);
          }
          
          // Log the forced unassignment for the previous driver
          await addDoc(collection(db, "assignment_logs"), {
              driverId: previousDriver.id,
              driverName: previousDriver.fullName,
              vehicleNumber: selectedVehicle,
              action: "Vehicle Re-assigned to other",
              assignedBy: `${user.name} (Admin)`,
              timestamp: new Date().toISOString()
          });
      }

      // 2. Assign to New Driver
      const driverRef = doc(db, "users", selectedDriver.id);
      await updateDoc(driverRef, { vehicle: selectedVehicle, status: 'in-use' }); 
      
      // 3. Send Email
      const vehicleObj = availableVehicles.find(v => v.number === selectedVehicle);
      if (selectedDriver.email) {
         await sendVehicleAssignmentEmail(
             selectedDriver.email, 
             selectedDriver.fullName, 
             selectedVehicle, 
             vehicleObj?.model || 'Vehicle'
         );
      }

      // 4. Log History for New Driver
      await addDoc(collection(db, "assignment_logs"), {
          driverId: selectedDriver.id,
          driverName: selectedDriver.fullName || selectedDriver.name,
          vehicleNumber: selectedVehicle,
          action: "Vehicle Assigned",
          assignedBy: `${user.name} (Admin)`,
          timestamp: new Date().toISOString()
      });

      alert(`Vehicle assigned to ${selectedDriver.fullName}.`);
      setShowAssignModal(false);
    } catch (error) {
      alert("Failed to assign vehicle");
    }
  };
  
  // --- UNASSIGN VEHICLE ---
  const handleUnassignVehicle = async (driver: any) => {
      if(!driver.vehicle) return;
      if(!confirm(`Unassign vehicle ${driver.vehicle} from ${driver.fullName}?`)) return;
      
      try {
          // Update status only
          await updateDoc(doc(db, "users", driver.id), { vehicle: null, status: 'available' });
          
          if(driver.email) {
              await sendVehicleUnassignmentEmail(driver.email, driver.fullName, driver.vehicle);
          }

          // Log the unassignment (keeps history intact)
          await addDoc(collection(db, "assignment_logs"), {
              driverId: driver.id,
              driverName: driver.fullName,
              vehicleNumber: driver.vehicle,
              action: "Vehicle Unassigned",
              assignedBy: `${user.name} (Admin)`,
              timestamp: new Date().toISOString()
          });
          
          alert("Vehicle unassigned.");
      } catch(e) { alert("Failed to unassign."); }
  };

  const handleDeleteDriver = async (driver: any) => {
    if (!confirm(`Remove ${driver.fullName}?`)) return;
    try { await deleteDoc(doc(db, "users", driver.id)); alert("Removed."); } catch(e) { alert("Failed."); }
  };
  const handleResetPassword = async (email: string) => {
    if (!confirm(`Reset password?`)) return;
    try { await sendPasswordResetEmail(mainAuth, email); alert("Email sent."); } catch(e) { alert("Failed."); }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="driver-management" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex justify-between mb-8">
          <h1 className="text-3xl font-bold">Driver Management</h1>
          <button onClick={() => setShowAddModal(true)} className="px-6 py-3 bg-[#2563EB] text-white rounded-xl flex items-center gap-2"><Plus className="w-5 h-5"/> Register Driver</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {drivers.map((driver) => (
            <Card key={driver.id} className="p-6">
              <div className="flex justify-between mb-4">
                <div className="flex items-center gap-3"><UserIcon className="w-12 h-12 p-2 bg-gray-100 rounded-full text-gray-600"/><div><div className="font-medium">{driver.fullName || driver.name}</div><Badge status={driver.status} size="sm"/></div></div>
                <div className="flex gap-1">
                   <button onClick={() => handleViewHistory(driver)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="History"><FileText className="w-4 h-4"/></button>
                   <button onClick={() => handleResetPassword(driver.email)} className="p-2 hover:bg-blue-50 rounded-lg text-blue-600" title="Reset Password"><Key className="w-4 h-4"/></button>
                   <button onClick={() => handleDeleteDriver(driver)} className="p-2 hover:bg-red-50 rounded-lg text-red-600" title="Delete Driver"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
              <div className="space-y-2 mb-4 text-sm text-gray-600">
                <div className="flex items-center gap-2"><Phone className="w-4 h-4"/> {driver.phone}</div>
                <div className="flex items-center gap-2"><Mail className="w-4 h-4"/> {driver.email}</div>
              </div>
              <div className="pt-4 border-t flex justify-between items-center">
                <div className="text-sm text-gray-500">Vehicle</div>
                <div className="flex gap-2">
                    {driver.vehicle && (
                        <button onClick={() => handleUnassignVehicle(driver)} className="text-xs text-red-500 hover:underline flex items-center gap-1"><MinusCircle className="w-3 h-3"/> Unassign</button>
                    )}
                    <button onClick={() => { setSelectedDriver(driver); setShowAssignModal(true); }} className="text-sm text-[#2563EB] font-medium">Change</button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 p-3 bg-gray-50 rounded-lg"><Car className="w-4 h-4 text-gray-600"/><div className="text-sm text-gray-900">{driver.vehicle || 'None Assigned'}</div></div>
            </Card>
          ))}
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && selectedDriver && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-xl mb-6">Assign Vehicle</h3>
            <div className="space-y-4 mb-6 overflow-y-auto max-h-60">
              {availableVehicles.map((vehicle) => {
                const isAssigned = drivers.find(d => d.vehicle === vehicle.number && d.id !== selectedDriver.id);
                return (
                    <div key={vehicle.id} onClick={() => setSelectedVehicle(vehicle.number)} className={`p-4 border-2 rounded-xl cursor-pointer ${selectedVehicle === vehicle.number ? 'border-[#2563EB] bg-blue-50' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3"><Car className="w-5 h-5 text-gray-600"/><div><div className="font-medium">{vehicle.number}</div><div className="text-xs text-gray-500">{vehicle.model}</div></div></div>
                        {isAssigned && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">In Use by {isAssigned.fullName}</span>}
                    </div>
                    </div>
                );
              })}
            </div>
            <div className="flex gap-3"><button onClick={() => setShowAssignModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button><button onClick={handleAssignVehicle} className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl">Assign & Notify</button></div>
          </Card>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedDriver && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-3xl p-6 max-h-[80vh] overflow-y-auto">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Assignment History</h3>
                  <button onClick={() => setShowHistoryModal(false)}><X className="w-6 h-6 text-gray-500"/></button>
               </div>
               <div className="mb-4 text-sm text-gray-600">Driver: <strong>{selectedDriver.fullName || selectedDriver.name}</strong></div>
               
               <div className="overflow-x-auto mb-6">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-gray-50">
                     <tr>
                       <th className="p-3">Date</th>
                       <th className="p-3">Vehicle</th>
                       <th className="p-3">Action</th>
                       <th className="p-3">Assigned By</th>
                       <th className="p-3">Action</th>
                     </tr>
                   </thead>
                   <tbody>
                     {driverHistory.length > 0 ? driverHistory.map((log, i) => (
                        <tr key={i} className="border-t">
                           <td className="p-3">{new Date(log.timestamp).toLocaleDateString()}</td>
                           <td className="p-3">{log.vehicleNumber}</td>
                           <td className="p-3">{log.action}</td>
                           <td className="p-3 text-gray-500">{log.assignedBy}</td>
                           <td className="p-3">
                              <button onClick={() => handleDeleteLog(log.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                           </td>
                        </tr>
                     )) : <tr><td colSpan={5} className="p-4 text-center text-gray-500">No history found.</td></tr>}
                   </tbody>
                 </table>
               </div>
               <button onClick={handleExportPDF} className="w-full py-3 bg-blue-600 text-white rounded-xl flex justify-center gap-2"><Download className="w-5 h-5"/> Download History PDF</button>
            </Card>
         </div>
      )}

      {/* Add Modal (Same as previous) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
             <h3 className="text-xl mb-6">Register Driver</h3>
             <div className="space-y-4 mb-6">
                <input placeholder="Name" className="w-full p-3 border rounded" onChange={e => setFormData({...formData, name: e.target.value})} />
                <input placeholder="Email" className="w-full p-3 border rounded" onChange={e => setFormData({...formData, email: e.target.value})} />
                <input placeholder="Phone" className="w-full p-3 border rounded" onChange={e => setFormData({...formData, phone: e.target.value})} />
                <input placeholder="License" className="w-full p-3 border rounded" onChange={e => setFormData({...formData, license: e.target.value})} />
                <input placeholder="NIC" className="w-full p-3 border rounded" onChange={e => setFormData({...formData, nic: e.target.value})} />
                <input placeholder="Password" type="password" className="w-full p-3 border rounded" onChange={e => setFormData({...formData, password: e.target.value})} />
             </div>
             <div className="flex gap-3"><button onClick={() => setShowAddModal(false)} className="flex-1 py-3 border rounded">Cancel</button><button onClick={handleAddDriver} className="flex-1 py-3 bg-[#2563EB] text-white rounded">Register</button></div>
          </Card>
        </div>
      )}
    </div>
  );
}