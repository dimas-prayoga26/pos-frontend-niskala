import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { addSupplier, deleteSupplier, getShoppingSuppliers, updateSupplier } from "../api";

const inputClass = "w-full rounded-lg border border-transparent bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none focus:border-[#a79981] disabled:opacity-60";

export default function SupplierManagement() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const submitting = useRef(false);
  const nameInput = useRef(null);
  const suppliers = useQuery({queryKey:["shopping-suppliers"],queryFn:getShoppingSuppliers});
  const list = (suppliers.data?.data?.data || []).filter(item=>item.name.toLowerCase().includes(search.trim().toLowerCase()));
  const reset = () => {setName("");setEditingId(null);};
  const mutation = useMutation({
    mutationFn: ({id, name}) => id ? updateSupplier({id,name}) : addSupplier({name}),
    onSuccess: async () => {
      reset();
      enqueueSnackbar("Suplier berhasil disimpan.",{variant:"success"});
      await queryClient.invalidateQueries({queryKey:["shopping-suppliers"]});
    },
    onError: error => enqueueSnackbar(error?.response?.data?.message || "Gagal menyimpan suplier.",{variant:"error"}),
    onSettled: () => {submitting.current=false;},
  });
  // Hapus: asks first; the server refuses a suplier a nota uses.
  const [pendingDelete, setPendingDelete] = useState(null);
  const removal = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: async (response, id) => {
      setPendingDelete(null);
      if (editingId === id) reset();
      enqueueSnackbar(response?.data?.message || "Suplier dihapus.",{variant:"success"});
      await queryClient.invalidateQueries({queryKey:["shopping-suppliers"]});
    },
    onError: error => {
      setPendingDelete(null);
      enqueueSnackbar(error?.response?.data?.message || "Gagal menghapus suplier.",{variant:"error"});
    },
  });
  const busy = mutation.isPending || removal.isPending;
  const submit = event => {
    event.preventDefault();
    if (submitting.current) return;
    const value = name.trim().replace(/\s+/g," ");
    if (!value) {enqueueSnackbar("Nama suplier wajib diisi.",{variant:"warning"});return;}
    submitting.current=true;
    mutation.mutate({id:editingId,name:value});
  };

  return <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
    <form onSubmit={submit} className="self-start rounded-lg bg-[#1f1f1f] p-4">
      <h3 className="text-lg font-bold text-[#f5f5f5]">{editingId ? "Ubah Suplier" : "Tambah Suplier"}</h3>
      <p className="mt-1 text-sm text-[#ababab]">Toko atau sumber pembelian bahan belanjaan.</p>
      <label className="mt-4 block text-sm font-semibold text-[#ababab]">
        Nama Suplier
        <input ref={nameInput} required maxLength={150} value={name} disabled={mutation.isPending}
          onChange={event=>setName(event.target.value)} placeholder="Contoh: Toko Sumber Makmur" className={`mt-2 ${inputClass}`} />
      </label>
      <div className="mt-5 flex gap-2">
        <button type="submit" disabled={mutation.isPending} className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:cursor-not-allowed disabled:opacity-60">
          {mutation.isPending ? "Menyimpan..." : "Simpan"}
        </button>
        {editingId && <button type="button" onClick={reset} disabled={mutation.isPending} className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] disabled:opacity-60">Batal</button>}
      </div>
    </form>
    <div className="min-w-0 rounded-lg bg-[#1f1f1f] p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold text-[#f5f5f5]">Daftar Suplier</h3>
        <input type="search" aria-label="Cari suplier" placeholder="Cari suplier" value={search} onChange={event=>setSearch(event.target.value)} className={`${inputClass} sm:w-64`} />
      </div>
      {suppliers.isError ? <p role="alert" className="py-4 text-red-300">Daftar suplier gagal dimuat. <button type="button" onClick={()=>suppliers.refetch()} className="underline">Coba lagi</button></p> :
        <div className="overflow-x-auto"><table className="w-full text-left text-[#f5f5f5]">
          <thead className="bg-[#333] text-[#ababab]"><tr><th className="p-3">Nama Suplier</th><th className="w-52 p-3 text-center">Aksi</th></tr></thead>
          <tbody>{list.map(item=><tr key={item.id} className="border-b border-[#444] hover:bg-[#292929]">
            <td className="break-words p-4 font-semibold">{item.name}</td>
            <td className="p-3"><div className="flex justify-center gap-2">
              <button type="button" disabled={busy} aria-label={`Ubah suplier ${item.name}`}
                onClick={()=>{setEditingId(item.id);setName(item.name);nameInput.current?.focus();}}
                className="inline-flex items-center gap-2 rounded-lg border border-[#a79981]/40 px-3 py-2 text-sm font-semibold text-[#d6c7ae] hover:bg-[#a79981]/10 disabled:opacity-50">
                <FiEdit2 size={14} aria-hidden="true" />Ubah
              </button>
              <button type="button" disabled={busy} aria-label={`Hapus suplier ${item.name}`}
                onClick={()=>setPendingDelete(item)}
                className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                <FiTrash2 size={14} aria-hidden="true" />Hapus
              </button>
            </div></td>
          </tr>)}</tbody>
        </table>
        {suppliers.isPending ? <p className="py-5 text-center text-sm text-[#ababab]">Memuat suplier...</p> : !list.length && <p className="py-5 text-center text-sm text-[#ababab]">{search.trim() ? "Suplier tidak ditemukan." : "Belum ada suplier."}</p>}
        </div>}
    </div>
    {pendingDelete && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-label="Hapus suplier" className="rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl" style={{width:"min(92vw, 380px)"}}>
        <h3 className="text-lg font-bold">Hapus suplier?</h3>
        <p className="mt-2 text-sm text-[#ababab]">Suplier <span className="font-semibold text-[#f5f5f5]">{pendingDelete.name}</span> akan dihapus. Suplier yang sudah dipakai di nota belanja tidak bisa dihapus.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={()=>setPendingDelete(null)} disabled={removal.isPending} className="rounded-lg bg-[#333] px-4 py-2 text-sm font-semibold text-[#f5f5f5] disabled:opacity-60">Batal</button>
          <button type="button" onClick={()=>removal.mutate(pendingDelete.id)} disabled={removal.isPending} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {removal.isPending ? "Menghapus..." : "Hapus"}
          </button>
        </div>
      </div>
    </div>}
  </div>;
}
