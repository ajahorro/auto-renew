import { useEffect, useState } from "react";
import API from "../api/axios";

const StaffAssignPanel = ({ booking, refresh }) => {
  const [staff, setStaff] = useState([]);
  const [selected, setSelected] = useState(booking?.assignedStaffId || "");
  const [loading, setLoading] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Keep dropdown in sync with current booking data
  useEffect(() => {
    setSelected(booking?.assignedStaffId || "");
  }, [booking]);

  // Load staff list using unified API tool
  useEffect(() => {
    const loadStaff = async () => {
      try {
        setLoadingStaff(true);
        const res = await API.get("/users?role=STAFF");
        
        // Handle both direct array or nested object formats
        const list = Array.isArray(res.data) ? res.data : (res.data.users || []);
        setStaff(list);
      } catch (err) {
        console.error("Staff fetch error", err);
      } finally {
        setLoadingStaff(false);
      }
    };
    loadStaff();
  }, []);

  const assignStaff = async () => {
    if (!selected) return alert("Select staff first");
    if (selected === booking.assignedStaffId) return alert("Already assigned.");

    try {
      setLoading(true);
      await API.patch(`/bookings/${booking.id}/assign`, {
        assignedStaffId: selected
      });

      alert("Staff assigned successfully");
      if (refresh) await refresh();
    } catch (err) {
      alert(err.response?.data?.message || "Assignment failed");
    } finally {
      setLoading(false);
    }
  };

  const assignedName = booking?.assignedStaff?.fullName || 
                     staff.find(s => s.id === booking?.assignedStaffId)?.fullName;

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>Assign Staff</h4>

      {loadingStaff ? (
        <p style={styles.loading}>Updating staff list...</p>
      ) : (
        <div style={styles.actionRow}>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            style={styles.select}
          >
            <option value="">Select staff</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.fullName}</option>
            ))}
          </select>
          
          <button
            onClick={assignStaff}
            disabled={loading || !selected}
            style={{
              ...styles.button,
              opacity: (loading || !selected) ? 0.6 : 1
            }}
          >
            {loading ? "..." : "Assign"}
          </button>
        </div>
      )}

      {assignedName && (
        <p style={styles.current}>
          Assigned to: <strong>{assignedName}</strong>
        </p>
      )}
    </div>
  );
};

const styles = {
  container: { marginTop: "20px", padding: "15px", background: "#1e293b", borderRadius: "10px" },
  title: { fontSize: "14px", marginBottom: "10px", color: "#94a3b8" },
  loading: { fontSize: "12px", color: "#64748b" },
  actionRow: { display: "flex", gap: "8px" },
  select: { flex: 1, padding: "8px", borderRadius: "6px", background: "#0f172a", color: "#fff", border: "1px solid #334155" },
  button: { padding: "8px 16px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "600", cursor: "pointer" },
  current: { marginTop: "10px", fontSize: "12px", color: "#22c55e" }
};

export default StaffAssignPanel;
