import { useEffect, useState, useCallback } from "react";
import BillingPanel from "./BillingPanel";
import StaffAssignPanel from "./StaffAssignPanel";
import API from "../api/axios";
import { useAuth } from "../context/AuthContext";

const BookingDetailsModal = ({ booking, close, refresh }) => {
  const { user } = useAuth();
  const [bookingData, setBookingData] = useState(booking);
  const [services, setServices] = useState([]);
  const [newService, setNewService] = useState("");

  const reloadBooking = async () => {
    try {
      const res = await API.get(`/bookings/${booking.id}`);
      setBookingData(res.data.booking || res.data);
      if (refresh) refresh();
    } catch (err) {
      console.error("Booking reload error", err);
    }
  };

  const loadServices = useCallback(async () => {
    try {
      const res = await API.get("/services");
      const allServices = [
        ...(res.data.services?.exterior || []),
        ...(res.data.services?.interior || []),
        ...(res.data.services?.specialized || [])
      ];
      setServices(allServices);
    } catch (err) {
      console.error("Failed loading services", err);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  if (!bookingData) return null;

  const hasAssignedStaff = bookingData.assignedStaffId || bookingData.assignedStaff?.id;
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const addService = async () => {
    if (!newService) return alert("Select a service first");
    try {
      await API.post(`/bookings/${bookingData.id}/add-service`, { serviceId: Number(newService) });
      alert("Service added");
      setNewService("");
      await reloadBooking();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add service");
    }
  };

  const updateStatus = async (newStatus, msg) => {
    try {
      await API.patch(`/bookings/${bookingData.id}/status`, { status: newStatus });
      alert(msg);
      await reloadBooking();
    } catch (err) {
      alert(err.response?.data?.message || "Status update failed");
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2>Booking #{bookingData.id}</h2>
          <span style={{ ...styles.badge, background: getStatusColor(bookingData.status) }}>
            {bookingData.status}
          </span>
        </div>

        <div style={styles.content}>
          <section style={styles.section}>
            <p><strong>Customer:</strong> {bookingData.customer?.fullName}</p>
            <p><strong>Date:</strong> {new Date(bookingData.appointmentStart).toLocaleDateString()}</p>
          </section>

          {bookingData.notes && (
            <div style={styles.notesBox}>
              <h4 style={{ marginBottom: "8px" }}>Notes</h4>
              <p style={{ fontSize: "14px", opacity: 0.8 }}>{bookingData.notes}</p>
            </div>
          )}

          <div style={styles.split}>
            <div style={styles.left}>
              <h3>Services</h3>
              {bookingData.items?.map((item) => (
                <div key={item.id} style={styles.itemRow}>
                  <span>{item.service?.name || item.serviceNameAtBooking}</span>
                  <strong>PHP {Number(item.priceAtBooking || item.price || 0).toLocaleString()}</strong>
                </div>
              ))}

              <div style={styles.addServiceBox}>
                <select
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  style={styles.select}
                >
                  <option value="">+ Add Service</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} - PHP {Number(service.price || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
                <button onClick={addService} style={styles.btnSmall}>Add</button>
              </div>
            </div>

            <div style={styles.right}>
              <BillingPanel booking={bookingData} refresh={reloadBooking} />
              <StaffAssignPanel booking={bookingData} refresh={reloadBooking} />
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <div style={styles.actionGroup}>
            {isAdmin && bookingData.status === "PENDING" && (
              <button
                style={styles.btnPrimary}
                onClick={() => hasAssignedStaff ? updateStatus("CONFIRMED", "Booking confirmed!") : alert("Assign staff first!")}
              >
                Confirm Booking
              </button>
            )}
          </div>
          <button style={styles.btnClose} onClick={close}>Close</button>
        </div>
      </div>
    </div>
  );
};

const getStatusColor = (status) => {
  const colors = {
    PENDING: "#facc15",
    CONFIRMED: "#3b82f6",
    ONGOING: "#a855f7",
    COMPLETED: "#22c55e",
    CANCELLED: "#ef4444"
  };
  return colors[status] || "#64748b";
};

const styles = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 },
  modal: { background: "#0f172a", color: "#f1f5f9", padding: "30px", width: "750px", borderRadius: "20px", maxHeight: "90vh", overflowY: "auto", border: "1px solid #1e293b", fontFamily: "Poppins, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid #1e293b", paddingBottom: "15px" },
  content: { marginBottom: "25px" },
  section: { marginBottom: "20px", fontSize: "15px" },
  notesBox: { background: "#1e293b", padding: "15px", borderRadius: "10px", marginBottom: "20px" },
  split: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px" },
  left: {},
  right: {},
  itemRow: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: "14px" },
  addServiceBox: { marginTop: "15px", display: "flex", gap: "10px" },
  select: { flex: 1, padding: "8px", borderRadius: "6px", background: "#1e293b", color: "#fff", border: "1px solid #334155" },
  btnSmall: { padding: "8px 15px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" },
  footer: { display: "flex", justifyContent: "space-between", marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #1e293b" },
  actionGroup: { display: "flex", gap: "10px" },
  btnPrimary: { background: "#3b82f6", color: "#fff", padding: "10px 20px", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" },
  btnClose: { background: "transparent", color: "#94a3b8", padding: "10px 20px", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer" },
  badge: { padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", color: "#000" }
};

export default BookingDetailsModal;
