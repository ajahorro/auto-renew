import BookingStatusBadge from "./BookingStatusBadge";
import { confirmAction } from "./ConfirmModal";

const AppointmentCard = ({ booking, onCancel }) => {

  const start = new Date(booking.appointmentStart);

  const date = start.toLocaleDateString();

  const time = start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  const hasPayment =
    booking.paymentStatus &&
    booking.paymentStatus !== "UNPAID";

  return (

    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "15px",
        marginBottom: "10px"
      }}
    >

      <strong>
        {booking.items.map(i => i.service.name).join(", ")}
      </strong>

      <p>
        {date} • {time}
        <BookingStatusBadge status={booking.status} />
      </p>

      {hasPayment && booking.status !== "cancelled" && (
        <p style={{ color: "#c97c00", fontSize: "13px" }}>
          ⚠ Payment recorded for this booking
        </p>
      )}

      {["pending", "scheduled"].includes(booking.status) && onCancel && (

        <button
          onClick={async () => {
            let confirmed;
            
            if (hasPayment) {
              confirmed = await confirmAction({
                title: "Cancel Booking",
                message: "This booking has recorded payments.\n\nRefunds are not automatic.\nPlease contact the shop regarding refunds.\n\nContinue cancelling?",
                confirmText: "Yes, Cancel",
                cancelText: "Keep Booking",
                type: "danger"
              });
            } else {
              confirmed = await confirmAction({
                title: "Cancel Booking",
                message: "Are you sure you want to cancel this booking?",
                confirmText: "Yes, Cancel",
                cancelText: "Keep Booking",
                type: "danger"
              });
            }

            if (!confirmed) return;

            onCancel(booking.id);

          }}
          style={{
            background: "#dc3545",
            color: "white",
            border: "none",
            padding: "6px 10px",
            borderRadius: "5px",
            cursor: "pointer",
            marginTop: "6px"
          }}
        >
          Cancel Booking
        </button>

      )}

    </div>

  );

};

export default AppointmentCard;