import type { CleanKos } from "../../../../types/kos";
import { markerColors } from "../../../../lib/kos-helpers";

export function buildMarkerElement(kos: CleanKos): HTMLDivElement {
  const colors = markerColors(kos.jenis_kos);
  const el = document.createElement("div");
  el.textContent = colors.letter;
  el.style.width = "38px";
  el.style.height = "38px";
  el.style.borderRadius = "999px";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.backgroundColor = colors.bg;
  el.style.border = `3px solid ${colors.border}`;
  el.style.boxShadow = "0 10px 24px rgba(15, 23, 42, 0.22), 0 0 0 3px #ffffff";
  el.style.color = colors.text;
  el.style.fontSize = "14px";
  el.style.fontWeight = "900";
  el.style.cursor = "pointer";
  el.style.userSelect = "none";
  return el;
}
