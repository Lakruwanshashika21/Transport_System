import { useState, useEffect } from 'react';
import { User as UserIcon, Plus, Car, Phone, Mail, Trash2, Key } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, getDocs, query, where, doc, updateDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore'; // Added onSnapshot
import { initializeApp, deleteApp, getApp, getApps } from 'firebase/app'; 
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { db, firebaseConfig, auth as mainAuth } from '../../firebase';

interface DriverManagementProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export function DriverManagement({ user, onNavigate, onLogout }: DriverManagementProps) {
  // 1. State
  const [drivers, setDrivers] = useState<any[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    license: '',
    nic: '',
    password: '' // Added Password field
  });

  // 2. Real-Time Fetch
  useEffect(() => {
    setLoading(true);

    // A. Listen to Drivers
    const q = query(collection(db, "users"), where("role", "==", "driver"));
    const unsubDrivers = onSnapshot(q, (snapshot) => {
      const driverList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Derive status: if they have an assigned vehicle, they are 'in-use'
        status: doc.data().vehicle ? 'in-use' : 'available' 
      }));
      setDrivers(driverList);
    });

    // B. Listen to Vehicles
    const unsubVehicles = onSnapshot(collection(db, "vehicles"), (snapshot) => {
      const vehicleList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAvailableVehicles(vehicleList);
      setLoading(false);
    });

    // Cleanup listeners on unmount
    return () => {
      unsubDrivers();
      unsubVehicles();
    };
  }, []);

  // 3. Add Driver Handler (With Real Auth Creation)
  const handleAddDriver = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      alert("Please fill in required fields");
      return;
    }

    let secondaryApp;
    try {
      // Prevent duplicate app error
      if (getApps().some(app => app.name === "SecondaryDriver")) {
        const existingApp = getApp("SecondaryDriver");
        await deleteApp(existingApp);
      }

      // Create temp app to register user without logging out admin
      secondaryApp = initializeApp(firebaseConfig, "SecondaryDriver");
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
      const uid = userCredential.user.uid;

      // Save to Database
      await setDoc(doc(db, "users", uid), {
        uid: uid,
        fullName: formData.name,
        email: formData.email,
        phone: formData.phone,
        licenseNumber: formData.license,
        nic: formData.nic,
        role: 'driver',
        driverStatus: 'approved',
        createdAt: new Date().toISOString()
      });

      alert('Driver account created successfully!');
      setShowAddModal(false);
      setFormData({ name: '', email: '', phone: '', license: '', nic: '', password: '' });
    } catch (error: any) {
      console.error("Error adding driver:", error);
      if (error.code === 'auth/email-already-in-use') {
         alert("This email is already registered.");
      } else {
         alert("Failed to add driver: " + error.message);
      }
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp).catch(console.error);
    }
  };

  // 4. Assign Vehicle Handler
  const handleAssignVehicle = async () => {
    if (!selectedVehicle || !selectedDriver) {
      alert('Please select a vehicle');
      return;
    }
    try {
      // Update the driver's document
      const driverRef = doc(db, "users", selectedDriver.id);
      await updateDoc(driverRef, {
        vehicle: selectedVehicle,
        status: 'in-use'
      });
      
      // Optionally update vehicle status too if needed
      // const vehicleId = availableVehicles.find(v => v.number === selectedVehicle)?.id;
      // if(vehicleId) await updateDoc(doc(db, 'vehicles', vehicleId), { status: 'in-use' });

      alert(`Vehicle ${selectedVehicle} assigned to ${selectedDriver.fullName || selectedDriver.name}`);
      setShowAssignModal(false);
    } catch (error) {
      console.error("Error assigning vehicle:", error);
      alert("Failed to assign vehicle");
    }
  };

  // 5. Delete Driver
  const handleDeleteDriver = async (driver: any) => {
    if (!window.confirm(`Are you sure you want to remove driver ${driver.fullName || driver.name}? This action cannot be undone.`)) return;

    try {
      await deleteDoc(doc(db, "users", driver.id));
      alert("Driver removed. They will no longer be able to log in.");
    } catch (error: any) {
      console.error("Error deleting driver:", error);
      alert("Failed to delete driver: " + error.message);
    }
  };

  // 6. Reset Password
  const handleResetPassword = async (email: string) => {
    if (!window.confirm(`Send password reset email to ${email}?`)) return;
    try {
      await sendPasswordResetEmail(mainAuth, email);
      alert(`Reset email sent to ${email}`);
    } catch (error: any) {
      console.error("Reset error:", error);
      alert("Failed to send email: " + error.message);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading Drivers...</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="driver-management" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl text-gray-900 mb-2">Driver Management</h1>
            <p className="text-gray-600">Manage drivers and vehicle assignments</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all"
          >
            <Plus className="w-5 h-5" />
            Register Driver
          </button>
        </div>

        {/* Driver Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {drivers.map((driver) => (
            <Card key={driver.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-gray-900 font-medium">{driver.fullName || driver.name || 'Unknown'}</div>
                    <Badge status={driver.status} size="sm" />
                  </div>
                </div>
                {/* Action Menu */}
                <div className="flex gap-1">
                   <button onClick={() => handleResetPassword(driver.email)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Reset Password">
                     <Key className="w-4 h-4" />
                   </button>
                   <button onClick={() => handleDeleteDriver(driver)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete Driver">
                     <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" /> {driver.phone || 'No Phone'}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" /> {driver.email}
                </div>
                <div className="text-sm text-gray-600">
                  License: {driver.licenseNumber || driver.license || 'N/A'}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-gray-500">Assigned Vehicle</div>
                  <button
                    onClick={() => {
                      setSelectedDriver(driver);
                      setShowAssignModal(true);
                    }}
                    className="text-sm text-[#2563EB] hover:text-[#1E40AF]"
                  >
                    Change
                  </button>
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <Car className="w-4 h-4 text-gray-600" />
                  <div className="text-sm text-gray-900">{driver.vehicle || 'None Assigned'}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Add Driver Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-xl text-gray-900 mb-6">Register New Driver</h3>
            <div className="space-y-4 mb-6">
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Full Name" className="w-full px-4 py-3 border border-gray-300 rounded-xl" />
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="Email Address" className="w-full px-4 py-3 border border-gray-300 rounded-xl" />
              <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Phone Number" className="w-full px-4 py-3 border border-gray-300 rounded-xl" />
              <input type="text" value={formData.license} onChange={(e) => setFormData({ ...formData, license: e.target.value })} placeholder="License Number" className="w-full px-4 py-3 border border-gray-300 rounded-xl" />
              <input type="text" value={formData.nic} onChange={(e) => setFormData({ ...formData, nic: e.target.value })} placeholder="NIC Number" className="w-full px-4 py-3 border border-gray-300 rounded-xl" />
              <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Password" className="w-full px-4 py-3 border border-gray-300 rounded-xl" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 border border-gray-300 rounded-xl">Cancel</button>
              <button onClick={handleAddDriver} className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl">Register Driver</button>
            </div>
          </Card>
        </div>
      )}

      {/* Assign Vehicle Modal */}
      {showAssignModal && selectedDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-xl text-gray-900 mb-6">Assign Vehicle</h3>
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
              {availableVehicles.length === 0 ? <p>No vehicles found.</p> : availableVehicles.map((vehicle) => (
                <div key={vehicle.id} onClick={() => setSelectedVehicle(vehicle.number)} className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedVehicle === vehicle.number ? 'border-[#2563EB] bg-blue-50' : 'border-gray-200 hover:border-[#2563EB]'}`}>
                  <div className="flex items-center gap-3">
                    <Car className="w-5 h-5 text-gray-600" />
                    <div>
                      <div className="text-gray-900">{vehicle.number}</div>
                      <div className="text-sm text-gray-500">{vehicle.model || 'Unknown Model'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAssignModal(false)} className="flex-1 py-3 border border-gray-300 rounded-xl">Cancel</button>
              <button onClick={handleAssignVehicle} className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl">Assign Vehicle</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}