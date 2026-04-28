import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import API from "../../api/axios";
import AdminSidebar from "../../components/AdminSideBar";
import { confirmAction } from "../../components/ConfirmModal";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

const AdminRefunds = () => {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const formatMoney = (v) => v == null ? "—" : `₱${Number(v).toLocaleString()}`;
  const formatDate = (d) => d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    try {
      if (filter === "pending") {
        const res = await API.get("/refunds/pending");
        setRefunds(res.data.refunds || []);
        setTotalPages(1);
      } else {
        const res = await API.get(`/refunds/history?page=${page}&limit=20`);
        setRefunds(res.data.refunds || []);
        setTotalPages(res.data.meta?.pages || 1);
      }
    } catch (err) {
      console.error("Fetch refunds error:", err);
      toast.error("Failed to load refunds");
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => { fetchRefunds(); }, [fetchRefunds]);

  // Polling — 60s safety net for eventual consistency (≤60s staleness)
  useEffect(() => {
    const interval = setInterval(fetchRefunds, 60000);
    return () => clearInterval(interval);
  }, [fetchRefunds]);

  const handleProcess = async (bookingId) => {
    // Double-click guard
    if (processingId) return;

    const confirmed = await confirmAction({
      title: "Process Refund",
      message: `Are you sure you want to process the refund for Booking #${bookingId}? This action cannot be undone.`,
      confirmText: "Yes, Process Refund",
      cancelText: "Cancel",
      type: "warning"
    });
    if (!confirmed) return;

    setProcessingId(bookingId);
    try {
      await API.patch("/refunds/process", { bookingId });
      toast.success("Refund processed successfully");
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === "REFUND_ALREADY_PROCESSED") {
        toast("Refund already processed — refreshing", { icon: "ℹ️" });
      } else {
        toast.error(err.response?.data?.message || "Failed to process refund");
      }
    } finally {
      // Always refetch — no optimistic updates
      await fetchRefunds();
      setProcessingId(null);
    }
  };

  const TABS = [
    { key: "pending", label: "Pending" },
    { key: "history", label: "History" }
  ];

  const getStatusBadge = (status) => {
    const colors = {
      PENDING: "#f59e0b",
      PROCESSED: "#22c55e"
    };
    return (
      <span style={{ ...S.badge, background: colors[status] || "#64748b" }}>
        {status || "—"}
      </span>
    );
  };

  return (
    <div style={S.page}>
      <AdminSidebar active="refunds" />
      <div style={S.main}>
        <header style={S.header}>
          <div>
            <h1 style={S.title}>Refund Management</h1>
            <p style={S.subtitle}>
              {filter === "pending"
                ? "Review and process pending refund requests — amounts shown are estimates"
                : "View all refund history"}
            </p>
          </div>
        </header>

        {/* FILTER TABS */}
        <div style={S.filterTabs}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              style={{ ...S.filterTab, ...(filter === tab.key ? S.filterTabActive : {}) }}
              onClick={() => { setFilter(tab.key); setPage(1); }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={S.emptyState}>Loading refunds...</div>
        ) : refunds.length === 0 ? (
          <div style={S.emptyState}>No {filter} refunds found.</div>
        ) : (
          <div style={S.table}>
            {/* TABLE HEADER */}
            <div style={S.tableHeader}>
              <div style={{ ...S.col, flex: 0.8 }}>Booking</div>
              <div style={{ ...S.col, flex: 1.5 }}>Customer</div>
              <div style={{ ...S.col, flex: 1 }}>Total Paid</div>
              <div style={{ ...S.col, flex: 1 }}>Refund Amount</div>
              <div style={{ ...S.col, flex: 1.5 }}>Reason</div>
              <div style={{ ...S.col, flex: 1.2 }}>Cancelled</div>
              <div style={{ ...S.col, flex: 0.8 }}>Status</div>
              {filter === "pending" && <div style={{ ...S.col, flex: 1.2 }}>Actions</div>}
            </div>

            {/* TABLE ROWS — .map() for JSX rendering only */}
            {refunds.map((r) => (
              <div key={r.bookingId} style={S.tableRow}>
                <div style={{ ...S.cell, flex: 0.8 }}>
                  <span style={S.bookingId}>#{r.bookingId}</span>
                </div>

                <div style={{ ...S.cell, flex: 1.5 }}>
                  <span style={S.customerName}>{r.customerFullName || "—"}</span>
                  <span style={S.customerEmail}>{r.customerEmail || "—"}</span>
                </div>

                <div style={{ ...S.cell, flex: 1 }}>
                  <span style={S.amount}>{formatMoney(r.totalPaid)}</span>
                </div>

                <div style={{ ...S.cell, flex: 1 }}>
                  <span style={{ ...S.amount, color: "#22c55e" }}>{formatMoney(r.refundAmount)}</span>
                </div>

                <div style={{ ...S.cell, flex: 1.5 }}>
                  <span style={{ fontSize: 13 }}>{r.cancellationReason || "—"}</span>
                </div>

                <div style={{ ...S.cell, flex: 1.2 }}>
                  <span style={{ fontSize: 13 }}>{formatDate(r.cancelledAt)}</span>
                </div>

                <div style={{ ...S.cell, flex: 0.8 }}>
                  {getStatusBadge(r.refundStatus)}
                </div>

                {filter === "pending" && (
                  <div style={{ ...S.cell, flex: 1.2 }}>
                    <button
                      style={{
                        ...S.approveBtn,
                        opacity: processingId === r.bookingId ? 0.6 : 1,
                        cursor: processingId ? "not-allowed" : "pointer"
                      }}
                      onClick={() => handleProcess(r.bookingId)}
                      disabled={!!processingId}
                    >
                      <CheckCircle2 size={13} />
                      {processingId === r.bookingId ? "Processing..." : "Process"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* PAGINATION — history only */}
        {filter === "history" && totalPages > 1 && (
          <div style={S.paginationRow}>
            <button
              style={{ ...S.paginationBtn, opacity: page <= 1 ? 0.4 : 1 }}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span style={S.paginationText}>Page {page} of {totalPages}</span>
            <button
              style={{ ...S.paginationBtn, opacity: page >= totalPages ? 0.4 : 1 }}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const S = {
  page: { display: "flex", background: "var(--bg-primary)", minHeight: "100vh", fontFamily: "'Poppins', sans-serif" },
  main: { marginLeft: "280px", padding: "40px", width: "100%", color: "var(--text-primary)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 4 },
  subtitle: { color: "var(--text-secondary)", fontSize: 14 },
  filterTabs: { display: "flex", gap: 10, marginBottom: 24 },
  filterTab: { padding: "9px 18px", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border-color)", background: "transparent", color: "var(--text-secondary)", borderRadius: 10, cursor: "pointer", fontWeight: 500, transition: "0.2s", fontSize: 13 },
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
  amount: { fontSize: 15, fontWeight: 800, color: "var(--accent-blue)" },
  badge: { display: "inline-block", padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: "#fff", width: "fit-content" },
  approveBtn: { display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "#22c55e", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700 },
  paginationRow: { display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 20, padding: "12px 0" },
  paginationBtn: { display: "flex", alignItems: "center", gap: 4, padding: "8px 16px", background: "var(--card-bg)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 },
  paginationText: { fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }
};

export default AdminRefunds;
