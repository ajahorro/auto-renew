import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const BookAppointment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  const [currentStep, setCurrentStep] = useState(1);

  const [services, setServices] = useState({ exterior: [], interior: [], specialized: [] });
  const [selectedServices, setSelectedServices] = useState([]);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState([]);
  const [maxServices, setMaxServices] = useState(5);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [cancellationAccepted, setCancellationAccepted] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [gcashInfo, setGcashInfo] = useState(null);
  const [formData, setFormData] = useState({
    contactNumber: "",
    email: "",
    vehicleType: "",
    vehicleBrand: "",
    vehicleModel: "",
    plateNumber: ""
  });

  const [submitting, setSubmitting] = useState(false);
  const [isBookingLocked, setIsBookingLocked] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await API.get("/business-settings");
      const data = res.data;
      const maxSvcs = data?.maxServicesPerBooking;
      if (maxSvcs && Number.isFinite(Number(maxSvcs))) {
        setMaxServices(Number(maxSvcs));
      }
      if (data?.gcashNumber || data?.gcashName) {
        setGcashInfo({ number: data.gcashNumber, name: data.gcashName });
      }
    } catch {
      // use default
    }
  }, []);

  const handleInputChange = (e) => {
    if (isBookingLocked) {
      toast.error("This booking is locked and cannot be modified");
      return;
    }
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
    } catch {
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
        
        if (booking.isLocked) {
          setIsBookingLocked(true);
        }
        
        const servicesFromBooking = (booking.items || [])
          .filter(i => i.service)
          .map(i => ({ 
            id: i.service.id, 
            name: i.service.name, 
            price: Number(i.service.price) 
          }));

        setSelectedServices(servicesFromBooking);
        setNotes(booking.notes || "");
        
        const dateObj = booking.appointmentStart ? new Date(booking.appointmentStart) : null;
        const timeStr = dateObj 
          ? `${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`
          : "";
        
        if (dateObj) {
          setDate(dateObj);
          setTime(timeStr);
        }
        
        setFormData({
          contactNumber: booking.contactNumber || "",
          email: booking.email || "",
          vehicleType: booking.vehicleType || "",
          vehicleBrand: booking.vehicleBrand || "",
          vehicleModel: booking.vehicleModel || "",
          plateNumber: booking.plateNumber || ""
        });
        
        if (booking.paymentMethod) {
          setPaymentMethod(booking.paymentMethod);
        }
      } catch (err) {
        if (err.response?.status === 403) {
          toast.error(err.response.data.message || "This booking cannot be edited");
          navigate("/customer/bookings");
        }
      }
    };
    loadBooking();
  }, [editId, navigate]);

  useEffect(() => {
    if (!date) return;
    const loadSlots = async () => {
      try {
        const formattedDate = formatLocalDate(date);
        const res = await API.get(`/bookings/availability?date=${formattedDate}`);
        const data = res.data;
        const slotList = data.slots || [];
        setSlots(slotList);
        setTime((currentTime) => {
          if (!currentTime) return "";
          const slotTimes = slotList.map(s => typeof s === 'string' ? s : s.time);
          return slotTimes.includes(currentTime) ? currentTime : "";
        });
      } catch {
        setSlots([]);
        setTime("");
      }
    };
    loadSlots();
  }, [date]);

  const toggleService = (service) => {
    if (isBookingLocked) {
      toast.error("This booking is locked and cannot be modified");
      return;
    }
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

  const totalAmount = selectedServices.reduce((sum, s) => sum + Number(s.price || 0), 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + Number(s.durationMin || 0), 0);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }
    
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPG, PNG, or PDF files are allowed");
      return;
    }
    
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setReceiptPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const validateStep1 = () => {
    if (selectedServices.length === 0) {
      toast.error("Please select at least one service");
      return false;
    }
    if (!date || !time) {
      toast.error("Please select date and time");
      return false;
    }
    if (!formData.vehicleType) {
      toast.error("Vehicle type is required");
      return false;
    }
    if (!formData.contactNumber) {
      toast.error("Contact number is required");
      return false;
    }
    return true;
  };

  const goToStep = (step) => {
    if (isBookingLocked) return;
    if (step === 2 && !validateStep1()) return;
    setCurrentStep(step);
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const submitBooking = async () => {
    if (!cancellationAccepted) {
      toast.error("Please accept the cancellation policy");
      return;
    }

    if (paymentMethod === "GCASH" && !receiptFile && !editId) {
      toast.error("Please upload payment proof for GCash");
      return;
    }

    setSubmitting(true);

    try {
      let appointmentStart = new Date(date);
      const cleanTime = time.trim();
      let hour = 0;
      let minute = 0;
      
      if (cleanTime.includes(":")) {
        const parts = cleanTime.replace(/(AM|PM)/i, "").split(":");
        hour = parseInt(parts[0]);
        minute = parseInt(parts[1]);
        if (cleanTime.toUpperCase().includes("PM") && hour < 12) hour += 12;
        if (cleanTime.toUpperCase().includes("AM") && hour === 12) hour = 0;
      }
      
      appointmentStart.setHours(hour, minute, 0, 0);

      const payload = {
        services: selectedServices.map(s => Number(s.id)),
        scheduledDate: formatLocalDate(date),
        scheduledTime: time,
        vehicleType: formData.vehicleType, 
        plateNumber: formData.plateNumber, 
        contactNumber: formData.contactNumber, 
        email: formData.email, 
        vehicleBrand: formData.vehicleBrand, 
        vehicleModel: formData.vehicleModel, 
        notes,
        totalAmount: totalAmount,
        paymentMethod
      };

      let bookingId;
      if (editId) {
        await API.patch(`/bookings/${editId}`, payload);
        bookingId = editId;
      } else {
        const res = await API.post("/bookings", payload);
        bookingId = res.data.booking?.id;
      }

      if (paymentMethod === "GCASH" && receiptFile && bookingId) {
        const formDataUpload = new FormData();
        formDataUpload.append("proof", receiptFile);
        formDataUpload.append("amount", totalAmount.toString());
        formDataUpload.append("method", "GCASH");
        await API.post("/payments", formDataUpload, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }

      toast.success(editId ? "Booking Updated!" : "Booking Submitted Successfully!");
      navigate("/customer/bookings");
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error(err.response.data.message || "Slot is fully booked. Please choose another time.");
      } else if (err.response?.status === 403) {
        toast.error(err.response.data.message || "This booking cannot be edited.");
        navigate("/customer/bookings");
      }
    } finally {
      setSubmitting(false);
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

  const renderProgressTracker = () => (
    <div style={styles.progressTracker}>
      <div style={styles.progressSteps}>
        <div style={{ ...styles.progressStep, ...(currentStep >= 1 ? styles.progressStepActive : {}), ...(currentStep > 1 ? styles.progressStepCompleted : {}) }}>
          <div style={styles.stepCircle}>
            {currentStep > 1 ? "✓" : "1"}
          </div>
          <span style={styles.stepLabel}>Setup</span>
        </div>
        <div style={styles.progressLine} />
        <div style={{ ...styles.progressStep, ...(currentStep >= 2 ? styles.progressStepActive : {}), ...(currentStep > 2 ? styles.progressStepCompleted : {}) }}>
          <div style={styles.stepCircle}>
            {currentStep > 2 ? "✓" : "2"}
          </div>
          <span style={styles.stepLabel}>Review</span>
        </div>
        <div style={styles.progressLine} />
        <div style={{ ...styles.progressStep, ...(currentStep >= 3 ? styles.progressStepActive : {}) }}>
          <div style={styles.stepCircle}>3</div>
          <span style={styles.stepLabel}>Payment</span>
        </div>
      </div>
    </div>
  );

  const renderStep1 = () => (
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
                slots.map((slot) => {
                  const slotTime = typeof slot === 'string' ? slot : slot.time;
                  const isFull = typeof slot === 'object' ? slot.isFull : false;
                  return (
                    <button
                      key={slotTime}
                      type="button"
                      onClick={() => !isFull && setTime(slotTime)}
                      disabled={isFull}
                      style={{
                        ...styles.slotBtn,
                        borderColor: time === slotTime ? "var(--accent-blue)" : isFull ? "var(--accent-red)" : "var(--border-color)",
                        background: time === slotTime ? "rgba(56, 189, 248, 0.2)" : isFull ? "rgba(239, 68, 68, 0.1)" : "var(--bg-primary)",
                        opacity: isFull ? 0.6 : 1,
                        cursor: isFull ? "not-allowed" : "pointer"
                      }}
                    >
                      {slotTime}
                      {isFull && <span style={{ fontSize: "10px", display: "block" }}>Full</span>}
                    </button>
                  );
                })}
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
              <label style={styles.label}>Vehicle Brand</label>
              <input name="vehicleBrand" value={formData.vehicleBrand} onChange={handleInputChange} style={styles.input} placeholder="e.g. Toyota"/>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Vehicle Model</label>
              <input name="vehicleModel" value={formData.vehicleModel} onChange={handleInputChange} style={styles.input} placeholder="e.g. Vios"/>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={styles.textarea} placeholder="Special instructions..."/>
            </div>
          </div>

          <button style={styles.nextButton} onClick={() => goToStep(2)}>
            Continue to Review →
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div style={styles.reviewContainer}>
      <div style={styles.reviewCard}>
        <h2 style={styles.reviewTitle}>Review Your Booking</h2>
        <p style={styles.reviewSubtitle}>Please review your selections before proceeding to payment.</p>

        <div style={styles.reviewSection}>
          <div style={styles.reviewSectionHeader}>
            <h3>Services</h3>
            <button style={styles.editButton} onClick={() => goToStep(1)}>Edit</button>
          </div>
          <div style={styles.reviewServices}>
            {selectedServices.map((s, i) => (
              <div key={i} style={styles.reviewServiceRow}>
                <span>{s.name}</span>
                <span>₱{s.price.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div style={styles.reviewTotal}>
            <span>Total</span>
            <span style={styles.reviewTotalAmount}>₱{totalAmount.toLocaleString()}</span>
          </div>
          {totalDuration > 0 && (
            <p style={styles.durationNote}>Estimated duration: {totalDuration} minutes</p>
          )}
        </div>

        <div style={styles.reviewSection}>
          <div style={styles.reviewSectionHeader}>
            <h3>Schedule</h3>
            <button style={styles.editButton} onClick={() => goToStep(1)}>Edit</button>
          </div>
          <div style={styles.reviewDetail}>
            <span style={styles.detailLabel}>Date:</span>
            <span>{date ? date.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : "-"}</span>
          </div>
          <div style={styles.reviewDetail}>
            <span style={styles.detailLabel}>Time:</span>
            <span>{time || "-"}</span>
          </div>
        </div>

        <div style={styles.reviewSection}>
          <div style={styles.reviewSectionHeader}>
            <h3>Vehicle Information</h3>
            <button style={styles.editButton} onClick={() => goToStep(1)}>Edit</button>
          </div>
          <div style={styles.reviewDetail}>
            <span style={styles.detailLabel}>Type:</span>
            <span>{formData.vehicleType || "-"}</span>
          </div>
          <div style={styles.reviewDetail}>
            <span style={styles.detailLabel}>Brand/Model:</span>
            <span>{[formData.vehicleBrand, formData.vehicleModel].filter(Boolean).join(" ") || "-"}</span>
          </div>
          <div style={styles.reviewDetail}>
            <span style={styles.detailLabel}>Plate Number:</span>
            <span>{formData.plateNumber || "-"}</span>
          </div>
          <div style={styles.reviewDetail}>
            <span style={styles.detailLabel}>Contact:</span>
            <span>{formData.contactNumber || "-"}</span>
          </div>
          {notes && (
            <div style={styles.reviewDetail}>
              <span style={styles.detailLabel}>Notes:</span>
              <span>{notes}</span>
            </div>
          )}
        </div>

        <div style={styles.reviewSection}>
          <div style={styles.reviewSectionHeader}>
            <h3>Payment Method</h3>
            <button style={styles.editButton} onClick={() => goToStep(1)}>Edit</button>
          </div>
          <div style={styles.paymentMethodDisplay}>
            {paymentMethod === "GCASH" ? (
              <span>GCash (Online Payment)</span>
            ) : (
              <span>Cash (Pay at Shop)</span>
            )}
          </div>
        </div>

        <div style={styles.reviewActions}>
          <button style={styles.backButton} onClick={handleBack}>
            ← Back
          </button>
          <button style={styles.proceedButton} onClick={() => goToStep(3)}>
            Proceed to Payment →
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div style={styles.paymentContainer}>
      <div style={styles.paymentCard}>
        <h2 style={styles.paymentTitle}>Payment</h2>

        <div style={styles.cancellationSection}>
          <h3 style={styles.sectionLabel}>Cancellation Policy</h3>
          <div style={styles.policyBox}>
            <p style={styles.policyText}>
              Cancellations made less than 24 hours before the appointment may incur a fee. 
              Please review our cancellation policy before proceeding.
            </p>
          </div>
          <label style={styles.checkboxLabel}>
            <input 
              type="checkbox" 
              checked={cancellationAccepted} 
              onChange={(e) => setCancellationAccepted(e.target.checked)} 
            />
            <span>I have read and agree to the cancellation policy</span>
          </label>
        </div>

        <div style={styles.paymentSection}>
          <h3 style={styles.sectionLabel}>Payment Method</h3>
          
          {paymentMethod === "GCASH" ? (
            <div style={styles.gcashBox}>
              <div style={styles.gcashHeader}>
                <span style={styles.gcashLabel}>GCash Payment</span>
              </div>
              <div style={styles.gcashDetails}>
                <div style={styles.gcashRow}>
                  <span>GCash Number:</span>
                  <span style={styles.gcashValue}>{gcashInfo?.number || "N/A"}</span>
                </div>
                <div style={styles.gcashRow}>
                  <span>Name:</span>
                  <span style={styles.gcashValue}>{gcashInfo?.name || "N/A"}</span>
                </div>
                <div style={styles.gcashRow}>
                  <span>Amount to Pay:</span>
                  <span style={styles.gcashAmount}>₱{totalAmount.toLocaleString()}</span>
                </div>
              </div>
              
              <div style={styles.uploadSection}>
                <label style={styles.uploadLabel}>Upload Payment Receipt *</label>
                <div style={styles.uploadBox}>
                  <input type="file" accept="image/*,.pdf" onChange={handleFileChange} style={styles.fileInput} />
                  {receiptPreview ? (
                    <div style={styles.previewContainer}>
                      {receiptFile?.type === "application/pdf" ? (
                        <div style={styles.pdfPreview}>
                          <span>📄 PDF Selected</span>
                          <span style={styles.fileName}>{receiptFile.name}</span>
                        </div>
                      ) : (
                        <img src={receiptPreview} alt="Receipt preview" style={styles.previewImage} />
                      )}
                      <button style={styles.removeBtn} onClick={removeReceipt}>×</button>
                    </div>
                  ) : (
                    <div style={styles.uploadPlaceholder}>
                      <span style={styles.uploadIcon}>📤</span>
                      <span>Click to upload receipt</span>
                      <span style={styles.uploadHint}>JPG, PNG, or PDF (max 5MB)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={styles.cashBox}>
              <div style={styles.cashIcon}>💵</div>
              <h4 style={styles.cashTitle}>Cash Payment</h4>
              <p style={styles.cashText}>
                Pay ₱{totalAmount.toLocaleString()} at the shop when you arrive for your appointment.
              </p>
            </div>
          )}
        </div>

        <div style={styles.orderSummary}>
          <h3 style={styles.sectionLabel}>Order Summary</h3>
          <div style={styles.summaryRow}>
            <span>Services ({selectedServices.length})</span>
            <span>₱{totalAmount.toLocaleString()}</span>
          </div>
          <div style={styles.summaryDivider} />
          <div style={{...styles.summaryRow, ...styles.summaryTotal}}>
            <span>Total</span>
            <span>₱{totalAmount.toLocaleString()}</span>
          </div>
        </div>

        <div style={styles.submitActions}>
          <button style={styles.backButton} onClick={handleBack}>
            ← Back to Review
          </button>
          <button 
            style={submitting ? {...styles.submitButton, ...styles.submittingButton} : styles.submitButton} 
            onClick={submitBooking}
            disabled={submitting}
          >
            {submitting ? "Submitting..." : (editId ? "Update Booking" : "Submit Booking")}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <CustomerLayout active="book">
      <div style={styles.pageWrapper}>
        <h1 style={styles.title}>{editId ? "Edit Your Booking" : "Book an Appointment"}</h1>
        
        {renderProgressTracker()}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </div>
    </CustomerLayout>
  );
};

const styles = {
  pageWrapper: { padding: "20px", maxWidth: "1200px", margin: "0 auto" },
  title: { fontSize: "28px", color: "var(--text-primary)", marginBottom: "20px" },
  
  progressTracker: { marginBottom: "30px", padding: "20px", background: "var(--card-bg)", borderRadius: "12px", border: "1px solid var(--border-color)" },
  progressSteps: { display: "flex", alignItems: "center", justifyContent: "center", gap: "0" },
  progressStep: { display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" },
  progressStepActive: {},
  progressStepCompleted: {},
  stepCircle: { width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "2px solid var(--border-color)" },
  stepLabel: { fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)" },
  progressLine: { width: "100px", height: "2px", background: "var(--border-color)", margin: "0 10px", marginBottom: "25px" },

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
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  serviceName: { fontWeight: "600", color: "var(--text-primary)", fontSize: "15px" },
  serviceDesc: { color: "var(--text-secondary)", fontSize: "12px", margin: "8px 0" },
  priceTag: { color: "var(--accent-blue)", fontWeight: "700" },
  inputGroup: { marginBottom: "15px" },
  label: { fontSize: "12px", color: "var(--text-secondary)", fontWeight: "600", display: "block", marginBottom: "5px" },
  input: { background: "var(--bg-primary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", padding: "10px", borderRadius: "8px", width: "100%" },
  textarea: { background: "var(--bg-primary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", padding: "10px", borderRadius: "8px", width: "100%", height: "80px" },
  slotGrid: { display: "flex", flexWrap: "wrap", gap: "8px" },
  slotBtn: { padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", color: "var(--text-primary)", cursor: "pointer" },
  nextButton: { background: "var(--accent-blue)", color: "#020617", width: "100%", padding: "14px", border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer", marginTop: "10px" },
  emptyText: { color: "var(--text-secondary)", fontSize: "13px" },
  formSection: { marginTop: "20px", paddingTop: "20px", borderTop: "1px solid var(--border-color)" },

  reviewContainer: { maxWidth: "800px", margin: "0 auto" },
  reviewCard: { background: "var(--card-bg)", padding: "30px", borderRadius: "16px", border: "1px solid var(--border-color)" },
  reviewTitle: { fontSize: "24px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" },
  reviewSubtitle: { fontSize: "14px", color: "var(--text-secondary)", marginBottom: "30px" },
  reviewSection: { marginBottom: "25px", paddingBottom: "25px", borderBottom: "1px solid var(--border-color)" },
  reviewSectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" },
  reviewSectionHeaderH3: { fontSize: "16px", fontWeight: "600", color: "var(--text-primary)" },
  editButton: { padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--accent-blue)", background: "transparent", color: "var(--accent-blue)", fontSize: "12px", fontWeight: "600", cursor: "pointer" },
  reviewServices: { marginBottom: "15px" },
  reviewServiceRow: { display: "flex", justifyContent: "space-between", color: "var(--text-primary)", fontSize: "14px", marginBottom: "8px" },
  reviewTotal: { display: "flex", justifyContent: "space-between", fontWeight: "700", fontSize: "16px", color: "var(--text-primary)", paddingTop: "10px", borderTop: "1px solid var(--border-color)" },
  reviewTotalAmount: { color: "var(--accent-blue)" },
  durationNote: { fontSize: "12px", color: "var(--text-secondary)", marginTop: "10px" },
  reviewDetail: { display: "flex", gap: "15px", fontSize: "14px", color: "var(--text-primary)", marginBottom: "8px" },
  detailLabel: { color: "var(--text-secondary)", minWidth: "100px" },
  paymentMethodDisplay: { padding: "15px", background: "var(--bg-primary)", borderRadius: "8px", fontWeight: "600" },
  reviewActions: { display: "flex", gap: "15px", marginTop: "30px" },
  backButton: { flex: 1, padding: "14px", borderRadius: "10px", border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", fontWeight: "600", cursor: "pointer" },
  proceedButton: { flex: 2, padding: "14px", borderRadius: "10px", border: "none", background: "var(--accent-blue)", color: "#020617", fontWeight: "700", cursor: "pointer" },

  paymentContainer: { maxWidth: "700px", margin: "0 auto" },
  paymentCard: { background: "var(--card-bg)", padding: "30px", borderRadius: "16px", border: "1px solid var(--border-color)" },
  paymentTitle: { fontSize: "24px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "25px" },
  cancellationSection: { marginBottom: "25px" },
  sectionLabel: { fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "12px" },
  policyBox: { padding: "15px", background: "var(--bg-primary)", borderRadius: "8px", marginBottom: "12px" },
  policyText: { fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px" },
  paymentSection: { marginBottom: "25px" },
  gcashBox: { padding: "20px", background: "var(--bg-primary)", borderRadius: "12px", border: "1px solid var(--accent-green)" },
  gcashHeader: { marginBottom: "15px" },
  gcashLabel: { fontSize: "16px", fontWeight: "700", color: "var(--accent-green)" },
  gcashDetails: { marginBottom: "20px" },
  gcashRow: { display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "14px" },
  gcashValue: { fontWeight: "600", color: "var(--text-primary)" },
  gcashAmount: { fontWeight: "700", fontSize: "18px", color: "var(--accent-green)" },
  uploadSection: { marginTop: "15px" },
  uploadLabel: { fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)", display: "block", marginBottom: "8px" },
  uploadBox: { position: "relative", border: "2px dashed var(--border-color)", borderRadius: "8px", padding: "20px", textAlign: "center", cursor: "pointer", transition: "0.2s" },
  fileInput: { position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" },
  uploadPlaceholder: { display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", color: "var(--text-secondary)" },
  uploadIcon: { fontSize: "24px" },
  uploadHint: { fontSize: "11px", opacity: 0.7 },
  previewContainer: { position: "relative", display: "inline-block" },
  previewImage: { maxWidth: "200px", maxHeight: "150px", borderRadius: "8px" },
  pdfPreview: { display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", padding: "20px" },
  fileName: { fontSize: "12px", color: "var(--text-secondary)" },
  removeBtn: { position: "absolute", top: "-8px", right: "-8px", width: "24px", height: "24px", borderRadius: "50%", border: "none", background: "var(--accent-red)", color: "white", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  cashBox: { padding: "30px", background: "var(--bg-primary)", borderRadius: "12px", textAlign: "center" },
  cashIcon: { fontSize: "40px", marginBottom: "10px" },
  cashTitle: { fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" },
  cashText: { fontSize: "14px", color: "var(--text-secondary)" },
  orderSummary: { padding: "20px", background: "var(--bg-primary)", borderRadius: "12px", marginBottom: "25px" },
  summaryDivider: { height: "1px", background: "var(--border-color)", margin: "15px 0" },
  summaryTotal: { fontWeight: "700", fontSize: "18px" },
  submitActions: { display: "flex", gap: "15px" },
  submitButton: { flex: 2, padding: "14px", borderRadius: "10px", border: "none", background: "var(--accent-blue)", color: "#020617", fontWeight: "700", cursor: "pointer", fontSize: "16px" },
  submittingButton: { opacity: 0.7, cursor: "not-allowed" },
};

export default BookAppointment;
