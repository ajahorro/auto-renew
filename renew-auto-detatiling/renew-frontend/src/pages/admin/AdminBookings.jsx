import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../../api/axios";
import AdminSideBar from "../../components/AdminSideBar";
import BookingStatusBadge from "../../components/BookingStatusBadge";
import PaymentStatusBadge from "../../components/PaymentStatusBadge";
import ServiceStatusBadge from "../../components/ServiceStatusBadge";
import { 
  Search, 
  Filter, 
  ExternalLink, 
  Calendar, 
  User, 
  MoreVertical 
} from "lucide-react";

const AdminBookings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterStatus = searchParams.get("status");

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");


  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchParams.get("status")) params.append("status", searchParams.get("status"));
      if (searchParams.get("serviceStatus")) params.append("serviceStatus", searchParams.get("serviceStatus"));
      if (searchParams.get("paymentStatus")) params.append("paymentStatus", searchParams.get("paymentStatus"));
      if (searchTerm) params.append("searchTerm", searchTerm);
      params.append("includeTotal", "false");
      
      const url = `/bookings/admin?${params.toString()}`;
      const res = await API.get(url);
      setBookings(res.data.bookings || res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchParams, searchTerm]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadBookings();
    }, 500); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [loadBookings]);

  const filteredBookings = bookings;

  return (
    <div style={styles.page}>
      <AdminSideBar active="bookings" />
      <div style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.title}>
            {filterStatus ? `${filterStatus} Bookings` : "All Bookings"}
          </h1>
          <div style={styles.actions}>
            <div style={styles.searchBox}>
              <Search size={18} style={styles.searchIcon} />
              <input 
                placeholder="Search name, ID, vehicle or status..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div style={styles.loading}>Loading bookings...</div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>CUSTOMER</th>
                  <th style={styles.th}>VEHICLE</th>
                  <th style={styles.th}>DATE & TIME</th>
                  <th style={styles.th}>SERVICE STATUS</th>
                  <th style={styles.th}>PAYMENT</th>
                  <th style={styles.th}>AMOUNT</th>
                  <th style={styles.th}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b) => (
                  <tr key={b.id} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={styles.idBadge}>#{b.id.toString().padStart(4, '0')}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.customerInfo}>
                        <div style={styles.avatar}>{b.customer?.fullName?.[0]}</div>
                        <div style={styles.nameGroup}>
                          <span style={styles.name}>{b.customer?.fullName}</span>
                          <span style={styles.phone}>{b.contactNumber || b.customer?.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.vehicleGroup}>
                        <span style={styles.vehicleType}>{b.vehicleType}</span>
                        <span style={styles.plate}>{b.plateNumber}</span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.dateGroup}>
                        <span style={styles.date}>{new Date(b.appointmentStart).toLocaleDateString()}</span>
                        <span style={styles.time}>{new Date(b.appointmentStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td style={styles.td}>
                       <ServiceStatusBadge status={b.serviceStatus} />
                    </td>
                    <td style={styles.td}>
                      <PaymentStatusBadge status={b.paymentStatus} />
                    </td>
                    <td style={styles.td}>
                      <span style={styles.amount}>₱{Number(b.totalAmount).toLocaleString()}</span>
                    </td>
                    <td style={styles.td}>
                      <button 
                        style={styles.viewBtn}
                        onClick={() => navigate(`/admin/bookings/${b.id}`)}
                      >
                        <ExternalLink size={16} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredBookings.length === 0 && (
              <div style={styles.emptyState}>No bookings found matching your search.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  page: {
    display: "flex",
    background: "var(--bg-primary)",
    minHeight: "100vh",
    fontFamily: "Poppins, system-ui"
  },
  main: {
    marginLeft: "280px",
    padding: "40px",
    width: "100%",
    color: "var(--text-primary)"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "30px"
  },
  title: {
    fontSize: "28px",
    fontWeight: "800",
    margin: 0
  },
  searchBox: {
    position: "relative",
    width: "300px"
  },
  searchIcon: {
    position: "absolute",
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "var(--text-secondary)"
  },
  searchInput: {
    width: "100%",
    padding: "10px 12px 10px 40px",
    borderRadius: "10px",
    border: "1px solid var(--border-color)",
    background: "var(--card-bg)",
    color: "var(--text-primary)",
    outline: "none"
  },
  loading: {
    textAlign: "center",
    padding: "100px",
    color: "var(--text-secondary)"
  },
  tableWrapper: {
    background: "var(--card-bg)",
    borderRadius: "16px",
    border: "1px solid var(--border-color)",
    overflow: "hidden"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left"
  },
  th: {
    padding: "16px 20px",
    background: "rgba(255,255,255,0.02)",
    color: "var(--text-secondary)",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    borderBottom: "1px solid var(--border-color)"
  },
  tr: {
    borderBottom: "1px solid var(--border-color)",
    transition: "0.2s"
  },
  td: {
    padding: "16px 20px",
    verticalAlign: "middle"
  },
  idBadge: {
    fontSize: "12px",
    fontWeight: "700",
    color: "var(--accent-blue)",
    background: "rgba(56, 189, 248, 0.1)",
    padding: "4px 8px",
    borderRadius: "6px"
  },
  customerInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px"
  },
  avatar: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    background: "var(--accent-blue)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700"
  },
  nameGroup: {
    display: "flex",
    flexDirection: "column"
  },
  name: {
    fontSize: "14px",
    fontWeight: "600"
  },
  phone: {
    fontSize: "12px",
    color: "var(--text-secondary)"
  },
  vehicleGroup: {
    display: "flex",
    flexDirection: "column"
  },
  vehicleType: {
    fontSize: "14px",
    fontWeight: "500"
  },
  plate: {
    fontSize: "12px",
    color: "var(--text-secondary)"
  },
  dateGroup: {
    display: "flex",
    flexDirection: "column"
  },
  date: {
    fontSize: "14px",
    fontWeight: "500"
  },
  time: {
    fontSize: "12px",
    color: "var(--accent-blue)"
  },
  amount: {
    fontWeight: "700",
    color: "var(--text-primary)"
  },
  viewBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 14px",
    borderRadius: "8px",
    border: "none",
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "0.2s"
  },
  emptyState: {
    padding: "40px",
    textAlign: "center",
    color: "var(--text-secondary)"
  }
};

export default AdminBookings;
