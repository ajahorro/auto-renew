import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import API from "../api/axios";

function Register() {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [cooldown, setCooldown] = useState(false);

  const isDark = theme === "system" || theme === "dark";
  const bgCard = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.9)";
  const textPrimary = isDark ? "#e2e8f0" : "#0f172a";
  const textSecondary = isDark ? "#94a3b8" : "#64748b";
  const accentColor = isDark ? "#38bdf8" : "#2563eb";
  const inputBg = isDark ? "#0f172a" : "#ffffff";
  const errorColor = isDark ? "#f87171" : "#dc2626";
  const successColor = isDark ? "#4ade80" : "#16a34a";
  const borderColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";

  const startResendTimer = () => {
    setResendTimer(60);
    setCooldown(true);
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setCooldown(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleInitiate = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await API.post("/auth/register/initiate", { 
        fullName, email, password, phone 
      });

      setStep(2);
      startResendTimer();
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await API.post("/auth/register/verify-otp", { email, otp });
      const data = res.data;

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/customer-dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown) return;
    setError("");
    setLoading(true);

    try {
      await API.post("/auth/register/resend-otp", { email });
      setOtp("");
      startResendTimer();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setOtp("");
    setError("");
  };

  const handleChangeEmail = () => {
    setStep(1);
    setOtp("");
    setError("");
  };

  return (
    <div style={{
      ...styles.page,
      background: `linear-gradient(135deg, ${isDark ? "#0f172a" : "#e2e8f0"}, ${isDark ? "#1e293b" : "#f8fafc"}, ${isDark ? "#020617" : "#f1f5f9"})`
    }}>
      <div style={{
        ...styles.card,
        background: bgCard,
        backdropFilter: isDark ? "blur(10px)" : "none",
        boxShadow: isDark ? "0 20px 40px rgba(0,0,0,0.4)" : "0 10px 30px rgba(0,0,0,0.1)"
      }}>
        <h1 style={{ ...styles.title, color: textPrimary }}>
          {step === 1 ? "Create Account" : "Verify Email"}
        </h1>

        <p style={{ ...styles.subtitle, color: textSecondary }}>
          {step === 1
            ? "Join RENEW Auto Detailing"
            : `Enter the code sent to ${email}`
          }
        </p>

        {error && (
          <div style={{ ...styles.error, color: errorColor }}>
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleInitiate} style={styles.form}>
            <input
              style={{ ...styles.input, background: inputBg, color: textPrimary, borderColor }}
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <input
              style={{ ...styles.input, background: inputBg, color: textPrimary, borderColor }}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              style={{ ...styles.input, background: inputBg, color: textPrimary, borderColor }}
              type="tel"
              placeholder="Phone (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <input
              style={{ ...styles.input, background: inputBg, color: textPrimary, borderColor }}
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />

            <button
              style={{ ...styles.button, background: accentColor }}
              disabled={loading}
            >
              {loading ? "Sending code..." : "Continue"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} style={styles.form}>
            <input
              style={{
                ...styles.input,
                background: inputBg,
                color: textPrimary,
                borderColor,
                textAlign: "center",
                letterSpacing: "8px",
                fontSize: "20px"
              }}
              type="text"
              placeholder="Enter 6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              required
            />

            <button
              style={{ ...styles.button, background: successColor }}
              disabled={loading || otp.length !== 6}
            >
              {loading ? "Verifying..." : "Create Account"}
            </button>

            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown || loading}
                style={{
                  ...styles.resendBtn,
                  color: cooldown ? textSecondary : accentColor,
                  opacity: cooldown ? 0.5 : 1
                }}
              >
                {cooldown ? `Resend in ${resendTimer}s` : "Resend Code"}
              </button>

              <button
                type="button"
                onClick={handleChangeEmail}
                style={{
                  ...styles.resendBtn,
                  color: textSecondary
                }}
              >
                Change Email
              </button>
            </div>
          </form>
        )}

        <p style={{ ...styles.loginText, color: textSecondary }}>
          {step === 1 ? (
            <>
              Already have an account?
              <span
                style={{ ...styles.loginLink, color: accentColor }}
                onClick={() => navigate("/login")}
              >
                Login
              </span>
            </>
          ) : (
            <span
              style={{ ...styles.loginLink, color: accentColor }}
              onClick={handleBack}
            >
              Back to registration
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Poppins, system-ui, sans-serif"
  },

  card: {
    width: "380px",
    padding: "40px",
    borderRadius: "18px",
    textAlign: "center"
  },

  title: {
    fontWeight: "600",
    marginBottom: "6px"
  },

  subtitle: {
    fontSize: "14px",
    marginBottom: "26px"
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px"
  },

  input: {
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid",
    outline: "none",
    fontSize: "14px"
  },

  button: {
    marginTop: "10px",
    padding: "12px",
    borderRadius: "10px",
    border: "none",
    color: "#020617",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px"
  },

  resendBtn: {
    flex: 1,
    padding: "10px",
    background: "transparent",
    border: "none",
    fontWeight: "500",
    cursor: "pointer",
    fontSize: "13px"
  },

  error: {
    fontSize: "13px",
    marginBottom: "15px",
    padding: "10px",
    borderRadius: "8px",
    background: "rgba(255,0,0,0.1)"
  },

  loginText: {
    marginTop: "20px",
    fontSize: "14px"
  },

  loginLink: {
    marginLeft: "6px",
    cursor: "pointer",
    fontWeight: "500"
  }
};

export default Register;
