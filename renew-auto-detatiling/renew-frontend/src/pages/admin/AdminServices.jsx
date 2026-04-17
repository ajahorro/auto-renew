import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import API from "../../api/axios"; // Unified API utility
import AdminSidebar from "../../components/AdminSidebar";
import { confirmAction } from "../../components/ConfirmModal";

const AdminServices = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Grouped state for cleaner management
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "EXTERIOR",
    price: "",
    durationMin: ""
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  /* ===============================
     LOAD SERVICES
  =============================== */
  const loadServices = useCallback(async () => {
    try {
      const res = await API.get("/services");
      // Flattening the categorized object into a single list for the admin table
      const list = [
        ...(res.data.services?.exterior || []),
        ...(res.data.services?.interior || []),
        ...(res.data.services?.specialized || [])
      ];
      setServices(list);
    } catch {
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  /* ===============================
     CREATE SERVICE
  =============================== */
  const createService = async (e) => {
    e.preventDefault();
    const { name, price, durationMin } = formData;

    if (!name || !price || !durationMin) {
      return toast.error("Please fill in all required fields");
    }

    try {
      await API.post("/services", {
        ...formData,
        price: Number(price),
        durationMin: Number(durationMin)
      });

      toast.success("New service added!");
      setFormData({ name: "", description: "", category: "EXTERIOR", price: "", durationMin: "" });
      loadServices();
    } catch {
      toast.error("Failed to create service");
    }
  };

  /* ===============================
     DELETE SERVICE
  =============================== */
  const deleteService = async (id) => {
    const confirmed = await confirmAction({
      title: "Delete Service",
      message: "Delete this service? Customers won't be able to book it anymore.",
      confirmText: "Yes, Delete",
      cancelText: "Keep Service",
      type: "danger"
    });

    if (!confirmed) return;

    try {
      await API.delete(`/services/${id}`);
      toast.success("Service removed");
      loadServices();
    } catch {
      toast.error("Cannot delete service (it may be linked to existing bookings)");
    }
  };

  return (
    <div style={styles.page}>
      <AdminSidebar active="services" />

      <div style={styles.main}>
        <header style={styles.header}>
          <h1 style={styles.title}>Service Management</h1>
          <p style={styles.subtitle}>Create and manage car wash packages and pricing</p>
        </header>

        <div style={styles.layoutGrid}>
          {/* FORM PANEL */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Add New Service</h3>
            <form onSubmit={createService} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Service Name</label>
                <input name="name" value={formData.name} onChange={handleInputChange} style={styles.input} placeholder="e.g. Deluxe Exterior Wash" />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Category</label>
                <select name="category" value={formData.category} onChange={handleInputChange} style={styles.input}>
                  <option value="EXTERIOR">Exterior</option>
                  <option value="INTERIOR">Interior</option>
                  <option value="SPECIALIZED">Specialized</option>
                </select>
              </div>

              <div style={styles.rowInputs}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Price (₱)</label>
                  <input type="number" name="price" value={formData.price} onChange={handleInputChange} style={styles.input} placeholder="0.00" />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Duration (Min)</label>
                  <input type="number" name="durationMin" value={formData.durationMin} onChange={handleInputChange} style={styles.input} placeholder="45" />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Description</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} style={styles.textarea} placeholder="What's included in this service?" />
              </div>

              <button type="submit" style={styles.submitBtn}>Create Service</button>
            </form>
          </div>

          {/* LIST PANEL */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Current Services</h3>
            <div style={styles.serviceList}>
              {loading ? <p>Loading...</p> : services.map(s => (
                <div key={s.id} style={styles.serviceRow}>
                  <div style={styles.serviceInfo}>
                    <span style={styles.catTag}>{s.category}</span>
                    <strong style={styles.serviceName}>{s.name}</strong>
                    <span style={styles.serviceMeta}>₱{s.price.toLocaleString()} • {s.durationMin} mins</span>
                  </div>
                  <button onClick={() => deleteService(s.id)} style={styles.deleteBtn}>Delete</button>
                </div>
              ))}
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
  layoutGrid: { display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "25px", alignItems: "start" },
  card: { background: "#0f172a", padding: "24px", borderRadius: "16px", border: "1px solid #1e293b" },
  cardTitle: { fontSize: "18px", marginBottom: "20px", color: "#f8f9fa" },
  form: { display: "flex", flexDirection: "column", gap: "15px" },
  inputGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  rowInputs: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" },
  label: { fontSize: "12px", color: "#94a3b8", fontWeight: "600" },
  input: { background: "#020617", border: "1px solid #334155", color: "#fff", padding: "10px", borderRadius: "8px", width: "100%" },
  textarea: { background: "#020617", border: "1px solid #334155", color: "#fff", padding: "10px", borderRadius: "8px", width: "100%", height: "80px", resize: "none" },
  submitBtn: { background: "#38bdf8", color: "#020617", padding: "12px", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer", marginTop: "10px" },
  serviceList: { display: "flex", flexDirection: "column", gap: "12px" },
  serviceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px", background: "#020617", borderRadius: "12px", border: "1px solid #1e293b" },
  serviceInfo: { display: "flex", flexDirection: "column", gap: "2px" },
  catTag: { fontSize: "10px", background: "#334155", color: "#38bdf8", padding: "2px 6px", borderRadius: "4px", width: "fit-content", marginBottom: "4px" },
  serviceName: { color: "#f1f5f9", fontSize: "15px" },
  serviceMeta: { color: "#64748b", fontSize: "13px" },
  deleteBtn: { background: "transparent", color: "#ef4444", border: "1px solid #ef4444", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }
};

export default AdminServices;