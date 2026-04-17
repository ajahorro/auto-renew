import { useEffect, useState } from "react";
import API from "../../api/axios";
import StaffSidebar from "../../components/StaffSidebar";
import toast from "react-hot-toast";
import { confirmAction } from "../../components/ConfirmModal";

const StaffDashboard = () => {

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [view, setView] = useState("tasks"); // "tasks" or "schedule"
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    loadAssignedBookings();
  }, []);

  const loadAssignedBookings = async () => {
    try {
      const res = await API.get("/bookings");
      const data = res.data;
      const allBookings = Array.isArray(data) ? data : (data.bookings || []);
      // Staff should only see CONFIRMED bookings to work on
      // After service they can see ONGOING to complete
      // After completion they see COMPLETED
      const filtered = allBookings.filter(b => 
        b.status === "CONFIRMED" || 
        b.status === "SCHEDULED" ||
        b.status === "ONGOING"
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
      await API.patch(`/bookings/${bookingId}/status`, { status });
      toast.success(`Booking marked as ${status.toLowerCase()}`);
      await loadAssignedBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
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
      SCHEDULED: "#3b82f6",
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

  const activeBookings = bookings.filter(b => b.status !== "COMPLETED" && b.status !== "CANCELLED");
  const completedBookings = bookings.filter(b => b.status === "COMPLETED" || b.status === "CANCELLED");

  // Get bookings for schedule view
  const getScheduleBookings = () => {
    return bookings.filter(b => {
      if (!b.appointmentStart) return false;
      const bookingDate = new Date(b.appointmentStart).toISOString().split("T")[0];
      return bookingDate === scheduleDate;
    });
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
    viewToggle: {
      display: "flex",
      gap: "12px",
      marginBottom: "30px"
    },
    viewBtn: {
      padding: "10px 20px",
      borderRadius: "8px",
      border: "none",
      cursor: "pointer",
      fontWeight: "500",
      fontSize: "14px"
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
      gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
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
    bookingId: { fontSize: "12px", opacity: 0.5, color: "var(--text-secondary)" },
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
      fontWeight: "600",
      color: "var(--text-primary)"
    },
    totalAmount: { color: "var(--accent-green)" },
    actionRow: { display: "flex", gap: "10px", flexWrap: "wrap" },
    startBtn: {
      padding: "10px 16px",
      border: "none",
      borderRadius: "8px",
      background: "var(--accent-blue)",
      color: "#fff",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "13px"
    },
    completeBtn: {
      padding: "10px 16px",
      border: "none",
      borderRadius: "8px",
      background: "var(--accent-green)",
      color: "#fff",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "13px"
    },
    cancelBtn: {
      padding: "10px 16px",
      border: "none",
      borderRadius: "8px",
      background: "var(--accent-red)",
      color: "#fff",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "13px"
    },
    viewDetailsBtn: {
      padding: "10px 16px",
      border: "none",
      borderRadius: "8px",
      background: "var(--bg-tertiary)",
      color: "var(--text-primary)",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "13px"
    },
    readOnly: {
      fontSize: "12px",
      opacity: 0.6,
      textAlign: "center",
      fontStyle: "italic",
      color: "var(--text-secondary)"
    },
    scheduleCard: {
      background: "var(--card-bg)",
      padding: "20px",
      borderRadius: "14px",
      border: "1px solid var(--border-color)",
      marginBottom: "20px"
    },
    scheduleHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "20px"
    },
    dateInput: {
      padding: "10px",
      borderRadius: "8px",
      border: "1px solid var(--border-color)",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      cursor: "pointer"
    },
    modal: {
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    },
    modalContent: {
      background: "var(--card-bg)",
      padding: "30px",
      borderRadius: "16px",
      width: "100%",
      maxWidth: "600px",
      maxHeight: "80vh",
      overflow: "auto",
      border: "1px solid var(--border-color)"
    },
    modalHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "20px"
    },
    modalClose: {
      background: "none",
      border: "none",
      color: "var(--text-primary)",
      fontSize: "24px",
      cursor: "pointer"
    }
  };

  return (
    <div style={styles.page}>
      <StaffSidebar active="dashboard"/>
      <div style={styles.main}>
        <h1 style={{marginBottom: "8px"}}>Staff Dashboard</h1>
        <p style={{opacity: 0.7, marginBottom: "20px"}}>Manage your assigned bookings</p>

        {/* VIEW TOGGLE */}
        <div style={styles.viewToggle}>
          <button 
            style={{
              ...styles.viewBtn,
              background: view === "tasks" ? "var(--accent-yellow)" : "var(--bg-tertiary)",
              color: view === "tasks" ? "var(--bg-primary)" : "var(--text-primary)"
            }}
            onClick={() => setView("tasks")}
          >
            My Tasks
          </button>
          <button 
            style={{
              ...styles.viewBtn,
              background: view === "schedule" ? "var(--accent-yellow)" : "var(--bg-tertiary)",
              color: view === "schedule" ? "var(--bg-primary)" : "var(--text-primary)"
            }}
            onClick={() => setView("schedule")}
          >
            My Schedule
          </button>
        </div>

        {loading && <p style={styles.loading}>Loading...</p>}

        {/* TASKS VIEW */}
        {view === "tasks" && !loading && (
          <>
            {bookings.length === 0 && (
              <div style={styles.emptyState}>
                <p>No assigned bookings yet.</p>
                <p style={{fontSize:"14px", opacity: 0.7}}>New tasks will appear here when assigned by admin.</p>
              </div>
            )}

            {activeBookings.length > 0 && (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Active Tasks ({activeBookings.length})</h2>
                <div style={styles.grid}>
                  {activeBookings.map(b => {
                    const services = b.items?.map(i => i.service?.name || i.serviceNameAtBooking).join(", ") || "No services";
                    const total = b.items?.reduce((sum,i)=>sum + Number(i.priceAtBooking || 0), 0) || 0;
                    
                    return(
                      <div key={b.id} style={styles.card}>
                        <div style={styles.cardHeader}>
                          <span style={{...styles.statusBadge, background: getStatusColor(b.status)}}>
                            {b.status}
                          </span>
                          <span style={styles.bookingId}>#{b.id}</span>
                        </div>

                        <div style={{marginBottom: "12px"}}>
                          <p style={styles.label}>Customer</p>
                          <p style={styles.customerName}>{b.customer?.fullName || "N/A"}</p>
                        </div>

                        <div style={{marginBottom: "8px"}}>
                          <p style={styles.label}>Date & Time</p>
                          <p style={styles.value}>{formatDate(b.appointmentStart)}</p>
                        </div>

                        <div style={{marginBottom: "8px"}}>
                          <p style={styles.label}>Vehicle</p>
                          <p style={styles.value}>{b.vehicleType || "N/A"} - {b.plateNumber || "N/A"}</p>
                        </div>

                        <div style={{marginBottom: "12px"}}>
                          <p style={styles.label}>Services</p>
                          <p style={styles.services}>{services}</p>
                        </div>

                        <div style={styles.totalRow}>
                          <span>Total:</span>
                          <span style={styles.totalAmount}>₱{total.toLocaleString()}</span>
                        </div>

                        <div style={styles.actionRow}>
                          {b.status === "SCHEDULED" && (
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

                          {(b.status === "CONFIRMED" || b.status === "SCHEDULED") && (
                            <button
                              style={styles.cancelBtn}
                              disabled={updatingId === b.id}
                              onClick={() => requestCancel(b.id)}
                            >
                              Request Cancel
                            </button>
                          )}

                          <button
                            style={styles.viewDetailsBtn}
                            onClick={() => setSelectedBooking(b)}
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {completedBookings.length > 0 && (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Completed / Cancelled ({completedBookings.length})</h2>
                <div style={styles.grid}>
                  {completedBookings.map(b => {
                    const services = b.items?.map(i => i.service?.name || i.serviceNameAtBooking).join(", ") || "No services";
                    const total = b.items?.reduce((sum,i)=>sum + Number(i.priceAtBooking || 0), 0) || 0;
                    
                    return(
                      <div key={b.id} style={{...styles.card, opacity: 0.8}}>
                        <div style={styles.cardHeader}>
                          <span style={{...styles.statusBadge, background: getStatusColor(b.status)}}>
                            {b.status}
                          </span>
                          <span style={styles.bookingId}>#{b.id}</span>
                        </div>

                        <div style={{marginBottom: "12px"}}>
                          <p style={styles.label}>Customer</p>
                          <p style={styles.customerName}>{b.customer?.fullName || "N/A"}</p>
                        </div>

                        <div style={{marginBottom: "8px"}}>
                          <p style={styles.label}>Date & Time</p>
                          <p style={styles.value}>{formatDate(b.appointmentStart)}</p>
                        </div>

                        <div style={{marginBottom: "12px"}}>
                          <p style={styles.label}>Services</p>
                          <p style={styles.services}>{services}</p>
                        </div>

                        <div style={styles.totalRow}>
                          <span>Total:</span>
                          <span style={styles.totalAmount}>₱{total.toLocaleString()}</span>
                        </div>

                        <button
                          style={styles.viewDetailsBtn}
                          onClick={() => setSelectedBooking(b)}
                        >
                          View Full Details
                        </button>

                        <p style={styles.readOnly}>This booking is {b.status.toLowerCase()}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* SCHEDULE VIEW */}
        {view === "schedule" && !loading && (
          <div>
            <div style={styles.scheduleCard}>
              <div style={styles.scheduleHeader}>
                <h2 style={styles.sectionTitle}>Schedule for {new Date(scheduleDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h2>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  style={styles.dateInput}
                />
              </div>

              {getScheduleBookings().length === 0 ? (
                <p style={{opacity: 0.5, textAlign: "center", padding: "40px"}}>
                  No bookings scheduled for this date.
                </p>
              ) : (
                <div style={styles.grid}>
                  {getScheduleBookings().map(b => {
                    const services = b.items?.map(i => i.service?.name || i.serviceNameAtBooking).join(", ") || "No services";
                    const total = b.items?.reduce((sum,i)=>sum + Number(i.priceAtBooking || 0), 0) || 0;
                    
                    return(
                      <div key={b.id} style={styles.card}>
                        <div style={styles.cardHeader}>
                          <span style={{...styles.statusBadge, background: getStatusColor(b.status)}}>
                            {b.status}
                          </span>
                          <span style={styles.bookingId}>#{b.id}</span>
                        </div>

                        <div style={{marginBottom: "12px"}}>
                          <p style={styles.label}>Customer</p>
                          <p style={styles.customerName}>{b.customer?.fullName || "N/A"}</p>
                        </div>

                        <div style={{marginBottom: "8px"}}>
                          <p style={styles.label}>Time</p>
                          <p style={styles.value}>
                            {b.appointmentStart ? new Date(b.appointmentStart).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'}) : ""}
                          </p>
                        </div>

                        <div style={{marginBottom: "12px"}}>
                          <p style={styles.label}>Services</p>
                          <p style={styles.services}>{services}</p>
                        </div>

                        <div style={styles.totalRow}>
                          <span>Total:</span>
                          <span style={styles.totalAmount}>₱{total.toLocaleString()}</span>
                        </div>

                        <div style={styles.actionRow}>
                          <button
                            style={styles.viewDetailsBtn}
                            onClick={() => setSelectedBooking(b)}
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOOKING DETAILS MODAL */}
        {selectedBooking && (
          <div style={styles.modal} onClick={() => setSelectedBooking(null)}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h2 style={{ color: 'var(--text-primary)' }}>Booking Details #{selectedBooking.id}</h2>
                <button style={styles.modalClose} onClick={() => setSelectedBooking(null)}>×</button>
              </div>

              <div style={{marginBottom: "20px"}}>
                <span style={{...styles.statusBadge, background: getStatusColor(selectedBooking.status)}}>
                  {selectedBooking.status}
                </span>
                {" "}
                <span style={{...styles.statusBadge, background: selectedBooking.paymentStatus === "PAID" ? "var(--accent-green)" : selectedBooking.paymentStatus === "PARTIALLY_PAID" ? "var(--accent-blue)" : "var(--accent-red)"}}>
                  {selectedBooking.paymentStatus}
                </span>
              </div>

              <div style={detailStyles.detailGrid}>
                <div style={detailStyles.detailItem}>
                  <p style={styles.label}>Customer</p>
                  <p style={styles.customerName}>{selectedBooking.customer?.fullName || "N/A"}</p>
                </div>

                <div style={detailStyles.detailItem}>
                  <p style={styles.label}>Contact</p>
                  <p style={styles.value}>{selectedBooking.contactNumber || "N/A"}</p>
                </div>

                <div style={detailStyles.detailItem}>
                  <p style={styles.label}>Email</p>
                  <p style={styles.value}>{selectedBooking.email || selectedBooking.customer?.email || "N/A"}</p>
                </div>

                <div style={detailStyles.detailItem}>
                  <p style={styles.label}>Vehicle</p>
                  <p style={styles.value}>{selectedBooking.vehicleType || "N/A"} - {selectedBooking.plateNumber || "N/A"}</p>
                </div>

                <div style={detailStyles.detailItem}>
                  <p style={styles.label}>Appointment</p>
                  <p style={styles.value}>{formatDate(selectedBooking.appointmentStart)}</p>
                </div>

                <div style={detailStyles.detailItem}>
                  <p style={styles.label}>Payment Method</p>
                  <p style={styles.value}>{selectedBooking.paymentMethod === "GCASH" ? "GCash" : "Cash"}</p>
                </div>
              </div>

              <div style={{marginTop: "20px"}}>
                <p style={styles.label}>Services</p>
                {selectedBooking.items?.map((item, i) => (
                  <div key={i} style={{display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-color)"}}>
                    <span style={{ color: 'var(--text-primary)' }}>{item.service?.name || item.serviceNameAtBooking}</span>
                    <span style={{ color: 'var(--text-primary)' }}>₱{Number(item.priceAtBooking || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div style={{marginTop: "20px", padding: "16px", background: "var(--bg-primary)", borderRadius: "10px"}}>
                <div style={{display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "var(--text-primary)"}}>
                  <span>Total Amount:</span>
                  <span style={{fontWeight: "600"}}>₱{Number(selectedBooking.totalAmount || 0).toLocaleString()}</span>
                </div>
                <div style={{display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "var(--accent-green)"}}>
                  <span>Amount Paid:</span>
                  <span>₱{Number(selectedBooking.amountPaid || 0).toLocaleString()}</span>
                </div>
                <div style={{display: "flex", justifyContent: "space-between", color: "var(--accent-red)"}}>
                  <span>Balance:</span>
                  <span>₱{(Number(selectedBooking.totalAmount || 0) - Number(selectedBooking.amountPaid || 0)).toLocaleString()}</span>
                </div>
              </div>

              {selectedBooking.payments?.length > 0 && (
                <div style={{marginTop: "20px"}}>
                  <p style={styles.label}>Payment History</p>
                  {selectedBooking.payments.map((payment, i) => (
                    <div key={i} style={{display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-color)"}}>
                      <span style={{ color: 'var(--text-primary)' }}>{payment.method === "GCASH" ? "GCash" : "Cash"} - {new Date(payment.createdAt).toLocaleString()}</span>
                      <span style={{color: "var(--accent-green)"}}>₱{Number(payment.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedBooking.notes && (
                <div style={{marginTop: "20px"}}>
                  <p style={styles.label}>Notes</p>
                  <p style={styles.value}>{selectedBooking.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const detailStyles = {
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "20px"
  },
  detailItem: {
    background: "var(--bg-primary)",
    padding: "12px",
    borderRadius: "8px"
  }
};

export default StaffDashboard;
