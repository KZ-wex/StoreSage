import React from "react";
import { UserDoc, StoreDoc } from "../types";
import { 
  Building2, 
  User as UserIcon, 
  ShieldAlert, 
  CheckCircle2, 
  CreditCard,
  Calendar,
  ShieldCheck
} from "lucide-react";

interface StoresViewProps {
  userData: UserDoc | null;
  storeData: StoreDoc | null;
  userEmail: string | undefined;
  onRefresh: () => Promise<void>;
}

export default function StoresView({ userData, storeData, userEmail }: StoresViewProps) {
  const getSubBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="px-3 py-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Aktif</span>;
      case "free":
        return <span className="px-3 py-1 text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Paket Gratis</span>;
      case "trial":
        return <span className="px-3 py-1 text-xs font-semibold text-amber-400 bg-amber-400/10 border border-amber-500/20 rounded-full flex items-center gap-1.5">Masa Percobaan</span>;
      case "suspended":
        return <span className="px-3 py-1 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Ditangguhkan</span>;
      default:
        return <span className="px-3 py-1 text-xs font-semibold text-[#8C8C8E] bg-[#1E1E1E] rounded-full">Tidak Diketahui</span>;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-white animate-fade-in" id="stores-panel-root">
      
      {/* Store Information Card */}
      <div className="bg-[#1E1E1E] border border-[#2C2C2E] rounded-2xl p-6 transition-all duration-200 hover:border-indigo-500/30" id="tenant-details-card">
        <div className="mb-6 pb-4 border-b border-[#2C2C2E] flex items-center justify-between" id="tenant-head">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Informasi Bisnis & Toko</h3>
              <p className="text-xs text-[#8C8C8E] mt-0.5">Detail identitas operasional dan paket berlangganan</p>
            </div>
          </div>
        </div>

        <div className="space-y-3.5 text-sm" id="tenant-read-display">
          <div className="p-3 bg-[#121212] rounded-xl flex items-center justify-between border border-[#2C2C2E]/60 text-white">
            <span className="text-xs text-[#8C8C8E] font-semibold uppercase">Nama Bisnis</span>
            <span className="font-bold text-white">{storeData?.store_name || "Memuat..."}</span>
          </div>

          <div className="p-3 bg-[#121212] rounded-xl flex items-center justify-between border border-[#2C2C2E]/60">
            <span className="text-xs text-[#8C8C8E] font-semibold uppercase">ID Toko</span>
            <span className="font-mono text-xs px-2.5 py-1 bg-slate-900 border border-slate-700 text-indigo-300 font-semibold rounded-md select-all">
              {storeData?.store_id || "Tidak ada ID"}
            </span>
          </div>

          <div className="p-3 bg-[#121212] rounded-xl flex items-center justify-between border border-[#2C2C2E]/60">
            <span className="text-xs text-[#8C8C8E] font-semibold uppercase font-sans">Status Paket</span>
            <div>{getSubBadge(storeData?.status_langganan || "active")}</div>
          </div>

          <div className="p-3 bg-[#121212] rounded-xl flex items-center justify-between border border-[#2C2C2E]/60">
            <span className="text-xs text-[#8C8C8E] font-semibold uppercase font-sans">Paket Layanan</span>
            <span className="font-semibold text-xs text-indigo-300">
              {storeData?.package_name || (storeData?.duration_plan === "90" ? "Paket Kuartal (90 Hari)" : storeData?.duration_plan === "365" ? "Paket Tahunan (365 Hari)" : "Paket Bulanan (30 Hari)")}
            </span>
          </div>

          {(storeData?.billing_period_end || storeData?.subscriptionExpiresAt) && (
            <div className="p-3 bg-[#121212] rounded-xl flex items-center justify-between border border-[#2C2C2E]/60">
              <span className="text-xs text-[#8C8C8E] font-semibold uppercase font-sans">Masa Aktif Berakhir</span>
              <span className="font-mono text-xs text-slate-300 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                {new Date(storeData.billing_period_end || storeData.subscriptionExpiresAt!).toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric"
                })}
              </span>
            </div>
          )}

          <div className="pt-2 p-3 bg-[#121212] border border-[#2C2C2E]/80 rounded-xl flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#8C8C8E] leading-relaxed font-sans">
              Seluruh data inventaris, kasir, dan laporan penjualan toko Anda terlindungi dengan enkripsi mandiri dan terpisah dari toko lain.
            </p>
          </div>
        </div>
      </div>

      {/* Operator profile card */}
      <div className="bg-[#1E1E1E] border border-[#2C2C2E] rounded-2xl p-6 transition-all duration-200 hover:border-indigo-500/30 text-white" id="operator-details-card">
        <div className="mb-6 pb-4 border-b border-[#2C2C2E] flex items-center gap-3" id="operator-head">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
            <UserIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Profil Pengguna Aktif</h3>
            <p className="text-xs text-[#8C8C8E] mt-0.5">Informasi akun dan hak akses operasional</p>
          </div>
        </div>

        <div className="space-y-3.5 text-sm" id="operator-display-text">
          <div className="p-3 bg-[#121212] rounded-xl flex items-center justify-between border border-[#2C2C2E]/60 text-white">
            <span className="text-xs text-[#8C8C8E] font-semibold uppercase">Nama Pengguna</span>
            <span className="font-semibold text-white">{userData?.name || "Pengguna"}</span>
          </div>

          <div className="p-3 bg-[#121212] rounded-xl flex items-center justify-between border border-[#2C2C2E]/60 text-white">
            <span className="text-xs text-[#8C8C8E] font-semibold uppercase">Email Operasional</span>
            <span className="text-white font-mono text-xs">{userEmail || "user@storesage.com"}</span>
          </div>

          <div className="p-3 bg-[#121212] rounded-xl flex items-center justify-between border border-[#2C2C2E]/60 text-white">
            <span className="text-xs text-[#8C8C8E] font-semibold uppercase">Peran Akun</span>
            <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded-md tracking-wider ${
              (userData?.role === "admin" || userData?.role === "tenant_admin") 
                ? "bg-indigo-950/50 text-indigo-300 border border-indigo-800/40" 
                : "bg-slate-800 text-slate-300 border border-slate-700"
            }`}>
              {(userData?.role === "admin" || userData?.role === "tenant_admin") ? "Pemilik Toko" : "Staff Operasional"}
            </span>
          </div>

          <div className="p-3 bg-[#121212] rounded-xl border border-[#2C2C2E]/60 text-xs text-[#8C8C8E] flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>Status: Sesi Aktif & Terhubung</span>
          </div>
        </div>
      </div>
    </div>
  );
}
