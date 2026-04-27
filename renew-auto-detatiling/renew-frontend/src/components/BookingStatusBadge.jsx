import { Calendar, XCircle, CheckCircle2, AlertCircle, Play, Clock } from "lucide-react";

const BookingStatusBadge = ({ status }) => {
  const getStatusConfig = (s) => {
    switch (s) {
      case "PENDING":
        return { label: "Pending", color: "#f59e0b", icon: <Clock size={14} /> };
      case "CONFIRMED":
        return { label: "Confirmed", color: "#3b82f6", icon: <Calendar size={14} /> };
      case "ONGOING":
        return { label: "Ongoing", color: "#8b5cf6", icon: <Play size={14} /> };
      case "COMPLETED":
        return { label: "Completed", color: "#10b981", icon: <CheckCircle2 size={14} /> };
      case "CANCELLED":
        return { label: "Cancelled", color: "#ef4444", icon: <XCircle size={14} /> };
      // Legacy
      case "SCHEDULED":
        return { label: "Confirmed", color: "#3b82f6", icon: <Calendar size={14} /> };
      default:
        return { label: s || "Unknown", color: "#6b7280", icon: <AlertCircle size={14} /> };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "4px 10px",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: "600",
      background: `${config.color}15`,
      color: config.color,
      border: `1px solid ${config.color}30`,
      whiteSpace: "nowrap"
    }}>
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
};

export default BookingStatusBadge;