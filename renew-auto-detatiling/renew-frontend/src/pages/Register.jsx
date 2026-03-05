import { useState } from "react";
import api from "../api/apiClient";
import { useNavigate } from "react-router-dom";

const Register = () => {

  const navigate = useNavigate();

  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [fullName,setFullName] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {

      await api.post("/auth/register", {
        email,
        password,
        fullName
      });

      alert("Account created");
      navigate("/login");

    } catch {
      alert("Register failed");
    }
  };

  return (
    <div>

      <h2>Register</h2>

      <form onSubmit={handleSubmit}>

        <input
          placeholder="Full Name"
          value={fullName}
          onChange={(e)=>setFullName(e.target.value)}
        />

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

        <button type="submit">Register</button>

      </form>

    </div>
  );
};

export default Register;