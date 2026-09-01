import React from "react";
import { UserDoc, StoreDoc } from "../types";
import { 
  Building2, 
  User as UserIcon, 
  ShieldAlert, 
  CheckCircle2, 
  AlertOctagon, 
  CreditCard
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
        return <span className="px-3 py-1 text-xs font-semibold text-[#32D74B] bg-[#32D74B]/10 border border-[#32D74B]/20 rounded-full flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Berlangganan (Active)</span>;
      case "free":
        return <span className="px-3 py-1 text-xs font-semibold text-[#00E5FF] bg-[#00E5FF]/10 border border-[#00E5FF]/20 rounded-full flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Akun Gratis (Free)</span>;
      case "trial":
        return <span className="px-3 py-1 text-xs font-semibold text-amber-400 bg-amber-400/10 border border-amber-500/20 rounded-full flex items-center gap-1.5">Masa Percobaan (Trial)</span>;
      case "suspended":
        return <span className="px-3 py-1 text-xs font-semibold text-[#FF453A] bg-[#FF453A]/10 border border-[#FF453A]/20 rounded-full flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Ditangguhkan (Suspended)</span>;
      default:
        return <span className="px-3 py-1 text-xs font-semibold text-[#8C8C8E] bg-[#1E1E1E] rounded-full">Tidak Diketahui</span>;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-white animate-fade-in" id="stores-panel-root">
      
      {/* SaaS Tenant Card */}
      <div className="bg-[#1E1E1E] border border-[#2C2C2E] rounded-[16px] p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,229,255,0.12)] hover:border-[#00E5FF]/20" id="tenant-details-card">
        <div className="mb-6 pb-4 border-b border-[#2C2C2E] flex items-center justify-between" id="tenant-head">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#00E5FF]/10 text-[#00E5FF] rounded-xl">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Metadata Toko (Tenant)</h3>
              <p className="text-xs text-[#8C8C8E] mt-0.5">Identitas organisasi SaaS Anda yang terisolasi Ruang Kerja</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 text-sm" id="tenant-read-display">
          <div className="p-3 bg-[#121212] rounded-xl flex items-center justify-between border border-[#2C2C2E]/60 text-white">
            <span className="text-xs text-[#8C8C8E] font-semibold uppercase">Nama Toko</span>
            <span className="font-bold text-white">{storeData?.store_name || "Memuat..."}</span>
          </div>

          <div className="p-3 bg-[#121212] rounded-xl flex items-center justify-between border border-[#2C2C2E]/60">
            <span className="text-xs text-[#8C8C8E] font-semibold uppercase">Tenant Token (Store ID)</span>
            <span className="font-mono text-xs px-2.5 py-0.5 bg-[#121212] border border-[#2C2C2E] text-[#00E5FF] font-semibold rounded-md select-all">
              {storeData?.store_id || "Tidak ada ID"}
            </span>
          </div>

          <div className="p-3 bg-[#121212] rounded-xl flex items-center justify-between border border-[#2C2C2E]/60">
            <span className="text-xs text-[#8C8C8E] font-semibold uppercase font-sans">Status Langganan</span>
            <div>{getSubBadge(storeData?.status_langganan || "active")}</div>
          </div>

          <div className="p-3 bg-[#121212] rounded-xl flex items-center justify-between border border-[#2C2C2E]/60">
            <span className="text-xs text-[#8C8C8E] font-semibold uppercase font-sans">Paket & Durasi</span>
            <span className="font-semibold text-xs text-indigo-300">
              {storeData?.package_name || (storeData?.duration_plan === "90" ? "Paket Hemat (90 Hari)" : storeData?.duration_plan === "365" ? "Paket Tahunan (365 Hari)" : "Paket Reguler UMKM (30 Hari)")}
            </span>
          </div>

          {(storeData?.billing_period_end || storeData?.subscriptionExpiresAt) && (
            <div className="p-3 bg-[#121212] rounded-xl flex items-center justify-between border border-[#2C2C2E]/60">
              <span className="text-xs text-[#8C8C8E] font-semibold uppercase font-sans">Masa Aktif Berakhir</span>
              <span className="font-mono text-xs text-slate-300">
                {new Date(storeData.billing_period_end || storeData.subscriptionExpiresAt!).toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric"
                })}
              </span>
            </div>
          )}

          <div className="pt-2 p-3 bg-[#121212] border border-[#2C2C2E]/80 rounded-xl flex items-start gap-2.5">
            <AlertOctagon className="h-4 w-4 text-[#00E5FF] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#8C8C8E] leading-relaxed font-sans">
              <strong>Ingat:</strong> Seluruh produk inventaris dihubungkan secara transitif ke Token ID Toko ini untuk menjamin isolasi database 100% aman.
            </p>
          </div>
        </div>
      </div>

      {/* Operator profile card */}
      <div className="bg-[#1E1E1E] border border-[#2C2C2E] rounded-[16px] p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,229,255,0.12)] hover:border-[#00E5FF]/20 text-white" id="operator-details-card">
        <div className="mb-6 pb-4 border-b border-[#2C2C2E] flex items-center gap-2.5" id="operator-head">
          <div className="p-2 bg-[#00E5FF]/10 text-[#00E5FF] rounded-xl">
            <UserIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Profil Operator Sesi</h3>
            <p className="text-xs text-[#8C8C8E] mt-0.5">Detail peran akun pengguna saat ini</p>
          </div>
        </div>

        <div className="space-y-4 text-sm" id="operator-display text">
          <div className="p-3 bg-[#121212] rounded-xl flex items-center justify-between border border-[#2C2C2E]/60 text-white">
            <span className="text-xs text-[#8C8C8E] font-semibold uppercase">Nama Operator</span>
            <span className="font-semibold text-white">{userData?.name || "Profil Baru / Pengguna Google"}</span>
          </div>

          <div className="p-3 bg-[#121212] rounded-xl flex items-center justify-between border border-[#2C2C2E]/60 text-white">
            <span className="text-xs text-[#8C8C8E] font-semibold uppercase">Alamat Email</span>
            <span className="text-white font-mono">{userEmail || "Anonymous Sesi"}</span>
          </div>

          <div className="p-3 bg-[#121212] rounded-xl flex items-center justify-between border border-[#2C2C2E]/60 text-white">
            <span className="text-xs text-[#8C8C8E] font-semibold uppercase">Hak Peran (Role)</span>
            <span className={`px-2.5 py-0.5 text-xs font-bold uppercase rounded-md tracking-wider ${
              (userData?.role === "admin" || userData?.role === "tenant_admin") 
                ? "bg-purple-950/40 text-purple-400 border border-purple-900/30" 
                : "bg-blue-950/40 text-blue-400 border border-blue-900/40"
            }`}>
              {userData?.role === "tenant_admin" ? "admin" : (userData?.role || "staff")}
            </span>
          </div>

          <div className="p-3 bg-[#121212] rounded-xl border border-[#2C2C2E]/60 text-xs text-[#8C8C8E] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#32D74B] rounded-full animate-ping"></span>
            <span>Anda aman masuk dalam lingkup server-side session guard.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
