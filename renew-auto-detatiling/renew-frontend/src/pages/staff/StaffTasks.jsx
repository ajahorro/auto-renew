import { useEffect, useState } from "react";
import API from "../../api/axios";
import StaffSidebar from "../../components/StaffSidebar";
import toast from "react-hot-toast";
import { confirmAction } from "../../components/ConfirmModal";

const StaffTasks = () => {

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState("all"); // all, active, completed

  useEffect(() => {
    loadAssignedBookings();
  }, []);

  const loadAssignedBookings = async () => {
    try {
      const res = await API.get("/bookings");
      const data = res.data;
      const allBookings = Array.isArray(data) ? data : (data.bookings || []);
      const filtered = allBookings.filter(b =>
        b.status === "CONFIRMED" ||
        b.status === "ONGOING" ||
        b.status === "COMPLETED" ||
        b.status === "CANCELLED"
      );
      setBookings(filtered);
    } catch (err) {
      console.log("Staff bookings error", err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (bookingId, status) => {
    try {
      setUpdatingId(bookingId);
      // Staff should use the service-status endpoint
      await API.patch(`/bookings/${bookingId}/service-status`, { serviceStatus: status });
      toast.success(`Service marked as ${status.toLowerCase()}`);
      await loadAssignedBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update service status");
    } finally {
      setUpdatingId(null);
    }
  };

  const requestCancel = async (bookingId) => {
    const confirmed = await confirmAction({
      title: "Request Cancellation",
      message: "Request to cancel this booking? This will notify the admin.",
      confirmText: "Yes, Request",
      cancelText: "Keep Booking",
      type: "danger"
    });
    
    if (!confirmed) return;
    
    try {
      setUpdatingId(bookingId);
      await API.post(`/bookings/${bookingId}/request-cancel`);
      toast.success("Cancellation request sent to admin");
      await loadAssignedBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to request cancellation");
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      PENDING: "#eab308",
      CONFIRMED: "#3b82f6",
      ONGOING: "#f97316",
      COMPLETED: "#22c55e",
      CANCELLED: "#ef4444"
    };
    return colors[status] || "#64748b";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "No date";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { 
      weekday: "short", 
      month: "short", 
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const filteredBookings = bookings.filter(b => {
    if (filter === "active") return b.status !== "COMPLETED" && b.status !== "CANCELLED";
    if (filter === "completed") return b.status === "COMPLETED" || b.status === "CANCELLED";
    return true;
  });

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
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "30px"
    },
    filterGroup: {
      display: "flex",
      gap: "10px"
    },
    filterBtn: {
      padding: "8px 16px",
      borderRadius: "8px",
      border: "none",
      cursor: "pointer",
      fontWeight: "500",
      fontSize: "13px"
    },
    loading: { opacity: 0.7 },
    emptyState: {
      textAlign: "center",
      padding: "60px 20px",
      background: "var(--card-bg)",
      borderRadius: "14px"
    },
    section: { marginBottom: "40px" },
    sectionTitle: { fontSize: "18px", marginBottom: "16px", color: "var(--text-secondary)" },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
      gap: "20px"
    },
    card: {
      background: "var(--card-bg)",
      padding: "20px",
      borderRadius: "14px",
      border: "1px solid var(--border-color)"
    },
    cardHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "16px"
    },
    statusBadge: {
      padding: "4px 12px",
      borderRadius: "20px",
      fontSize: "11px",
      fontWeight: "600",
      color: "#fff"
    },
    bookingId: { fontSize: "12px", opacity: 0.5 },
    label: {
      fontSize: "11px",
      textTransform: "uppercase",
      color: "var(--text-secondary)",
      marginBottom: "2px"
    },
    customerName: {
      fontSize: "16px",
      fontWeight: "600",
      color: "var(--text-primary)"
    },
    value: { fontSize: "14px", color: "var(--text-primary)" },
    services: { fontSize: "14px", color: "var(--text-secondary)" },
    totalRow: {
      display: "flex",
      justifyContent: "space-between",
      padding: "12px 0",
      borderTop: "1px solid var(--border-color)",
      borderBottom: "1px solid var(--border-color)",
      marginBottom: "16px",
      fontWeight: "600"
    },
    totalAmount: { color: "#22c55e" },
    actionRow: { display: "flex", gap: "10px", flexWrap: "wrap" },
    startBtn: {
      padding: "10px 16px",
      border: "none",
      borderRadius: "8px",
      background: "#3b82f6",
      color: "#fff",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "13px"
    },
    completeBtn: {
      padding: "10px 16px",
      border: "none",
      borderRadius: "8px",
      background: "#22c55e",
      color: "#fff",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "13px"
    },
    cancelBtn: {
      padding: "10px 16px",
      border: "none",
      borderRadius: "8px",
      background: "#ef4444",
      color: "#fff",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "13px"
    },
    viewDetailsBtn: {
      padding: "10px 16px",
      border: "none",
      borderRadius: "8px",
      background: "#64748b",
      color: "#fff",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "13px"
    },
    readOnly: {
      fontSize: "12px",
      opacity: 0.6,
      textAlign: "center",
      fontStyle: "italic"
    }
  };

  return (
    <div style={styles.page}>
      <StaffSidebar active="tasks"/>
      <div style={styles.main}>
        <div style={styles.header}>
          <div>
            <h1 style={{marginBottom: "4px"}}>My Tasks</h1>
            <p style={{opacity: 0.7, fontSize: "14px"}}>View and manage your assigned bookings</p>
          </div>
          <div style={styles.filterGroup}>
            <button 
              style={{
                ...styles.filterBtn,
                background: filter === "all" ? "#3b82f6" : "var(--bg-tertiary)",
                color: filter === "all" ? "#fff" : "var(--text-primary)"
              }}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button 
              style={{
                ...styles.filterBtn,
                background: filter === "active" ? "#3b82f6" : "var(--bg-tertiary)",
                color: filter === "active" ? "#fff" : "var(--text-primary)"
              }}
              onClick={() => setFilter("active")}
            >
              Active
            </button>
            <button 
              style={{
                ...styles.filterBtn,
                background: filter === "completed" ? "#3b82f6" : "var(--bg-tertiary)",
                color: filter === "completed" ? "#fff" : "var(--text-primary)"
              }}
              onClick={() => setFilter("completed")}
            >
              Completed
            </button>
          </div>
        </div>

        {loading && <p style={styles.loading}>Loading...</p>}

        {!loading && filteredBookings.length === 0 && (
          <div style={styles.emptyState}>
            <p>No bookings found.</p>
            <p style={{fontSize:"14px", opacity: 0.7}}>
              {filter === "all" ? "No assigned bookings yet." : 
               filter === "active" ? "No active tasks." : "No completed tasks."}
            </p>
          </div>
        )}

        {!loading && filteredBookings.length > 0 && (
          <div style={styles.grid}>
            {filteredBookings.map(b => {
              const services = b.items?.map(i => i.service?.name || i.serviceNameAtBooking).join(", ") || "No services";
              const total = b.items?.reduce((sum,i)=>sum + Number(i.priceAtBooking || 0), 0) || 0;
              const statusLabel = b.status?.toLowerCase() || "";
              const isReadOnly = b.status === "COMPLETED" || b.status === "CANCELLED";
               
              return(
                <div key={b.id} style={{...styles.card, opacity: isReadOnly ? 0.8 : 1}}>
                  <div style={styles.cardHeader}>
                    <span style={{...styles.statusBadge, background: getStatusColor(b.status)}}>
                      {statusLabel}
                    </span>
                    <span style={styles.bookingId}>#{b.id}</span>
                  </div>

                  <div style={{marginBottom: "12px"}}>
                    <p style={styles.label}>Customer</p>
                    <p style={styles.customerName}>{b.customer?.fullName || "N/A"}</p>
                  </div>

                  <div style={{marginBottom: "12px"}}>
                    <p style={styles.label}>Vehicle</p>
                    <p style={styles.vehicleInfo}>{b.vehicleType} - {b.plateNumber}</p>
                  </div>

                  <div style={{marginBottom: "12px"}}>
                    <p style={styles.label}>Services</p>
                    <p style={styles.services}>{services}</p>
                  </div>

                  <div style={{marginBottom: "12px"}}>
                    <p style={styles.label}>Total Amount</p>
                    <p style={styles.amount}>₱{total.toLocaleString()}</p>
                  </div>

                  <div style={{marginBottom: "12px"}}>
                    <p style={styles.label}>Appointment</p>
                    <p style={styles.appointment}>{formatDate(b.appointmentStart)}</p>
                  </div>

                  {isReadOnly ? (
                    <p style={styles.readOnly}>
                      This booking is {b.status.toLowerCase()}
                    </p>
                  ) : (
                    <div style={styles.actionRow}>
                      {b.status === "CONFIRMED" && (
                        <button
                          style={styles.startBtn}
                          disabled={updatingId === b.id}
                          onClick={() => updateStatus(b.id, "ONGOING")}
                        >
                          {updatingId === b.id ? "Updating..." : "Start Service"}
                        </button>
                      )}

                      {b.status === "ONGOING" && (
                        <button
                          style={styles.completeBtn}
                          disabled={updatingId === b.id}
                          onClick={() => updateStatus(b.id, "COMPLETED")}
                        >
                          {updatingId === b.id ? "Updating..." : "Mark Completed"}
                        </button>
                      )}

                      {b.status === "CONFIRMED" && (
                        <button
                          style={styles.cancelBtn}
                          disabled={updatingId === b.id}
                          onClick={() => requestCancel(b.id)}
                        >
                          Request Cancel
                        </button>
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

export default StaffTasks;
