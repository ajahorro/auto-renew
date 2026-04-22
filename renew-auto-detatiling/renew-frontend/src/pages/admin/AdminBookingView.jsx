import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../../api/axios";
import AdminSideBar from "../../components/AdminSideBar";
import ConfirmModal from "../../components/ConfirmModal";
import BookingStatusBadge from "../../components/BookingStatusBadge";
import PaymentStatusBadge from "../../components/PaymentStatusBadge";
import ServiceStatusBadge from "../../components/ServiceStatusBadge";
import toast from "react-hot-toast";
import {
  ArrowLeft, User, Car, Calendar, CreditCard, FileText,
  Clock, XCircle, PlusCircle, Receipt, Eye, CheckCircle2,
  AlertTriangle, RefreshCw, History, ChevronDown, ChevronUp, Image
} from "lucide-react";

const AdminBookingView = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [staff, setStaff] = useState([]);
  const [cashInput, setCashInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [modal, setModal] = useState({ open: false, title: "", message: "", onConfirm: null });

  const loadAuditLogs = useCallback(async () => {
    try {
      const res = await API.get(`/bookings/${id}/audit-logs`);
      setAuditLogs(res.data.logs || []);
    } catch {
      setAuditLogs([]);
    }
  }, [id]);

  const loadData = useCallback(async () => {
    try {
      const [bookingRes, staffRes] = await Promise.all([
        API.get(`/bookings/${id}`),
        API.get("/admin/users?role=STAFF")
      ]);
      setBooking(bookingRes.data.booking || bookingRes.data);
      setStaff(staffRes.data.users || staffRes.data || []);
      if (auditOpen) loadAuditLogs();
    } catch {
      toast.error("Error loading booking data");
    } finally {
      setLoading(false);
    }
  }, [id, auditOpen, loadAuditLogs]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (auditOpen) loadAuditLogs(); }, [auditOpen, loadAuditLogs]);

  const openConfirm = (title, message, action) => {
    setModal({ open: true, title, message, onConfirm: async () => { await action(); setModal(p => ({ ...p, open: false })); } });
  };
  const closeConfirm = () => setModal(p => ({ ...p, open: false }));

  const cancelBooking = () => {
    openConfirm("Cancel Booking", "Are you sure you want to cancel this booking? This action cannot be undone.", async () => {
      try {
        await API.patch(`/bookings/cancel/${id}`);
        toast.success("Booking cancelled");
        loadData();
        loadAuditLogs();
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to cancel booking");
      }
    });
  };

  const assignStaff = (staffId) => {
    if (!staffId) return;
    openConfirm("Assign Staff", "Assign this staff member to the booking?", async () => {
      try {
        await API.patch(`/bookings/assign/${id}`, { assignedStaffId: staffId });
        toast.success("Staff assigned successfully");
        loadData();
        loadAuditLogs();
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to assign staff");
      }
    });
  };

  const handlePaymentAction = async (paymentId, action, reason = "") => {
    try {
      await API.patch(`/payments/${paymentId}/verify`, { action, rejectionReason: reason });
      toast.success(
        action === "approve" ? "Payment approved" :
        action === "reject" ? "Payment rejected" :
        "Resubmission requested"
      );
      loadData();
      loadAuditLogs();
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed");
    }
  };

  const handleCancellationRequest = async (action) => {
    const title = action === "approve" ? "Approve Cancellation" : "Reject Cancellation";
    const message = action === "approve" 
      ? "This will cancel the booking and notify the customer. Proceed?" 
      : "This will reject the request and keep the booking active. Proceed?";

    openConfirm(title, message, async () => {
      try {
        await API.patch(`/bookings/${id}/cancel-request`, { action });
        toast.success(action === "approve" ? "Booking cancelled" : "Request rejected");
        loadData();
        loadAuditLogs();
      } catch (err) {
        toast.error(err.response?.data?.message || "Action failed");
      }
    });
  };

  const recordCashPayment = async () => {
    if (!cashInput || isNaN(cashInput) || Number(cashInput) <= 0) {
      return toast.error("Please enter a valid amount");
    }
    try {
      await API.post("/payments/manual", { bookingId: parseInt(id), amount: parseFloat(cashInput) });
      toast.success("Cash payment recorded!");
      setCashInput("");
      loadData();
      loadAuditLogs();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record payment");
    }
  };

  if (loading) return <div style={S.page}><AdminSideBar active="bookings" /><div style={S.main}>Loading...</div></div>;
  if (!booking) return <div style={S.page}><AdminSideBar active="bookings" /><div style={S.main}>Booking not found.</div></div>;

  const total = Number(booking.totalAmount || 0);
  const paid = Number(booking.amountPaid || 0);
  const balance = total - paid;
  const isCancelled = booking.status === "CANCELLED";
  const isCompleted = booking.status === "COMPLETED";
  const isLocked = isCancelled || isCompleted;

  // Payments awaiting verification
  const pendingPayments = (booking.payments || []).filter(p => p.status === "FOR_VERIFICATION" || p.status === "PENDING");
  const approvedPayments = (booking.payments || []).filter(p => p.status === "APPROVED");

  return (
    <div style={S.page}>
      <AdminSideBar active="bookings" />
      <div style={S.main}>
        <button style={S.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back to Bookings
        </button>

        {/* HEADER */}
        <div style={S.header}>
          <div style={S.headerInfo}>
            <h1 style={S.title}>Booking #{String(booking.id).padStart(4, "0")}</h1>
            <div style={S.statusRow}>
              <div style={S.statusGroup}>
                <span style={S.statusLabel}>Service Status</span>
                <ServiceStatusBadge status={booking.serviceStatus} />
              </div>
              <div style={S.statusGroup}>
                <span style={S.statusLabel}>Payment</span>
                <PaymentStatusBadge status={booking.paymentStatus} />
              </div>
            </div>
          </div>
          <div style={S.headerActions}>
            {!isLocked && (
              <button style={S.cancelBtn} onClick={cancelBooking}>
                <XCircle size={18} /> Cancel Booking
              </button>
            )}
          </div>
        </div>

        {booking.cancellationStatus === "REQUESTED" && (
          <div style={S.cancellationAlert}>
            <div style={S.alertIcon}><AlertTriangle size={24} /></div>
            <div style={S.alertContent}>
              <h4 style={S.alertTitle}>Cancellation Requested by Customer</h4>
              <p style={S.alertMessage}>"{booking.cancellationReason || "No reason provided"}"</p>
            </div>
            <div style={S.alertActions}>
              <button style={S.alertApproveBtn} onClick={() => handleCancellationRequest("approve")}>
                Approve & Cancel
              </button>
              <button style={S.alertRejectBtn} onClick={() => handleCancellationRequest("reject")}>
                Reject Request
              </button>
            </div>
          </div>
        )}

        <div style={S.contentGrid}>
          {/* LEFT COLUMN */}
          <div style={S.leftCol}>
            {/* SERVICE DETAILS */}
            <div style={S.card}>
              <h3 style={S.cardTitle}><FileText size={18} color="var(--accent-blue)" /> Service Details</h3>
              <div style={S.serviceList}>
                {booking.items?.map((item, i) => (
                  <div key={i} style={S.serviceItem}>
                    <div style={S.serviceInfo}>
                      <span style={S.serviceName}>{item.service?.name || item.serviceNameAtBooking}</span>
                      <span style={S.serviceDesc}>{item.service?.description || "Package selected"}</span>
                    </div>
                    <span style={S.servicePrice}>₱{Number(item.priceAtBooking || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div style={S.totalRow}>
                <span>Total Amount</span><span>₱{total.toLocaleString()}</span>
              </div>
            </div>

            {/* STAFF ASSIGNMENT */}
            <div style={S.card}>
              <h3 style={S.cardTitle}><User size={18} color="var(--accent-blue)" /> Staff Assignment</h3>
              {booking.assignedStaff ? (
                <div style={S.assignedStaff}>
                  <div style={S.avatar}>{booking.assignedStaff.fullName?.[0]}</div>
                  <div style={S.staffInfo}>
                    <span style={S.staffName}>{booking.assignedStaff.fullName}</span>
                    <span style={S.staffRole}>Assigned Detailer</span>
                  </div>
                </div>
              ) : (
                <div style={S.unassigned}><Clock size={24} color="var(--text-secondary)" /><span>No staff assigned yet</span></div>
              )}
              {!isLocked && (
                <select style={S.select} onChange={e => assignStaff(e.target.value)} value="">
                  <option value="" disabled>{booking.assignedStaff ? "Reassign staff..." : "Select staff to assign..."}</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                </select>
              )}
            </div>

            {/* PAYMENT VERIFICATION PANEL */}
            <div style={S.card}>
              <h3 style={S.cardTitle}><CreditCard size={18} color="var(--accent-blue)" /> Payment Verification</h3>

              {/* Summary row */}
              <div style={S.paymentSummary}>
                <div style={S.payRow}><label>Total</label><span>₱{total.toLocaleString()}</span></div>
                <div style={S.payRow}><label>Amount Paid</label><span style={{ color: "var(--accent-green)" }}>₱{paid.toLocaleString()}</span></div>
                <div style={S.payRow}><label>Balance</label><span style={{ color: balance > 0 ? "var(--accent-red)" : "var(--accent-green)" }}>₱{balance.toLocaleString()}</span></div>
              </div>

              {/* Payments awaiting verification */}
              {pendingPayments.length > 0 && (
                <div style={S.verificationList}>
                  <p style={S.sectionLabel}>Awaiting Verification</p>
                  {pendingPayments.map(p => (
                    <div key={p.id} style={S.verifyCard}>
                      <div style={S.verifyTop}>
                        <div>
                          <span style={S.verifyAmount}>₱{Number(p.amount).toLocaleString()}</span>
                          <span style={S.verifyMethod}>{p.method} · {p.paymentType || "FULL"}</span>
                        </div>
                        <PaymentStatusBadge status={p.status} />
                      </div>

                      {/* Receipt image */}
                      {p.proofImage && (
                        <div style={S.receiptBox}>
                          <Image size={14} color="var(--text-secondary)" />
                          <a href={p.proofImage} target="_blank" rel="noopener noreferrer" style={S.receiptLink}>
                            View Receipt
                          </a>
                          <img
                            src={p.proofImage}
                            alt="Receipt"
                            style={S.receiptThumb}
                            onClick={() => window.open(p.proofImage, "_blank")}
                          />
                        </div>
                      )}

                      {/* Actions */}
                      <div style={S.verifyActions}>
                        <button style={S.approveBtn} onClick={() => handlePaymentAction(p.id, "approve")}>
                          <CheckCircle2 size={14} /> Approve
                        </button>
                        <button style={S.rejectBtn} onClick={() => { setRejectTarget(p.id); setRejectReason(""); setRejectModalOpen(true); }}>
                          <XCircle size={14} /> Reject
                        </button>
                        <button style={S.resubmitBtn} onClick={() => handlePaymentAction(p.id, "resubmit")}>
                          <RefreshCw size={14} /> Request Resubmission
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Cash payment recorder */}
              {booking.paymentMethod === "CASH" && balance > 0 && !isLocked && (
                <div style={S.cashSection}>
                  <p style={S.sectionLabel}>Record Cash Payment</p>
                  <div style={S.inputGroup}>
                    <span style={S.inputPrefix}>₱</span>
                    <input style={S.input} placeholder="Enter amount" value={cashInput} onChange={e => setCashInput(e.target.value)} type="number" />
                  </div>
                  <button style={S.recordBtn} onClick={recordCashPayment}>
                    <PlusCircle size={16} /> Record Payment
                  </button>
                </div>
              )}

              {/* Approved payment history */}
              {approvedPayments.length > 0 && (
                <div style={S.historySection}>
                  <p style={S.sectionLabel}>Approved Payments</p>
                  {approvedPayments.map((p, i) => (
                    <div key={i} style={S.histItem}>
                      <div>
                        <span style={S.histMethod}>{p.method}</span>
                        <span style={S.histDate}>{new Date(p.createdAt).toLocaleDateString()}</span>
                      </div>
                      <span style={S.histAmount}>+₱{Number(p.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={S.rightCol}>
            {/* CUSTOMER & VEHICLE */}
            <div style={S.card}>
              <h3 style={S.cardTitle}><User size={18} color="var(--accent-blue)" /> Customer & Vehicle</h3>
              <div style={S.infoGrid}>
                <div style={S.infoItem}><label>Customer</label><span>{booking.customer?.fullName}</span></div>
                <div style={S.infoItem}><label>Contact</label><span>{booking.contactNumber || booking.customer?.phone}</span></div>
                <div style={S.infoItem}><label>Vehicle Type</label><span>{booking.vehicleType}</span></div>
                <div style={S.infoItem}><label>Plate Number</label><span>{booking.plateNumber || "N/A"}</span></div>
                <div style={S.infoItem}><label>Appointment</label><span>{new Date(booking.appointmentStart).toLocaleString()}</span></div>
                <div style={S.infoItem}><label>Payment Method</label><span>{booking.paymentMethod}</span></div>
              </div>
            </div>

            {/* NOTES */}
            {booking.notes && (
              <div style={S.card}>
                <h3 style={S.cardTitle}><FileText size={18} color="var(--accent-blue)" /> Customer Notes</h3>
                <p style={S.notes}>{booking.notes}</p>
              </div>
            )}

            {/* AUDIT HISTORY */}
            <div style={S.card}>
              <button style={S.auditToggle} onClick={() => setAuditOpen(o => !o)}>
                <div style={S.auditToggleLeft}><History size={18} color="var(--accent-blue)" /> Audit History</div>
                {auditOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {auditOpen && (
                <div style={S.auditList}>
                  {auditLogs.length === 0 ? (
                    <p style={S.auditEmpty}>No audit logs yet.</p>
                  ) : auditLogs.map(log => (
                    <div key={log.id} style={S.auditItem}>
                      <div style={S.auditAction}>{log.action}</div>
                      <div style={S.auditDetails}>{log.details}</div>
                      <div style={S.auditMeta}>
                        {log.performer?.fullName || "System"} · {log.performer?.role || ""} · {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* REJECT MODAL */}
        {rejectModalOpen && (
          <div style={S.overlay} onClick={() => setRejectModalOpen(false)}>
            <div style={S.rejectModal} onClick={e => e.stopPropagation()}>
              <h3 style={{ marginBottom: 16 }}>Reject Payment</h3>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>Provide a reason for rejection (optional):</p>
              <textarea
                style={S.textarea}
                placeholder="e.g. Invalid receipt / payment not found"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
              />
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button style={S.approveBtn} onClick={() => { handlePaymentAction(rejectTarget, "reject", rejectReason); setRejectModalOpen(false); }}>
                  Confirm Reject
                </button>
                <button style={S.resubmitBtn} onClick={() => setRejectModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <ConfirmModal isOpen={modal.open} title={modal.title} message={modal.message} onConfirm={modal.onConfirm} onCancel={closeConfirm} type={modal.title.includes("Cancel") ? "danger" : "primary"} />
      </div>
    </div>
  );
};

const S = {
  page: { display: "flex", background: "var(--bg-primary)", minHeight: "100vh", fontFamily: "Poppins, system-ui" },
  main: { marginLeft: "280px", padding: "40px", width: "100%", color: "var(--text-primary)" },
  backBtn: { display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", marginBottom: 24, fontSize: 14, fontWeight: 600 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 },
  headerInfo: { display: "flex", flexDirection: "column", gap: 12 },
  title: { fontSize: 32, fontWeight: 800, margin: 0 },
  statusRow: { display: "flex", gap: 16, flexWrap: "wrap" },
  statusGroup: { display: "flex", flexDirection: "column", gap: 4 },
  statusLabel: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)" },
  headerActions: { display: "flex", gap: 12 },
  cancelBtn: { display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: "none", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 700, cursor: "pointer", fontSize: 14 },
  contentGrid: { display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 24 },
  leftCol: {}, rightCol: {},
  card: { background: "var(--card-bg)", borderRadius: 20, padding: 24, border: "1px solid var(--border-color)", marginBottom: 24 },
  cardTitle: { display: "flex", alignItems: "center", gap: 12, fontSize: 18, fontWeight: 700, marginBottom: 20, color: "var(--text-primary)" },
  serviceList: { display: "flex", flexDirection: "column", gap: 12 },
  serviceItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14, background: "var(--bg-tertiary)", borderRadius: 10 },
  serviceInfo: { display: "flex", flexDirection: "column", gap: 2 },
  serviceName: { fontWeight: 700, fontSize: 14 },
  serviceDesc: { fontSize: 12, color: "var(--text-secondary)" },
  servicePrice: { fontWeight: 800, color: "var(--accent-blue)" },
  totalRow: { display: "flex", justifyContent: "space-between", marginTop: 16, padding: "16px 0 0", borderTop: "2px dashed var(--border-color)", fontSize: 17, fontWeight: 800 },
  assignedStaff: { display: "flex", alignItems: "center", gap: 14, padding: 14, background: "rgba(56,189,248,0.05)", borderRadius: 12, border: "1px solid rgba(56,189,248,0.2)", marginBottom: 12 },
  avatar: { width: 42, height: 42, borderRadius: 10, background: "var(--accent-blue)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 },
  staffInfo: { display: "flex", flexDirection: "column" },
  staffName: { fontWeight: 700, fontSize: 14 },
  staffRole: { fontSize: 12, color: "var(--text-secondary)" },
  unassigned: { display: "flex", alignItems: "center", gap: 10, padding: 20, background: "var(--bg-tertiary)", borderRadius: 10, color: "var(--text-secondary)", marginBottom: 12 },
  select: { width: "100%", padding: 11, borderRadius: 10, background: "var(--card-bg)", color: "var(--text-primary)", border: "1px solid var(--border-color)", outline: "none", marginTop: 8 },
  paymentSummary: { padding: 16, background: "var(--bg-tertiary)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 },
  payRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: 14 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 },
  verificationList: { marginBottom: 20 },
  verifyCard: { padding: 16, background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 12, marginBottom: 12 },
  verifyTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  verifyAmount: { fontSize: 18, fontWeight: 800, display: "block" },
  verifyMethod: { fontSize: 12, color: "var(--text-secondary)" },
  receiptBox: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
  receiptLink: { fontSize: 12, color: "var(--accent-blue)", textDecoration: "none", fontWeight: 600 },
  receiptThumb: { width: 60, height: 60, objectFit: "cover", borderRadius: 8, cursor: "pointer", border: "1px solid var(--border-color)" },
  verifyActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  approveBtn: { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--accent-green)", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 12 },
  rejectBtn: { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontWeight: 700, cursor: "pointer", fontSize: 12 },
  resubmitBtn: { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", fontWeight: 600, cursor: "pointer", fontSize: 12 },
  cashSection: { marginBottom: 20 },
  inputGroup: { position: "relative", display: "flex", alignItems: "center", marginBottom: 10 },
  inputPrefix: { position: "absolute", left: 12, fontWeight: 700, color: "var(--text-secondary)" },
  input: { width: "100%", padding: "11px 11px 11px 28px", borderRadius: 10, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)", fontWeight: 700 },
  recordBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 13, borderRadius: 10, background: "var(--accent-blue)", color: "white", fontWeight: 700, border: "none", cursor: "pointer" },
  historySection: { marginTop: 16 },
  histItem: { display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: "rgba(34,197,94,0.05)", marginBottom: 6 },
  histMethod: { fontSize: 13, fontWeight: 600, display: "block" },
  histDate: { fontSize: 11, color: "var(--text-secondary)" },
  histAmount: { fontWeight: 700, color: "var(--accent-green)" },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  infoItem: { display: "flex", flexDirection: "column", gap: 3 },
  notes: { fontSize: 14, lineHeight: 1.6, color: "var(--text-primary)" },
  auditToggle: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "transparent", border: "none", cursor: "pointer", color: "var(--text-primary)", padding: 0, marginBottom: 0 },
  auditToggleLeft: { display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 700 },
  auditList: { marginTop: 16, display: "flex", flexDirection: "column", gap: 10 },
  auditItem: { padding: 12, background: "var(--bg-tertiary)", borderRadius: 10, borderLeft: "3px solid var(--accent-blue)" },
  auditAction: { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--accent-blue)", marginBottom: 4 },
  auditDetails: { fontSize: 13, fontWeight: 500, marginBottom: 4 },
  auditMeta: { fontSize: 11, color: "var(--text-secondary)" },
  auditEmpty: { fontSize: 13, color: "var(--text-secondary)", textAlign: "center", padding: 20 },
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" },
  rejectModal: { background: "var(--card-bg)", borderRadius: 20, padding: 32, width: "100%", maxWidth: 480, border: "1px solid var(--border-color)" },
  textarea: { width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, resize: "vertical", boxSizing: "border-box" },
  cancellationAlert: { 
    display: "flex", 
    alignItems: "center", 
    gap: 20, 
    padding: "20px 24px", 
    background: "rgba(239, 68, 68, 0.05)", 
    border: "1px solid rgba(239, 68, 68, 0.2)", 
    borderRadius: 16, 
    marginBottom: 24,
    animation: "fadeIn 0.3s ease-out"
  },
  alertIcon: { color: "#ef4444" },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: 700, color: "#ef4444", marginBottom: 4 },
  alertMessage: { fontSize: 14, color: "var(--text-secondary)", fontStyle: "italic" },
  alertActions: { display: "flex", gap: 12 },
  alertApproveBtn: { padding: "10px 16px", borderRadius: 10, border: "none", background: "#ef4444", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 13 },
  alertRejectBtn: { padding: "10px 16px", borderRadius: 10, border: "1px solid var(--border-color)", background: "var(--card-bg)", color: "var(--text-primary)", fontWeight: 600, cursor: "pointer", fontSize: 13 }
};

export default AdminBookingView;
