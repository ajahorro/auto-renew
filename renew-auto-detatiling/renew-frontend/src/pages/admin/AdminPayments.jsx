import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import API from "../../api/axios";
import AdminSidebar from "../../components/AdminSideBar";
import PaymentStatusBadge from "../../components/PaymentStatusBadge";
import { CheckCircle2, XCircle, RefreshCw, Eye, Image } from "lucide-react";

const AdminPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("for_verification");
  const [rejectModal, setRejectModal] = useState({ open: false, paymentId: null });
  const [rejectReason, setRejectReason] = useState("");
  const [preview, setPreview] = useState(null);
  const previewUrl = preview?.url || null;
  const setPreviewUrl = (value) => setPreview(value ? { url: value, mimeType: "" } : null);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setPayments([]); 
    try {
      let endpoint;
      if (filter === "for_verification") {
        endpoint = "/payments/pending"; 
      } else if (filter === "all") {
        endpoint = "/payments";
      } else {
        endpoint = `/payments?status=${filter.toUpperCase()}`;
      }
      const res = await API.get(endpoint);
      setPayments(res.data.payments || []);
    } catch (err) {
      console.error("Fetch payments error:", err);
      toast.error("Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleAction = async (paymentId, action, reason = "") => {
    try {
      await API.patch(`/payments/${paymentId}/verify`, { action, rejectionReason: reason });
      toast.success(
        action === "approve" ? "Payment approved!" :
        action === "reject"  ? "Payment rejected." :
        "Resubmission requested."
      );
      loadPayments();
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed");
    }
  };

  const openReject = (paymentId) => {
    setRejectReason("");
    setRejectModal({ open: true, paymentId });
  };

  const confirmReject = () => {
    handleAction(rejectModal.paymentId, "reject", rejectReason);
    setRejectModal({ open: false, paymentId: null });
  };

  const formatDate = (date) =>
    new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  const TABS = [
    { key: "for_verification", label: "For Verification" },
    { key: "paid",             label: "Approved" },
    { key: "rejected",         label: "Rejected" },
    { key: "all",              label: "All" }
  ];

  const S = {
    page: { display: "flex", background: "var(--bg-primary)", minHeight: "100vh", fontFamily: "'Poppins', sans-serif" },
    main: { marginLeft: "280px", padding: "40px", width: "100%", color: "var(--text-primary)" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
    title: { fontSize: 28, fontWeight: 700, marginBottom: 4 },
    subtitle: { color: "var(--text-secondary)", fontSize: 14 },
    filterTabs: { display: "flex", gap: 10, marginBottom: 24 },
    filterTab: { padding: "9px 18px", border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", borderRadius: 10, cursor: "pointer", fontWeight: 500, transition: "0.2s", fontSize: 13 },
    filterTabActive: { background: "var(--accent-blue)", color: "#fff", borderColor: "var(--accent-blue)" },
    emptyState: { textAlign: "center", padding: 60, color: "var(--text-secondary)", background: "var(--card-bg)", borderRadius: 16 },
    table: { background: "var(--card-bg)", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border-color)" },
    tableHeader: { display: "flex", padding: "14px 20px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary)", letterSpacing: "0.5px" },
    tableRow: { display: "flex", padding: "14px 20px", borderBottom: "1px solid var(--border-color)", alignItems: "center", transition: "0.2s" },
    col: { fontSize: 11 },
    cell: { display: "flex", flexDirection: "column", justifyContent: "center", fontSize: 13, gap: 2 },
    customerName: { fontWeight: 600 },
    customerEmail: { fontSize: 11, color: "var(--text-secondary)" },
    bookingId: { fontWeight: 600, color: "var(--accent-blue)" },
    bookingTotal: { fontSize: 11, color: "var(--text-secondary)" },
    amount: { fontSize: 15, fontWeight: 800, color: "var(--accent-blue)" },
    badge: { display: "inline-block", padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: "#fff", width: "fit-content" },
    receiptBtn: { display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--accent-blue)", background: "transparent", color: "var(--accent-blue)", fontSize: 12, fontWeight: 600, cursor: "pointer" },
    actionButtons: { display: "flex", gap: 6, flexWrap: "wrap" },
    approveBtn: { display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "#22c55e", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700 },
    rejectBtn: { display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "transparent", color: "#ef4444", border: "1px solid #ef4444", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700 },
    resubmitBtn: { display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-color)", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600 },
    overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" },
    previewModal: { background: "var(--card-bg)", borderRadius: 20, padding: 24, maxWidth: 560, width: "90%", border: "1px solid var(--border-color)" },
    previewHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    closeBtn: { background: "none", border: "none", color: "var(--text-secondary)", fontSize: 24, cursor: "pointer", lineHeight: 1 },
    previewImg: { width: "100%", borderRadius: 12, maxHeight: 480, objectFit: "contain", background: "#000" },
    openLink: { display: "block", marginTop: 12, textAlign: "center", fontSize: 13, color: "var(--accent-blue)", fontWeight: 600 },
    rejectModalBox: { background: "var(--card-bg)", borderRadius: 20, padding: 28, maxWidth: 440, width: "90%", border: "1px solid var(--border-color)" },
    textarea: { width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, resize: "vertical", boxSizing: "border-box" }
  };

  return (
    <div style={S.page}>
      <AdminSidebar active="payments" />
      <div style={S.main}>
        <header style={S.header}>
          <div>
            <h1 style={S.title}>Payment Verification</h1>
            <p style={S.subtitle}>Review, approve, or reject customer payments</p>
          </div>
        </header>

        <div style={S.filterTabs}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              style={{ ...S.filterTab, ...(filter === tab.key ? S.filterTabActive : {}) }}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={S.emptyState}>Loading payments...</div>
        ) : payments.length === 0 ? (
          <div style={S.emptyState}>No {filter.replace("_", " ")} payments found.</div>
        ) : (
          <div style={S.table}>
            <div style={S.tableHeader}>
              <div style={{ ...S.col, flex: 0.5 }}>ID</div>
              <div style={{ ...S.col, flex: 1.5 }}>Customer</div>
              <div style={{ ...S.col, flex: 1 }}>Booking</div>
              <div style={{ ...S.col, flex: 1 }}>Amount</div>
              <div style={{ ...S.col, flex: 0.8 }}>Type</div>
              <div style={{ ...S.col, flex: 0.8 }}>Method</div>
              <div style={{ ...S.col, flex: 1 }}>Status</div>
              <div style={{ ...S.col, flex: 0.8 }}>Receipt</div>
              <div style={{ ...S.col, flex: 1.5 }}>Date</div>
              {filter === "for_verification" && <div style={{ ...S.col, flex: 2 }}>Actions</div>}
            </div>

            {payments.map((payment) => {
              const customer = payment.booking?.customer;
              return (
                <div key={payment.id} style={S.tableRow}>
                  <div style={{ ...S.cell, flex: 0.5 }}>#{payment.id}</div>
                  <div style={{ ...S.cell, flex: 1.5 }}>
                    <span style={S.customerName}>{customer?.fullName || "N/A"}</span>
                    <span style={S.customerEmail}>{customer?.email || ""}</span>
                  </div>
                  <div style={{ ...S.cell, flex: 1 }}>
                    <span style={S.bookingId}>#{payment.bookingId}</span>
                    <span style={S.bookingTotal}>Total: ₱{Number(payment.booking?.totalAmount || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ ...S.cell, flex: 1 }}>
                    <span style={S.amount}>₱{Number(payment.amount).toLocaleString()}</span>
                  </div>
                  <div style={{ ...S.cell, flex: 0.8 }}>
                    <span style={{ ...S.badge, background: payment.paymentType === "DOWNPAYMENT" ? "#8b5cf6" : "#3b82f6" }}>
                      {payment.paymentType || "FULL"}
                    </span>
                  </div>
                  <div style={{ ...S.cell, flex: 0.8 }}>
                    <span style={{ ...S.badge, background: payment.method === "GCASH" ? "#8b5cf6" : "#64748b" }}>
                      {payment.method}
                    </span>
                  </div>
                  <div style={{ ...S.cell, flex: 1 }}>
                    <PaymentStatusBadge status={payment.status} />
                  </div>
                  <div style={{ ...S.cell, flex: 0.8 }}>
                    {payment.proofImage ? (
                      <button
                        style={S.receiptBtn}
                        onClick={() => setPreview({
                          url: `${API.defaults.baseURL.replace("/api", "")}${payment.proofImage}`,
                          mimeType: payment.proofMimeType || ""
                        })}
                      >
                        <Eye size={14} /> View
                      </button>
                    ) : (
                      <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>—</span>
                    )}
                  </div>
                  <div style={{ ...S.cell, flex: 1.5 }}>
                    <span style={{ fontSize: 13 }}>{formatDate(payment.createdAt)}</span>
                  </div>
                  {filter === "for_verification" && (
                    <div style={{ ...S.cell, flex: 2 }}>
                      <div style={S.actionButtons}>
                        <button style={S.approveBtn} onClick={() => handleAction(payment.id, "approve")}>
                          <CheckCircle2 size={13} /> Approve
                        </button>
                        <button style={S.rejectBtn} onClick={() => openReject(payment.id)}>
                          <XCircle size={13} /> Reject
                        </button>
                        <button style={S.resubmitBtn} onClick={() => handleAction(payment.id, "resubmit")}>
                          <RefreshCw size={13} /> Resubmit
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {preview && (
        <div style={S.overlay} onClick={() => setPreview(null)}>
          <div style={S.previewModal} onClick={e => e.stopPropagation()}>
            <div style={S.previewHeader}>
              <span style={{ fontWeight: 700 }}>Receipt Preview</span>
              <button style={S.closeBtn} onClick={() => setPreviewUrl(null)}>×</button>
            </div>
            <img src={previewUrl} alt="Receipt" style={S.previewImg} />
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={S.openLink}>
              Open Full Size ↗
            </a>
          </div>
        </div>
      )}

      {rejectModal.open && (
        <div style={S.overlay} onClick={() => setRejectModal({ open: false, paymentId: null })}>
          <div style={S.rejectModalBox} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12 }}>Reject Payment</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
              Provide a rejection reason (optional but recommended):
            </p>
            <textarea
              style={S.textarea}
              rows={3}
              placeholder="e.g. Invalid receipt / payment not found / wrong amount"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button style={S.approveBtn} onClick={confirmReject}>Confirm Reject</button>
              <button style={S.resubmitBtn} onClick={() => setRejectModal({ open: false, paymentId: null })}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPayments;
