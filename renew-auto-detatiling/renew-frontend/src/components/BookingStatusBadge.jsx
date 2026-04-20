import { 
  Clock, 
  Calendar, 
  Play, 
  CheckCircle2, 
  XCircle,
  AlertCircle
} from "lucide-react";

const BookingStatusBadge = ({ status }) => {
  const getIcon = () => {
    switch (status) {
      case "PENDING": return <Clock size={12} />;
      case "SCHEDULED": return <Calendar size={12} />;
      case "ONGOING": return <Play size={12} />;
      case "COMPLETED": return <CheckCircle2 size={12} />;
      case "CANCELLED": return <XCircle size={12} />;
      default: return <AlertCircle size={12} />;
    }
  };

  const colors = {
    PENDING: "var(--accent-yellow)",
    SCHEDULED: "var(--accent-blue)",
    ONGOING: "var(--accent-orange)",
    COMPLETED: "var(--accent-green)",
    CANCELLED: "var(--accent-red)"
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "12px",
        background: colors[status] || "#999",
        color: "white",
        fontSize: "11px",
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: "0.5px"
      }}
    >
      {getIcon()}
      {status}
    </span>
  );
};

export default BookingStatusBadge;