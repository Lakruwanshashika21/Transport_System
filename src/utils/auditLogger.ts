import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

export interface LogEntry {
  id?: string;
  timestamp: string;
  adminName: string;
  adminEmail: string;
  section: 'User Management' | 'Vehicle Management' | 'Driver Management' | 'Trip Approval' | 'Admin Management';
  action: string;
  details: string;
  targetId?: string; // ID of the user, vehicle, or trip affected
  targetName?: string; // Name/Number of the entity affected
  // Added for Breakdown/Re-assignment tracking
  tripId?: string; 
  breakdownLocation?: string; 
}

export const logAction = async (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
  try {
    if (!db) return; 
    await addDoc(collection(db, 'system_logs'), {
      ...entry,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Failed to write to system log:", error);
  }
};