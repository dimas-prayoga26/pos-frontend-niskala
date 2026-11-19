import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NonCashPaymentModal from "../../src/features/pos/components/NonCashPaymentModal";

vi.mock("qrcode", () => ({ default: { toCanvas: vi.fn() } }));

describe("NonCashPaymentModal", () => {
  it("pays Non Tunai by QRIS only, no Bank Mandiri transfer", () => {
    const onConfirm = vi.fn();
    render(
      <NonCashPaymentModal amount={25000} customerName="Guest" isSubmitting={false} onClose={vi.fn()} onConfirm={onConfirm} />
    );

    expect(screen.getByRole("heading", { name: "Pembayaran QRIS" })).toBeInTheDocument();
    expect(screen.getByText("Nominal QRIS sudah dikunci sesuai total pesanan.")).toBeInTheDocument();
    expect(screen.queryByText(/Mandiri/)).not.toBeInTheDocument();
    expect(screen.queryByText("No. Rekening")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Buat Pesanan" }));
    expect(onConfirm).toHaveBeenCalledWith("QRIS");
  });
});
