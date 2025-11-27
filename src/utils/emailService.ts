import emailjs from '@emailjs/browser';

// REPLACE THESE WITH YOUR ACTUAL EMAILJS KEYS
const SERVICE_ID = "service_transport_app";
const TEMPLATE_ID_LOGIN = "template_login_alert";
const TEMPLATE_ID_TRIP = "template_trip_ticket";
const PUBLIC_KEY = "YOUR_PUBLIC_KEY"; // Get from EmailJS Account

export const sendLoginNotification = async (email: string, name: string) => {
  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID_LOGIN, {
      to_email: email,
      to_name: name,
      message: "A new login was detected on your Transport App account.",
      date: new Date().toLocaleString()
    }, PUBLIC_KEY);
    console.log("Login email sent!");
  } catch (error) {
    console.error("Failed to send login email:", error);
  }
};

export const sendTripBookingEmail = async (tripDetails: any) => {
  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID_TRIP, {
      to_email: tripDetails.email,
      to_name: tripDetails.customer,
      trip_id: tripDetails.serialNumber, // New Serial Number
      pickup: tripDetails.pickup,
      destination: tripDetails.destination,
      status: "Pending Approval"
    }, PUBLIC_KEY);
    // You can add a second call here to send email to ADMIN
  } catch (error) {
    console.error("Failed to send booking email:", error);
  }
};

export const sendTripApprovalEmail = async (tripDetails: any) => {
  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID_TRIP, {
      to_email: tripDetails.email,
      to_name: tripDetails.customer,
      trip_id: tripDetails.serialNumber,
      driver_name: tripDetails.driverName,
      vehicle_number: tripDetails.vehicleNumber,
      status: "APPROVED - TRIP TICKET"
    }, PUBLIC_KEY);
  } catch (error) {
    console.error("Failed to send approval email:", error);
  }
};