import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./shared/AuthContext.jsx";
// Module imports are evaluated before the shared baseline. Glass effects are
// scoped to module previews so the existing account screens keep their styles.
import "./shared/styles.css";
import "./glass.css";
import "./shared/module-navigation.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider><App /></AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
