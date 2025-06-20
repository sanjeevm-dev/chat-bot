import { createRoot } from "react-dom/client";
import ChatWidget from "./ChatWidget";
import "./index.css";

function injectWidget(options = {}) {
  if (document.getElementById("exthalpy-widget-container")) return;
  const container = document.createElement("div");
  container.id = "exthalpy-widget-container";
  document.body.appendChild(container);
  const shadow = container.attachShadow({ mode: "open" });
  const shadowRoot = document.createElement("div");
  shadow.appendChild(shadowRoot);
  const root = createRoot(shadowRoot);
  root.render(<ChatWidget {...options} />);
}

(window as any).Exthalpy = {
  init: injectWidget,
};
