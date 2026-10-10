import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { RoleProvider } from "@/context/role-context";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><BrowserRouter><RoleProvider><App /></RoleProvider></BrowserRouter></StrictMode>,
);
