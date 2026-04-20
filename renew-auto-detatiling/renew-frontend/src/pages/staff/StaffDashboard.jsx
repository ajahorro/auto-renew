import { useEffect, useState, useCallback } from "react";
import API from "../../api/axios";
import StaffSidebar from "../../components/StaffSidebar";
import toast from "react-hot-toast";
import { confirmAction } from "../../components/ConfirmModal";
import BookingStatusBadge from "../../components/BookingStatusBadge";
import PaymentStatusBadge from "../../components/PaymentStatusBadge";
import { 
  ClipboardList, 
  Calendar, 
  Clock, 
  User, 
  Car, 
  Package, 
  Play, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  Info
} from "lucide-react";

const StaffDashboard = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [view, setView] = useState("tasks"); // "tasks" or "schedule"
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const loadAssignedBookings = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadAssignedBookings();
  }, [loadAssignedBookings]);

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

  const getScheduleBookings = () => {
    return bookings.filter(b => {
      if (!b.appointmentStart) return false;
      const bookingDate = new Date(b.appointmentStart).toISOString().split("T")[0];
      return bookingDate === scheduleDate;
    });
  };

  return (
    <div style={styles.page}>
      <StaffSidebar active="dashboard"/>
      <div style={styles.main}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Staff Dashboard</h1>
            <p style={styles.subtitle}>Manage and track your assigned detailing tasks</p>
          </div>
        </div>

        {/* VIEW TOGGLE */}
        <div style={styles.viewToggle}>
          <button 
            style={{
              ...styles.viewBtn,
              background: view === "tasks" ? "var(--accent-yellow)" : "var(--bg-tertiary)",
              color: view === "tasks" ? "#000" : "var(--text-primary)"
            }}
            onClick={() => setView("tasks")}
          >
            <ClipboardList size={16} />
            My Tasks
          </button>
          <button 
            style={{
              ...styles.viewBtn,
              background: view === "schedule" ? "var(--accent-yellow)" : "var(--bg-tertiary)",
              color: view === "schedule" ? "#000" : "var(--text-primary)"
            }}
            onClick={() => setView("schedule")}
          >
            <Calendar size={16} />
            My Schedule
          </button>
        </div>

        {loading ? (
          <div style={styles.loading}>Loading your tasks...</div>
        ) : (
          <>
            {/* TASKS VIEW */}
            {view === "tasks" && (
              <>
                {bookings.length === 0 && (
                  <div style={styles.emptyState}>
                    <ClipboardList size={48} style={{opacity: 0.2, marginBottom: "16px"}} />
                    <h3>No assigned bookings yet</h3>
                    <p style={{fontSize:"14px", opacity: 0.7}}>New tasks will appear here when assigned by admin.</p>
                  </div>
                )}

                {activeBookings.length > 0 && (
                  <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>
                      <Play size={18} color="var(--accent-yellow)" />
                      Active Tasks ({activeBookings.length})
                    </h2>
                    <div style={styles.grid}>
                      {activeBookings.map(b => (
                        <div key={b.id} style={styles.card}>
                          <div style={styles.cardHeader}>
                            <span style={styles.bookingId}>#{b.id.toString().padStart(4, '0')}</span>
                            <BookingStatusBadge status={b.status} />
                          </div>

                          <div style={styles.cardBody}>
                            <div style={styles.infoGroup}>
                              <User size={16} color="var(--text-secondary)" />
                              <span style={styles.customerName}>{b.customer?.fullName || "N/A"}</span>
                            </div>
                            
                            <div style={styles.infoGroup}>
                              <Clock size={16} color="var(--text-secondary)" />
                              <span style={styles.value}>{formatDate(b.appointmentStart)}</span>
                            </div>

                            <div style={styles.infoGroup}>
                              <Car size={16} color="var(--text-secondary)" />
                              <span style={styles.value}>{b.vehicleType || "N/A"} • {b.plateNumber || "N/A"}</span>
                            </div>

                            <div style={styles.infoGroup}>
                              <Package size={16} color="var(--text-secondary)" />
                              <span style={styles.services}>
                                {b.items?.map(i => i.service?.name || i.serviceNameAtBooking).join(", ")}
                              </span>
                            </div>
                          </div>

                          <div style={styles.cardFooter}>
                            <div style={styles.actionRow}>
                              {b.status === "CONFIRMED" && (
                                <button
                                  style={styles.startBtn}
                                  disabled={updatingId === b.id}
                                  onClick={() => updateStatus(b.id, "ONGOING")}
                                >
                                  <Play size={14} />
                                  Start Service
                                </button>
                              )}

                              {b.status === "ONGOING" && (
                                <button
                                  style={styles.completeBtn}
                                  disabled={updatingId === b.id}
                                  onClick={() => updateStatus(b.id, "COMPLETED")}
                                >
                                  <CheckCircle2 size={14} />
                                  Complete
                                </button>
                              )}

                              <button
                                style={styles.viewDetailsBtn}
                                onClick={() => setSelectedBooking(b)}
                              >
                                <Info size={14} />
                                Details
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {completedBookings.length > 0 && (
                  <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>
                      <History size={18} color="var(--text-secondary)" />
                      Recently Finished ({completedBookings.length})
                    </h2>
                    <div style={styles.grid}>
                      {completedBookings.map(b => (
                        <div key={b.id} style={{...styles.card, opacity: 0.7}}>
                          <div style={styles.cardHeader}>
                            <span style={styles.bookingId}>#{b.id.toString().padStart(4, '0')}</span>
                            <BookingStatusBadge status={b.status} />
                          </div>
                          <div style={styles.cardBody}>
                            <div style={styles.infoGroup}>
                              <User size={14} color="var(--text-secondary)" />
                              <span style={styles.customerName}>{b.customer?.fullName}</span>
                            </div>
                            <div style={styles.infoGroup}>
                              <Clock size={14} color="var(--text-secondary)" />
                              <span style={styles.value}>{formatDate(b.appointmentStart)}</span>
                            </div>
                          </div>
                          <button
                            style={styles.viewDetailsBtnFull}
                            onClick={() => setSelectedBooking(b)}
                          >
                            View Details
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* SCHEDULE VIEW */}
            {view === "schedule" && (
              <div style={styles.scheduleCard}>
                <div style={styles.scheduleHeader}>
                  <h3>Schedule for {new Date(scheduleDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                  <div style={styles.datePicker}>
                    <Calendar size={16} style={styles.dateIcon} />
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      style={styles.dateInput}
                    />
                  </div>
                </div>

                {getScheduleBookings().length === 0 ? (
                  <div style={styles.emptySchedule}>
                    <Calendar size={32} style={{opacity: 0.2, marginBottom: "12px"}} />
                    <p>No tasks scheduled for this date.</p>
                  </div>
                ) : (
                  <div style={styles.grid}>
                    {getScheduleBookings().map(b => (
                      <div key={b.id} style={styles.card}>
                        <div style={styles.cardHeader}>
                          <span style={styles.bookingId}>#{b.id}</span>
                          <BookingStatusBadge status={b.status} />
                        </div>
                        <div style={styles.cardBody}>
                          <div style={styles.infoGroup}>
                            <Clock size={16} color="var(--accent-yellow)" />
                            <span style={{fontWeight: "700"}}>
                              {new Date(b.appointmentStart).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                            </span>
                          </div>
                          <div style={styles.infoGroup}>
                            <User size={16} />
                            <span>{b.customer?.fullName}</span>
                          </div>
                        </div>
                        <button style={styles.viewDetailsBtnFull} onClick={() => setSelectedBooking(b)}>
                          View Details
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* BOOKING DETAILS MODAL */}
        {selectedBooking && (
          <div style={styles.modal} onClick={() => setSelectedBooking(null)}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h2>Task Details #{selectedBooking.id}</h2>
                <button style={styles.modalClose} onClick={() => setSelectedBooking(null)}><XCircle size={24} /></button>
              </div>

              <div style={styles.modalBadges}>
                <BookingStatusBadge status={selectedBooking.status} />
                <PaymentStatusBadge status={selectedBooking.paymentStatus} />
              </div>

              <div style={styles.detailGrid}>
                <div style={styles.detailCard}>
                  <label>CUSTOMER</label>
                  <p><strong>{selectedBooking.customer?.fullName}</strong></p>
                  <p>{selectedBooking.contactNumber || "No contact"}</p>
                </div>
                <div style={styles.detailCard}>
                  <label>VEHICLE</label>
                  <p><strong>{selectedBooking.vehicleType}</strong></p>
                  <p>{selectedBooking.plateNumber || "No Plate"}</p>
                </div>
                <div style={styles.detailCard}>
                  <label>APPOINTMENT</label>
                  <p><strong>{formatDate(selectedBooking.appointmentStart)}</strong></p>
                </div>
                <div style={styles.detailCard}>
                  <label>PAYMENT</label>
                  <p><strong>{selectedBooking.paymentMethod}</strong></p>
                </div>
              </div>

              <div style={styles.serviceSection}>
                <label>SERVICES TO PERFORM</label>
                <div style={styles.modalServices}>
                  {selectedBooking.items?.map((item, i) => (
                    <div key={i} style={styles.modalServiceItem}>
                      <span>{item.service?.name || item.serviceNameAtBooking}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedBooking.notes && (
                <div style={styles.notesSection}>
                  <label>CUSTOMER NOTES</label>
                  <div style={styles.notesBox}>{selectedBooking.notes}</div>
                </div>
              )}
            </div>
          </div>
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
  title: { fontSize: "32px", fontWeight: "800", marginBottom: "8px" },
  subtitle: { opacity: 0.6, fontSize: "14px", marginBottom: "32px" },
  viewToggle: {
    display: "flex",
    gap: "12px",
    marginBottom: "32px",
    padding: "6px",
    background: "var(--card-bg)",
    borderRadius: "14px",
    width: "fit-content",
    border: "1px solid var(--border-color)"
  },
  viewBtn: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 20px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
    transition: "0.2s"
  },
  loading: { padding: "100px", textAlign: "center", opacity: 0.5 },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    background: "var(--card-bg)",
    borderRadius: "20px",
    border: "1px solid var(--border-color)"
  },
  section: { marginBottom: "40px" },
  sectionTitle: { 
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "18px", 
    fontWeight: "700",
    marginBottom: "20px", 
    color: "var(--text-primary)" 
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
    gap: "24px"
  },
  card: {
    background: "var(--card-bg)",
    borderRadius: "18px",
    border: "1px solid var(--border-color)",
    overflow: "hidden"
  },
  cardHeader: {
    padding: "16px 20px",
    background: "rgba(255,255,255,0.02)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid var(--border-color)"
  },
  bookingId: { fontSize: "12px", fontWeight: "700", color: "var(--accent-yellow)", letterSpacing: "1px" },
  cardBody: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  infoGroup: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "14px"
  },
  customerName: { fontSize: "16px", fontWeight: "700" },
  value: { color: "var(--text-primary)" },
  services: { color: "var(--text-secondary)", fontSize: "13px" },
  cardFooter: {
    padding: "16px 20px",
    borderTop: "1px solid var(--border-color)",
    background: "rgba(255,255,255,0.01)"
  },
  actionRow: { display: "flex", gap: "10px" },
  startBtn: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
    padding: "10px", borderRadius: "8px", border: "none", background: "var(--accent-blue)",
    color: "white", fontWeight: "700", cursor: "pointer", fontSize: "13px"
  },
  completeBtn: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
    padding: "10px", borderRadius: "8px", border: "none", background: "var(--accent-green)",
    color: "white", fontWeight: "700", cursor: "pointer", fontSize: "13px"
  },
  viewDetailsBtn: {
    display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px",
    borderRadius: "8px", border: "none", background: "var(--bg-tertiary)",
    color: "var(--text-primary)", fontWeight: "600", cursor: "pointer", fontSize: "13px"
  },
  viewDetailsBtnFull: {
    width: "100%", padding: "12px", borderRadius: "0", border: "none",
    background: "var(--bg-tertiary)", color: "var(--text-primary)", fontWeight: "600",
    cursor: "pointer", fontSize: "13px", borderTop: "1px solid var(--border-color)"
  },
  scheduleCard: {
    background: "var(--card-bg)", padding: "24px", borderRadius: "20px",
    border: "1px solid var(--border-color)"
  },
  scheduleHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px"
  },
  datePicker: { position: "relative", display: "flex", alignItems: "center" },
  dateIcon: { position: "absolute", left: "12px", pointerEvents: "none", color: "var(--accent-yellow)" },
  dateInput: {
    padding: "10px 12px 10px 40px", borderRadius: "10px", border: "1px solid var(--border-color)",
    background: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer", outline: "none"
  },
  emptySchedule: { textAlign: "center", padding: "60px", color: "var(--text-secondary)" },
  modal: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center",
    justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)"
  },
  modalContent: {
    background: "var(--card-bg)", padding: "40px", borderRadius: "24px",
    width: "100%", maxWidth: "700px", maxHeight: "90vh", overflow: "auto",
    border: "1px solid var(--border-color)", position: "relative"
  },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  modalClose: { background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" },
  modalBadges: { display: "flex", gap: "10px", marginBottom: "32px" },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px", marginBottom: "32px" },
  detailCard: { padding: "16px", background: "var(--bg-primary)", borderRadius: "14px" },
  serviceSection: { marginBottom: "24px" },
  modalServices: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" },
  modalServiceItem: { 
    padding: "12px 16px", background: "var(--bg-primary)", 
    borderRadius: "10px", borderLeft: "4px solid var(--accent-yellow)" 
  },
  notesSection: { marginTop: "32px" },
  notesBox: { 
    padding: "16px", background: "rgba(234, 179, 8, 0.05)", 
    borderRadius: "14px", border: "1px dashed var(--accent-yellow)",
    color: "var(--text-primary)", fontSize: "14px", lineHeight: "1.6"
  }
};

const History = ({ size, color, style }) => <ClipboardList size={size} color={color} style={style} />;

export default StaffDashboard;
