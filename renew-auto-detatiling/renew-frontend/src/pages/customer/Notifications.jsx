import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CustomerSidebar from "../../components/CustomerSideBar";
import API from "../../api/axios";

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await API.get("/notifications");
      setNotifications(res.data.notifications || []);
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
    } catch (err) {
      console.log(err);
    }
  };

  const handleNotificationClick = (n) => {
    if (!n.isRead) markRead(n.id);
    
    const bookingId = n.bookingId || n.targetId || n.relatedId;
    if (bookingId) {
      navigate(`/customer/bookings/${bookingId}`);
    }
  };

  const markAllRead = async () => {
    try {
      await API.patch("/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div style={styles.page}>
      <CustomerSidebar active="notifications" />
      <div style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.title}>Notifications</h1>
          {notifications.some(n => !n.isRead) && (
            <button style={styles.markAllBtn} onClick={markAllRead}>
              Mark all as read
            </button>
          )}
        </div>
        {loading && <p style={{ color: "var(--text-secondary)" }}>Loading notifications...</p>}
        {!loading && notifications.length === 0 && (
          <p style={{ color: "var(--text-secondary)" }}>No notifications yet.</p>
        )}
        <div style={styles.list}>
          {notifications.map(n => (
            <div
              key={n.id}
              style={{
                ...styles.card,
                background: n.isRead ? "var(--bg-secondary)" : "var(--bg-tertiary)"
              }}
              onClick={() => handleNotificationClick(n)}
            >
              <div style={styles.row}>
                <strong style={{ color: "var(--text-primary)" }}>{n.title || "Notification"}</strong>
                {!n.isRead && <span style={styles.unread}>New</span>}
              </div>
              <p style={styles.message}>{n.message}</p>
              {n.createdAt && (
                <p style={styles.date}>{new Date(n.createdAt).toLocaleString()}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

};

const styles = {

  page:{
    display:"flex",
    background:"var(--bg-primary)",
    minHeight:"100vh",
    fontFamily:"Poppins, system-ui"
  },

  main:{
    marginLeft:"250px",
    padding:"40px",
    width:"100%",
    color:"var(--text-primary)"
  },

  title:{
    marginBottom:0,
    color:"var(--text-primary)"
  },

  header:{
    display:"flex",
    justifyContent:"space-between",
    alignItems:"center",
    marginBottom:"30px"
  },

  markAllBtn:{
    background:"transparent",
    border:"1px solid var(--accent-blue)",
    color:"var(--accent-blue)",
    padding:"8px 16px",
    borderRadius:"8px",
    cursor:"pointer",
    fontSize:"13px",
    fontWeight:"600",
    transition:"0.2s"
  },

  list:{
    display:"flex",
    flexDirection:"column",
    gap:"14px"
  },

  card:{
    padding:"18px",
    borderRadius:"12px",
    cursor:"pointer",
    background:"var(--bg-secondary)",
    border:"1px solid var(--border-color)"
  },

  row:{
    display:"flex",
    justifyContent:"space-between",
    marginBottom:"6px"
  },

  unread:{
    background:"var(--accent-blue)",
    color:"white",
    padding:"2px 8px",
    borderRadius:"6px",
    fontSize:"12px"
  },

  message:{
    opacity:0.9,
    marginBottom:"6px",
    color:"var(--text-secondary)"
  },

  date:{
    fontSize:"12px",
    opacity:0.6,
    color:"var(--text-secondary)"
  }

};

export default Notifications;
