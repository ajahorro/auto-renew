import { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import API from "../../api/axios";
import "../../App.css";

const AdminAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("month");
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get("/bookings/admin-analytics");
      if (res.data.success) {
        setAnalytics(res.data.analytics);
      } else {
        setError("Failed to load analytics");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `₱${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getPeakHourLabel = (hour) => {
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  if (loading) {
    return (
      <AdminLayout active="analytics">
        <div style={styles.pageWrapper}>
          <h1 style={styles.pageTitle}>Analytics Dashboard</h1>
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <p>Loading analytics...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout active="analytics">
        <div style={styles.pageWrapper}>
          <h1 style={styles.pageTitle}>Analytics Dashboard</h1>
          <div style={styles.errorCard}>
            <p>{error}</p>
            <button style={styles.retryButton} onClick={loadAnalytics}>Retry</button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!analytics) return null;

  const { counts, bookingTrends, finances, bookingsPerService, revenuePerService, peakHours, operational, staffAnalytics } = analytics;

  return (
    <AdminLayout active="analytics">
      <div style={styles.pageWrapper}>
        <div style={styles.header}>
          <h1 style={styles.pageTitle}>Analytics Dashboard</h1>
          <select 
            style={styles.dateSelect}
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>

        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>📊</div>
            <div style={styles.statContent}>
              <span style={styles.statValue}>{counts.total}</span>
              <span style={styles.statLabel}>Total Bookings</span>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>✅</div>
            <div style={styles.statContent}>
              <span style={styles.statValue}>{counts.completed}</span>
              <span style={styles.statLabel}>Completed</span>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>⏳</div>
            <div style={styles.statContent}>
              <span style={styles.statValue}>{counts.pending + counts.scheduled}</span>
              <span style={styles.statLabel}>Pending/Scheduled</span>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>💰</div>
            <div style={styles.statContent}>
              <span style={styles.statValue}>{formatCurrency(finances.totalRevenue)}</span>
              <span style={styles.statLabel}>Total Revenue</span>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Booking Trends</h2>
          <div style={styles.trendsGrid}>
            <div style={styles.trendCard}>
              <span style={styles.trendValue}>{bookingTrends.today}</span>
              <span style={styles.trendLabel}>Today's Bookings</span>
            </div>
            <div style={styles.trendCard}>
              <span style={styles.trendValue}>{bookingTrends.thisWeek}</span>
              <span style={styles.trendLabel}>This Week</span>
            </div>
            <div style={styles.trendCard}>
              <span style={styles.trendValue}>{bookingTrends.thisMonth}</span>
              <span style={styles.trendLabel}>This Month</span>
            </div>
            <div style={styles.trendCard}>
              <span style={styles.trendValue}>{operational.avgBookingsPerDay}</span>
              <span style={styles.trendLabel}>Avg/Day</span>
            </div>
          </div>
        </div>

        <div style={styles.gridTwo}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Bookings by Service</h3>
            {bookingsPerService && bookingsPerService.length > 0 ? (
              <div style={styles.barChart}>
                {bookingsPerService.slice(0, 8).map((item, idx) => {
                  const maxCount = Math.max(...bookingsPerService.map(s => s.count));
                  const width = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  return (
                    <div key={idx} style={styles.barItem}>
                      <div style={styles.barLabel}>
                        <span>{item.name}</span>
                        <span style={styles.barValue}>{item.count}</span>
                      </div>
                      <div style={styles.barContainer}>
                        <div style={{ ...styles.barFill, width: `${width}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={styles.emptyText}>No data available</p>
            )}
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Revenue by Service</h3>
            {revenuePerService && revenuePerService.length > 0 ? (
              <div style={styles.barChart}>
                {revenuePerService.slice(0, 8).map((item, idx) => {
                  const maxRevenue = Math.max(...revenuePerService.map(s => s.revenue));
                  const width = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
                  return (
                    <div key={idx} style={styles.barItem}>
                      <div style={styles.barLabel}>
                        <span>{item.name}</span>
                        <span style={styles.barValue}>{formatCurrency(item.revenue)}</span>
                      </div>
                      <div style={styles.barContainer}>
                        <div style={{ ...styles.barFillGreen, width: `${width}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={styles.emptyText}>No data available</p>
            )}
          </div>
        </div>

        <div style={styles.gridTwo}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Payment Methods</h3>
            <div style={styles.paymentGrid}>
              <div style={styles.paymentItem}>
                <div style={styles.paymentIcon}>📱</div>
                <div style={styles.paymentInfo}>
                  <span style={styles.paymentValue}>{formatCurrency(finances.gcashRevenue)}</span>
                  <span style={styles.paymentLabel}>GCash</span>
                </div>
              </div>
              <div style={styles.paymentItem}>
                <div style={styles.paymentIcon}>💵</div>
                <div style={styles.paymentInfo}>
                  <span style={styles.paymentValue}>{formatCurrency(finances.cashRevenue)}</span>
                  <span style={styles.paymentLabel}>Cash</span>
                </div>
              </div>
            </div>
            <div style={styles.paymentSummary}>
              <div style={styles.summaryRow}>
                <span>Paid Bookings</span>
                <span style={styles.paidAmount}>{finances.paidBookings}</span>
              </div>
              <div style={styles.summaryRow}>
                <span>Unpaid Bookings</span>
                <span style={styles.unpaidAmount}>{finances.unpaidBookings}</span>
              </div>
              <div style={styles.summaryRow}>
                <span>Pending Revenue</span>
                <span style={styles.pendingAmount}>{formatCurrency(finances.pendingRevenue)}</span>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Peak Hours</h3>
            {peakHours && peakHours.length > 0 ? (
              <div style={styles.peakHoursContainer}>
                {peakHours.map((peak, idx) => (
                  <div key={idx} style={styles.peakHourItem}>
                    <span style={styles.peakRank}>#{idx + 1}</span>
                    <span style={styles.peakTime}>{getPeakHourLabel(peak.hour)}</span>
                    <span style={styles.peakCount}>{peak.count} bookings</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={styles.emptyText}>No peak hour data</p>
            )}
          </div>
        </div>

        <div style={styles.gridTwo}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Booking Status Distribution</h3>
            <div style={styles.statusGrid}>
              <div style={styles.statusItem}>
                <span style={{...styles.statusDot, background: "#f59e0b"}}></span>
                <span>Pending</span>
                <span style={styles.statusCount}>{counts.pending}</span>
              </div>
              <div style={styles.statusItem}>
                <span style={{...styles.statusDot, background: "#3b82f6"}}></span>
                <span>Scheduled</span>
                <span style={styles.statusCount}>{counts.scheduled}</span>
              </div>
              <div style={styles.statusItem}>
                <span style={{...styles.statusDot, background: "#8b5cf6"}}></span>
                <span>Ongoing</span>
                <span style={styles.statusCount}>{counts.ongoing}</span>
              </div>
              <div style={styles.statusItem}>
                <span style={{...styles.statusDot, background: "#10b981"}}></span>
                <span>Completed</span>
                <span style={styles.statusCount}>{counts.completed}</span>
              </div>
              <div style={styles.statusItem}>
                <span style={{...styles.statusDot, background: "#ef4444"}}></span>
                <span>Cancelled</span>
                <span style={styles.statusCount}>{counts.cancelled}</span>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Operational Metrics</h3>
            <div style={styles.metricsGrid}>
              <div style={styles.metricItem}>
                <span style={styles.metricValue}>{operational.cancellationRate}%</span>
                <span style={styles.metricLabel}>Cancellation Rate</span>
              </div>
              <div style={styles.metricItem}>
                <span style={styles.metricValue}>{operational.totalDaysTracked}</span>
                <span style={styles.metricLabel}>Days with Bookings</span>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Staff Performance</h3>
          {staffAnalytics && staffAnalytics.length > 0 ? (
            <div style={styles.staffTable}>
              <div style={styles.tableHeader}>
                <span style={{flex: 2}}>Staff Name</span>
                <span style={{flex: 1}}>Total Bookings</span>
                <span style={{flex: 1}}>Completed</span>
                <span style={{flex: 1}}>Completion Rate</span>
              </div>
              {staffAnalytics.map((staff, idx) => (
                <div key={idx} style={styles.tableRow}>
                  <span style={{flex: 2}}>{staff.name}</span>
                  <span style={{flex: 1}}>{staff.totalBookings}</span>
                  <span style={{flex: 1}}>{staff.completedBookings}</span>
                  <span style={{...styles.completionRate, color: staff.completionRate >= 80 ? "#10b981" : staff.completionRate >= 50 ? "#f59e0b" : "#ef4444"}}>
                    {staff.completionRate}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.emptyText}>No staff data available</p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

const styles = {
  pageWrapper: { padding: "24px", maxWidth: "1400px", margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" },
  pageTitle: { fontSize: "28px", fontWeight: "700", color: "var(--text-primary)", margin: 0 },
  dateSelect: { padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "14px", cursor: "pointer" },
  loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px", gap: "16px" },
  spinner: { width: "40px", height: "40px", border: "3px solid var(--border-color)", borderTopColor: "var(--accent-blue)", borderRadius: "50%", animation: "spin 1s linear infinite" },
  errorCard: { padding: "24px", background: "var(--card-bg)", borderRadius: "12px", border: "1px solid var(--accent-red)", textAlign: "center" },
  retryButton: { marginTop: "16px", padding: "10px 24px", background: "var(--accent-blue)", color: "#020617", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" },
  statCard: { background: "var(--card-bg)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "20px", display: "flex", alignItems: "center", gap: "16px" },
  statIcon: { fontSize: "32px" },
  statContent: { display: "flex", flexDirection: "column" },
  statValue: { fontSize: "24px", fontWeight: "700", color: "var(--text-primary)" },
  statLabel: { fontSize: "13px", color: "var(--text-secondary)" },
  section: { marginBottom: "24px" },
  sectionTitle: { fontSize: "18px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "16px" },
  trendsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" },
  trendCard: { background: "var(--card-bg)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "20px", textAlign: "center" },
  trendValue: { display: "block", fontSize: "28px", fontWeight: "700", color: "var(--accent-blue)", marginBottom: "4px" },
  trendLabel: { fontSize: "13px", color: "var(--text-secondary)" },
  gridTwo: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" },
  card: { background: "var(--card-bg)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "20px" },
  cardTitle: { fontSize: "16px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "16px" },
  barChart: { display: "flex", flexDirection: "column", gap: "12px" },
  barItem: {},
  barLabel: { display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" },
  barValue: { fontWeight: "600", color: "var(--text-primary)" },
  barContainer: { height: "8px", background: "var(--bg-tertiary)", borderRadius: "4px", overflow: "hidden" },
  barFill: { height: "100%", background: "var(--accent-blue)", borderRadius: "4px", transition: "width 0.3s ease" },
  barFillGreen: { height: "100%", background: "var(--accent-green)", borderRadius: "4px", transition: "width 0.3s ease" },
  paymentGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" },
  paymentItem: { display: "flex", alignItems: "center", gap: "12px", padding: "16px", background: "var(--bg-primary)", borderRadius: "8px" },
  paymentIcon: { fontSize: "24px" },
  paymentInfo: { display: "flex", flexDirection: "column" },
  paymentValue: { fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" },
  paymentLabel: { fontSize: "12px", color: "var(--text-secondary)" },
  paymentSummary: { borderTop: "1px solid var(--border-color)", paddingTop: "16px" },
  summaryRow: { display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: "14px" },
  paidAmount: { fontWeight: "600", color: "var(--accent-green)" },
  unpaidAmount: { fontWeight: "600", color: "var(--accent-red)" },
  pendingAmount: { fontWeight: "600", color: "var(--accent-yellow)" },
  peakHoursContainer: { display: "flex", flexDirection: "column", gap: "12px" },
  peakHourItem: { display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: "var(--bg-primary)", borderRadius: "8px" },
  peakRank: { fontSize: "14px", fontWeight: "700", color: "var(--accent-blue)", width: "30px" },
  peakTime: { fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", flex: 1 },
  peakCount: { fontSize: "13px", color: "var(--text-secondary)" },
  statusGrid: { display: "flex", flexDirection: "column", gap: "12px" },
  statusItem: { display: "flex", alignItems: "center", gap: "12px", fontSize: "14px" },
  statusDot: { width: "12px", height: "12px", borderRadius: "50%" },
  statusCount: { marginLeft: "auto", fontWeight: "600" },
  metricsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  metricItem: { textAlign: "center", padding: "20px", background: "var(--bg-primary)", borderRadius: "8px" },
  metricValue: { display: "block", fontSize: "24px", fontWeight: "700", color: "var(--text-primary)" },
  metricLabel: { fontSize: "12px", color: "var(--text-secondary)" },
  staffTable: { display: "flex", flexDirection: "column" },
  tableHeader: { display: "flex", padding: "12px 16px", background: "var(--bg-primary)", borderRadius: "8px", fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "8px" },
  tableRow: { display: "flex", padding: "12px 16px", borderBottom: "1px solid var(--border-color)", fontSize: "14px" },
  completionRate: { fontWeight: "700" },
  emptyText: { color: "var(--text-secondary)", fontSize: "14px", textAlign: "center", padding: "20px" }
};

export default AdminAnalytics;
