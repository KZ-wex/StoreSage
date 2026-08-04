import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ProductDoc } from "./types";
import { collection, onSnapshot, doc, setDoc, getDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType, auth } from "./firebase";
import DashboardView from "./components/DashboardView";
import ProductsView from "./components/ProductsView";
import StoresView from "./components/StoresView";
import BillingExpiredView from "./components/BillingExpiredView";
import AdminCreateTenantView from "./components/AdminCreateTenantView";
import { 
  Building2, 
  Layers, 
  Package, 
  Users, 
  LogOut, 
  ChevronRight, 
  Database,
  Briefcase,
  User as UserIcon,
  PlusCircle,
  Clock,
  Sparkles,
  HelpCircle,
  Lock,
  Mail,
  UserCheck,
  AlertCircle,
  AlertTriangle,
  Cpu,
  Menu,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Standard formatting for Indonesian Rupiah
const fmtIDR = (val: number) => "Rp " + val.toLocaleString("id-ID");

function MainAppShell() {
  const { user, userData, storeData, logout, refreshTenantData, isNearExpiry } = useAuth();
  const [activeTab, setActiveTab] = useState<"dashboard" | "products" | "store">("dashboard");
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [systime, setSystime] = useState(new Date());
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  // Check subscription parameters for H-2 notifications
  useEffect(() => {
    if (storeData?.billing_period_end || storeData?.subscriptionExpiresAt || isNearExpiry) {
      const checkInterval = setInterval(() => {
        const expiryStr = storeData?.subscriptionExpiresAt || storeData?.billing_period_end;
        if (!expiryStr) {
          if (isNearExpiry) {
            setWarningMsg(
              `Masa aktif berlangganan SaaS UMKM Anda akan berakhir kurang dari 48 jam lagi. Silakan melakukan koordinasi perpanjangan Paket ke Admin untuk menghindari pengosongan atau penangguhan sistem.`
            );
          } else {
            setWarningMsg(null);
          }
          return;
        }
        const expiry = new Date(expiryStr);
        const now = new Date();
        const diffMs = expiry.getTime() - now.getTime();
        
        if (isNearExpiry || (diffMs > 0 && diffMs <= 2 * 24 * 60 * 60 * 1000)) {
          const hours = Math.ceil(diffMs / (1000 * 60 * 60));
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const remainingText = diffMs > 0 ? (days > 0 ? `${days} hari lagi` : `${hours} jam lagi`) : "segera";
          setWarningMsg(
            `Masa aktif berlangganan SaaS UMKM Anda akan berakhir dalam ${remainingText}. Silakan melakukan koordinasi perpanjangan Paket ke Admin untuk menghindari pengosongan atau penangguhan sistem.`
          );
        } else {
          setWarningMsg(null);
        }
      }, 5000); // Check every 5 seconds for simulation responsiveness
      
      return () => clearInterval(checkInterval);
    } else {
      setWarningMsg(null);
    }
  }, [storeData, isNearExpiry]);

  // Keep time updated
  useEffect(() => {
    const timer = setInterval(() => setSystime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Real-time synchronization of products according to active Tenant store_id
  useEffect(() => {
    if (!userData?.store_id) {
      setProducts([]);
      setProductsLoading(false);
      return;
    }

    setProductsLoading(true);
    const path = `stores/${userData.store_id}/products`;
    
    // Set up standard secure onSnapshot listener with mandatory JSON error handler
    const productsColRef = collection(db, "stores", userData.store_id, "products");
    
    const unsubscribe = onSnapshot(productsColRef, (snapshot) => {
      const items: ProductDoc[] = [];
      snapshot.forEach((snapDoc) => {
        items.push({
          id: snapDoc.id,
          ...snapDoc.data()
        } as ProductDoc);
      });
      setProducts(items);
      setProductsLoading(false);
    }, (error) => {
      setProductsLoading(false);
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [userData?.store_id]);

  // Handle automatic generation of dummy starting inventory if store is completely empty
  const handleSeedDummyProducts = async () => {
    if (!userData?.store_id) return;
    const starterSeed = [
      { name: "Kopi Arabika Toraja 250g", sku: "KOP-ARAB-TORA", stock: 12, stock_minimum: 15, price: 65000 },
      { name: "Susu UHT Full Cream 1L", sku: "SUSU-UHT-FC", stock: 4, stock_minimum: 10, price: 18500 },
      { name: "Minyak Goreng Sawit 2L", sku: "MINYAK-SAWIT-2L", stock: 0, stock_minimum: 8, price: 34000 },
      { name: "Beras Sentra Ramos 5kg", sku: "BERAS-RAMOS-5K", stock: 25, stock_minimum: 10, price: 72000 },
      { name: "Gula Pasir Kristal 1kg", sku: "GULA-KRISTAL-1K", stock: 3, stock_minimum: 10, price: 16000 },
      { name: "Teh Celup Melati (Isi 25)", sku: "TEH-MELATI-25", stock: 50, stock_minimum: 12, price: 6000 }
    ];

    try {
      for (const item of starterSeed) {
        const customId = "dummy_" + Math.random().toString(36).substring(2, 10);
        const ref = doc(db, "stores", userData.store_id, "products", customId);
        await setDoc(ref, item);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `stores/${userData.store_id}/products`);
    }
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const renderSidebarContents = (isMobile: boolean, closeMobileMenu?: () => void) => {
    return (
      <div className="flex flex-col h-full bg-[#1A1A1A] text-[#B0B0B0] font-sans" id={isMobile ? "sidebar-contents-mobile" : "sidebar-contents-desktop"}>
        {/* Brand Banner */}
        <div className="p-6 border-b border-[#2C2C2E] flex items-center justify-between shrink-0" id={`sidebar-logo-container-${isMobile ? 'm' : 'd'}`}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-[#00E5FF] rounded-lg flex items-center justify-center shadow-sm">
              <Briefcase className="h-5 w-5 text-black" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-[-0.03em] text-white flex items-center gap-1.5 font-sans">
                StoreSage
                <span className="text-[10px] py-0.5 px-1.5 bg-[#00E5FF]/20 text-[#00E5FF] font-bold uppercase rounded tracking-widest leading-none border border-[#00E5FF]/30">SaaS</span>
              </h1>
              <span className="text-[10px] text-[#8C8C8E] block font-medium mt-0.5">Sistem Inventaris Multi-Tenant</span>
            </div>
          </div>
          {/* Mobile close button */}
          {isMobile && (
            <button 
              onClick={closeMobileMenu}
              className="lg:hidden p-1.5 hover:bg-[#252525] rounded-md text-[#8C8C8E] hover:text-white transition-colors cursor-pointer"
              aria-label="Tutup menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Selected Store / Tenant Context Indicator */}
        <div className="px-6 py-4 border-b border-[#2C2C2E] bg-[#121212] shrink-0" id={`tenant-scope-banner-${isMobile ? 'm' : 'd'}`}>
          <div className="p-2.5 bg-[#1E1E1E] rounded-[12px] border border-[#2C2C2E] flex items-center gap-3">
            <div className="p-1.5 bg-[#00E5FF]/10 text-[#00E5FF] rounded-md">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] uppercase tracking-wider text-[#8C8C8E] font-bold block">Lingkup Tenant Aktif</span>
              <span className="text-xs font-bold text-white truncate block mt-0.5">
                {storeData?.store_name || "Mendaftarkan toko..."}
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar Nav Buttons */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto" id={`sidebar-nav-${isMobile ? 'm' : 'd'}`}>
          <button
            onClick={() => {
              setActiveTab("dashboard");
              if (closeMobileMenu) closeMobileMenu();
            }}
            className={`w-full p-2.5 font-medium text-sm rounded-[6px] flex items-center justify-between transition-all cursor-pointer ${
              activeTab === "dashboard" 
                ? "bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30" 
                : "text-[#B0B0B0] hover:text-white hover:bg-[#252525]"
            }`}
          >
            <div className="flex items-center gap-3">
              <Layers className="h-4.5 w-4.5" />
              <span>Dashboard Inventaris</span>
            </div>
            <ChevronRight className={`h-4 w-4 transition-transform ${activeTab === "dashboard" ? "rotate-90 text-[#00E5FF]" : "text-[#B0B0B0]"}`} />
          </button>

          <button
            onClick={() => {
              setActiveTab("products");
              if (closeMobileMenu) closeMobileMenu();
            }}
            className={`w-full p-2.5 font-medium text-sm rounded-[6px] flex items-center justify-between transition-all cursor-pointer ${
              activeTab === "products" 
                ? "bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30" 
                : "text-[#B0B0B0] hover:text-white hover:bg-[#252525]"
            }`}
          >
            <div className="flex items-center gap-3">
              <Package className="h-4.5 w-4.5" />
              <span>Kelola Katalog Produk</span>
            </div>
            <ChevronRight className={`h-4 w-4 transition-transform ${activeTab === "products" ? "rotate-90 text-[#00E5FF]" : "text-[#B0B0B0]"}`} />
          </button>

          <button
            onClick={() => {
              setActiveTab("store");
              if (closeMobileMenu) closeMobileMenu();
            }}
            className={`w-full p-2.5 font-medium text-sm rounded-[6px] flex items-center justify-between transition-all cursor-pointer ${
              activeTab === "store" 
                ? "bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30" 
                : "text-[#B0B0B0] hover:text-white hover:bg-[#252525]"
            }`}
          >
            <div className="flex items-center gap-3">
              <Users className="h-4.5 w-4.5" />
              <span>Konfigurasi UMKM</span>
            </div>
            <ChevronRight className={`h-4 w-4 transition-transform ${activeTab === "store" ? "rotate-90 text-[#00E5FF]" : "text-[#B0B0B0]"}`} />
          </button>
        </nav>

        {/* Database Active Status and Quick logout bottom panel */}
        <div className="p-4 border-t border-[#2C2C2E] flex flex-col gap-3 shrink-0" id={`sidebar-footer-${isMobile ? 'm' : 'd'}`}>
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#1A3F3F]/35 border border-[#00E5FF]/20 text-[#00E5FF] rounded-[6px] text-[11px] font-mono">
            <span className="w-1.5 h-1.5 bg-[#00E5FF] rounded-full animate-pulse shrink-0"></span>
            <Database className="h-3.5 w-3.5 text-[#00E5FF]" />
            <span className="truncate text-white">Silo-Tenant: Firestore Aktif</span>
          </div>

          <button
            onClick={() => {
              logout();
              if (closeMobileMenu) closeMobileMenu();
            }}
            className="w-full p-2.5 bg-[#1E1E1E] hover:bg-rose-950/25 text-[#B0B0B0] hover:text-red-400 border border-[#2C2C2E] font-semibold text-xs rounded-[6px] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar Sesi Tenant</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen overflow-hidden bg-[#121212] flex font-sans text-white" id="saas-app-shell">
      {/* Dynamic Left Sidebar on Desktop */}
      <aside className="hidden lg:flex w-64 h-full bg-[#1A1A1A] border-r border-[#2C2C2E] shrink-0 flex-col font-sans" id="sidebar-panel">
        {renderSidebarContents(false)}
      </aside>

      {/* Mobile Drawer (Sidebar) using Framer Motion */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex" id="sidebar-panel-mobile-wrapper">
            {/* Backdrop / Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-black"
              id="sidebar-mobile-backdrop"
            />

            {/* Sidebar drawer panel */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-64 h-full bg-[#1A1A1A] border-r border-[#2C2C2E] shadow-2xl flex flex-col"
              id="sidebar-panel-mobile"
            >
              {renderSidebarContents(true, () => setIsMobileMenuOpen(false))}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main workspace arena */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#121212]" id="main-content-area">
        {/* Top visual Header */}
        <header className="bg-[#1E1E1E] border-b border-[#2C2C2E] py-4 px-6 md:px-8 flex items-center justify-between gap-4 shrink-0 h-20" id="topbar-header">
          <div className="flex items-center gap-4 min-w-0">
            {/* Mobile hamburger menu toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#252525] transition-colors cursor-pointer"
              aria-label="Buka menu"
              id="mobile-hamburger-btn"
            >
              <Menu className="h-6 w-6" />
            </button>

            <div className="truncate">
              <h2 className="text-lg md:text-xl font-bold font-sans text-white flex items-center gap-2 truncate">
                {activeTab === "dashboard" && "Dashboard Pengawasan"}
                {activeTab === "products" && "Manajemen Katalog Produk"}
                {activeTab === "store" && "Informasi Tenant & Profil"}
              </h2>
              <p className="text-xs text-[#8C8C8E] mt-0.5 truncate">
                Selamat kembali, <strong className="text-white font-semibold">{userData?.name || "Member StoreSage"}</strong> ({(userData?.role === "admin" || userData?.role === "tenant_admin") ? "Pemilik UMKM" : "Staff Operasional"})
              </p>
            </div>
          </div>

          {/* User profile capsule */}
          <div className="flex items-center gap-3 text-sm shrink-0" id="user-context-banner">
            <div className="text-right hidden sm:block">
              <span className="font-bold text-white block max-w-[150px] truncate">{userData?.name || user?.email}</span>
              <span className="text-[10px] text-[#00E5FF] uppercase font-bold tracking-wider mt-0.5 block">{userData?.role === "tenant_admin" ? "admin" : (userData?.role || "Staff")}</span>
            </div>

            <div className="h-10 w-10 bg-[#252525] border border-[#2C2C2E] rounded-full flex items-center justify-center font-bold text-[#00E5FF] relative shadow-inner">
              {userData?.name?.substring(0, 2).toUpperCase() || "SS"}
              <div className="absolute bottom-0 right-0 h-3 w-3 bg-[#32D74B] rounded-full border-2 border-[#1E1E1E]"></div>
            </div>
          </div>
        </header>

        {/* Dynamic Inner page views */}
        <div className="p-6 md:p-8 flex-1 overflow-y-auto font-sans text-white bg-[#121212]" id="page-content-wrapper">
          {warningMsg && (
            <div className="mb-6 p-4 bg-[#2D1F10] border-l-4 border-amber-500 rounded-lg flex items-start gap-3.5 text-amber-300 shadow-md animate-fade-in" id="billing-warning-alert">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5 animate-bounce" />
              <div className="space-y-1 font-sans">
                <span className="font-extrabold text-xs text-amber-400 uppercase tracking-wide block">Pengumuman Penting H-2 Pembayaran</span>
                <p className="text-xs text-amber-200 font-medium leading-relaxed">{warningMsg}</p>
              </div>
            </div>
          )}

          {productsLoading ? (
            <div className="min-h-60 flex flex-col items-center justify-center space-y-2" id="sync-loading-spinner">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00E5FF]"></div>
              <span className="text-[#8C8C8E] font-medium text-xs">Menyelaraskan database tenant Anda...</span>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
                id="interactive-subview"
              >
                {/* Empty product notice trigger */}
                {products.length === 0 && activeTab === "dashboard" && (
                  <div className="mb-6 p-5 bg-[#1E1E1E] border border-[#2C2C2E] rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4" id="empty-db-seeding-banner">
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-[#00E5FF]" />
                        Inisialisasi Database Tenant Baru
                      </h4>
                      <p className="text-xs text-[#8C8C8E] mt-1 max-w-xl">
                        Selamat! Toko baru Anda berhasil terdaftar secara terisolasi. Database masih kosong saat ini. Ingin memasukkan 6 item contoh (beberapa berstok minim) sekarang untuk simulasi pengawasan instan?
                      </p>
                    </div>
                    <button
                      onClick={handleSeedDummyProducts}
                      className="py-2.5 px-4 bg-[#00E5FF] hover:bg-[#00B8D4] text-black font-bold text-xs rounded-xl shadow-md flex items-center gap-1 shrink-0 self-start md:self-auto cursor-pointer transition-colors"
                    >
                      <PlusCircle className="h-4.5 w-4.5" /> Seeding Otomatis
                    </button>
                  </div>
                )}

                {activeTab === "dashboard" && <DashboardView products={products} storeId={userData?.store_id || ""} />}
                {activeTab === "products" && <ProductsView products={products} storeId={userData?.store_id || ""} />}
                {activeTab === "store" && (
                  <StoresView 
                    userData={userData} 
                    storeData={storeData} 
                    userEmail={user?.email || undefined}
                    onRefresh={refreshTenantData}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>
    </div>
  );
}

function AuthenticationScreen() {
  const { loginWithGoogle, loginWithEmail, error, loading } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr(null);

    if (!email || !password) {
      setLocalErr("Email dan password wajib diisi!");
      return;
    }

    if (password.length < 6) {
      setLocalErr("Kata sandi minimal harus berisi 6 karakter.");
      return;
    }

    try {
      await loginWithEmail(email, password);
    } catch (err) {
      // Handled in context
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col md:flex-row justify-center items-center p-4 relative overflow-hidden" id="auth-root">
      {/* Background visual graphics */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mt-20"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -mr-20 -mb-20"></div>

      <div className="w-full max-w-5xl bg-slate-800/80 border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row backdrop-blur-md relative z-10" id="auth-frame">
        {/* Left Side: SaaS branding panel */}
        <div className="md:w-1/2 bg-slate-950 p-8 md:p-12 flex flex-col justify-between relative text-slate-200" id="brand-marketing-panel">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-indigo-600 rounded-2xl flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-white animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white font-sans">StoreSage</h2>
            </div>

            <div className="pt-6 space-y-4">
              <h3 className="text-xl md:text-2xl font-semibold text-slate-100 leading-tight">
                Selamat Datang di StoreSage
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed font-sans">
                Terima kasih telah memercayakan manajemen inventaris dan pergudangan UMKM Anda bersama kami. Komitmen kami adalah menjaga efisiensi stok dan isolasi data bisnis Anda dengan standar keamanan tertinggi.
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 mt-6" id="security-note">
            <Lock className="h-3.5 w-3.5" />
            <span>Terkunci aman dengan Aturan Cloud Firestore & Auth SDK</span>
          </div>
        </div>

        {/* Right Side: Auth Forms */}
        <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center" id="credentials-form-panel">
          
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-white">
              Masuk Sistem Tenant
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Masukkan kredensial akun store Anda untuk mengelola inventaris.
            </p>
          </div>

          {(error || localErr) && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-xs text-red-200 mb-4" id="auth-error-banner">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <span>{error || localErr}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" id="auth-credentials-form">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Alamat Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="email"
                  placeholder="name@storesage.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-slate-200 text-sm p-3 pl-10 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 hover:border-slate-600 transition-all duration-200"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Kata Sandi (Minimum 6 Karakter)</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="password"
                  placeholder="******"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-slate-200 text-sm p-3 pl-10 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 hover:border-slate-600 transition-all duration-200"
                  required
                />
              </div>
            </div>

            <button
               type="submit"
               disabled={loading}
               className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition-all shadow-md mt-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? "Memproses..." : "Masuk Sistem"}
            </button>
          </form>

          <div className="mt-4 text-center space-y-4">
            <p className="text-xs text-slate-400">
              Belum berlangganan? <span className="text-indigo-400 font-semibold block sm:inline">Hubungi Admin untuk aktivasi tenant baru</span>
            </p>
          </div>



        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-3" id="app-boot-loader">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase font-mono">StoreSage Booting...</span>
    </div>
  );
}

function AppContent() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const { user, userData, loading, storeData, logout, refreshTenantData } = useAuth();

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  };

  const isAdminRoute = currentPath === "/admin/create-tenant" || 
                       window.location.hash === "#/admin/create-tenant" || 
                       window.location.hash === "#admin/create-tenant";

  useEffect(() => {
    if (userData) {
      if (userData.role === "super-admin") {
        if (!isAdminRoute) {
          navigateTo("/admin/create-tenant");
        }
      } else {
        // Redirect standard UMKM tenant from the admin route back to the user dashboard
        if (isAdminRoute) {
          navigateTo("/");
        }
      }
    }
  }, [userData, isAdminRoute]);

  // Periodic check to trigger immediate billing lockdown in active session (highly responsive simulation)
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const checkTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 5000);
    return () => clearInterval(checkTimer);
  }, []);

  const isStoreBillingExpired = () => {
    if (!storeData || userData?.role === "super-admin") return false;
    if (storeData.status_langganan !== "active") return true;
    const expiryStr = storeData.subscriptionExpiresAt || storeData.billing_period_end;
    if (expiryStr) {
      const expiry = new Date(expiryStr);
      if (expiry.getTime() < currentTime.getTime()) {
        return true;
      }
    }
    return false;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (isAdminRoute && (!userData || userData.role === "super-admin")) {
    return (
      <AdminCreateTenantView 
        onBackToMain={() => navigateTo("/")} 
      />
    );
  }

  // Guard to prevent flash-rendering of user dashboard while redirecting super admin to the admin console
  if (userData && userData.role === "super-admin" && !isAdminRoute) {
    return <LoadingSpinner />;
  }

  // If no user is logged in, show Auth Screen
  if (!user || !userData) {
    return <AuthenticationScreen />;
  }

  // Check subscription billing status; block app access if status is expired or inactive
  if (isStoreBillingExpired()) {
    return (
      <BillingExpiredView 
        storeData={storeData!} 
        userData={userData!} 
        logout={logout} 
        refreshTenantData={refreshTenantData} 
      />
    );
  }

  // If fully logged in and profile matches, show system dashboard shell
  return <MainAppShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
