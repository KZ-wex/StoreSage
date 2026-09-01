import React, { useState, useEffect } from "react";
import { 
  Building2, 
  UserCheck, 
  Mail, 
  Lock, 
  Sparkles,
  ArrowLeft,
  CheckCircle,
  Copy,
  AlertCircle,
  Cpu,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  Clock,
  Hourglass,
  Send,
  AlertTriangle,
  ShieldCheck,
  Trash2,
  RefreshCw
} from "lucide-react";
import { initializeApp, getApp, getApps, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, getDocs, updateDoc, deleteDoc, query, where, getFirestore as getSecondaryFirestore } from "firebase/firestore";
import { db, handleFirestoreError, OperationType, firebaseConfig } from "../firebase";
import { useAuth } from "../hooks/useAuth";

// Form input types
interface AdminCreateTenantViewProps {
  onBackToMain: () => void;
}

export default function AdminCreateTenantView({ onBackToMain }: AdminCreateTenantViewProps) {
  const { user, userData, loading: authLoading, logout } = useAuth();

  // Access control
  const [passkey, setPasskey] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passkeyError, setPasskeyError] = useState("");

  const isSuperAdmin = userData?.role === "super-admin";
  const elegantUnlocked = isUnlocked || isSuperAdmin;

  // Provisioning form state
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [preSeedProducts, setPreSeedProducts] = useState(true);
  const [durationOption, setDurationOption] = useState("30");

  // Audit list state for admin/dosen overview tracker
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [emailLogs, setEmailLogs] = useState<{
    id: string;
    storeName: string;
    email: string;
    ownerName?: string;
    packageName?: string;
    remainingText?: string;
    timestamp: Date;
    message: string;
    isAutoTriggered?: boolean;
  }[]>([]);

  // Package name helper
  const getPackageName = (plan?: string, fallback = "Paket Reguler (30 Hari)") => {
    if (plan === "30") return "Paket Reguler (30 Hari)";
    if (plan === "90") return "Paket Hemat (90 Hari / 3 Bulan)";
    if (plan === "365") return "Paket Tahunan (365 Hari / 12 Bulan)";
    if (plan === "3_days") return "Paket Uji Coba H-3 (3 Hari)";
    if (plan === "2_days") return "Paket Uji Coba H-2 (2 Hari)";
    if (plan === "5_mins") return "Simulasi Kilat (5 Menit)";
    return plan || fallback;
  };
  
  // Custom dialog confirmations and modern notifications
  const [tenantToDelete, setTenantToDelete] = useState<{ id: string; name: string } | null>(null);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);
  const [errorNotification, setErrorNotification] = useState<string | null>(null);

  // Status flags
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Success details receipt
  const [receipt, setReceipt] = useState<{
    uid: string;
    email: string;
    pass: string;
    storeId: string;
    storeName: string;
    ownerName: string;
  } | null>(null);

  // Hardcoded default security token for student & lecturer protection
  const DEFAULT_SECURITY_TOKEN = "storesageadmin2026";

  // Load tenants on unlock or update
  const loadTenants = async () => {
    setTenantsLoading(true);
    try {
      const storesSnapshot = await getDocs(collection(db, "stores"));
      const usersSnapshot = await getDocs(collection(db, "users"));
      
      const parsedUsers = usersSnapshot.docs.map(uDoc => ({
        uid: uDoc.id,
        ...uDoc.data()
      })) as any[];

      const parsedStores = (storesSnapshot.docs
        .map(docSnapshot => {
          const storeData = docSnapshot.data();
          const storeId = docSnapshot.id;
          // find owner user
          const associatedUser = parsedUsers.find(u => u.store_id === storeId && (u.role === "owner" || u.role === "tenant_admin" || u.role === "admin")) || 
                                 parsedUsers.find(u => u.store_id === storeId);
          
          return {
            store_id: storeId,
            ...storeData,
            ownerName: associatedUser?.name || "Tidak Diketahui",
            email: associatedUser?.email || "N/A"
          };
        })
        .filter(store => store.store_id !== "storesage_root_admin")) as any[];

      setTenants(parsedStores);

      // Automatically scan for tenants in H-3 grace period (<= 3 days / 72 hours) and generate auto-broadcast logs
      const now = new Date();
      const autoLogs: {
        id: string;
        storeName: string;
        email: string;
        ownerName?: string;
        packageName?: string;
        remainingText?: string;
        timestamp: Date;
        message: string;
        isAutoTriggered?: boolean;
      }[] = [];

      parsedStores.forEach(s => {
        const expiryDate = s.billing_period_end || s.subscriptionExpiresAt ? new Date(s.billing_period_end || s.subscriptionExpiresAt) : null;
        if (expiryDate) {
          const diffMs = expiryDate.getTime() - now.getTime();
          const isExpired = diffMs <= 0;
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

          // Condition: in H-3 window (sisa <= 3 hari / 72 jam)
          if (!isExpired && diffMs <= 3 * 24 * 60 * 60 * 1000) {
            const remainingText = diffDays > 0 ? `${diffDays} hari ${diffHours} jam` : `${diffHours} jam ${diffMinutes} menit`;
            const pkgName = s.package_name || getPackageName(s.duration_plan);
            autoLogs.push({
              id: `auto_h3_${s.store_id}`,
              storeName: s.store_name,
              email: s.email,
              ownerName: s.ownerName,
              packageName: pkgName,
              remainingText: `Sisa ${remainingText} (Masa Tenggang H-3)`,
              timestamp: new Date(),
              isAutoTriggered: true,
              message: `[NOTIFIKASI OTOMATIS H-3] Yth. ${s.ownerName} (${s.email}) - Toko: ${s.store_name}. Paket langganan ${pkgName} Anda bersisa ${remainingText}. Mohon segera hubungi Administrator untuk perpanjangan paket agar layanan kasir & inventaris tetap aktif.`
            });
          }
        }
      });

      setEmailLogs(prev => {
        const manualLogs = prev.filter(p => !p.id.startsWith("auto_h3_"));
        return [...autoLogs, ...manualLogs];
      });
    } catch (err) {
      console.error("Gagal memuat daftar tenant: ", err);
    } finally {
      setTenantsLoading(false);
    }
  };

  useEffect(() => {
    if (elegantUnlocked) {
      loadTenants();
    }
  }, [elegantUnlocked]);

  // Adjust subscription expiry date helper (manual override)
  const handleAdjustExpiry = async (storeId: string, daysOffset: number) => {
    try {
      const storeRef = doc(db, "stores", storeId);
      const newExpiry = new Date();
      if (daysOffset === 0) {
        // Expired right now (set to 5 seconds ago)
        newExpiry.setTime(newExpiry.getTime() - 5000);
      } else {
        newExpiry.setTime(newExpiry.getTime() + daysOffset * 24 * 60 * 60 * 1000);
      }
      
      await updateDoc(storeRef, {
        billing_period_end: newExpiry.toISOString(),
        status_langganan: daysOffset <= 0 ? "trial" : "active"
      });
      
      await loadTenants();
    } catch (err) {
      console.error("Gagal menyesuaikan masa aktif: ", err);
    }
  };

  // Simulate Trigger H-3 Email notification
  const handleSendSimulatedEmail = (
    storeNameAddress: string, 
    managerEmail: string, 
    daysRemainingValue: number | string,
    ownerNameVal?: string,
    packageNameVal?: string
  ) => {
    const pkg = packageNameVal || "Paket UMKM StoreSage";
    const owner = ownerNameVal || "Pemilik UMKM";
    const message = `[PERINGATAN MASA TENGGANG H-3] Yth. ${owner} (${managerEmail}) - Toko: ${storeNameAddress}. Masa aktif langganan ${pkg} Anda tersisa ${daysRemainingValue}. Mohon segera hubungi Admin StoreSage untuk perpanjangan paket agar menghindari penguncian sistem.`;
    const newLog = {
      id: "log_" + Math.random().toString(36).substring(2, 9),
      storeName: storeNameAddress,
      email: managerEmail,
      ownerName: owner,
      packageName: pkg,
      remainingText: `Sisa ${daysRemainingValue}`,
      timestamp: new Date(),
      isAutoTriggered: false,
      message
    };
    setEmailLogs(prev => [newLog, ...prev.filter(l => l.id !== newLog.id)]);
  };

  const handleDeleteTenant = (storeId: string, storeName: string) => {
    setTenantToDelete({ id: storeId, name: storeName });
  };

  const executeDeleteTenant = async (storeId: string, storeName: string) => {
    setDeletingId(storeId);
    try {
      // 1. Delete associated users in 'users' collection who belong to this store
      let deletedUsersCount = 0;
      try {
        const usersQuery = query(collection(db, "users"), where("store_id", "==", storeId));
        const usersSnap = await getDocs(usersQuery);
        for (const uDoc of usersSnap.docs) {
          await deleteDoc(doc(db, "users", uDoc.id));
          deletedUsersCount++;
        }
      } catch (userDelErr) {
        console.warn("Gagal menghapus beberapa data akun pengguna terkait:", userDelErr);
      }

      // 2. Delete the tenant store document from "stores" collection
      await deleteDoc(doc(db, "stores", storeId));
      
      // Update local state array immediately to filter out the tenant row for seamless UI updates
      setTenants(prev => prev.filter(t => t.store_id !== storeId));
      
      setSuccessNotification(`Tenant "${storeName}" serta ${deletedUsersCount} akun pengguna terkait berhasil dihapus secara permanen.`);
    } catch (err: any) {
      console.error("Gagal menghapus tenant: ", err);
      setErrorNotification("Gagal menghapus tenant: " + (err?.message || err));
      handleFirestoreError(err, OperationType.DELETE, `stores/${storeId}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passkey.trim() === DEFAULT_SECURITY_TOKEN) {
      setIsUnlocked(true);
      setPasskeyError("");
    } else {
      setPasskeyError("Token pengawas tidak cocok. Silakan tanyakan Kunci Otorisasi!");
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName || !email || !password || !storeName) {
      setErrorMsg("Semua bidang input pendaftaran wajib dilengkapi!");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Sandi minimal harus berupa 6 karakter.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setReceipt(null);

    const storeId = "store_" + Math.random().toString(36).substring(2, 11);
    const appName = "TemporaryAdminZone";
    let secondaryApp: any = null;

    try {
      // 1. LITERAL CONFIGURATION BLOCK:
      const realConfig = firebaseConfig;

      if (getApps().some(app => app.name === appName)) {
        try {
          const oldApp = getApp(appName);
          await deleteApp(oldApp);
        } catch (appDelErr) {
          console.warn("Could not delete pre-existing secondary app:", appDelErr);
        }
      }
      secondaryApp = initializeApp(realConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      const secondaryDb = firebaseConfig.projectId === "storesage-q"
        ? getSecondaryFirestore(secondaryApp)
        : (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
          ? getSecondaryFirestore(secondaryApp, firebaseConfig.firestoreDatabaseId)
          : getSecondaryFirestore(secondaryApp));

      // 2. Create secondary tenant user account in Firebase Auth
      let uid: string = "";
      try {
        const authResult = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        uid = authResult.user.uid;
      } catch (authErr: any) {
        if (authErr?.code === "auth/email-already-in-use" || authErr?.code === "auth/email_already_in_use" || (authErr?.message && authErr.message.includes("email-already-in-use"))) {
          try {
            // Sign in to verify password matches, and get the UID for correct metadata linkage
            const loginResult = await signInWithEmailAndPassword(secondaryAuth, email, password);
            uid = loginResult.user.uid;
            console.log("Successfully reclaimed existing credential for UID:", uid);
          } catch (loginErr: any) {
            throw new Error(`Email "${email}" sudah terdaftar di Firebase Auth dengan sandi berbeda. [Sebab: ${loginErr.code || loginErr.message}]`);
          }
        } else {
          const errCodeStr = authErr?.code ? ` [${authErr.code}]` : "";
          const errTextStr = authErr?.message || String(authErr);
          throw new Error(`Gagal membuat akun autentikasi: ${errTextStr}${errCodeStr}`);
        }
      }

      // Check if UID is valid before executing Firestore writes. Ensure authentication completely succeeded first.
      if (!uid) {
        throw new Error("Proses Autentikasi tidak mengembalikan ID pengguna yang valid.");
      }

      // 3. Define dates and durations
      const billingEnd = new Date();
      if (durationOption === "30") {
        billingEnd.setDate(billingEnd.getDate() + 30);
      } else if (durationOption === "90") {
        billingEnd.setDate(billingEnd.getDate() + 90);
      } else if (durationOption === "365") {
        billingEnd.setDate(billingEnd.getDate() + 365);
      } else if (durationOption === "3_days") {
        billingEnd.setTime(billingEnd.getTime() + 3 * 24 * 60 * 60 * 1000);
      } else if (durationOption === "2_days") {
        billingEnd.setTime(billingEnd.getTime() + 2 * 24 * 60 * 60 * 1000);
      } else if (durationOption === "5_mins") {
        billingEnd.setTime(billingEnd.getTime() + 5 * 60 * 1000);
      }

      const assignedPackageName = getPackageName(durationOption);

      // 4. FIRESTORE WRITE LOGIC:
      // A. Write tenant profile document to 'tenants' collection using UID
      try {
        const tenantRef = doc(secondaryDb, "tenants", uid);
        await setDoc(tenantRef, {
          subscriptionExpiresAt: billingEnd.toISOString(),
          status: "active",
          store_id: storeId,
          store_name: storeName,
          owner_name: ownerName,
          email: email,
          package_name: assignedPackageName,
          duration_plan: durationOption,
          createdAt: new Date().toISOString()
        });
      } catch (tenantErr: any) {
        handleFirestoreError(tenantErr, OperationType.WRITE, `tenants/${uid}`);
      }

      // B. Write user document to 'users' collection linking UID with role 'tenant_admin'
      try {
        const userRef = doc(secondaryDb, "users", uid);
        await setDoc(userRef, {
          name: ownerName,
          role: "tenant_admin" as any, // Cast to any to align with types list
          store_id: storeId,
          email: email
        });
      } catch (userErr: any) {
        handleFirestoreError(userErr, OperationType.WRITE, `users/${uid}`);
      }

      // C. Write the stores companion profile to preserve compatibility of dashboard & views
      try {
        const storeRef = doc(secondaryDb, "stores", storeId);
        await setDoc(storeRef, {
          store_name: storeName,
          status_langganan: "active",
          billing_period_end: billingEnd.toISOString(),
          package_name: assignedPackageName,
          duration_plan: durationOption
        });
      } catch (storeErr: any) {
        handleFirestoreError(storeErr, OperationType.WRITE, `stores/${storeId}`);
      }

      // D. Optionally seed starting products to let new tenant experience full dashboard immediately
      if (preSeedProducts) {
        const defaultSeeds = [
          { name: "Sirup Pandan Wangi Murni", sku: "SRP-PDN-MRN", stock: 18, stock_minimum: 10, price: 16500 },
          { name: "Teh Wangi Premium Melati", sku: "TEA-MEL-PREM", stock: 4, stock_minimum: 12, price: 5800 },
          { name: "Kopi Arabika Gayo Blend 250g", sku: "GYO-ARAB-250", stock: 25, stock_minimum: 15, price: 79000 }
        ];

        for (const item of defaultSeeds) {
          const customId = "seeded_" + Math.random().toString(36).substring(2, 9);
          try {
            await setDoc(doc(secondaryDb, "stores", storeId, "products", customId), item);
          } catch (seedErr: any) {
            handleFirestoreError(seedErr, OperationType.WRITE, `stores/${storeId}/products/${customId}`);
          }
        }
      }

      // 5. CLEANUP:
      // Sign out from the secondary auth instance
      await signOut(secondaryAuth);

      // Set Receipt for visualization and copy action
      setReceipt({
        uid,
        email,
        pass: password,
        storeId,
        storeName,
        ownerName
      });

      // Reset form on success
      setOwnerName("");
      setEmail("");
      setPassword("");
      setStoreName("");

      // Refresh list
      loadTenants();

    } catch (err: any) {
      console.error("Critical Provisioning Failure: ", err);
      let errMsgText = "Gagal memproses pendaftaran. Silakan coba kembali.";
      if (err?.code === "auth/email-already-in-use") {
        errMsgText = "Email custom tersebut sudah terpakai di sistem Firebase Auth.";
      } else if (err?.code === "auth/invalid-email") {
        errMsgText = "Struktur format email tidak sah atau salah ketik.";
      } else if (err?.message) {
        errMsgText = err.message;
      }
      setErrorMsg(errMsgText);
    } finally {
      setLoading(false);
      // Clean up the secondary app to prevent memory leaks and maintain stability
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
          console.log("Cleanup: Secondary App deleted successfully.");
        } catch (appDelErr) {
          console.warn("Could not delete secondary app in finally block:", appDelErr);
        }
      }
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    // Silent confirmation or temporary modal
  };

  if (authLoading || (user && !userData)) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4" id="admin-boot-loader">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 font-mono"></div>
        <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase font-mono">Memverifikasi Sesi Admin...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden" id="admin-custom-provisioning-root">
      {/* Aurora cosmic gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl -tr-40"></div>
      <div className="absolute -bottom-40 -left-20 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl"></div>

      {/* Internal Navigation Header */}
      <header className="border-b border-slate-900/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between" id="admin-header">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={async () => {
              if (user && isSuperAdmin) {
                await logout();
              }
              onBackToMain();
            }}
            className="p-2 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer"
            id="back-button"
            title="Keluar & Kembali ke Dashboard Utama"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl flex items-center justify-center">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white font-sans">
                Admin Console
              </h2>
              <span className="text-[10px] text-slate-500 block font-mono">StoreSage Tenant Provisioning</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {userData && (
            <div className="hidden md:flex flex-col items-end text-xs text-right">
              <span className="font-bold text-slate-300">{userData.name || user?.email}</span>
              <span className="text-[10px] text-indigo-400 font-mono tracking-wider">SUPER ADMIN</span>
            </div>
          )}
          {user ? (
            <button
              onClick={async () => {
                await logout();
                onBackToMain();
              }}
              className="p-2 bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-200 border border-slate-800 hover:border-rose-900/30 font-semibold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Keluar Sesi</span>
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-500 uppercase bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
              <span>KOLABORASI: DOSEN & MAHASISWA</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container Area - Enhanced to max-w-7xl for proper landscape spacious table / column layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col justify-start relative z-20 space-y-8">
        
        {/* Step 1: Secure gate authorization token check */}
        {!elegantUnlocked ? (
          <div className="max-w-md w-full mx-auto bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-lg shadow-2xl" id="admin-gate-panel">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="h-12 w-12 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-2xl flex items-center justify-center mb-3">
                <KeyRound className="h-6 w-6 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-white">Security Gate Admin & Dosen</h3>
              <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                Silakan masukkan kunci otorisasi rahasia Anda untuk membuka Konsol Pembuat Akun UMKM Premium.
              </p>
            </div>

            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Kunci Otorisasi Terproteksi</label>
                <input
                  type="password"
                  placeholder="Masukkan Kunci Akses (PIN)"
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  className="w-full text-slate-200 text-sm p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  required
                />
                <span className="text-[10px] text-indigo-400/50 block font-mono mt-2 text-center">
                  Petunjuk: Masukkan <strong className="text-indigo-400">storesageadmin2026</strong>
                </span>
              </div>

              {passkeyError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-red-400" />
                  <span>{passkeyError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 font-bold text-sm tracking-wide rounded-xl shadow-lg transition-all cursor-pointer text-white"
              >
                Masuk Konsol Pengawas
              </button>
            </form>
          </div>
        ) : (
          /* Step 2: Main Provisioner View */
          <div className="space-y-8 w-full" id="admin-provision-dashboard">
            
            {/* Receipt Alert (If success) */}
            {receipt && (
              <div className="bg-emerald-950/40 backdrop-blur-xl border border-emerald-500/30 p-6 rounded-xl relative overflow-hidden animate-fade-in shadow-xl w-full" id="receipt-box">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-3">
                  <CheckCircle className="h-5 w-5 animate-bounce" />
                  <span>Sukses! Akun Tenant UMKM Berhasil Dibuat</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Kredensial di bawah ini sudah tersimpan aman di Database Firestore & Google Authentication. Silakan salin informasi ini untuk diberikan kepada pengguna:
                </p>

                <div className="space-y-3 font-mono text-xs text-slate-300 bg-slate-950 p-4 rounded-xl border border-emerald-900/30">
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-900/60">
                    <span className="text-slate-500">Owner Name:</span>
                    <span className="font-bold text-slate-200">{receipt.ownerName}</span>
                  </div>
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-900/60">
                    <span className="text-slate-500">Nama Toko:</span>
                    <span className="font-bold text-slate-200">{receipt.storeName}</span>
                  </div>
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-900/60">
                    <span className="text-slate-500">Email Login:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-300">{receipt.email}</span>
                      <button 
                        onClick={() => copyToClipboard(receipt.email, "Email")}
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded cursor-pointer animate-pulse"
                        title="Salin Email"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-900/60">
                    <span className="text-slate-500">Sandi Login:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-300">{receipt.pass}</span>
                      <button 
                        onClick={() => copyToClipboard(receipt.pass, "Sandi")}
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded cursor-pointer animate-pulse"
                        title="Salin Sandi"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-900/60">
                    <span className="text-slate-500">User UID:</span>
                    <span className="text-[11px] text-slate-400 select-all truncate max-w-[200px]">{receipt.uid}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Store Tenant ID:</span>
                    <span className="text-[11px] text-slate-400 select-all font-bold">{receipt.storeId}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-400/80 font-semibold">• Status Langganan: ACTIVE</span>
                  <span className="text-slate-500 font-mono">Sandi min. 6 karakter terdaftar di Auth</span>
                </div>
              </div>
            )}

            {/* TWO-COLUMN BALANCED GRID (TOP SECTION) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch w-full">
              
              {/* Left Side (lg:col-span-2): Main Provisioning Form */}
              <div className="lg:col-span-2 flex flex-col h-full">
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-6 flex flex-col justify-between h-full shadow-lg" id="creation-form-box">
                  <div>
                    <div className="flex items-center gap-2 pb-4 border-b border-white/10 mb-5">
                      <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
                      <h3 className="font-bold text-white text-sm">Registrasi Instant Multi-Tenant</h3>
                    </div>

                    {errorMsg && (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5 text-xs text-rose-300 mb-5">
                        <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-rose-400" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    <form onSubmit={handleCreateTenant} className="space-y-4">
                      {/* Grid fields for cleaner alignment */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                            <UserCheck className="h-3.5 w-3.5 text-indigo-400" /> Nama Owner UMKM
                          </label>
                          <input
                            type="text"
                            placeholder="Cth: Ibu Aminah Lestari"
                            value={ownerName}
                            onChange={(e) => setOwnerName(e.target.value)}
                            className="w-full text-slate-200 text-xs p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 font-sans"
                            required
                            disabled={loading}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-indigo-400" /> Nama Toko / UMKM Baru
                          </label>
                          <input
                            type="text"
                            placeholder="Cth: Sembako Barokah Jaya"
                            value={storeName}
                            onChange={(e) => setStoreName(e.target.value)}
                            className="w-full text-slate-200 text-xs p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 font-sans"
                            required
                            disabled={loading}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5 text-indigo-400" /> Email Custom (Kredensial Login)
                          </label>
                          <input
                            type="email"
                            placeholder="Cth: name@storesage.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full text-slate-200 text-xs p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 font-mono"
                            required
                            disabled={loading}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                            <Lock className="h-3.5 w-3.5 text-indigo-400" /> Sandi Custom (Minimum 6 Karakter)
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              placeholder="Kata sandi yang mudah disalin"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full text-slate-200 text-xs p-3 pr-10 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 font-mono"
                              required
                              disabled={loading}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-3 text-slate-500 hover:text-slate-350 cursor-pointer"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-indigo-400" /> Paket & Durasi Berlangganan Awal
                        </label>
                        <select
                          value={durationOption}
                          onChange={(e) => setDurationOption(e.target.value)}
                          className="w-full text-slate-200 text-xs p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 font-sans cursor-pointer"
                          disabled={loading}
                        >
                          <option value="30">30 Hari (Paket Reguler - 1 Bulan)</option>
                          <option value="90">90 Hari (Paket Hemat - 3 Bulan)</option>
                          <option value="365">365 Hari (Paket Setahun - 12 Bulan)</option>
                          <option value="3_days">⚠️ Uji Coba H-3 (Aktif 3 Hari - Skenario Email Warning H-3)</option>
                          <option value="2_days">⚠️ Uji Coba H-2 (Aktif 2 Hari)</option>
                          <option value="5_mins">⚡ Simulasi Kilat (Aktif 5 Menit - Demo Expired)</option>
                        </select>
                      </div>

                      {/* Seed option checklist */}
                      <div className="p-3 bg-slate-950/80 border border-white/5 rounded-xl flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="opt-seed"
                          checked={preSeedProducts}
                          onChange={(e) => setPreSeedProducts(e.target.checked)}
                          className="accent-indigo-500 h-4 w-4 rounded cursor-pointer"
                          disabled={loading}
                        />
                        <label htmlFor="opt-seed" className="text-xs text-slate-400 cursor-pointer select-none font-sans leading-relaxed">
                          Sertakan 3 Produk Awal Bawaan (Sirup, Teh, Kopi) agar dashboard tidak kosong setelah didaftarkan
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-4"
                      >
                        {loading ? (
                          <span className="flex items-center gap-1.5">
                            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                            Sedang Mendaftarkan Tenant...
                          </span>
                        ) : (
                          <span>Daftarkan Akun Custom UMKM</span>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              {/* Right Side (lg:col-span-1): Stacked Instruksi & Log Simulator */}
              <div className="lg:col-span-1 flex flex-col gap-6 h-full justify-between">
                
                {/* 1. Instruksi Pendaftaran */}
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-6 flex flex-col justify-start space-y-4 shadow-lg flex-1">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                      <ShieldCheck className="h-4.5 w-4.5 text-indigo-400" />
                      <span>Instruksi Pendaftaran</span>
                    </h3>
                    <span className="text-[9px] uppercase tracking-wider font-mono text-indigo-400 font-extrabold px-2 py-0.5 bg-indigo-500/10 rounded-sm">
                      Dosen/Admin
                    </span>
                  </div>
                  
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    Konsol penyedia layanan instan (Tenant Provisioner) dirancang bagi <strong>Admin & Dosen Pembimbing</strong> sebagai media monitoring.
                  </p>
                  
                  <div className="text-xs text-slate-400 space-y-3 pt-1 font-sans">
                    <p className="flex gap-2.5 items-start">
                      <span className="text-indigo-400 font-bold font-mono text-xs mt-0.5">1.</span>
                      <span>Isi data lengkap pemilik UMKM yang sudah mendaftar sesuai formulir.</span>
                    </p>
                    <p className="flex gap-2.5 items-start">
                      <span className="text-indigo-400 font-bold font-mono text-xs mt-0.5">2.</span>
                      <span>Sistem mendaftarkan Firebase Auth baru secara asinkron tanpa menimpa sesi login aktif Anda.</span>
                    </p>
                    <p className="flex gap-2.5 items-start">
                      <span className="text-indigo-400 font-bold font-mono text-xs mt-0.5">3.</span>
                      <span>Silo-Tenant baru berstatus <strong className="text-emerald-400">active</strong> dengan hak akses penuh <strong>owner</strong> langsung terbentuk.</span>
                    </p>
                  </div>
                </div>

                {/* 2. Server Notifikasi Email StoreSage (Log Simulator) */}
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-6 flex flex-col justify-start space-y-3 shadow-lg flex-1" id="email-server-monitor-card">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5" id="email-server-title">
                    <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold">
                      <Mail className="h-4.5 w-4.5 animate-pulse text-indigo-400" />
                      <span>Notifikasi Masa Tenggang H-3 & Simulator</span>
                    </div>
                    <span className="text-[8.5px] uppercase tracking-wider font-mono text-emerald-400 font-bold px-1.5 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">
                      Otomatis H-3
                    </span>
                  </div>
                  
                  <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
                    Saat masa tenggang tenant menyentuh <strong>H-3 (sisa ≤ 3 hari)</strong>, sistem otomatis mendeteksi durasi paket dan menyiarkan notifikasi. Data ditarik langsung dari indikator sisa hari pada panel pengawasan:
                  </p>

                  <div className="flex-1 flex flex-col justify-end min-h-[130px]">
                    {emailLogs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-4 border border-dashed border-slate-800 rounded-xl text-center text-[10px] text-slate-500 font-mono w-full">
                        <span>[Antrean Notifikasi Kosong]</span>
                        <span className="text-[9px] text-slate-600 mt-0.5">Belum ada tenant dalam masa tenggang H-3 saat ini.</span>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1 select-text w-full">
                        {emailLogs.slice(0, 5).map(log => (
                          <div key={log.id} className="p-2.5 bg-slate-950/90 border border-indigo-950/60 rounded-lg text-[10.5px] space-y-1.5 animate-fade-in font-mono shadow-sm">
                            <div className="flex justify-between items-center text-[9px] text-indigo-300 font-bold">
                              <span className="truncate max-w-[150px]">➔ {log.email}</span>
                              <span className="text-slate-500">{log.timestamp.toLocaleTimeString("id-ID")}</span>
                            </div>
                            
                            <div className="flex flex-wrap gap-1 text-[8.5px]">
                              {log.packageName && (
                                <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-300 rounded border border-indigo-500/20 font-sans font-semibold">
                                  {log.packageName}
                                </span>
                              )}
                              {log.remainingText && (
                                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-300 rounded border border-amber-500/20 font-sans font-semibold">
                                  {log.remainingText}
                                </span>
                              )}
                            </div>

                            <p className="text-slate-300 leading-relaxed font-sans text-[9.5px] bg-slate-900/50 p-1.5 rounded border border-white/5">
                              {log.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>

            {/* Bottom Section: Panel Pengawasan Billing (Full-Width, perfectly fitting and padded) */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-lg space-y-6 w-full" id="audit-monitor-box">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
                    <Hourglass className="h-5 w-5 animate-spin-slow text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Panel Pengawasan Billing & Peringatan H-3</h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-wider uppercase">SaaS MULTI-TENANT MONITOR & EMAIL SIMULATOR</p>
                  </div>
                </div>
                <button 
                  onClick={loadTenants}
                  disabled={tenantsLoading}
                  className="p-2 px-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto disabled:opacity-40"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${tenantsLoading ? "animate-spin text-indigo-400" : ""}`} />
                  <span>Segarkan Data</span>
                </button>
              </div>

              {/* Main tenants lists wrapped neatly inside standard table container to avoid ugly scrollbars */}
              {tenantsLoading && tenants.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 font-mono">Sedang menyelaraskan semua tenant pada Firestore...</div>
              ) : tenants.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <Building2 className="h-10 w-10 text-slate-700 mb-2" />
                  <p className="text-xs text-slate-400 font-sans">Belum ada tenant/UMKM yang terdaftar di database.</p>
                </div>
              ) : (
                <div className="w-full overflow-hidden rounded-xl border border-white/5 bg-slate-950/40">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-xs border-collapse divide-y divide-white/5 whitespace-nowrap lg:whitespace-normal">
                      <thead>
                        <tr className="bg-slate-950/80 text-slate-400 font-sans">
                          <th className="p-4 font-bold text-left text-xs">Nama UMKM / Owner</th>
                          <th className="p-4 font-bold text-left text-xs">Kredensial Email</th>
                          <th className="p-4 font-bold text-left text-xs">Paket & Durasi</th>
                          <th className="p-4 font-bold text-left text-xs">Masa Aktif Berakhir</th>
                          <th className="p-4 font-bold text-left text-xs">Indikator Sisa Hari</th>
                          <th className="p-4 font-bold text-center text-xs w-[280px]">Tindakan Demo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 bg-transparent">
                        {tenants.map((t) => {
                          const expiryDate = t.billing_period_end || t.subscriptionExpiresAt ? new Date(t.billing_period_end || t.subscriptionExpiresAt) : null;
                          const now = new Date();
                          
                          let diffDays = 0;
                          let diffHours = 0;
                          let diffMinutes = 0;
                          let isExpired = false;
                          let isH_3 = false;

                          if (expiryDate) {
                            const diffMs = expiryDate.getTime() - now.getTime();
                            isExpired = diffMs <= 0;
                            if (!isExpired) {
                              diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                              diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                              diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                              // H-3 concept: sisa hari <= 3 hari (72 jam)
                              if (diffMs <= 3 * 24 * 60 * 60 * 1000) {
                                isH_3 = true;
                              }
                            }
                          }

                          const displayPackage = t.package_name || getPackageName(t.duration_plan);
                          const remainingTextFormatted = diffDays > 0 ? `${diffDays} hari ${diffHours}j` : `${diffHours}j ${diffMinutes}m`;

                          return (
                            <tr key={t.store_id} className="hover:bg-slate-900/40 font-sans transition-colors">
                              <td className="p-4 max-w-[180px]">
                                <div className="font-bold text-slate-200 truncate" title={t.store_name}>{t.store_name}</div>
                                <div className="text-[10px] text-slate-500 font-medium truncate" title={t.ownerName}>Owner: {t.ownerName}</div>
                              </td>
                              <td className="p-4 font-mono text-slate-400 text-[11px] max-w-[180px] truncate" title={t.email}>
                                {t.email}
                              </td>
                              <td className="p-4 max-w-[160px]">
                                <span className="inline-flex items-center px-2 py-0.5 bg-indigo-500/10 text-indigo-300 font-semibold text-[10px] rounded border border-indigo-500/15 truncate">
                                  {displayPackage}
                                </span>
                              </td>
                              <td className="p-4">
                                {expiryDate ? (
                                  <div className="space-y-0.5">
                                    <span className="font-mono text-slate-300 text-[11px]">
                                      {expiryDate.toLocaleDateString("id-ID", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric"
                                      })}
                                    </span>
                                    <span className="text-[9px] text-slate-500 block font-mono">
                                      Pukul {expiryDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-500">Tanpa Batas</span>
                                )}
                              </td>
                              <td className="p-4">
                                {isExpired ? (
                                  <span className="inline-flex items-center px-2 py-0.5 bg-rose-500/10 text-rose-400 font-extrabold text-[9px] rounded border border-rose-500/15">EXPIRED</span>
                                ) : isH_3 ? (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-300 font-extrabold text-[9px] rounded border border-amber-500/15 animate-pulse">
                                      ⚠️ H-3 Warning
                                    </span>
                                    <span className="text-[9px] text-amber-500 block font-mono font-semibold">
                                      Sisa {remainingTextFormatted} lagi
                                    </span>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 font-extrabold text-[9px] rounded border border-emerald-500/15">Aktif Premium</span>
                                    <span className="text-[9px] text-slate-400 block font-mono font-medium">
                                      Sisa {diffDays} hari {diffHours}j
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                  {/* Quick simulation button: Reduce to H-3 */}
                                  {!isExpired && !isH_3 && (
                                    <button
                                      onClick={() => handleAdjustExpiry(t.store_id, 2.9)}
                                      className="px-2 py-1 bg-amber-950/40 hover:bg-amber-950/80 text-amber-300 border border-amber-900/30 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                                      title="Set sisa hari ke masa H-3 (2.9 hari)"
                                    >
                                      Demo H-3
                                    </button>
                                  )}

                                  {/* Quick simulation: Make expired */}
                                  {!isExpired && (
                                    <button
                                      onClick={() => handleAdjustExpiry(t.store_id, 0)}
                                      className="px-2 py-1 bg-rose-950/30 hover:bg-rose-950/70 text-rose-300 border border-rose-900/30 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                                      title="Kunci / Kedaluwarsa instan pada app"
                                    >
                                      Demo Expired
                                    </button>
                                  )}

                                  {/* Send simulated Email Info */}
                                  {isH_3 && (
                                    <button
                                      onClick={() => handleSendSimulatedEmail(t.store_name, t.email, remainingTextFormatted, t.ownerName, displayPackage)}
                                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30 rounded text-[10px] font-bold shadow transition-transform hover:scale-105 flex items-center gap-1 cursor-pointer"
                                      title="Kirim email peringatan masa tenggang H-3"
                                    >
                                      <Send className="h-3 w-3" />
                                      <span>Siarkan H-3</span>
                                    </button>
                                  )}

                                  {/* Extend 30 days */}
                                  {(isExpired || isH_3) && (
                                    <button
                                      onClick={() => handleAdjustExpiry(t.store_id, 30)}
                                      className="px-2 py-1 bg-emerald-950/40 hover:bg-emerald-950/80 text-emerald-300 border border-emerald-900/40 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                                      title="Perpanjang sebulan"
                                    >
                                      Extend 30D
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleDeleteTenant(t.store_id, t.store_name)}
                                    disabled={deletingId === t.store_id}
                                    className={`p-1 rounded transition-colors cursor-pointer ${
                                      deletingId === t.store_id
                                        ? "text-slate-600 opacity-50 bg-transparent cursor-not-allowed"
                                        : "hover:bg-rose-950/40 text-slate-500 hover:text-rose-400"
                                    }`}
                                    title="Hapus Tenant"
                                    id={`delete-tenant-btn-${t.store_id}`}
                                  >
                                    {deletingId === t.store_id ? (
                                      <svg className="animate-spin h-3.5 w-3.5 text-rose-400 inline-block" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                      </svg>
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Custom Confirmation Modal for Deleting Tenant */}
      {tenantToDelete && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 shadow-2xl relative overflow-hidden text-left">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400 shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-base">Hapus Tenant Permanen?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Apakah Anda yakin ingin menghapus tenant <strong className="text-rose-300 font-semibold">{tenantToDelete.name}</strong> ini beserta seluruh data produk & akun penggunanya?
                </p>
                <div className="text-[10px] text-rose-400 mt-2 bg-rose-950/30 p-2 rounded border border-rose-900/40">
                  Tindakan ini tidak dapat dibatalkan (permanent deletion).
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setTenantToDelete(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-slate-100 transition-colors bg-slate-800 hover:bg-slate-750 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const currentTenant = tenantToDelete;
                  setTenantToDelete(null);
                  executeDeleteTenant(currentTenant.id, currentTenant.name);
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-lg shadow-rose-600/15"
              >
                Hapus Tenant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Alert Notifications */}
      {successNotification && (
        <div className="fixed bottom-4 right-4 z-[9999] bg-slate-900 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl shadow-2xl flex items-start gap-2.5 max-w-md animate-fade-in text-left">
          <div className="p-1 bg-emerald-500/10 rounded text-emerald-400 mt-0.5 shrink-0">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-xs text-slate-100">Berhasil</h4>
            <p className="text-[11px] text-slate-300 mt-0.5 break-words">{successNotification}</p>
          </div>
          <button onClick={() => setSuccessNotification(null)} className="text-slate-400 hover:text-slate-200 shrink-0 cursor-pointer">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {errorNotification && (
        <div className="fixed bottom-4 right-4 z-[9999] bg-slate-900 border border-rose-500/30 text-rose-300 p-4 rounded-xl shadow-2xl flex items-start gap-2.5 max-w-md animate-fade-in text-left">
          <div className="p-1 bg-rose-500/10 rounded text-rose-400 mt-0.5 shrink-0">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-xs text-slate-100 font-sans">Gagal</h4>
            <p className="text-[11px] text-slate-300 mt-0.5 break-words">{errorNotification}</p>
          </div>
          <button onClick={() => setErrorNotification(null)} className="text-slate-400 hover:text-slate-200 shrink-0 cursor-pointer">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
