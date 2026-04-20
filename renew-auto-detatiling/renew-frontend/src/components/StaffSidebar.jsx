import { useNavigate } from "react-router-dom";
import { useContext, useEffect, useState, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import { confirmAction } from "./ConfirmModal";
import API from "../api/axios";
import { 
  LayoutDashboard, 
  ClipboardCheck, 
  Bell, 
  Settings, 
  LogOut 
} from "lucide-react";

const NavItem = ({ label, route, name, active, navigate, notifCount, icon: Icon }) => {
  const isActive = active === name;
  return (
    <div
      onClick={() => route && navigate(route)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        borderRadius: "10px",
        marginBottom: "8px",
        cursor: "pointer",
        transition: "0.2s all ease",
        position: "relative",
        background: isActive ? "var(--bg-tertiary)" : "transparent",
        color: isActive ? "var(--accent-yellow)" : "var(--text-secondary)",
        fontWeight: isActive ? "600" : "400",
      }}
    >
      {Icon && <Icon size={20} />}
      <span style={{ fontSize: "14px" }}>{label}</span>
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
      {isActive && (
        <div style={{
          position: "absolute",
          left: 0,
          top: "20%",
          bottom: "20%",
          width: "4px",
          background: "var(--accent-yellow)",
          borderRadius: "0 4px 4px 0"
        }} />
      )}
    </div>
  );
};

const StaffSidebar = ({ active }) => {
  const navigate = useNavigate();
  const { logout: contextLogout } = useContext(AuthContext);
  const [notifCount, setNotifCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await API.get("/notifications");
      const list = Array.isArray(res.data) ? res.data : res.data.notifications || [];
      setNotifCount(list.filter(n => !n.isRead).length);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    window.addEventListener("notifUpdated", fetchNotifications);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notifUpdated", fetchNotifications);
    };
  }, [fetchNotifications]);

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
      justifyContent: "space-between",
      borderRight: "1px solid var(--border-color)",
      fontFamily: "Poppins, sans-serif",
      zIndex: 100
    }}>
      <div>
        <div style={{
          fontSize: "24px",
          fontWeight: "800",
          color: "var(--accent-yellow)",
          marginBottom: "40px",
          paddingLeft: "16px",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <div style={{ width: "8px", height: "24px", background: "var(--accent-yellow)", borderRadius: "4px" }} />
          STAFF
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <NavItem icon={LayoutDashboard} label="Dashboard" route="/staff" name="dashboard" active={active} navigate={navigate} notifCount={0} />
          <NavItem icon={ClipboardCheck} label="My Tasks" route="/staff/tasks" name="tasks" active={active} navigate={navigate} notifCount={0} />
          <NavItem icon={Bell} label="Notifications" route="/staff/notifications" name="notifications" active={active} navigate={navigate} notifCount={notifCount} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <NavItem icon={Settings} label="Settings" route="/staff/settings" name="settings" active={active} navigate={navigate} notifCount={0} />
        <div 
          onClick={logout} 
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 16px",
            borderRadius: "10px",
            background: "rgba(239, 68, 68, 0.1)",
            color: "var(--accent-red)",
            fontWeight: "600",
            cursor: "pointer",
            transition: "0.2s"
          }}
        >
          <LogOut size={20} />
          <span style={{ fontSize: "14px" }}>Log Out</span>
        </div>
      </div>
    </div>
  );
};

export default StaffSidebar;