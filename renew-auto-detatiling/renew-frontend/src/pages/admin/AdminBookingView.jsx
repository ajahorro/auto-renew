import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import API from "../../api/axios";
import AdminSidebar from "../../components/AdminSidebar";
import ConfirmModal from "../../components/ConfirmModal";
import toast from "react-hot-toast";

const AdminBookingView = () => {
  const { id } = useParams();

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
    console.log(`Attempting to ${status} booking ${id}`);
    openConfirm("Update Status", `Change booking to ${status}?`, async () => {
      try {
        if (status === "CANCELLED") {
          console.log(`Calling: /bookings/cancel/${id}`);
          const res = await API.patch(`/bookings/cancel/${id}`);
          console.log("Cancel response:", res.data);
          toast.success(res.data?.message || "Booking cancelled");
        } else {
          console.log(`Calling: /bookings/${id}/status with status=${status}`);
          const res = await API.patch(`/bookings/${id}/status`, { status });
          console.log("Status update response:", res.data);
          toast.success(res.data?.message || `Moved to ${status}`);
        }
        loadData();
      } catch (err) {
        console.error("Status update error:", err);
        console.log("Error response:", err.response?.data);
        const errMsg = err.response?.data?.message || "Failed to update status";
        toast.error(errMsg);
      }
    });
  };

  const assignStaff = (staffId) => {
    if (!staffId) return;
    console.log(`Attempting to assign staff ${staffId} to booking ${id}`);
    openConfirm("Assign Staff", "Assign this staff member to the booking?", async () => {
      try {
        console.log(`Calling: /bookings/assign/${id} with staffId=${staffId}`);
        const res = await API.patch(`/bookings/assign/${id}`, { assignedStaffId: staffId });
        console.log("Assign response:", res.data);
        toast.success(res.data?.message || "Staff assigned successfully");
        loadData();
      } catch (err) {
        console.error("Assign staff error:", err);
        console.log("Error response:", err.response?.data);
        const errMsg = err.response?.data?.message || "Failed to assign staff";
        toast.error(errMsg);
      }
    });
  };


  const addPayment = async () => {
    if (!paymentInput || isNaN(paymentInput)) return toast.error("Enter a valid amount");
    try {
      await API.post(`/bookings/add-payment/${id}`, { amount: Number(paymentInput) });
      toast.success("Payment recorded");
      setPaymentInput("");
      loadData();
    } catch (err) {
      console.error("Add payment error:", err);
      toast.error("Failed to record payment");
    }
  };

  if (loading) return <div style={styles.loadingArea}>Loading...</div>;
  if (!booking) return <div style={styles.loadingArea}>Booking not found.</div>;

  const isLocked = ["COMPLETED", "CANCELLED"].includes(booking.status);
  const canAssignStaff = !isLocked && ["PENDING", "SCHEDULED", "ONGOING"].includes(booking.status);
  const canSchedule = !isLocked && booking.paymentStatus !== "PENDING" && booking.assignedStaffId && booking.status === "PENDING";
  const canStart = !isLocked && booking.status === "SCHEDULED";
  const canComplete = !isLocked && booking.status === "ONGOING";
  const canCancel = !isLocked && ["PENDING", "SCHEDULED"].includes(booking.status);

  const bookingItems = booking.items || [];
  const totalDuration = bookingItems.reduce((sum, item) => sum + (item.durationAtBooking || 0), 0);

  return (
    <div style={styles.page}>
      <AdminSidebar active="bookings" />

      <div style={styles.main}>
        <header style={styles.header}>
          <h2>Booking #{booking.id.toString().padStart(4, '0')}</h2>
          <div style={styles.badgeRow}>
            <span style={styles.statusBadge}>{booking.status}</span>
            <span style={styles.payBadge(booking.paymentStatus)}>{booking.paymentStatus}</span>
          </div>
        </header>

        <div style={styles.grid}>
          <div style={styles.column}>
            <section style={styles.card}>
              <h3 style={styles.cardTitle}>Customer Details</h3>
              <div style={styles.infoRow}><strong>Name:</strong> {booking.customer?.fullName || "N/A"}</div>
              <div style={styles.infoRow}><strong>Email:</strong> {booking.customer?.email || "N/A"}</div>
              <div style={styles.infoRow}><strong>Contact Number:</strong> {booking.contactNumber || booking.customer?.phone || "N/A"}</div>
            </section>

            <section style={styles.card}>
              <h3 style={styles.cardTitle}>Vehicle & Notes</h3>
              <div style={styles.infoRow}><strong>Type:</strong> {booking.vehicleType || "N/A"}</div>
              <div style={styles.infoRow}><strong>Plate:</strong> {booking.plateNumber || "N/A"}</div>
              <div style={styles.infoRow}><strong>Brand:</strong> {booking.vehicleBrand || "N/A"}</div>
              <div style={styles.infoRow}><strong>Model:</strong> {booking.vehicleModel || "N/A"}</div>
              <div style={styles.noteBox}>{booking.notes || "No special instructions provided."}</div>
            </section>

            <section style={styles.card}>
              <h3 style={styles.cardTitle}>Appointment Schedule</h3>
              <div style={styles.infoRow}>
                <strong>Date:</strong> {booking.appointmentStart ? new Date(booking.appointmentStart).toLocaleDateString("en-PH", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : "N/A"}
              </div>
              <div style={styles.infoRow}>
                <strong>Time:</strong> {booking.appointmentStart ? new Date(booking.appointmentStart).toLocaleTimeString("en-PH", { hour: 'numeric', minute: '2-digit' }) : "N/A"} - {booking.appointmentEnd ? new Date(booking.appointmentEnd).toLocaleTimeString("en-PH", { hour: 'numeric', minute: '2-digit' }) : "N/A"}
              </div>
              <div style={styles.infoRow}>
                <strong>Duration:</strong> ~{totalDuration} minutes
              </div>
              <div style={styles.infoRow}>
                <strong>Assigned Staff:</strong> {booking.assignedStaff?.fullName || "Not assigned"}
              </div>
            </section>
          </div>

          <div style={styles.column}>
            <section style={styles.card}>
              <h3 style={styles.cardTitle}>Selected Services</h3>
              {bookingItems.length === 0 ? (
                <div style={styles.emptyText}>No services listed</div>
              ) : (
                <div style={styles.servicesList}>
                  {bookingItems.map((item, index) => (
                    <div key={item.id || index} style={styles.serviceItem}>
                      <div style={styles.serviceName}>{item.serviceNameAtBooking || item.service?.name || "Service"}</div>
                      <div style={styles.serviceDetails}>
                        <span>₱{Number(item.priceAtBooking || 0).toLocaleString()}</span>
                        <span style={styles.duration}>{item.durationAtBooking || 0} min</span>
                      </div>
                    </div>
                  ))}
                  <div style={styles.serviceTotal}>
                    <span>Total</span>
                    <span style={styles.totalAmount}>₱{Number(booking.totalAmount || 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </section>

            <section style={styles.card}>
              <h3 style={styles.cardTitle}>Billing Overview</h3>
              <div style={styles.priceRow}><span>Total:</span> <strong>₱{Number(booking.totalAmount || 0).toLocaleString()}</strong></div>
              <div style={styles.priceRow}><span>Paid:</span> <span style={{color: "var(--accent-green)"}}>₱{Number(booking.amountPaid || 0).toLocaleString()}</span></div>
              <div style={styles.priceRow}><span>Balance:</span> <span style={{color: "var(--accent-red)"}}>₱{Number((booking.totalAmount || 0) - (booking.amountPaid || 0)).toLocaleString()}</span></div>
              
              {!isLocked && (
                <div style={styles.paymentInputRow}>
                  <input 
                    type="number" 
                    placeholder="₱ Amount" 
                    value={paymentInput} 
                    onChange={e => setPaymentInput(e.target.value)}
                    style={styles.input}
                  />
                  <button onClick={addPayment} style={styles.blueBtn}>Add</button>
                </div>
              )}
            </section>

            <section style={styles.card}>
              <h3 style={styles.cardTitle}>Staff Assignment</h3>
              <select 
                value={booking.assignedStaffId || ""} 
                onChange={(e) => assignStaff(e.target.value)}
                disabled={!canAssignStaff}
                style={{...styles.input, opacity: canAssignStaff ? 1 : 0.6}}
              >
                <option value="">Choose Staff Member</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </select>
              {!canAssignStaff && booking.status !== "ongoing" && (
                <div style={styles.helperText}>
                  Staff can be assigned to PENDING, SCHEDULED, or ONGOING bookings only.
                </div>
              )}
            </section>
          </div>
        </div>

        <footer style={styles.card}>
          <h3 style={styles.cardTitle}>Operations Control</h3>
          <div style={styles.actionRow}>
            <button disabled={!canSchedule} onClick={() => updateStatus("SCHEDULED")} style={{...styles.greenBtn, opacity: canSchedule ? 1 : 0.4}}>Schedule</button>
            <button disabled={!canStart} onClick={() => updateStatus("ONGOING")} style={{...styles.blueBtn, opacity: canStart ? 1 : 0.4}}>Start Wash</button>
            <button disabled={!canComplete} onClick={() => updateStatus("COMPLETED")} style={{...styles.greenBtn, opacity: canComplete ? 1 : 0.4}}>Mark Complete</button>
            <button disabled={!canCancel} onClick={() => updateStatus("CANCELLED")} style={{...styles.redBtn, opacity: canCancel ? 1 : 0.4}}>Cancel</button>
          </div>
        </footer>

        <ConfirmModal 
          isOpen={modal.open} 
          title={modal.title} 
          message={modal.message} 
          onConfirm={modal.onConfirm} 
          onCancel={closeConfirm} 
        />
      </div>
    </div>
  );
};

const styles = {
  page: { display: "flex", background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)" },
  main: { marginLeft: "280px", padding: "40px", width: "calc(100% - 280px)", display: "flex", flexDirection: "column", gap: "25px" },
  loadingArea: { height: "100vh", background: "var(--bg-primary)", color: "var(--accent-blue)", display: "flex", alignItems: "center", justifyContent: "center" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  badgeRow: { display: "flex", gap: "10px" },
  statusBadge: { padding: "6px 14px", borderRadius: "20px", background: "var(--bg-tertiary)", fontSize: "12px", fontWeight: "600" },
  payBadge: (status) => ({
    padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: "600",
    background: status === "PAID" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
    color: status === "PAID" ? "var(--accent-green)" : "var(--accent-red)"
  }),
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px" },
  column: { display: "flex", flexDirection: "column", gap: "25px" },
  card: { background: "var(--card-bg)", padding: "24px", borderRadius: "16px", border: "1px solid var(--border-color)" },
  cardTitle: { fontSize: "16px", color: "var(--text-secondary)", marginBottom: "15px", textTransform: "uppercase", letterSpacing: "1px" },
  infoRow: { display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "var(--text-primary)" },
  noteBox: { background: "var(--bg-primary)", padding: "12px", borderRadius: "8px", marginTop: "10px", fontSize: "14px", fontStyle: "italic", color: "var(--text-secondary)" },
  priceRow: { display: "flex", justifyContent: "space-between", marginBottom: "8px" },
  paymentInputRow: { display: "flex", gap: "10px", marginTop: "15px" },
  input: { flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" },
  actionRow: { display: "flex", gap: "15px", flexWrap: "wrap" },
  blueBtn: { padding: "10px 20px", background: "var(--accent-blue)", border: "none", borderRadius: "8px", color: "#fff", fontWeight: "600", cursor: "pointer" },
  greenBtn: { padding: "10px 20px", background: "var(--accent-green)", border: "none", borderRadius: "8px", color: "#fff", fontWeight: "600", cursor: "pointer" },
  redBtn: { padding: "10px 20px", background: "var(--accent-red)", border: "none", borderRadius: "8px", color: "#fff", fontWeight: "600", cursor: "pointer" },
  servicesList: { display: "flex", flexDirection: "column", gap: "10px" },
  serviceItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "var(--bg-primary)", borderRadius: "8px" },
  serviceName: { fontWeight: "500" },
  serviceDetails: { display: "flex", gap: "15px", color: "var(--text-secondary)", fontSize: "13px" },
  duration: { color: "var(--accent-blue)" },
  serviceTotal: { display: "flex", justifyContent: "space-between", paddingTop: "10px", borderTop: "1px solid var(--border-color)", marginTop: "5px", fontWeight: "600" },
  totalAmount: { color: "var(--accent-blue)", fontSize: "16px" },
  emptyText: { color: "var(--text-secondary)", textAlign: "center", padding: "20px" },
  helperText: { fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px" }
};

export default AdminBookingView;