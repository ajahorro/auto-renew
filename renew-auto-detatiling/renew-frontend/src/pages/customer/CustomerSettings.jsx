import { useEffect, useState } from "react";
import CustomerSideBar from "../../components/CustomerSideBar";
import toast from "react-hot-toast";
import API from "../../api/axios";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { 
  User, 
  Lock, 
  Mail, 
  Phone, 
  Save, 
  Eye, 
  EyeOff
} from "lucide-react";

const CustomerSettings = () => {
  const { theme, setThemeMode } = useTheme();
  const { user, updateUser } = useAuth();

  const [activeTab, setActiveTab] = useState("account");

  const [profile, setProfile] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    notifyEmail: user?.notifyEmail ?? false
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
          notifyEmail: res.data.user.notifyEmail ?? false
        });
        updateUser(res.data.user);
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
    setSaving(true);
    try {
      await API.post("/auth/send-email-otp", { email: profile.email });
      setPendingEmail(profile.email);
      setOtpSent(true);
      toast.success("Verification code sent to your email");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send verification code");
    } finally {
      setSaving(false);
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
      setOtp("");
      loadUser();
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid verification code");
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
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

  const tabs = [
    { id: "account", label: "Account" },
    { id: "theme", label: "Theme" },
    { id: "terms", label: "Terms" }
  ];

  return (
    <div style={styles.page}>
      <CustomerSideBar active="settings" />
      <div style={styles.main}>
        <h1 style={styles.title}>Account Settings</h1>

        <div style={styles.tabContainer}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.activeTab : {})
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={styles.loading}>Loading...</p>
        ) : (
          <>
            {/* ACCOUNT TAB */}
            {activeTab === "account" && (
              <div style={styles.contentCard}>
                <h2 style={styles.sectionHeader}>Edit Profile</h2>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Full Name</label>
                    <div style={styles.inputBox}>
                      <User size={16} style={styles.inputIcon} />
                      <input 
                        placeholder="Full Name"
                        style={styles.input}
                        value={profile.fullName}
                        onChange={(e) => setProfile(p => ({ ...p, fullName: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Phone Number</label>
                    <div style={styles.inputBox}>
                      <Phone size={16} style={styles.inputIcon} />
                      <input 
                        placeholder="Phone Number"
                        style={styles.input}
                        value={profile.phone}
                        onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div style={{...styles.formGroup, gridColumn: "span 2"}}>
                    <label style={styles.label}>Email Address</label>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <div style={{...styles.inputBox, flex: 1}}>
                        <Mail size={16} style={styles.inputIcon} />
                        <input 
                          placeholder="Email"
                          style={{
                            ...styles.input, 
                            opacity: (otpSent) ? 0.7 : 1,
                            cursor: (otpSent) ? "not-allowed" : "text"
                          }}
                          value={profile.email}
                          onChange={(e) => !otpSent && setProfile(p => ({ ...p, email: e.target.value }))}
                          disabled={otpSent}
                        />
                      </div>
                      {!otpSent ? (
                        <button style={styles.secondaryBtn} onClick={sendEmailOtp} disabled={saving}>Verify</button>
                      ) : (
                        <button style={{...styles.secondaryBtn, background: "#64748b"}} onClick={() => { setOtpSent(false); setOtp(""); }}>Cancel</button>
                      )}
                    </div>
                  </div>
                </div>

                {otpSent && (
                  <div style={styles.otpBox}>
                    <p style={styles.otpText}>A verification code was sent to <strong>{pendingEmail}</strong></p>
                    <div style={styles.otpInputGroup}>
                      <input 
                        placeholder="000000"
                        style={styles.otpInput}
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                      />
                      <button style={styles.otpVerifyBtn} onClick={verifyEmailOtp} disabled={saving}>Verify Code</button>
                    </div>
                  </div>
                )}

                <button style={styles.primaryBtn} onClick={saveProfile} disabled={saving}>
                  <Save size={18} />
                  {saving ? "Saving..." : "Save Profile"}
                </button>

                <div style={styles.divider} />

                <h2 style={styles.sectionHeader}>Email Notifications</h2>
                <div style={styles.toggleRow}>
                  <div>
                    <strong style={{ display: "block", color: "var(--text-primary)" }}>Receive Emails</strong>
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Get booking updates and receipts via email</span>
                  </div>
                  <label style={styles.switch}>
                    <input 
                      type="checkbox" 
                      style={{ display: "none" }}
                      checked={profile.notifyEmail}
                      onChange={(e) => saveNotificationPrefs("notifyEmail", e.target.checked)}
                    />
                    <div style={{
                      ...styles.slider,
                      backgroundColor: profile.notifyEmail ? "var(--accent-blue)" : "#ccc"
                    }}>
                      <div style={{
                        position: "absolute",
                        height: "18px",
                        width: "18px",
                        left: profile.notifyEmail ? "24px" : "3px",
                        bottom: "3px",
                        backgroundColor: "white",
                        transition: ".4s",
                        borderRadius: "50%"
                      }} />
                    </div>
                  </label>
                </div>

                <div style={styles.divider} />

                <h2 style={styles.sectionHeader}>Security</h2>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Current Password</label>
                    <div style={styles.inputBox}>
                      <Lock size={16} style={styles.inputIcon} />
                      <input 
                        type={showCurrentPass ? "text" : "password"}
                        placeholder="Current Password"
                        style={styles.input}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                      <div onClick={() => setShowCurrentPass(!showCurrentPass)} style={styles.eyeBtn}>
                        {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </div>
                    </div>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>New Password</label>
                    <div style={styles.inputBox}>
                      <Lock size={16} style={styles.inputIcon} />
                      <input 
                        type={showNewPass ? "text" : "password"}
                        placeholder="New Password"
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
                <button style={{...styles.secondaryBtn, width: "100%", border: "1px solid var(--accent-blue)", color: "var(--accent-blue)"}} onClick={changePassword} disabled={saving}>
                  Update Password
                </button>
              </div>
            )}

            {/* THEME TAB */}
            {activeTab === "theme" && (
              <div style={styles.contentCard}>
                <h2 style={styles.sectionHeader}>Theme Settings</h2>
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
              <div style={styles.contentCard}>
                <h2 style={styles.sectionHeader}>Terms & Conditions</h2>
                <div style={styles.termsBox}>
                  <h3 style={styles.termsHeading}>1. Service Usage</h3>
                  <p style={styles.termsText}>RENEW Auto Detailing provides premium vehicle care services. By booking, you agree to our service standards and pricing.</p>
                  <h3 style={styles.termsHeading}>2. Cancellations</h3>
                  <p style={styles.termsText}>Cancellations must be requested at least 24 hours before the appointment. Late cancellations may be subject to a fee.</p>
                  <h3 style={styles.termsHeading}>3. Privacy</h3>
                  <p style={styles.termsText}>We value your privacy. Your data is used strictly for booking and notification purposes.</p>
                </div>
              </div>
            )}
          </>
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
    fontFamily: "Poppins, system-ui, sans-serif" 
  },
  main: { 
    marginLeft: "280px", 
    padding: "40px", 
    width: "100%", 
    color: "var(--text-primary)" 
  },
  title: { 
    marginBottom: "24px", 
    fontSize: "28px", 
    fontWeight: "700" 
  },
  tabContainer: {
    display: "flex",
    gap: "4px",
    marginBottom: "30px",
    background: "var(--bg-secondary)",
    padding: "6px",
    borderRadius: "12px",
    width: "fit-content"
  },
  tab: {
    padding: "12px 24px",
    borderRadius: "8px",
    border: "none",
    background: "transparent",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontWeight: "500",
    fontSize: "14px",
    transition: "all 0.2s ease"
  },
  activeTab: {
    background: "var(--card-bg)",
    color: "var(--text-primary)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
  },
  contentCard: {
    background: "var(--card-bg)",
    padding: "32px",
    borderRadius: "16px",
    border: "1px solid var(--border-color)",
    maxWidth: "700px"
  },
  sectionHeader: {
    fontSize: "20px",
    fontWeight: "600",
    marginBottom: "20px",
    color: "var(--text-primary)"
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    marginBottom: "20px"
  },
  formGroup: {
    display: "flex",
    flexDirection: "column"
  },
  label: {
    marginBottom: "8px",
    fontSize: "13px",
    fontWeight: "500",
    color: "var(--text-secondary)"
  },
  inputBox: { 
    position: "relative", 
    display: "flex", 
    alignItems: "center" 
  },
  inputIcon: { 
    position: "absolute", 
    left: "14px", 
    color: "var(--text-secondary)", 
    opacity: 0.5 
  },
  input: { 
    width: "100%", 
    padding: "12px 12px 12px 40px", 
    borderRadius: "10px", 
    border: "1px solid var(--border-color)",
    background: "var(--bg-tertiary)", 
    color: "var(--text-primary)", 
    outline: "none",
    fontSize: "14px",
    boxSizing: "border-box"
  },
  primaryBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    width: "100%",
    padding: "14px 28px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent-blue)",
    color: "#fff",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
    transition: "0.2s",
    marginTop: "20px"
  },
  secondaryBtn: {
    padding: "12px 20px",
    borderRadius: "10px",
    border: "1px solid var(--border-color)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
    transition: "0.2s"
  },
  eyeBtn: { 
    position: "absolute", 
    right: "14px", 
    cursor: "pointer", 
    color: "var(--text-secondary)" 
  },
  divider: {
    height: "1px",
    background: "var(--border-color)",
    margin: "32px 0"
  },
  helperText: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    marginBottom: "24px"
  },
  otpBox: { 
    marginTop: "20px", 
    padding: "20px", 
    background: "var(--bg-tertiary)", 
    borderRadius: "14px",
    border: "1px solid var(--border-color)"
  },
  otpText: { fontSize: "13px", marginBottom: "12px" },
  otpInputGroup: { display: "flex", gap: "10px" },
  otpInput: { 
    flex: 1, 
    padding: "12px", 
    borderRadius: "10px", 
    border: "1px solid var(--border-color)", 
    background: "var(--card-bg)", 
    color: "var(--text-primary)", 
    textAlign: "center", 
    letterSpacing: "4px", 
    fontWeight: "700" 
  },
  otpVerifyBtn: { 
    padding: "0 20px", 
    borderRadius: "10px", 
    border: "none", 
    background: "#22c55e", 
    color: "white", 
    fontWeight: "600", 
    cursor: "pointer" 
  },
  themeGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" },
  themeCard: { 
    padding: "16px", 
    borderRadius: "14px", 
    border: "2px solid var(--border-color)", 
    cursor: "pointer", 
    textAlign: "center", 
    display: "flex", 
    flexDirection: "column", 
    gap: "12px",
    transition: "0.2s"
  },
  themeCardActive: { borderColor: "var(--accent-blue)", background: "rgba(59, 130, 246, 0.1)" },
  themePreview: { height: "60px", borderRadius: "8px" },
  termsBox: { 
    background: "var(--bg-secondary)", 
    padding: "24px", 
    borderRadius: "12px" 
  },
  termsHeading: { 
    fontSize: "16px", 
    fontWeight: "600", 
    marginBottom: "8px", 
    marginTop: "20px" 
  },
  termsText: { 
    fontSize: "14px", 
    color: "var(--text-secondary)", 
    lineHeight: "1.6", 
    marginBottom: "12px" 
  },
  toggleRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  switch: { position: "relative", display: "inline-block", width: "46px", height: "24px" },
  slider: { 
    position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0, 
    backgroundColor: "#ccc", transition: ".4s", borderRadius: "24px" 
  },
  loading: { fontSize: "14px", color: "var(--text-secondary)" }
};

export default CustomerSettings;
