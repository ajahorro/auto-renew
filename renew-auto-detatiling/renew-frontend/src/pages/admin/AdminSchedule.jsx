import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/axios";
import AdminSidebar from "../../components/AdminSidebar";

const AdminSchedule = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load daily schedule when date changes
  useEffect(() => {
    loadSchedule();
  }, [date]);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      // Use the daily schedule endpoint to get actual bookings
      const res = await API.get(`/bookings/schedule?date=${date}`);
      if (res.data.bookings) {
        setBookings(res.data.bookings);
      }
    } catch (err) {
      console.log("Schedule load error", err);
    } finally {
      setLoading(false);
    }
  };

  // Generate hours from 8 AM to 6 PM (18:00)
  const hours = Array.from({ length: 11 }, (_, i) => i + 8);

  // Check if a slot has a booking (show if booking spans this hour)
  const getSlotBooking = (hour) => {
    return bookings.find(b => {
      if (!b.appointmentStart || !b.appointmentEnd) return false;
      const startHour = new Date(b.appointmentStart).getHours();
      const endHour = new Date(b.appointmentEnd).getHours();
      return hour >= startHour && hour < endHour;
    });
  };

  // Check if this is the start of a booking (to show full card)
  const isBookingStart = (booking, hour) => {
    if (!booking) return false;
    const startHour = new Date(booking.appointmentStart).getHours();
    return startHour === hour;
  };

  // Get booking duration in hours
  const getBookingDuration = (booking) => {
    if (!booking) return 0;
    const start = new Date(booking.appointmentStart);
    const end = new Date(booking.appointmentEnd);
    return Math.ceil((end - start) / (1000 * 60 * 60));
  };

  // Check if hour slot is covered by any booking
  const isCoveredByBooking = (hour) => {
    return bookings.some(b => {
      if (!b.appointmentStart || !b.appointmentEnd) return false;
      const startHour = new Date(b.appointmentStart).getHours();
      const endHour = new Date(b.appointmentEnd).getHours();
      return hour > startHour && hour < endHour;
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return "#facc15";
      case "scheduled": return "#3b82f6";
      case "ongoing": return "#f97316";
      case "completed": return "#22c55e";
      default: return "#64748b";
    }
  };

  return (
    <div style={styles.page}>
      <AdminSidebar active="schedule" />

      <div style={styles.main}>
        <div style={styles.header}>
          <div>
            <h1>Daily Schedule</h1>
            <p style={{ opacity: 0.6, fontSize: "14px" }}>
              {bookings.length} booking{bookings.length !== 1 ? "s" : ""} scheduled
            </p>
          </div>
          <div style={styles.dateSelector}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={styles.dateInput}
            />
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading schedule...</p>
        ) : (
          <div style={styles.scheduleCard}>
            {hours.map((hour) => {
              // Convert 24-hour to 12-hour format
              const period = hour >= 12 ? 'PM' : 'AM';
              const displayHour = hour > 12 ? hour - 12 : hour;
              const timeStr = `${displayHour}:00 ${period}`;
              const booking = getSlotBooking(hour);
              const showCard = isBookingStart(booking, hour);
              const duration = showCard ? getBookingDuration(booking) : 0;

              return (
                <div key={hour} style={{...styles.row, minHeight: showCard ? `${60 + (duration - 1) * 50}px` : '60px'}}>
                  <div style={styles.time}>{timeStr}</div>
                  <div style={styles.statusBox}>
                    {showCard ? (
                      <div 
                        style={{...styles.bookedSlot, minHeight: `${50 + (duration - 1) * 40}px`}}
                        onClick={() => navigate(`/admin/bookings/${booking.id}`)}
                      >
                        <div style={styles.bookedHeader}>
                          <span style={styles.bookedBadge}>Booked {duration > 1 ? `(${duration}h)` : ''}</span>
                          <span style={{...styles.statusBadge, background: getStatusColor(booking.status)}}>
                            {booking.status}
                          </span>
                        </div>
                        <div style={styles.bookedDetails}>
                          <strong>{booking.customer?.fullName || "Customer"}</strong>
                          <span style={{opacity: 0.7}}>
                            {new Date(booking.appointmentStart).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})} - {new Date(booking.appointmentEnd).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                          </span>
                        </div>
                        <div style={styles.bookedServices}>
                          {booking.items?.map((item, i) => (
                            <span key={i} style={styles.serviceTag}>
                              {item.service?.name || item.serviceNameAtBooking}
                            </span>
                          ))}
                        </div>
                        <div style={{marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)'}}>
                          Total: ₱{Number(booking.totalAmount || 0).toLocaleString()}
                        </div>
                        {booking.assignedStaff && (
                          <div style={styles.staffTag}>
                            Staff: {booking.assignedStaff.fullName}
                          </div>
                        )}
                      </div>
                    ) : booking ? null : (
                      <span style={styles.unavailable}>Unavailable</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LEGEND */}
        <div style={styles.legend}>
          <div style={styles.legendItem}>
            <span style={styles.legendDot}></span>
            <span>White/Unavailable = Outside business hours or no booking</span>
          </div>
          <div style={styles.legendItem}>
            <span style={{...styles.legendDot, background: "#3b82f6"}}></span>
            <span>Blue = Scheduled booking (confirmed)</span>
          </div>
          <div style={styles.legendItem}>
            <span style={{...styles.legendDot, background: "#f97316"}}></span>
            <span>Orange = Ongoing service</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    display: "flex",
    background: "var(--bg-primary)",
    minHeight: "100vh",
    color: "var(--text-primary)",
    fontFamily: "Poppins, sans-serif"
  },
  main: {
    marginLeft: "280px",
    padding: "40px",
    width: "100%"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "30px"
  },
  dateSelector: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "5px"
  },
  dateInput: {
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid var(--border-color)",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    cursor: "pointer",
    fontSize: "14px"
  },
  scheduleCard: {
    background: "var(--card-bg)",
    borderRadius: "16px",
    padding: "24px",
    border: "1px solid var(--border-color)"
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    padding: "15px 0",
    borderBottom: "1px solid var(--border-color)"
  },
  time: {
    width: "80px",
    fontWeight: "600",
    fontSize: "16px",
    color: "var(--text-secondary)",
    paddingTop: "8px"
  },
  statusBox: {
    flex: 1
  },
  bookedSlot: {
    background: "rgba(59, 130, 246, 0.1)",
    border: "1px solid rgba(59, 130, 246, 0.3)",
    borderRadius: "10px",
    padding: "12px",
    cursor: "pointer",
    transition: "0.2s"
  },
  bookedHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px"
  },
  bookedBadge: {
    color: "var(--accent-blue)",
    fontWeight: "700",
    fontSize: "13px"
  },
  statusBadge: {
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "10px",
    fontWeight: "600",
    color: "#fff"
  },
  bookedDetails: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
    color: "var(--text-primary)"
  },
  bookedServices: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px"
  },
  serviceTag: {
    background: "var(--bg-tertiary)",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    color: "var(--text-secondary)"
  },
  staffTag: {
    marginTop: "8px",
    fontSize: "11px",
    opacity: 0.7,
    color: "var(--text-secondary)"
  },
  unavailable: {
    color: "var(--text-secondary)",
    fontSize: "14px",
    fontStyle: "italic",
    opacity: 0.5
  },
  legend: {
    marginTop: "20px",
    padding: "16px",
    background: "var(--card-bg)",
    borderRadius: "12px",
    display: "flex",
    flexWrap: "wrap",
    gap: "20px"
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    opacity: 0.7,
    color: "var(--text-secondary)"
  },
  legendDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: "var(--text-secondary)"
  }
};

export default AdminSchedule;
