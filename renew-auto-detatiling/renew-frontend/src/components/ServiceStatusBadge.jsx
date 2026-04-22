import { Clock, Play, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

const ServiceStatusBadge = ({ status }) => {
  const configs = {
    NOT_STARTED: {
      icon: <Clock size={12} />,
      label: "Not Started",
      color: "#64748b",
      textColor: "#fff"
    },
    ONGOING: {
      icon: <Play size={12} />,
      label: "Ongoing",
      color: "#3b82f6",
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

  const cfg = configs[status] || {
    icon: <AlertCircle size={12} />,
    label: status || "Unknown",
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

export default ServiceStatusBadge;
