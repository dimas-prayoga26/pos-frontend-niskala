import React, { useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  addOrderPlatform,
  deleteOrderPlatform,
  getOrderPlatforms,
  updateOrderPlatform,
} from "../../https";

const emptyPlatformForm = {
  isActive: true,
  name: "",
};

const SettingsManagement = () => {
  const queryClient = useQueryClient();
  const [platformForm, setPlatformForm] = useState(emptyPlatformForm);
  const [editingPlatform, setEditingPlatform] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: platformsRes } = useQuery({
    queryKey: ["order-platforms", "management"],
    queryFn: () => getOrderPlatforms({ includeInactive: true }),
    placeholderData: keepPreviousData,
  });

  const platforms = platformsRes?.data?.data || [];
  const filteredPlatforms = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) return platforms;

    return platforms.filter((platform) =>
      [platform.name, platform.isActive ? "aktif" : "nonaktif"]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [platforms, searchQuery]);

  const refreshPlatformData = () => {
    queryClient.invalidateQueries({ queryKey: ["order-platforms"] });
  };

  const platformMutation = useMutation({
    mutationFn: (payload) =>
      editingPlatform
        ? updateOrderPlatform({
            platformId: editingPlatform.id || editingPlatform._id,
            ...payload,
          })
        : addOrderPlatform(payload),
    onSuccess: () => {
      refreshPlatformData();
      enqueueSnackbar(
        editingPlatform
          ? "Platform berhasil diubah."
          : "Platform berhasil ditambahkan.",
        { variant: "success" }
      );
      setPlatformForm(emptyPlatformForm);
      setEditingPlatform(null);
    },
    onError: (error) => {
      enqueueSnackbar(
        error?.response?.data?.message || "Gagal menyimpan platform.",
        { variant: "error" }
      );
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deleteOrderPlatform,
    onSuccess: () => {
      refreshPlatformData();
      enqueueSnackbar("Platform berhasil dinonaktifkan.", {
        variant: "success",
      });
    },
    onError: () => {
      enqueueSnackbar("Gagal menonaktifkan platform.", { variant: "error" });
    },
  });

  const updatePlatformForm = (field, value) => {
    setPlatformForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmitPlatform = (event) => {
    event.preventDefault();

    if (!platformForm.name.trim()) {
      enqueueSnackbar("Nama platform wajib diisi.", { variant: "warning" });
      return;
    }

    platformMutation.mutate({
      name: platformForm.name.trim(),
      isActive: Boolean(platformForm.isActive),
    });
  };

  const startEditPlatform = (platform) => {
    setEditingPlatform(platform);
    setPlatformForm({
      isActive: platform.isActive !== false,
      name: platform.name || "",
    });
  };

  const resetPlatformForm = () => {
    setEditingPlatform(null);
    setPlatformForm(emptyPlatformForm);
  };

  return (
    <div className="container mx-auto rounded-lg bg-[#262626] p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#f5f5f5]">Setting</h2>
          <p className="mt-1 text-sm text-[#ababab]">
            Atur platform online food yang tampil di menu order.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
        <form
          onSubmit={handleSubmitPlatform}
          className="rounded-lg bg-[#1f1f1f] p-4"
        >
          <h3 className="text-lg font-bold text-[#f5f5f5]">
            {editingPlatform ? "Ubah Platform" : "Tambah Platform"}
          </h3>

          <label className="mt-4 block text-sm font-semibold text-[#ababab]">
            Nama Platform
            <input
              value={platformForm.name}
              onChange={(event) => updatePlatformForm("name", event.target.value)}
              placeholder="GoFood"
              className="mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
            />
          </label>

          <label className="mt-4 block text-sm font-semibold text-[#ababab]">
            Status
            <select
              value={platformForm.isActive ? "active" : "inactive"}
              onChange={(event) =>
                updatePlatformForm("isActive", event.target.value === "active")
              }
              className="mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
            >
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </label>

          <div className="mt-5 flex gap-2">
            <button
              type="submit"
              disabled={platformMutation.isPending}
              className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:opacity-60"
            >
              {platformMutation.isPending
                ? "Menyimpan..."
                : editingPlatform
                  ? "Simpan"
                  : "Tambah"}
            </button>
            {editingPlatform && (
              <button
                type="button"
                onClick={resetPlatformForm}
                className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5]"
              >
                Batal
              </button>
            )}
          </div>
        </form>

        <div className="rounded-lg bg-[#1f1f1f] p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-bold text-[#f5f5f5]">
              Platform Online Food
            </h3>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              type="search"
              placeholder="Search platform"
              className="rounded-lg bg-[#262626] px-4 py-2 text-sm text-[#f5f5f5] outline-none"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[#f5f5f5]">
              <thead className="bg-[#333] text-[#ababab]">
                <tr>
                  <th className="p-3">Platform</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlatforms.map((platform) => (
                  <tr
                    key={platform.id || platform._id}
                    className="border-b border-gray-600 hover:bg-[#333]"
                  >
                    <td className="p-4 font-semibold">{platform.name}</td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-flex rounded-md px-3 py-1 text-xs font-bold ${
                          platform.isActive
                            ? "bg-green-900/60 text-green-300"
                            : "bg-red-900/60 text-red-300"
                        }`}
                      >
                        {platform.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-4 text-sm font-semibold">
                        <button
                          type="button"
                          onClick={() => startEditPlatform(platform)}
                          className="text-[#a79981] hover:text-[#d6c7ae]"
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            deactivateMutation.mutate(
                              platform.id || platform._id
                            )
                          }
                          disabled={!platform.isActive || deactivateMutation.isPending}
                          className="text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Nonaktifkan
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPlatforms.length === 0 && (
                  <tr>
                    <td className="p-4 text-center text-[#ababab]" colSpan={3}>
                      No platforms found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsManagement;
