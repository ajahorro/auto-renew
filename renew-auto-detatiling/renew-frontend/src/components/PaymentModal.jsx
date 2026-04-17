import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import API from "../api/axios";

const PaymentModal = ({ booking, onClose, onSuccess, isPostService = false }) => {
  const [method, setMethod] = useState("GCASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [businessSettings, setBusinessSettings] = useState(null);

  useEffect(() => {
    fetchBusinessSettings();
  }, []);

  const fetchBusinessSettings = async () => {
    try {
      const res = await API.get("/business-settings");
      setBusinessSettings(res.data);
    } catch (err) {
      console.error("Failed to fetch business settings", err);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error("File too large. Maximum 5MB allowed.");
        return;
      }
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(selectedFile);
    }
  };

  const getAmountDue = () => {
    if (!booking) return 0;
    if (booking.isDownpaymentRequired && booking.amountPaid < booking.downpaymentAmount) {
      return Number(booking.downpaymentAmount);
    }
    return Number(booking.totalAmount) - Number(booking.amountPaid);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (method === "GCASH" || isPostService) {
      if (!file) {
        toast.error("Please upload a payment receipt");
        return;
      }
      if (!referenceNumber && !isPostService) {
        toast.error("Please enter the GCash reference number");
        return;
      }
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("bookingId", booking.id);
      const finalMethod = isPostService ? "GCASH_POST_SERVICE" : method;
      formData.append("method", finalMethod);
      if (method === "GCASH" || isPostService) {
        formData.append("receipt", file);
        if (referenceNumber) {
          formData.append("referenceNumber", referenceNumber);
        }
      }

      const res = await API.post("/payments", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      toast.success(res.data.message || "Payment submitted successfully!");
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Payment error:", err);
      toast.error(err.response?.data?.message || "Failed to submit payment");
    } finally {
      setLoading(false);
    }
  };

  if (!booking) return null;

  const amountDue = getAmountDue();
  const gcashNumber = businessSettings?.gcashNumber || "0917-123-4567";
  const gcashName = businessSettings?.gcashName || "RENEW Auto Detailing";

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{isPostService ? "Post-Service Payment" : "Make Payment"}</h2>
          <button onClick={onClose} style={closeBtnStyle}>×</button>
        </div>

        <div style={bookingInfoStyle}>
          <div style={infoRow}>
            <span style={labelStyle}>Booking</span>
            <span style={valueStyle}>#{booking.id.toString().padStart(4, '0')}</span>
          </div>
          <div style={infoRow}>
            <span style={labelStyle}>Total Amount</span>
            <span style={valueStyle}>₱{Number(booking.totalAmount).toLocaleString()}</span>
          </div>
          <div style={infoRow}>
            <span style={labelStyle}>Amount Paid</span>
            <span style={valueStyle}>₱{Number(booking.amountPaid || 0).toLocaleString()}</span>
          </div>
          <div style={{ ...infoRow, borderTop: "2px solid var(--border-color)", paddingTop: "10px", marginTop: "5px" }}>
            <span style={{ ...labelStyle, fontWeight: "600" }}>Amount Due</span>
            <span style={{ ...valueStyle, color: "var(--accent-blue)", fontWeight: "700", fontSize: "18px" }}>
              ₱{amountDue.toLocaleString()}
            </span>
          </div>
          {booking.isDownpaymentRequired && (
            <div style={badgeStyle}>
              Downpayment Required (50%)
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={methodTabs}>
            <button
              type="button"
              style={{ ...tabStyle, ...(method === "GCASH" ? activeTabStyle : {}) }}
              onClick={() => setMethod("GCASH")}
            >
              GCash
            </button>
            <button
              type="button"
              style={{ ...tabStyle, ...(method === "CASH" ? activeTabStyle : {}) }}
              onClick={() => setMethod("CASH")}
            >
              Pay on Arrival
            </button>
          </div>

          {method === "GCASH" && (
            <div style={gcashSection}>
              <div style={gcashInfo}>
                <p style={gcashText}>Send payment to:</p>
                <p style={gcashNumberStyle}>{gcashNumber}</p>
                <p style={gcashNameStyle}>{gcashName}</p>
                <p style={amountStyle}>Amount: <strong>₱{amountDue.toLocaleString()}</strong></p>
              </div>

              <div style={fieldGroup}>
                <label style={fieldLabel}>Reference Number *</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Enter 13-digit GCash reference"
                  style={inputStyle}
                  maxLength={13}
                />
              </div>

              <div style={fieldGroup}>
                <label style={fieldLabel}>Upload Receipt *</label>
                <div style={uploadArea}>
                  {preview ? (
                    <div style={previewContainer}>
                      <img src={preview} alt="Receipt preview" style={previewImage} />
                      <button
                        type="button"
                        onClick={() => { setFile(null); setPreview(null); }}
                        style={removeBtnStyle}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label style={uploadLabel}>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleFileChange}
                        style={{ display: "none" }}
                      />
                      <span style={uploadIcon}>📷</span>
                      <span>Click to upload receipt</span>
                      <span style={uploadHint}>JPG, PNG, PDF (max 5MB)</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {method === "CASH" && (
            <div style={cashSection}>
              <p style={cashNote}>
                Pay ₱{amountDue.toLocaleString()} when you arrive for your appointment.
                Please have the exact amount ready.
              </p>
            </div>
          )}

          <div style={actionsStyle}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={submitBtnStyle}>
              {loading ? "Processing..." : method === "GCASH" ? "Submit Payment" : "Confirm Pay on Arrival"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const overlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "20px"
};

const modalStyle = {
  background: "var(--card-bg)",
  borderRadius: "16px",
  width: "100%",
  maxWidth: "480px",
  maxHeight: "90vh",
  overflow: "auto",
  border: "1px solid var(--border-color)"
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "20px 24px",
  borderBottom: "1px solid var(--border-color)"
};

const titleStyle = {
  fontSize: "20px",
  fontWeight: "700",
  color: "var(--text-primary)",
  margin: 0
};

const closeBtnStyle = {
  background: "none",
  border: "none",
  fontSize: "28px",
  cursor: "pointer",
  color: "var(--text-secondary)",
  padding: 0,
  lineHeight: 1
};

const bookingInfoStyle = {
  padding: "20px 24px",
  background: "var(--bg-secondary)",
  borderBottom: "1px solid var(--border-color)"
};

const infoRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "8px"
};

const labelStyle = {
  fontSize: "13px",
  color: "var(--text-secondary)"
};

const valueStyle = {
  fontSize: "14px",
  fontWeight: "500",
  color: "var(--text-primary)"
};

const badgeStyle = {
  marginTop: "12px",
  padding: "6px 12px",
  background: "rgba(59, 130, 246, 0.1)",
  color: "var(--accent-blue)",
  borderRadius: "20px",
  fontSize: "12px",
  fontWeight: "500",
  textAlign: "center"
};

const formStyle = {
  padding: "24px"
};

const methodTabs = {
  display: "flex",
  gap: "10px",
  marginBottom: "20px"
};

const tabStyle = {
  flex: 1,
  padding: "12px",
  border: "1px solid var(--border-color)",
  background: "transparent",
  color: "var(--text-secondary)",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "500",
  transition: "0.2s"
};

const activeTabStyle = {
  background: "var(--accent-blue)",
  color: "#fff",
  borderColor: "var(--accent-blue)"
};

const gcashSection = {
  display: "flex",
  flexDirection: "column",
  gap: "16px"
};

const gcashInfo = {
  padding: "16px",
  background: "rgba(59, 130, 246, 0.1)",
  borderRadius: "12px",
  textAlign: "center"
};

const gcashText = {
  fontSize: "13px",
  color: "var(--text-secondary)",
  marginBottom: "8px"
};

const gcashNumberStyle = {
  fontSize: "20px",
  fontWeight: "700",
  color: "var(--accent-blue)",
  marginBottom: "4px"
};

const gcashNameStyle = {
  fontSize: "14px",
  color: "var(--text-primary)",
  marginBottom: "12px"
};

const amountStyle = {
  fontSize: "14px",
  color: "var(--text-primary)"
};

const fieldGroup = {
  display: "flex",
  flexDirection: "column",
  gap: "8px"
};

const fieldLabel = {
  fontSize: "13px",
  fontWeight: "500",
  color: "var(--text-primary)"
};

const inputStyle = {
  padding: "12px 16px",
  border: "1px solid var(--border-color)",
  borderRadius: "10px",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: "14px",
  outline: "none"
};

const uploadArea = {
  border: "2px dashed var(--border-color)",
  borderRadius: "12px",
  padding: "20px",
  textAlign: "center",
  cursor: "pointer",
  transition: "0.2s"
};

const uploadLabel = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "8px",
  cursor: "pointer",
  color: "var(--text-secondary)"
};

const uploadIcon = {
  fontSize: "32px"
};

const uploadHint = {
  fontSize: "11px",
  color: "var(--text-secondary)"
};

const previewContainer = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "12px"
};

const previewImage = {
  maxWidth: "100%",
  maxHeight: "200px",
  borderRadius: "8px",
  objectFit: "contain"
};

const removeBtnStyle = {
  padding: "6px 16px",
  background: "var(--accent-red)",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "12px"
};

const cashSection = {
  padding: "20px",
  background: "var(--bg-secondary)",
  borderRadius: "12px",
  textAlign: "center"
};

const cashNote = {
  fontSize: "14px",
  color: "var(--text-primary)",
  lineHeight: "1.6"
};

const actionsStyle = {
  display: "flex",
  gap: "12px",
  marginTop: "24px"
};

const cancelBtnStyle = {
  flex: 1,
  padding: "14px",
  border: "1px solid var(--border-color)",
  background: "transparent",
  color: "var(--text-secondary)",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "500"
};

const submitBtnStyle = {
  flex: 2,
  padding: "14px",
  border: "none",
  background: "var(--accent-blue)",
  color: "#fff",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "600"
};

export default PaymentModal;
