/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FiTrash2 } from "react-icons/fi";
import CreatableSelect2 from "../shared/CreatableSelect2";
import { getShoppingSuppliers, getPurchases, savePurchase } from "../../https";

const inputClass = "w-full rounded-lg border border-[#555] bg-[#262626] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae] disabled:opacity-60";
const buttonClass = "rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:opacity-50";
const paymentOptions = ["Cash", "Rekening Penjualan", "Transfer", "QRIS"].map(name => ({ id: name, text: name }));
const requestId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2,"0")).join("");
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Jakarta", year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date());
let rowKey = 0;
const blankRow = () => ({ key: ++rowKey, stockItemId:"", quantity:"", unit:"", unitPrice:"" });
const currency = n => `Rp ${Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits:2 })}`;
const parseShoppingQuantity = value => {
  const input = String(value ?? "").trim().replace(",", ".");

  if (!input) return NaN;

  const fraction = input.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);

  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);

    return denominator > 0 ? numerator / denominator : NaN;
  }

  return Number(input);
};
const shoppingQuantity = value => {
  const quantity = parseShoppingQuantity(value);

  return Number.isFinite(quantity) ? quantity : 0;
};
const purchaseUnitForStockUnit = unit => {
  const normalizedUnit = String(unit || "").trim().toLowerCase();

  if (["gr", "g", "gram"].includes(normalizedUnit)) return "kg";

  return unit || "";
};
const lineTotal = row => Math.round(shoppingQuantity(row.quantity) * Number(row.unitPrice || 0) * 100) / 100;
const formatRupiahInput = value => {
  const digits = String(value ?? "").replace(/\D/g, "");

  return digits ? Number(digits).toLocaleString("id-ID") : "";
};

export default function ShoppingManagement({ stockItems, isAdmin }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date:today(), suplierId:"", paymentMethod:"Cash", note:"" });
  const [rows, setRows] = useState(() => [blankRow()]);
  const [extraItems, setExtraItems] = useState([]);
  const [extraSuppliers, setExtraSuppliers] = useState([]);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const submission = useRef(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const suppliers = useQuery({queryKey:["shopping-suppliers"],queryFn:getShoppingSuppliers});
  const history = useQuery({queryKey:["purchases",search,page],queryFn:()=>getPurchases({search,page}),placeholderData:keepPreviousData});
  const supplierOptions = useMemo(() => Array.from(new Map([
    ...(suppliers.data?.data?.data || []), ...extraSuppliers,
  ].map(item => [item.id,{id:item.id,text:item.name}])).values()),[suppliers.data,extraSuppliers]);
  const itemOptions = useMemo(() => Array.from(new Map([...stockItems,...extraItems]
    .map(item => [item.id,{id:item.id,text:item.name,unit:item.unit}])).values()),[stockItems,extraItems]);
  const historyData = history.data?.data?.data;
  const totalPages = Math.max(1,Math.ceil((historyData?.total || 0)/10));
  useEffect(() => { if(page>totalPages)setPage(totalPages); },[page,totalPages]);
  useEffect(() => {
    if (!showForm) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  },[showForm]);
  const updateRow = (key,patch) => setRows(current => current.map(row => row.key===key ? {...row,...patch} : row));
  const addSupplier = name => {
    const existing = supplierOptions.find(item=>item.text.toLowerCase()===name.toLowerCase());
    if (existing) return existing;
    const created = {id:`draft:${name.toLowerCase()}`,name};
    setExtraSuppliers(current=>[...current.filter(item=>item.id!==created.id),created]);
    return {id:created.id,text:created.name};
  };
  const addItem = name => {
    const existing = itemOptions.find(item=>item.text.toLowerCase()===name.toLowerCase());
    if (existing) return existing;
    const created = {id:`draft:${name.toLowerCase()}`,name,unit:""};
    setExtraItems(current=>[...current.filter(item=>item.id!==created.id),created]);
    return {id:created.id,text:created.name,unit:created.unit};
  };
  const submit = async event => {
    event.preventDefault();
    if(lock.current)return;
    if(!form.suplierId || rows.some(row=>!row.stockItemId || !row.unit.trim() || !Number.isFinite(parseShoppingQuantity(row.quantity)) || parseShoppingQuantity(row.quantity)<=0 || row.unitPrice==="")) {
      enqueueSnackbar("Lengkapi toko, barang, qty, satuan, dan harga satuan.",{variant:"error"});return;
    }
    const supplierDraft = extraSuppliers.find(item=>item.id===form.suplierId);
    const {suplierId,...details} = form;
    const payload = {...details,...(supplierDraft ? {suplierName:supplierDraft.name} : {suplierId}),items:rows.map(({stockItemId,quantity,unit,unitPrice})=>{
      const draft = extraItems.find(item=>item.id===stockItemId);
      return {...(draft ? {itemName:draft.name} : {stockItemId}),quantity:parseShoppingQuantity(quantity),unit,unitPrice};
    })};
    const signature=JSON.stringify(payload);
    if(!submission.current || submission.current.signature!==signature)submission.current={signature,id:requestId()};
    lock.current=true;setSaving(true);
    try {
      await savePurchase({...payload,requestId:submission.current.id});
      await Promise.all([queryClient.invalidateQueries({queryKey:["stock-items"]}),queryClient.invalidateQueries({queryKey:["purchases"]}),queryClient.invalidateQueries({queryKey:["shopping-suppliers"]})]);
      enqueueSnackbar("Belanja tersimpan dan stok berhasil ditambahkan.",{variant:"success"});
      setShowForm(false);setRows([blankRow()]);setForm({date:today(),suplierId:"",paymentMethod:"Cash",note:""});setExtraItems([]);setExtraSuppliers([]);submission.current=null;setPage(1);
    } catch(error) {
      enqueueSnackbar(error?.response?.data?.message || "Belum mendapat konfirmasi penyimpanan. Coba simpan lagi dengan data yang sama.",{variant:"error"});
    } finally {lock.current=false;setSaving(false);}
  };
  return <section className="mb-5 rounded-lg bg-[#1f1f1f] p-4 text-[#f5f5f5]">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-bold">Bahan Belanjaan</h3><p className="mt-1 text-sm text-[#ababab]">Catat belanja per toko. Stok bertambah saat belanja disimpan.</p></div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        {isAdmin && <button className={`${buttonClass} whitespace-nowrap`} onClick={()=>setShowForm(true)}>Tambah Bahan Belanjaan</button>}
        <input className={`${inputClass} sm:w-64`} type="search" aria-label="Cari riwayat belanja" placeholder="Nama toko atau barang" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
      </div>
    </div>
    {history.isError && <p role="alert" className="text-red-400">Riwayat belanja gagal dimuat. <button onClick={()=>history.refetch()} className="underline">Coba lagi</button></p>}
    {history.isPending && <p>Memuat riwayat belanja...</p>}
    {!history.isPending && !history.isError && !historyData?.purchases?.length && <p className="py-5 text-center text-[#ababab]">Belum ada belanja tersimpan.</p>}
    <div className="space-y-4">
      {historyData?.purchases?.map(purchase=><article key={purchase.id} className="rounded-lg border border-[#444] p-3">
        <div className="mb-3 flex flex-wrap justify-between gap-2"><div><strong>{purchase.suplier_name}</strong><p className="text-sm text-[#ababab]">{String(purchase.purchase_date).slice(0,10)} · {purchase.payment_method} · #{purchase.id}</p></div><strong>{currency(purchase.total)}</strong></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-[#ababab]"><tr><th className="p-2">Nama Barang</th><th className="p-2">Qty</th><th className="p-2">Satuan</th><th className="p-2 text-right">Harga Satuan</th><th className="p-2 text-right">Jumlah</th></tr></thead><tbody>
          {purchase.items.map(item=><tr key={item.id} className="border-t border-[#444]"><td className="p-2">{item.item_name}</td><td className="p-2">{Number(item.quantity)}</td><td className="p-2">{item.unit}</td><td className="p-2 text-right">{currency(item.unit_price)}</td><td className="p-2 text-right">{currency(item.total)}</td></tr>)}
        </tbody></table></div>{purchase.note && <p className="mt-2 text-sm text-[#ababab]">{purchase.note}</p>}
      </article>)}
    </div>
    <div className="mt-4 flex items-center justify-end gap-3 text-sm"><button disabled={page<=1||history.isFetching} onClick={()=>setPage(p=>p-1)} className="disabled:opacity-40">Sebelumnya</button><span>{page} / {totalPages}</span><button disabled={page>=totalPages||history.isFetching} onClick={()=>setPage(p=>p+1)} className="disabled:opacity-40">Berikutnya</button></div>
    {showForm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-labelledby="shopping-form-title">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-[#1f1f1f] p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3"><div><h2 id="shopping-form-title" className="text-xl font-bold">Tambah Bahan Belanjaan</h2><p className="mt-1 text-sm text-[#ababab]">Pilih “Buat” jika nama belum tersedia. Toko dan barang baru tersimpan saat klik Simpan Belanjaan.</p></div><button type="button" disabled={saving} onClick={()=>setShowForm(false)} aria-label="Tutup form" className="p-2">✕</button></div>
        <fieldset disabled={saving} className="min-w-0">
          <div className="grid gap-4 md:grid-cols-3">
            <label><span className="mb-1 block text-sm">Tanggal</span><input required type="date" className={inputClass} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
            <div><span className="mb-1 block text-sm">Toko / Sumber</span><CreatableSelect2 options={supplierOptions} value={form.suplierId} onSelect={option=>setForm(current=>({...current,suplierId:option?.id||""}))} onCreate={addSupplier} placeholder="Cari atau buat toko/sumber" disabled={saving}/></div>
            <div><span className="mb-1 block text-sm">Pembayaran</span><CreatableSelect2 options={paymentOptions} value={form.paymentMethod} onSelect={option=>setForm(current=>({...current,paymentMethod:option?.id || "Cash"}))} placeholder="Pilih pembayaran" label="Pembayaran" disabled={saving}/></div>
          </div>
          <div className="my-5 space-y-3">
            {rows.map((row,index)=><div key={row.key} className="rounded-lg border border-[#444] p-3">
              <div className="mb-3 flex items-center justify-between gap-3 text-sm text-[#ababab]">
                <span>Barang {index+1}</span>
                <button type="button" disabled={rows.length===1}
                  aria-label={`Hapus barang ${index+1}`}
                  title={rows.length===1 ? "Minimal satu barang dalam belanja" : "Hapus barang ini"}
                  onClick={()=>setRows(current=>current.filter(item=>item.key!==row.key))}
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:border-red-400/60 hover:bg-red-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:border-[#444] disabled:bg-[#262626] disabled:text-[#777]">
                  <FiTrash2 size={15} aria-hidden="true" />
                  Hapus
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_minmax(80px,.6fr)_minmax(90px,.7fr)_minmax(120px,1fr)_minmax(120px,1fr)]">
                <div><span className="mb-1 block text-sm">Nama Barang</span><CreatableSelect2 options={itemOptions} value={row.stockItemId} onSelect={option=>updateRow(row.key,{stockItemId:option?.id||"",unit:purchaseUnitForStockUnit(option?.unit)})} onCreate={addItem} placeholder="Cari atau buat barang" disabled={saving}/></div>
                <label><span className="mb-1 block text-sm">Qty</span><input required type="text" inputMode="decimal" value={row.quantity} onChange={e=>updateRow(row.key,{quantity:e.target.value})} className={inputClass}/></label>
                <label><span className="mb-1 block text-sm">Satuan</span><input required list="shopping-units" maxLength={30} placeholder="kg / pcs" value={row.unit} onChange={e=>updateRow(row.key,{unit:e.target.value})} onBlur={e=>updateRow(row.key,{unit:purchaseUnitForStockUnit(e.target.value)})} className={inputClass}/></label>
                <label><span className="mb-1 block text-sm">Harga Satuan</span><input required type="text" inputMode="numeric" value={formatRupiahInput(row.unitPrice)} onChange={e=>updateRow(row.key,{unitPrice:e.target.value.replace(/\D/g,"")})} className={inputClass}/></label>
                <div><span className="mb-1 block text-sm">Jumlah</span><p className="py-2 font-bold">{currency(lineTotal(row))}</p></div>
              </div>
              {itemOptions.find(item=>String(item.id)===String(row.stockItemId))?.unit && <p className="mt-2 text-xs text-[#ababab]">Satuan stok: {itemOptions.find(item=>String(item.id)===String(row.stockItemId)).unit}. Konversi kg ↔ gr dan liter ↔ ml dihitung otomatis.</p>}
            </div>)}
          </div>
          <datalist id="shopping-units">{["kg","pcs","liter","ml","botol","pack","dus"].map(value=><option key={value} value={value}/>)}</datalist>
          <button type="button" disabled={rows.length>=100} onClick={()=>setRows(current=>[...current,blankRow()])} className="mb-4 rounded-lg border border-[#a79981] px-4 py-2 text-sm text-[#d6c7ae]">+ Tambah Barang</button>
          <label className="block"><span className="mb-1 block text-sm">Catatan (opsional)</span><textarea className={inputClass} maxLength={500} value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label>
        </fieldset>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><strong>Total: {currency(rows.reduce((sum,row)=>sum+lineTotal(row),0))}</strong><div className="flex gap-3"><button type="button" disabled={saving} onClick={()=>setShowForm(false)} className="px-4 py-2">Tutup</button><button type="submit" disabled={saving} className={buttonClass}>{saving?"Menyimpan...":"Simpan Belanjaan"}</button></div></div>
      </form>
    </div>}
  </section>;
}
