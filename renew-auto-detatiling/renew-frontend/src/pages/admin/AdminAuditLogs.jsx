import { useEffect, useState } from "react";
import API from "../../api/axios";
import AdminLayout from "../../components/AdminLayout";
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Tag, 
  Info,
  ChevronRight,
  Database
} from "lucide-react";

const AdminAuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await API.get("/audit-logs");
      if (res.data.success) {
        setLogs(res.data.logs);
      }
    } catch (err) {
      console.log("Failed to load audit logs", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesType = !filterType || log.entityType === filterType;
    const matchesSearch = !search || 
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.details?.toLowerCase().includes(search.toLowerCase()) ||
      log.performer?.fullName?.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getActionColor = (action) => {
    switch (action) {
      case "CREATE": return "#22c55e";
      case "UPDATE": return "#3b82f6";
      case "DELETE": return "#ef4444";
      case "STATUS_CHANGE": return "#f59e0b";
      default: return "#94a3b8";
    }
  };

  const getEntityIcon = (type) => {
    switch (type) {
      case "Booking": return <Calendar size={18} />;
      case "User": return <User size={18} />;
      case "Payment": return <Tag size={18} />;
      default: return <Database size={18} />;
    }
  };

  return (
    <AdminLayout active="audit">
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>System Audit Trail</h1>
            <p style={styles.subtitle}>Track all administrative actions and system changes</p>
          </div>
          <button style={styles.refreshBtn} onClick={loadLogs}>
            <ClipboardList size={16} />
            Refresh Logs
          </button>
        </div>

        {/* FILTERS */}
        <div style={styles.filterBar}>
          <div style={styles.searchBox}>
            <Search size={18} style={styles.searchIcon} />
            <input 
              style={styles.searchInput}
              placeholder="Search by action, performer, or details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={styles.filterGroup}>
            <Filter size={18} style={styles.filterIcon} />
            <select 
              style={styles.select}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">All Entities</option>
              <option value="Booking">Bookings</option>
              <option value="User">Users</option>
              <option value="Payment">Payments</option>
              <option value="Settings">Settings</option>
            </select>
          </div>
        </div>

        {/* LOG LIST */}
        <div style={styles.logCard}>
          {loading ? (
            <div style={styles.loadingState}>
              <div style={styles.spinner}></div>
              <p>Fetching activity logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={styles.emptyState}>
              <Info size={48} color="var(--text-secondary)" />
              <p>No activity logs found matching your criteria.</p>
            </div>
          ) : (
            <div style={styles.logList}>
              {filteredLogs.map(log => (
                <div 
                  key={log.id} 
                  style={styles.logRow}
                  onClick={() => setSelectedLog(log)}
                >
                  <div style={{...styles.entityIcon, background: `${getActionColor(log.action)}20`, color: getActionColor(log.action)}}>
                    {getEntityIcon(log.entityType)}
                  </div>

                  <div style={styles.logContent}>
                    <div style={styles.logMainRow}>
                      <span style={{...styles.actionBadge, background: getActionColor(log.action)}}>
                        {log.action}
                      </span>
                      <span style={styles.performer}>
                        Performed by <strong>{log.performer?.fullName || "System"}</strong>
                      </span>
                      <span style={styles.timestamp}>
                        {new Date(log.createdAt).toLocaleString("en-PH", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    </div>
                    <p style={styles.details}>{log.details || `Modified ${log.entityType} #${log.entityId}`}</p>
                  </div>

                  <ChevronRight size={18} style={styles.chevron} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LOG DETAIL MODAL */}
        {selectedLog && (
          <div style={styles.modalOverlay} onClick={() => setSelectedLog(null)}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3>Activity Detail</h3>
                <button style={styles.closeBtn} onClick={() => setSelectedLog(null)}>×</button>
              </div>
              
              <div style={styles.modalBody}>
                <div style={styles.modalInfoGrid}>
                  <div style={styles.modalInfoItem}>
                    <label>Action</label>
                    <span style={{color: getActionColor(selectedLog.action)}}>{selectedLog.action}</span>
                  </div>
                  <div style={styles.modalInfoItem}>
                    <label>Entity</label>
                    <span>{selectedLog.entityType} (#{selectedLog.entityId})</span>
                  </div>
                  <div style={styles.modalInfoItem}>
                    <label>Performer</label>
                    <span>{selectedLog.performer?.fullName} ({selectedLog.performer?.role})</span>
                  </div>
                  <div style={styles.modalInfoItem}>
                    <label>Time</label>
                    <span>{new Date(selectedLog.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div style={styles.detailBox}>
                  <label>Full Description</label>
                  <p>{selectedLog.details}</p>
                </div>

                {(selectedLog.oldValue || selectedLog.newValue) && (
                  <div style={styles.diffSection}>
                    <label>Data Changes</label>
                    <div style={styles.diffGrid}>
                      <div style={styles.diffCol}>
                        <span style={styles.diffLabel}>Previous State</span>
                        <pre style={styles.json}>
                          {selectedLog.oldValue && typeof selectedLog.oldValue === 'string' 
                            ? JSON.stringify(JSON.parse(selectedLog.oldValue), null, 2) 
                            : JSON.stringify(selectedLog.oldValue || {}, null, 2)}
                        </pre>
                      </div>
                      <div style={styles.diffCol}>
                        <span style={styles.diffLabel}>New State</span>
                        <pre style={{...styles.json, color: "#22c55e"}}>
                          {selectedLog.newValue && typeof selectedLog.newValue === 'string' 
                            ? JSON.stringify(JSON.parse(selectedLog.newValue), null, 2) 
                            : JSON.stringify(selectedLog.newValue || {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px"
  },
  title: {
    fontSize: "28px",
    fontWeight: "800",
    color: "#fff",
    margin: 0
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "14px",
    margin: "4px 0 0 0"
  },
  refreshBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 18px",
    borderRadius: "10px",
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#f8fafc",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
    transition: "0.2s"
  },
  filterBar: {
    display: "flex",
    gap: "16px",
    marginBottom: "24px"
  },
  searchBox: {
    flex: 1,
    position: "relative",
    display: "flex",
    alignItems: "center"
  },
  searchIcon: {
    position: "absolute",
    left: "14px",
    color: "#64748b"
  },
  searchInput: {
    width: "100%",
    padding: "12px 12px 12px 44px",
    borderRadius: "12px",
    background: "#0f172a",
    border: "1px solid #1e293b",
    color: "#fff",
    outline: "none"
  },
  filterGroup: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    minWidth: "200px"
  },
  filterIcon: {
    position: "absolute",
    left: "14px",
    color: "#64748b",
    pointerEvents: "none"
  },
  select: {
    width: "100%",
    padding: "12px 12px 12px 44px",
    borderRadius: "12px",
    background: "#0f172a",
    border: "1px solid #1e293b",
    color: "#fff",
    outline: "none",
    appearance: "none",
    cursor: "pointer"
  },
  logCard: {
    background: "#0f172a",
    borderRadius: "16px",
    border: "1px solid #1e293b",
    overflow: "hidden"
  },
  logList: {
    display: "flex",
    flexDirection: "column"
  },
  logRow: {
    display: "flex",
    alignItems: "center",
    padding: "18px 24px",
    borderBottom: "1px solid #1e293b",
    cursor: "pointer",
    transition: "0.2s"
  },
  entityIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginRight: "20px",
    flexShrink: 0
  },
  logContent: {
    flex: 1
  },
  logMainRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "4px"
  },
  actionBadge: {
    padding: "2px 8px",
    borderRadius: "6px",
    fontSize: "10px",
    fontWeight: "800",
    color: "#fff"
  },
  performer: {
    fontSize: "14px",
    color: "#94a3b8"
  },
  timestamp: {
    fontSize: "12px",
    color: "#64748b",
    marginLeft: "auto"
  },
  details: {
    fontSize: "14px",
    color: "#f1f5f9",
    margin: 0,
    fontWeight: "500"
  },
  chevron: {
    color: "#64748b",
    opacity: 0.3,
    marginLeft: "16px"
  },
  loadingState: {
    padding: "80px",
    textAlign: "center",
    color: "#94a3b8"
  },
  spinner: {
    width: "32px",
    height: "32px",
    border: "3px solid #1e293b",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    margin: "0 auto 16px",
    animation: "spin 1s linear infinite"
  },
  emptyState: {
    padding: "80px",
    textAlign: "center",
    color: "#94a3b8",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px"
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    backdropFilter: "blur(4px)"
  },
  modal: {
    background: "#020617",
    width: "90%",
    maxWidth: "800px",
    borderRadius: "20px",
    border: "1px solid #1e293b",
    maxHeight: "90vh",
    overflowY: "auto"
  },
  modalHeader: {
    padding: "24px",
    borderBottom: "1px solid #1e293b",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: "24px",
    cursor: "pointer"
  },
  modalBody: {
    padding: "24px"
  },
  modalInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "20px",
    marginBottom: "32px",
    padding: "20px",
    background: "#0f172a",
    borderRadius: "14px"
  },
  modalInfoItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    "& label": {
      fontSize: "11px",
      textTransform: "uppercase",
      color: "#64748b",
      letterSpacing: "0.5px"
    },
    "& span": {
      fontWeight: "600",
      fontSize: "14px",
      color: "#f8fafc"
    }
  },
  detailBox: {
    marginBottom: "32px",
    "& label": {
      display: "block",
      fontSize: "12px",
      fontWeight: "700",
      marginBottom: "8px",
      color: "#64748b"
    },
    "& p": {
      color: "#f1f5f9",
      margin: 0
    }
  },
  diffSection: {
    marginTop: "32px"
  },
  diffGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px"
  },
  diffCol: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  diffLabel: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#64748b"
  },
  json: {
    background: "#000",
    padding: "16px",
    borderRadius: "12px",
    fontSize: "12px",
    overflow: "auto",
    margin: 0,
    color: "#94a3b8",
    lineHeight: 1.5
  }
};

export default AdminAuditLogs;
