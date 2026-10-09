function ensureToastContainer() {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container position-fixed bottom-0 end-0 p-3";
    document.body.appendChild(container);
  }
  return container;
}

const TOAST_ICONS = {
  success: "bi-check-circle-fill",
  primary: "bi-info-circle-fill",
  info: "bi-info-circle-fill",
  warning: "bi-exclamation-triangle-fill",
  danger: "bi-x-circle-fill",
};

export function showToast(message, variant = "primary") {
  const container = ensureToastContainer();

  const toastEl = document.createElement("div");
  toastEl.className = `toast kg-toast kg-toast-${variant} align-items-center`;
  toastEl.setAttribute("role", "alert");
  toastEl.innerHTML = `
    <div class="d-flex align-items-start">
      <span class="kg-toast-icon"><i class="bi ${TOAST_ICONS[variant] || TOAST_ICONS.primary}"></i></span>
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close me-2 mt-2" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  container.appendChild(toastEl);
  const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
  toast.show();

  toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
}

export async function confirmAndRun(message, action) {
  const confirmed = await confirmAction(message);
  if (!confirmed) return false;
  await action();
  return true;
}

export function bindSelectAll(selectAllCheckboxId, itemCheckboxSelector) {
  document.getElementById(selectAllCheckboxId).addEventListener("change", (e) => {
    document.querySelectorAll(itemCheckboxSelector).forEach((cb) => (cb.checked = e.target.checked));
  });
}

export function confirmAction(message) {
  return new Promise((resolve) => {
    const modalId = "confirm-modal-" + Date.now();

    const modalEl = document.createElement("div");
    modalEl.className = "modal fade";
    modalEl.id = modalId;
    modalEl.setAttribute("tabindex", "-1");
    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-body">${message}</div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
            <button type="button" class="btn btn-danger" data-action="confirm">Confirm</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);
    const modal = new bootstrap.Modal(modalEl);

    let resolved = false;
    const settle = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    modalEl.querySelector('[data-action="confirm"]').addEventListener("click", () => {
      settle(true);
      modal.hide();
    });

    modalEl.querySelector('[data-action="cancel"]').addEventListener("click", () => {
      settle(false);
      modal.hide();
    });

    // Catches Esc key, backdrop click, or any other dismissal path
    modalEl.addEventListener("hidden.bs.modal", () => {
      settle(false);
      modalEl.remove();
    });

    modal.show();
  });
}

export function promptForText(message, defaultValue = "") {
  return new Promise((resolve) => {
    const modalId = "prompt-modal-" + Date.now();

    const modalEl = document.createElement("div");
    modalEl.className = "modal fade";
    modalEl.id = modalId;
    modalEl.setAttribute("tabindex", "-1");
    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-body">
            <label class="form-label">${message}</label>
            <input type="text" class="form-control" id="${modalId}-input" value="${defaultValue}">
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
            <button type="button" class="btn btn-primary" data-action="confirm">Save</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);
    const modal = new bootstrap.Modal(modalEl);
    const input = modalEl.querySelector(`#${modalId}-input`);

    let resolved = false;
    const settle = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    modalEl.querySelector('[data-action="confirm"]').addEventListener("click", () => {
      settle(input.value);
      modal.hide();
    });

    modalEl.querySelector('[data-action="cancel"]').addEventListener("click", () => {
      settle(null);
      modal.hide();
    });

    modalEl.addEventListener("hidden.bs.modal", () => {
      settle(null);
      modalEl.remove();
    });

    modalEl.addEventListener("shown.bs.modal", () => input.focus());

    // Enter key submits, matching normal form UX expectations
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        settle(input.value);
        modal.hide();
      }
    });

    modal.show();
  });
}