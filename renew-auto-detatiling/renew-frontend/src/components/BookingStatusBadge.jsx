const BookingStatusBadge = ({ status }) => {

  const colors = {
    PENDING: "#ffc107",
    SCHEDULED: "#007bff",
    ONGOING: "#fd7e14",
    COMPLETED: "#28a745",
    CANCELLED: "#dc3545"
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
      {status}
    </span>
  );

};

export default BookingStatusBadge;