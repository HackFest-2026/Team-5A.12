import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { LoadingState } from "@/components/data-state";
import { useRole } from "@/context/role-context";
import { LoginPage } from "@/pages/login";
import type { Role } from "@/lib/api";

const DashboardPage = lazy(() => import("@/pages/dashboard").then((m) => ({ default: m.DashboardPage })));
const CashflowPage = lazy(() => import("@/pages/cashflow").then((m) => ({ default: m.CashflowPage })));
const InvoicesPage = lazy(() => import("@/pages/invoices").then((m) => ({ default: m.InvoicesPage })));
const PaymentsPage = lazy(() => import("@/pages/payments").then((m) => ({ default: m.PaymentsPage })));
const CustomersPage = lazy(() => import("@/pages/customers").then((m) => ({ default: m.CustomersPage })));
const DisputesPage = lazy(() => import("@/pages/disputes").then((m) => ({ default: m.DisputesPage })));
const ApprovalsPage = lazy(() => import("@/pages/approvals").then((m) => ({ default: m.ApprovalsPage })));
const AuditPage = lazy(() => import("@/pages/audit").then((m) => ({ default: m.AuditPage })));
const TenantsPage = lazy(() => import("@/pages/tenants").then((m) => ({ default: m.TenantsPage })));

function Guard({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { role } = useRole();
  return roles.includes(role) ? children : <Navigate to="/" replace />;
}

export default function App(){
  const { user, loading } = useRole();
  if (loading) return <div className="grid min-h-screen place-items-center bg-canvas"><LoadingState/></div>;
  if (!user) return <LoginPage/>;
  return <AppShell><Suspense fallback={<LoadingState/>}><Routes>
  <Route path="/" element={<DashboardPage/>}/>
  <Route path="/cashflow" element={<Guard roles={["cfo","manager"]}><CashflowPage/></Guard>}/>
  <Route path="/invoices" element={<Guard roles={["cfo","manager","customer"]}><InvoicesPage/></Guard>}/>
  <Route path="/payments" element={<Guard roles={["cfo","manager","customer"]}><PaymentsPage/></Guard>}/>
  <Route path="/customers" element={<Guard roles={["cfo","manager"]}><CustomersPage/></Guard>}/>
  <Route path="/disputes" element={<Guard roles={["cfo","manager","customer"]}><DisputesPage/></Guard>}/>
  <Route path="/approvals" element={<Guard roles={["cfo","manager"]}><ApprovalsPage/></Guard>}/>
  <Route path="/audit" element={<Guard roles={["cfo","manager","platform_admin"]}><AuditPage/></Guard>}/>
  <Route path="/tenants" element={<Guard roles={["platform_admin"]}><TenantsPage/></Guard>}/>
  <Route path="*" element={<Navigate to="/" replace/>}/>
</Routes></Suspense></AppShell>}
