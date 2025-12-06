import { useState } from 'react';
import { MapPin, Calendar, Clock, Car, Users, Send, AlertCircle, UserPlus } from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc, query, getDocs } from 'firebase/firestore';
import { logAction } from '../../utils/auditLogger';

interface QuickTripBookingProps {
    adminUser: {
        uid: string;
        email: string;
        name?: string;
        phone?: string;
        epfNumber?: string;
    };
    onTripCreated: () => void; // Callback to refresh dashboard list
}

// Mock/Simple Serial Number Generator
const generateNextSerialNumber = async (prefix: string): Promise<string> => {
     const now = new Date();
     const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
     const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
     const mockIncrement = String(Math.floor(Math.random() * 900) + 100); 
     return `${prefix}-${datePart}-${timePart}-${mockIncrement}`;
};


export function QuickTripBooking({ adminUser, onTripCreated }: QuickTripBookingProps) {
    const [formData, setFormData] = useState({
        date: '',
        time: '',
        pickup: '',
        destination: '',
        passengers: 1,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.passengers <= 0 || !formData.date || !formData.time || !formData.pickup || !formData.destination) {
            setError("Please fill all fields and ensure passenger count is valid.");
            return;
        }

        setLoading(true);

        try {
            // Use 'A' prefix for Admin Bookings, or 'TRP' as per your original structure
            const serialNumber = await generateNextSerialNumber('TRP'); 
            
            const tripData = {
                serialNumber: serialNumber,
                userId: adminUser.uid,
                customer: adminUser.name || adminUser.email,
                customerName: adminUser.name || adminUser.email,
                customerPhone: adminUser.phone || 'N/A',
                email: adminUser.email,
                epf: adminUser.epfNumber || 'N/A',
                
                passengers: formData.passengers,
                pickup: formData.pickup,
                destination: formData.destination,
                destinations: [], // Simplified: no intermediate stops for quick booking
                date: formData.date,
                time: formData.time,
                
                // Admin bookings start in a PENDING state for management approval/assignment
                status: 'pending', 
                requestedAt: new Date().toISOString(),
                // Mock distance and cost (will be calculated by AdminApproval later)
                distance: 'N/A',
                cost: 'LKR 0',
            };

            await addDoc(collection(db, "trip_requests"), tripData);
            
            await logAction(adminUser.email, 'TRIP_BOOKING_ADMIN', `Admin booked trip #${serialNumber} for self.`, { tripId: serialNumber });

            alert(`Trip #${serialNumber} successfully submitted for approval!`);
            onTripCreated(); // Notify the parent component (Dashboard) to refresh
            setLoading(false);
            
            // Clear form after submission
            setFormData({ date: '', time: '', pickup: '', destination: '', passengers: 1 });


        } catch (err) {
            console.error("Admin booking failed:", err);
            setError("Failed to create trip. Check console for details.");
            setLoading(false);
        }
    };

    return (
        <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Car className="w-5 h-5 text-green-600"/> Quick Book Trip (Self)
            </h3>

            {error && (
                 <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-start gap-2">
                     <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                     <div className="text-left">{error}</div>
                 </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Pickup & Destination */}
                <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Route (Pickup to Destination) *</label>
                    <input
                        type="text"
                        name="pickup"
                        value={formData.pickup}
                        onChange={handleChange}
                        placeholder="Pickup Location"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
                        required
                    />
                    <input
                        type="text"
                        name="destination"
                        value={formData.destination}
                        onChange={handleChange}
                        placeholder="Final Destination"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        required
                    />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Date *</label>
                        <input
                            type="date"
                            name="date"
                            value={formData.date}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Time *</label>
                        <input
                            type="time"
                            name="time"
                            value={formData.time}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            required
                        />
                    </div>
                </div>

                {/* Passengers */}
                <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Passengers *</label>
                    <input
                        type="number"
                        name="passengers"
                        min="1"
                        value={formData.passengers}
                        onChange={handleChange}
                        placeholder="1"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
                >
                    <Send className="w-5 h-5"/> {loading ? 'Submitting...' : 'Submit for Approval'}
                </button>
            </form>
        </div>
    );
}