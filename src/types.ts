// Types and Interfaces for StoreSage SaaS Multi-Tenant

export type UserRole = "admin" | "owner" | "staff" | "super-admin" | "kasir" | "tenant_admin";
export type SubscriptionStatus = "active" | "free" | "trial" | "suspended";

export interface UserDoc {
  uid?: string;
  name: string;
  role: UserRole;
  store_id: string;
  email?: string;
}

export interface StoreDoc {
  store_id?: string;
  store_name: string;
  status_langganan: SubscriptionStatus;
  billing_period_end?: string; // Optional ISO date string
  subscriptionExpiresAt?: string; // Optional alias for compatibility
  package_name?: string; // e.g. "Paket Reguler (30 Hari)"
  duration_plan?: string; // e.g. "30", "90", "365", "3_days"
  created_at?: string;
}

export interface ProductDoc {
  id?: string;
  name: string;
  sku: string;
  stock: number;
  stock_minimum: number;
  price: number;
  cost_price?: number;
}
