import emailjs from '@emailjs/browser';

// Load keys from .env file
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID_LOGIN; // Generic template ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

const APP_URL = "https://transport-system-three.vercel.app"; 

// --- 1. The Signature ---
const getSignatureHTML = () => {
  return `
    <br/>
    <div style="font-family: Arial, sans-serif; color: #333; padding-top: 20px; border-top: 1px solid #ddd; margin-top: 30px;">
      <table style="width: 100%; max-width: 650px; border-collapse: collapse;">
        <tr>
          <!-- LEFT COLUMN: LOGO -->
          <td style="width: 200px; vertical-align: middle; padding-right: 20px; border-right: 2px solid #1e3a8a;">
            <img src="${APP_URL}/report-header.jpg" alt="Carlos Embellishers" style="width: 180px; display: block;" />
            <div style="font-size: 9px; color: #1e3a8a; margin-top: 5px; text-align: center; font-weight: bold; letter-spacing: 1px;">
                SAFE & RELIABLE TRANSPORT SERVICE
            </div>
          </td>
          <!-- RIGHT COLUMN: CONTACTS -->
          <td style="vertical-align: top; padding-left: 20px;">
             <p style="margin: 0 0 5px 0; font-size: 14px; color: #1e3a8a; font-weight: bold;">Carlos Transport System</p>
             <p style="margin: 0; font-size: 12px; color: #555;">Email: transport@carlos.com</p>
             <p style="margin: 0; font-size: 12px; color: #555;">Phone: +94 11 234 5678</p>
             <p style="margin: 5px 0 0 0; font-size: 10px; color: #777;">This is an automated notification. Do not reply.</p>
          </td>
        </tr>
      </table>
    </div>
  `;
};

// --- 2. Generic Sender Function ---
const sendEmail = async (toEmail: string, toName: string, subject: string, content: string) => {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn("Email service keys not configured. Skipping email.");
    return;
  }
  
  const finalContent = content + getSignatureHTML();

  try {
    const templateParams = {
      to_email: toEmail,
      to_name: toName,
      subject: subject,
      message_html: finalContent,
    };

    // emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
    console.log(`[EMAIL SIMULATED] To: ${toEmail}, Subject: ${subject}`);

  } catch (error) {
    console.error("Failed to send email:", error);
  }
};

// --- 3. Exported Functions ---

export const sendTripBookingEmail = async (trip: any) => {
  const body = `
    <p>A new trip request (ID: ${trip.serialNumber}) has been submitted by ${trip.customerName}.</p>
    <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border: 1px solid #bae6fd;">
      <p><strong>Route:</strong> ${trip.pickup} to ${trip.destination}</p>
      <p><strong>Date & Time:</strong> ${trip.date} at ${trip.time}</p>
      <p><strong>Passengers:</strong> ${trip.passengers}</p>
      <p><strong>Status:</strong> Pending Admin Approval</p>
    </div>
    <p>Please review the request in the Admin Panel (Trip Approval section).</p>
  `;
  await sendEmail("admin@carlos.com", "Admin", "New Trip Request Submitted", body);
};

export const sendTripApprovalEmail = async (trip: any) => {
  const body = `
    <p>Your trip request (ID: ${trip.serialNumber}) has been successfully APPROVED.</p>
    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; border: 1px solid #34d399;">
      <p><strong>Vehicle:</strong> ${trip.vehicleNumber}</p>
      <p><strong>Driver:</strong> ${trip.driverName}</p>
      <p><strong>Estimated Cost:</strong> ${trip.cost}</p>
      <p>Please be ready at the pickup location: ${trip.pickup}</p>
    </div>
  `;
  await sendEmail(trip.email, trip.customerName, "Trip Approved!", body);
};

// 🚨 UPDATED: Include merge details notification for the driver
export const sendDriverTripEmail = async (trip: any) => {
  const isMerged = trip.linkedTripIds && trip.linkedTripIds.length > 0;
  
  let mergedContent = '';
  if (isMerged) {
      const totalPassengers = trip.passengers + (trip.linkedTripIds.reduce((sum: number, linkedTrip: any) => sum + (linkedTrip.passengers || 1), 0) || 0);

      mergedContent = `
          <p style="color: #6d28d9; font-weight: bold;">NOTE: This is a CONSOLIDATED trip.</p>
          <p>Total Passengers: ${totalPassengers}. Be prepared for multiple pickup/drop-off points.</p>
          <p>This trip was merged with another request from: <strong>${trip.linkedTripIds.join(', ')}</strong></p>
      `;
  }
  
  const body = `
    <p>You have been assigned a new trip (ID: ${trip.serialNumber}).</p>
    ${mergedContent}
    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; border: 1px solid #34d399;">
      <p><strong>Vehicle:</strong> ${trip.vehicleNumber}</p>
      <p><strong>Customer:</strong> ${trip.customerName} (Phone: ${trip.phone})</p>
      <p><strong>Pickup:</strong> ${trip.pickup}</p>
      <p><strong>Date & Time:</strong> ${trip.date} at ${trip.time}</p>
    </div>
    <p>Please check your Driver Dashboard for full details and to start the trip.</p>
  `;
  await sendEmail(trip.driverEmail, trip.driverName, "New Trip Assignment", body);
};

export const sendTripRejectionEmail = async (trip: any, reason: string) => {
  const body = `<p style="color: #dc2626;">Your trip request (ID: ${trip.serialNumber}) was rejected. Reason: ${reason}</p>`;
  await sendEmail(trip.email, trip.customerName, "Trip Rejected", body);
};

export const sendVehicleAssignmentEmail = async (driverEmail: string, driverName: string, vehicleNumber: string, vehicleModel: string) => {
  const body = `
    <p>Admin has assigned you a new permanent vehicle.</p>
    <div style="background: #eff6ff; padding: 15px; border-radius: 8px; border: 1px solid #1e40af;">
      <p><strong>Vehicle Number:</strong> ${vehicleNumber}</p>
      <p><strong>Model:</strong> ${vehicleModel}</p>
    </div>
    <p>This vehicle will now appear on your dashboard.</p>
  `;
  await sendEmail(driverEmail, driverName, "New Vehicle Assigned", body);
};

export const sendVehicleUnassignmentEmail = async (driverEmail: string, driverName: string, vehicleNumber: string) => {
  const body = `
    <p>Your vehicle assignment (${vehicleNumber}) has been removed by Admin.</p>
    <div style="background: #fef2f2; padding: 15px; border-radius: 8px; border: 1px solid #ef4444;">
      <p><strong>Vehicle Number:</strong> ${vehicleNumber}</p>
      <p>This vehicle is no longer associated with your profile.</p>
    </div>
  `;
  await sendEmail(driverEmail, driverName, "Vehicle Unassigned", body);
};

// 🆕 NEW: Email for sending merge request (Sent from Admin to the Original Trip User A)
export const sendMergeConsolidationEmail = async (targetTrip: any, candidateTrip: any, message: string) => {
    const body = `
        <p>Dear ${targetTrip.customerName},</p>
        <p style="color: #6d28d9; font-weight: bold;">Trip Consolidation Opportunity (Trip #${targetTrip.serialNumber})</p>
        <p>${message}</p>
        <p>A new request by ${candidateTrip.customerName} (${candidateTrip.passengers} Pax) overlaps with your trip.</p>
        <p>If you approve the merge, both trips will be consolidated into a single route.</p>
        <p>Please log in to the system and review the request in your trip details.</p>
    `;
    await sendEmail(targetTrip.email, targetTrip.customerName, "Trip Consolidation Request", body);
}

// 🆕 NEW: Email for notifying user that their trip was rejected due to merge conflict
export const sendMergeRejectionToCandidate = async (candidateTrip: any, masterTrip: any, reason: string) => {
    const body = `
        <p>Dear ${candidateTrip.customerName},</p>
        <p style="color: #dc2626; font-weight: bold;">Trip Consolation Rejected</p>
        <p>Your trip request (ID: ${candidateTrip.serialNumber}) was automatically rejected because the proposed merge with Trip #${masterTrip.serialNumber} was declined by the main traveler.</p>
        <p>Rejection Reason: ${reason}</p>
        <p>Please submit a new request or contact administration for alternative arrangements.</p>
    `;
    await sendEmail(candidateTrip.email, candidateTrip.customerName, "Trip Consolidation Rejected", body);
}