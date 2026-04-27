import { Calendar, XCircle, CheckCircle2, AlertCircle } from "lucide-react";

// Booking Status = APPOINTMENT LIFECYCLE only
// Valid statuses: SCHEDULED, CANCELLED
// Note: ONGOING and PENDING/CONFIRMED are legacy DB values — mapped to SCHEDULED
const BookingStatusBadge = ({ status }) => {
  const normalized = ["PENDING", "CONFIRMED"].includes(status) ? "SCHEDULED" : status;
  const configs = {
    SCHEDULED: {
      icon: <Calendar size={12} />,
      label: "Scheduled",
      color: "#3b82f6",
      textColor: "#fff"
    },
    ONGOING: {
      icon: <Calendar size={12} />,
      label: "Ongoing",
      color: "#f97316",
      textColor: "#fff"
    },
    COMPLETED: {
      icon: <CheckCircle2 size={12} />,
      label: "Completed",
      color: "#22c55e",
      textColor: "#fff"
    },
    CANCELLED: {
      icon: <XCircle size={12} />,
      label: "Cancelled",
      color: "#ef4444",
      textColor: "#fff"
    }
  };

  const cfg = configs[normalized] || {
    icon: <AlertCircle size={12} />,
    label: normalized || "Unknown",
    color: "#94a3b8",
    textColor: "#fff"
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "12px",
        background: cfg.color,
        color: cfg.textColor,
        fontSize: "11px",
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        whiteSpace: "nowrap"
      }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
};

export default BookingStatusBadge;
