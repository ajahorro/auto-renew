import { useState } from "react";
import BookingDetailsModal from "./BookingDetailsModal";
import BookingStatusBadge from "./BookingStatusBadge";
import PaymentStatusBadge from "./PaymentStatusBadge";

const BookingTable = ({ bookings = [], refresh }) => {
  const [selected, setSelected] = useState(null);

  return (
    <div style={styles.container}>
      <table style={styles.table}>
        <thead>
          <tr style={styles.headerRow}>
            <th style={{ ...styles.th, width: "6%" }}>ID</th>
            <th style={{ ...styles.th, textAlign: "left", width: "25%" }}>Customer</th>
            <th style={{ ...styles.th, width: "20%" }}>Appointment Date</th>
            <th style={{ ...styles.th, width: "15%" }}>Status</th>
            <th style={{ ...styles.th, width: "15%" }}>Payment</th>
            <th style={{ ...styles.th, width: "10%" }}>Total</th>
            <th style={{ ...styles.th, width: "9%" }}>Action</th>
          </tr>
        </thead>

        <tbody>
          {bookings.length === 0 ? (
            <tr>
              <td colSpan="7" style={styles.emptyCell}>
                No bookings found for this period.
              </td>
            </tr>
          ) : (
            bookings.map((booking) => (
              <tr 
                key={booking.id} 
                style={styles.row}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1e293b")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <td style={styles.td}>#{booking.id}</td>
                <td style={{ ...styles.td, textAlign: "left" }}>
                  <div style={styles.customerName}>{booking.customer?.fullName || "Guest User"}</div>
                </td>
                <td style={styles.td}>
                  {booking.appointmentStart ? (
                    <span style={styles.dateText}>
                      {new Date(booking.appointmentStart).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  ) : "TBD"}
                </td>
                <td style={styles.td}>
                  <BookingStatusBadge status={booking.status} />
                </td>
                <td style={styles.td}>
                  <PaymentStatusBadge status={booking.paymentStatus} />
                </td>
                <td style={{ ...styles.td, fontWeight: "700", color: "#f8f9fa" }}>
                  ₱{Number(booking.totalAmount).toLocaleString()}
                </td>
                <td style={styles.td}>
                  <button
                    onClick={() => setSelected(booking)}
                    style={styles.viewBtn}
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {selected && (
        <BookingDetailsModal
          booking={selected}
          close={() => setSelected(null)}
          refresh={refresh}
        />
      )}
    </div>
  );
};

const styles = {
  container: {
    marginTop: "20px",
    background: "#0f172a", // Match dashboard background
    borderRadius: "15px",
    border: "1px solid #1e293b",
    overflow: "hidden",
  },
  table: { width: "100%", borderCollapse: "collapse", color: "#94a3b8" },
  headerRow: { background: "#1e293b", borderBottom: "1px solid #334155" },
  th: { padding: "16px", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" },
  td: { padding: "16px", textAlign: "center", borderBottom: "1px solid #1e293b", fontSize: "14px" },
  row: { transition: "0.2s" },
  customerName: { color: "#f1f5f9", fontWeight: "500" },
  dateText: { color: "#cbd5e1" },
  viewBtn: {
    padding: "6px 14px",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "0.2s",
  },
  emptyCell: { padding: "40px", textAlign: "center", color: "#64748b", fontSize: "14px" }
};

export default BookingTable;