import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import API from "../../api/axios";
import { confirmAction } from "../../components/ConfirmModal";
import CustomerSidebar from "../../components/CustomerSideBar";
import PaymentModal from "../../components/PaymentModal";

const MyBookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await API.get("/bookings");
      const allBookings = res.data.bookings || res.data;
      setBookings(Array.isArray(allBookings) ? allBookings : []);
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

  const cancelBooking = async (id) => {
    const confirmed = await confirmAction({
      title: "Request Cancellation",
      message: "Are you sure you want to request cancellation? An admin will review your request.",
      confirmText: "Yes, Request",
      cancelText: "Keep Booking",
      type: "danger"
    });

    if (!confirmed) return;

    try {
      const res = await API.patch(`/bookings/request-cancel/${id}`);
      toast.success(res.data.message || "Cancellation request submitted!");
      fetchBookings();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to request cancellation");
    }
  };

  const handlePaymentSuccess = () => {
    fetchBookings();
  };

  const openPaymentModal = (booking) => {
    setSelectedBooking(booking);
    setShowPaymentModal(true);
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "draft": return { background: "#64748b", color: "#fff" };
      case "pending": return { background: "#f59e0b", color: "#fff" };
      case "pending_payment": return { background: "#f59e0b", color: "#fff" };
      case "partially_paid": return { background: "#3b82f6", color: "#fff" };
      case "confirmed": return { background: "#10b981", color: "#fff" };
      case "scheduled": return { background: "#8b5cf6", color: "#fff" };
      case "ongoing": return { background: "#a855f7", color: "#fff" };
      case "completed": return { background: "#22c55e", color: "#fff" };
      case "cancel_requested": return { background: "#f97316", color: "#fff" };
      case "cancelled": return { background: "#ef4444", color: "#fff" };
      default: return { background: "#334155", color: "#fff" };
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "draft": return "Draft";
      case "pending": return "Pending";
      case "pending_payment": return "Pending Payment";
      case "partially_paid": return "Partially Paid";
      case "confirmed": return "Confirmed";
      case "scheduled": return "Scheduled";
      case "ongoing": return "Ongoing";
      case "completed": return "Completed";
      case "cancel_requested": return "Cancel Requested";
      case "cancelled": return "Cancelled";
      default: return status;
    }
  };

  const canCancel = (status) => {
    return ["draft", "pending_payment", "partially_paid", "confirmed"].includes(status);
  };

  const needsPayment = (booking) => {
    return ["pending_payment", "partially_paid"].includes(booking.status) && 
           Number(booking.totalAmount) > Number(booking.amountPaid || 0);
  };

  const getAmountDue = (booking) => {
    return Number(booking.totalAmount) - Number(booking.amountPaid || 0);
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
          <div style={styles.emptyState}>Loading your bookings...</div>
        ) : bookings.length === 0 ? (
          <div style={styles.emptyState}>No bookings found. 
            <button onClick={() => navigate("/customer/book")} style={styles.bookNowBtn}>
              Book Now
            </button>
          </div>
        ) : (
          <div style={styles.grid}>
            {bookings.map((booking) => {
              const services = booking.items?.map(i => i.service?.name || i.serviceNameAtBooking).join(", ") || "General Service";
              const total = Number(booking.totalAmount) || 0;
              const paid = Number(booking.amountPaid || 0);
              const amountDue = getAmountDue(booking);

              return (
                <div key={booking.id} style={styles.card}>
                  <div style={styles.rowTop}>
                    <span style={styles.bookingId}>#{booking.id.toString().padStart(4, '0')}</span>
                    <span style={{ ...styles.statusBadge, ...getStatusStyle(booking.status) }}>
                      {getStatusLabel(booking.status)}
                    </span>
                  </div>

                  {booking.appointmentDate && (
                    <div style={styles.dateTime}>
                      <span style={styles.iconText}>📅 {new Date(booking.appointmentDate).toLocaleDateString()}</span>
                      <span style={styles.iconText}>⏰ {new Date(booking.appointmentDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                  )}

                  <p style={styles.servicesList}>{services}</p>

                  <div style={styles.divider} />

                  <div style={styles.paymentSection}>
                    <div style={styles.paymentRow}>
                      <span style={styles.label}>Total</span>
                      <span style={styles.totalPrice}>₱{total.toLocaleString()}</span>
                    </div>
                    <div style={styles.paymentRow}>
                      <span style={styles.label}>Paid</span>
                      <span style={styles.paidAmount}>₱{paid.toLocaleString()}</span>
                    </div>
                    <div style={{ ...styles.paymentRow, borderTop: "1px dashed var(--border-color)", paddingTop: "8px", marginTop: "4px" }}>
                      <span style={{ ...styles.label, fontWeight: "600" }}>Balance</span>
                      <span style={{ ...styles.balanceAmount, color: amountDue > 0 ? "var(--accent-red)" : "var(--accent-green)" }}>
                        ₱{amountDue.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div style={styles.actionRow}>
                    {booking.status === "draft" && (
                      <button
                        onClick={() => navigate(`/customer/book?edit=${booking.id}`)}
                        style={styles.editButton}
                      >
                        Complete Booking
                      </button>
                    )}

                    {needsPayment(booking) && (
                      <button
                        onClick={() => openPaymentModal(booking)}
                        style={styles.payButton}
                      >
                        Pay ₱{amountDue.toLocaleString()}
                      </button>
                    )}

                    {canCancel(booking.status) && (
                      <button
                        onClick={() => cancelBooking(booking.id)}
                        style={styles.cancelButton}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showPaymentModal && selectedBooking && (
        <PaymentModal
          booking={selectedBooking}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedBooking(null);
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}
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
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "25px" },
  card: { background: "var(--card-bg)", padding: "24px", borderRadius: "16px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column" },
  rowTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" },
  bookingId: { color: "var(--accent-blue)", fontWeight: "600", fontSize: "14px" },
  statusBadge: { padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" },
  dateTime: { display: "flex", gap: "15px", marginBottom: "12px", color: "var(--text-primary)", fontSize: "14px" },
  iconText: { display: "flex", alignItems: "center", gap: "6px" },
  servicesList: { fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "20px", flexGrow: 1 },
  divider: { height: "1px", background: "var(--border-color)", margin: "15px 0" },
  paymentSection: { marginBottom: "20px" },
  paymentRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" },
  label: { fontSize: "12px", color: "var(--text-secondary)" },
  totalPrice: { fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" },
  paidAmount: { fontSize: "14px", color: "var(--accent-green)" },
  balanceAmount: { fontSize: "16px", fontWeight: "700" },
  actionRow: { display: "flex", gap: "10px", marginTop: "8px" },
  editButton: { flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid var(--accent-blue)", background: "transparent", color: "var(--accent-blue)", fontWeight: "600", cursor: "pointer" },
  payButton: { flex: 2, padding: "12px", borderRadius: "10px", border: "none", background: "var(--accent-blue)", color: "#fff", fontWeight: "600", cursor: "pointer" },
  cancelButton: { flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", fontWeight: "600", cursor: "pointer" },
  emptyState: { textAlign: "center", padding: "60px", color: "var(--text-secondary)", background: "var(--card-bg)", borderRadius: "16px" },
  bookNowBtn: { display: "block", margin: "16px auto 0", padding: "12px 32px", background: "var(--accent-blue)", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "600", cursor: "pointer" }
};

export default MyBookings;
