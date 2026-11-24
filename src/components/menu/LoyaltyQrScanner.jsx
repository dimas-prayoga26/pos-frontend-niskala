import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { MdCameraswitch, MdClose } from "react-icons/md";

// Camera scanner for the stamp card voucher QR. Uses the browser's own
// BarcodeDetector where there is one (Android, macOS), else jsQR on video
// frames. Calls onDetected once with the first QR read, then stops.
const SCAN_EVERY_MS = 150;
// Frames are scaled down to this before jsQR reads them: fast enough on a
// tablet, still sharp enough for a phone screen held up to the camera.
const MAX_FRAME = 720;

const cameraError = (error) => {
  if (!window.isSecureContext) return "Kamera hanya bisa dibuka lewat HTTPS.";
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Izin kamera ditolak. Izinkan kamera di pengaturan browser.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Kamera tidak ditemukan.";
    case "NotReadableError":
      return "Kamera sedang dipakai aplikasi lain.";
    default:
      return "Kamera tidak bisa dibuka.";
  }
};

const qrDetector = () => {
  try {
    return "BarcodeDetector" in window ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
  } catch {
    return null;
  }
};

const LoyaltyQrScanner = ({ open, onClose, onDetected }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);
  // Back camera first (phones, tablets); "user" is the front one, handy for
  // a tablet on a stand facing the cashier. Laptops fall back to their webcam.
  const [facing, setFacing] = useState("environment");
  const [cameraCount, setCameraCount] = useState(0);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (!open) return undefined;

    let stream = null;
    let timer = null;
    let stopped = false;
    let detector = qrDetector();
    setError("");
    setStarting(true);

    const readWithJsQr = (video) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const scale = Math.min(1, MAX_FRAME / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = context.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" })?.data || null;
    };

    const read = async (video) => {
      if (detector) {
        try {
          const [code] = await detector.detect(video);
          return code?.rawValue || null;
        } catch {
          detector = null; // e.g. no QR support on this device: jsQR from now on
        }
      }
      return readWithJsQr(video);
    };

    const scan = async () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth) {
        const text = await read(video);
        if (stopped) return;
        if (text) {
          stopped = true;
          onDetectedRef.current?.(text);
          return;
        }
      }
      timer = setTimeout(scan, SCAN_EVERY_MS);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(cameraError());
        setStarting(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (cameraFailure) {
        if (!stopped) {
          setError(cameraError(cameraFailure));
          setStarting(false);
        }
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});
      setStarting(false);
      // Labels and the full list only come after the permission.
      navigator.mediaDevices
        .enumerateDevices?.()
        .then((devices) => {
          if (!stopped) setCameraCount(devices.filter((device) => device.kind === "videoinput").length);
        })
        .catch(() => {});
      scan();
    };

    start();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open, facing]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="loyalty-qr-scanner-title"
        className="w-full max-w-sm overflow-hidden rounded-xl border border-[#333] bg-[#1a1a1a] shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <h2 id="loyalty-qr-scanner-title" className="text-sm font-semibold text-[#f5f5f5]">
            Scan QR Stamp Card
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-md p-1 text-[#ababab] transition hover:bg-[#262626] hover:text-white"
          >
            <MdClose size={20} />
          </button>
        </div>

        <div className="relative aspect-square w-full bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`}
          />
          {cameraCount > 1 && (
            <button
              type="button"
              onClick={() => setFacing((current) => (current === "environment" ? "user" : "environment"))}
              aria-label={facing === "environment" ? "Pakai kamera depan" : "Pakai kamera belakang"}
              title={facing === "environment" ? "Pakai kamera depan" : "Pakai kamera belakang"}
              className="absolute bottom-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
            >
              <MdCameraswitch size={22} />
            </button>
          )}
          <canvas ref={canvasRef} className="hidden" />
          {!error && (
            <div className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-[#a79981] shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
          )}
          {(starting || error) && (
            <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-[#ababab]">
              {error || "Membuka kamera…"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoyaltyQrScanner;
