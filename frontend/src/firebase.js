import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signOut
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA2OJurEf6VWjgJ50YYKIcM9bSwAQim_bk",
  authDomain: "rag-mart-bf1ce.firebaseapp.com",
  projectId: "rag-mart-bf1ce",
  storageBucket: "rag-mart-bf1ce.firebasestorage.app",
  messagingSenderId: "725340852458",
  appId: "1:725340852458:web:06c85575be2be600bac793",
  measurementId: "G-3606170RMQ"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export const analyticsReady = isSupported()
  .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
  .catch(() => null);

export async function signInWithGoogle() {
  await setPersistence(firebaseAuth, browserLocalPersistence);
  const credential = await signInWithPopup(firebaseAuth, googleProvider);
  return credential.user;
}

export async function signOutRagMart() {
  await signOut(firebaseAuth).catch(() => {});
}
