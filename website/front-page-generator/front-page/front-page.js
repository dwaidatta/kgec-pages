export function applyLayout(layout) {
  const inner = document.querySelector(".inner-frame");

  const pm = layout.pageMargin || {};
  if (pm.left != null) inner.style.setProperty("--margin-left", pm.left + "mm");
  if (pm.right != null) inner.style.setProperty("--margin-right", pm.right + "mm");
  if (pm.top != null) inner.style.setProperty("--margin-top", pm.top + "mm");
  if (pm.bottom != null) inner.style.setProperty("--margin-bottom", pm.bottom + "mm");

  const border = layout.pageBorder || {};
  if (border.thickness != null) inner.style.setProperty("--border-thickness", border.thickness + "mm");

  const emblem = layout.collegeEmblem || {};
  if (emblem.size != null) inner.style.setProperty("--emblem-size", emblem.size + "mm");
  renderEmblemStyle(emblem.textStyle || "straight");

  const detailsFontSize = layout.detailsSpace?.fontSize;
  if (detailsFontSize != null) inner.style.setProperty("--fs-details", detailsFontSize + "mm");

  const sessionFontSize = layout.academicSession?.fontSize;
  if (sessionFontSize != null) inner.style.setProperty("--fs-session", sessionFontSize + "mm");

  renderTitle(layout.titleSpace || []);
  renderDetails(layout.detailsSpace?.rows || []);
  renderSession(layout.academicSession || {});
}

function renderEmblemStyle(textStyle) {
  const straight = document.getElementById("emblem-straight");
  const curved = document.getElementById("emblem-curved");

  straight.style.display = textStyle === "curved" ? "none" : "block";
  curved.style.display = textStyle === "curved" ? "block" : "none";
}

function renderTitle(lines) {
  const titleEl = document.getElementById("group-title");
  titleEl.innerHTML = "";

  lines.forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line.text || "";
    p.style.fontWeight = line.bold ? "700" : "400";
    p.style.fontStyle = line.italic ? "italic" : "normal";
    p.style.textDecoration = line.underline ? "underline" : "none";
    p.style.fontSize = (line.fontSize != null ? line.fontSize : 5) + "mm";
    titleEl.appendChild(p);
  });
}

function renderDetails(rows) {
  const detailsEl = document.getElementById("group-details");
  detailsEl.innerHTML = "";

  rows.forEach((row) => {
    const div = document.createElement("div");
    div.className = "details-row";

    const label = document.createElement("span");
    label.className = "details-label";
    label.textContent = (row.label || "") + ": ";

    const value = document.createElement("span");
    value.className = "details-value";
    value.textContent = row.value || "";

    div.appendChild(label);
    div.appendChild(value);
    detailsEl.appendChild(div);
  });
}

function renderSession(session) {
  const sessionEl = document.getElementById("group-session");
  sessionEl.innerHTML = "";

  if (!session.text) return;

  const displayText = session.mode === "onlyYear"
    ? session.text
    : "Academic Session: " + session.text;

  const span = document.createElement("span");
  span.textContent = displayText;
  sessionEl.appendChild(span);
}

window.applyLayout = applyLayout;