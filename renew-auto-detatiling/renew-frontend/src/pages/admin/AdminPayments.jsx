import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import API from "../../api/axios";
import { confirmAction } from "../../components/ConfirmModal";
import AdminSidebar from "../../components/AdminSideBar";

const AdminPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  const fetchPayments = useCallback(async () => {
    try {
      const endpoint = filter === "all" 
        ? "/payments" 
        : `/payments?status=${filter}`;
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
    fetchPayments();
  }, [fetchPayments]);

  const verifyPayment = async (paymentId, verified) => {
    const confirmed = await confirmAction({
      title: `${verified ? "Verify" : "Reject"} Payment`,
      message: verified 
        ? "Are you sure you want to verify this payment?" 
        : "Are you sure you want to reject this payment?",
      confirmText: verified ? "Yes, Verify" : "Yes, Reject",
      cancelText: "Cancel",
      type: verified ? "success" : "danger"
    });

    if (!confirmed) return;

    try {
      await API.patch(`/payments/${paymentId}/verify`, { verified });
      toast.success(`Payment ${verified ? "verified" : "rejected"} successfully!`);
      fetchPayments();
    } catch (err) {
      console.error("Verify payment error:", err);
      toast.error(err.response?.data?.message || "Failed to process payment");
    }
  };

const getStatusBadge = (status) => {
      switch (status) {
        case "PENDING": return { bg: "#f59e0b", text: "Pending" };
        case "VERIFIED": 
        case "APPROVED": return { bg: "#10b981", text: "Verified" };
        case "REJECTED": return { bg: "#ef4444", text: "Rejected" };
      case "completed": return { bg: "#3b82f6", text: "Completed" };
      default: return { bg: "#64748b", text: status };
    }
  };

  const getMethodBadge = (method) => {
    switch (method) {
      case "GCASH": return { bg: "#8b5cf6", text: "GCash" };
      case "CASH": return { bg: "#64748b", text: "Cash" };
      case "MANUAL": return { bg: "#0891b2", text: "RU Manual" };
      default: return { bg: "#64748b", text: method };
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  };

  return (
    <div style={styles.page}>
      <AdminSidebar active="payments" />

      <div style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Payment Verification</h1>
            <p style={styles.subtitle}>Review and verify customer payments</p>
          </div>
        </header>

        <div style={styles.filterTabs}>
          <button
            style={{ ...styles.filterTab, ...(filter === "pending" ? styles.filterTabActive : {}) }}
            onClick={() => setFilter("pending")}
          >
            Pending
          </button>
          <button
            style={{ ...styles.filterTab, ...(filter === "verified" ? styles.filterTabActive : {}) }}
            onClick={() => setFilter("verified")}
          >
            Verified
          </button>
          <button
            style={{ ...styles.filterTab, ...(filter === "rejected" ? styles.filterTabActive : {}) }}
            onClick={() => setFilter("rejected")}
          >
            Rejected
          </button>
          <button
            style={{ ...styles.filterTab, ...(filter === "all" ? styles.filterTabActive : {}) }}
            onClick={() => setFilter("all")}
          >
            All
          </button>
        </div>

        {loading ? (
          <div style={styles.loadingState}>Loading payments...</div>
        ) : payments.length === 0 ? (
          <div style={styles.emptyState}>
            {filter === "pending" 
              ? "No pending payments to verify" 
              : `No ${filter} payments found`}
          </div>
        ) : (
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <div style={{ ...styles.col, flex: 0.5 }}>ID</div>
              <div style={{ ...styles.col, flex: 1.5 }}>Customer</div>
              <div style={{ ...styles.col, flex: 1 }}>Booking</div>
              <div style={{ ...styles.col, flex: 1 }}>Amount</div>
              <div style={{ ...styles.col, flex: 1 }}>Method</div>
              <div style={{ ...styles.col, flex: 1 }}>Status</div>
              <div style={{ ...styles.col, flex: 1.5 }}>Date</div>
              {filter === "pending" && <div style={{ ...styles.col, flex: 1.5 }}>Actions</div>}
            </div>

            {payments.map((payment) => {
              const statusBadge = getStatusBadge(payment.status);
              const methodBadge = getMethodBadge(payment.method);
              const customer = payment.booking?.customer;

              return (
                <div key={payment.id} style={styles.tableRow}>
                  <div style={{ ...styles.cell, flex: 0.5 }}>#{payment.id}</div>
                  
                  <div style={{ ...styles.cell, flex: 1.5 }}>
                    <div style={styles.customerInfo}>
                      <span style={styles.customerName}>{customer?.fullName || "N/A"}</span>
                      <span style={styles.customerEmail}>{customer?.email || ""}</span>
                    </div>
                  </div>

                  <div style={{ ...styles.cell, flex: 1 }}>
                    <span style={styles.bookingId}>#{payment.bookingId}</span>
                    <span style={styles.bookingTotal}>
                      Total: ₱{Number(payment.booking?.totalAmount || 0).toLocaleString()}
                    </span>
                  </div>

                  <div style={{ ...styles.cell, flex: 1 }}>
                    <span style={styles.amount}>₱{Number(payment.amount).toLocaleString()}</span>
                  </div>

                  <div style={{ ...styles.cell, flex: 1 }}>
                    <span style={{ ...styles.badge, background: methodBadge.bg }}>
                      {methodBadge.text}
                    </span>
                  </div>

                  <div style={{ ...styles.cell, flex: 1 }}>
                    <span style={{ ...styles.badge, background: statusBadge.bg }}>
                      {statusBadge.text}
                    </span>
                  </div>

                  <div style={{ ...styles.cell, flex: 1.5 }}>
                    {formatDate(payment.createdAt)}
                  </div>

                  {filter === "pending" && (
                    <div style={{ ...styles.cell, flex: 1.5 }}>
                      <div style={styles.actionButtons}>
                        <button
                          onClick={() => verifyPayment(payment.id, true)}
                          style={styles.verifyBtn}
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => verifyPayment(payment.id, false)}
                          style={styles.rejectBtn}
                        >
                          Reject
                        </button>
                      </div>
                      {payment.receiptImage && (
                        <a
                          href={payment.receiptImage}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.viewReceipt}
                        >
                          View Receipt
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  page: { display: "flex", background: "var(--bg-primary)", minHeight: "100vh", fontFamily: "'Poppins', sans-serif" },
  main: { marginLeft: "280px", padding: "40px", width: "100%", color: "var(--text-primary)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px" },
  title: { fontSize: "28px", fontWeight: "700", marginBottom: "5px" },
  subtitle: { color: "var(--text-secondary)", fontSize: "14px" },
  filterTabs: { display: "flex", gap: "10px", marginBottom: "24px" },
  filterTab: { padding: "10px 20px", border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-secondary)", borderRadius: "10px", cursor: "pointer", fontWeight: "500", transition: "0.2s" },
  filterTabActive: { background: "var(--accent-blue)", color: "#fff", borderColor: "var(--accent-blue)" },
  loadingState: { textAlign: "center", padding: "60px", color: "var(--text-secondary)", background: "var(--card-bg)", borderRadius: "16px" },
  emptyState: { textAlign: "center", padding: "60px", color: "var(--text-secondary)", background: "var(--card-bg)", borderRadius: "16px" },
  table: { background: "var(--card-bg)", borderRadius: "16px", overflow: "hidden", border: "1px solid var(--border-color)" },
  tableHeader: { display: "flex", padding: "16px 20px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)", fontWeight: "600", fontSize: "12px", textTransform: "uppercase", color: "var(--text-secondary)" },
  tableRow: { display: "flex", padding: "16px 20px", borderBottom: "1px solid var(--border-color)", alignItems: "center", transition: "0.2s" },
  col: { fontSize: "12px" },
  cell: { display: "flex", flexDirection: "column", justifyContent: "center", fontSize: "14px" },
  customerInfo: { display: "flex", flexDirection: "column", gap: "2px" },
  customerName: { fontWeight: "500" },
  customerEmail: { fontSize: "12px", color: "var(--text-secondary)" },
  bookingId: { fontWeight: "500" },
  bookingTotal: { fontSize: "12px", color: "var(--text-secondary)" },
  amount: { fontSize: "16px", fontWeight: "700", color: "var(--accent-blue)" },
  badge: { display: "inline-block", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", color: "#fff", width: "fit-content" },
  actionButtons: { display: "flex", gap: "8px" },
  verifyBtn: { padding: "6px 14px", background: "var(--accent-green)", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" },
  rejectBtn: { padding: "6px 14px", background: "transparent", color: "var(--accent-red)", border: "1px solid var(--accent-red)", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" },
  viewReceipt: { display: "block", marginTop: "8px", fontSize: "12px", color: "var(--accent-blue)", textDecoration: "none" }
};

export default AdminPayments;
