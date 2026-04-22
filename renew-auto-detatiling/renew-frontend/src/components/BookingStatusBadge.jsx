import { Calendar, XCircle, CheckCircle2, AlertCircle } from "lucide-react";

// Booking Status = APPOINTMENT LIFECYCLE only
// Valid statuses: SCHEDULED, CANCELLED
// Note: ONGOING and PENDING/CONFIRMED are legacy DB values — mapped to SCHEDULED
const BookingStatusBadge = ({ status }) => {
  const getConfig = () => {
    switch (status) {
      case "SCHEDULED":
        return { icon: <Calendar size={12} />, label: "Scheduled", color: "#3b82f6" };
      case "CANCELLED":
        return { icon: <XCircle size={12} />, label: "Cancelled", color: "#ef4444" };
      case "COMPLETED":
        return { icon: <CheckCircle2 size={12} />, label: "Completed", color: "#22c55e" };
      // Legacy DB values — silently map to Scheduled (they are valid active bookings)
      case "PENDING":
      case "CONFIRMED":
      case "ONGOING":
        return { icon: <Calendar size={12} />, label: "Scheduled", color: "#3b82f6" };
      default:
        return { icon: <AlertCircle size={12} />, label: status || "Unknown", color: "#94a3b8" };
    }
  };

  const { icon, label, color } = getConfig();

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "12px",
        background: color,
        color: "white",
        fontSize: "11px",
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        whiteSpace: "nowrap"
      }}
    >
      {icon}
      {label}
    </span>
  );
};

export default BookingStatusBadge;