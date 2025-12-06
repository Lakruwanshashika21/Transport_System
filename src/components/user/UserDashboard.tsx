import { useState, useEffect } from 'react';
import { Calendar, MapPin, Clock, Car, Plus, History, MessageSquare, CheckCircle, XCircle, Users as PaxIcon, User as UserIcon, Phone as PhoneIcon, Mail as MailIcon } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, query, where, getDocs, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import { logAction } from '../../utils/auditLogger';

interface UserDashboardProps {
    user: User;
    onNavigate: (screen: string, tripId?: string) => void;
    onLogout: () => void;
}

export function UserDashboard({ user, onNavigate, onLogout }: UserDashboardProps) {
    const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
    const [pastTrips, setPastTrips] = useState<any[]>([]);
    const [mergeProposals, setMergeProposals] = useState<any[]>([]); // NEW STATE for trips requiring user consent
    const [loading, setLoading] = useState(true);

    const fetchTrips = async () => {
        try {
            // Fetch trips for the current user
            const q = query(
                collection(db, "trip_requests"), 
                where("userId", "==", user.uid) // Use uid as the identifier
            );
            
            const querySnapshot = await getDocs(q);
            const allTrips = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Client-side sorting (newest first)
            allTrips.sort((a: any, b: any) => {
                const dateA = new Date(`${a.date} ${a.time}`).getTime();
                const dateB = new Date(`${b.date} ${b.time}`).getTime();
                return dateB - dateA;
            });
            
            // Filter trips
            const mergeAwaiting = allTrips.filter((trip: any) => trip.status === 'awaiting_merge_approval');
            const pendingAndApproved = allTrips.filter((trip: any) => 
                ['pending', 'approved', 'in-progress', 're-assigned'].includes(trip.status) && trip.status !== 'awaiting_merge_approval'
            );
            const past = allTrips.filter((trip: any) => 
                ['completed', 'cancelled', 'rejected', 'broken-down'].includes(trip.status)
            );

            setUpcomingTrips(pendingAndApproved);
            setMergeProposals(mergeAwaiting);
            setPastTrips(past);
            setLoading(false);

        } catch (error) {
            console.error("Error fetching user trips:", error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrips();
    }, [user.uid]);
    
    // 🆕 NEW HANDLER: Accept Merge Proposal
    const handleAcceptMerge = async (masterTrip: any) => {
        if (!confirm("Are you sure you want to accept this merge proposal? Your trip details will be consolidated into the Master Trip.")) return;

        try {
            // 1. Determine which consent field belongs to the current user (A or B)
            // If this trip (masterTrip) has a linkedProposalTripId, it is Master A.
            // If this trip (masterTrip) has a masterTripId, it is Candidate B.
            const isMasterRequester = !!masterTrip.linkedProposalTripId;
            const consentField = isMasterRequester ? 'consentA' : 'consentB';

            // The ID to update is always the Master Trip ID (since all proposal details are stored there)
            const tripIdToUpdate = isMasterRequester ? masterTrip.id : masterTrip.masterTripId;
            
            if (!tripIdToUpdate) throw new Error("Could not determine master trip ID for update.");

            // 2. Update the master trip's mergeProposal consent status
            await updateDoc(doc(db, "trip_requests", tripIdToUpdate), {
                [`mergeProposal.${consentField}`]: 'accepted',
                status: 'approved_merge_request', // Temporarily set master status to approved_merge_request
            });
            
            // If the current trip is the CANDIDATE (B), update its status too.
            if (!isMasterRequester) {
                await updateDoc(doc(db, "trip_requests", masterTrip.id), {
                    status: 'approved_merge_request',
                });
            }


            // 3. Log the action
            await logAction(user.email, 'MERGE_CONSENT_ACCEPT', 
                `User ${user.name} accepted merge proposal for Trip #${masterTrip.serialNumber || masterTrip.id}.`, 
                { tripId: masterTrip.id, consentUser: isMasterRequester ? 'A' : 'B' }
            );

            alert("Merge accepted! Awaiting Admin finalization.");
            fetchTrips(); // Refresh the UI

        } catch (e) {
            console.error("Error accepting merge:", e);
            alert("Failed to accept merge proposal.");
        }
    };

    // 🆕 NEW HANDLER: Reject Merge Proposal
    const handleRejectMerge = async (masterTrip: any) => {
        const rejectionReason = prompt("Please provide a brief reason for rejecting the merger:");
        if (rejectionReason === null || rejectionReason.trim() === "") {
            alert("Rejection cancelled.");
            return;
        }

        try {
            // 1. The Admin's TripApproval screen handles the database transaction to revert BOTH trips to pending.
            // We just update the status to trigger the Admin's side logic.
            
            // 2. Update the master trip status to signal rejection
            await updateDoc(doc(db, "trip_requests", masterTrip.id), {
                status: 'merge_rejected', // New status to flag for Admin action
                rejectionReason: `Rejected by User (${user.name}): ${rejectionReason}`,
            });

            // 3. Log the action
            await logAction(user.email, 'MERGE_CONSENT_REJECT', 
                `User ${user.name} rejected merge proposal for Master Trip #${masterTrip.serialNumber || masterTrip.id}. Reason: ${rejectionReason}`, 
                { tripId: masterTrip.id }
            );

            alert("Merge rejected. The Admin has been notified to cancel the proposal.");
            fetchTrips(); // Refresh the UI

        } catch (e) {
            console.error("Error rejecting merge:", e);
            alert("Failed to reject merge proposal.");
        }
    };


    if (loading) {
        return (
            <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
                <div className="text-gray-500">Loading Dashboard...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="user-dashboard" />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="mb-8">
                    <h1 className="text-3xl text-gray-900 mb-2">Welcome back, {user.name}!</h1>
                    <p className="text-gray-600">Manage your vehicle bookings and trips</p>
                </div>
                
                {/* 🆕 MERGE PROPOSALS SECTION */}
                {mergeProposals.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-xl text-purple-700 mb-4 font-bold flex items-center gap-2"><MessageSquare className="w-6 h-6"/> Merge Proposals ({mergeProposals.length})</h2>
                        {mergeProposals.map((trip: any) => {
                            // Determine if this trip is the Master (A) or Candidate (B) based on how proposal fields are stored
                            const isMaster = !!trip.linkedProposalTripId;
                            const proposalData = trip.mergeProposal || trip.consolidationRequest;
                            
                            const otherUserTripId = isMaster ? trip.linkedProposalTripId : trip.masterTripId;
                            
                            // Status of THIS user's consent (A or B)
                            const myConsentStatus = isMaster ? proposalData?.consentA : proposalData?.consentB;

                            return (
                                <Card key={trip.id} className="p-6 border-l-4 border-purple-500 bg-purple-50 mb-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            {/* 💥 FIX: Use serialNumber if available */}
                                            <h3 className="font-bold text-gray-900 text-lg mb-1">Trip Consolidation Request (#{trip.serialNumber || trip.id})</h3>
                                            <p className="text-sm text-purple-700">
                                                {proposalData?.message || 'Awaiting your consent to consolidate trips.'}
                                            </p>
                                        </div>
                                        <Badge status={myConsentStatus || "Pending"} />
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-purple-200 grid grid-cols-2 gap-4">
                                        {/* Proposed Vehicle/Driver Details */}
                                        <div>
                                            <p className="text-sm font-bold text-gray-700 mb-1">Proposed Assignment:</p>
                                            <div className="text-xs text-gray-600 space-y-1">
                                                <p><Car className="w-3 h-3 inline-block text-blue-600"/> **Vehicle:** {proposalData?.vehicleNumber || 'N/A'}</p>
                                                <p><UserIcon className="w-3 h-3 inline-block text-blue-600"/> **Driver:** {proposalData?.driverName || 'N/A'}</p>
                                                <p><UserIcon className="w-3 h-3 inline-block text-blue-600"/> **Admin:** {proposalData?.adminName || 'N/A'}</p>
                                                <p className='font-bold text-gray-800'>Total Pax: {trip.passengers + (trip.linkedTripDetails?.[0]?.passengers || 0)}</p>
                                            </div>
                                        </div>
                                        {/* Other User Details (Using Master Trip data as the single source for the message) */}
                                        <div>
                                            <p className="text-sm font-bold text-gray-700 mb-1">Merging With:</p>
                                            <div className="text-xs text-gray-600 space-y-1">
                                                <p className="font-bold text-purple-800">Trip #**{otherUserTripId}** Requester</p>
                                                <p><UserIcon className="w-3 h-3 inline-block"/> Name: {otherUserTripId}</p> {/* Use ID as placeholder name */}
                                                <p><PhoneIcon className="w-3 h-3 inline-block"/> Phone: N/A</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-end gap-3 mt-6">
                                        <button 
                                            onClick={() => handleRejectMerge(trip)}
                                            disabled={myConsentStatus === 'accepted'}
                                            className="px-4 py-2 border border-red-300 text-red-600 rounded-xl flex items-center gap-2 hover:bg-red-50 disabled:opacity-50"
                                        >
                                            <XCircle className="w-4 h-4"/> Reject
                                        </button>
                                        <button 
                                            onClick={() => handleAcceptMerge(trip)}
                                            disabled={myConsentStatus === 'accepted'}
                                            className="px-4 py-2 bg-green-600 text-white rounded-xl flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
                                        >
                                            <CheckCircle className="w-4 h-4"/> {myConsentStatus === 'accepted' ? 'Accepted' : 'Accept Merge'}
                                        </button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}


                {/* Quick Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    <Card 
                        onClick={() => onNavigate('book-vehicle')}
                        className="p-6 cursor-pointer hover:shadow-lg transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#2563EB] rounded-xl flex items-center justify-center">
                                <Plus className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="text-gray-900">Book Vehicle</div>
                                <div className="text-sm text-gray-500">Schedule a new trip</div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                <Calendar className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <div className="text-2xl text-gray-900">{upcomingTrips.length}</div>
                                <div className="text-sm text-gray-500">Upcoming Trips</div>
                            </div>
                        </div>
                    </Card>

                    <Card 
                        onClick={() => onNavigate('trip-history')}
                        className="p-6 cursor-pointer hover:shadow-lg transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                <History className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <div className="text-gray-900">Trip History</div>
                                <div className="text-sm text-gray-500">View all past trips</div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Upcoming Trips */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl text-gray-900">Upcoming Trips</h2>
                    </div>
                    
                    {upcomingTrips.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {upcomingTrips.map((trip) => (
                                <Card key={trip.id} className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            {/* 💥 FIX: Use serialNumber if available */}
                                            <div className="text-gray-900 mb-1">Trip #{trip.serialNumber || trip.id}</div>
                                            <Badge status={trip.status} />
                                        </div>
                                        <button
                                            onClick={() => onNavigate('view-trip', trip.id)} 
                                            className="text-sm text-[#2563EB] hover:text-[#1E40AF]"
                                        >
                                            View Details
                                        </button>
                                    </div>

                                    <div className="space-y-3 mb-4">
                                        <div className="flex items-start gap-3">
                                            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <div className="text-sm text-gray-500">Pickup</div>
                                                <div className="text-gray-900">{trip.pickup}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <MapPin className="w-5 h-5 text-[#2563EB] mt-0.5 flex-shrink-0" />
                                            <div>
                                                <div className="text-sm text-gray-500">Destination</div>
                                                <div className="text-gray-900">{trip.destination}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            <div>
                                                <div className="text-xs text-gray-500">Date & Time</div>
                                                <div className="text-sm text-gray-900">{trip.date}</div>
                                                <div className="text-sm text-gray-900">{trip.time}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Car className="w-4 h-4 text-gray-400" />
                                            <div>
                                                <div className="text-xs text-gray-500">Vehicle</div>
                                                <div className="text-sm text-gray-900">{trip.vehicleNumber || 'Pending'}</div>
                                                <div className="text-sm text-gray-900">{trip.driverName || 'Pending'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card className="p-12 text-center">
                            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 mb-4">No upcoming trips</p>
                            <button
                                onClick={() => onNavigate('book-vehicle')}
                                className="px-6 py-2 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all"
                            >
                                Book Your First Trip
                            </button>
                        </Card>
                    )}
                </div>

                {/* Past Trips (Limited view for dashboard) */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl text-gray-900">Recent Trips</h2>
                        <button
                            onClick={() => onNavigate('trip-history')}
                            className="text-sm text-[#2563EB] hover:text-[#1E40AF]"
                        >
                            View All
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pastTrips.slice(0, 3).map((trip) => (
                            <Card key={trip.id} className="p-6">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-gray-900">Trip #{trip.id}</div>
                                    <Badge status={trip.status} size="sm" />
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="text-sm text-gray-600">{trip.pickup}</div>
                                    <div className="text-sm text-gray-600">→ {trip.destination}</div>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <div className="text-gray-500">{trip.date}</div>
                                </div>
                            </Card>
                        ))}
                        {pastTrips.length === 0 && (
                            <div className="col-span-full text-center text-gray-500 py-8 bg-white rounded-xl border border-gray-200">
                                No past trip history found.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}