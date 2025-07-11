import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Your Firebase config will go here
const firebaseConfig = {
    apiKey: "AIzaSyAeKyCMnLmts4VX180QtOWTiBDKOBo9PFs",
    authDomain: "uncrossable-29c00.firebaseapp.com",
    projectId: "uncrossable-29c00",
    storageBucket: "uncrossable-29c00.firebasestorage.app",
    messagingSenderId: "318437886196",
    appId: "1:318437886196:web:6938f5d401168c4cd8f6a1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore and Functions
export const db = getFirestore(app);
export const functions = getFunctions(app);

export default app; 