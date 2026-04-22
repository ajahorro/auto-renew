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
    booking: { CONFIRMED: 0, CANCELLED: 0, COMPLETED: 0 },
    service: { NOT_STARTED: 0, ONGOING: 0, COMPLETED: 0, CANCELLED: 0 },
    payment: { PENDING: 0, DOWNPAYMENT_PAID: 0, COMPLETED: 0, REFUNDED: 0, CANCELLED: 0 }
  });

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const analyticsRes = await API.get("/bookings/admin-analytics");
        if (analyticsRes.data.success) {
          const { counts, finances } = analyticsRes.data.analytics || {};
          setAnalytics({
            totalBookings: counts?.total || 0,
            completedBookings: counts?.booking?.COMPLETED || counts?.completed || 0,
            totalRevenue: finances?.totalRevenue || 0,
            pendingReceivables: finances?.pendingRevenue || 0
          });
          
          if (counts && counts.booking) {
            setStatusCounts({
              booking: {
                CONFIRMED: (counts.booking.CONFIRMED || 0) + (counts.booking.SCHEDULED || 0),
                CANCELLED: counts.booking.CANCELLED || 0,
                COMPLETED: counts.booking.COMPLETED || 0
              },
              service: {
                NOT_STARTED: counts.service?.NOT_STARTED || 0,
                ONGOING: counts.service?.ONGOING || 0,
                COMPLETED: counts.service?.COMPLETED || 0,
                CANCELLED: counts.booking.CANCELLED || 0
              },
              payment: {
                PENDING: counts.payment?.PENDING || 0,
                DOWNPAYMENT_PAID: counts.payment?.PARTIALLY_PAID || 0,
                COMPLETED: counts.payment?.PAID || counts.payment?.COMPLETED || 0,
                REFUNDED: 0,
                CANCELLED: counts.booking.CANCELLED || 0
              }
            });
          }
        }

        const bookingsRes = await API.get("/bookings");
        const list = Array.isArray(bookingsRes.data) 
          ? bookingsRes.data 
          : (bookingsRes.data.bookings || []);
        
        setBookings(list.slice(0, 5));

        const unassignedList = list.filter(b => 
          !b.assignedStaffId && !["CANCELLED", "COMPLETED"].includes(b.status)
        );
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
      case "DOWNPAYMENT_PAID": return "#0ea5e9";
      case "NOT_STARTED": return "#94a3b8";
      default: return "#64748b";
    }
  };

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

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Operations Status</h2>
          <div style={styles.categorizedGrid}>
            <div style={styles.categoryColumn}>
              <h3 style={styles.categoryTitle}>Bookings</h3>
              <div style={styles.statusStack}>
                {Object.entries(statusCounts.booking).map(([status, count]) => (
                  <div key={status} style={styles.statusRowItem} onClick={() => navigateToBookings(status)}>
                    <div style={{...styles.statusIndicator, background: getStatusColor(status)}} />
                    <span style={styles.statusName}>{status.replace("_", " ")}</span>
                    <span style={styles.statusCount}>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.categoryColumn}>
              <h3 style={styles.categoryTitle}>Services</h3>
              <div style={styles.statusStack}>
                {Object.entries(statusCounts.service).map(([status, count]) => (
                  <div key={status} style={styles.statusRowItem}>
                    <div style={{...styles.statusIndicator, background: getStatusColor(status)}} />
                    <span style={styles.statusName}>{status.replace("_", " ")}</span>
                    <span style={styles.statusCount}>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.categoryColumn}>
              <h3 style={styles.categoryTitle}>Payments</h3>
              <div style={styles.statusStack}>
                {Object.entries(statusCounts.payment).map(([status, count]) => (
                  <div key={status} style={styles.statusRowItem}>
                    <div style={{...styles.statusIndicator, background: getStatusColor(status)}} />
                    <span style={styles.statusName}>{status.replace("_", " ")}</span>
                    <span style={styles.statusCount}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

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
  categorizedGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "24px" },
  categoryColumn: {
    background: "var(--card-bg)",
    borderRadius: "16px",
    padding: "20px",
    border: "1px solid var(--border-color)"
  },
  categoryTitle: {
    fontSize: "14px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: "16px",
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border-color)",
    paddingBottom: "10px"
  },
  statusStack: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  statusRowItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "0.2s",
    "&:hover": {
      background: "var(--bg-tertiary)"
    }
  },
  statusIndicator: {
    width: "8px",
    height: "8px",
    borderRadius: "50%"
  },
  statusName: {
    fontSize: "14px",
    fontWeight: "500",
    color: "var(--text-primary)",
    flex: 1
  },
  statusCount: {
    fontSize: "14px",
    fontWeight: "700",
    color: "var(--text-primary)"
  },
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
