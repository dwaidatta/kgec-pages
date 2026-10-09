/**
 * Popup shown before generating / exporting, asking what to do with the
 * current layout. Resolves to:
 *   { action: "new", name }  save as a new layout
 *   { action: "overwrite" }  overwrite the selected saved layout
 *   { action: "skip" }       continue without saving
 *   null                     cancelled, do not continue
 */

function escAttr(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function askToSaveLayout({ canOverwrite = false, overwriteLabel = "", suggestedName = "" } = {}) {
  return new Promise((resolve) => {
    const id = "save-layout-modal-" + Date.now();

    const modalEl = document.createElement("div");
    modalEl.className = "modal fade";
    modalEl.id = id;
    modalEl.setAttribute("tabindex", "-1");
    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Save this layout?</h5>
            <button type="button" class="btn-close" data-action="cancel" aria-label="Close"></button>
          </div>
          <div class="modal-body d-flex flex-column gap-2">
            <p class="mb-1 text-muted">You changed the layout. Keep it for next time before continuing?</p>

            <div class="form-check">
              <input class="form-check-input" type="radio" name="${id}-opt" id="${id}-skip" value="skip" checked>
              <label class="form-check-label" for="${id}-skip">Don't save, just continue</label>
            </div>

            <div class="form-check">
              <input class="form-check-input" type="radio" name="${id}-opt" id="${id}-new" value="new">
              <label class="form-check-label" for="${id}-new">Save as a new layout</label>
            </div>
            <input type="text" class="form-control ms-4 w-auto" id="${id}-name" placeholder="Layout name" value="${escAttr(suggestedName)}" disabled>

            ${
              canOverwrite
                ? `<div class="form-check">
                    <input class="form-check-input" type="radio" name="${id}-opt" id="${id}-overwrite" value="overwrite">
                    <label class="form-check-label" for="${id}-overwrite">Overwrite "${escAttr(overwriteLabel)}"</label>
                  </div>`
                : ""
            }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
            <button type="button" class="btn btn-primary" data-action="confirm">Continue</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);
    const modal = new bootstrap.Modal(modalEl);
    const nameInput = modalEl.querySelector(`#${id}-name`);

    let resolved = false;
    const settle = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    const choice = () => modalEl.querySelector(`input[name="${id}-opt"]:checked`).value;

    modalEl.querySelectorAll(`input[name="${id}-opt"]`).forEach((radio) => {
      radio.addEventListener("change", () => {
        nameInput.disabled = choice() !== "new";
        if (!nameInput.disabled) nameInput.focus();
      });
    });

    const confirm = () => {
      const action = choice();

      if (action === "new") {
        const name = nameInput.value.trim();
        if (!name) {
          nameInput.classList.add("is-invalid");
          nameInput.focus();
          return;
        }
        settle({ action, name });
      } else {
        settle({ action });
      }

      modal.hide();
    };

    modalEl.querySelector('[data-action="confirm"]').addEventListener("click", confirm);

    modalEl.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        settle(null);
        modal.hide();
      });
    });

    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirm();
    });

    // Esc, backdrop click or any other dismissal counts as cancel.
    modalEl.addEventListener("hidden.bs.modal", () => {
      settle(null);
      modalEl.remove();
    });

    modal.show();
  });
}
