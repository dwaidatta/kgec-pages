export async function generateFrontPagePdf(layout, user, frontPagePath) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.width = "210mm";
  iframe.style.height = "297mm";
  document.body.appendChild(iframe);

  await new Promise((resolve, reject) => {
    iframe.onload = resolve;
    iframe.onerror = reject;
    iframe.src = frontPagePath;
  });

  await waitForApplyLayout(iframe);

  const filledLayout = fillLayoutWithUser(layout, user);
  iframe.contentWindow.applyLayout(filledLayout);

  await new Promise((r) => setTimeout(r, 100));

  const pw = iframe.contentWindow;

  return new Promise((resolve) => {
    pw.addEventListener("afterprint", function handler() {
      pw.removeEventListener("afterprint", handler);
      document.body.removeChild(iframe);
      resolve();
    }, { once: true });

    pw.focus();
    pw.print();
  });
}

function waitForApplyLayout(iframe, attempt = 0) {
  return new Promise((resolve, reject) => {
    const check = () => {
      if (typeof iframe.contentWindow?.applyLayout === "function") {
        resolve();
        return;
      }
      if (attempt > 50) {
        reject(new Error("applyLayout not found"));
        return;
      }
      attempt++;
      setTimeout(check, 100);
    };
    check();
  });
}

export function fillLayoutWithUser(layout, user) {
  const rows = layout.detailsSpace.rows.map((row) => {
    if (!row.linkedField) return row;
    return { ...row, value: (user && user[row.linkedField]) || "" };
  });
  return { ...layout, detailsSpace: { ...layout.detailsSpace, rows } };
}