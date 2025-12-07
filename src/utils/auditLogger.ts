import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

export interface LogEntry {
    id?: string;
    timestamp: string;
    adminName: string; 
    adminEmail: string;
    // Comprehensive list of sections
    section: 'User Management' | 'Vehicle Management' | 'Driver Management' | 'Trip Approval' | 'Admin Management' | 'Payroll Management' | 'TRIP_BOOKING_ADMIN'; 
    action: string; 
    details: string; 
    targetId?: string; 
    targetName?: string; 
    metadata?: Record<string, any>;
}

// Final logAction utility signature
export const logAction = async (adminEmail: string, section: LogEntry['section'], action: string, details: string, metadata?: Record<string, any>) => {
    try {
        if (!db) {
            console.warn("Firestore DB instance not available. Cannot log action.");
            return;
        }
        
        const nameFallback = adminEmail.split('@')[0];

        await addDoc(collection(db, 'system_logs'), {
            adminEmail: adminEmail,
            adminName: metadata?.adminName || nameFallback, 
            section: section,
            action: action,
            details: details,
            targetId: metadata?.targetId,
            targetName: metadata?.targetName,
            metadata: metadata,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("Failed to write to system log:", error);
    }
};