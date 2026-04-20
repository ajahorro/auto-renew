import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: "20px" }}>Loading...</div>;
  }

  // 1. If not logged in at all, go to login
  if (!user || !user.role) {
    return <Navigate to="/login" replace />;
  }

  const role = user.role?.toUpperCase();

  // 2. If logged in but WRONG role, go to their actual dashboard
  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirect based on who they actually are
    if (role === "ADMIN" || role === "SUPER_ADMIN") return <Navigate to="/admin" replace />;
    if (role === "STAFF") return <Navigate to="/staff" replace />;
    return <Navigate to="/customer" replace />;
  }

  return children;
}

export default ProtectedRoute;