import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { confirmAction } from "./ConfirmModal";

const CustomerSidebar = ({ active }) => {

  const navigate = useNavigate();
  const { logout: contextLogout } = useContext(AuthContext);

  const logout = async () => {
    const confirmed = await confirmAction({
      title: "Log Out",
      message: "Are you sure you want to log out?",
      confirmText: "Yes, Log Out",
      cancelText: "Cancel",
      type: "danger"
    });
    
    if (!confirmed) return;

    contextLogout();
    navigate("/login");

  };

  const NavItem = ({ label, route, name }) => {
    const isActive = active === name;
    return (
      <div
        onClick={() => route && navigate(route)}
        style={{
          padding: "12px 16px",
          borderRadius: "10px",
          marginBottom: "6px",
          cursor: "pointer",
          transition: "0.2s",
          background: isActive ? "var(--bg-tertiary)" : "transparent",
          color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
          fontWeight: isActive ? "600" : "400"
        }}
      >
        {label}
      </div>
    );
  };

  return (
    <div style={{
      width: "260px",
      height: "100vh",
      position: "fixed",
      left: 0,
      top: 0,
      background: "var(--sidebar-bg)",
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      borderRight: "1px solid var(--border-color)",
      fontFamily: "Poppins, system-ui",
      zIndex: 100
    }}>
      <div style={{
        fontSize: "22px",
        fontWeight: "700",
        letterSpacing: "1px",
        color: "var(--text-primary)",
        marginBottom: "30px"
      }}>
        RENEW
      </div>

      <div style={{ flex: 1 }}>
        <NavItem label="Dashboard" route="/customer" name="dashboard" />
        <NavItem label="Book Appointment" route="/customer/book" name="book" />
        <NavItem label="My Bookings" route="/customer/bookings" name="bookings" />
        <NavItem label="Notifications" route="/customer/notifications" name="notifications" />
      </div>

      <div style={{ marginTop: "auto" }}>
        <div
          onClick={() => navigate("/customer/settings")}
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "8px",
            cursor: "pointer",
            background: active === "settings" ? "var(--bg-tertiary)" : "transparent",
            color: active === "settings" ? "var(--text-primary)" : "var(--text-secondary)",
            fontWeight: active === "settings" ? "600" : "400"
          }}
        >
          Settings
        </div>

        <div
          onClick={logout}
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            cursor: "pointer",
            background: "var(--accent-red)",
            textAlign: "center",
            color: "white",
            fontWeight: "600"
          }}
        >
          Log Out
        </div>
      </div>
    </div>
  );
};

export default CustomerSidebar;
