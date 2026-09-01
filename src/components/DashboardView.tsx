import React, { useState, useMemo, useEffect } from "react";
import { ProductDoc } from "../types";
import { 
  AlertTriangle, 
  Package, 
  Layers, 
  TrendingDown, 
  Plus, 
  Minus,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Calendar,
  ShoppingBag,
  Sparkles,
  Clock,
  Trash2
} from "lucide-react";
import { motion } from "motion/react";
import { doc, updateDoc, collection, addDoc, query, orderBy, onSnapshot, deleteDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface DashboardViewProps {
  products: ProductDoc[];
  storeId: string;
}

interface TransactionDoc {
  id?: string;
  tenantId: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  productId?: string;
  quantity?: number;
  timestamp: any;
}

export default function DashboardView({ products, storeId }: DashboardViewProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const formatNumberWithDots = (val: string) => {
    const raw = val.replace(/\D/g, "");
    if (!raw) return "";
    return Number(raw).toLocaleString("id-ID");
  };

  // Transaction form states
  const [txType, setTxType] = useState<"income" | "expense">("income");
  const [txAmount, setTxAmount] = useState<string>("");
  const [txDesc, setTxDesc] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("none");
  const [txQty, setTxQty] = useState<string>("1");
  const [savingTx, setSavingTx] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Transactions list state
  const [transactions, setTransactions] = useState<TransactionDoc[]>([]);
  const [txsLoading, setTxsLoading] = useState(true);

  // Quick Operational Log Modal states
  const [quickLogModal, setQuickLogModal] = useState<{
    isOpen: boolean;
    product: ProductDoc | null;
    type: "income" | "expense";
  }>({
    isOpen: false,
    product: null,
    type: "income"
  });

  const [quickAmount, setQuickAmount] = useState<string>("");
  const [quickQty, setQuickQty] = useState<string>("1");
  const [quickDesc, setQuickDesc] = useState<string>("");
  const [savingQuickTx, setSavingQuickTx] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  // Load transactions in real-time
  useEffect(() => {
    if (!storeId) {
      setTransactions([]);
      setTxsLoading(false);
      return;
    }

    setTxsLoading(true);
    const txColRef = collection(db, "stores", storeId, "transactions");
    const q = query(txColRef, orderBy("timestamp", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: TransactionDoc[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...(doc.data() as Omit<TransactionDoc, "id">) });
        });
        setTransactions(list);
        setTxsLoading(false);
      },
      (err) => {
        console.error("Real-time transactions feed error: ", err);
        setTxsLoading(false);
        handleFirestoreError(err, OperationType.GET, `stores/${storeId}/transactions`);
      }
    );

    return () => unsubscribe();
  }, [storeId]);

  // Reset/populate fields of Quick Log Modal on trigger
  useEffect(() => {
    if (quickLogModal.isOpen && quickLogModal.product) {
      const p = quickLogModal.product;
      const t = quickLogModal.type;
      
      setQuickQty("1");
      setQuickError(null);
      
      if (t === "income") {
        setQuickAmount(formatNumberWithDots(p.price.toString()));
        setQuickDesc(`Penjualan Produk Cepat: ${p.name}`);
      } else {
        const cost = p.cost_price ?? Math.round(p.price * 0.7);
        setQuickAmount(formatNumberWithDots(cost.toString()));
        setQuickDesc(`Restocking Produk Cepat: ${p.name}`);
      }
    }
  }, [quickLogModal]);

  // Adjust nominal dynamically on quick quantity changes for both types (using retail or cost prices)
  useEffect(() => {
    if (quickLogModal.isOpen && quickLogModal.product) {
      const p = quickLogModal.product;
      const qty = Number(quickQty) || 1;
      if (quickLogModal.type === "income") {
        setQuickAmount(formatNumberWithDots((p.price * qty).toString()));
      } else {
        const cost = p.cost_price ?? Math.round(p.price * 0.7);
        setQuickAmount(formatNumberWithDots((cost * qty).toString()));
      }
    }
  }, [quickQty, quickLogModal.isOpen, quickLogModal.product, quickLogModal.type]);

  // Trigger price recalculation if selected product or quantity changes
  useEffect(() => {
    if (selectedProductId !== "none") {
      const prod = products.find(p => p.id === selectedProductId);
      if (prod) {
        const qty = Number(txQty) || 1;
        if (txType === "income") {
          setTxAmount(formatNumberWithDots((prod.price * qty).toString()));
          if (!txDesc || txDesc === "" || txDesc.startsWith("Penjualan Produk:") || txDesc.startsWith("Restocking Produk:")) {
            setTxDesc(`Penjualan Produk: ${prod.name}`);
          }
        } else {
          const cost = prod.cost_price ?? Math.round(prod.price * 0.7);
          setTxAmount(formatNumberWithDots((cost * qty).toString()));
          if (!txDesc || txDesc === "" || txDesc.startsWith("Penjualan Produk:") || txDesc.startsWith("Restocking Produk:")) {
            setTxDesc(`Restocking Produk: ${prod.name}`);
          }
        }
      }
    }
  }, [txQty, selectedProductId, txType, products, txDesc]);

  // Client-side calculations & filtering
  const stats = useMemo(() => {
    const totalTypes = products.length;
    let totalStock = 0;
    let totalValue = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;

    const thinStockItems = products.filter(p => {
      totalStock += p.stock;
      totalValue += p.stock * p.price;
      
      if (p.stock === 0) {
        outOfStockCount++;
      }
      
      // stock <= stock_minimum condition
      const isLow = p.stock <= p.stock_minimum;
      if (isLow && p.stock > 0) {
        lowStockCount++;
      }
      
      return isLow;
    });

    return {
      totalTypes,
      totalStock,
      totalValue,
      outOfStockCount,
      lowStockCount,
      thinStockItems
    };
  }, [products]);

  // Direct seamless transaction for operational +/- buttons on the bottom table
  const handleFastDirectTransaction = async (product: ProductDoc, type: "income" | "expense") => {
    const qtyNum = 1;
    const priceUnit = type === "income" 
      ? product.price 
      : (product.cost_price ?? Math.round(product.price * 0.7));

    if (type === "income" && product.stock < qtyNum) {
      alert(`Stok tidak mencukupi untuk mencatat penjualan cepat item ${product.name}`);
      return;
    }

    const amountNum = priceUnit * qtyNum;
    const description = type === "income" 
      ? `Penjualan Cepat (Buku Tunai): ${product.name}` 
      : `Restocking Cepat (Buku Tunai): ${product.name}`;

    try {
      const txPayload: any = {
        tenantId: storeId,
        type: type,
        amount: amountNum,
        description: description,
        productId: product.id,
        quantity: qtyNum,
        timestamp: new Date()
      };

      await addDoc(collection(db, "stores", storeId, "transactions"), txPayload);

      const productRef = doc(db, "stores", storeId, "products", product.id!);
      const nextStock = type === "income"
        ? Math.max(0, product.stock - qtyNum)
        : product.stock + qtyNum;

      await updateDoc(productRef, { stock: nextStock });
    } catch (err) {
      console.error("Gagal melakukan transaksi instan:", err);
      alert("Gagal mencatat transaksi. Cek koneksi atau otorisasi tenant Anda.");
    }
  };

  // Handle saving transaction quickly inside the interactive Modal overlay
  const handleSaveQuickTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickError(null);

    if (!quickLogModal.product) return;

    // Clean any thousands separators like dots or commas typed by the user
    const cleanAmount = quickAmount.replace(/[.,\s]/g, "");
    const amountNum = Number(cleanAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setQuickError("Nominal transaksi harus berupa angka positif.");
      return;
    }

    const qtyNum = Number(quickQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setQuickError("Kuantitas produk harus berupa integer positif.");
      return;
    }

    // Safety guard for transaction sales stock boundaries
    if (quickLogModal.type === "income" && quickLogModal.product.stock < qtyNum) {
      setQuickError(`Jumlah penjualan (${qtyNum}) melebihi stok yang tersedia (${quickLogModal.product.stock}).`);
      return;
    }

    setSavingQuickTx(true);
    const path = `stores/${storeId}/transactions`;
    try {
      const txPayload: any = {
        tenantId: storeId,
        type: quickLogModal.type,
        amount: amountNum,
        description: quickDesc.trim() || (quickLogModal.type === "income" ? `Penjualan Produk Cepat: ${quickLogModal.product.name}` : `Restocking Produk Cepat: ${quickLogModal.product.name}`),
        productId: quickLogModal.product.id,
        quantity: qtyNum,
        timestamp: new Date()
      };

      await addDoc(collection(db, "stores", storeId, "transactions"), txPayload);

      // Adjust the product stock in Firestore, ensuring financial and operational alignment
      const productRef = doc(db, "stores", storeId, "products", quickLogModal.product.id!);
      const nextStock = quickLogModal.type === "income"
        ? Math.max(0, quickLogModal.product.stock - qtyNum)
        : quickLogModal.product.stock + qtyNum;

      await updateDoc(productRef, { stock: nextStock });

      setQuickLogModal({ isOpen: false, product: null, type: "income" });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setSavingQuickTx(false);
    }
  };

  // Submit Logger Transaction
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Clean any thousands separators (thousands dots/commas format)
    const cleanAmount = txAmount.replace(/[.,\s]/g, "");
    const amountNum = Number(cleanAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError("Nominal transaksi harus berupa angka positif.");
      return;
    }

    if (!txDesc.trim()) {
      setFormError("Keterangan transaksi tidak boleh kosong.");
      return;
    }

    const qtyNum = Number(txQty);
    if (selectedProductId !== "none") {
      if (isNaN(qtyNum) || qtyNum <= 0) {
        setFormError("Jumlah kuantitas produk harus berupa integer positif.");
        return;
      }

      // Check stock limits of product for income logs
      if (txType === "income") {
        const prod = products.find(p => p.id === selectedProductId);
        if (prod && prod.stock < qtyNum) {
          setFormError(`Kuantitas penjualan (${qtyNum}) melebihi stok produk yang tersedia (${prod.stock}).`);
          return;
        }
      }
    }

    setSavingTx(true);
    const path = `stores/${storeId}/transactions`;
    
    try {
      // 1. Save Transaction Doc
      const txPayload: any = {
        tenantId: storeId,
        type: txType,
        amount: amountNum,
        description: txDesc.trim(),
        timestamp: new Date()
      };

      if (selectedProductId !== "none") {
        txPayload.productId = selectedProductId;
        txPayload.quantity = qtyNum;
      }

      await addDoc(collection(db, "stores", storeId, "transactions"), txPayload);

      // 2. Automatically adjust corresponding product stock in Firestore 
      if (selectedProductId !== "none") {
        const prod = products.find(p => p.id === selectedProductId);
        if (prod) {
          const productRef = doc(db, "stores", storeId, "products", selectedProductId);
          const nextStock = txType === "income"
            ? Math.max(0, prod.stock - qtyNum)
            : prod.stock + qtyNum;
          await updateDoc(productRef, { stock: nextStock });
        }
      }

      // Reset form on success
      setTxAmount("");
      setTxDesc("");
      setSelectedProductId("none");
      setTxQty("1");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setSavingTx(false);
    }
  };

  // Delete logged transaction (with safety stock adjustments)
  const handleDeleteTransaction = async (tx: TransactionDoc) => {
    if (!tx.id) return;
    const confirmMsg = tx.productId
      ? tx.type === "income"
        ? "Apakah Anda yakin ingin menghapus transaksi ini? Stok produk yang dipotong sebelumnya akan dikembalikan otomatis."
        : "Apakah Anda yakin ingin menghapus transaksi ini? Stok produk yang ditambahkan sebelumnya akan dikurangi otomatis."
      : "Apakah Anda yakin ingin menghapus catatan transaksi ini?";

    if (!window.confirm(confirmMsg)) return;

    const path = `stores/${storeId}/transactions/${tx.id}`;
    try {
      const txRef = doc(db, "stores", storeId, "transactions", tx.id);
      await deleteDoc(txRef);

      // Restoring stock for deleted transactions to maintain operational inventory consistency
      if (tx.productId && tx.quantity) {
        const prod = products.find(p => p.id === tx.productId);
        if (prod) {
          const productRef = doc(db, "stores", storeId, "products", tx.productId);
          if (tx.type === "income") {
            await updateDoc(productRef, {
              stock: prod.stock + tx.quantity
            });
          } else if (tx.type === "expense") {
            await updateDoc(productRef, {
              stock: Math.max(0, prod.stock - tx.quantity)
            });
          }
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // 1. Filter Transactions specifically "Hari Ini"
  const todayTransactions = useMemo(() => {
    const todayStr = new Date().toDateString();
    return transactions.filter(tx => {
      if (!tx.timestamp) return false;
      const txDate = tx.timestamp.seconds 
        ? new Date(tx.timestamp.seconds * 1000) 
        : new Date(tx.timestamp);
      return txDate.toDateString() === todayStr;
    });
  }, [transactions]);

  // 2. Generate Past 7 Days Template
  const last7Days = useMemo(() => {
    const days = [];
    const locale = "id-ID";
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = d.toLocaleDateString(locale, { weekday: "short" });
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString(locale, { month: "short" });
      days.push({
        dateStr: d.toDateString(),
        label: `${dayName}, ${dayNum} ${monthName}`,
        income: 0,
        expense: 0
      });
    }
    return days;
  }, []);

  // 3. Populate past 7 Days Weekly Cashflow Data
  const chartData = useMemo(() => {
    const daysData = last7Days.map(d => ({ ...d }));

    transactions.forEach(tx => {
      if (!tx.timestamp) return;
      
      const txDate = tx.timestamp.seconds 
        ? new Date(tx.timestamp.seconds * 1000) 
        : new Date(tx.timestamp);
        
      const txDateStr = txDate.toDateString();
      const matchedDay = daysData.find(d => d.dateStr === txDateStr);
      
      if (matchedDay) {
        if (tx.type === "income") {
          matchedDay.income += tx.amount || 0;
        } else {
          matchedDay.expense += tx.amount || 0;
        }
      }
    });

    return daysData;
  }, [transactions, last7Days]);

  // 4. Bestselling Product of the Week (Top 1 Barang Terlaris 7 hari terakhir)
  const bestsellingProduct = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const productSales: { [prodId: string]: number } = {};

    transactions.forEach(tx => {
      if (tx.type !== "income" || !tx.productId) return;

      const txDate = tx.timestamp?.seconds 
        ? new Date(tx.timestamp.seconds * 1000) 
        : new Date(tx.timestamp || "");

      if (txDate >= sevenDaysAgo) {
        const qty = Number(tx.quantity) || 0;
        productSales[tx.productId] = (productSales[tx.productId] || 0) + qty;
      }
    });

    let bestProdId: string | null = null;
    let maxQty = 0;

    Object.entries(productSales).forEach(([prodId, qty]) => {
      if (qty > maxQty) {
        maxQty = qty;
        bestProdId = prodId;
      }
    });

    if (!bestProdId) return null;

    const matchedProduct = products.find(p => p.id === bestProdId);
    if (!matchedProduct) {
      return {
        id: bestProdId,
        name: "Produk Terhapus",
        sku: "-",
        price: 0,
        totalSold: maxQty
      };
    }

    return {
      ...matchedProduct,
      totalSold: maxQty
    };
  }, [transactions, products]);

  // Format Y Axis for Recharts with smart unit identifiers
  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1)}jt`;
    if (value >= 1000) return `Rp ${(value / 1000).toFixed(0)}rb`;
    return `Rp ${value}`;
  };

  return (
    <>
      <div className="space-y-6 animate-fade-in bg-[#121212] min-h-screen text-white rounded-[16px]" id="dashboard-container">
      
      {/* Overview stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-dashboard-grid">
        
        {/* Total Jenis Produk Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1E1E1E] border border-[#2C2C2E] rounded-2xl p-5 transition-all duration-200 hover:border-indigo-500/30 flex items-center justify-between"
          id="stat-card-types"
        >
          <div>
            <span className="text-xs font-semibold text-[#8C8C8E] uppercase tracking-wider block">Total Varian Produk</span>
            <span className="text-3xl font-bold tracking-tight font-mono text-indigo-400 mt-2 block">{stats.totalTypes}</span>
            <span className="text-[11px] text-[#8C8C8E] mt-1 block">Varian produk terdaftar</span>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
            <Layers className="h-6 w-6" />
          </div>
        </motion.div>

        {/* Total Kuantitas Stok Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[#1E1E1E] border border-[#2C2C2E] rounded-2xl p-5 transition-all duration-200 hover:border-indigo-500/30 flex items-center justify-between"
          id="stat-card-total-stock relative"
        >
          <div>
            <span className="text-xs font-semibold text-[#8C8C8E] uppercase tracking-wider block">Total Unit Stok</span>
            <span className="text-3xl font-bold tracking-tight font-mono text-indigo-400 mt-2 block">{stats.totalStock}</span>
            <span className="text-[11px] text-[#8C8C8E] mt-1 block">Total kuantitas fisik di toko</span>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
            <Package className="h-6 w-6" />
          </div>
        </motion.div>

        {/* Peringatan Stok Menipis Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#1E1E1E] border border-[#2C2C2E] rounded-2xl p-5 transition-all duration-200 hover:border-amber-500/30 flex items-center justify-between"
          id="stat-card-low-stock"
        >
          <div>
            <span className="text-xs font-semibold text-[#8C8C8E] uppercase tracking-wider block">Stok Menipis</span>
            <span className="text-3xl font-bold tracking-tight font-mono text-amber-400 mt-2 block">
              {stats.lowStockCount}
            </span>
            <span className="text-[11px] text-[#8C8C8E] mt-1 block">Mencapai batas minimum</span>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </motion.div>

        {/* Habis Total Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[#1E1E1E] border border-[#2C2C2E] rounded-2xl p-5 transition-all duration-200 hover:border-rose-500/30 flex items-center justify-between"
          id="stat-card-out-of-stock"
        >
          <div>
            <span className="text-xs font-semibold text-[#8C8C8E] uppercase tracking-wider block">Stok Habis (0)</span>
            <span className="text-3xl font-bold tracking-tight font-mono text-rose-400 mt-2 block">
              {stats.outOfStockCount}
            </span>
            <span className="text-[11px] text-[#8C8C8E] mt-1 block">Perlu segera restok</span>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl">
            <TrendingDown className="h-6 w-6" />
          </div>
        </motion.div>
      </div>

      {/* Extra helper financial banner card */}
      <div className="bg-[#1E1E1E] border border-[#2C2C2E] rounded-2xl p-5 transition-all duration-200 hover:border-indigo-500/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" id="store-value-banner">
        <div>
          <h4 className="text-sm font-bold tracking-tight text-white">Total Valuasi Aset Inventaris Toko</h4>
          <p className="text-xs text-[#8C8C8E] mt-0.5">Akumulasi nilai riil seluruh unit produk berdasarkan harga jual</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-4 py-2 bg-[#121212] border border-slate-800 text-indigo-400 font-bold font-mono tracking-tight text-base rounded-xl">
            Rp {stats.totalValue.toLocaleString("id-ID")}
          </span>
        </div>
      </div>

      {/* FINANCIAL LOGGER & TREND ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="financial-logger-trends-grid">
        
        {/* Logger Card Form - Left Column (5/12 width) */}
        <div className="lg:col-span-5 bg-gradient-to-b from-[#1E1E1E] to-[#161618] border border-[#2C2C2E] rounded-2xl p-6 transition-all duration-300 hover:border-indigo-500/30 flex flex-col justify-between" id="transaction-logger-panel">
          <div>
            <div className="flex items-center gap-3 mb-5 pb-3 border-b border-[#2C2C2E]/60" id="tx-log-header">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-white">Catat Transaksi Kas</h3>
                <p className="text-[11px] text-[#8C8C8E] mt-0.5">Input mutasi stok sekaligus arus kas toko</p>
              </div>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-4" id="tx-log-form">
              {/* Type Switcher */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8E] block mb-2">Tipe Transaksi</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#121212] border border-[#2C2C2E] rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setTxType("income");
                      setSelectedProductId("none");
                    }}
                    className={`py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                      txType === "income" 
                        ? "bg-indigo-600 text-white shadow-sm font-bold" 
                        : "text-[#8C8C8E] hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Pemasukan (Jual)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTxType("expense");
                      setSelectedProductId("none");
                    }}
                    className={`py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                      txType === "expense" 
                        ? "bg-rose-600 text-white shadow-sm font-bold" 
                        : "text-[#8C8C8E] hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <Minus className="h-3.5 w-3.5" /> Pengeluaran (Belanja)
                    </span>
                  </button>
                </div>
              </div>

              {/* Tautkan Produk (Hanya untuk Pemasukan/Pengeluaran) */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8E] block mb-2 flex items-center justify-between">
                  <span>Hubungkan ke Produk</span>
                  <span className="text-[10px] text-[#8C8C8E]/70 font-normal italic">opsional</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedProductId(val);
                      if (val === "none") {
                        setTxDesc("");
                        setTxAmount("");
                      }
                    }}
                    className="w-full text-xs rounded-xl border border-[#2C2C2E] pl-3 pr-8 py-2.5 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-[#121212] transition-all duration-200 appearance-none cursor-pointer"
                  >
                    <option value="none" className="bg-[#1E1E1E]">
                      {txType === "income" ? "Bukan dari Penjualan Produk (Manual)" : "Bukan untuk Restocking Produk (Manual)"}
                    </option>
                    {products.map(p => (
                      <option key={p.id} value={p.id} className="bg-[#1E1E1E]">
                        {p.name} (Stok: {p.stock} | Rp {p.price.toLocaleString("id-ID")})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#8C8C8E]">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Grid for Quantity & Price */}
              <div className="grid grid-cols-2 gap-3.5">
                {/* Quantity - Show only if Product is selected */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8E] block mb-2">
                    Kuantitas
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      disabled={selectedProductId === "none"}
                      value={txQty}
                      onChange={(e) => setTxQty(e.target.value)}
                      className="w-full text-xs font-mono rounded-xl border border-[#2C2C2E] pl-3 pr-8 py-2.5 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-[#121212] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      placeholder="1"
                    />
                    {selectedProductId === "none" && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#8C8C8E]/40" title="Pilih produk dahulu">
                        🔒
                      </div>
                    )}
                  </div>
                </div>

                {/* Amount (Nominal) */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8E] block mb-2 font-sans">
                    Nominal (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-[#8C8C8E]/85 select-none pointer-events-none">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      disabled={false}
                      value={txAmount}
                      onChange={(e) => setTxAmount(formatNumberWithDots(e.target.value))}
                      placeholder="32.500"
                      className="w-full text-xs font-mono rounded-xl border border-[#2C2C2E] pl-9 pr-3 py-2.5 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-[#121212] transition-all duration-200 disabled:opacity-75 placeholder-[#8C8C8E]/40"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8E] block mb-2">
                  Keterangan Transaksi
                </label>
                <input
                  type="text"
                  required
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  placeholder={txType === "income" ? "Contoh: Penjualan kopi susu" : "Contoh: Pembelian cup & sedotan"}
                  className="w-full text-xs rounded-xl border border-[#2C2C2E] px-3.5 py-2.5 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-[#121212] transition-all duration-200 placeholder-[#8C8C8E]/40"
                />
              </div>

              {formError && (
                <div className="p-3 bg-rose-950/30 text-rose-300 text-xs rounded-xl font-medium border border-rose-900/30 flex items-center gap-2 animate-fade-in">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingTx}
                className={`w-full py-3 mt-3 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shadow-md transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                  txType === "income" 
                    ? "bg-indigo-600 text-white hover:bg-indigo-500" 
                    : "bg-rose-600 text-white hover:bg-rose-500"
                }`}
              >
                {savingTx ? (
                  <>Menyimpan...</>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Simpan Transaksi ({txType === "income" ? "Masuk" : "Keluar"})
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Real-time Listing and Bestselling badge - Right Column (7/12 width) */}
        <div className="lg:col-span-7 space-y-6 flex flex-col justify-start" id="financial-feed-panel">
          
          {/* BESTSELLING PRODUCT CARD OF THE WEEK */}
          <div 
            className="bg-[#1E1E1E] border border-indigo-500/30 rounded-2xl p-5 relative overflow-hidden group shadow-lg" 
            id="bestselling-product-card"
          >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
              <ShoppingBag className="h-40 w-40 text-indigo-400" />
            </div>

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">Produk Terlaris Minggu Ini</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-[#121212] border border-[#2C2C2E] text-[#8C8C8E] rounded-lg">
                7 Hari Terakhir
              </span>
            </div>

            {bestsellingProduct ? (
              <div className="mt-4 relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" id="bestseller-detail">
                <div>
                  <h4 className="text-base font-bold tracking-tight text-white">{bestsellingProduct.name}</h4>
                  <div className="text-xs text-[#8C8C8E] mt-1 font-mono flex flex-wrap items-center gap-x-2">
                    <span>SKU: {bestsellingProduct.sku}</span>
                    <span>•</span>
                    <span>Harga Jual: Rp {bestsellingProduct.price.toLocaleString("id-ID")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-left sm:text-right">
                    <span className="text-xl font-bold text-indigo-400 font-mono block">{bestsellingProduct.totalSold} Unit Terjual</span>
                    <span className="text-xs text-[#8C8C8E] block font-sans">Omzet: Rp {(bestsellingProduct.totalSold * bestsellingProduct.price).toLocaleString("id-ID")}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3.5 text-[#8C8C8E] text-xs py-1 relative z-10 font-sans">
                Belum ada transaksi penjualan produk yang dicatat dalam 7 hari terakhir.
              </div>
            )}
          </div>

          {/* RIWAYAT TRANSAKSI HARI INI */}
          <div className="bg-[#1E1E1E] border border-[#2C2C2E] rounded-[16px] p-5 flex-1 flex flex-col min-h-[268px]" id="today-transactions-feed">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#2C2C2E]" id="today-tx-header">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#8C8C8E]" />
                <h3 className="text-[15px] font-bold tracking-[-0.03em] text-white">Riwayat Transaksi Hari Ini</h3>
              </div>
              <span className="text-[10px] px-2.5 py-1 bg-[#121212] border border-[#2C2C2E] text-[#8C8C8E] rounded-[6px] font-mono font-bold">
                {todayTransactions.length} Transaksi
              </span>
            </div>

            {txsLoading ? (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-450" id="txs-loading-state">
                <div className="animate-spin h-4 w-4 border-2 border-[#00E5FF] border-t-transparent rounded-full mr-2"></div>
                Memuat data transaksi...
              </div>
            ) : todayTransactions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#121212] rounded-xl border border-dashed border-[#2C2C2E]" id="txs-empty-state">
                <Calendar className="h-7 w-7 text-[#6B6B6B] mb-1" />
                <span className="text-xs font-semibold text-[#8C8C8E] block">Belum Ada Transaksi</span>
                <span className="text-[10px] text-[#6B6B6B] block mt-0.5">Catat pemasukan atau pengeluaran kas pertamamu hari ini di panel kiri.</span>
              </div>
            ) : (
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1" id="txs-scrollable">
                {todayTransactions.map((tx) => {
                  const isIncome = tx.type === "income";
                  const txDate = tx.timestamp?.seconds 
                    ? new Date(tx.timestamp.seconds * 1000) 
                    : new Date(tx.timestamp);
                  const timeStr = txDate?.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) || "--:--";

                  return (
                    <div 
                      key={tx.id} 
                      className="p-3 bg-[#121212] hover:bg-[#252525] border border-[#2C2C2E]/60 rounded-xl flex items-center justify-between gap-3 group transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`p-2 rounded-lg shrink-0 ${isIncome ? "bg-[#32D74B]/15 text-[#32D74B]" : "bg-[#FF453A]/15 text-[#FF453A]"}`}>
                          {isIncome ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block truncate">{tx.description}</span>
                          <span className="text-[10px] text-[#8C8C8E] block font-mono">
                            Jam {timeStr}
                            {tx.quantity && tx.quantity > 0 && ` • Kuantitas: ${tx.quantity}`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-bold font-mono ${isIncome ? "text-[#32D74B]" : "text-[#FF453A]"}`}>
                          {isIncome ? "+" : "-"}Rp {tx.amount.toLocaleString("id-ID")}
                        </span>
                        <button
                          onClick={() => handleDeleteTransaction(tx)}
                          className="p-1 hover:bg-rose-950/30 text-[#8C8C8E] hover:text-[#FF453A] rounded transition-colors cursor-pointer"
                          title="Hapus Transaksi"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WEEKLY TRENDS GRAPH CONTAINER */}
      <div className="bg-[#1E1E1E] border border-[#2C2C2E] rounded-2xl p-6 transition-all duration-200 hover:border-indigo-500/30" id="weekly-trends-chart-panel">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-2 border-b border-[#2C2C2E]" id="weekly-trends-header">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2 font-sans">
              <Calendar className="h-4.5 w-4.5 text-indigo-400" />
              Tren Arus Kas Mingguan
            </h3>
            <p className="text-xs text-[#8C8C8E] mt-0.5">Analisis visual pemasukan (penjualan) vs pengeluaran operasional</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-white">
              <span className="h-2.5 w-2.5 bg-indigo-500 rounded-full"></span> Pemasukan
            </span>
            <span className="flex items-center gap-1.5 text-white">
              <span className="h-2.5 w-2.5 bg-rose-500 rounded-full"></span> Pengeluaran
            </span>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#8C8C8E] bg-[#121212] rounded-xl border border-dashed border-[#2C2C2E]">
            Arus kas akan ditampilkan setelah Anda merekam transaksi pertama di atas.
          </div>
        ) : (
          <div className="h-[280px] w-full" id="recharts-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2C2C2E" />
                <XAxis 
                  dataKey="label" 
                  tickLine={false} 
                  axisLine={false} 
                  stroke="#8C8C8E" 
                  style={{ fontSize: "10px", fontFamily: "sans-serif" }} 
                />
                <YAxis 
                  tickFormatter={formatYAxis}
                  tickLine={false} 
                  axisLine={false} 
                  stroke="#8C8C8E" 
                  style={{ fontSize: "10px", fontFamily: "sans-serif" }} 
                />
                <Tooltip 
                  formatter={(val: number) => [`Rp ${val.toLocaleString("id-ID")}`, ""]}
                  contentStyle={{ backgroundColor: "#1E1E1E", border: "1px solid #2C2C2E", borderRadius: "12px", color: "#ffffff", fontSize: "11px" }}
                  labelStyle={{ fontWeight: "bold", marginBottom: "4px", color: "#ffffff" }}
                />
                <Area 
                  type="monotone" 
                  dataKey="income" 
                  name="Pemasukan"
                  stroke="#6366F1" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorIncome)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="expense" 
                  name="Pengeluaran"
                  stroke="#F43F5E" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorExpense)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Peringatan Stok Menipis Section (Client-Side Filtering) */}
      <div className="bg-[#1E1E1E] border border-[#2C2C2E] rounded-2xl p-6 transition-all duration-200 hover:border-amber-500/30" id="alerts-section">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#2C2C2E]" id="alerts-heading-panel">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2 font-sans">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-400" />
              Peringatan Stok Menipis
            </h3>
            <p className="text-xs text-[#8C8C8E] mt-0.5">Daftar item dengan kuantitas saat ini berada di bawah batas minimum</p>
          </div>
          <span className="text-xs px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold rounded-lg">
            {stats.thinStockItems.length} Produk Perlu Restok
          </span>
        </div>

        {stats.thinStockItems.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center space-y-2 bg-[#121212] rounded-xl border border-dashed border-[#2C2C2E]" id="alerts-empty-state">
            <CheckCircle2 className="h-9 w-9 text-emerald-400" />
            <h4 className="text-sm font-semibold text-white">Persediaan Sangat Baik</h4>
            <p className="text-xs text-[#8C8C8E] max-w-sm">Semua item berada di tingkat aman di atas batas stok minimum.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#2C2C2E] bg-[#121212]" id="alerts-table-scroll">
            <table className="w-full text-left border-collapse" id="alerts-products-table">
              <thead>
                <tr className="bg-slate-900/60 border-b border-[#2C2C2E] text-[11px] font-bold text-[#8C8C8E] uppercase tracking-wider">
                  <th className="py-3 px-4">Nama Produk</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4 text-center">Batas Minimum</th>
                  <th className="py-3 px-4 text-center">Stok Saat Ini</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2C2C2E] text-xs">
                {stats.thinStockItems.map((product) => {
                  const isOutOfStock = product.stock === 0;
                  return (
                    <tr 
                      key={product.id} 
                      className={`hover:bg-slate-900/40 transition-colors ${
                        isOutOfStock ? "bg-rose-950/20 text-rose-300" : "bg-amber-950/15"
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-white">
                        {product.name}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-[#8C8C8E]">
                        {product.sku}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-[#8C8C8E]">
                        {product.stock_minimum}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`font-mono font-bold px-2.5 py-0.5 rounded-md ${
                          isOutOfStock ? "text-rose-400 bg-rose-500/15 border border-rose-500/20" : "text-amber-400 bg-amber-500/15 border border-amber-500/20"
                        }`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md">
                            HABIS TOTAL
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 text-amber-400 bg-amber-400/10 border border-amber-500/20 rounded-md">
                            MENIPIS
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>

      {/* QUICK OPERATIONAL LOG MODAL */}
      {quickLogModal.isOpen && quickLogModal.product && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] border border-[#2C2C2E] rounded-[16px] max-w-md w-full p-6 shadow-2xl relative overflow-hidden text-left text-white">
            <div className="flex items-center gap-3 pb-3 border-b border-[#2C2C2E] mb-4">
              <div className={`p-2 rounded-xl text-black ${quickLogModal.type === "income" ? "bg-[#32D74B]" : "bg-[#00E5FF]"}`}>
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Aksi Cepat Log Operasional</h3>
                <p className="text-xs text-[#8C8C8E] mt-0.5">Sinkronisasi keuangan & persediaan unit real-time</p>
              </div>
            </div>

            <form onSubmit={handleSaveQuickTransaction} className="space-y-4">
              {quickError && (
                <div className="p-3 bg-rose-950/40 text-[#FF453A] text-xs rounded-xl font-medium border border-rose-900/30 flex items-center gap-1.5 animate-shake">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{quickError}</span>
                </div>
              )}

              <div className="p-3 bg-[#121212] border border-[#2C2C2E] rounded-xl leading-relaxed text-xs">
                <div className="grid grid-cols-2 gap-2 text-[#8C8C8E]">
                  <div>
                    <span className="block font-medium">Produk</span>
                    <strong className="text-white font-bold block mt-0.5 truncate">{quickLogModal.product.name}</strong>
                  </div>
                  <div>
                    <span className="block font-medium">Stok Saat Ini</span>
                    <span className="font-mono text-[#00E5FF] font-bold block mt-0.5">{quickLogModal.product.stock} Unit</span>
                  </div>
                </div>
              </div>

              {/* Transaction Type Display */}
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#8C8C8E] block mb-1">Tipe Log</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 font-bold text-xs rounded-lg uppercase tracking-wide border ${
                  quickLogModal.type === "income" 
                    ? "bg-[#32D74B]/10 border-[#32D74B]/20 text-[#32D74B]" 
                    : "bg-[#00E5FF]/10 border-[#00E5FF]/20 text-[#00E5FF]"
                }`}>
                  {quickLogModal.type === "income" ? "Pemasukan (Log Penjualan)" : "Pengeluaran (Log Restocking)"}
                </span>
              </div>

              {/* Grid for Quick Qty and Quick Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#8C8C8E] mb-1">Kuantitas Unit</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quickQty}
                    onChange={(e) => setQuickQty(e.target.value)}
                    className="w-full text-xs p-2.5 bg-[#121212] border border-[#2C2C2E] rounded-xl font-mono focus:ring-1 focus:ring-[#00E5FF]/25 focus:outline-none transition-all text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#8C8C8E] mb-1">Nominal Tunai (Rp)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    disabled={false}
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(formatNumberWithDots(e.target.value))}
                    placeholder="Contoh: 15.000"
                    className="w-full text-xs p-2.5 bg-[#121212] border border-[#2C2C2E] rounded-xl font-mono focus:ring-1 focus:ring-[#00E5FF]/25 focus:outline-none transition-all text-white disabled:opacity-75"
                  />
                  <span className="text-[10px] text-[#8C8C8E] mt-1 block italic font-normal">Dihitung otomatis berdasar harga modal/jual, namun bebas disesuaikan</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8C8C8E] mb-1">Keterangan Transaksi</label>
                <input
                  type="text"
                  required
                  value={quickDesc}
                  onChange={(e) => setQuickDesc(e.target.value)}
                  className="w-full text-xs p-2.5 bg-[#121212] border border-[#2C2C2E] rounded-xl focus:ring-1 focus:ring-[#00E5FF]/25 focus:outline-none transition-all text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#2C2C2E]">
                <button
                  type="button"
                  onClick={() => setQuickLogModal({ isOpen: false, product: null, type: "income" })}
                  className="px-3.5 py-2 text-xs font-semibold text-[#8C8C8E] hover:text-white hover:bg-[#252525] rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingQuickTx}
                  className={`px-4 py-2 text-xs font-bold text-black rounded-xl transition-all shadow-md cursor-pointer ${
                    quickLogModal.type === "income" 
                      ? "bg-[#32D74B] hover:bg-[#32D74B]/90" 
                      : "bg-[#00E5FF] hover:bg-[#00E5FF]/90"
                  }`}
                >
                  {savingQuickTx ? "Memproses..." : "Simpan & Sinkron"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
