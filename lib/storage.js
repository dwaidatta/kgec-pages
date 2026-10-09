import { showToast } from "./ui.js";
const KEYS = {
  USERS: "kgec_pages_users",
  DEFAULT_LAYOUT: "kgec_pages_default_layout",
  LAYOUTS: "kgec_pages_layouts",
  TOPSHEET_LAYOUTS: "kgec_pages_topsheet_layouts",
  TOPSHEET_LAST_USED_LAYOUT: "kgec_pages_topsheet_last_used_layout",
  SUBJECTS: "kgec_pages_subjects",
  LAST_USED_LAYOUT: "kgec_pages_last_used_layout",
  PENDING_MERGE: "kgec_pages_pending_merge",
  SIGNATURES: "kgec_pages_signatures",
};

export function getItem(key) {
  const raw = localStorage.getItem(key);
  
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } 
  catch (err) {
    showToast(`Saved data for "${key}" is corrupted and was ignored.`, "warning");
    return null;
  }
}

export function setItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  }
  catch (err) {
    showToast(`Could not save "${key}" on this device (storage full or blocked).`, "danger");
    return false;
  }
}

export function removeItem(key) {
  localStorage.removeItem(key);
}

export { KEYS };
