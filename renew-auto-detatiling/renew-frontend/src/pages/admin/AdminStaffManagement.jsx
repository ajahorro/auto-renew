import { useEffect, useState, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import API from "../../api/axios"; // Unified API utility
import AdminSidebar from "../../components/AdminSidebar";

const AdminStaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: ""
  });

  /* ===============================
     LOAD STAFF
  =============================== */
  const loadStaff = useCallback(async () => {
    try {
      const res = await API.get("/users?role=STAFF");
      // Safety check for the data structure
      setStaff(Array.isArray(res.data) ? res.data : res.data.users || []);
    } catch (err) {
      console.error("Staff fetch error", err);
      toast.error("Could not load staff list");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  /* ===============================
     CREATE STAFF
  =============================== */
  const createStaff = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.password) {
      return toast.error("Please fill all fields");
    }

    try {
      await API.post("/auth/create-staff", form);
      toast.success("Staff member registered successfully");
      
      setForm({ fullName: "", email: "", password: "" });
      loadStaff();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to create staff";
      toast.error(msg);
    }
  };

  /* ===============================
     TOGGLE STAFF STATUS
  =============================== */
  const toggleStatus = async (id, currentStatus) => {
    try {
      await API.patch(`/users/${id}/status`, { active: !currentStatus });
      toast.success(`Staff member ${!currentStatus ? 'activated' : 'deactivated'}`);
      loadStaff();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  // Filtered list for better UX
  const filteredStaff = useMemo(() => {
    return staff.filter(s => 
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [staff, searchTerm]);

  return (
    <div style={styles.page}>
      <AdminSidebar active="staff" />

      <div style={styles.main}>
        <header style={styles.header}>
          <h1 style={styles.title}>Staff Management</h1>
          <p style={styles.subtitle}>Onboard new employees and manage access permissions</p>
        </header>

        <div style={styles.contentGrid}>
          {/* CREATE STAFF PANEL */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Register New Employee</h3>
            <form onSubmit={createStaff} style={styles.formContainer}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Full Name</label>
                <input
                  style={styles.input}
                  placeholder="Juan Dela Cruz"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Email Address</label>
                <input
                  style={styles.input}
                  type="email"
                  placeholder="juan@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Temporary Password</label>
                <input
                  style={styles.input}
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>

              <button type="submit" style={styles.createBtn}>
                Add to Team
              </button>
            </form>
          </div>

          {/* STAFF LIST PANEL */}
          <div style={styles.card}>
            <div style={styles.listHeader}>
              <h3 style={styles.cardTitle}>Active Team ({staff.length})</h3>
              <input 
                placeholder="Search staff..." 
                style={styles.searchBar} 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={styles.scrollArea}>
              {loading ? (
                <p style={styles.emptyText}>Loading records...</p>
              ) : filteredStaff.length === 0 ? (
                <p style={styles.emptyText}>No staff members match your search.</p>
              ) : (
                filteredStaff.map((s) => (
                  <div key={s.id} style={styles.staffRow}>
                    <div style={styles.staffInfo}>
                      <div style={styles.avatar}>
                        {s.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong style={styles.staffName}>{s.fullName}</strong>
                        <p style={styles.staffEmail}>{s.email}</p>
                      </div>
                    </div>

                    <button
                      style={s.active ? styles.deactivateBtn : styles.activateBtn}
                      onClick={() => toggleStatus(s.id, s.active)}
                    >
                      {s.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: { display: "flex", background: "#020617", minHeight: "100vh", fontFamily: "'Poppins', sans-serif" },
  main: { marginLeft: "280px", padding: "40px", width: "calc(100% - 280px)", color: "#e2e8f0" },
  header: { marginBottom: "30px" },
  title: { fontSize: "28px", fontWeight: "700", marginBottom: "5px" },
  subtitle: { color: "#94a3b8", fontSize: "14px" },
  contentGrid: { display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "25px", alignItems: "start" },
  card: { background: "#0f172a", padding: "24px", borderRadius: "16px", border: "1px solid #1e293b", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" },
  cardTitle: { fontSize: "18px", color: "#f8f9fa", margin: 0 },
  formContainer: { display: "flex", flexDirection: "column", gap: "18px", marginTop: "20px" },
  inputGroup: { display: "flex", flexDirection: "column", gap: "8px" },
  label: { fontSize: "12px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" },
  input: { background: "#020617", border: "1px solid #334155", color: "#fff", padding: "12px", borderRadius: "10px", outline: "none" },
  createBtn: { background: "#38bdf8", color: "#020617", padding: "12px", border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer", transition: "0.2s" },
  listHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  searchBar: { background: "#020617", border: "1px solid #334155", color: "#fff", padding: "8px 15px", borderRadius: "20px", fontSize: "13px", width: "200px" },
  scrollArea: { maxHeight: "60vh", overflowY: "auto", paddingRight: "5px" },
  staffRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px", background: "#020617", borderRadius: "12px", marginBottom: "10px", border: "1px solid #1e293b" },
  staffInfo: { display: "flex", alignItems: "center", gap: "12px" },
  avatar: { width: "40px", height: "40px", borderRadius: "50%", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8", fontWeight: "700", border: "1px solid #334155" },
  staffName: { fontSize: "15px", color: "#f1f5f9" },
  staffEmail: { fontSize: "13px", color: "#64748b" },
  deactivateBtn: { padding: "8px 14px", border: "1px solid #ef4444", borderRadius: "8px", background: "transparent", color: "#ef4444", fontSize: "12px", fontWeight: "600", cursor: "pointer" },
  activateBtn: { padding: "8px 14px", border: "none", borderRadius: "8px", background: "#22c55e", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer" },
  emptyText: { textAlign: "center", color: "#64748b", marginTop: "20px" }
};

export default AdminStaffManagement;