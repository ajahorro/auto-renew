import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../../api/axios";
import AdminSideBar from "../../components/AdminSideBar";
import ConfirmModal from "../../components/ConfirmModal";
import BookingStatusBadge from "../../components/BookingStatusBadge";
import PaymentStatusBadge from "../../components/PaymentStatusBadge";
import toast from "react-hot-toast";
import { 
  ArrowLeft, 
  User, 
  Car, 
  Calendar, 
  MapPin, 
  CreditCard, 
  FileText, 
  Clock, 
  ShieldCheck, 
  Play, 
  CheckCircle2, 
  XCircle,
  PlusCircle,
  Receipt
} from "lucide-react";

const AdminBookingView = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [staff, setStaff] = useState([]);
  const [paymentInput, setPaymentInput] = useState("");
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null
  });

  const loadData = useCallback(async () => {
    try {
      const [bookingRes, staffRes] = await Promise.all([
        API.get(`/bookings/${id}`),
        API.get("/users?role=STAFF")
      ]);

      setBooking(bookingRes.data.booking || bookingRes.data);
      setStaff(staffRes.data.users || staffRes.data || []);
    } catch {
      toast.error("Error loading booking data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openConfirm = (title, message, action) => {
    setModal({
      open: true,
      title,
      message,
      onConfirm: async () => {
        await action();
        setModal(prev => ({ ...prev, open: false }));
      }
    });
  };

  const closeConfirm = () => setModal(prev => ({ ...prev, open: false }));

  const updateStatus = (status) => {
    openConfirm("Update Status", `Change booking to ${status}?`, async () => {
      try {
        if (status === "CANCELLED") {
          const res = await API.patch(`/bookings/cancel/${id}`);
          toast.success(res.data?.message || "Booking cancelled");
        } else {
          const res = await API.patch(`/bookings/${id}/status`, { status });
          toast.success(res.data?.message || `Moved to ${status}`);
        }
        loadData();
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to update status");
      }
    });
  };

  const assignStaff = (staffId) => {
    if (!staffId) return;
    openConfirm("Assign Staff", "Assign this staff member to the booking?", async () => {
      try {
        const res = await API.patch(`/bookings/assign/${id}`, { assignedStaffId: staffId });
        toast.success(res.data?.message || "Staff assigned successfully");
        loadData();
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to assign staff");
      }
    });
  };

  const recordPayment = async () => {
    if (!paymentInput || isNaN(paymentInput)) {
      return toast.error("Please enter a valid amount");
    }
    try {
      const res = await API.post(`/payments/record`, {
        bookingId: parseInt(id),
        amount: parseFloat(paymentInput),
        method: "CASH",
        reference: "ADMIN_RECORDED"
      });
      toast.success("Payment recorded!");
      setPaymentInput("");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record payment");
    }
  };

  if (loading) return (
    <div style={styles.page}>
      <AdminSideBar active="bookings" />
      <div style={styles.main}>Loading...</div>
    </div>
  );

  if (!booking) return (
    <div style={styles.page}>
      <AdminSideBar active="bookings" />
      <div style={styles.main}>Booking not found.</div>
    </div>
  );

  const total = Number(booking.totalAmount || 0);
  const paid = Number(booking.amountPaid || 0);
  const balance = total - paid;

  return (
    <div style={styles.page}>
      <AdminSideBar active="bookings" />
      <div style={styles.main}>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Back to Bookings
        </button>

        <div style={styles.header}>
          <div style={styles.headerInfo}>
            <h1 style={styles.title}>Booking #{booking.id.toString().padStart(4, '0')}</h1>
            <div style={styles.statusRow}>
              <BookingStatusBadge status={booking.status} />
              <PaymentStatusBadge status={booking.paymentStatus} />
            </div>
          </div>
          
          <div style={styles.headerActions}>
            {booking.status === "PENDING" && (
              <button style={{...styles.actionBtn, background: "var(--accent-blue)"}} onClick={() => updateStatus("CONFIRMED")}>
                <ShieldCheck size={18} />
                Confirm Booking
              </button>
            )}
            {booking.status === "CONFIRMED" && (
              <button style={{...styles.actionBtn, background: "var(--accent-orange)"}} onClick={() => updateStatus("ONGOING")}>
                <Play size={18} />
                Start Service
              </button>
            )}
            {booking.status === "ONGOING" && (
              <button style={{...styles.actionBtn, background: "var(--accent-green)"}} onClick={() => updateStatus("COMPLETED")}>
                <CheckCircle2 size={18} />
                Complete Service
              </button>
            )}
            {booking.status === "COMPLETED" && balance > 0 && (
              <button style={{...styles.actionBtn, background: "var(--accent-blue)"}} onClick={() => {
                const el = document.getElementById("payment-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}>
                <Receipt size={18} />
                Record Final Payment
              </button>
            )}
            {booking.status !== "CANCELLED" && booking.status !== "COMPLETED" && (
              <button style={{...styles.actionBtn, background: "rgba(239, 68, 68, 0.1)", color: "var(--accent-red)"}} onClick={() => updateStatus("CANCELLED")}>
                <XCircle size={18} />
                Cancel
              </button>
            )}
          </div>
        </div>

        <div style={styles.contentGrid}>
          <div style={styles.leftCol}>
            {/* SERVICES CARD */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <FileText size={18} color="var(--accent-blue)" />
                Service Details
              </h3>
              <div style={styles.serviceList}>
                {booking.items?.map((item, i) => (
                  <div key={i} style={styles.serviceItem}>
                    <div style={styles.serviceInfo}>
                      <span style={styles.serviceName}>{item.service?.name || item.serviceNameAtBooking}</span>
                      <span style={styles.serviceDesc}>{item.service?.description || "Package selected"}</span>
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

            {/* ASSIGNMENT CARD */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <User size={18} color="var(--accent-blue)" />
                Staff Assignment
              </h3>
              <div style={styles.assignmentBox}>
                {booking.assignedStaff ? (
                  <div style={styles.assignedStaff}>
                    <div style={styles.avatar}>{booking.assignedStaff.fullName?.[0]}</div>
                    <div style={styles.staffInfo}>
                      <span style={styles.staffName}>{booking.assignedStaff.fullName}</span>
                      <span style={styles.staffRole}>Assigned Detailer</span>
                    </div>
                    <button style={styles.changeBtn} onClick={() => {
                      const sel = document.getElementById("staff-select");
                      sel.focus();
                    }}>Change</button>
                  </div>
                ) : (
                  <div style={styles.unassigned}>
                    <Clock size={24} color="var(--text-secondary)" />
                    <span>No staff assigned yet</span>
                  </div>
                )}
                
                <div style={styles.assignAction}>
                  <select 
                    id="staff-select"
                    style={styles.select}
                    onChange={(e) => assignStaff(e.target.value)}
                    value=""
                  >
                    <option value="" disabled>Select staff to assign...</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.fullName}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.rightCol}>
            {/* CUSTOMER CARD */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <User size={18} color="var(--accent-blue)" />
                Customer & Vehicle
              </h3>
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <label>Customer Name</label>
                  <span>{booking.customer?.fullName}</span>
                </div>
                <div style={styles.infoItem}>
                  <label>Contact Number</label>
                  <span>{booking.contactNumber || booking.customer?.phone}</span>
                </div>
                <div style={styles.infoItem}>
                  <label>Vehicle Type</label>
                  <span>{booking.vehicleType}</span>
                </div>
                <div style={styles.infoItem}>
                  <label>Plate Number</label>
                  <span>{booking.plateNumber || "N/A"}</span>
                </div>
                <div style={styles.infoItem}>
                  <label>Appointment Time</label>
                  <span>{new Date(booking.appointmentStart).toLocaleString()}</span>
                </div>
                <div style={styles.infoItem}>
                  <label>Payment Method</label>
                  <span>{booking.paymentMethod}</span>
                </div>
              </div>
            </div>

            {/* PAYMENT CARD */}
            <div id="payment-section" style={styles.card}>
              <h3 style={styles.cardTitle}>
                <CreditCard size={18} color="var(--accent-blue)" />
                Payment Record
              </h3>
              <div style={styles.paymentSummary}>
                <div style={styles.payRow}>
                  <label>Amount Paid</label>
                  <span style={{color: "var(--accent-green)"}}>₱{paid.toLocaleString()}</span>
                </div>
                <div style={styles.payRow}>
                  <label>Remaining Balance</label>
                  <span style={{color: balance > 0 ? "var(--accent-red)" : "var(--accent-green)"}}>
                    ₱{balance.toLocaleString()}
                  </span>
                </div>
              </div>

              {balance > 0 && (
                <div style={styles.recordAction}>
                  <div style={styles.inputGroup}>
                    <span style={styles.inputPrefix}>₱</span>
                    <input 
                      style={styles.input}
                      placeholder="Enter amount"
                      value={paymentInput}
                      onChange={(e) => setPaymentInput(e.target.value)}
                    />
                  </div>
                  <button style={styles.recordBtn} onClick={recordPayment}>
                    <PlusCircle size={16} />
                    Record Cash Payment
                  </button>
                </div>
              )}

              {booking.payments?.length > 0 && (
                <div style={styles.paymentHistory}>
                  <label style={styles.histLabel}>Transaction History</label>
                  {booking.payments.map((p, i) => (
                    <div key={i} style={styles.histItem}>
                      <div style={styles.histLeft}>
                        <span style={styles.histMethod}>{p.method}</span>
                        <span style={styles.histDate}>{new Date(p.createdAt).toLocaleDateString()}</span>
                      </div>
                      <span style={styles.histAmount}>+₱{Number(p.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <ConfirmModal 
          isOpen={modal.open}
          title={modal.title}
          message={modal.message}
          onConfirm={modal.onConfirm}
          onCancel={closeConfirm}
          type={modal.title.includes("Cancel") ? "danger" : "primary"}
        />
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
    marginLeft: "280px",
    padding: "40px",
    width: "100%",
    color: "var(--text-primary)"
  },
  backBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "transparent",
    border: "none",
    color: "var(--text-secondary)",
    cursor: "pointer",
    marginBottom: "24px",
    fontSize: "14px",
    fontWeight: "600"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "32px"
  },
  headerInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  title: {
    fontSize: "32px",
    fontWeight: "800",
    margin: 0
  },
  statusRow: {
    display: "flex",
    gap: "10px"
  },
  headerActions: {
    display: "flex",
    gap: "12px"
  },
  actionBtn: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 20px",
    borderRadius: "12px",
    border: "none",
    color: "white",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "14px",
    transition: "0.2s"
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr",
    gap: "24px"
  },
  card: {
    background: "var(--card-bg)",
    borderRadius: "20px",
    padding: "24px",
    border: "1px solid var(--border-color)",
    marginBottom: "24px"
  },
  cardTitle: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "18px",
    fontWeight: "700",
    marginBottom: "24px",
    color: "var(--text-primary)"
  },
  serviceList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },
  serviceItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px",
    background: "var(--bg-tertiary)",
    borderRadius: "12px"
  },
  serviceInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  },
  serviceName: {
    fontWeight: "700",
    fontSize: "15px"
  },
  serviceDesc: {
    fontSize: "12px",
    color: "var(--text-secondary)"
  },
  servicePrice: {
    fontWeight: "800",
    color: "var(--accent-blue)"
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "20px",
    padding: "20px 16px",
    borderTop: "2px dashed var(--border-color)",
    fontSize: "18px",
    fontWeight: "800"
  },
  assignmentBox: {
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },
  assignedStaff: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px",
    background: "rgba(56, 189, 248, 0.05)",
    borderRadius: "14px",
    border: "1px solid rgba(56, 189, 248, 0.2)"
  },
  avatar: {
    width: "44px",
    height: "44px",
    borderRadius: "12px",
    background: "var(--accent-blue)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
    fontSize: "18px"
  },
  staffInfo: {
    display: "flex",
    flexDirection: "column",
    flex: 1
  },
  staffName: {
    fontWeight: "700",
    fontSize: "15px"
  },
  staffRole: {
    fontSize: "12px",
    color: "var(--text-secondary)"
  },
  changeBtn: {
    padding: "6px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border-color)",
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer"
  },
  unassigned: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "30px",
    background: "var(--bg-tertiary)",
    borderRadius: "14px",
    color: "var(--text-secondary)"
  },
  assignAction: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  select: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    background: "var(--card-bg)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-color)",
    outline: "none"
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px"
  },
  infoItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  },
  infoLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "var(--text-secondary)"
  },
  paymentSummary: {
    padding: "20px",
    background: "var(--bg-tertiary)",
    borderRadius: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginBottom: "24px"
  },
  payRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: "700"
  },
  recordAction: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  inputGroup: {
    position: "relative",
    display: "flex",
    alignItems: "center"
  },
  inputPrefix: {
    position: "absolute",
    left: "14px",
    fontWeight: "700",
    color: "var(--text-secondary)"
  },
  input: {
    width: "100%",
    padding: "12px 12px 12px 30px",
    borderRadius: "10px",
    border: "1px solid var(--border-color)",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    fontWeight: "700"
  },
  recordBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    padding: "14px",
    borderRadius: "12px",
    background: "var(--accent-blue)",
    color: "white",
    fontWeight: "700",
    border: "none",
    cursor: "pointer"
  },
  paymentHistory: {
    marginTop: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  histLabel: {
    fontSize: "12px",
    fontWeight: "700",
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.5px"
  },
  histItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px",
    borderRadius: "10px",
    background: "rgba(34, 197, 94, 0.05)"
  },
  histLeft: {
    display: "flex",
    flexDirection: "column"
  },
  histMethod: {
    fontSize: "13px",
    fontWeight: "600"
  },
  histDate: {
    fontSize: "11px",
    color: "var(--text-secondary)"
  },
  histAmount: {
    fontWeight: "700",
    color: "var(--accent-green)"
  }
};

export default AdminBookingView;
