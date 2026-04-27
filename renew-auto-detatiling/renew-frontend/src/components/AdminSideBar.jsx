import { useContext, useEffect, useState, useCallback, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import toast from "react-hot-toast";
import { confirmAction } from "./ConfirmModal";
import { 
  LayoutDashboard, 
  Calendar, 
  ClipboardList, 
  CheckSquare, 
  BarChart3, 
  Bell, 
  Settings, 
  LogOut,
  History,
  Users
} from "lucide-react";

const NavItem = ({ label, route, name, isActive, onNavigate, notifCount, icon: Icon }) => {
  return (
    <div
      onClick={() => route && onNavigate(route)}
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
        color: isActive ? "var(--accent-blue)" : "var(--text-secondary)",
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
          background: "var(--accent-blue)",
          borderRadius: "0 4px 4px 0"
        }} />
      )}
    </div>
  );
};

const AdminSidebar = ({ active }) => {
  const navigate = useNavigate();
  const { logout: contextLogout } = useContext(AuthContext);
  const [notifCount, setNotifCount] = useState(0);
  const lastCountRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await API.get("/notifications");
      const list = res.data?.notifications || res.data || [];
      const unread = list.filter(n => !n.isRead);
      const unreadCount = unread.length;
      
      if (lastCountRef.current !== null && unreadCount > lastCountRef.current) {
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
          paddingLeft: "16px",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <div style={{ width: "8px", height: "24px", background: "var(--accent-blue)", borderRadius: "4px" }} />
          RENEW
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <NavItem icon={LayoutDashboard} label="Dashboard" route="/admin" name="dashboard" isActive={active === "dashboard"} onNavigate={navigate} notifCount={0} />
          <NavItem icon={Calendar} label="Schedule" route="/admin/schedule" name="schedule" isActive={active === "schedule"} onNavigate={navigate} notifCount={0} />
          <NavItem icon={ClipboardList} label="Booking Management" route="/admin/bookings" name="bookings" isActive={active === "bookings"} onNavigate={navigate} notifCount={0} />
          <NavItem icon={CheckSquare} label="Payment Verification" route="/admin/payments" name="payments" isActive={active === "payments"} onNavigate={navigate} notifCount={0} />
          <NavItem icon={BarChart3} label="Analytics" route="/admin/analytics" name="analytics" isActive={active === "analytics"} onNavigate={navigate} notifCount={0} />
          <NavItem icon={Users} label="Staff Management" route="/admin/staff" name="staff" isActive={active === "staff"} onNavigate={navigate} notifCount={0} />
          <NavItem icon={History} label="Audit Logs" route="/admin/audit" name="audit" isActive={active === "audit"} onNavigate={navigate} notifCount={0} />
          <NavItem icon={Bell} label="Notifications" route="/admin/notifications" name="notifications" isActive={active === "notifications"} onNavigate={navigate} notifCount={notifCount} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <NavItem icon={Settings} label="Settings" route="/admin/settings" name="settings" isActive={active === "settings"} onNavigate={navigate} notifCount={0} />
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

export default AdminSidebar;
