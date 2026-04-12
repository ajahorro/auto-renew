import { useNavigate } from "react-router-dom";
import "../../App.css";

const AdminUsers = () => {

  const navigate = useNavigate();

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

      </div>

    </div>

  );

};

export default AdminUsers;