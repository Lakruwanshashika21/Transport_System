import { useState, useEffect } from 'react';
import { User as UserIcon, Plus, Car, Phone, Mail } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, getDocs, query, where, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';

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
  });

  // 2. Fetch Data
  const fetchData = async () => {
    try {
      // A. Fetch Drivers (Users with role = 'driver')
      const q = query(collection(db, "users"), where("role", "==", "driver"));
      const querySnapshot = await getDocs(q);
      const driverList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Derive status: if they have an assigned vehicle, they are 'in-use'
        status: doc.data().vehicle ? 'in-use' : 'available' 
      }));
      setDrivers(driverList);

      // B. Fetch Vehicles
      const vehicleSnapshot = await getDocs(collection(db, "vehicles"));
      const vehicleList = vehicleSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filter only available vehicles (or currently assigned to no one)
      // For simplicity, we show all, but you can filter: .filter(v => v.status === 'available')
      setAvailableVehicles(vehicleList);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 3. Add Driver Handler
  const handleAddDriver = async () => {
    if (!formData.name || !formData.email) {
      alert("Please fill in required fields");
      return;
    }

    try {
      // Create a document in 'users' collection
      // Note: This driver won't have a login password yet. They should register properly or we use Cloud Functions.
      // For this demo, we create the profile so it appears in the list.
      await addDoc(collection(db, "users"), {
        fullName: formData.name,
        email: formData.email,
        phone: formData.phone,
        licenseNumber: formData.license,
        nic: formData.nic,
        role: 'driver',
        driverStatus: 'approved', // Admin added them, so they are approved
        createdAt: new Date().toISOString()
      });

      alert('Driver profile created successfully!');
      setShowAddModal(false);
      setFormData({ name: '', email: '', phone: '', license: '', nic: '' });
      fetchData(); // Refresh list
    } catch (error) {
      console.error("Error adding driver:", error);
      alert("Failed to add driver");
    }
  };

  // 4. Assign Vehicle Handler
  const handleAssignVehicle = async () => {
    if (!selectedVehicle || !selectedDriver) {
      alert('Please select a vehicle');
      return;
    }

    try {
      // Update the driver's document with the assigned vehicle
      const driverRef = doc(db, "users", selectedDriver.id);
      await updateDoc(driverRef, {
        vehicle: selectedVehicle,
        status: 'in-use' // Update their status
      });

      alert(`Vehicle ${selectedVehicle} assigned to ${selectedDriver.fullName || selectedDriver.name}`);
      setShowAssignModal(false);
      fetchData(); // Refresh list
    } catch (error) {
      console.error("Error assigning vehicle:", error);
      alert("Failed to assign vehicle");
    }
  };

  if (loading) {
    return <div className="p-10 text-center">Loading Drivers...</div>;
  }

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

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">{drivers.length}</div>
                <div className="text-sm text-gray-500">Total Drivers</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">{drivers.filter(d => d.status === 'available').length}</div>
                <div className="text-sm text-gray-500">Available</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Car className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">{drivers.filter(d => d.status === 'in-use').length}</div>
                <div className="text-sm text-gray-500">On Duty</div>
              </div>
            </div>
          </Card>
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
                    <div className="text-gray-900">{driver.fullName || driver.name || 'Unknown'}</div>
                    <Badge status={driver.status} size="sm" />
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {driver.phone || 'No Phone'}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {driver.email}
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
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full Name"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Email Address"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Phone Number"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
              <input
                type="text"
                value={formData.license}
                onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                placeholder="License Number"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
              <input
                type="text"
                value={formData.nic}
                onChange={(e) => setFormData({ ...formData, nic: e.target.value })}
                placeholder="NIC Number"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDriver}
                className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF]"
              >
                Add Driver
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Assign Vehicle Modal */}
      {showAssignModal && selectedDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-xl text-gray-900 mb-6">Assign Vehicle to {selectedDriver.fullName || selectedDriver.name}</h3>

            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
              {availableVehicles.length === 0 ? <p>No vehicles found.</p> : availableVehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  onClick={() => setSelectedVehicle(vehicle.number)}
                  className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    selectedVehicle === vehicle.number
                      ? 'border-[#2563EB] bg-blue-50'
                      : 'border-gray-200 hover:border-[#2563EB]'
                  }`}
                >
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
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignVehicle}
                className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF]"
              >
                Assign Vehicle
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}