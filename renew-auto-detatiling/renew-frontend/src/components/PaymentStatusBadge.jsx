import { CheckCircle2, Clock, XCircle, AlertCircle, Eye, DollarSign } from "lucide-react";

const PaymentStatusBadge = ({ status }) => {
  const configs = {
    PENDING: {
      icon: <Clock size={12} />,
      label: "Pending",
      color: "#f59e0b",
      textColor: "#000"
    },
    FOR_VERIFICATION: {
      icon: <Eye size={12} />,
      label: "For Verification",
      color: "#8b5cf6",
      textColor: "#fff"
    },
    PARTIALLY_PAID: {
      icon: <DollarSign size={12} />,
      label: "Partially Paid",
      color: "#f97316",
      textColor: "#fff"
    },
    PAID: {
      icon: <CheckCircle2 size={12} />,
      label: "Paid",
      color: "#22c55e",
      textColor: "#fff"
    },
    REJECTED: {
      icon: <XCircle size={12} />,
      label: "Rejected",
      color: "#ef4444",
      textColor: "#fff"
    },
    // Legacy aliases
    APPROVED: {
      icon: <CheckCircle2 size={12} />,
      label: "Paid",
      color: "#22c55e",
      textColor: "#fff"
    },
    VERIFIED: {
      icon: <CheckCircle2 size={12} />,
      label: "Verified",
      color: "#22c55e",
      textColor: "#fff"
    },
    UNPAID: {
      icon: <XCircle size={12} />,
      label: "Unpaid",
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

export default PaymentStatusBadge;