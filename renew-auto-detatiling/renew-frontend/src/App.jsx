import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

/* ================= AUTH ================= */
import Login from "./pages/Login";
import Register from "./pages/Register";

/* ================= ADMIN ================= */
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminBookingView from "./pages/admin/AdminBookingView";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminSchedule from "./pages/admin/AdminSchedule";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminServices from "./pages/admin/AdminServices";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminPayments from "./pages/admin/AdminPayments";

/* ================= STAFF ================= */
import StaffDashboard from "./pages/staff/StaffDashboard";
import StaffNotifications from "./pages/staff/StaffNotifications";
import StaffSettings from "./pages/staff/StaffSettings";
import StaffTasks from "./pages/staff/StaffTasks";

/* ================= CUSTOMER ================= */
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import BookAppointment from "./pages/customer/BookAppointment";
import MyBookings from "./pages/customer/MyBookings";
import Notifications from "./pages/customer/Notifications";
import CustomerSettings from "./pages/customer/CustomerSettings";

/* ================= PROTECTION ================= */
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <>
      <Toaster
  position="top-right"
  toastOptions={{
    duration: 3000,
    style: {
      background: "#020617",
      color: "#e2e8f0",
      border: "1px solid #1e293b",
      fontSize: "13px"
    },
    success: {
      iconTheme: {
        primary: "#38bdf8",
        secondary: "#020617"
      }
    },
    error: {
      iconTheme: {
        primary: "#ef4444",
        secondary: "#020617"
      }
    }
  }}
/>

      <Routes>

        {/* ROOT */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* AUTH */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* ================= ADMIN ================= */}

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/bookings"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
              <AdminBookings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/bookings/:id"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
              <AdminBookingView />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/customers"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
              <AdminCustomers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/schedule"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
              <AdminSchedule />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/services"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
              <AdminServices />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/notifications"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
              <AdminNotifications />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/payments"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
              <AdminPayments />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
              <AdminSettings />
            </ProtectedRoute>
          }
        />

        {/* ================= STAFF ================= */}

        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={["STAFF"]}>
              <StaffDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/staff/tasks"
          element={
            <ProtectedRoute allowedRoles={["STAFF"]}>
              <StaffTasks />
            </ProtectedRoute>
          }
        />

        <Route
          path="/staff/notifications"
          element={
            <ProtectedRoute allowedRoles={["STAFF"]}>
              <StaffNotifications />
            </ProtectedRoute>
          }
        />

        <Route
          path="/staff/settings"
          element={
            <ProtectedRoute allowedRoles={["STAFF"]}>
              <StaffSettings />
            </ProtectedRoute>
          }
        />

        {/* ================= CUSTOMER ================= */}

        <Route
          path="/customer"
          element={
            <ProtectedRoute allowedRoles={["CUSTOMER"]}>
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/book"
          element={
            <ProtectedRoute allowedRoles={["CUSTOMER"]}>
              <BookAppointment />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/bookings"
          element={
            <ProtectedRoute allowedRoles={["CUSTOMER"]}>
              <MyBookings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/notifications"
          element={
            <ProtectedRoute allowedRoles={["CUSTOMER"]}>
              <Notifications />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/settings"
          element={
            <ProtectedRoute allowedRoles={["CUSTOMER"]}>
              <CustomerSettings />
            </ProtectedRoute>
          }
        />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </>
  );
}

export default App;