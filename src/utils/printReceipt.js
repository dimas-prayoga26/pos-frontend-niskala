const isMobilePrintBrowser = () =>
  /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);

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
