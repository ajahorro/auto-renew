const PaymentStatusBadge = ({ status }) => {

  const colors = {
    PAID: "#28a745",
    PARTIALLY_PAID: "#ffc107",
    UNPAID: "#dc3545"
  };

  const labels = {
    PAID: "PAID",
    PARTIALLY_PAID: "PARTIAL",
    UNPAID: "UNPAID"
  };

  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "12px",
        background: colors[status] || "#999",
        color: "white",
        fontSize: "12px",
        fontWeight: "bold"
      }}
    >
      {labels[status] || status}
    </span>
  );

};

export default PaymentStatusBadge;