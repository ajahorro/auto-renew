import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams, useBlocker } from "react-router-dom";
import CustomerLayout from "../../components/CustomerLayout";
import DatePicker from "react-datepicker";
import toast from "react-hot-toast";
import API from "../../api/axios"; 
import "react-datepicker/dist/react-datepicker.css";
import "../../App.css";

const formatLocalDate = (value) => {
  if (!value) return "";

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const dedupeServices = (list = []) => {
  const seen = new Set();

  return list.filter((service) => {
    const key = [
      String(service.category || "").toUpperCase(),
      String(service.name || "").trim().toLowerCase(),
      Number(service.price || 0),
      Number(service.durationMin || 0)
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const BookAppointment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  const [services, setServices] = useState({ exterior: [], interior: [], specialized: [] });
  const [selectedServices, setSelectedServices] = useState([]);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState([]);
  const [maxServices, setMaxServices] = useState(5);
  const [formData, setFormData] = useState({
    contactNumber: "",
    email: "",
    vehicleType: "",
    vehicleBrand: "",
    vehicleModel: "",
    plateNumber: ""
  });

  const initialDataRef = useRef(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await API.get("/business-settings");
      const maxSvcs = res.data?.maxServicesPerBooking;
      if (maxSvcs && Number.isFinite(Number(maxSvcs))) {
        setMaxServices(Number(maxSvcs));
      }
    } catch (err) {
      // use default
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const fetchServices = useCallback(async () => {
    try {
      const res = await API.get("/services");
      const grouped = res.data.services || { exterior: [], interior: [], specialized: [] };
      setServices({
        exterior: dedupeServices(grouped.exterior),
        interior: dedupeServices(grouped.interior),
        specialized: dedupeServices(grouped.specialized)
      });
    } catch (err) {
      // toast.error is handled by axios interceptor
    }
  }, []);

  useEffect(() => {
    fetchServices();
    fetchSettings();
  }, [fetchServices, fetchSettings]);

  useEffect(() => {
    if (!editId) return;
    const loadBooking = async () => {
      try {
        const res = await API.get(`/bookings/${editId}`);
        const booking = res.data.booking || res.data;
        
        // Ensure price is treated as a Number
        const servicesFromBooking = (booking.items || [])
          .filter(i => i.service)
          .map(i => ({ 
            id: i.service.id, 
            name: i.service.name, 
            price: Number(i.service.price) 
          }));

        setSelectedServices(servicesFromBooking);
        setNotes(booking.notes || "");
        if (booking.appointmentStart) {
          const dateObj = new Date(booking.appointmentStart);
          setDate(dateObj);
          setTime(`${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`);
        }
        const initialFormData = {
          contactNumber: booking.contactNumber || "",
          email: booking.email || "",
          vehicleType: booking.vehicleType || "",
          vehicleBrand: booking.vehicleBrand || "",
          vehicleModel: booking.vehicleModel || "",
          plateNumber: booking.plateNumber || ""
        };
        setFormData(initialFormData);
        initialDataRef.current = {
          services: servicesFromBooking,
          notes: booking.notes || "",
          date: dateObj,
          time: `${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`,
          ...initialFormData
        };
      } catch (err) {
        // toast.error is handled by axios interceptor
      }
    };
    loadBooking();
  }, [editId]);

  useEffect(() => {
    if (!date) return;
    const loadSlots = async () => {
      try {
        const formattedDate = formatLocalDate(date);
        const res = await API.get(`/bookings/availability?date=${formattedDate}`);
        setSlots(res.data.slots || []);
        setTime((currentTime) =>
          res.data.slots?.includes(currentTime) ? currentTime : ""
        );
      } catch (err) {
        // toast.error is handled by axios interceptor
        setSlots([]);
        setTime("");
      }
    };
    loadSlots();
  }, [date]);

  useEffect(() => {
    if (!initialDataRef.current) return;
    const hasDataChanged = 
      JSON.stringify(selectedServices.map(s => s.id).sort()) !== 
        JSON.stringify(initialDataRef.current.services.map(s => s.id).sort()) ||
      notes !== initialDataRef.current.notes ||
      time !== initialDataRef.current.time ||
      formData.contactNumber !== initialDataRef.current.contactNumber ||
      formData.email !== initialDataRef.current.email ||
      formData.vehicleType !== initialDataRef.current.vehicleType ||
      formData.vehicleBrand !== initialDataRef.current.vehicleBrand ||
      formData.vehicleModel !== initialDataRef.current.vehicleModel ||
      formData.plateNumber !== initialDataRef.current.plateNumber;
    setHasChanges(hasDataChanged);
  }, [selectedServices, notes, date, time, formData]);

  const handleNavigation = (callback) => {
    if (hasChanges && editId) {
      setPendingNavigation(callback);
      setShowConfirmModal(true);
    } else {
      callback();
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges && editId) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges, editId]);

const toggleService = (service) => {
    const exists = selectedServices.find(s => Number(s.id) === Number(service.id));
    if (exists) {
      setSelectedServices(selectedServices.filter(s => Number(s.id) !== Number(service.id)));
    } else {
      if (selectedServices.length >= maxServices) {
        toast.error(`You can only select up to ${maxServices} services per booking`);
        return;
      }
      const priceAsNumber = Number(service.price);
      setSelectedServices([...selectedServices, { ...service, price: priceAsNumber }]);
    }
  };

  // Fixed total calculation
const totalAmount = selectedServices.reduce((sum, s) => sum + Number(s.price || 0), 0);  const submitBooking = async () => {
    const { vehicleType, plateNumber, contactNumber, email, vehicleBrand, vehicleModel } = formData;
    
    if (selectedServices.length === 0) return toast.error("Select at least one service");
    if (!date || !time) return toast.error("Select date and time");
    if (!vehicleType) return toast.error("Vehicle type is required");

    try {
      let appointmentStart = new Date(date);
      const [hours, minutes] = time.split(":");
      appointmentStart.setHours(parseInt(hours), parseInt(minutes), 0);

      const payload = {
        services: selectedServices.map(s => Number(s.id)),
        appointmentStart: appointmentStart.toISOString(),
        vehicleType, 
        plateNumber, 
        contactNumber, 
        email, 
        vehicleBrand, 
        vehicleModel, 
        notes,
        totalPrice: totalAmount // Added this in case your backend needs the total
      };

      console.log("Submitting Payload:", payload);

      if (editId) {
        await API.patch(`/bookings/${editId}`, payload);
      } else {
        await API.post("/bookings", payload);
      }

      setHasChanges(false);
      toast.success(editId ? "Booking Updated!" : "Booking Successful!");
      navigate("/customer/bookings");
    } catch (err) {
      console.error("FULL BACKEND RESPONSE:", err.response?.data);
      // toast.error is handled by axios interceptor
    }
  };

  const renderServiceSection = (title, list) => {
    if (!list || list.length === 0) return null;
    const atLimit = selectedServices.length >= maxServices;
    return (
      <div style={styles.sectionContainer}>
        <h3 style={styles.sectionTitle}>{title}</h3>
        <div style={styles.servicesGrid}>
          {list.map((service) => {
            const isSelected = selectedServices.find(s => Number(s.id) === Number(service.id));
            const isDisabled = atLimit && !isSelected;
            return (
              <div key={service.id} onClick={() => !isDisabled && toggleService(service)}
                style={{ 
                  ...styles.serviceCard, 
                  borderColor: isSelected ? "var(--accent-blue)" : "var(--border-color)", 
                  background: isSelected ? "rgba(56, 189, 248, 0.1)" : "var(--bg-tertiary)",
                  opacity: isDisabled ? 0.5 : 1,
                  cursor: isDisabled ? "not-allowed" : "pointer"
                }}>
                <div style={styles.cardHeader}>
                  <span style={styles.serviceName}>{service.name}</span>
                  {isSelected && <span style={{color: "var(--accent-blue)"}}>✓</span>}
                </div>
                <p style={styles.serviceDesc}>{service.description}</p>
                <div style={styles.priceTag}>₱{Number(service.price).toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (showConfirmModal) {
    return (
      <CustomerLayout active="book">
        <div style={styles.pageWrapper}>
          <div style={styles.confirmOverlay}>
            <div style={styles.confirmModal}>
              <h3 style={styles.confirmTitle}>Unsaved Changes</h3>
              <p style={styles.confirmText}>You have unsaved changes. Are you sure you want to leave? Your changes will be lost.</p>
              <div style={styles.confirmButtons}>
                <button 
                  style={styles.confirmDiscardBtn}
                  onClick={() => {
                    setHasChanges(false);
                    setShowConfirmModal(false);
                    if (pendingNavigation) pendingNavigation();
                    navigate("/customer/bookings");
                  }}
                >
                  Discard Changes
                </button>
                <button 
                  style={styles.confirmCancelBtn}
                  onClick={() => {
                    setShowConfirmModal(false);
                    setPendingNavigation(null);
                  }}
                >
                  Keep Editing
                </button>
              </div>
            </div>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout active="book">
      <div style={styles.pageWrapper}>
        <h1 style={styles.title}>{editId ? "Edit Your Booking" : "Book an Appointment"}</h1>
        <div style={styles.grid}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Select Services</h2>
            {renderServiceSection("Exterior Services", services.exterior)}
            {renderServiceSection("Interior Services", services.interior)}
            {renderServiceSection("Specialized Services", services.specialized)}
          </div>
          <div style={styles.summarySidebar}>
            <div style={styles.summaryCard}>
              <h3 style={styles.summaryTitle}>Booking Summary</h3>
              <div style={styles.serviceCount}>
                <span>Services: {selectedServices.length}/{maxServices}</span>
                {selectedServices.length >= maxServices && <span style={styles.limitReached}> (limit reached)</span>}
              </div>
              <div style={styles.summaryList}>
                {selectedServices.length === 0 ? <p style={styles.emptyText}>No services selected</p> :
                  selectedServices.map((s, i) => (
                    <div key={i} style={styles.summaryRow}>
                      <span>{s.name}</span>
                      <span>₱{s.price.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
              <div style={styles.divider} />
              <div style={styles.totalRow}>
                <span>Total Amount</span>
                <span style={styles.totalPrice}>₱{totalAmount.toLocaleString()}</span>
              </div>
              
              <div style={styles.inputGroup}>
                <label style={styles.label}>Select Date</label>
                <DatePicker 
                  selected={date} 
                  onChange={(d) => setDate(d)} 
                  minDate={new Date()} 
                  className="date-picker-input-custom" 
                  dateFormat="MMMM d, yyyy" 
                  placeholderText="Choose Date"
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Available Slots</label>
                <div style={styles.slotGrid}>
                  {slots.length === 0 ? <p style={styles.emptyText}>{date ? "No slots available" : "Select a date"}</p> :
                    slots.map(slot => (
                      <button key={slot} type="button" onClick={() => setTime(slot)}
                        style={{ ...styles.slotBtn, borderColor: time === slot ? "var(--accent-blue)" : "var(--border-color)", background: time === slot ? "rgba(56, 189, 248, 0.2)" : "var(--bg-primary)" }}>
                        {slot}
                      </button>
                    ))}
                </div>
              </div>

              <div style={styles.formSection}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Vehicle Type *</label>
                  <select name="vehicleType" value={formData.vehicleType} onChange={handleInputChange} style={styles.input}>
                    <option value="">Select type</option>
                    <option value="Sedan">Sedan</option>
                    <option value="SUV">SUV</option>
                    <option value="Van">Van</option>
                    <option value="Pickup">Pickup</option>
                  </select>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Plate Number</label>
                  <input name="plateNumber" value={formData.plateNumber} onChange={handleInputChange} style={styles.input}/>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Contact Number *</label>
                  <input name="contactNumber" value={formData.contactNumber} onChange={handleInputChange} style={styles.input}/>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={styles.textarea}/>
                </div>
              </div>
              <button style={styles.bookButton} onClick={submitBooking}>
                {editId ? "Update Booking" : "Confirm Booking"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
};

// ... keep your styles object exactly as it was ...
const styles = {
  pageWrapper: { padding: "20px", maxWidth: "1200px", margin: "0 auto" },
  title: { fontSize: "28px", color: "var(--text-primary)", marginBottom: "20px" },
  grid: { display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: "25px", alignItems: "start" },
  card: { background: "var(--card-bg)", padding: "25px", borderRadius: "16px", border: "1px solid var(--border-color)" },
  summarySidebar: { position: "sticky", top: "20px" },
  summaryCard: { background: "var(--card-bg)", padding: "20px", borderRadius: "16px", border: "1px solid var(--border-color)" },
  serviceCount: { fontSize: "13px", color: "var(--text-secondary)", marginBottom: "10px", padding: "8px 12px", background: "var(--bg-primary)", borderRadius: "8px" },
  limitReached: { color: "var(--accent-yellow)", fontWeight: "600" },
  summaryList: { maxHeight: "200px", overflowY: "auto", margin: "15px 0" },
  summaryRow: { display: "flex", justifyContent: "space-between", color: "var(--text-primary)", fontSize: "14px", marginBottom: "8px" },
  divider: { height: "1px", background: "var(--border-color)", margin: "15px 0" },
  totalRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  totalPrice: { fontSize: "20px", color: "var(--accent-blue)", fontWeight: "700" },
  sectionContainer: { marginTop: "30px" },
  sectionTitle: { fontSize: "18px", color: "var(--text-primary)", marginBottom: "15px", borderLeft: "4px solid var(--accent-blue)", paddingLeft: "10px" },
  servicesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "15px" },
  serviceCard: { padding: "16px", borderRadius: "12px", cursor: "pointer", border: "2px solid var(--border-color)", transition: "0.2s" },
  serviceName: { fontWeight: "600", color: "var(--text-primary)", fontSize: "15px" },
  serviceDesc: { color: "var(--text-secondary)", fontSize: "12px", margin: "8px 0" },
  priceTag: { color: "var(--accent-blue)", fontWeight: "700" },
  inputGroup: { marginBottom: "15px" },
  label: { fontSize: "12px", color: "var(--text-secondary)", fontWeight: "600", display: "block", marginBottom: "5px" },
  input: { background: "var(--bg-primary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", padding: "10px", borderRadius: "8px", width: "100%" },
  textarea: { background: "var(--bg-primary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", padding: "10px", borderRadius: "8px", width: "100%", height: "80px" },
  slotGrid: { display: "flex", flexWrap: "wrap", gap: "8px" },
  slotBtn: { padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", color: "var(--text-primary)", cursor: "pointer" },
  bookButton: { background: "var(--accent-blue)", color: "#020617", width: "100%", padding: "14px", border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer" },
  emptyText: { color: "var(--text-secondary)", fontSize: "13px" },
  confirmOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  confirmModal: { background: "var(--card-bg)", padding: "30px", borderRadius: "16px", border: "1px solid var(--border-color)", maxWidth: "420px", width: "90%" },
  confirmTitle: { fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "15px" },
  confirmText: { fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "25px" },
  confirmButtons: { display: "flex", gap: "12px" },
  confirmDiscardBtn: { flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid var(--accent-red)", background: "transparent", color: "var(--accent-red)", fontWeight: "600", cursor: "pointer" },
  confirmCancelBtn: { flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "var(--accent-blue)", color: "#020617", fontWeight: "600", cursor: "pointer" }
};

export default BookAppointment;
