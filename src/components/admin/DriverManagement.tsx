import { useState } from 'react';
import { User as UserIcon, Plus, Car, Phone, Mail } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';

interface DriverManagementProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

const drivers = [
  { id: '1', name: 'Mike Wilson', phone: '+94 77 123 4567', email: 'mike.wilson@company.com', license: 'DL12345678', vehicle: 'CAB-2345', status: 'available' as const },
  { id: '2', name: 'Sarah Johnson', phone: '+94 77 234 5678', email: 'sarah.johnson@company.com', license: 'DL23456789', vehicle: 'VAN-5678', status: 'in-use' as const },
  { id: '3', name: 'David Miller', phone: '+94 77 345 6789', email: 'david.miller@company.com', license: 'DL34567890', vehicle: 'CAR-1234', status: 'available' as const },
];

const availableVehicles = [
  { id: '1', number: 'CAB-2345', model: 'Toyota Corolla' },
  { id: '2', number: 'VAN-5678', model: 'Toyota Hiace' },
  { id: '3', number: 'CAR-1234', model: 'Honda Civic' },
  { id: '4', number: 'SUV-9012', model: 'Mitsubishi Montero' },
];

export function DriverManagement({ user, onNavigate, onLogout }: DriverManagementProps) {
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

  const handleAddDriver = () => {
    alert('Driver added successfully!');
    setShowAddModal(false);
    setFormData({ name: '', email: '', phone: '', license: '', nic: '' });
  };

  const handleAssignVehicle = () => {
    if (!selectedVehicle) {
      alert('Please select a vehicle');
      return;
    }
    alert(`Vehicle ${selectedVehicle} assigned to ${selectedDriver.name}`);
    setShowAssignModal(false);
  };

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
                    <div className="text-gray-900">{driver.name}</div>
                    <Badge status={driver.status} size="sm" />
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {driver.phone}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {driver.email}
                </div>
                <div className="text-sm text-gray-600">
                  License: {driver.license}
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
                  <div className="text-sm text-gray-900">{driver.vehicle}</div>
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
            <h3 className="text-xl text-gray-900 mb-6">Assign Vehicle to {selectedDriver.name}</h3>

            <div className="space-y-3 mb-6">
              {availableVehicles.map((vehicle) => (
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
                      <div className="text-sm text-gray-500">{vehicle.model}</div>
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
