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
            <div style="font-size: 9px; color: #1e3a8a; margin-top: 5px; text-align: center; font-weight: bold; letter-spacing: 0.5px;">
              VEYANGODA | KATUNAYAKE<br/>HORANA | TRINCOMALEE
            </div>
          </td>
          
          <!-- RIGHT COLUMN: DETAILS -->
          <td style="padding-left: 20px; vertical-align: top;">
            <div style="font-size: 14px; font-weight: bold; color: #1e3a8a; margin-bottom: 2px;">Transport Administration</div>
            <div style="font-size: 12px; color: #e11d48; font-weight: bold; margin-bottom: 8px;">Operations Team</div>
            
            <div style="font-size: 12px; color: #1e3a8a; font-weight: bold;">Carlos Embellishers (Pvt) Ltd</div>
            <div style="font-size: 12px; color: #555;">Dambuwa estate, Dadagamuwa, Veyangoda.</div>
            
            <div style="margin-top: 12px; font-size: 12px; line-height: 1.4;">
              <span style="color: #1e3a8a; font-weight: bold;">Mob:</span> <span style="color: #555;">+94 77 123 4567</span> <br/>
              <span style="color: #1e3a8a; font-weight: bold;">Email:</span> <a href="mailto:admin@carlos.lk" style="color: #1e3a8a; text-decoration: none;">admin@carlos.lk</a> <br/>
              <a href="http://www.carlosholdings.com" style="color: #1e3a8a; text-decoration: none; font-weight: bold;">www.carlosholdings.com</a>
            </div>
          </td>
        </tr>
      </table>
      
      <!-- BOTTOM SLOGAN -->
      <div style="margin-top: 20px; width: 100%; max-width: 650px; text-align: center;">
         <img src="${APP_URL}/report-footer.png" alt="Healthier Wealthier Happier" style="width: 100%; height: auto; max-height: 40px; object-fit: contain;" />
      </div>
    </div>
  `;
};

// --- 2. Generic Sender ---
const sendEmail = async (toEmail: string, toName: string, subject: string, bodyContent: string) => {
  if (!SERVICE_ID || !PUBLIC_KEY) return;

  const fullHtml = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 650px; margin: 0 auto;">
      <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px;">${subject}</h2>
      <p style="font-size: 14px;">Dear <strong>${toName}</strong>,</p>
      <div style="font-size: 14px; line-height: 1.6; color: #444;">
        ${bodyContent}
      </div>
      ${getSignatureHTML()}
    </div>
  `;

  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_email: toEmail,
      to_name: toName,
      subject: subject,
      message_html: fullHtml, 
    }, PUBLIC_KEY);
    console.log(`Email sent to ${toEmail}`);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
};

// --- 3. Notifications ---

export const sendLoginNotification = async (email: string, name: string) => {
  const body = `<p>We noticed a new login to your account at <strong>${new Date().toLocaleString()}</strong>.</p>`;
  await sendEmail(email, name, "Security Alert: New Login", body);
};

export const sendTripBookingEmail = async (trip: any) => {
  const userBody = `
    <p>Your trip request has been submitted and is pending approval.</p>
    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; border-left: 4px solid #1e3a8a; margin: 15px 0;">
      <p><strong>Trip ID:</strong> ${trip.serialNumber}</p>
      <p><strong>Route:</strong> ${trip.pickup} -> ${trip.destination}</p>
    </div>
  `;
  await sendEmail(trip.email, trip.customer, "Trip Request Pending", userBody);
};

export const sendTripApprovalEmail = async (trip: any) => {
  const body = `
    <p style="color: #059669; font-weight: bold;">Your trip request has been APPROVED.</p>
    <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; border: 1px solid #10b981;">
      <h3>TRIP TICKET</h3>
      <p><strong>Trip ID:</strong> ${trip.serialNumber}</p>
      <p><strong>Vehicle:</strong> ${trip.vehicleNumber}</p>
      <p><strong>Driver:</strong> ${trip.driverName}</p>
      <p><strong>Cost:</strong> ${trip.cost}</p>
    </div>
  `;
  await sendEmail(trip.email, trip.customer, "Trip Confirmed", body);
};

export const sendDriverTripEmail = async (trip: any) => {
  const body = `
    <p>You have been assigned a new trip.</p>
    <div style="background: #fff7ed; padding: 15px; border-radius: 8px; border: 1px solid #f97316;">
      <p><strong>Trip ID:</strong> ${trip.serialNumber}</p>
      <p><strong>Vehicle:</strong> ${trip.vehicleNumber}</p>
      <p><strong>Customer:</strong> ${trip.customer}</p>
      <p><strong>From:</strong> ${trip.pickup}</p>
      <p><strong>To:</strong> ${trip.destination}</p>
    </div>
  `;
  if (trip.driverEmail) await sendEmail(trip.driverEmail, trip.driverName, "New Trip Assignment", body);
};

export const sendTripRejectionEmail = async (trip: any, reason: string) => {
  const body = `<p style="color: #dc2626;">Your trip request was rejected. Reason: ${reason}</p>`;
  await sendEmail(trip.email, trip.customer, "Trip Rejected", body);
};

// --- Vehicle Assignment ---
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

// --- NEW: Vehicle Unassignment ---
export const sendVehicleUnassignmentEmail = async (driverEmail: string, driverName: string, vehicleNumber: string) => {
  const body = `
    <p>Your vehicle assignment has been removed by Admin.</p>
    <div style="background: #fef2f2; padding: 15px; border-radius: 8px; border: 1px solid #ef4444;">
      <p><strong>Vehicle:</strong> ${vehicleNumber}</p>
      <p><strong>Status:</strong> Unassigned</p>
    </div>
    <p>Please contact the transport department for further instructions.</p>
  `;
  await sendEmail(driverEmail, driverName, "Vehicle Unassigned", body);
};