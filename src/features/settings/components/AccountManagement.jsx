import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { useSelector } from "react-redux";
import { deleteUser, getUsers, register, updateUser } from "../api";
import CreatableSelect2 from "../../../shared/ui/CreatableSelect2";

const emptyForm = { name: "", email: "", phone: "", role: "Cashier", password: "" };
const roleOptions = [
  { id: "Cashier", text: "Kasir" },
  { id: "Admin", text: "Admin" },
];
const roleLabel = (role) => (String(role).toLowerCase() === "admin" ? "Admin" : "Kasir");
const inputClass = "mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none";

// Akun (Pengaturan, admin only): make, change and delete the POS accounts.
const AccountManagement = () => {
  const queryClient = useQueryClient();
  const currentUserId = useSelector((state) => String(state.user?._id ?? state.user?.id ?? ""));
  const [form, setForm] = useState(emptyForm);
  const [editingUser, setEditingUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: usersRes } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
    placeholderData: keepPreviousData,
  });
  const filteredUsers = useMemo(() => {
    const users = usersRes?.data?.data || [];
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((user) =>
      [user.name, user.email, user.phone, roleLabel(user.role)].join(" ").toLowerCase().includes(keyword)
    );
  }, [usersRes, searchQuery]);

  const resetForm = () => {
    setEditingUser(null);
    setForm(emptyForm);
  };
  const showError = (fallback) => (error) =>
    enqueueSnackbar(error?.response?.data?.message || fallback, { variant: "error" });

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editingUser ? updateUser({ userId: editingUser.id || editingUser._id, ...payload }) : register(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      enqueueSnackbar(editingUser ? "Akun berhasil diubah." : "Akun berhasil ditambahkan.", { variant: "success" });
      resetForm();
    },
    onError: showError("Gagal menyimpan akun."),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      enqueueSnackbar("Akun berhasil dihapus.", { variant: "success" });
    },
    onError: showError("Gagal menghapus akun."),
  });

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: form.role,
      password: form.password,
    };
    if (!payload.name || !payload.email || !payload.phone) {
      enqueueSnackbar("Nama, email, dan nomor HP wajib diisi.", { variant: "warning" });
      return;
    }
    // A new account needs a password; a changed one keeps its own when left blank.
    if ((!editingUser || payload.password) && payload.password.length < 6) {
      enqueueSnackbar("Password minimal 6 karakter.", { variant: "warning" });
      return;
    }
    saveMutation.mutate(payload);
  };

  const startEdit = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: roleLabel(user.role) === "Admin" ? "Admin" : "Cashier",
      password: "",
    });
  };

  const confirmDelete = (user) => {
    if (!window.confirm(`Hapus akun ${user.name}?`)) return;
    deleteMutation.mutate(user.id || user._id);
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
      <form onSubmit={handleSubmit} className="rounded-lg bg-[#1f1f1f] p-4">
        <h3 className="text-lg font-bold text-[#f5f5f5]">{editingUser ? "Ubah Akun" : "Tambah Akun"}</h3>

        <label className="mt-4 block text-sm font-semibold text-[#ababab]">
          Nama
          <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Nama staf" className={inputClass} />
        </label>
        <label className="mt-4 block text-sm font-semibold text-[#ababab]">
          Email
          <input value={form.email} onChange={(event) => updateForm("email", event.target.value)} type="email" placeholder="nama@email.com" className={inputClass} />
        </label>
        <label className="mt-4 block text-sm font-semibold text-[#ababab]">
          Nomor HP
          <input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} type="tel" inputMode="tel" placeholder="0812-xxxx-xxxx" className={inputClass} />
        </label>
        <label className="mt-4 block text-sm font-semibold text-[#ababab]">
          Role
          <div className="mt-2">
            <CreatableSelect2
              options={roleOptions}
              value={form.role}
              onSelect={(option) => option?.id && updateForm("role", option.id)}
              placeholder="Pilih role"
              label="Role"
            />
          </div>
        </label>
        <label className="mt-4 block text-sm font-semibold text-[#ababab]">
          Password
          <input
            value={form.password}
            onChange={(event) => updateForm("password", event.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder={editingUser ? "Kosongkan jika tidak diganti" : "Minimal 6 karakter"}
            className={inputClass}
          />
        </label>

        <div className="mt-5 flex gap-2">
          <button type="submit" disabled={saveMutation.isPending} className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:opacity-60">
            {saveMutation.isPending ? "Menyimpan..." : editingUser ? "Simpan" : "Tambah"}
          </button>
          {editingUser && (
            <button type="button" onClick={resetForm} className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5]">
              Batal
            </button>
          )}
        </div>
      </form>

      <div className="rounded-lg bg-[#1f1f1f] p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-bold text-[#f5f5f5]">Akun</h3>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            type="search"
            placeholder="Search akun"
            className="rounded-lg bg-[#262626] px-4 py-2 text-sm text-[#f5f5f5] outline-none"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[#f5f5f5]">
            <thead className="bg-[#333] text-[#ababab]">
              <tr>
                <th className="p-3">Nama</th>
                <th className="p-3">Email</th>
                <th className="p-3">Nomor HP</th>
                <th className="p-3 text-center">Role</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const isSelf = String(user.id || user._id) === currentUserId;
                const isAdmin = roleLabel(user.role) === "Admin";

                return (
                  <tr key={user.id || user._id} className="border-b border-gray-600 hover:bg-[#333]">
                    <td className="p-4 font-semibold">
                      {user.name}
                      {isSelf && <span className="ml-2 text-xs font-normal text-[#ababab]">(Anda)</span>}
                    </td>
                    <td className="p-4 text-sm">{user.email}</td>
                    <td className="p-4 text-sm">{user.phone}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex rounded-md px-3 py-1 text-xs font-bold ${isAdmin ? "bg-amber-900/50 text-amber-200" : "bg-[#333] text-[#d6c7ae]"}`}>
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-4 text-sm font-semibold">
                        <button type="button" onClick={() => startEdit(user)} aria-label={`Ubah ${user.name}`} className="text-[#a79981] hover:text-[#d6c7ae]">
                          Ubah
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => confirmDelete(user)}
                            disabled={deleteMutation.isPending}
                            aria-label={`Hapus ${user.name}`}
                            className="text-red-400 hover:text-red-300 disabled:opacity-40"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-[#ababab]" colSpan={5}>
                    Belum ada akun
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AccountManagement;
