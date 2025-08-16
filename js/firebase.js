// Centralized Firebase init and exports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInAnonymously, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, deleteDoc
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCQh3iNGIGDVaFTmiEGyZa6r5r7U0thX80",
  authDomain: "box-chain.firebaseapp.com",
  projectId: "box-chain",
  storageBucket: "box-chain.firebasestorage.app",
  messagingSenderId: "957225784449",
  appId: "1:957225784449:web:a02f5e553128cd61e66980"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  app, auth, db,
  // auth helpers
  onAuthStateChanged, signInAnonymously, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  // firestore helpers
  doc, setDoc, getDoc, updateDoc, onSnapshot, collection, deleteDoc
};