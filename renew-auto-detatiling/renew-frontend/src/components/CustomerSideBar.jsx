import { useNavigate } from "react-router-dom";
import { useContext, useEffect, useState, useCallback, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import API from "../api/axios";
import toast from "react-hot-toast";
import { confirmAction } from "./ConfirmModal";
import { 
  LayoutDashboard, 
  CalendarPlus, 
  History, 
  Bell, 
  Settings, 
  LogOut 
} from "lucide-react";

const NavItem = ({ label, route, name, active, navigate, icon: Icon, notifCount }) => {
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
        marginBottom: "6px",
        cursor: "pointer",
        transition: "0.2s",
        background: isActive ? "var(--bg-tertiary)" : "transparent",
        color: isActive ? "var(--accent-blue)" : "var(--text-secondary)",
        fontWeight: isActive ? "600" : "400"
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
          background: "var(--accent-blue)",
          borderRadius: "0 4px 4px 0"
        }} />
      )}
    </div>
  );
};

const CustomerSidebar = ({ active }) => {
  const navigate = useNavigate();
  const { logout: contextLogout } = useContext(AuthContext);
  const [notifCount, setNotifCount] = useState(0);
  const lastCountRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await API.get("/notifications");
      const list = res.data?.notifications || res.data || [];
      const unread = list.filter(n => !n.isRead);
      const unreadCount = unread.length;
      
      if (unreadCount > lastCountRef.current) {
        const latest = unread[0];
        if (latest) {
          toast(latest.title || "New Notification", {
            icon: "🔔",
            style: {
              borderRadius: "10px",
              background: "var(--card-bg)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-color)",
            }
          });
        }
      }
      
      setNotifCount(unreadCount);
      lastCountRef.current = unreadCount;
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    const initNotifications = async () => {
      try {
        const res = await API.get("/notifications");
        const list = res.data?.notifications || res.data || [];
        const unreadCount = list.filter(n => !n.isRead).length;
        setNotifCount(unreadCount);
        lastCountRef.current = unreadCount;
      } catch {
        // Silently fail
      }
    };

    initNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
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
      borderRight: "1px solid var(--border-color)",
      fontFamily: "Poppins, system-ui",
      zIndex: 100
    }}>
      <div style={{
        fontSize: "22px",
        fontWeight: "800",
        color: "var(--text-primary)",
        marginBottom: "40px",
        display: "flex",
        alignItems: "center",
        gap: "10px"
      }}>
        <div style={{ width: "8px", height: "22px", background: "var(--accent-blue)", borderRadius: "4px" }} />
        RENEW
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <NavItem icon={LayoutDashboard} label="Dashboard" route="/customer" name="dashboard" active={active} navigate={navigate} notifCount={0} />
        <NavItem icon={CalendarPlus} label="Book Appointment" route="/customer/book" name="book" active={active} navigate={navigate} notifCount={0} />
        <NavItem icon={History} label="My Bookings" route="/customer/bookings" name="bookings" active={active} navigate={navigate} notifCount={0} />
        <NavItem icon={Bell} label="Notifications" route="/customer/notifications" name="notifications" active={active} navigate={navigate} notifCount={notifCount} />
      </div>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
        <NavItem icon={Settings} label="Settings" route="/customer/settings" name="settings" active={active} navigate={navigate} />
        <div
          onClick={logout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 16px",
            borderRadius: "10px",
            cursor: "pointer",
            background: "rgba(239, 68, 68, 0.1)",
            color: "var(--accent-red)",
            fontWeight: "600",
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

export default CustomerSidebar;