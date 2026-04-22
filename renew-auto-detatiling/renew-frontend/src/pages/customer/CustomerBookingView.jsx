import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../../api/axios";
import CustomerSidebar from "../../components/CustomerSideBar";
import BookingStatusBadge from "../../components/BookingStatusBadge";
import PaymentStatusBadge from "../../components/PaymentStatusBadge";
import ServiceStatusBadge from "../../components/ServiceStatusBadge";
import { confirmAction } from "../../components/ConfirmModal";
import toast from "react-hot-toast";
import {
  ArrowLeft, 
  Car, 
  Calendar, 
  CreditCard, 
  FileText,
  Clock, 
  Package,
  Receipt,
  AlertTriangle,
  Info
} from "lucide-react";

const CustomerBookingView = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await API.get(`/bookings/${id}`);
      setBooking(res.data.booking || res.data);
    } catch (err) {
      console.error(err);
      toast.error("Error loading booking details");
      navigate("/customer/bookings");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const requestCancel = async () => {
    const confirmed = await confirmAction({
      title: "Request Cancellation",
      message: "Are you sure you want to request a cancellation for this booking? An admin will need to approve it.",
      confirmText: "Yes, Request",
      cancelText: "No, Keep it",
      type: "danger"
    });

    if (!confirmed) return;

    try {
      await API.post(`/bookings/${id}/cancel-request`, {
        reason: "Cancelled by customer from details page"
      });
      toast.success("Cancellation request submitted");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to request cancellation");
    }
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <CustomerSidebar active="bookings" />
        <div style={styles.main}>
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <p>Loading booking details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  const total = Number(booking.totalAmount || 0);
  const paid = Number(booking.amountPaid || 0);
  const balance = total - paid;

  return (
    <div style={styles.page}>
      <CustomerSidebar active="bookings" />
      <div style={styles.main}>
        {/* HEADER */}
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => navigate("/customer/bookings")}>
            <ArrowLeft size={18} />
            Back to Bookings
          </button>
          <div style={styles.headerTitle}>
            <h1 style={styles.title}>Booking #{booking.id.toString().padStart(4, '0')}</h1>
            <div style={styles.badgeGroup}>
              <BookingStatusBadge status={booking.status} />
              <ServiceStatusBadge status={booking.serviceStatus} />
              <PaymentStatusBadge status={booking.paymentStatus} />
            </div>
          </div>
        </div>

        <div style={styles.contentGrid}>
          {/* LEFT COLUMN: MAIN INFO */}
          <div style={styles.leftCol}>
            {/* SERVICE CARD */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <Package size={20} color="var(--accent-blue)" />
                Service Details
              </h3>
              <div style={styles.serviceList}>
                {booking.items?.map((item, idx) => (
                  <div key={idx} style={styles.serviceItem}>
                    <div style={styles.serviceInfo}>
                      <span style={styles.serviceName}>{item.service?.name || item.serviceNameAtBooking}</span>
                      <span style={styles.serviceCategory}>{item.service?.category || "Detailing"}</span>
                    </div>
                    <span style={styles.servicePrice}>₱{Number(item.priceAtBooking || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div style={styles.totalRow}>
                <span>Total Amount</span>
                <span>₱{total.toLocaleString()}</span>
              </div>
            </div>

            {/* VEHICLE CARD */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <Car size={20} color="var(--accent-blue)" />
                Vehicle Information
              </h3>
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Vehicle Type</span>
                  <span style={styles.infoValue}>{booking.vehicleType}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Plate Number</span>
                  <span style={styles.infoValue}>{booking.plateNumber || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* NOTES CARD */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <FileText size={20} color="var(--accent-blue)" />
                Booking Notes
              </h3>
              <div style={styles.notesBox}>
                {booking.notes || "No special instructions provided for this booking."}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: STATUS & ACTIONS */}
          <div style={styles.rightCol}>
            {/* APPOINTMENT CARD */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <Calendar size={20} color="var(--accent-blue)" />
                Appointment
              </h3>
              <div style={styles.appointmentBox}>
                <div style={styles.dateInfo}>
                  <span style={styles.bigDay}>{new Date(booking.appointmentStart).getDate()}</span>
                  <div style={styles.monthYear}>
                    <span>{new Date(booking.appointmentStart).toLocaleDateString(undefined, { month: 'long' })}</span>
                    <span>{new Date(booking.appointmentStart).getFullYear()}</span>
                  </div>
                </div>
                <div style={styles.timeInfo}>
                  <Clock size={16} />
                  <span>{new Date(booking.appointmentStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>

            {/* PAYMENT CARD */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <Receipt size={20} color="var(--accent-blue)" />
                Payment Status
              </h3>
              <div style={styles.paymentSummary}>
                <div style={styles.summaryRow}>
                  <span>Method</span>
                  <span style={styles.methodBadge}>{booking.paymentMethod}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span>Paid Amount</span>
                  <span style={styles.paidValue}>₱{paid.toLocaleString()}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span>Remaining</span>
                  <span style={styles.balanceValue}>₱{balance.toLocaleString()}</span>
                </div>
              </div>
              
              {balance > 0 && booking.paymentMethod === "GCASH" && (
                <button style={styles.primaryBtn} onClick={() => navigate("/customer/bookings")}>
                  <CreditCard size={18} />
                  Proceed to Payment
                </button>
              )}
            </div>

            {/* ACTIONS */}
            <div style={styles.actionSection}>
              {booking.status === "PENDING" || booking.status === "SCHEDULED" ? (
                <button style={styles.cancelBtn} onClick={requestCancel}>
                  <AlertTriangle size={18} />
                  Request Cancellation
                </button>
              ) : (
                <div style={styles.statusLocked}>
                  <Info size={16} />
                  <span>Booking is currently {booking.status.toLowerCase()} and cannot be cancelled online.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: { display: "flex", background: "var(--bg-primary)", minHeight: "100vh", fontFamily: "Poppins, system-ui" },
  main: { marginLeft: "260px", padding: "40px", width: "100%", color: "var(--text-primary)" },
  loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: "20px" },
  spinner: { width: "40px", height: "40px", border: "4px solid var(--border-color)", borderTopColor: "var(--accent-blue)", borderRadius: "50%", animation: "spin 1s linear infinite" },
  header: { marginBottom: "32px" },
  backBtn: { display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "14px", marginBottom: "16px", padding: 0 },
  headerTitle: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" },
  title: { fontSize: "32px", fontWeight: "800", margin: 0 },
  badgeGroup: { display: "flex", gap: "10px" },
  contentGrid: { display: "grid", gridTemplateColumns: "1fr 380px", gap: "32px" },
  leftCol: { display: "flex", flexDirection: "column", gap: "24px" },
  rightCol: { display: "flex", flexDirection: "column", gap: "24px" },
  card: { background: "var(--card-bg)", borderRadius: "20px", border: "1px solid var(--border-color)", padding: "24px" },
  cardTitle: { fontSize: "18px", fontWeight: "700", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px", color: "var(--text-primary)" },
  serviceList: { display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" },
  serviceItem: { display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "16px", borderBottom: "1px solid var(--border-color)" },
  serviceInfo: { display: "flex", flexDirection: "column" },
  serviceName: { fontWeight: "600", fontSize: "15px" },
  serviceCategory: { fontSize: "12px", color: "var(--text-secondary)" },
  servicePrice: { fontWeight: "700", color: "var(--text-primary)" },
  totalRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "var(--bg-tertiary)", borderRadius: "12px", fontWeight: "800", fontSize: "18px" },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" },
  infoItem: { display: "flex", flexDirection: "column", gap: "4px" },
  infoLabel: { fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "1px" },
  infoValue: { fontSize: "16px", fontWeight: "600" },
  notesBox: { padding: "16px", background: "var(--bg-tertiary)", borderRadius: "12px", fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" },
  appointmentBox: { display: "flex", alignItems: "center", gap: "24px" },
  dateInfo: { display: "flex", alignItems: "center", gap: "16px" },
  bigDay: { fontSize: "42px", fontWeight: "800", color: "var(--accent-blue)" },
  monthYear: { display: "flex", flexDirection: "column", fontSize: "14px", fontWeight: "600" },
  timeInfo: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "rgba(56, 189, 248, 0.1)", color: "var(--accent-blue)", borderRadius: "8px", fontSize: "14px", fontWeight: "700" },
  paymentSummary: { display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" },
  summaryRow: { display: "flex", justifyContent: "space-between", fontSize: "14px" },
  methodBadge: { padding: "4px 10px", background: "var(--bg-tertiary)", borderRadius: "6px", fontWeight: "700", fontSize: "12px" },
  paidValue: { color: "var(--accent-green)", fontWeight: "700" },
  balanceValue: { color: "var(--accent-red)", fontWeight: "700" },
  primaryBtn: { width: "100%", padding: "14px", borderRadius: "12px", border: "none", background: "var(--accent-blue)", color: "white", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", cursor: "pointer" },
  actionSection: { marginTop: "12px" },
  cancelBtn: { width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid var(--accent-red)", background: "transparent", color: "var(--accent-red)", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", cursor: "pointer" },
  statusLocked: { display: "flex", gap: "10px", padding: "16px", background: "var(--bg-tertiary)", borderRadius: "12px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.4" }
};

export default CustomerBookingView;
