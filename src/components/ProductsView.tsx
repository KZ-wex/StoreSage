import React, { useState, useTransition } from "react";
import { ProductDoc } from "../types";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Package, 
  Search, 
  X, 
  Save, 
  AlertCircle,
  FileSpreadsheet,
  Check
} from "lucide-react";
import { doc, addDoc, collection, deleteDoc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";

interface ProductsViewProps {
  products: ProductDoc[];
  storeId: string;
}

export default function ProductsView({ products, storeId }: ProductsViewProps) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Form fields
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [stock, setStock] = useState("");
  const [stockMinimum, setStockMinimum] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");

  // Edit states
  const [editingProduct, setEditingProduct] = useState<ProductDoc | null>(null);
  const [editName, setEditName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editStockMinimum, setEditStockMinimum] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");

  // Custom iframe-friendly popup & feedback states
  const [productToDelete, setProductToDelete] = useState<ProductDoc | null>(null);
  const [editValidationError, setEditValidationError] = useState<string | null>(null);

  // Helper formatting for localized thousand dots typing
  const formatNumberWithDots = (val: string) => {
    const raw = val.replace(/\D/g, "");
    if (!raw) return "";
    return Number(raw).toLocaleString("id-ID");
  };

  const parseNumberFromDots = (val: string) => {
    const raw = val.replace(/\D/g, "");
    return Number(raw) || 0;
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const rawStock = parseNumberFromDots(stock);
    const rawStockMin = parseNumberFromDots(stockMinimum);
    const rawCostPrice = parseNumberFromDots(costPrice);
    const rawPrice = parseNumberFromDots(price);

    if (!name.trim() || !sku.trim() || stock === "" || stockMinimum === "" || price === "" || costPrice === "") {
      setFormError("Semua form wajib diisi!");
      return;
    }

    const payload: Omit<ProductDoc, "id"> = {
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      stock: rawStock,
      stock_minimum: rawStockMin,
      price: rawPrice,
      cost_price: rawCostPrice
    };

    const path = `stores/${storeId}/products`;

    startTransition(async () => {
      try {
        const prodColRef = collection(db, "stores", storeId, "products");
        await addDoc(prodColRef, payload);
         
        // Reset form
        setName("");
        setSku("");
        setStock("");
        setStockMinimum("");
        setPrice("");
        setCostPrice("");
      } catch (err) {
        setFormError("Gagal menambahkan produk. Cek aturan keamanan atau format SKU.");
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    });
  };

  const triggerDeleteProduct = (p: ProductDoc) => {
    setProductToDelete(p);
  };

  const executeDeleteProduct = async (prodId: string) => {
    const path = `stores/${storeId}/products/${prodId}`;
    try {
      const productDocRef = doc(db, "stores", storeId, "products", prodId);
      await deleteDoc(productDocRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleStartEdit = (p: ProductDoc) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditSku(p.sku);
    setEditStockMinimum((p.stock_minimum ?? 0).toString());
    setEditPrice((p.price ?? 0).toLocaleString("id-ID"));
    setEditCostPrice((p.cost_price ?? 0).toLocaleString("id-ID"));
    setEditValidationError(null);
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setEditValidationError(null);
  };

  const handleUpdateProduct = async (prodId: string) => {
    if (!editingProduct) return;
    setEditValidationError(null);

    const rawEditStockMin = parseNumberFromDots(editStockMinimum);
    const rawEditPrice = parseNumberFromDots(editPrice);
    const rawEditCostPrice = parseNumberFromDots(editCostPrice);

    if (!editName.trim() || !editSku.trim() || editStockMinimum === "" || editPrice === "" || editCostPrice === "") {
      setEditValidationError("Form edit tidak boleh kosong!");
      return;
    }

    const path = `stores/${storeId}/products/${prodId}`;
    try {
      const productDocRef = doc(db, "stores", storeId, "products", prodId);
      await updateDoc(productDocRef, {
        name: editName.trim(),
        sku: editSku.trim().toUpperCase(),
        stock_minimum: rawEditStockMin,
        price: rawEditPrice,
        cost_price: rawEditCostPrice
      });
      setEditingProduct(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  // Filter products based on search query
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 text-white" id="products-view-root">
      
      {/* 1. Form Tambah Produk */}
      <div className="xl:col-span-1" id="add-product-panel">
        <div className="bg-[#1E1E1E] border border-[#2C2C2E] rounded-2xl p-6 transition-all duration-200 hover:border-indigo-500/30 sticky top-4">
          <div className="mb-5 pb-3 border-b border-[#2C2C2E] flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold tracking-tight text-white text-base">Tambah Produk Baru</h3>
              <p className="text-xs text-[#8C8C8E] mt-0.5">Daftarkan item baru ke inventaris toko</p>
            </div>
          </div>

          <form onSubmit={handleCreateProduct} className="space-y-4" id="add-product-form">
            {formError && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl flex items-start gap-2 text-xs text-rose-300" id="form-error-banner">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Nama Produk</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="cth. Kopi Arabika Premium 250g"
                className="w-full text-white text-sm px-3.5 py-2.5 bg-[#121212] border border-[#2C2C2E] rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-sans"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">SKU / Kode Barang</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="cth. KOP-ARA-01"
                className="w-full text-white text-sm px-3.5 py-2.5 bg-[#121212] border border-[#2C2C2E] rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono uppercase"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Stok Awal</label>
                <input
                  type="text"
                  value={stock}
                  onChange={(e) => setStock(formatNumberWithDots(e.target.value))}
                  placeholder="0"
                  className="w-full text-white text-sm px-3.5 py-2.5 bg-[#121212] border border-[#2C2C2E] rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Batas Minimum</label>
                <input
                  type="text"
                  value={stockMinimum}
                  onChange={(e) => setStockMinimum(formatNumberWithDots(e.target.value))}
                  placeholder="5"
                  className="w-full text-white text-sm px-3.5 py-2.5 bg-[#121212] border border-[#2C2C2E] rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Harga Modal (Rp)</label>
                <input
                  type="text"
                  value={costPrice}
                  onChange={(e) => setCostPrice(formatNumberWithDots(e.target.value))}
                  placeholder="25.000"
                  className="w-full text-white text-sm px-3.5 py-2.5 bg-[#121212] border border-[#2C2C2E] rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Harga Jual (Rp)</label>
                <input
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(formatNumberWithDots(e.target.value))}
                  placeholder="35.000"
                  className="w-full text-white text-sm px-3.5 py-2.5 bg-[#121212] border border-[#2C2C2E] rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl py-3 text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              <Plus className="h-4 w-4" />
              {isPending ? "Menyimpan..." : "Simpan Produk"}
            </button>
          </form>
        </div>
      </div>

      {/* 2. Tabel List Produk Realtime */}
      <div className="xl:col-span-2" id="products-table-panel">
        <div className="bg-[#1E1E1E] border border-[#2C2C2E] rounded-2xl p-6 transition-all duration-200 hover:border-indigo-500/30">
          
          {/* Table Header Filter controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#2C2C2E]" id="products-list-header">
            <div>
              <h3 className="font-bold tracking-tight text-white text-base flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-400" />
                Daftar Produk Toko
              </h3>
              <p className="text-xs text-[#8C8C8E] mt-0.5">Kelola data harga jual, modal, kode SKU, dan kontrol stok minimum</p>
            </div>
            
            <div className="flex items-center gap-2 self-start md:self-auto w-full md:w-auto">
              <div className="relative flex-1 md:w-56 text-[#8C8C8E]">
                <Search className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari nama atau SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-[#121212] border border-[#2C2C2E] rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-white"
                />
              </div>
            </div>
          </div>

          {/* Actual Catalog Table */}
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center space-y-3 bg-[#121212] rounded-xl border border-dashed border-[#2C2C2E]" id="products-empty-state">
              <Package className="h-12 w-12 text-slate-600" />
              <h4 className="text-sm font-semibold text-white">Tidak Ada Produk</h4>
              <p className="text-xs text-[#8C8C8E] max-w-xs leading-relaxed">
                {searchQuery ? "Kueri pencarian tidak cocok dengan item yang tersedia." : "Mulai dengan mengisi formulir di samping untuk menambahkan produk perdana."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#2C2C2E] bg-[#121212]" id="catalog-scroll">
              <table className="w-full text-left border-collapse" id="catalog-products-table">
                <thead>
                  <tr className="bg-slate-900/60 border-b border-[#2C2C2E] text-[11px] font-bold text-[#8C8C8E] uppercase tracking-wider">
                    <th className="py-3 px-4">Detail Produk</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4 text-right">Harga Modal</th>
                    <th className="py-3 px-4 text-right">Harga Jual</th>
                    <th className="py-3 px-4 text-center">Stok / Minimum</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C2C2E] text-xs">
                  {filteredProducts.map((p) => {
                    const isEditing = editingProduct?.id === p.id;
                    const isLowStock = p.stock <= p.stock_minimum;
 
                    return (
                      <tr 
                        key={p.id} 
                        className={`hover:bg-slate-900/50 transition-colors ${
                          isLowStock ? (p.stock === 0 ? "bg-rose-950/20 text-rose-300" : "bg-amber-950/15 text-amber-200") : ""
                        }`}
                      >
                        {/* Name Column */}
                        <td className="py-3.5 px-4 font-medium text-white">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full p-1.5 bg-[#121212] border border-[#2C2C2E] text-xs rounded-lg font-sans text-white outline-none focus:border-indigo-500"
                            />
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-bold text-white">{p.name}</span>
                              {isLowStock && (
                                <span className={`text-[10px] font-bold flex items-center gap-0.5 mt-0.5 ${p.stock === 0 ? "text-rose-400" : "text-amber-400"}`}>
                                  ⚠️ {p.stock === 0 ? "Stok habis (0)" : "Stok menipis"}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
 
                        {/* SKU Column */}
                        <td className="py-3.5 px-4 text-xs font-mono text-[#8C8C8E]">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editSku}
                              onChange={(e) => setEditSku(e.target.value)}
                              className="w-full p-1.5 bg-[#121212] border border-[#2C2C2E] text-xs rounded-lg font-mono uppercase text-white outline-none focus:border-indigo-500"
                            />
                          ) : (
                            <span>{p.sku}</span>
                          )}
                        </td>
 
                        {/* Harga Modal Column */}
                        <td className="py-3.5 px-4 text-right font-mono text-[#8C8C8E]">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-end">
                              <span className="text-xs text-[#8C8C8E]">Rp</span>
                              <input
                                type="text"
                                value={editCostPrice}
                                onChange={(e) => setEditCostPrice(formatNumberWithDots(e.target.value))}
                                className="w-24 p-1.5 bg-[#121212] border border-[#2C2C2E] text-right text-xs rounded-lg text-white outline-none focus:border-indigo-500"
                              />
                            </div>
                          ) : (
                            <span>Rp {(p.cost_price ?? 0).toLocaleString("id-ID")}</span>
                          )}
                        </td>
 
                        {/* Harga Jual Column */}
                        <td className="py-3.5 px-4 text-right font-mono text-white font-bold">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-end">
                              <span className="text-xs text-[#8C8C8E]">Rp</span>
                              <input
                                type="text"
                                value={editPrice}
                                onChange={(e) => setEditPrice(formatNumberWithDots(e.target.value))}
                                className="w-24 p-1.5 bg-[#121212] border border-[#2C2C2E] text-right text-xs rounded-lg text-white outline-none focus:border-indigo-500"
                              />
                            </div>
                          ) : (
                            <span className="text-indigo-300">Rp {p.price.toLocaleString("id-ID")}</span>
                          )}
                        </td>
 
                        {/* Stock / Minimum Column - No editing stock directly */}
                        <td className="py-3.5 px-4 text-center">
                          {isEditing ? (
                            <div className="flex flex-col items-center justify-center gap-1 text-[#8C8C8E]">
                              <span className="text-[9px] font-bold uppercase tracking-wider">Minimal</span>
                              <input
                                type="text"
                                value={editStockMinimum}
                                onChange={(e) => setEditStockMinimum(formatNumberWithDots(e.target.value))}
                                className="w-20 p-1.5 bg-[#121212] border border-[#2C2C2E] text-center text-xs rounded-lg font-mono text-white outline-none focus:border-indigo-500"
                              />
                              <span className="text-[10px] mt-0.5 text-white">Stok: {p.stock}</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 justify-center">
                              {isLowStock ? (
                                <>
                                  <span className="relative flex h-2 w-2">
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${p.stock === 0 ? "bg-rose-500" : "bg-amber-400"}`}></span>
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${p.stock === 0 ? "bg-rose-500" : "bg-amber-400"}`}></span>
                                  </span>
                                  <span className={`font-mono font-bold px-2.5 py-0.5 rounded-md text-xs shadow-xs border ${
                                    p.stock === 0 
                                      ? "text-rose-400 bg-rose-500/10 border-rose-500/20" 
                                      : "text-amber-400 bg-amber-400/10 border-amber-500/20"
                                  }`}>
                                    {p.stock}
                                  </span>
                                </>
                              ) : (
                                <span className="font-mono font-bold px-2.5 py-0.5 rounded-md text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                  {p.stock}
                                </span>
                              )}
                              <span className="text-slate-600 text-xs">/</span>
                              <span className="text-[#8C8C8E] font-mono text-xs">
                                {p.stock_minimum}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Action Operations Column */}
                        <td className="py-3.5 px-4 text-right">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1.5" id={`edit-actions-${p.id}`}>
                              <button
                                onClick={() => handleUpdateProduct(p.id!)}
                                className="p-1 px-2.5 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-md transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                                title="Simpan Perubahan"
                              >
                                <Check className="h-3 w-3" /> Simpan
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1 px-2.5 text-[#8C8C8E] hover:text-white hover:bg-slate-800 border border-slate-700 rounded-md transition-colors cursor-pointer text-xs"
                                title="Batal"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2" id={`default-actions-${p.id}`}>
                              <button
                                onClick={() => handleStartEdit(p)}
                                className="p-1.5 text-slate-300 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg border border-slate-800 transition-all cursor-pointer bg-[#121212]"
                                title="Ubah Spesifikasi"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => triggerDeleteProduct(p)}
                                className="p-1.5 text-rose-400 hover:bg-rose-950/30 rounded-lg border border-rose-900/30 transition-all cursor-pointer"
                                title="Hapus Produk"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
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

      {/* Custom Confirmation Modal for Deleting Product */}
      {productToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative overflow-hidden text-left text-white animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Hapus Produk?</h3>
                <p className="text-xs text-[#8C8C8E] mt-1.5 leading-relaxed">
                  Apakah Anda yakin ingin menghapus produk <strong className="text-white font-bold">{productToDelete.name}</strong> ({productToDelete.sku}) dari daftar katalog inventaris?
                </p>
                <div className="text-[11px] text-rose-400 mt-3 bg-rose-950/30 p-2.5 rounded-xl border border-rose-900/40 leading-relaxed font-semibold">
                  Tindakan ini permanen dan menghapus catatan produk dari inventaris.
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-[#8C8C8E] hover:text-white hover:bg-slate-800 border border-slate-700 rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const currentProduct = productToDelete;
                  setProductToDelete(null);
                  executeDeleteProduct(currentProduct.id!);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-all transform active:scale-[0.98] cursor-pointer shadow-sm"
              >
                Hapus Produk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert for Product Edit Form Validation */}
      {editValidationError && (
        <div className="fixed bottom-4 right-4 z-[9999] bg-[#1E1E1E] border border-rose-900/40 text-rose-400 p-4 rounded-xl shadow-2xl flex items-start gap-2.5 max-w-sm animate-fade-in text-left">
          <div className="p-1 bg-rose-500/10 rounded text-rose-400 mt-0.5 shrink-0">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-xs text-white">Gagal Memperbarui</h4>
            <p className="text-[11px] text-[#8C8C8E] mt-0.5">{editValidationError}</p>
          </div>
          <button onClick={() => setEditValidationError(null)} className="text-[#8C8C8E] hover:text-white shrink-0 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
