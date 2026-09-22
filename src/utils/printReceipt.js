const isMobilePrintBrowser = () =>
  /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);

export const isAndroidDevice = () => {
  const userAgentDataPlatform = window.navigator.userAgentData?.platform;

  if (/Android/i.test(userAgentDataPlatform || window.navigator.userAgent)) {
    return true;
  }

  // Android Chrome's desktop mode reports a Linux x86_64 UA. On HTTP LAN
  // pages UA Client Hints are unavailable, but the platform remains Linux ARM.
  return /Linux arm|Linux aarch64/i.test(window.navigator.platform || "") &&
    window.navigator.maxTouchPoints > 0;
};

export const openAndroidPrintApp = ({ onFallback, url }) => {
  let didLeavePage = false;

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      didLeavePage = true;
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.location.href = url;

  const fallbackTimer = window.setTimeout(() => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);

    if (!didLeavePage && typeof onFallback === "function") {
      onFallback();
    }
  }, 2500);

  return () => {
    window.clearTimeout(fallbackTimer);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
};

const waitForPrintAssets = (printWindow) => {
  const images = Array.from(printWindow.document.images || []);

  if (!images.length) return Promise.resolve();

  return Promise.all(
    images.map(
      (image) =>
        new Promise((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          image.onload = resolve;
          image.onerror = resolve;
        })
    )
  );
};

export const printReceiptDocument = ({ documentHtml }) => {
  const printWindow = window.open("", "_blank", "width=320,height=720");

  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(documentHtml);
  printWindow.document.close();

  const shouldKeepWindowOpen = isMobilePrintBrowser();

  printWindow.onafterprint = () => {
    window.setTimeout(() => {
      if (!printWindow.closed) printWindow.close();
    }, 1000);
  };

  waitForPrintAssets(printWindow).finally(() => {
    window.setTimeout(() => {
      if (printWindow.closed) return;

      printWindow.focus();
      printWindow.print();

      if (!shouldKeepWindowOpen) {
        window.setTimeout(() => {
          if (!printWindow.closed) printWindow.close();
        }, 1000);
      }
    }, 600);
  });

  if (shouldKeepWindowOpen) {
    window.setTimeout(() => {
      if (!printWindow.closed) printWindow.close();
    }, 60000);
  }

  return true;
};
