import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/axios";
import "../../App.css";

const AdminUsers = () => {

  const navigate = useNavigate();

  // Refund summary — values from backend directly, no frontend computation
  const [pendingCount, setPendingCount] = useState(null);
  const [pendingTotal, setPendingTotal] = useState(null);
  const [refundLoading, setRefundLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get("/refunds/pending");
        setPendingCount(res.data.pendingCount);
        setPendingTotal(res.data.pendingTotal);
      } catch {
        setPendingCount(null);
        setPendingTotal(null);
      } finally {
        setRefundLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  return (

    <div className="dashboard-container">

      {/* Sidebar */}

      <div className="sidebar">

        <h2>RENEW ADMIN</h2>

        <a onClick={()=>navigate("/admin")}>
          Dashboard
        </a>

        <a onClick={()=>navigate("/admin/bookings")}>
          Booking Management
        </a>

        <a onClick={()=>navigate("/admin/analytics")}>
          Analytics
        </a>

        <a style={{fontWeight:"bold"}}>
          Users
        </a>

        <a onClick={()=>navigate("/admin/settings")}>
          Settings
        </a>

        <div style={{flex:1}}></div>

        <a
          onClick={()=>{
            localStorage.removeItem("token");
            navigate("/login");
          }}
          style={{color:"#ff6b6b"}}
        >
          Logout
        </a>

      </div>

      {/* Main */}

      <div className="dashboard-main">

        <h1>USER MANAGEMENT</h1>

        <div className="card" style={{marginTop:"20px"}}>

          <p>
            This page will allow admins to manage staff,
            customers, and other system users.
          </p>

          <p style={{marginTop:"10px"}}>
            Future features here will include:
          </p>

          <ul style={{marginTop:"10px"}}>

            <li>View all users</li>

            <li>Change user roles (Admin / Staff / Customer)</li>

            <li>Deactivate accounts</li>

          </ul>

        </div>

        {/* Refund Summary Panel — render-only, backend-provided values */}
        <div className="card" style={{marginTop:"20px", borderLeft: "4px solid #f59e0b"}}>
          <h3 style={{marginBottom: "12px", fontSize: "16px", fontWeight: 700}}>
            Pending Refunds
          </h3>
          {refundLoading ? (
            <p style={{color: "var(--text-secondary)", fontSize: "13px"}}>Loading...</p>
          ) : (
            <>
              <p style={{fontSize: "14px", marginBottom: "6px"}}>
                Pending Count: <strong>{pendingCount != null ? pendingCount : "—"}</strong>
              </p>
              {pendingTotal != null && (
                <p style={{fontSize: "14px", marginBottom: "12px"}}>
                  Estimated Total: <strong>₱{Number(pendingTotal).toLocaleString()}</strong>
                </p>
              )}
              <button
                onClick={() => navigate("/admin/refunds")}
                style={{
                  padding: "8px 16px",
                  background: "var(--accent-blue)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600
                }}
              >
                View Refunds →
              </button>
            </>
          )}
        </div>

      </div>

    </div>

  );

};

export default AdminUsers;