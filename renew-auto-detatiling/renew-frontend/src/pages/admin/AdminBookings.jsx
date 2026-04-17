import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../../api/axios";
import AdminSidebar from "../../components/AdminSidebar";

const styles = {

  page:{
    display:"flex",
    background:"var(--bg-primary)",
    minHeight:"100vh",
    fontFamily:"Poppins, system-ui"
  },

  main:{
    marginLeft:"280px",
    padding:"40px",
    width:"100%",
    color:"var(--text-primary)"
  },

  title:{
    marginBottom:"30px"
  },

  grid:{
    display:"grid",
    gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",
    gap:"20px"
  },

  card:{
    background:"var(--card-bg)",
    padding:"20px",
    borderRadius:"14px",
    border:"1px solid var(--border-color)"
  },

  row:{
    display:"flex",
    justifyContent:"space-between",
    marginBottom:"6px"
  },

  status:{
    background:"var(--bg-tertiary)",
    padding:"4px 10px",
    borderRadius:"6px"
  },

  services:{
    opacity:0.8,
    marginBottom:"8px"
  },

  section:{
    marginTop:"10px"
  },

  btn:{
    padding:"8px 12px",
    border:"none",
    borderRadius:"6px",
    background:"var(--accent-blue)",
    cursor:"pointer",
    color:"#fff"
  },

  statusBtn:{
    marginRight:"8px",
    padding:"6px 10px",
    border:"none",
    borderRadius:"6px",
    background:"var(--accent-green)",
    cursor:"pointer"
  },

  statusBadge:{
  padding:"4px 10px",
  borderRadius:"999px",
  fontSize:"12px",
  fontWeight:"600",
  color:"#fff",
  display:"inline-block"
},

  cancelBtn:{
    padding:"6px 10px",
    border:"none",
    borderRadius:"6px",
    background:"var(--accent-red)",
    cursor:"pointer",
    color:"#fff"
  } ,

th:{
  padding:"14px 18px",
  fontWeight:"600",
  color:"var(--text-secondary)",
  fontSize:"13px",
  borderBottom:"1px solid var(--border-color)"
},

td:{
  padding:"16px 18px",
  color:"var(--text-primary)",
  fontSize:"14px",
  borderBottom:"1px solid var(--border-color)"
},

table:{
  width:"100%",
  borderCollapse:"separate",
  borderSpacing:"0 8px"
},

toolbar:{
  display:"flex",
  justifyContent:"space-between",
  marginBottom:"20px",
  gap:"10px"
},

search:{
  flex:1,
  padding:"10px 14px",
  borderRadius:"8px",
  border:"1px solid var(--border-color)",
  background:"var(--bg-primary)",
  color:"var(--text-primary)"
},

filter:{
  padding:"10px 12px",
  borderRadius:"8px",
  border:"1px solid var(--border-color)",
  background:"var(--bg-primary)",
  color:"var(--text-primary)"
}

    };

const AdminBookings = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");

  /* LOAD BOOKINGS */
  const loadBookings = useCallback(async () => {
    try {
      const res = await API.get("/bookings");
      
      // Handle the data structure from our backend
      const list = Array.isArray(res.data) 
        ? res.data 
        : (res.data.bookings || []);
        
      setBookings(list);
    } catch (err) {
      console.error("Bookings load error", err);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  /* HANDLE STATUS FILTER CHANGE */
  const handleStatusChange = (status) => {
    setStatusFilter(status);
    if (status) {
      setSearchParams({ status });
    } else {
      setSearchParams({});
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING": return "#facc15";
      case "SCHEDULED": 
      case "CONFIRMED": return "#3b82f6";
      case "ONGOING": return "#a855f7";
      case "COMPLETED": return "#22c55e";
      case "CANCELLED": return "#ef4444";
      default: return "#64748b";
    }
  };

  const getPaymentColor = (payment) => {
    switch (payment) {
      case "COMPLETED": return "#22c55e";
      case "APPROVED": return "#3b82f6";
      case "PENDING": return "#ef4444";
      default: return "#64748b";
    }
  };

  /* SEARCH & FILTER LOGIC */
  const filteredBookings = bookings.filter((b) => {
    const matchesSearch = 
      b.customer?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      b.id.toString().includes(search);
      
    const matchesStatus = statusFilter === "" || b.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

return (
    <div style={styles.page}>
      <AdminSidebar active="bookings" />

      <div style={styles.main}>
        <h1 style={styles.title}>Booking Management</h1>

        {/* SEARCH & FILTER BAR */}
        <div style={styles.toolbar}>
          <input
            type="text"
            placeholder="Search by ID or customer name..."
            style={styles.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            style={styles.filter}
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="ONGOING">Ongoing</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div style={{ width: "100%" }}>
          <table style={styles.table}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Customer</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Payment</th>
                <th style={styles.th}>Method</th>
                <th style={styles.th}>Appointment</th>
                <th style={styles.th}>Vehicle</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredBookings.length > 0 ? (
                filteredBookings.map((b) => (
                  <tr key={b.id} style={{ background: "var(--card-bg)" }}>
                    <td style={styles.td}>#{b.id}</td>
                    <td style={styles.td}>{b.customer?.fullName || "Guest"}</td>
                    <td style={styles.td}>₱{b.totalAmount?.toLocaleString()}</td>

                    {/* STATUS BADGE */}
                    <td style={styles.td}>
                      <span style={{ ...styles.statusBadge, background: getStatusColor(b.status) }}>
                        {b.status}
                      </span>
                    </td>

                    {/* PAYMENT BADGE */}
                    <td style={styles.td}>
                      <span style={{ ...styles.statusBadge, background: getPaymentColor(b.paymentStatus) }}>
                        {b.paymentStatus}
                      </span>
                    </td>

                    {/* PAYMENT METHOD */}
                    <td style={styles.td}>
                      <span style={{ ...styles.statusBadge, background: b.paymentMethod === "GCASH" ? "#8b5cf6" : "#64748b" }}>
                        {b.paymentMethod || "—"}
                      </span>
                    </td>

                    {/* DATE & TIME */}
                    <td style={styles.td}>
                      {b.appointmentStart ? (
                        <>
                          <div style={{ fontSize: '13px' }}>
                            {new Date(b.appointmentStart).toLocaleDateString("en-PH", { dateStyle: "medium" })}
                          </div>
                          <div style={{ opacity: 0.6, fontSize: "11px" }}>
                            {new Date(b.appointmentStart).toLocaleTimeString("en-PH", { timeStyle: "short" })}
                          </div>
                        </>
                      ) : "—"}
                    </td>

                    <td style={styles.td}>{b.vehicleType || "—"}</td>

                    <td style={styles.td}>
                      <button
                        style={styles.btn}
                        onClick={() => navigate(`/admin/bookings/${b.id}`)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" style={{ ...styles.td, textAlign: 'center', opacity: 0.5 }}>
                    No bookings found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminBookings;