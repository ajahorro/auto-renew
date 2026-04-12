import { useState } from "react";
import API from "../api/axios"; // Swapped to our unified API tool

const BillingPanel = ({ booking, refresh }) => {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [loading, setLoading] = useState(false);
  const [verifyingDownpayment, setVerifyingDownpayment] = useState(false);

  const recordPayment = async () => {
    if (!amount) return alert("Enter payment amount");
    
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return alert("Invalid payment amount");
    }

    try {
      setLoading(true);
      // Clean: No more manual fetch headers or localhost URLs
      await API.patch(`/bookings/${booking.id}/payment`, {
        amount: numericAmount,
        method
      });

      alert("Payment recorded");
      setAmount("");
      if (refresh) await refresh();
    } catch (err) {
      console.error("Payment error", err);
      alert(err.response?.data?.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  const verifyDownpayment = async () => {
    try {
      setVerifyingDownpayment(true);
      await API.post(`/bookings/${booking.id}/confirm-downpayment`);
      alert("Downpayment verified");
      if (refresh) await refresh();
    } catch (err) {
      console.error("Verify downpayment error", err);
      alert(err.response?.data?.message || "Downpayment verification failed");
    } finally {
      setVerifyingDownpayment(false);
    }
  };

  const paid = Number(booking.amountPaid || 0);
  const total = Number(booking.totalAmount || 0);
  const remaining = total - paid;
  const requiredDownpayment = Number(booking.downpaymentAmount || 0);
  const remainingDownpayment = Math.max(requiredDownpayment - paid, 0);
  const needsDownpaymentVerification =
    booking.status === "PENDING" &&
    booking.downpaymentRequested &&
    remainingDownpayment > 0;

  return (
    <div style={styles.container}>
      <h4 style={styles.sectionTitle}>Billing & Payments</h4>
      
      <div style={styles.statsGrid}>
        <div style={styles.stat}>
          <p style={styles.label}>Total</p>
          <p>₱{total.toLocaleString()}</p>
        </div>
        <div style={styles.stat}>
          <p style={styles.label}>Paid</p>
          <p style={{ color: "#22c55e" }}>₱{paid.toLocaleString()}</p>
        </div>
      </div>

      <div style={styles.paymentBox}>
        <p style={styles.label}>Record New Payment</p>
        <div style={styles.inputGroup}>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={styles.input}
          />
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            style={styles.select}
          >
            <option value="CASH">Cash</option>
            <option value="GCASH">GCash</option>
          </select>
        </div>

        <button
          onClick={recordPayment}
          disabled={loading || remaining <= 0}
          style={{
            ...styles.button,
            opacity: (loading || remaining <= 0) ? 0.5 : 1,
            cursor: (loading || remaining <= 0) ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Recording..." : "Add Payment"}
        </button>

        {needsDownpaymentVerification && (
          <button
            onClick={verifyDownpayment}
            disabled={verifyingDownpayment}
            style={{
              ...styles.downpaymentButton,
              opacity: verifyingDownpayment ? 0.5 : 1,
              cursor: verifyingDownpayment ? "not-allowed" : "pointer"
            }}
          >
            {verifyingDownpayment
              ? "Verifying..."
              : `Verify Downpayment (P${remainingDownpayment.toLocaleString()})`}
          </button>
        )}
      </div>

      {remaining > 0 ? (
        <p style={styles.balanceText}>
          Balance Due: ₱{remaining.toLocaleString()}
        </p>
      ) : (
        <p style={styles.paidText}>Fully Paid ✓</p>
      )}
    </div>
  );
};

const styles = {
  container: {
    background: "#1e293b",
    padding: "16px",
    borderRadius: "12px",
    marginTop: "10px"
  },
  sectionTitle: { fontSize: "14px", marginBottom: "12px", color: "#94a3b8" },
  statsGrid: { display: "flex", gap: "20px", marginBottom: "16px" },
  stat: { fontSize: "16px", fontWeight: "600" },
  label: { fontSize: "11px", opacity: 0.6, textTransform: "uppercase", marginBottom: "4px" },
  paymentBox: { display: "flex", flexDirection: "column", gap: "8px" },
  inputGroup: { display: "flex", gap: "8px" },
  input: {
    flex: 2,
    background: "#0f172a",
    border: "1px solid #334155",
    color: "#fff",
    padding: "8px",
    borderRadius: "6px"
  },
  select: {
    flex: 1,
    background: "#0f172a",
    border: "1px solid #334155",
    color: "#fff",
    padding: "8px",
    borderRadius: "6px"
  },
  button: {
    background: "#38bdf8",
    color: "#020617",
    border: "none",
    padding: "10px",
    borderRadius: "6px",
    fontWeight: "700",
    fontSize: "13px"
  },
  downpaymentButton: {
    background: "#facc15",
    color: "#111827",
    border: "none",
    padding: "10px",
    borderRadius: "6px",
    fontWeight: "700",
    fontSize: "13px"
  },
  balanceText: { marginTop: "12px", color: "#facc15", fontSize: "13px", fontWeight: "600" },
  paidText: { marginTop: "12px", color: "#22c55e", fontSize: "13px", fontWeight: "600" }
};

export default BillingPanel;
