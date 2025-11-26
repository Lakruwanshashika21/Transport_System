import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Hardcoded configuration (Ensures connection works immediately)
const firebaseConfig = {
  apiKey: "AIzaSyA5dnLKG-HCL5mZEiBq_0vh-pDVjxmZC48",
  authDomain: "transportapp-33e03.firebaseapp.com",
  projectId: "transportapp-33e03",
  storageBucket: "transportapp-33e03.firebasestorage.app",
  messagingSenderId: "949565221708",
  appId: "1:949565221708:web:dd828002a3d171c5623de9",
  measurementId: "G-0C8FBHLPVH"
};

const app = initializeApp(firebaseConfig);

// Export Auth and Database
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider(); // Start Google Login Service
export const db = getFirestore(app);