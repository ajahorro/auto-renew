import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/axios";
import AdminSidebar from "../../components/AdminSidebar";

const AdminNotifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await API.get("/notifications");
      const list = res.data?.notifications || res.data || [];
      setNotifications(list);
    } catch (err) {
      console.log("Admin notifications error:", err);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    try {
      await API.patch(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      window.dispatchEvent(new Event("notifUpdated"));
    } catch (err) {
      console.log("Mark read error:", err);
    }
  };

  const markAllRead = async () => {
    try {
      await API.patch("/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      window.dispatchEvent(new Event("notifUpdated"));
    } catch (err) {
      console.log("Mark all read error:", err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await API.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.log("Delete error:", err);
    }
  };

  const handleNotificationClick = (n) => {
    if (!n.isRead) markRead(n.id);
    
    // Navigate based on notification type and content
    if (n.type === "BOOKING" || n.type === "PAYMENT" || n.title?.toLowerCase().includes("booking") || n.title?.toLowerCase().includes("payment")) {
      navigate("/admin/bookings");
    } else if (n.title?.toLowerCase().includes("schedule")) {
      navigate("/admin/schedule");
    } else {
      navigate("/admin");
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "BOOKING": return "📅";
      case "PAYMENT": return "💰";
      case "STAFF": return "👤";
      default: return "🔔";
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "BOOKING": return "#3b82f6";
      case "PAYMENT": return "#22c55e";
      case "STAFF": return "#f59e0b";
      default: return "#94a3b8";
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div style={styles.page}>
      <AdminSidebar active="notifications" />

      <div style={styles.main}>
        <div style={styles.header}>
          <div>
            <h1>Notifications</h1>
            {unreadCount > 0 && (
              <p style={styles.unreadCount}>{unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button style={styles.markAllBtn} onClick={markAllRead}>
              Mark All as Read
            </button>
          )}
        </div>

        <div style={styles.card}>
          {loading ? (
            <p style={styles.loading}>Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>🔔</span>
              <p>No notifications yet.</p>
              <p style={styles.emptyHint}>You'll see updates about bookings, payments, and more here.</p>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                style={{
                  ...styles.row,
                  background: n.isRead ? "transparent" : "var(--bg-tertiary)",
                  borderLeft: n.isRead ? "4px solid var(--border-color)" : `4px solid ${getTypeColor(n.type)}`
                }}
                onClick={() => handleNotificationClick(n)}
              >
                <div style={styles.iconContainer}>
                  <span style={styles.icon}>{getTypeIcon(n.type)}</span>
                </div>
                <div style={styles.content}>
                  <div style={styles.titleRow}>
                    <strong style={{ color: n.isRead ? "var(--text-secondary)" : "var(--text-primary)" }}>
                      {n.title || "Notification"}
                    </strong>
                    {!n.isRead && <span style={styles.newBadge}>New</span>}
                  </div>
                  <p style={styles.message}>{n.message}</p>
                  <p style={styles.date}>
                    {new Date(n.createdAt).toLocaleString("en-PH", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                    })}
                  </p>
                </div>
                <button 
                  style={styles.deleteBtn}
                  onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    display: "flex",
    background: "var(--bg-primary)",
    minHeight: "100vh"
  },
  main: {
    marginLeft: "280px",
    width: "100%",
    padding: "40px",
    color: "var(--text-primary)",
    fontFamily: "Poppins, sans-serif"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "30px"
  },
  unreadCount: {
    color: "var(--accent-blue)",
    fontSize: "14px",
    marginTop: "4px"
  },
  markAllBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500"
  },
  card: {
    background: "var(--card-bg)",
    padding: "10px",
    borderRadius: "16px",
    border: "1px solid var(--border-color)"
  },
  loading: {
    padding: "40px",
    textAlign: "center",
    opacity: 0.7,
    color: "var(--text-secondary)"
  },
  emptyState: {
    padding: "60px",
    textAlign: "center"
  },
  emptyIcon: {
    fontSize: "48px",
    display: "block",
    marginBottom: "16px"
  },
  emptyHint: {
    opacity: 0.5,
    fontSize: "14px",
    marginTop: "8px",
    color: "var(--text-secondary)"
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    padding: "20px",
    borderRadius: "10px",
    marginBottom: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease"
  },
  iconContainer: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    background: "var(--bg-tertiary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginRight: "16px",
    flexShrink: 0
  },
  icon: {
    fontSize: "18px"
  },
  content: {
    flex: 1
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "4px"
  },
  newBadge: {
    background: "var(--accent-blue)",
    color: "#fff",
    padding: "2px 8px",
    borderRadius: "10px",
    fontSize: "10px",
    fontWeight: "700"
  },
  message: {
    opacity: 0.8,
    fontSize: "14px",
    margin: "4px 0",
    lineHeight: 1.4,
    color: "var(--text-secondary)"
  },
  date: {
    fontSize: "11px",
    opacity: 0.5,
    marginTop: "4px",
    color: "var(--text-secondary)"
  },
  deleteBtn: {
    background: "none",
    border: "none",
    color: "var(--text-secondary)",
    fontSize: "20px",
    cursor: "pointer",
    padding: "0 8px",
    marginLeft: "8px"
  }
};

export default AdminNotifications;
