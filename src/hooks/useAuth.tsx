import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { doc, getDoc, setDoc, getDocFromServer } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
import { UserDoc, StoreDoc, UserRole } from "../types";

interface AuthContextType {
  user: User | null;
  userData: UserDoc | null;
  storeData: StoreDoc | null;
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, fullName: string, storeName: string, role: UserRole) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTenantData: () => Promise<void>;
  isNearExpiry: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserDoc | null>(null);
  const [storeData, setStoreData] = useState<StoreDoc | null>(null);
  const [isNearExpiry, setIsNearExpiry] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateSubscriptionExpiryState = (store: StoreDoc | null) => {
    if (!store) {
      setIsNearExpiry(false);
      return;
    }
    const expiryStr = store.subscriptionExpiresAt || store.billing_period_end;
    if (!expiryStr) {
      setIsNearExpiry(false);
      return;
    }
    const expiry = new Date(expiryStr);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    
    // Near expiry if within 3 days (72 hours / H-3) and still positive
    if (diffMs > 0 && diffMs <= 3 * 24 * 60 * 60 * 1000) {
      setIsNearExpiry(true);
    } else {
      setIsNearExpiry(false);
    }
  };

  // Validate the Firestore connection when the application boots (mandatory system requirement from skill guideline)
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, "test", "connection"));
      } catch (err) {
        if (err instanceof Error && err.message.includes("offline")) {
          console.error("Please check your Firebase configuration and internet connection.");
        }
      }
    }
    testConnection();
  }, []);

  const fetchTenantData = async (uid: string) => {
    try {
      const userRef = doc(db, "users", uid);
      let userSnap;
      try {
        userSnap = await getDoc(userRef);
      } catch (getErr) {
        handleFirestoreError(getErr, OperationType.GET, `users/${uid}`);
        return;
      }

      const currentUser = auth.currentUser;
      const isSuperEmail = currentUser && (
        currentUser.email === "ridhowicaksono@storesage.com" ||
        currentUser.email === "admin@storesage.com" ||
        currentUser.email === "ridhowicaksono2604@gmail.com"
      );

      if (isSuperEmail) {
        // Enforce super-admin role and store registry for developer's email
        const adminPayload: UserDoc = {
          name: "Super Admin StoreSage",
          role: "super-admin",
          store_id: "storesage_root_admin",
          email: currentUser.email || ""
        };
        
        try {
          if (!userSnap.exists() || userSnap.data()?.role !== "super-admin" || userSnap.data()?.store_id !== "storesage_root_admin") {
            try {
              await setDoc(userRef, adminPayload, { merge: true });
              console.log("Bootstrap super-admin: Successfully updated users doc with super-admin role");
            } catch (setUserErr: any) {
              handleFirestoreError(setUserErr, OperationType.UPDATE, `users/${uid}`);
              return;
            }
          }

          const storeRef = doc(db, "stores", "storesage_root_admin");
          let storeSnap;
          try {
            storeSnap = await getDoc(storeRef);
            console.log("Bootstrap super-admin: Successfully retrieved storesage_root_admin store snap");
          } catch (getStoreErr: any) {
            handleFirestoreError(getStoreErr, OperationType.GET, "stores/storesage_root_admin");
            return;
          }

          if (!storeSnap.exists()) {
            try {
              await setDoc(storeRef, {
                store_name: "StoreSage Root Administration",
                status_langganan: "active",
                billing_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
              });
              console.log("Bootstrap super-admin: Successfully created storesage_root_admin store doc");
            } catch (setStoreErr: any) {
              handleFirestoreError(setStoreErr, OperationType.CREATE, "stores/storesage_root_admin");
              return;
            }
          }

          setUserData(adminPayload);
          setStoreData({
            store_id: "storesage_root_admin",
            store_name: "StoreSage Root Administration",
            status_langganan: "active"
          });
          return;
        } catch (err: any) {
          console.error("Failed to auto-bootstrap super-admin (outer catch):", err);
          throw err;
        }
      }

      if (userSnap.exists()) {
        const uData = userSnap.data() as UserDoc;
        setUserData(uData);

        if (uData.store_id) {
          const storeRef = doc(db, "stores", uData.store_id);
          let storeSnap;
          try {
            storeSnap = await getDoc(storeRef);
          } catch (getStoreErr: any) {
            handleFirestoreError(getStoreErr, OperationType.GET, `stores/${uData.store_id}`);
            return;
          }
          if (storeSnap.exists()) {
            setStoreData({
              store_id: uData.store_id,
              ...storeSnap.data()
            } as StoreDoc);
          } else {
            console.warn("Store document not found for id: ", uData.store_id);
            setStoreData(null);
          }
        }
      } else {
        setUserData(null);
        setStoreData(null);
      }
    } catch (err: any) {
      console.error("Error fetching tenant user configuration:", err);
      let errorMsg = "Gagal memuat detail profil tenant.";
      if (err instanceof Error) {
        try {
          if (err.message.trim().startsWith("{")) {
            const parsed = JSON.parse(err.message);
            if (parsed && typeof parsed === "object") {
              const fsErr = parsed.error || "";
              errorMsg += ` [Detail: ${fsErr} | Operasi: ${parsed.operationType} | Jalur: ${parsed.path}]`;
            } else {
              errorMsg += ` [Detail: ${err.message}]`;
            }
          } else {
            errorMsg += ` [Detail: ${err.message}]`;
          }
        } catch (e) {
          errorMsg += ` [Detail: ${err.message}]`;
        }
      } else if (err && typeof err === "object") {
        errorMsg += ` [Detail: ${JSON.stringify(err)}]`;
      } else {
        errorMsg += ` [Detail: ${String(err)}]`;
      }
      setError(errorMsg);
    }
  };

  const refreshTenantData = async () => {
    if (user) {
      await fetchTenantData(user.uid);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setError(null);
      if (currentUser) {
        setUser(currentUser);
        await fetchTenantData(currentUser.uid);
      } else {
        setUser(null);
        setUserData(null);
        setStoreData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      // Force popup for immediate clean UI response under iframe
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        await fetchTenantData(result.user.uid);
      }
    } catch (err: any) {
      console.error("Google authentication failed:", err);
      setError(err?.message || "Gagal masuk menggunakan Google.");
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    setError(null);
    try {
      const isSuperEmail = email === "ridhowicaksono@storesage.com" ||
        email === "admin@storesage.com" ||
        email === "ridhowicaksono2604@gmail.com";
      let result;
      
      if (isSuperEmail) {
        try {
          result = await signInWithEmailAndPassword(auth, email, pass);
        } catch (signInErr: any) {
          // If the user profile does not exist yet or credentials are not found, let's automatically register them to bypass signup lockouts
          if (signInErr?.code === "auth/user-not-found" || signInErr?.code === "auth/invalid-credential" || signInErr?.code === "auth/user-disabled") {
            try {
              result = await createUserWithEmailAndPassword(auth, email, pass);
            } catch (createErr: any) {
              // If creation fails because user already exists (e.g. wrong password entered for existing account), throw original signInErr cleanly
              if (createErr?.code === "auth/email-already-in-use") {
                throw signInErr;
              }
              console.warn("Auto-registration of developer failed, trying original sign in logic:", createErr?.message || createErr);
              throw signInErr;
            }
          } else {
            throw signInErr;
          }
        }
      } else {
        result = await signInWithEmailAndPassword(auth, email, pass);
      }

      if (result.user) {
        await fetchTenantData(result.user.uid);
      }
    } catch (err: any) {
      console.warn("Email login attempt failed (handled gracefully):", err?.message || err);
      let BahasaError = "Kredensial salah atau silakan coba lagi.";
      
      // Try to parse if it is a JSON format from Firestore Error Info
      let isFirestoreJson = false;
      try {
        if (err?.message && err.message.trim().startsWith("{")) {
          const parsed = JSON.parse(err.message);
          if (parsed && typeof parsed === "object" && "operationType" in parsed) {
            isFirestoreJson = true;
            let firestoreErrText = parsed.error || "";
            if (firestoreErrText.toLowerCase().includes("permission") || firestoreErrText.toLowerCase().includes("insufficient")) {
              firestoreErrText = `Izin ditolak (Missing or insufficient permissions) pada operasi '${parsed.operationType}' ke jalur '${parsed.path || "unknown"}'.`;
            }
            BahasaError = `Kesalahan Data (Firestore): ${firestoreErrText}`;
          }
        }
      } catch (e) {
        // Not a JSON error or parsing failed
      }

      if (!isFirestoreJson) {
        if (err?.code === "auth/user-not-found" || err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential") {
          BahasaError = "Email atau Password tidak cocok. Silakan hubungi Administrator StoreSage jika Anda belum berlangganan atau mengalami kendala aktivasi.";
        } else if (err?.code === "auth/invalid-email") {
          BahasaError = "Format email tidak valid.";
        } else if (err?.code === "auth/operation-not-allowed") {
          BahasaError = "Metode autentikasi Email & Password dinonaktifkan di Firebase Console. Harap aktifkan terlebih dahulu di bagian Sign-In Method.";
        } else if (err?.message) {
          BahasaError = `Gagal masuk: ${err.message} [Kode: ${err.code || 'unknown'}]`;
        }
      }

      setError(BahasaError);
      setLoading(false);
      throw err;
    }
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    fullName: string,
    storeName: string,
    role: UserRole
  ) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Create firebase auth record
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      const uid = result.user.uid;

      // 2. Generate new unique store_id or use root admin store for the developer email
      const isSuperEmail = email === "ridhowicaksono@storesage.com" ||
        email === "admin@storesage.com" ||
        email === "ridhowicaksono2604@gmail.com";
      const storeId = isSuperEmail ? "storesage_root_admin" : ("store_" + Math.random().toString(36).substring(2, 11));

      // 3. Create Store metadata (Tenant document) with initial 30 days active subscription (1 year for super-admin)
      const billingEnd = new Date();
      if (isSuperEmail) {
        billingEnd.setFullYear(billingEnd.getFullYear() + 1);
      } else {
        billingEnd.setDate(billingEnd.getDate() + 30);
      }

      const storeRef = doc(db, "stores", storeId);
      const storePayload = {
        store_name: isSuperEmail ? "StoreSage Root Administration" : storeName,
        status_langganan: "active" as const,
        billing_period_end: billingEnd.toISOString()
      };
      
      try {
        await setDoc(storeRef, storePayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `stores/${storeId}`);
      }

      // 4. Create local User Profile mapping
      const userRef = doc(db, "users", uid);
      const userPayload = {
        name: isSuperEmail ? "Super Admin StoreSage" : fullName,
        role: isSuperEmail ? ("super-admin" as const) : role,
        store_id: storeId,
        email: email // include email for display and auditing purposes
      };

      try {
        await setDoc(userRef, userPayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${uid}`);
      }

      // 5. Update state
      setUser(result.user);
      setUserData(userPayload);
      setStoreData({ store_id: storeId, ...storePayload });
    } catch (err: any) {
      console.error("Tenant registration failed:", err);
      let BahasaError = "Gagal membuat akun tenant baru.";
      if (err?.code === "auth/email-already-in-use") {
        BahasaError = "Email sudah terdaftar. Silakan log in.";
      } else if (err?.code === "auth/weak-password") {
        BahasaError = "Password minimal harus berisi 6 karakter.";
      }
      setError(BahasaError);
      setLoading(false);
      throw err;
    }
  };

  const forgotPassword = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setLoading(false);
    } catch (err: any) {
      console.error("Password reset failure: ", err);
      let BahasaError = "Gagal mengirim link atur ulang kata sandi.";
      if (err?.code === "auth/user-not-found") {
        BahasaError = "Email tersebut tidak terdaftar di sistem.";
      } else if (err?.code === "auth/invalid-email") {
        BahasaError = "Format email tidak valid.";
      }
      setError(BahasaError);
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    setLoading(true);
    await signOut(auth);
    setUser(null);
    setUserData(null);
    setStoreData(null);
    setLoading(false);
  };

  // Automatically evaluate expiry status when store changes
  useEffect(() => {
    updateSubscriptionExpiryState(storeData);
  }, [storeData]);

  return (
    <AuthContext.Provider value={{
      user,
      userData,
      storeData,
      loading,
      error,
      loginWithGoogle,
      loginWithEmail,
      registerWithEmail,
      forgotPassword,
      logout,
      refreshTenantData,
      isNearExpiry
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
