import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { confirmAction } from "../../components/ConfirmModal";
import CustomerLayout from "../../components/CustomerLayout";
import API from "../../api/axios";
import "../../App.css";
import { 
  User, 
  Phone, 
  Mail, 
  Car, 
  CreditCard, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  Bell, 
  Clock, 
  History,
  PlusCircle,
  ArrowRight
} from "lucide-react";
import BookingStatusBadge from "../../components/BookingStatusBadge";
import PaymentStatusBadge from "../../components/PaymentStatusBadge";

const CustomerDashboard = () => {
  const canCancel = (status) => {
    return status === "PENDING" || status === "CONFIRMED";
  };

  const navigate = useNavigate();

  const [booking, setBooking] = useState({
    id: null,
    status: "",
    paymentStatus: "",
    appointmentStart: null,
    services: [],
    notes: "",
    totalAmount: 0,
    amountPaid: 0,
    customer: null,
    payments: [],
    vehicleType: "",
    plateNumber: "",
    contactNumber: "",
    email: "",
    paymentMethod: "CASH"
  });

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  
  const emptyBooking = {
    id: null, status: "", paymentStatus: "", appointmentStart: null,
    services: [], notes: "", totalAmount: 0, amountPaid: 0,
    customer: null, payments: [], vehicleType: "", plateNumber: "",
    contactNumber: "", email: "", paymentMethod: "CASH"
  };

  useEffect(() => {
    const loadBooking = async () => {
      try {
        const res = await API.get("/bookings");
        const bookings = res.data.bookings || [];

        if (bookings.length === 0) {
          setBooking(emptyBooking);
          setHistory([]);
          setLoading(false);
          return;
        }

        const activeBooking = bookings.find(b => 
          b.status !== "COMPLETED" && 
          b.status !== "CANCELLED"
        );

        if (activeBooking) {
          const services = activeBooking.items?.map(item => ({
            name: item.service?.name || item.serviceNameAtBooking || "Service",
            price: Number(item.priceAtBooking || item.price || 0)
          })) || [];

          setBooking({
            id: activeBooking.id,
            status: activeBooking.status,
            paymentStatus: activeBooking.paymentStatus,
            appointmentStart: activeBooking.appointmentStart,
            services,
            notes: activeBooking.notes || "",
            totalAmount: Number(activeBooking.totalAmount || 0),
            amountPaid: Number(activeBooking.amountPaid || 0),
            customer: activeBooking.customer,
            payments: activeBooking.payments || [],
            vehicleType: activeBooking.vehicleType || "",
            plateNumber: activeBooking.plateNumber || "",
            contactNumber: activeBooking.contactNumber || "",
            email: activeBooking.email || "",
            paymentMethod: activeBooking.paymentMethod || "CASH"
          });
        }

        const completedBookings = bookings.filter(b => b.status === "COMPLETED").slice(0, 2);
        setHistory(completedBookings);
      } catch (err) {
        console.error("Failed to load booking:", err);
      } finally {
        setLoading(false);
      }
    };

    loadBooking();
    const interval = setInterval(loadBooking, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const res = await API.get("/notifications");
        setNotifications(res.data.notifications || []);
      } catch (err) {
        console.log("Notification fetch error:", err);
      }
    };
    loadNotifications();
  }, []);

  const total = booking.services.reduce((sum, s) => sum + (s.price || 0), 0);
  const balance = total - booking.amountPaid;

  const cancelBooking = async () => {
    if (!booking.id) return;

    const confirmed = await confirmAction({
      title: "Cancel Booking",
      message: "Are you sure you want to cancel this booking?",
      confirmText: "Yes, Cancel",
      cancelText: "Keep Booking",
      type: "danger"
    });

    if (!confirmed) return;

    try {
      const res = await API.patch(`/bookings/request-cancel/${booking.id}`, {
        reason: "Requested by customer from dashboard"
      });
      toast.success(res.data.message || "Cancellation request submitted");
      setBooking(emptyBooking);
    } catch (err) {
      console.error("Cancel failed", err);
      toast.error(err.response?.data?.message || "Cancel failed");
    }
  };

  const isCancelled = booking.status === "CANCELLED";

  return (
    <CustomerLayout active="dashboard">
      <div className="dashboard-main" style={{ width: "100%" }}>
        <h1 style={{ marginBottom: "24px", fontWeight: "800", color: "var(--text-primary)" }}>
          WELCOME BACK!
        </h1>

        {loading && <p style={{ color: "var(--text-secondary)" }}>Loading your booking...</p>}

        <div className="dashboard-grid">
          {/* MAIN CARD */}
          <div className="card" style={{ padding: "30px", borderRadius: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <FileText size={20} color="var(--accent-blue)" />
                Booking Details
              </h3>
              {booking.id && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <BookingStatusBadge status={booking.status} />
                  <PaymentStatusBadge status={booking.paymentStatus} />
                </div>
              )}
            </div>

            {isCancelled || !booking.id ? (
              <div style={{ marginTop: "40px", textAlign: "center", padding: "40px 20px" }}>
                <div style={{ 
                  width: "60px", height: "60px", background: "var(--bg-tertiary)", 
                  borderRadius: "50%", display: "flex", alignItems: "center", 
                  justifyContent: "center", margin: "0 auto 20px" 
                }}>
                  <Calendar size={30} color="var(--text-secondary)" />
                </div>
                <p style={{ fontWeight: "600", fontSize: "18px", color: "var(--text-primary)" }}>
                  No active booking found
                </p>
                <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
                  Book a service to get your car detailed.
                </p>
                <button 
                  onClick={() => navigate("/customer/book")}
                  style={{
                    marginTop: "24px", padding: "12px 24px", borderRadius: "10px",
                    border: "none", background: "var(--accent-blue)", color: "white",
                    fontWeight: "600", cursor: "pointer", display: "inline-flex",
                    alignItems: "center", gap: "8px"
                  }}
                >
                  <PlusCircle size={18} />
                  Book Now
                </button>
              </div>
            ) : (
              <>
                <div style={{ 
                  marginTop: "30px", display: "grid", 
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" 
                }}>
                  <div className="section-lg">
                    <p style={{ fontWeight: "700", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Calendar size={16} color="var(--accent-blue)" />
                      Appointment
                    </p>
                    <p style={{ fontSize: "15px", color: "var(--text-primary)" }}>
                      {new Date(booking.appointmentStart).toLocaleDateString(undefined, { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                      })}
                    </p>
                    <p style={{ fontSize: "14px", color: "var(--accent-blue)", marginTop: "4px", fontWeight: "600" }}>
                      {new Date(booking.appointmentStart).toLocaleTimeString(undefined, {
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                    
                    <div style={{ marginTop: "16px", padding: "12px", background: "var(--bg-tertiary)", borderRadius: "10px" }}>
                      {booking.services.map((service, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: i < booking.services.length - 1 ? "6px" : 0 }}>
                          <div style={{ width: "6px", height: "6px", background: "var(--accent-blue)", borderRadius: "50%" }} />
                          <span style={{ fontSize: "13px" }}>{service.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="section-lg">
                    <p style={{ fontWeight: "700", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Car size={16} color="var(--accent-blue)" />
                      Vehicle & Contact
                    </p>
                    <div style={{ display: "grid", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <User size={14} color="var(--text-secondary)" />
                        <span style={{ fontSize: "14px" }}>{booking.customer?.fullName}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Phone size={14} color="var(--text-secondary)" />
                        <span style={{ fontSize: "14px" }}>{booking.contactNumber || "N/A"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Car size={14} color="var(--text-secondary)" />
                        <span style={{ fontSize: "14px" }}>{booking.vehicleType} ({booking.plateNumber || "No Plate"})</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <CreditCard size={14} color="var(--text-secondary)" />
                        <span style={{ fontSize: "14px" }}>{booking.paymentMethod === "GCASH" ? "GCash" : "Cash"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "24px" }}>
                  <p style={{ fontWeight: "700", marginBottom: "8px", color: "var(--text-primary)" }}>Notes</p>
                  <div style={{ 
                    padding: "16px", borderRadius: "12px", background: "var(--bg-tertiary)", 
                    fontSize: "14px", color: "var(--text-secondary)", fontStyle: booking.notes ? "normal" : "italic" 
                  }}>
                    {booking.notes || "No extra notes for this booking."}
                  </div>
                </div>

                <div style={{ marginTop: "30px", padding: "20px", background: "var(--bg-tertiary)", borderRadius: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontWeight: "600" }}>Total Amount</span>
                    <span style={{ fontWeight: "800", fontSize: "18px", color: "var(--accent-blue)" }}>₱{booking.totalAmount.toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "6px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Amount Paid</span>
                    <span style={{ color: "var(--accent-green)", fontWeight: "600" }}>₱{booking.amountPaid.toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Remaining Balance</span>
                    <span style={{ color: "var(--accent-red)", fontWeight: "600" }}>₱{balance.toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={cancelBooking}
                    disabled={!canCancel(booking.status)}
                    style={{
                      padding: "10px 20px", borderRadius: "10px", border: "none",
                      background: canCancel(booking.status) ? "rgba(239, 68, 68, 0.1)" : "var(--bg-tertiary)",
                      color: canCancel(booking.status) ? "var(--accent-red)" : "var(--text-secondary)",
                      cursor: canCancel(booking.status) ? "pointer" : "not-allowed",
                      fontWeight: "600", transition: "0.2s"
                    }}
                  >
                    Request Cancellation
                  </button>
                </div>
              </>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div className="right-stack" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div className="card" style={{ padding: "24px", borderRadius: "18px" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <History size={18} color="var(--accent-blue)" />
                Recent History
              </h3>

              {history.length === 0 ? (
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", textAlign: "center", padding: "20px 0" }}>
                  No completed services yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {history.map((h, i) => {
                    const services = h.items?.map(item => item.service?.name || item.serviceNameAtBooking).join(", ");
                    const totalAmt = Number(h.totalAmount || 0);
                    return (
                      <div key={i} style={{ padding: "12px", background: "var(--bg-tertiary)", borderRadius: "10px" }}>
                        <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>{services}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)" }}>
                          <span>{new Date(h.appointmentStart).toLocaleDateString()}</span>
                          <span style={{ fontWeight: "600", color: "var(--accent-blue)" }}>₱{totalAmt.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                style={{
                  width: "100%", marginTop: "16px", padding: "10px", borderRadius: "10px",
                  border: "1px solid var(--border-color)", background: "transparent",
                  color: "var(--text-primary)", cursor: "pointer", fontSize: "13px",
                  fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                }}
                onClick={() => navigate("/customer/bookings")}
              >
                View All Bookings
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="card" style={{ padding: "24px", borderRadius: "18px" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <Bell size={18} color="var(--accent-blue)" />
                Notifications
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {notifications.length === 0 ? (
                  <p style={{ fontSize: "14px", color: "var(--text-secondary)", textAlign: "center", padding: "20px 0" }}>
                    No new notifications.
                  </p>
                ) : (
                  notifications.slice(0, 3).map(n => (
                    <div key={n.id} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <div style={{ marginTop: "4px" }}>
                        <CheckCircle2 size={14} color="var(--accent-green)" />
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: "1.4" }}>{n.title}</div>
                    </div>
                  ))
                )}
              </div>

              <button
                style={{
                  width: "100%", marginTop: "16px", padding: "10px", borderRadius: "10px",
                  border: "1px solid var(--border-color)", background: "transparent",
                  color: "var(--text-primary)", cursor: "pointer", fontSize: "13px",
                  fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                }}
                onClick={() => navigate("/customer/notifications")}
              >
                View Notifications
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="cta-card" style={{ 
          marginTop: "40px", padding: "40px", borderRadius: "20px", 
          background: "linear-gradient(135deg, var(--accent-blue), #1e40af)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          color: "white"
        }}>
          <div style={{ maxWidth: "60%" }}>
            <h2 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "10px", color: "white" }}>
              READY FOR YOUR NEXT SERVICE?
            </h2>
            <p style={{ opacity: 0.9, lineHeight: "1.6" }}>
              Keep your vehicle in showroom condition with our premium detailing packages. 
              Schedule your next appointment today!
            </p>
          </div>

          <button 
            onClick={() => navigate("/customer/book")}
            style={{
              padding: "16px 32px", borderRadius: "12px", border: "none",
              background: "white", color: "var(--accent-blue)", fontWeight: "700",
              cursor: "pointer", fontSize: "16px", boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
              transition: "0.2s"
            }}
          >
            Book Now
          </button>
        </div>
      </div>
    </CustomerLayout>
  );
}

export default CustomerDashboard;
