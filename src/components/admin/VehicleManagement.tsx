import { useState } from 'react';
import { Car, Plus, Edit, Wrench } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';

interface VehicleManagementProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

const vehicles = [
  { id: '1', number: 'CAB-2345', model: 'Toyota Corolla', type: 'Sedan', seats: 4, status: 'available' as const, lastService: '2025-11-01' },
  { id: '2', number: 'VAN-5678', model: 'Toyota Hiace', type: 'Van', seats: 12, status: 'in-use' as const, lastService: '2025-10-15' },
  { id: '3', number: 'CAR-1234', model: 'Honda Civic', type: 'Sedan', seats: 4, status: 'available' as const, lastService: '2025-10-28' },
  { id: '4', number: 'SUV-9012', model: 'Mitsubishi Montero', type: 'SUV', seats: 7, status: 'maintenance' as const, lastService: '2025-11-10' },
];

export function VehicleManagement({ user, onNavigate, onLogout }: VehicleManagementProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    number: '',
    model: '',
    type: '',
    seats: '',
  });

  const handleAddVehicle = () => {
    if (!formData.number || !formData.model || !formData.type || !formData.seats) {
      alert('Please fill all fields');
      return;
    }
    alert('Vehicle added successfully!');
    setShowAddModal(false);
    setFormData({ number: '', model: '', type: '', seats: '' });
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="vehicle-management" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl text-gray-900 mb-2">Vehicle Management</h1>
            <p className="text-gray-600">Manage company vehicle fleet</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Vehicle
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Car className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">{vehicles.length}</div>
                <div className="text-sm text-gray-500">Total Vehicles</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Car className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">{vehicles.filter(v => v.status === 'available').length}</div>
                <div className="text-sm text-gray-500">Available</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Wrench className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">{vehicles.filter(v => v.status === 'maintenance').length}</div>
                <div className="text-sm text-gray-500">Maintenance</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Vehicle Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Vehicle Number</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Model</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Type</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Seats</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Last Service</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Car className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="text-gray-900">{vehicle.number}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-900">{vehicle.model}</td>
                    <td className="px-6 py-4 text-gray-600">{vehicle.type}</td>
                    <td className="px-6 py-4 text-gray-600">{vehicle.seats}</td>
                    <td className="px-6 py-4">
                      <Badge status={vehicle.status} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-gray-600">{vehicle.lastService}</td>
                    <td className="px-6 py-4">
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-xl text-gray-900 mb-6">Add New Vehicle</h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Vehicle Number *</label>
                <input
                  type="text"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  placeholder="CAB-2345"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Model *</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="Toyota Corolla"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                >
                  <option value="">Select type</option>
                  <option value="Sedan">Sedan</option>
                  <option value="Van">Van</option>
                  <option value="SUV">SUV</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Number of Seats *</label>
                <input
                  type="number"
                  value={formData.seats}
                  onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
                  placeholder="4"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAddVehicle}
                className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all"
              >
                Add Vehicle
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
