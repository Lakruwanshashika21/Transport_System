import { useState, useEffect } from 'react';
import { Car, Plus, Edit, Wrench, DollarSign, Trash2, X } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

interface VehicleManagementProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export function VehicleManagement({ user, onNavigate, onLogout }: VehicleManagementProps) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    number: '',
    model: '',
    type: '',
    seats: '',
    rate: '', 
  });

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, "vehicles"), (snapshot) => {
      const vehicleList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVehicles(vehicleList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const openAddModal = () => {
    setIsEditing(false);
    setFormData({ number: '', model: '', type: '', seats: '', rate: '' });
    setShowModal(true);
  };

  const openEditModal = (vehicle: any) => {
    setIsEditing(true);
    setSelectedVehicleId(vehicle.id);
    setFormData({
      number: vehicle.number,
      model: vehicle.model,
      type: vehicle.type,
      seats: vehicle.seats,
      rate: vehicle.ratePerKm || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.number || !formData.model || !formData.type || !formData.seats || !formData.rate) {
      alert('Please fill all fields including Rate');
      return;
    }

    try {
      const vehicleData = {
        number: formData.number,
        model: formData.model,
        type: formData.type,
        seats: parseInt(formData.seats.toString()),
        ratePerKm: parseFloat(formData.rate.toString()),
      };

      if (isEditing && selectedVehicleId) {
        await updateDoc(doc(db, "vehicles", selectedVehicleId), vehicleData);
        alert('Vehicle updated!');
      } else {
        await addDoc(collection(db, "vehicles"), {
          ...vehicleData,
          status: 'available',
          lastService: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString()
        });
        alert('Vehicle added!');
      }
      setShowModal(false);
    } catch (error) {
      console.error("Error saving vehicle:", error);
      alert("Failed to save vehicle.");
    }
  };

  // DELETE VEHICLE HANDLER
  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this vehicle?")) {
      try {
        await deleteDoc(doc(db, "vehicles", id));
      } catch (error) {
        console.error("Error deleting:", error);
        alert("Failed to delete vehicle.");
      }
    }
  };

  if (loading) return <div className="p-10 text-center">Loading Fleet...</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="vehicle-management" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl text-gray-900 mb-2">Vehicle Management</h1>
            <p className="text-gray-600">Manage fleet and set pricing rates</p>
          </div>
          <button onClick={openAddModal} className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all">
            <Plus className="w-5 h-5" /> Add Vehicle
          </button>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Vehicle</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Type</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Seats</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Rate (LKR/km)</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-gray-900 font-medium">{vehicle.number}</div>
                      <div className="text-xs text-gray-500">{vehicle.model}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{vehicle.type}</td>
                    <td className="px-6 py-4 text-gray-600">{vehicle.seats}</td>
                    <td className="px-6 py-4 text-gray-900 font-medium">{vehicle.ratePerKm ? `LKR ${vehicle.ratePerKm}` : 'Not Set'}</td>
                    <td className="px-6 py-4"><Badge status={vehicle.status} size="sm" /></td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => openEditModal(vehicle)} className="p-2 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-lg transition-all"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(vehicle.id)} className="p-2 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl text-gray-900">{isEditing ? 'Edit Vehicle' : 'Add New Vehicle'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Vehicle Number *</label>
                <input type="text" value={formData.number} onChange={(e) => setFormData({ ...formData, number: e.target.value })} placeholder="CAB-2345" className="w-full px-4 py-3 border border-gray-300 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Model</label>
                  <input type="text" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} placeholder="Toyota" className="w-full px-4 py-3 border border-gray-300 rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Type</label>
                  <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl">
                    <option value="">Select</option>
                    <option value="Sedan">Sedan</option>
                    <option value="Van">Van</option>
                    <option value="SUV">SUV</option>
                    <option value="Bus">Bus</option>
                    <option value="Lorry">Lorry</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Seats</label>
                  <input type="number" value={formData.seats} onChange={(e) => setFormData({ ...formData, seats: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Rate (LKR/km)</label>
                  <input type="number" value={formData.rate} onChange={(e) => setFormData({ ...formData, rate: e.target.value })} placeholder="50" className="w-full px-4 py-3 border border-gray-300 rounded-xl" />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 border border-gray-300 rounded-xl">Cancel</button>
              <button onClick={handleSubmit} className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl">{isEditing ? 'Update' : 'Save'}</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}