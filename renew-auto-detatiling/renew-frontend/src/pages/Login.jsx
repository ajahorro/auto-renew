import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../api/axios";
import toast from "react-hot-toast";

function Login() {

  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await API.post("/auth/login", {
        email,
        password
      });

      const data = res?.data;

      // Check if data exists and specifically contains the token
      if (data && data.success && data.token) {
        // We pass the raw token string directly to the login function

        console.log(data.token);
        
        login(data.token, data.user); 
        toast.success("Welcome back");

        const role = (data.user.role || "").toUpperCase();
        if (role === "ADMIN" || role === "SUPER_ADMIN") {
          navigate("/admin");
        } else if (role === "STAFF") {
          navigate("/staff");
        } else {
          navigate("/customer");
        }
      } else {
        throw new Error(data?.message || "Login failed");
      }
    } catch (err) {
      console.error("Login error:", err);
      const msg = err.response?.data?.message || err.message || "Login failed";
      setError(msg); // This ensures the error actually shows on your UI
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };
  
  return (

    <div style={styles.page}>

      <div style={styles.card}>

        <h1 style={styles.title}>RENEW</h1>

        <p style={styles.subtitle}>
          Auto Detailing Management System
        </p>

        <form onSubmit={handleLogin} style={styles.form}>

          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            required
          />

          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            required
          />

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <button style={styles.button} disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>

        </form>

        <p style={styles.registerText}>
          Don't have an account?
          <span
            style={styles.registerLink}
            onClick={()=>navigate("/register")}
          >
            Register
          </span>
        </p>

      </div>

    </div>

  );

}

const styles = {

  page:{
    height:"100vh",
    display:"flex",
    justifyContent:"center",
    alignItems:"center",
    background:"linear-gradient(135deg,#0f172a,#1e293b,#020617)",
    fontFamily:"Poppins, system-ui, sans-serif"
  },

  card:{
    width:"360px",
    padding:"40px",
    borderRadius:"18px",
    background:"rgba(255,255,255,0.05)",
    backdropFilter:"blur(10px)",
    boxShadow:"0 20px 40px rgba(0,0,0,0.4)",
    textAlign:"center"
  },

  title:{
    color:"#e2e8f0",
    fontWeight:"600",
    marginBottom:"6px",
    letterSpacing:"1px"
  },

  subtitle:{
    color:"#94a3b8",
    fontSize:"14px",
    marginBottom:"28px"
  },

  form:{
    display:"flex",
    flexDirection:"column",
    gap:"14px"
  },

  input:{
    padding:"12px",
    borderRadius:"10px",
    border:"none",
    outline:"none",
    background:"#0f172a",
    color:"#e2e8f0",
    fontSize:"14px"
  },

  button:{
    marginTop:"10px",
    padding:"12px",
    borderRadius:"10px",
    border:"none",
    background:"#38bdf8",
    color:"#020617",
    fontWeight:"600",
    cursor:"pointer"
  },

  error:{
    color:"#f87171",
    fontSize:"13px"
  },

  registerText:{
    marginTop:"20px",
    color:"#94a3b8",
    fontSize:"14px"
  },

  registerLink:{
    marginLeft:"6px",
    color:"#38bdf8",
    cursor:"pointer"
  }

};

export default Login;