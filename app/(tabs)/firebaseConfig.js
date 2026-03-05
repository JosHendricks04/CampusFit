import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your Campus Fit project configuration
const firebaseConfig = {
  apiKey: "AIzaSyAai4uy6JsEPQahIGqGFQ_2NWU-Z4CQk48",
  authDomain: "college-gym-tracker.firebaseapp.com",
  projectId: "college-gym-tracker",
  storageBucket: "college-gym-tracker.firebasestorage.app",
  messagingSenderId: "55569932740",
  appId: "1:55569932740:web:d630c7c07e588c07750491",
  measurementId: "G-4VH2YJ62P7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the Firestore database so we can use it in our other components
export const db = getFirestore(app);