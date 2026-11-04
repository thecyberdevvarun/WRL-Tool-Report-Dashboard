import { lazy, Suspense, useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { useRoleAccess } from "./hooks/useRoleAccess.js";
import { ROUTE_CONFIG, ROLES } from "./config/routes.config.js";
import { initializePermissions } from "./utils/permissionStore";

const Layout     = lazy(() => import("./components/Layout"));
const Login      = lazy(() => import("./pages/Auth/Login"));
const Home       = lazy(() => import("./pages/Home"));
const NotFound   = lazy(() => import("./pages/NotFound"));
const Monitoring = lazy(() => import("./pages/Display/ProductionDashboard/Monitoring.jsx"));
const Settings   = lazy(() => import("./pages/Settings/Settings"));
const MailServerConfig = lazy(() => import("./pages/Settings/MailServerConfig"));
const UserManagement = lazy(() => import("./pages/Settings/UserManagement"));

// ── Seed permissions from routeConfig on first ever load ─────────────────────
// This runs once. After that, the stored permissions are used.
// If you add new routes, call resetPermissionInit() from the browser console
// (or the Reset button in Settings) to re-seed.
initializePermissions(ROUTE_CONFIG, ROLES, ROLES.SUPER_ADMIN);

function App() {
  const [isSidebarExpanded, setSidebarExpanded] = useState(false);
  const { accessibleRoutes } = useRoleAccess();

  const toggleSidebar = () => setSidebarExpanded((prev) => !prev);

  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500" />
        </div>
      }
    >
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/display/:slug" element={<Monitoring />} />

        {/* Protected layout routes */}
        <Route element={<ProtectedRoute />}>
          <Route
            element={
              <Layout
                isSidebarExpanded={isSidebarExpanded}
                toggleSidebar={toggleSidebar}
              />
            }
          >
            <Route path="/" index element={<Home />} />

            {/* Settings — always registered, guarded inside the component */}
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/mail-server" element={<MailServerConfig />} />
            <Route path="/settings/user-management" element={<UserManagement />} />

            {/* Dynamic role-based routes */}
            {accessibleRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={<route.component />}
              />
            ))}

            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
