import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./app";
import { BASE_PATH } from "./config";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={BASE_PATH || "/"}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
