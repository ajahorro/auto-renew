import { useEffect, useState } from "react";
import StaffSidebar from "../../components/StaffSidebar";
import API from "../../api/axios";
import toast from "react-hot-toast";
import { useTheme } from "../../context/ThemeContext";

const StaffSettings = () => {
  const { theme, setThemeMode } = useTheme();
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [activeTab, setActiveTab] = useState("profile");

  const [profile, setProfile] = useState({
    fullName: storedUser.fullName || "",
    email: storedUser.email || ""
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Email change states
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [emailStep, setEmailStep] = useState(1); // 1: Input Email, 2: OTP

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const profileRes = await API.get("/me");
      if (profileRes.data.user) {
        setProfile({
          fullName: profileRes.data.user.fullName || "",
          email: profileRes.data.user.email || ""
        });
        localStorage.setItem("user", JSON.stringify(profileRes.data.user));
      }
    } catch (err) {
      console.log("Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await API.patch("/users/me", profile);
      if (res.data.user) {
        localStorage.setItem("user", JSON.stringify(res.data.user));
        toast.success("Profile updated");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const requestEmailChange = async () => {
    if (!newEmail || !newEmail.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setSaving(true);
    try {
      await API.post("/auth/send-email-otp", { email: newEmail });
      toast.success("OTP sent to your new email");
      setOtpSent(true);
      setEmailStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setSaving(false);
    }
  };

  const verifyEmailChange = async () => {
    if (!otp) {
      toast.error("Enter OTP");
      return;
    }
    setSaving(true);
    try {
      await API.post("/auth/verify-email-otp", { email: newEmail, otp });
      toast.success("Email updated successfully");
      setProfile(p => ({ ...p, email: newEmail }));
      setIsChangingEmail(false);
      setOtpSent(false);
      setEmailStep(1);
      setNewEmail("");
      setOtp("");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Verification failed");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Fill both password fields");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      await API.patch("/users/me/password", { currentPassword, newPassword });
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const getThemeLabel = () => {
    if (theme === "system") return "System Default";
    if (theme === "light") return "Light Mode";
    return "Dark Mode";
  };

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "theme", label: "Theme" },
    { id: "terms", label: "Terms & Conditions" }
  ];

  return (
    <div style={pageStyles.page}>
      <StaffSidebar active="settings" />
      <div style={pageStyles.main}>
        <h1 style={pageStyles.title}>Settings</h1>

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
            {activeTab === "profile" && (
              <div style={styles.contentCard}>
                <h2 style={styles.sectionHeader}>Edit Profile</h2>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Full Name</label>
                    <input
                      placeholder="Full Name"
                      value={profile.fullName}
                      onChange={(e) => setProfile(p => ({ ...p, fullName: e.target.value }))}
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Email Address</label>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <input
                        placeholder="Email"
                        value={isChangingEmail ? newEmail : profile.email}
                        onChange={(e) => isChangingEmail && setNewEmail(e.target.value)}
                        disabled={!isChangingEmail || emailStep === 2}
                        style={{
                          ...styles.input, 
                          flex: 1,
                          opacity: (!isChangingEmail || emailStep === 2) ? 0.7 : 1,
                          cursor: (!isChangingEmail || emailStep === 2) ? "not-allowed" : "text"
                        }}
                      />
                      {!isChangingEmail ? (
                        <button 
                          style={{...styles.secondaryBtn, width: "auto", padding: "0 15px"}}
                          onClick={() => setIsChangingEmail(true)}
                        >
                          Change
                        </button>
                      ) : (
                        <button 
                          style={{...styles.dangerBtn, width: "auto", padding: "0 15px", background: "#64748b"}}
                          onClick={() => {
                            setIsChangingEmail(false);
                            setEmailStep(1);
                            setOtpSent(false);
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isChangingEmail && emailStep === 2 && (
                  <div style={{...styles.formGroup, marginTop: "20px"}}>
                    <label style={styles.label}>Enter OTP sent to {newEmail}</label>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <input
                        placeholder="6-digit OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        style={{...styles.input, flex: 1}}
                        maxLength={6}
                      />
                      <button 
                        style={{...styles.primaryBtn, width: "auto", padding: "0 20px"}}
                        onClick={verifyEmailChange}
                        disabled={saving}
                      >
                        Verify & Update
                      </button>
                    </div>
                  </div>
                )}

                {!isChangingEmail ? (
                  <button style={styles.primaryBtn} onClick={saveProfile} disabled={saving}>
                    {saving ? "Saving..." : "Save Profile"}
                  </button>
                ) : emailStep === 1 && (
                  <button style={styles.primaryBtn} onClick={requestEmailChange} disabled={saving}>
                    {saving ? "Sending OTP..." : "Send Verification OTP"}
                  </button>
                )}

                <div style={styles.divider} />
                <h2 style={styles.sectionHeader}>Change Password</h2>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Current Password</label>
                    <input
                      type="password"
                      placeholder="Current Password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>New Password</label>
                    <input
                      type="password"
                      placeholder="New Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>
                <button style={styles.greenBtn} onClick={changePassword} disabled={saving}>
                  Update Password
                </button>
              </div>
            )}

            {activeTab === "theme" && (
              <div style={styles.contentCard}>
                <h2 style={styles.sectionHeader}>Theme Settings</h2>
                <p style={styles.helperText}>
                  Choose your preferred appearance for the dashboard.
                </p>
                
                <div style={themeStyles.options}>
                  <div 
                    style={{
                      ...themeStyles.option,
                      ...(theme === "system" ? themeStyles.optionActive : {})
                    }}
                    onClick={() => setThemeMode("system")}
                  >
                    <div style={themeStyles.optionIcon}>S</div>
                    <div style={themeStyles.optionText}>
                      <strong>System Default</strong>
                      <span style={styles.optionDesc}>Match your device settings</span>
                    </div>
                  </div>
                  
                  <div 
                    style={{
                      ...themeStyles.option,
                      ...(theme === "light" ? themeStyles.optionActive : {})
                    }}
                    onClick={() => setThemeMode("light")}
                  >
                    <div style={themeStyles.optionIcon}>L</div>
                    <div style={themeStyles.optionText}>
                      <strong>Light Mode</strong>
                      <span style={styles.optionDesc}>Light background with dark text</span>
                    </div>
                  </div>
                  
                  <div 
                    style={{
                      ...themeStyles.option,
                      ...(theme === "dark" ? themeStyles.optionActive : {})
                    }}
                    onClick={() => setThemeMode("dark")}
                  >
                    <div style={themeStyles.optionIcon}>D</div>
                    <div style={themeStyles.optionText}>
                      <strong>Dark Mode</strong>
                      <span style={styles.optionDesc}>Black background with light text</span>
                    </div>
                  </div>
                </div>

                <p style={styles.currentTheme}>
                  Current: <strong>{getThemeLabel()}</strong>
                </p>
              </div>
            )}

            {activeTab === "terms" && (
              <div style={styles.contentCard}>
                <h2 style={styles.sectionHeader}>Terms & Conditions</h2>
                <p style={styles.helperText}>
                  Read the company's terms and conditions.
                </p>
                <div style={styles.termsPlaceholder}>
                  <p>Terms and conditions content will be displayed here.</p>
                  <p style={styles.helperText}>This section contains the official service agreement and operational policies of RENEW Auto Detailing.</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const pageStyles = {
  page: {
    display: "flex",
    background: "var(--bg-primary)",
    minHeight: "100vh",
    color: "var(--text-primary)",
    fontFamily: "Poppins, system-ui, sans-serif"
  },
  main: {
    marginLeft: "280px",
    padding: "40px",
    width: "100%"
  },
  title: {
    marginBottom: "24px",
    fontSize: "28px",
    fontWeight: "700"
  }
};

const styles = {
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
  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-color)",
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    outline: "none",
    fontSize: "14px",
    boxSizing: "border-box"
  },
  primaryBtn: {
    padding: "14px 28px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent-blue)",
    color: "#fff",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
    transition: "0.2s"
  },
  secondaryBtn: {
    padding: "14px 28px",
    borderRadius: "10px",
    border: "1px solid var(--border-color)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px"
  },
  dangerBtn: {
    padding: "14px 28px",
    borderRadius: "10px",
    border: "none",
    color: "#fff",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px"
  },
  greenBtn: {
    padding: "14px 28px",
    borderRadius: "10px",
    border: "none",
    background: "#22c55e",
    color: "#fff",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px"
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
  currentTheme: {
    marginTop: "24px",
    fontSize: "14px",
    color: "var(--text-secondary)"
  },
  optionDesc: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    marginTop: "4px"
  },
  termsPlaceholder: {
    background: "var(--bg-secondary)",
    padding: "24px",
    borderRadius: "12px",
    border: "1px dashed var(--border-color)",
    textAlign: "center"
  },
  loading: {
    fontSize: "14px",
    color: "var(--text-secondary)"
  }
};

const themeStyles = {
  options: {
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },
  option: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "20px",
    borderRadius: "12px",
    borderWidth: "2px",
    borderStyle: "solid",
    borderColor: "var(--border-color)",
    cursor: "pointer",
    transition: "0.2s"
  },
  optionActive: {
    borderColor: "var(--accent-blue)",
    background: "rgba(59, 130, 246, 0.1)"
  },
  optionIcon: {
    width: "56px",
    height: "56px",
    borderRadius: "12px",
    background: "var(--bg-tertiary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
    fontSize: "20px",
    color: "var(--text-primary)"
  },
  optionText: {
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  }
};

export default StaffSettings;
