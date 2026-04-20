import { useAuth } from "../../context/AuthContext";
import API from "../../api/axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/AdminSidebar";

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [analytics, setAnalytics] = useState({
    totalBookings: 0,
    completedBookings: 0,
    totalRevenue: 0,
    pendingReceivables: 0
  });

  const [bookings, setBookings] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [statusCounts, setStatusCounts] = useState({
    PENDING: 0, CONFIRMED: 0, ONGOING: 0, COMPLETED: 0, CANCELLED: 0
  });

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const analyticsRes = await API.get("/bookings/admin-analytics");
        if (analyticsRes.data.success) {
          const { counts, finances } = analyticsRes.data.analytics || {};
          setAnalytics({
            totalBookings: counts?.total || 0,
            completedBookings: counts?.completed || 0,
            totalRevenue: finances?.totalRevenue || 0,
            pendingReceivables: finances?.pendingRevenue || 0
          });
          // Update status counts from analytics - include ALL statuses
          if (counts) {
            setStatusCounts({
              PENDING: (counts.pending || 0) + (counts.pendingPayment || 0),
              CONFIRMED: (counts.confirmed || 0) + (counts.scheduled || 0),
              ONGOING: counts.ongoing || 0,
              COMPLETED: counts.completed || 0,
              CANCELLED: counts.cancelled || 0
            });
          }
        }

        const bookingsRes = await API.get("/bookings");
        const list = Array.isArray(bookingsRes.data) 
          ? bookingsRes.data 
          : (bookingsRes.data.bookings || []);
        
        setBookings(list.slice(0, 5));

        // Count all statuses from actual bookings
        const statusCounts = { PENDING: 0, SCHEDULED: 0, ONGOING: 0, COMPLETED: 0, CANCELLED: 0, DRAFT: 0, CONFIRMED: 0 };
        const unassignedList = [];

        list.forEach(b => {
          const status = b.status?.toUpperCase();
          if (statusCounts[status] !== undefined) {
            statusCounts[status]++;
          }
          if (!b.assignedStaffId && !["CANCELLED", "COMPLETED"].includes(b.status)) {
            unassignedList.push(b);
          }
        });

        setStatusCounts({
          PENDING: statusCounts.PENDING,
          CONFIRMED: statusCounts.CONFIRMED + statusCounts.SCHEDULED,
          ONGOING: statusCounts.ONGOING,
          COMPLETED: statusCounts.COMPLETED,
          CANCELLED: statusCounts.CANCELLED
        });
        setUnassigned(unassignedList.slice(0, 5));
      } catch (err) {
        console.error("Dashboard data fetch error:", err);
      }
    };

    loadDashboardData();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING": return "#facc15";
      case "CONFIRMED": return "#3b82f6";
      case "ONGOING": return "#a855f7";
      case "COMPLETED": return "#22c55e";
      case "CANCELLED": return "#ef4444";
      default: return "#64748b";
    }
  };

  // Navigate to bookings page with filter
  const navigateToBookings = (status = "") => {
    if (status) {
      navigate(`/admin/bookings?status=${status}`);
    } else {
      navigate("/admin/bookings");
    }
  };

  return (
    <div style={styles.page}>
      <AdminSidebar active="dashboard" />

      <div style={styles.main}>
        <div style={styles.header}>
          <h1 style={{ color: 'var(--text-primary)' }}>Welcome back, {user?.fullName || "Admin"}!</h1>
          <p style={{ opacity: 0.6, color: 'var(--text-secondary)' }}>Here is what's happening at RENEW today.</p>
        </div>

        {/* METRICS - Now clickable */}
        <div style={styles.grid}>
          <div style={styles.clickableCard} onClick={() => navigateToBookings()}>
            <p style={styles.cardLabel}>Total Bookings</p>
            <h2 style={styles.cardValue}>{analytics.totalBookings}</h2>
            <p style={styles.cardHint}>Click to view all</p>
          </div>
          <div style={styles.clickableCard} onClick={() => navigateToBookings("COMPLETED")}>
            <p style={styles.cardLabel}>Completed</p>
            <h2 style={styles.cardValue}>{analytics.completedBookings}</h2>
            <p style={styles.cardHint}>Click to view completed</p>
          </div>
          <div style={styles.clickableCard}>
            <p style={styles.cardLabel}>Total Revenue</p>
            <h2 style={{ ...styles.cardValue, color: 'var(--accent-green)' }}>
              ₱{analytics.totalRevenue?.toLocaleString()}
            </h2>
            <p style={styles.cardHint}>From completed bookings</p>
          </div>
          <div style={styles.clickableCard}>
            <p style={styles.cardLabel}>Pending Payments</p>
            <h2 style={{ ...styles.cardValue, color: 'var(--accent-yellow)' }}>
              ₱{analytics.pendingReceivables?.toLocaleString()}
            </h2>
            <p style={styles.cardHint}>Outstanding balances</p>
          </div>
        </div>

        {/* STATUS COUNTERS - Now clickable */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Operations Status</h2>
          <div style={styles.statusGrid}>
             {Object.entries(statusCounts).map(([status, count]) => (
               <div 
                 key={status} 
                 style={{ 
                   ...styles.clickableStatusCard, 
                   borderLeft: `4px solid ${getStatusColor(status)}`,
                   cursor: "pointer"
                 }}
                 onClick={() => navigateToBookings(status)}
               >
                 <p style={styles.statusLabel}>{status}</p>
                 <h3 style={styles.statusValue}>{count}</h3>
                 <p style={styles.statusHint}>Click to view</p>
               </div>
             ))}
          </div>
        </div>

        {/* ACTIVITY & ALERTS */}
        <div style={styles.bottomLayout}>
          <div style={styles.activitySection}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Recent Activity</h3>
              <button style={styles.viewAllBtn} onClick={() => navigateToBookings()}>
                View All Bookings
              </button>
            </div>
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>Customer</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length > 0 ? bookings.map((b) => (
                    <tr 
                      key={b.id} 
                      style={styles.tr}
                      onClick={() => navigate(`/admin/bookings/${b.id}`)}
                    >
                      <td style={styles.td}>#{b.id}</td>
                      <td style={styles.td}>{b.customer?.fullName || "Guest"}</td>
                      <td style={styles.td}>₱{Number(b.totalAmount || 0).toLocaleString()}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, background: getStatusColor(b.status) }}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" style={{...styles.td, textAlign: "center", opacity: 0.5}}>
                        No bookings yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={styles.alertSection}>
            <h3 style={{ ...styles.sectionTitle, color: 'var(--accent-red)' }}>Needs Assignment</h3>
            {unassigned.length === 0 ? (
              <p style={{ opacity: 0.5, fontSize: '14px', color: 'var(--text-secondary)' }}>All clear! No pending assignments.</p>
            ) : (
              unassigned.map(b => (
                <div 
                  key={b.id} 
                  style={styles.alertCard}
                  onClick={() => navigate(`/admin/bookings/${b.id}`)}
                >
                  <strong style={{ color: 'var(--text-primary)' }}>{b.customer?.fullName}</strong>
                  <p style={{ opacity: 0.6, fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {b.appointmentStart ? new Date(b.appointmentStart).toLocaleDateString() : ""} - 
                    ₱{Number(b.totalAmount || 0).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: { display: "flex", background: "var(--bg-primary)", minHeight: "100vh", fontFamily: "Poppins, sans-serif" },
  main: { marginLeft: "280px", padding: "40px", width: "100%", color: "var(--text-primary)" },
  header: { marginBottom: "30px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "40px" },
  clickableCard: { 
    background: "var(--card-bg)", 
    padding: "24px", 
    borderRadius: "16px", 
    border: "1px solid var(--border-color)",
    cursor: "pointer",
    transition: "0.2s"
  },
  card: { background: "var(--card-bg)", padding: "24px", borderRadius: "16px", border: "1px solid var(--border-color)" },
  cardLabel: { opacity: 0.6, fontSize: "14px", marginBottom: "8px", color: "var(--text-secondary)" },
  cardValue: { fontSize: "28px", fontWeight: "700", color: "var(--text-primary)" },
  cardHint: { fontSize: "11px", opacity: 0.4, marginTop: "4px" },
  section: { marginBottom: "40px" },
  sectionTitle: { fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "var(--text-primary)" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  viewAllBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    cursor: "pointer",
    fontSize: "13px"
  },
  statusGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "15px" },
  clickableStatusCard: { 
    background: "var(--card-bg)", 
    padding: "16px", 
    borderRadius: "12px",
    transition: "0.2s"
  },
  statusCard: { background: "var(--card-bg)", padding: "16px", borderRadius: "12px" },
  statusLabel: { fontSize: "12px", opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)" },
  statusValue: { fontSize: "22px", fontWeight: "600", color: "var(--text-primary)" },
  statusHint: { fontSize: "10px", opacity: 0.3, marginTop: "2px" },
  bottomLayout: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px" },
  activitySection: { flex: 2 },
  tableContainer: { background: "var(--card-bg)", borderRadius: "16px", padding: "10px", border: "1px solid var(--border-color)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "15px", color: "var(--text-secondary)", fontSize: "13px", borderBottom: "1px solid var(--border-color)" },
  td: { padding: "15px", fontSize: "14px", cursor: "pointer", color: "var(--text-primary)" },
  tr: { borderBottom: "1px solid var(--border-color)", cursor: "pointer" },
  badge: { padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", color: "#fff" },
  alertSection: { flex: 1 },
  alertCard: { 
    background: "var(--bg-tertiary)", 
    padding: "15px", 
    borderRadius: "12px", 
    marginBottom: "10px", 
    borderLeft: "4px solid var(--accent-red)",
    cursor: "pointer",
    transition: "0.2s"
  }
};

export default AdminDashboard;
