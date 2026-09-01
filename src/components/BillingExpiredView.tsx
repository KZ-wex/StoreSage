import React, { useState } from "react";
import { 
  ShieldAlert, 
  LogOut, 
  RefreshCw, 
  CreditCard, 
  Building2, 
  UserCheck, 
  Sparkles,
  AlertOctagon,
  HelpCircle,
  Coins
} from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { StoreDoc, UserDoc } from "../types";
import StoreSageLogo from "./StoreSageLogo";

interface BillingExpiredViewProps {
  storeData: StoreDoc | null;
  userData: UserDoc | null;
  logout: () => Promise<void>;
  refreshTenantData: () => Promise<void>;
}

export default function BillingExpiredView({ 
  storeData, 
  userData, 
  logout, 
  refreshTenantData 
}: BillingExpiredViewProps) {
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const storeId = storeData?.store_id;
  const isAdmin = userData?.role === "admin" || userData?.role === "tenant_admin";

  const handleManualRefresh = async () => {
    setRefreshing(true);
    setErrMsg(null);
    setSuccessMsg(null);
    try {
      await refreshTenantData();
    } catch (err) {
      setErrMsg("Gagal menyegarkan data. Silakan periksa koneksi internet.");
    } finally {
      setTimeout(() => setRefreshing(false), 800);
    }
  };

  const handleSimulatePayment = async () => {
    if (!isAdmin || !storeId) return;
    setUpdating(true);
    setErrMsg(null);
    setSuccessMsg(null);
    const path = `stores/${storeId}`;
    try {
      const storeRef = doc(db, "stores", storeId);
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      
      await updateDoc(storeRef, {
        status_langganan: "active",
        billing_period_end: thirtyDaysLater.toISOString()
      });
      setSuccessMsg("Pembayaran simulasi berhasil! Mengaktifkan paket premium dan menambah masa aktif 30 hari ke depan...");
      // Re-trigger auth context state update
      await refreshTenantData();
    } catch (err: any) {
      setErrMsg("Gagal mensimulasikan pembayaran. Pastikan Anda masuk sebagai Admin.");
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setUpdating(false);
    }
  };

  const handleSetTrial = async () => {
    if (!isAdmin || !storeId) return;
    setUpdating(true);
    setErrMsg(null);
    try {
      const storeRef = doc(db, "stores", storeId);
      const expiredYesterday = new Date();
      expiredYesterday.setDate(expiredYesterday.getDate() - 1);
      
      await updateDoc(storeRef, {
        status_langganan: "trial",
        billing_period_end: expiredYesterday.toISOString()
      });
      setSuccessMsg("Toko berhasil diubah kembali ke status trial kedaluwarsa untuk keperluan uji coba.");
      await refreshTenantData();
    } catch (err: any) {
      setErrMsg("Gagal memperbarui status.");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusExplanation = (status: string) => {
    switch (status) {
      case "free":
        return {
          title: "Paket Free Terkunci",
          desc: "Paket Gratis Anda telah dinonaktifkan atau memerlukan peningkatan (upgrade) ke paket premium 'active' untuk membuka kontrol penuh database inventaris multi-tenant.",
          colorHex: "amber"
        };
      case "trial":
        return {
          title: "Masa Percobaan Selesai",
          desc: "Masa uji coba (trial) gratis UMKM Anda untuk mengevaluasi isolasi data dan monitoring persediaan stok kritis StoreSage telah berakhir.",
          colorHex: "amber"
        };
      case "suspended":
        return {
          title: "Sesi Toko Ditangguhkan",
          desc: "Akun organisasi tenant Anda telah ditangguhkan secara administratif. Semua akses operasi baca & tulis menu inventaris terkunci sementara demi keselamatan data.",
          colorHex: "red"
        };
      default:
        return {
          title: "Akses Berlangganan Tidak Aktif",
          desc: "Akses ke dashboard inventaris StoreSage dikunci secara otomatis karena status langganan paket Anda saat ini tidak valid atau telah kadaluarsa.",
          colorHex: "red"
        };
    }
  };

  const subConfig = getStatusExplanation(storeData?.status_langganan || "");

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden" id="billing-expired-root">
      {/* Visual background atmospheric lights */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl -ml-20 -mt-20"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mb-20"></div>

      <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col p-6 md:p-8 backdrop-blur-md relative z-10" id="billing-frame">
        {/* Upper visual alert icon branding */}
        <div className="flex flex-col items-center text-center pb-6 border-b border-slate-800/60" id="billing-upper-brand">
          <div className="mb-4 flex items-center justify-center">
            <StoreSageLogo size={60} withGlow={true} />
          </div>
          
          <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase font-mono mb-1">
            StoreSage Multi-Tenant Sentinel
          </span>
          <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-snug">
            {subConfig.title}
          </h2>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            {subConfig.desc}
          </p>
        </div>

        {/* Tenant Information Details */}
        <div className="my-5 p-4 bg-slate-950/60 rounded-2xl border border-slate-800/50 space-y-3 text-xs" id="billing-tenant-info">
          <div className="flex justify-between items-center pb-2 border-b border-slate-900/50">
            <span className="text-slate-500 flex items-center gap-1.5 font-medium">
              <Building2 className="h-3.5 w-3.5" /> Nama Toko (Store)
            </span>
            <span className="font-bold text-slate-200">
              {storeData?.store_name || "Tidak Diketahui"}
            </span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-slate-900/50">
            <span className="text-slate-500 flex items-center gap-1.5 font-medium">
              <CreditCard className="h-3.5 w-3.5" /> Status Langganan
            </span>
            <span className={`px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px] ${
              storeData?.status_langganan === "suspended"
                ? "bg-rose-500/20 text-rose-300"
                : "bg-amber-500/20 text-amber-300"
            }`}>
              {storeData?.status_langganan || "inactive"}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-500 flex items-center gap-1.5 font-medium">
              <UserCheck className="h-3.5 w-3.5" /> Operator / Peran
            </span>
            <span className="font-medium text-slate-300 flex items-center gap-1">
              <span>{userData?.name || "User"}</span>
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.1 bg-slate-800 text-slate-400 rounded-sm font-bold">
                {userData?.role || "staff"}
              </span>
            </span>
          </div>
        </div>

        {/* Action Error / Success Display */}
        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-emerald-300 mb-4 animate-fade-in" id="billing-success-banner">
            <Sparkles className="h-4.5 w-4.5 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {errMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-xs text-rose-300 mb-4 animate-fade-in" id="billing-error-banner">
            <AlertOctagon className="h-4.5 w-4.5 shrink-0 text-rose-400" />
            <span>{errMsg}</span>
          </div>
        )}

        {/* Sandbox Payment Simulator Area */}
        <div className="mb-6 p-4 rounded-2xl border border-slate-850 bg-slate-900/40" id="billing-interactive-sandbox">
          {isAdmin ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-indigo-400 font-bold" id="sandbox-title">
                <Coins className="h-4 w-4 animate-bounce" />
                <span>Simulasi Gerbang Pembayaran SaaS (Role Admin)</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                Sebagai pemilik toko (Admin), Anda memiliki wewenang untuk langsung mensimulasikan pembayaran premium untuk memulihkan akses penuh. Nilai ini akan disimpan secara aman di dokumen backend Firestore Anda.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1" id="sandbox-actions">
                <button
                  type="button"
                  disabled={updating || refreshing}
                  onClick={handleSimulatePayment}
                  className="py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  {updating ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CreditCard className="h-3.5 w-3.5" />
                  )}
                  <span>Bayar Tagihan Premium</span>
                </button>
                <button
                  type="button"
                  disabled={updating || refreshing}
                  onClick={handleSetTrial}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  <span>Atur Status 'trial'</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-amber-500 font-bold">
                <AlertOctagon className="h-4 w-4" />
                <span>Akses Administrasi Terkunci (Peran Staff)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Kredensial operator Anda adalah <strong>Staff Operasional</strong>. Hanya pemilik toko dengan peran <strong>Admin</strong> yang berhak melakukan penyelesaian tagihan baru, merubah lisensi, atau mensimulasikan pembayaran.
              </p>
            </div>
          )}
        </div>

        {/* Global Control Buttons */}
        <div className="flex flex-col sm:flex-row gap-2" id="billing-footer">
          <button
            type="button"
            disabled={refreshing || updating}
            onClick={handleManualRefresh}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-755 text-slate-200 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>Segarkan Status</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="sm:w-1/3 py-3 bg-rose-950/40 hover:bg-rose-950/80 border border-rose-900/50 text-rose-200 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar Sesi</span>
          </button>
        </div>

        <div className="text-center text-[10px] text-indigo-500/40 mt-5 flex items-center justify-center gap-1 font-mono hover:text-indigo-500 transition-colors cursor-help">
          <HelpCircle className="h-3 w-3" />
          <span>Keamanan Terjamin dengan Aturan Sandbox Multi-Tenant</span>
        </div>
      </div>
    </div>
  );
}
