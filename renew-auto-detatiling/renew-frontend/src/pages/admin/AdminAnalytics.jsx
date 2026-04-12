import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import "../../App.css";

const AdminAnalytics = () => {

  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);

  /* =========================
     HANDLE LOGOUT
  ========================= */
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (


      <div className="dashboard-main">

        <h1>ADMIN ANALYTICS</h1>

        <div className="card" style={{marginTop:"20px"}}>

          <p>
            Analytics charts and reports will appear here.
          </p>

        </div>

      </div>

  );

};

export default AdminAnalytics;