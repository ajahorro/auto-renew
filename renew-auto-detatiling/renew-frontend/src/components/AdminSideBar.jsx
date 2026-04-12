import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import { confirmAction } from "./ConfirmModal";

const AdminSidebar = ({ active }) => {

  const navigate = useNavigate();
  const { logout: contextLogout } = useContext(AuthContext);
  const [notifCount, setNotifCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await API.get("/notifications");
      const list = res.data?.notifications || res.data || [];
      setNotifCount(list.filter(n => !n.isRead).length);
    } catch (err) { }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    const handleUpdate = () => fetchNotifications();
    window.addEventListener("notifUpdated", handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notifUpdated", handleUpdate);
    };
  }, []);

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
          borderRadius: "8px",
          marginBottom: "8px",
          cursor: "pointer",
          transition: "0.2s all ease",
          position: "relative",
          background: isActive ? "var(--bg-tertiary)" : "transparent",
          color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
          fontWeight: isActive ? "600" : "400",
          borderLeft: isActive ? "4px solid var(--accent-blue)" : "4px solid transparent"
        }}
      >
        {label}
        {name === "notifications" && notifCount > 0 && (
          <span style={{
            position: "absolute",
            right: "16px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "var(--accent-red)",
            color: "#fff",
            borderRadius: "10px",
            padding: "2px 8px",
            fontSize: "10px",
            fontWeight: "bold"
          }}>{notifCount}</span>
        )}
      </div>
    );
  };

  return (
    <div style={{
      width: "280px",
      height: "100vh",
      position: "fixed",
      left: 0,
      top: 0,
      background: "var(--sidebar-bg)",
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      borderRight: "1px solid var(--border-color)",
      fontFamily: "Poppins, sans-serif",
      zIndex: 100
    }}>
      <div>
        <div style={{
          fontSize: "24px",
          fontWeight: "800",
          color: "var(--text-primary)",
          marginBottom: "40px",
          paddingLeft: "16px"
        }}>RENEW</div>
        <div style={{ flex: 1 }}>
          <NavItem label="Dashboard" route="/admin" name="dashboard" />
          <NavItem label="Schedule" route="/admin/schedule" name="schedule" />
          <NavItem label="Booking Management" route="/admin/bookings" name="bookings" />
          <NavItem label="Notifications" route="/admin/notifications" name="notifications" />
        </div>
      </div>

      <div>
        <div
          onClick={() => navigate("/admin/settings")}
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            cursor: "pointer",
            marginBottom: "8px",
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
            padding: "12px",
            borderRadius: "8px",
            background: "var(--accent-red)",
            color: "#fff",
            textAlign: "center",
            fontWeight: "600",
            cursor: "pointer",
            marginTop: "10px"
          }}
        >
          Log Out
        </div>
      </div>
    </div>
  );
};

export default AdminSidebar;
