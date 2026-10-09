import { renderNavbar } from "../lib/navbar.js";
import { preloadSignatureEngine } from "../lib/signature-extract.js";
import { mountSignatureFlow } from "../lib/signature-picker.js";
import { saveSignature } from "../lib/saved-signatures.js";
import { linkBadge } from "../lib/student-link.js";
import { showToast } from "../lib/ui.js";

renderNavbar("../", "signature");

const resultsEl = document.getElementById("results");

function renderResult({ key, label, dataUrl }) {
  const col = document.createElement("div");
  col.className = "col-sm-6 col-md-4";
  col.innerHTML = `
    <div class="small text-muted mb-1">${label} (transparent PNG)</div>
    <div class="border rounded p-3 mb-2 bg-white d-flex align-items-center justify-content-center" style="height:160px;">
      <img alt="${label}" style="max-width:100%;max-height:140px;">
    </div>
    <a class="btn btn-success btn-sm" download="signature-${key}.png"><i class="bi bi-download"></i> Download</a>
  `;
  col.querySelector("img").src = dataUrl;
  col.querySelector("a").href = dataUrl;
  return col;
}

let flow = null;

// The link choice lists students or teachers, so the flow is mounted again when the owner changes.
function mountFlow(role) {
  flow?.destroy();
  flow = mountSignatureFlow(document.getElementById("flow"), {
    doneLabel: "Get signature",
    offerSave: true, // shows the "link to a person" choice; saving is automatic
    role,
    onDone: (variants, { userId }) => {
      // Both ink colours are stored as one group linked to the person.
      const failed = !saveSignature({ variants, userId, role });
      if (failed) {
        showToast("Could not save on this device (storage full or blocked).", "warning");
      }

      const status = document.getElementById("save-status");
      status.replaceChildren();
      if (!failed) {
        status.append(`Saved on this device (${role}): `, linkBadge(userId));
      }

      resultsEl.replaceChildren(...variants.map(renderResult));
      document.getElementById("results-section").classList.remove("d-none");
      flow.reset();
    },
  });
}

document.querySelectorAll('input[name="sig-role"]').forEach((radio) =>
  radio.addEventListener("change", () => mountFlow(radio.value))
);
mountFlow("student");

// Download OpenCV (~8 MB) in the background so the popup is ready sooner.
preloadSignatureEngine().catch(() => showToast("Could not preload the signature engine. It will load when needed.", "warning"));
