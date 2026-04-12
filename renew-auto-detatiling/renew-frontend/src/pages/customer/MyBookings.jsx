import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import API from "../../api/axios";
import { confirmAction } from "../../components/ConfirmModal";
import CustomerSidebar from "../../components/CustomerSideBar";

const MyBookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ===============================
     LOAD BOOKINGS
  =============================== */
  const fetchBookings = useCallback(async () => {
    try {
      const res = await API.get("/bookings");
      // Logic check: ensure we handle both array and object responses
      // Filter out cancelled bookings
      const allBookings = res.data.bookings || res.data;
      const activeBookings = Array.isArray(allBookings) 
        ? allBookings.filter(b => b.status !== "CANCELLED") 
        : [];
      setBookings(activeBookings);
    } catch (err) {
      console.error("Bookings fetch error", err);
      toast.error("Could not load your bookings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  /* ===============================
     CANCEL BOOKING
  =============================== */
  const cancelBooking = async (id) => {
    const confirmed = await confirmAction({
      title: "Cancel Booking",
      message: "Are you sure you want to cancel this booking?",
      confirmText: "Yes, Cancel",
      cancelText: "Keep Booking",
      type: "danger"
    });

    if (!confirmed) return;

    try {
      await API.patch(`/bookings/cancel/${id}`);
      toast.success("Booking cancelled!");
      
      // Immediately remove from UI without waiting for re-fetch
      setBookings(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel booking");
    }
  };

  /* ===============================
     STATUS BADGE LOGIC
  =============================== */
  const getStatusStyle = (status) => {
    switch (status) {
      case "COMPLETED": return { background: "#10b981", color: "#fff" }; // Green
      case "CANCELLED": return { background: "#ef4444", color: "#fff" }; // Red
      case "PENDING": return { background: "#f59e0b", color: "#fff" };   // Amber
      default: return { background: "#334155", color: "#fff" };          // Slate
    }
  };

  return (
    <div style={styles.page}>
      <CustomerSidebar active="bookings" />

      <div style={styles.main}>
        <header style={styles.header}>
          <h1 style={styles.title}>My Bookings</h1>
          <p style={styles.subtitle}>Manage your upcoming and past service appointments</p>
        </header>

        {loading ? (
          <div style={styles.emptyState}>Loading your dashboard...</div>
        ) : bookings.length === 0 ? (
          <div style={styles.emptyState}>No bookings found. Ready for your first car wash?</div>
        ) : (
          <div style={styles.grid}>
            {bookings.map((booking) => {
              const services = booking.items?.map(i => i.service?.name).join(", ") || "General Service";
              const total = booking.items?.reduce((sum, i) => sum + Number(i.priceAtBooking || 0), 0) || 0;
              
              // Corrected logic: user can only cancel if it's not already processed/cancelled
              const isActionable = booking.status === "PENDING" || booking.status === "SCHEDULED";
              const canEdit = booking.status === "SCHEDULED";

              return (
                <div key={booking.id} style={styles.card}>
                  <div style={styles.rowTop}>
                    <span style={styles.bookingId}>#{booking.id.toString().padStart(4, '0')}</span>
                    <span style={{ ...styles.statusBadge, ...getStatusStyle(booking.status) }}>
                      {booking.status}
                    </span>
                  </div>

                  <div style={styles.dateTime}>
                    <span style={styles.iconText}>📅 {new Date(booking.appointmentStart).toLocaleDateString()}</span>
                    <span style={styles.iconText}>⏰ {new Date(booking.appointmentStart).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  </div>

                  <p style={styles.servicesList}>{services}</p>

                  <div style={styles.divider} />

                  <div style={styles.paymentRow}>
                    <div style={styles.paymentInfo}>
                      <span style={styles.label}>Payment Status</span>
                      <span style={styles.value}>{booking.paymentStatus}</span>
                    </div>
                    <div style={styles.priceContainer}>
                      <span style={styles.totalLabel}>Total</span>
                      <span style={styles.totalPrice}>₱{total.toLocaleString()}</span>
                    </div>
                  </div>

                  <div style={styles.actionRow}>
                    {canEdit && (
                      <button
                        onClick={() => navigate(`/customer/book?edit=${booking.id}`)}
                        style={styles.editButton}
                      >
                        Edit Booking
                      </button>
                    )}

                    {isActionable && (
                      <button
                        onClick={() => cancelBooking(booking.id)}
                        style={styles.cancelButton}
                      >
                        Cancel Appointment
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ===============================
   STYLES
============================== */
const styles = {
  page: { display: "flex", background: "var(--bg-primary)", minHeight: "100vh", fontFamily: "'Poppins', sans-serif" },
  main: { marginLeft: "250px", padding: "40px", width: "100%", color: "var(--text-primary)" },
  header: { marginBottom: "30px" },
  title: { fontSize: "28px", fontWeight: "700", marginBottom: "5px" },
  subtitle: { color: "var(--text-secondary)", fontSize: "14px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "25px" },
  card: { background: "var(--card-bg)", padding: "24px", borderRadius: "16px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column" },
  rowTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" },
  bookingId: { color: "var(--accent-blue)", fontWeight: "600", fontSize: "14px" },
  statusBadge: { padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" },
  dateTime: { display: "flex", gap: "15px", marginBottom: "12px", color: "var(--text-primary)", fontSize: "14px" },
  servicesList: { fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "20px", flexGrow: 1 },
  divider: { height: "1px", background: "var(--border-color)", margin: "15px 0" },
  paymentRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "20px" },
  paymentInfo: { display: "flex", flexDirection: "column", gap: "4px" },
  label: { fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" },
  value: { fontSize: "13px", fontWeight: "500" },
  priceContainer: { textAlign: "right" },
  totalLabel: { fontSize: "11px", color: "var(--text-secondary)", display: "block" },
  totalPrice: { fontSize: "20px", color: "#fff", fontWeight: "700" },
  actionRow: { display: "flex", gap: "10px", marginTop: "8px" },
  editButton: { flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid var(--accent-blue)", background: "transparent", color: "var(--accent-blue)", fontWeight: "600", cursor: "pointer" },
  cancelButton: { flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid var(--accent-red)", background: "transparent", color: "var(--accent-red)", fontWeight: "600", cursor: "pointer", transition: "0.2s" },
  emptyState: { textAlign: "center", padding: "60px", color: "var(--text-secondary)", background: "var(--card-bg)", borderRadius: "16px" }
};

export default MyBookings;
