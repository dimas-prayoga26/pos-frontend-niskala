import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCamera, FiRotateCcw } from "react-icons/fi";
import { cameraErrorMessage } from "../../utils/receiptImages";

const buttonClass =
  "inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50";

const stopStream = (stream) => stream?.getTracks().forEach((track) => track.stop());

// Webcam preview for computers, whose browsers do not open a camera for
// <input capture>. The back camera is preferred when there is one. The
// preview is not mirrored so the text of a nota held up to it stays readable.
const CameraCaptureDialog = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("starting");
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    let active = true;

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      .then(async (stream) => {
        if (!active) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (active) setStatus("ready");
      })
      .catch((cameraError) => {
        if (!active) return;
        setError(cameraErrorMessage(cameraError));
        setStatus("error");
      });

    return () => {
      active = false;
      stopStream(streamRef.current);
    };
  }, []);

  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo]);

  // Escape closes only this dialog, not the form under it.
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Foto gagal diambil. Coba lagi.");
          return;
        }
        const file = new File([blob], `bukti-nota-${Date.now()}.jpg`, { type: "image/jpeg" });
        setPhoto({ file, url: URL.createObjectURL(file) });
      },
      "image/jpeg",
      0.9
    );
  };

  const acceptPhoto = () => {
    onCapture(photo.file);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3"
      data-camera-capture=""
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-capture-title"
    >
      <div className="w-full max-w-3xl rounded-xl bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="camera-capture-title" className="text-xl font-bold">
              Ambil Foto Bukti Nota
            </h2>
            <p className="mt-1 text-sm text-[#ababab]">
              Arahkan kamera ke nota sampai tulisannya terbaca jelas, lalu klik Jepret.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5]"
          >
            Tutup
          </button>
        </div>

        <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            aria-label="Pratinjau kamera"
            className={`h-full w-full object-contain ${photo || status !== "ready" ? "invisible" : ""}`}
          />
          {photo && (
            <img src={photo.url} alt="Hasil foto bukti nota" className="absolute inset-0 h-full w-full object-contain" />
          )}
          {status === "starting" && (
            <p className="absolute text-sm text-[#ababab]">Membuka kamera... Izinkan akses kamera jika diminta.</p>
          )}
          {status === "error" && (
            <p role="alert" className="absolute max-w-md px-6 text-center text-sm text-red-300">
              {error}
            </p>
          )}
        </div>
        {status === "ready" && error && (
          <p role="alert" className="mt-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {photo ? (
            <>
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className={`${buttonClass} bg-[#333] text-[#f5f5f5]`}
              >
                <FiRotateCcw size={16} aria-hidden="true" />
                Ulangi
              </button>
              <button type="button" onClick={acceptPhoto} className={`${buttonClass} bg-[#a79981] text-[#101010]`}>
                Pakai Foto
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={takePhoto}
              disabled={status !== "ready"}
              className={`${buttonClass} bg-[#a79981] text-[#101010]`}
            >
              <FiCamera size={16} aria-hidden="true" />
              Jepret
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CameraCaptureDialog;
