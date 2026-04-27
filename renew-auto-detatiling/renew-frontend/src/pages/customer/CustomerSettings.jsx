import { useEffect, useState } from "react";
import CustomerSideBar from "../../components/CustomerSideBar";
import toast from "react-hot-toast";
import API from "../../api/axios";
import { useTheme } from "../../context/ThemeContext";
import { 
  User, 
  Lock, 
  Palette, 
  ShieldCheck, 
  Mail, 
  Phone, 
  Save, 
  Eye, 
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  X
} from "lucide-react";

const CustomerSettings = () => {
  const { theme, setThemeMode } = useTheme();
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [activeTab, setActiveTab] = useState("account");

  const [profile, setProfile] = useState({
    fullName: storedUser.fullName || "",
    email: storedUser.email || "",
    phone: storedUser.phone || "",
    notifyEmail: storedUser.notifyEmail ?? false,
    notifyWeb: storedUser.notifyWeb ?? true
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailChanged, setEmailChanged] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  const saveNotificationPrefs = async (field, value) => {
    try {
      await API.patch("/users/me", { [field]: value });
      setProfile(p => ({ ...p, [field]: value }));
      toast.success("Notification preference updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update");
    }
  };

  const loadUser = async () => {
    try {
      const res = await API.get("/me");
      if (res.data.user) {
        setProfile({
          fullName: res.data.user.fullName || "",
          email: res.data.user.email || "",
          phone: res.data.user.phone || "",
          notifyEmail: res.data.user.notifyEmail ?? false,
          notifyWeb: res.data.user.notifyWeb ?? true
        });
        localStorage.setItem("user", JSON.stringify(res.data.user));
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const sendEmailOtp = async () => {
    if (!profile.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    try {
      await API.post("/auth/send-email-otp", { email: profile.email });
      setPendingEmail(profile.email);
      setOtpSent(true);
      toast.success("Verification code sent to your email");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send verification code");
    }
  };

  const verifyEmailOtp = async () => {
    if (!otp || otp.length < 6) {
      toast.error("Please enter the 6-digit verification code");
      return;
    }
    setSaving(true);
    try {
      await API.post("/auth/verify-email-otp", { email: pendingEmail, otp });
      toast.success("Email verified successfully!");
      setOtpSent(false);
      setEmailChanged(false);
      setOtp("");
      loadUser();
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid verification code");
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = async () => {
    setSaving(true);
    try {
      await API.patch("/users/me", {
        fullName: profile.fullName,
        phone: profile.phone
      });
      toast.success("Profile updated successfully");
      loadUser();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Both passwords are required");
      return;
    }
    setSaving(true);
    try {
      await API.patch("/users/me/password", {
        currentPassword,
        newPassword
      });
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.page}>
      <CustomerSideBar active="settings" />
      <div style={styles.main}>
        <h1 style={styles.title}>Settings</h1>

        <div style={styles.container}>
          {/* TABS */}
          <div style={styles.tabs}>
            <button 
              style={{...styles.tab, ...(activeTab === "account" ? styles.tabActive : {})}}
              onClick={() => setActiveTab("account")}
            >
              <User size={18} />
              Account Settings
            </button>
            <button 
              style={{...styles.tab, ...(activeTab === "theme" ? styles.tabActive : {})}}
              onClick={() => setActiveTab("theme")}
            >
              <Palette size={18} />
              Theme
            </button>
            <button 
              style={{...styles.tab, ...(activeTab === "terms" ? styles.tabActive : {})}}
              onClick={() => setActiveTab("terms")}
            >
              <ShieldCheck size={18} />
              Terms
            </button>
          </div>

          <div style={styles.content}>
            {/* ACCOUNT SETTINGS TAB */}
            {activeTab === "account" && (
              <div style={{display: "flex", flexDirection: "column", gap: "24px"}}>
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Personal Information</h3>
                  <div style={styles.grid}>
                    <div style={styles.field}>
                      <label style={styles.label}>Full Name</label>
                      <div style={styles.inputBox}>
                        <User size={16} style={styles.inputIcon} />
                        <input 
                          style={styles.input}
                          value={profile.fullName}
                          onChange={(e) => setProfile({...profile, fullName: e.target.value})}
                        />
                      </div>
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Phone Number</label>
                      <div style={styles.inputBox}>
                        <Phone size={16} style={styles.inputIcon} />
                        <input 
                          style={styles.input}
                          value={profile.phone}
                          onChange={(e) => setProfile({...profile, phone: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{marginTop: "24px"}}>
                    <label style={styles.label}>Email Address</label>
                    <div style={styles.inputBox}>
                      <Mail size={16} style={styles.inputIcon} />
                      <input 
                        style={styles.input}
                        value={profile.email}
                        onChange={(e) => {
                          setProfile({...profile, email: e.target.value});
                          setEmailChanged(true);
                        }}
                      />
                      {profile.email === storedUser.email && (
                        <CheckCircle2 size={16} color="var(--accent-green)" style={{marginLeft: "10px"}} />
                      )}
                    </div>
                    {emailChanged && !otpSent && (
                      <button style={styles.verifyBtn} onClick={sendEmailOtp}>
                        Verify New Email
                      </button>
                    )}
                    {otpSent && (
                      <div style={styles.otpBox}>
                        <p style={styles.otpText}>A code was sent to <strong>{pendingEmail}</strong></p>
                        <div style={styles.otpInputGroup}>
                          <input 
                            placeholder="6-digit code"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0,6))}
                            style={styles.otpInput}
                          />
                          <button style={styles.otpVerifyBtn} onClick={verifyEmailOtp}>Verify</button>
                          <button style={styles.otpCancelBtn} onClick={() => setOtpSent(false)}><X size={16} /></button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button style={styles.saveBtn} onClick={updateProfile} disabled={saving}>
                    <Save size={18} />
                    {saving ? "Saving..." : "Save Profile"}
                  </button>
                </div>

                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Security & Notifications</h3>
                  <div style={{display: "flex", flexDirection: "column", gap: "24px"}}>
                    <div>
                      <h4 style={{fontSize: "14px", fontWeight: "600", marginBottom: "16px"}}>Change Password</h4>
                      <div style={styles.grid}>
                        <div style={styles.field}>
                          <label style={styles.label}>Current Password</label>
                          <div style={styles.inputBox}>
                            <Lock size={16} style={styles.inputIcon} />
                            <input 
                              type={showCurrentPass ? "text" : "password"}
                              style={styles.input}
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                            />
                            <div onClick={() => setShowCurrentPass(!showCurrentPass)} style={styles.eyeBtn}>
                              {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </div>
                          </div>
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>New Password</label>
                          <div style={styles.inputBox}>
                            <Lock size={16} style={styles.inputIcon} />
                            <input 
                              type={showNewPass ? "text" : "password"}
                              style={styles.input}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <div onClick={() => setShowNewPass(!showNewPass)} style={styles.eyeBtn}>
                              {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </div>
                          </div>
                        </div>
                      </div>
                      <button style={{...styles.saveBtn, marginTop: "12px"}} onClick={changePassword} disabled={saving}>
                        Update Password
                      </button>
                    </div>

                    <hr style={styles.hr} />

                    <div>
                      <h4 style={{fontSize: "14px", fontWeight: "600", marginBottom: "16px"}}>Preferences</h4>
                      <div style={styles.toggleRow}>
                        <div>
                          <p style={{fontWeight: "600", fontSize: "14px"}}>Email Notifications</p>
                          <p style={{fontSize: "12px", color: "var(--text-secondary)"}}>Receive booking updates & reminders</p>
                        </div>
                        <label style={styles.switch}>
                          <input 
                            type="checkbox" 
                            checked={profile.notifyEmail}
                            onChange={(e) => saveNotificationPrefs("notifyEmail", e.target.checked)}
                          />
                          <span style={{
                            ...styles.slider,
                            background: profile.notifyEmail ? "var(--accent-blue)" : "#ccc"
                          }}>
                            <span style={{
                              ...styles.sliderKnob,
                              left: profile.notifyEmail ? "24px" : "4px"
                            }} />
                          </span>
                        </label>
                      </div>
                      <div style={{...styles.toggleRow, marginTop: "16px"}}>
                        <div>
                          <p style={{fontWeight: "600", fontSize: "14px"}}>In-App Notifications</p>
                          <p style={{fontSize: "12px", color: "var(--text-secondary)"}}>Show notifications inside the dashboard</p>
                        </div>
                        <label style={styles.switch}>
                          <input 
                            type="checkbox" 
                            checked={profile.notifyWeb}
                            onChange={(e) => saveNotificationPrefs("notifyWeb", e.target.checked)}
                          />
                          <span style={{
                            ...styles.slider,
                            background: profile.notifyWeb ? "var(--accent-blue)" : "#ccc"
                          }}>
                            <span style={{
                              ...styles.sliderKnob,
                              left: profile.notifyWeb ? "24px" : "4px"
                            }} />
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* THEME TAB */}
            {activeTab === "theme" && (
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Appearance</h3>
                <p style={styles.helperText}>Personalize your dashboard experience.</p>
                <div style={styles.themeGrid}>
                  <div 
                    style={{...styles.themeCard, ...(theme === "system" ? styles.themeCardActive : {})}}
                    onClick={() => setThemeMode("system")}
                  >
                    <div style={{...styles.themePreview, background: "var(--bg-tertiary)"}} />
                    <span>System Default</span>
                  </div>
                  <div 
                    style={{...styles.themeCard, ...(theme === "light" ? styles.themeCardActive : {})}}
                    onClick={() => setThemeMode("light")}
                  >
                    <div style={{...styles.themePreview, background: "#f8fafc", border: "1px solid #e2e8f0"}} />
                    <span>Light Mode</span>
                  </div>
                  <div 
                    style={{...styles.themeCard, ...(theme === "dark" ? styles.themeCardActive : {})}}
                    onClick={() => setThemeMode("dark")}
                  >
                    <div style={{...styles.themePreview, background: "#0f172a"}} />
                    <span>Dark Mode</span>
                  </div>
                </div>
              </div>
            )}

            {/* TERMS TAB */}
            {activeTab === "terms" && (
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Terms of Service</h3>
                <div style={styles.termsBox}>
                  <h4 style={styles.termsHeading}>1. Service Usage</h4>
                  <p style={styles.termsText}>RENEW Auto Detailing provides premium vehicle care services. By booking, you agree to our service standards and pricing.</p>
                  <h4 style={styles.termsHeading}>2. Cancellations</h4>
                  <p style={styles.termsText}>Cancellations must be requested at least 24 hours before the appointment. Late cancellations may be subject to a fee.</p>
                  <h4 style={styles.termsHeading}>3. Privacy</h4>
                  <p style={styles.termsText}>We value your privacy. Your data is used strictly for booking and notification purposes.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: { display: "flex", background: "var(--bg-primary)", minHeight: "100vh", fontFamily: "Poppins, system-ui" },
  main: { marginLeft: "260px", padding: "40px", width: "100%", color: "var(--text-primary)" },
  title: { fontSize: "28px", fontWeight: "800", marginBottom: "32px" },
  container: { display: "flex", gap: "40px" },
  tabs: { width: "200px", display: "flex", flexDirection: "column", gap: "8px" },
  tab: { 
    display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "10px",
    border: "none", background: "transparent", color: "var(--text-secondary)", 
    cursor: "pointer", fontWeight: "600", transition: "0.2s", textAlign: "left"
  },
  tabActive: { background: "var(--card-bg)", color: "var(--accent-blue)", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" },
  content: { flex: 1 },
  card: { background: "var(--card-bg)", padding: "32px", borderRadius: "20px", border: "1px solid var(--border-color)" },
  cardTitle: { fontSize: "18px", fontWeight: "700", marginBottom: "24px" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" },
  field: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" },
  label: { fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)" },
  inputBox: { position: "relative", display: "flex", alignItems: "center" },
  inputIcon: { position: "absolute", left: "14px", color: "var(--text-secondary)", opacity: 0.5 },
  input: { 
    width: "100%", padding: "12px 12px 12px 40px", borderRadius: "10px", border: "1px solid var(--border-color)",
    background: "var(--bg-primary)", color: "var(--text-primary)", outline: "none"
  },
  eyeBtn: { position: "absolute", right: "14px", cursor: "pointer", color: "var(--text-secondary)" },
  hr: { margin: "32px 0", border: "none", borderTop: "1px solid var(--border-color)" },
  saveBtn: { 
    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
    marginTop: "24px", padding: "14px 28px", borderRadius: "12px", border: "none",
    background: "var(--accent-blue)", color: "white", fontWeight: "700", cursor: "pointer"
  },
  verifyBtn: { marginTop: "12px", padding: "8px 16px", borderRadius: "8px", border: "none", background: "rgba(56, 189, 248, 0.1)", color: "var(--accent-blue)", fontWeight: "600", cursor: "pointer" },
  otpBox: { marginTop: "20px", padding: "20px", background: "var(--bg-primary)", borderRadius: "14px" },
  otpText: { fontSize: "13px", marginBottom: "12px" },
  otpInputGroup: { display: "flex", gap: "10px" },
  otpInput: { flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--card-bg)", color: "var(--text-primary)", textAlign: "center", letterSpacing: "4px", fontWeight: "700" },
  otpVerifyBtn: { padding: "0 20px", borderRadius: "8px", border: "none", background: "var(--accent-green)", color: "white", fontWeight: "600", cursor: "pointer" },
  otpCancelBtn: { padding: "10px", borderRadius: "8px", border: "none", background: "var(--bg-tertiary)", color: "var(--text-primary)", cursor: "pointer" },
  themeGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginTop: "20px" },
  themeCard: { padding: "16px", borderRadius: "14px", border: "2px solid var(--border-color)", cursor: "pointer", textAlign: "center", display: "flex", flexDirection: "column", gap: "12px" },
  themeCardActive: { borderColor: "var(--accent-blue)", background: "rgba(56, 189, 248, 0.05)" },
  themePreview: { height: "60px", borderRadius: "8px" },
  termsBox: { padding: "20px", background: "var(--bg-primary)", borderRadius: "14px", border: "1px solid var(--border-color)" },
  termsHeading: { fontSize: "14px", fontWeight: "700", marginBottom: "8px", marginTop: "16px" },
  termsText: { fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6" },
  helperText: { fontSize: "14px", color: "var(--text-secondary)", marginBottom: "20px" },
  toggleRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  switch: { position: "relative", display: "inline-block", width: "46px", height: "24px" },
  slider: { 
    position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0, 
    transition: ".4s", borderRadius: "24px", display: "flex", alignItems: "center"
  },
  sliderKnob: {
    position: "absolute", height: "16px", width: "16px", borderRadius: "50%",
    background: "white", transition: ".4s"
  }
};

export default CustomerSettings;
