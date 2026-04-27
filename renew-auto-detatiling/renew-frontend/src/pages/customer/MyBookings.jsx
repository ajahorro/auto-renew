import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import API from "../../api/axios";
import { confirmAction } from "../../components/ConfirmModal";
import CustomerSidebar from "../../components/CustomerSideBar";
import PaymentModal from "../../components/PaymentModal";
import BookingStatusBadge from "../../components/BookingStatusBadge";
import PaymentStatusBadge from "../../components/PaymentStatusBadge";
import { 
  CreditCard, 
  Wallet, 
  Flag, 
  ChevronRight, 
  Calendar, 
  Car, 
  Package 
} from "lucide-react";
import ServiceStatusBadge from "../../components/ServiceStatusBadge";

const MyBookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isPostServicePayment, setIsPostServicePayment] = useState(false);

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
      const res = await API.post(`/bookings/${id}/cancel-request`, {
        reason: "Requested by customer from bookings page"
      });
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

  const openPaymentModal = (booking, postService = false) => {
    setSelectedBooking(booking);
    setIsPostServicePayment(postService);
    setShowPaymentModal(true);
  };

  const canCancel = (booking) => {
    // Can request cancellation if SCHEDULED (or legacy PENDING/CONFIRMED)
    // and no pending cancellation request already
    const cancellableStatuses = ["SCHEDULED", "PENDING", "CONFIRMED"];
    return cancellableStatuses.includes(booking.status) && booking.cancellationStatus !== "REQUESTED";
  };

  const needsPayment = (booking) => {
    // Show payment options when payment is pending OR rejected (resubmission)
    return ["PENDING", "REJECTED"].includes(booking.paymentStatus) &&
           Number(booking.totalAmount) > Number(booking.amountPaid || 0);
  };

  return (
    <div style={styles.page}>
      <CustomerSidebar active="bookings" />
      <div style={styles.main}>
        <h1 style={styles.title}>My Bookings</h1>

        {loading ? (
          <div style={styles.loading}>Loading your bookings...</div>
        ) : bookings.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}><Calendar size={48} /></div>
            <h3>No bookings yet</h3>
            <p>You haven't made any detailing appointments yet.</p>
            <button style={styles.bookBtn} onClick={() => navigate("/customer/book")}>
              Book Your First Service
            </button>
          </div>
        ) : (
          <div style={styles.bookingList}>
            {bookings.map((booking) => (
              <div key={booking.id} style={styles.bookingCard}>
                <div style={styles.cardHeader}>
                  <div style={styles.headerLeft}>
                    <span style={styles.bookingId}>#{booking.id.toString().padStart(4, '0')}</span>
                    <span style={styles.bookingDate}>
                      {new Date(booking.appointmentStart).toLocaleDateString(undefined, { 
                        month: 'short', day: 'numeric', year: 'numeric' 
                      })}
                    </span>
                  </div>
                  <div style={styles.statusGroup}>
                    <BookingStatusBadge status={booking.status} />
                    <ServiceStatusBadge status={booking.serviceStatus} />
                    <PaymentStatusBadge status={booking.paymentStatus} />
                  </div>
                </div>

                <div style={styles.cardBody}>
                  <div style={styles.infoRow}>
                    <Package size={16} color="var(--accent-blue)" />
                    <div style={styles.servicesList}>
                      {booking.items?.map(item => item.service?.name || item.serviceNameAtBooking).join(", ")}
                    </div>
                  </div>
                  
                  <div style={styles.infoRow}>
                    <Car size={16} color="var(--accent-blue)" />
                    <span>{booking.vehicleType} • {booking.plateNumber || "No Plate"}</span>
                  </div>

                  <div style={styles.priceRow}>
                    <div style={styles.priceInfo}>
                      <span style={styles.priceLabel}>Total Amount</span>
                      <span style={styles.priceValue}>₱{Number(booking.totalAmount).toLocaleString()}</span>
                    </div>
                    <div style={styles.priceInfo}>
                      <span style={styles.priceLabel}>Paid</span>
                      <span style={{...styles.priceValue, color: "var(--accent-green)"}}>₱{Number(booking.amountPaid || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div style={styles.cardActions}>
                  <div style={styles.actionLeft}>
                    {booking.paymentMethod === "CASH" && needsPayment(booking) && (
                      <button 
                        style={styles.switchBtn}
                        onClick={() => openPaymentModal(booking)}
                      >
                        <Wallet size={14} />
                        Switch to GCash
                      </button>
                    )}
                    {booking.paymentMethod === "GCASH" && needsPayment(booking) && (
                      <button 
                        style={styles.payBtn}
                        onClick={() => openPaymentModal(booking)}
                      >
                        <CreditCard size={14} />
                        Pay via GCash
                      </button>
                    )}
                  </div>
                  <div style={styles.actionRight}>
                    {canCancel(booking) && (
                      <button 
                        style={styles.cancelBtn}
                        onClick={() => cancelBooking(booking.id)}
                      >
                        <Flag size={14} />
                        Request to Cancel
                      </button>
                    )}
                    <button 
                      style={styles.viewBtn}
                      onClick={() => navigate(`/customer/bookings/${booking.id}`)}
                    >
                      View Details
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showPaymentModal && (
          <PaymentModal
            booking={selectedBooking}
            onClose={() => setShowPaymentModal(false)}
            onSuccess={handlePaymentSuccess}
            isPostService={isPostServicePayment}
          />
        )}
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
  title: {
    marginBottom: "30px",
    fontSize: "28px",
    fontWeight: "800"
  },
  loading: {
    textAlign: "center",
    padding: "100px",
    color: "var(--text-secondary)"
  },
  emptyState: {
    textAlign: "center",
    padding: "100px 20px",
    background: "var(--card-bg)",
    borderRadius: "20px",
    border: "1px solid var(--border-color)"
  },
  emptyIcon: {
    marginBottom: "20px",
    color: "var(--text-secondary)",
    opacity: 0.5
  },
  bookBtn: {
    marginTop: "24px",
    padding: "12px 24px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent-blue)",
    color: "white",
    fontWeight: "600",
    cursor: "pointer"
  },
  bookingList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
    gap: "24px"
  },
  bookingCard: {
    background: "var(--card-bg)",
    borderRadius: "18px",
    border: "1px solid var(--border-color)",
    overflow: "hidden",
    transition: "transform 0.2s, box-shadow 0.2s"
  },
  cardHeader: {
    padding: "20px",
    borderBottom: "1px solid var(--border-color)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "rgba(255,255,255,0.02)"
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "2px"
  },
  bookingId: {
    fontSize: "12px",
    fontWeight: "700",
    color: "var(--accent-blue)",
    letterSpacing: "1px"
  },
  bookingDate: {
    fontSize: "15px",
    fontWeight: "600"
  },
  statusGroup: {
    display: "flex",
    gap: "8px"
  },
  cardBody: {
    padding: "20px"
  },
  infoRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
    fontSize: "14px",
    color: "var(--text-secondary)"
  },
  servicesList: {
    color: "var(--text-primary)",
    fontWeight: "500",
    flex: 1
  },
  priceRow: {
    display: "flex",
    gap: "24px",
    marginTop: "20px",
    padding: "16px",
    background: "var(--bg-tertiary)",
    borderRadius: "12px"
  },
  priceInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  },
  priceLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "var(--text-secondary)"
  },
  priceValue: {
    fontSize: "16px",
    fontWeight: "700"
  },
  cardActions: {
    padding: "16px 20px",
    borderTop: "1px solid var(--border-color)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "rgba(255,255,255,0.01)"
  },
  actionLeft: {
    display: "flex",
    gap: "10px"
  },
  actionRight: {
    display: "flex",
    gap: "10px"
  },
  switchBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "8px",
    border: "1px solid var(--accent-yellow)",
    background: "transparent",
    color: "var(--accent-yellow)",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer"
  },
  payBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "8px",
    border: "none",
    background: "var(--accent-blue)",
    color: "white",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer"
  },
  cancelBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "8px",
    border: "none",
    background: "rgba(239, 68, 68, 0.1)",
    color: "var(--accent-red)",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer"
  },
  viewBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "8px",
    border: "none",
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer"
  }
};

export default MyBookings;
