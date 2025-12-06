import { useState, useEffect } from 'react';
import { MapPin, Calendar, Clock, Car, Phone, User as UserIcon, Navigation, FileText, X, Download, User as PaxIcon, CheckCircle, MessageSquare, AlertTriangle } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import jsPDF from 'jspdf';
import { sendMergeRejectionToCandidate } from '../../utils/emailService';
import { logAction } from '../../utils/auditLogger'; 

interface ViewTripProps {
  user: User;
  tripId: string | null;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

// 🆕 PDF GENERATION LOGIC
const generateTripTicketPDF = (trip: any, user: User) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [148, 210] });
    const margin = 10;
    let y = margin;
    const pageWidth = doc.internal.pageSize.width;
    const headerImgPath = '/report-header.jpg'; 

    try { doc.addImage(headerImgPath, 'JPEG', (pageWidth - 100) / 2, y, 100, 15); } catch(e) { doc.setFontSize(14); doc.text("Carlos Transport System", (pageWidth / 2), y + 5, { align: 'center' }); }
    y += 20;
    
    doc.setFontSize(16); doc.setTextColor(37, 99, 235); 
    doc.text("Official Trip Ticket", pageWidth / 2, y, { align: 'center' });
    y += 8; doc.setDrawColor(200); doc.line(margin, y, pageWidth - margin, y); y += 5;

    doc.setFontSize(10); doc.setTextColor(50); doc.setFont('helvetica', 'bold');
    doc.text(`TRIP ID: #${trip.serialNumber || trip.id}`, margin, y);
    doc.text(`STATUS: ${trip.status.toUpperCase()}`, pageWidth - margin, y, { align: 'right' });
    y += 6;
    
    doc.setFontSize(12); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
    doc.text(`Pickup: ${trip.pickup}`, margin, y); y += 6;
    doc.text(`Drop-off: ${trip.destination}`, margin, y); y += 8;

    doc.setDrawColor(200); doc.setFillColor(240, 240, 240); 
    doc.rect(margin, y, pageWidth - 2 * margin, 35, 'F'); 
    doc.setFontSize(10); doc.setTextColor(50); doc.setFont('helvetica', 'bold');
    let boxY = y + 5;
    
    doc.text("VEHICLE:", margin + 3, boxY); doc.setFont('helvetica', 'normal'); doc.text(trip.vehicleNumber || 'Pending', margin + 30, boxY);
    doc.setFont('helvetica', 'bold'); doc.text("DRIVER:", margin + 3, boxY + 6); doc.setFont('helvetica', 'normal'); doc.text(trip.driverName || 'Pending', margin + 30, boxY + 6);
    
    // Check if MERGED
    const totalPax = trip.linkedTripIds && trip.linkedTripIds.length > 0 ? (trip.passengers || 1) + (trip.linkedTripIds.reduce((sum: number, linkedTrip: any) => sum + (linkedTrip.passengers || 1), 0) || 0) : trip.passengers || 1;
    doc.setFont('helvetica', 'bold'); doc.text("PASSENGERS:", margin + 3, boxY + 12); doc.setFont('helvetica', 'normal'); doc.text(totalPax.toString(), margin + 30, boxY + 12);
    
    doc.setFont('helvetica', 'bold'); doc.text("DISTANCE:", margin + 3, boxY + 18); doc.setFont('helvetica', 'normal'); doc.text(trip.distance || 'N/A', margin + 30, boxY + 18);
    doc.setFont('helvetica', 'bold'); doc.text("COST:", margin + 3, boxY + 24); doc.setTextColor(22, 163, 74); 
    doc.text(trip.cost || 'N/A', margin + 30, boxY + 24);
    
    y += 40;

    doc.setFontSize(9); doc.setTextColor(50); doc.setFont('helvetica', 'bold');
    doc.text("BOOKING DETAILS", margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Requested By: ${trip.customerName || trip.customer}`, margin, y + 5);
    doc.text(`Req Date: ${trip.date} @ ${trip.time}`, margin, y + 10);
    
    doc.setFont('helvetica', 'bold');
    doc.text("APPROVAL DETAILS", pageWidth / 2, y);
    doc.setFont('helvetica', 'normal');
    const approvedBy = trip.approvedByAdmin || 'Admin'; 
    doc.text(`Approved By: ${approvedBy}`, pageWidth / 2, y + 5);
    doc.text(`Approve Date: ${trip.approvedDate || 'N/A'}`, pageWidth / 2, y + 10);
    
    y += 15;
    
    doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
    doc.text("ODOMETER READINGS", margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Start: ${trip.odometerStart || 'N/A'} km`, margin + 5, y + 5);
    doc.text(`End: ${trip.odometerEnd || 'N/A'} km`, margin + 5, y + 10);
    
    doc.text("Driver Signature: __________________", pageWidth / 2, y + 15);
    
    doc.save(`Trip_Ticket_${trip.serialNumber}.pdf`);
}


export function ViewTrip({ user, tripId, onNavigate, onLogout }: ViewTripProps) {
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  // 🆕 NEW STATE: Merge decision modal/reason
  const [showMergeDecisionModal, setShowMergeDecisionModal] = useState(false);
  const [mergeRejectReason, setMergeRejectReason] = useState('');
  const [candidateTrip, setCandidateTrip] = useState<any>(null);


  // 1. Fetch Trip Data
  const fetchTrip = async () => {
    if (!tripId) return;
    try {
      const docRef = doc(db, "trip_requests", tripId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setTrip(data);
        
        // Check if the trip is the target of a merge request (only if status is awaiting approval)
        if (data.status === 'awaiting_merge_approval' && data.consolidationRequest?.candidateId) {
            const candidateSnap = await getDoc(doc(db, "trip_requests", data.consolidationRequest.candidateId));
            if (candidateSnap.exists()) {
                setCandidateTrip({ id: candidateSnap.id, ...candidateSnap.data() });
                // Only show modal if user hasn't decided yet
                if (data.userId === user.id) setShowMergeDecisionModal(true);
            }
        } else {
             setCandidateTrip(null);
        }

      } else {
        alert("Trip not found.");
        onNavigate('user-dashboard');
      }
    } catch (error) {
      console.error("Error fetching trip:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
      fetchTrip();
  }, [tripId]);

  // 2. Handle Cancel Trip
  const handleCancelTrip = async () => {
    if (!trip) return;
    if (!cancelReason.trim()) {
        alert("Cancellation reason is required.");
        return;
    }
    
    try {
      const tripRef = doc(db, "trip_requests", trip.id);
      await updateDoc(tripRef, { 
          status: 'cancelled', 
          cancellationReason: cancelReason,
          cancelledBy: user.name || user.email,
          cancelledAt: new Date().toISOString()
      });

      // Optionally update vehicle/driver status if it was approved/in-progress
      if (trip.status === 'approved' || trip.status === 'in-progress') {
          if (trip.vehicleId) { await updateDoc(doc(db, "vehicles", trip.vehicleId), { status: 'available' }); }
          if (trip.driverId) { await updateDoc(doc(db, "users", trip.driverId), { status: 'available' }); }
      }
      
      // Log Cancellation
      await logAction({
          adminName: user.name || user.email,
          adminEmail: user.email,
          section: 'Trip Management',
          action: 'Trip Cancelled',
          details: `User cancelled trip #${trip.serialNumber}. Reason: ${cancelReason}`,
          targetId: trip.id
      });

      alert(`Trip #${trip.serialNumber} cancelled.`);
      setShowCancelModal(false);
      onNavigate('user-dashboard'); 
    } catch (error) {
      console.error("Error cancelling trip:", error);
      alert("Failed to cancel trip.");
    }
  };
  
  // 3. 🆕 Merge Handlers
  
  const handleApproveMerge = async () => {
    if (!trip || !candidateTrip) return;
    
    try {
        // 1. Update MASTER Trip (this trip) - Mark as merged, update passenger count
        await updateDoc(doc(db, "trip_requests", trip.id), {
            status: 'merged',
            isMerged: true,
            passengers: (trip.passengers || 1) + (candidateTrip.passengers || 1),
            linkedTripIds: [...(trip.linkedTripIds || []), candidateTrip.serialNumber],
            // Clear merge request data
            consolidationRequest: null,
            mergeCandidateDetails: null, 
        });

        // 2. Update CANDIDATE Trip (the new trip) - Mark as merged and link back to master
        await updateDoc(doc(db, "trip_requests", candidateTrip.id), {
            status: 'merged',
            isMerged: true,
            masterTripId: trip.id, 
            // Also link the vehicle/driver info to the candidate trip now that the master trip is approved
            vehicleId: trip.vehicleId, 
            driverId: trip.driverId,
            vehicleNumber: trip.vehicleNumber, 
            driverName: trip.driverName, 
        });

        // 3. Log Action
        await logAction({
            adminName: user.name || user.email,
            adminEmail: user.email,
            section: 'Trip Approval',
            action: 'Merge Approved (User)',
            details: `User approved merge of Trip #${candidateTrip.serialNumber} into Master Trip #${trip.serialNumber}`,
            tripId: trip.id,
            mergeDetails: `Merged Candidate: ${candidateTrip.serialNumber}`,
        });

        alert(`Trip successfully consolidated with Trip #${candidateTrip.serialNumber}!`);
        setShowMergeDecisionModal(false);
        fetchTrip(); // Reload data
        
    } catch (e) {
        console.error("Error finalizing merge:", e);
        alert("Failed to approve merge.");
    }
  };
  
  const handleRejectMerge = async () => {
    if (!trip || !candidateTrip) return;
    if (!mergeRejectReason.trim()) {
        alert("Please provide a reason for rejecting the merge.");
        return;
    }
    
    try {
        // 1. Update MASTER Trip (this trip) - Revert status to pending/approved
        await updateDoc(doc(db, "trip_requests", trip.id), {
            status: trip.vehicleId ? 'approved' : 'pending', 
            consolidationRequest: null,
            mergeCandidateDetails: null,
        });
        
        // 2. Update CANDIDATE Trip (the new trip) - Reject it and notify the candidate user
        await updateDoc(doc(db, "trip_requests", candidateTrip.id), {
            status: 'rejected',
            rejectionReason: `Merge declined by main traveler. Reason: ${mergeRejectReason}`,
        });
        
        // 3. Notify candidate user about rejection
        await sendMergeRejectionToCandidate(candidateTrip, trip, mergeRejectReason);
        
        // 4. Log Action
        await logAction({
            adminName: user.name || user.email,
            adminEmail: user.email,
            section: 'Trip Approval',
            action: 'Merge Rejected (User)',
            details: `User rejected merge of Trip #${candidateTrip.serialNumber} by Trip #${trip.serialNumber}. Reason: ${mergeRejectReason}`,
            tripId: trip.id,
            mergeDetails: `Rejected Candidate: ${candidateTrip.serialNumber}`,
        });

        alert(`Merge request rejected. Candidate user notified.`);
        setShowMergeDecisionModal(false);
        fetchTrip(); 
        
    } catch (e) {
        console.error("Error rejecting merge:", e);
        alert("Failed to reject merge.");
    }
  };


  if (loading) return <div className="p-10 text-center">Loading Trip Details...</div>;
  if (!trip) return null; // Should not happen if fetchTrip works

  const isCancellable = trip.status === 'pending' || trip.status === 'approved';
  const isTicketReady = trip.status === 'approved' || trip.status === 'in-progress' || trip.status === 'completed' || trip.status === 'merged' || trip.status === 're-assigned';
  const isMergedTrip = trip.linkedTripIds && trip.linkedTripIds.length > 0;
  
  const totalPassengers = isMergedTrip ? (trip.passengers || 1) + (trip.linkedTripIds.reduce((sum: number, linkedTrip: any) => sum + (linkedTrip.passengers || 1), 0) || 0) : trip.passengers || 1;


  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <button onClick={() => onNavigate('user-dashboard')} className="text-[#2563EB] mb-4 flex items-center">← Back to Dashboard</button>
        <h1 className="text-3xl text-gray-900 mb-6">Trip Details #{trip.serialNumber || trip.id}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: DETAILS */}
          <div className="lg:col-span-2 space-y-6">
             <Card className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold">Route & Schedule</h2>
                    <Badge status={trip.status} size="md" />
                </div>
                
                <div className="space-y-4">
                    <div className="flex items-center gap-3"><Calendar className='w-5 h-5 text-gray-600'/> <span className="font-medium">{trip.date}</span></div>
                    <div className="flex items-center gap-3"><Clock className='w-5 h-5 text-gray-600'/> <span className="font-medium">{trip.time}</span></div>
                    
                    <div className="border border-gray-200 p-4 rounded-xl space-y-3">
                         <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-green-600 mt-1 shrink-0" />
                            <div><div className="text-xs text-gray-500 uppercase">Pickup</div><div className="font-medium">{trip.pickup}</div></div>
                         </div>
                         {trip.destinations?.length > 0 && (
                            <div className='ml-3 border-l pl-4'>
                                <p className='text-xs text-gray-500 italic'>Includes {trip.destinations.length} stop(s)</p>
                            </div>
                         )}
                         <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-red-600 mt-1 shrink-0" />
                            <div><div className="text-xs text-gray-500 uppercase">Drop-off</div><div className="font-medium">{trip.destination}</div></div>
                         </div>
                    </div>
                    
                    {isMergedTrip && (
                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-3">
                            <MessageSquare className='w-5 h-5 text-purple-700'/>
                            <span className='text-sm text-purple-800 font-medium'>This is a consolidated trip with {trip.linkedTripIds.length} other request(s).</span>
                        </div>
                    )}
                </div>

                {trip.cancellationReason && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                        <span className='font-bold'>Cancelled:</span> {trip.cancellationReason}
                    </div>
                )}
             </Card>

             <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Trip Costs & Metrics</h2>
                <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className='p-3 bg-gray-50 rounded-lg'><p className="text-xs text-gray-500">Distance</p><p className="font-bold text-blue-600">{trip.distance || 'N/A'}</p></div>
                    <div className='p-3 bg-gray-50 rounded-lg'><p className="text-xs text-gray-500">Cost</p><p className="font-bold text-green-600">{trip.cost || 'N/A'}</p></div>
                    <div className='p-3 bg-gray-50 rounded-lg'><p className="text-xs text-gray-500">Passengers</p><p className="font-bold text-gray-700">{totalPassengers}</p></div>
                </div>
                {(trip.odometerStart || trip.kmRun) && (
                    <div className='mt-4 pt-4 border-t border-gray-100'>
                        <h4 className="text-sm font-bold mb-2">Mileage Details</h4>
                        <p className="text-xs text-gray-600">Odometer Start: {trip.odometerStart || 'N/A'} km</p>
                        <p className="text-xs text-gray-600">Odometer End: {trip.odometerEnd || 'N/A'} km</p>
                        <p className="text-xs text-gray-600">Total Run: <span className='font-bold'>{trip.kmRun || 'N/A'} km</span></p>
                    </div>
                )}
             </Card>
          </div>
          
          {/* RIGHT COLUMN: ASSIGNMENT & ACTIONS */}
          <div className="lg:col-span-1 space-y-6">
             <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Assignment</h2>
                <div className="space-y-3 text-sm">
                    <div className='flex items-center gap-3'><Car className='w-4 h-4 text-blue-600'/> <span className="font-medium">{trip.vehicleNumber || 'Pending'}</span></div>
                    <div className='flex items-center gap-3'><UserIcon className='w-4 h-4 text-blue-600'/> <span className="font-medium">{trip.driverName || 'Pending'}</span></div>
                </div>
             </Card>
             
             {isCancellable && (
                <button 
                   onClick={() => setShowCancelModal(true)} 
                   className="w-full py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-bold"
                >
                    Cancel Trip Request
                </button>
             )}
             
             {isTicketReady && (
                <button 
                   onClick={() => generateTripTicketPDF(trip, user)} 
                   className="w-full py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-bold flex items-center justify-center gap-2"
                >
                    <FileText className='w-5 h-5'/> Print Trip Ticket (PDF)
                </button>
             )}

          </div>
        </div>

        {/* Cancel Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl text-gray-900">Cancel Trip</h3>
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <p className="text-gray-600 mb-4">
                Please provide a reason for cancelling this trip.
              </p>

              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter cancellation reason..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent mb-4"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
                >
                  Keep Trip
                </button>
                <button
                  onClick={handleCancelTrip}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all"
                >
                  Cancel Trip
                </button>
              </div>
            </Card>
          </div>
        )}
        
        {/* 🆕 MERGE DECISION MODAL */}
        {showMergeDecisionModal && trip.status === 'awaiting_merge_approval' && candidateTrip && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-lg p-6 border-l-4 border-purple-500 shadow-2xl">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-purple-700">
                        <AlertTriangle className='w-6 h-6'/> Trip Consolidation Request
                    </h3>
                    <p className='text-sm text-gray-600 mb-4'>
                        The Administration has proposed merging your trip with the following request to consolidate resources. Your approval is required to proceed.
                    </p>
                    
                    <div className="p-3 bg-purple-50 rounded-lg mb-4 space-y-1">
                        <p className='text-sm font-bold text-purple-800'>Admin Message:</p>
                        <p className='text-sm italic'>{trip.consolidationRequest?.message || "No specific message provided."}</p>
                    </div>

                    <p className='text-sm font-bold text-gray-700 mb-2'>Candidate Trip Details:</p>
                    <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                        <div className='p-3 bg-gray-100 rounded-lg'>
                            <p className='text-xs text-gray-500'>Requester</p>
                            <p className='font-medium'>{candidateTrip.customerName}</p>
                        </div>
                        <div className='p-3 bg-gray-100 rounded-lg'>
                            <p className='text-xs text-gray-500'>Passengers</p>
                            <p className='font-medium'>{candidateTrip.passengers} Pax</p>
                        </div>
                        <div className='p-3 bg-gray-100 rounded-lg col-span-2'>
                            <p className='text-xs text-gray-500'>Destination</p>
                            <p className='font-medium'>{candidateTrip.destination}</p>
                        </div>
                    </div>
                    
                    <p className='font-bold text-gray-700'>Decision:</p>
                    
                    {/* Rejection Reason Input */}
                    <div className="mt-2 mb-4">
                        <textarea
                            value={mergeRejectReason}
                            onChange={(e) => setMergeRejectReason(e.target.value)}
                            placeholder="Reason for rejecting consolidation (required if rejecting)..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                        />
                    </div>
                    
                    <div className="flex gap-3">
                        <button
                            onClick={handleRejectMerge}
                            disabled={!mergeRejectReason.trim()}
                            className="flex-1 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50"
                        >
                            Reject Consolidation
                        </button>
                        <button
                            onClick={handleApproveMerge}
                            className="flex-1 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700"
                        >
                            Approve Merge
                        </button>
                    </div>
                </Card>
            </div>
        )}
      </div>
    </div>
  );
}