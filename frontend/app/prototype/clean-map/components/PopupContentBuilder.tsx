import { createRoot, type Root } from "react-dom/client";
import { Popup } from "./Popup";
import type { CleanKos, Destination } from "../../../../types/kos";

const rootMap = new WeakMap<HTMLElement, Root>();
const observerMap = new WeakMap<HTMLElement, MutationObserver>();

export function buildPopupContent(
  kos: CleanKos,
  destinations: Destination[],
  onDrawRoute: (coords: Array<[number, number]>) => void,
  onClearRoute: () => void,
): HTMLDivElement {
  const container = document.createElement("div");
  container.style.width = "min(360px, 78vw)";

  const root = createRoot(container);
  rootMap.set(container, root);

  root.render(
    <Popup
      kos={kos}
      destinations={destinations}
      onShowRoute={onDrawRoute}
      onClearRoute={onClearRoute}
    />,
  );

  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      root.unmount();
      observer.disconnect();
      rootMap.delete(container);
      observerMap.delete(container);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  observerMap.set(container, observer);

  return container;
}

export function cleanupPopup(container: HTMLElement) {
  const root = rootMap.get(container);
  if (root) {
    root.unmount();
    rootMap.delete(container);
  }
  const observer = observerMap.get(container);
  if (observer) {
    observer.disconnect();
    observerMap.delete(container);
  }
}
