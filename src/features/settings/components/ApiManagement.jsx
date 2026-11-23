import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { MdVpnKey } from "react-icons/md";
import { getIntegrations, testIntegration, updateIntegration } from "../api";
import { INTEGRATION_STATUS_KEY } from "../../../shared/lib/useLoyaltyEnabled";
import SettingCard, {
  cardButtonClass,
  cardDangerButtonClass,
  cardPrimaryButtonClass,
} from "../../../shared/ui/SettingCard";
import Switch from "../../../shared/ui/Switch";

const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;
const inputClass =
  "mt-2 w-full rounded-lg border border-[#3a3a3a] bg-[#262626] px-4 py-2.5 text-sm text-[#f5f5f5] outline-none focus:border-[#a79981]";

// What the card says under its name: the key's state, the end of the key.
const statusOf = (integration) => {
  if (integration.keyUnreadable) return { warning: "API key tersimpan tidak bisa dibaca: isi ulang." };
  if (!integration.hasKey) return { warning: "Belum ada API key: semua fitur loyalty disembunyikan." };
  if (!integration.isActive) return { warning: "Nonaktif: semua fitur loyalty disembunyikan." };
  return { subtitle: `Aktif · key ••••${integration.keyHint}` };
};

// One outside service, the same card as Menu → Promo: its URL and key (the
// key itself never comes back, only its last 4 characters), on/off, Tes koneksi.
function IntegrationCard({ integration }) {
  const queryClient = useQueryClient();
  const [baseUrl, setBaseUrl] = useState(integration.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);

  // Whatever depends on loyalty reads the new state.
  const onSaved = (response, message) => {
    queryClient.setQueryData(["integrations"], (current) =>
      current
        ? {
            ...current,
            data: {
              ...current.data,
              data: (current.data?.data || []).map((item) =>
                item.code === integration.code ? response.data.data : item
              ),
            },
          }
        : current
    );
    queryClient.invalidateQueries({ queryKey: ["integrations"] });
    queryClient.invalidateQueries({ queryKey: INTEGRATION_STATUS_KEY });
    queryClient.invalidateQueries({ queryKey: ["loyalty-program"] });
    queryClient.invalidateQueries({ queryKey: ["loyalty-customer"] });
    setApiKey("");
    setIsConfirmingRemove(false);
    enqueueSnackbar(message, { variant: "success" });
  };
  // kind: "save" (the form), "toggle" (the switch) or "remove" (the key).
  const saveMutation = useMutation({
    mutationFn: ({ baseUrl: url, apiKey: key, isActive }) =>
      updateIntegration({ code: integration.code, baseUrl: url, isActive, ...(key !== undefined ? { apiKey: key } : {}) }),
    onSuccess: (response, { kind, isActive }) =>
      onSaved(
        response,
        kind === "remove"
          ? "API key dihapus."
          : kind === "toggle"
            ? `${integration.name} ${isActive ? "dinyalakan" : "dimatikan"}.`
            : "API disimpan."
      ),
    onError: (error) => enqueueSnackbar(errorMessage(error, "Gagal menyimpan API."), { variant: "error" }),
  });
  const testMutation = useMutation({
    mutationFn: () => testIntegration({ code: integration.code, baseUrl, ...(apiKey.trim() ? { apiKey } : {}) }),
    onSuccess: (response) => setTestResult(response.data.data),
    onError: (error) => setTestResult({ ok: false, message: errorMessage(error, "Tes koneksi gagal.") }),
  });
  const isBusy = saveMutation.isPending || testMutation.isPending;

  const save = (event) => {
    event.preventDefault();
    setTestResult(null);
    saveMutation.mutate({
      kind: "save",
      baseUrl,
      // A first key switches it on; otherwise it stays as the switch says.
      isActive: integration.isActive || !integration.hasKey,
      ...(apiKey.trim() ? { apiKey } : {}),
    });
  };
  const removeKey = () =>
    saveMutation.mutate({ kind: "remove", baseUrl: integration.baseUrl, apiKey: null, isActive: integration.isActive });

  return (
    <SettingCard
      icon={<MdVpnKey size={20} />}
      title={integration.name}
      {...statusOf(integration)}
      actions={
        <Switch
          checked={Boolean(integration.isActive)}
          onChange={(isActive) => saveMutation.mutate({ kind: "toggle", baseUrl: integration.baseUrl, isActive })}
          label={integration.name}
          disabled={isBusy}
        />
      }
    >
      <form onSubmit={save} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm font-semibold text-[#ababab]">
          URL API
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://loyalty.domain.com/api/pos"
            className={inputClass}
          />
        </label>
        <label className="text-sm font-semibold text-[#ababab]">
          API Key
          <input
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder={integration.hasKey ? `Tersimpan ••••${integration.keyHint}` : "Tempel API key"}
            className={inputClass}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 md:col-span-2">
          <button type="submit" disabled={isBusy} className={cardPrimaryButtonClass}>
            {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
          </button>
          <button type="button" onClick={() => testMutation.mutate()} disabled={isBusy} className={cardButtonClass}>
            {testMutation.isPending ? "Mengetes..." : "Tes Koneksi"}
          </button>
          {integration.hasKey &&
            (isConfirmingRemove ? (
              <span className="flex items-center gap-2 text-sm text-[#ababab]">
                Hapus API key?
                <button
                  type="button"
                  onClick={removeKey}
                  disabled={isBusy}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  Hapus
                </button>
                <button type="button" onClick={() => setIsConfirmingRemove(false)} className={cardButtonClass}>
                  Batal
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingRemove(true)}
                disabled={isBusy}
                className={cardDangerButtonClass}
              >
                Hapus API Key
              </button>
            ))}
          {testResult && (
            <span role="status" className={`text-sm font-semibold ${testResult.ok ? "text-green-400" : "text-red-300"}`}>
              {testResult.message}
            </span>
          )}
        </div>
      </form>
    </SettingCard>
  );
}

// Pengaturan → API (admins): the outside services the POS calls.
export default function ApiManagement() {
  const integrationsQuery = useQuery({ queryKey: ["integrations"], queryFn: getIntegrations, retry: false });
  const integrations = integrationsQuery.data?.data?.data || [];

  if (integrationsQuery.isPending) {
    return <p className="rounded-lg bg-[#1f1f1f] p-6 text-center text-sm text-[#ababab]">Memuat API...</p>;
  }
  if (integrationsQuery.isError) {
    return (
      <p role="alert" className="rounded-lg bg-[#1f1f1f] p-4 text-red-300">
        {errorMessage(integrationsQuery.error, "API gagal dimuat.")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {integrations.map((integration) => (
        <IntegrationCard key={`${integration.code}-${integration.updatedAt || ""}`} integration={integration} />
      ))}
    </div>
  );
}
