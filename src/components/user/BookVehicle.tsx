import { useState } from 'react';
import { MapPin, Calendar, Clock, Car, Check, Navigation, ArrowRight } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';

interface BookVehicleProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

const availableVehicles = [
  { id: '1', number: 'CAB-2345', model: 'Toyota Corolla', type: 'Sedan', seats: 4, status: 'available' as const },
  { id: '2', number: 'VAN-5678', model: 'Toyota Hiace', type: 'Van', seats: 12, status: 'available' as const },
  { id: '3', number: 'CAR-1234', model: 'Honda Civic', type: 'Sedan', seats: 4, status: 'available' as const },
  { id: '4', number: 'SUV-9012', model: 'Mitsubishi Montero', type: 'SUV', seats: 7, status: 'in-use' as const },
];

export function BookVehicle({ user, onNavigate, onLogout }: BookVehicleProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [bookingData, setBookingData] = useState({
    pickup: '',
    destination: '',
    date: '',
    time: '',
    vehicleId: '',
  });

  const handleUseCurrentLocation = () => {
    setBookingData({ ...bookingData, pickup: 'Main Office Building, Colombo 03' });
  };

  const handleBooking = () => {
    alert('Booking request submitted successfully! Waiting for admin approval.');
    onNavigate('user-dashboard');
  };

  const steps = [
    { number: 1, label: 'Pickup' },
    { number: 2, label: 'Destination' },
    { number: 3, label: 'Date & Time' },
    { number: 4, label: 'Vehicle' },
    { number: 5, label: 'Confirm' },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="book-vehicle" />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-3xl text-gray-900 mb-2">Book a Vehicle</h1>
          <p className="text-gray-600">Schedule your trip in a few simple steps</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      currentStep >= step.number
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {currentStep > step.number ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <span>{step.number}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mt-2 hidden sm:block">{step.label}</div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 flex-1 mx-2 transition-all ${
                      currentStep > step.number ? 'bg-[#2563EB]' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="p-6 sm:p-8">
          {/* Step 1: Pickup Location */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-xl text-gray-900 mb-6">Select Pickup Location</h2>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-2">Pickup Address</label>
                <div className="relative">
                  <input
                    type="text"
                    value={bookingData.pickup}
                    onChange={(e) => setBookingData({ ...bookingData, pickup: e.target.value })}
                    placeholder="Enter pickup location"
                    className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  />
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              <button
                onClick={handleUseCurrentLocation}
                className="flex items-center gap-2 px-4 py-2 text-[#2563EB] border border-[#2563EB] rounded-xl hover:bg-[#2563EB] hover:text-white transition-all mb-6"
              >
                <Navigation className="w-4 h-4" />
                Use My Current Location
              </button>

              {/* Mock Map */}
              <div className="w-full h-64 bg-gray-200 rounded-xl flex items-center justify-center mb-6">
                <div className="text-center">
                  <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Interactive Map View</p>
                  <p className="text-sm text-gray-400">Select location on map</p>
                </div>
              </div>

              <button
                onClick={() => setCurrentStep(2)}
                disabled={!bookingData.pickup}
                className="w-full py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Next: Select Destination
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Step 2: Destination */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-xl text-gray-900 mb-6">Select Destination</h2>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-2">Destination Address</label>
                <div className="relative">
                  <input
                    type="text"
                    value={bookingData.destination}
                    onChange={(e) => setBookingData({ ...bookingData, destination: e.target.value })}
                    placeholder="Enter destination"
                    className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  />
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2563EB]" />
                </div>
              </div>

              {/* Mock Map with Route */}
              <div className="w-full h-64 bg-gray-200 rounded-xl flex items-center justify-center mb-6">
                <div className="text-center">
                  <MapPin className="w-12 h-12 text-[#2563EB] mx-auto mb-2" />
                  <p className="text-gray-500">Route Preview</p>
                  <p className="text-sm text-gray-400">Distance: 12.5 km • Est. Time: 25 min</p>
                </div>
              </div>

              {bookingData.destination && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Estimated Distance</div>
                      <div className="text-lg text-gray-900">12.5 km</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Estimated Cost</div>
                      <div className="text-lg text-gray-900">LKR 1,500</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  disabled={!bookingData.destination}
                  className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Next: Date & Time
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Date & Time */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-xl text-gray-900 mb-6">Select Date & Time</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={bookingData.date}
                      onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                    />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-2">Time</label>
                  <div className="relative">
                    <input
                      type="time"
                      value={bookingData.time}
                      onChange={(e) => setBookingData({ ...bookingData, time: e.target.value })}
                      className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                    />
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(4)}
                  disabled={!bookingData.date || !bookingData.time}
                  className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Next: Select Vehicle
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Vehicle Selection */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-xl text-gray-900 mb-6">Select Vehicle</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {availableVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    onClick={() => vehicle.status === 'available' && setBookingData({ ...bookingData, vehicleId: vehicle.id })}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      bookingData.vehicleId === vehicle.id
                        ? 'border-[#2563EB] bg-blue-50'
                        : vehicle.status === 'available'
                        ? 'border-gray-200 hover:border-[#2563EB]'
                        : 'border-gray-200 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Car className="w-6 h-6 text-gray-600" />
                        </div>
                        <div>
                          <div className="text-gray-900">{vehicle.number}</div>
                          <div className="text-sm text-gray-500">{vehicle.model}</div>
                        </div>
                      </div>
                      <Badge status={vehicle.status} size="sm" />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div>{vehicle.type}</div>
                      <div>•</div>
                      <div>{vehicle.seats} seats</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(5)}
                  disabled={!bookingData.vehicleId}
                  className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Review Booking
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Confirmation */}
          {currentStep === 5 && (
            <div>
              <h2 className="text-xl text-gray-900 mb-6">Confirm Booking</h2>
              
              <div className="space-y-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-sm text-gray-500 mb-1">Pickup Location</div>
                  <div className="text-gray-900">{bookingData.pickup}</div>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-sm text-gray-500 mb-1">Destination</div>
                  <div className="text-gray-900">{bookingData.destination}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-sm text-gray-500 mb-1">Date</div>
                    <div className="text-gray-900">{bookingData.date}</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-sm text-gray-500 mb-1">Time</div>
                    <div className="text-gray-900">{bookingData.time}</div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-sm text-gray-500 mb-1">Vehicle</div>
                  <div className="text-gray-900">
                    {availableVehicles.find(v => v.id === bookingData.vehicleId)?.number} - {availableVehicles.find(v => v.id === bookingData.vehicleId)?.model}
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="text-gray-700">Estimated Cost</div>
                    <div className="text-xl text-gray-900">LKR 1,500</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(4)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleBooking}
                  className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all"
                >
                  Confirm Booking
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
