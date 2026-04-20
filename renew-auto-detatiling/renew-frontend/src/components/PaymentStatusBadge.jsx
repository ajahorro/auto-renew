import { 
  CheckCircle2, 
  Clock, 
  XCircle,
  AlertCircle
} from "lucide-react";

const PaymentStatusBadge = ({ status }) => {
  const getIcon = () => {
    switch (status) {
      case "PAID": 
      case "COMPLETED":
      case "APPROVED":
      case "VERIFIED":
        return <CheckCircle2 size={12} />;
      case "PARTIALLY_PAID":
      case "PENDING":
        return <Clock size={12} />;
      case "UNPAID":
      case "REJECTED":
        return <XCircle size={12} />;
      default: return <AlertCircle size={12} />;
    }
  };

  const colors = {
    PAID: "var(--accent-green)",
    COMPLETED: "var(--accent-green)",
    VERIFIED: "var(--accent-green)",
    APPROVED: "var(--accent-green)",
    PARTIALLY_PAID: "var(--accent-yellow)",
    PENDING: "var(--accent-yellow)",
    UNPAID: "var(--accent-red)",
    REJECTED: "var(--accent-red)"
  };

  const labels = {
    PAID: "PAID",
    PARTIALLY_PAID: "PARTIAL",
    UNPAID: "UNPAID"
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
      {labels[status] || status}
    </span>
  );
};

export default PaymentStatusBadge;