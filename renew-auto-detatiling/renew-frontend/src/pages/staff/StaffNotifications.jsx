import { useEffect, useState } from "react";
import API from "../../api/axios";
import StaffSidebar from "../../components/StaffSidebar";

const StaffNotifications = () => {

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await API.get("/notifications");
      const list = Array.isArray(res.data) ? res.data : res.data.notifications || [];
      setNotifications(list);
    } catch (err) {
      console.log("Notifications fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    try {
      await API.patch(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n =>
          n.id === id ? { ...n, isRead: true } : n
        )
      );
      window.dispatchEvent(new Event("notifUpdated"));
    } catch (err) {
      console.log(err);
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

  const getTypeColor = (type) => {
    const colors = {
      BOOKING: "#3b82f6",
      PAYMENT: "#22c55e",
      GENERAL: "#94a3b8"
    };
    return colors[type] || "#94a3b8";
  };

  return (
    <div style={styles.page}>
      <StaffSidebar active="notifications"/>
      <div style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.title}>Notifications</h1>
          {notifications.some(n => !n.isRead) && (
            <button style={styles.markAllBtn} onClick={markAllRead}>
              Mark All as Read
            </button>
          )}
        </div>

        {loading && <p style={styles.loading}>Loading notifications...</p>}

        {!loading && notifications.length === 0 && (
          <div style={styles.emptyState}>
            <p>No notifications yet.</p>
            <p style={{fontSize:"14px", opacity:0.6}}>You'll see updates about your assigned bookings here.</p>
          </div>
        )}

        <div style={styles.list}>
          {notifications.map(n => (
            <div
              key={n.id}
              style={{
                ...styles.card,
                background: n.isRead ? "var(--card-bg)" : "var(--bg-tertiary)",
                borderLeft: n.isRead ? "3px solid var(--border-color)" : `3px solid ${getTypeColor(n.type)}`
              }}
              onClick={() => markRead(n.id)}
            >
              <div style={styles.cardHeader}>
                <strong style={styles.notifTitle}>{n.title || "Notification"}</strong>
                <span style={{...styles.badge, background: getTypeColor(n.type)}}>
                  {n.type}
                </span>
              </div>
              <p style={styles.message}>{n.message}</p>
              {n.createdAt && (
                <p style={styles.date}>
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    display: "flex",
    background: "var(--bg-primary)",
    minHeight: "100vh",
    fontFamily: "Poppins, system-ui"
  },
  main: {
    marginLeft: "260px",
    padding: "40px",
    width: "100%",
    color: "var(--text-primary)"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "30px"
  },
  title: {
    margin: 0,
    color: "var(--text-primary)"
  },
  loading: {
    opacity: 0.7,
    color: "var(--text-secondary)"
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    background: "var(--card-bg)",
    borderRadius: "14px"
  },
  markAllBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    cursor: "pointer",
    fontSize: "13px"
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "14px"
  },
  card: {
    padding: "18px",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "0.2s"
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px"
  },
  notifTitle: {
    fontSize: "15px",
    color: "var(--text-primary)"
  },
  badge: {
    padding: "2px 8px",
    borderRadius: "6px",
    fontSize: "10px",
    fontWeight: "600",
    color: "#fff"
  },
  message: {
    opacity: 0.85,
    marginBottom: "8px",
    lineHeight: 1.5,
    color: "var(--text-secondary)"
  },
  date: {
    fontSize: "12px",
    opacity: 0.5,
    color: "var(--text-secondary)"
  }
};

export default StaffNotifications;
