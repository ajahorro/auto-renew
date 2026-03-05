import { useState, useContext } from "react";
import api from "../api/apiClient";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Login = () => {

  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {

      const res = await api.post("/auth/login", {
        email,
        password
      });

      login(res.data);

      const role = res.data.user.role;

      if (role === "ADMIN" || role === "SUPER_ADMIN") {
        navigate("/admin");
      } else if (role === "STAFF") {
        navigate("/staff");
      } else {
        navigate("/customer");
      }

    } catch (err) {
      alert("Login failed");
    }
  };

  return (
    <div>

      <h2>Login</h2>

      <form onSubmit={handleSubmit}>

        <input
          placeholder="Email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />

        <button type="submit">Login</button>

      </form>

    </div>
  );
};

export default Login;