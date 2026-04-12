import { useEffect, useState } from "react";
import API from "../../api/axios";
import StaffSidebar from "../../components/StaffSidebar";
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

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const res = await API.get("/me");
      if (res.data.user) {
        setProfile({
          fullName: res.data.user.fullName || "",
          email: res.data.user.email || ""
        });
        localStorage.setItem("user", JSON.stringify(res.data.user));
      }
    } catch (err) {
      console.log(err);
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
      <StaffSidebar active="settings"/>
      <div style={pageStyles.main}>
        <h1 style={pageStyles.title}>Account Settings</h1>

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
                    <label style={styles.label}>Email</label>
                    <input
                      placeholder="Email"
                      value={profile.email}
                      disabled
                      style={{...styles.input, opacity: 0.5, cursor: "not-allowed"}}
                    />
                  </div>
                </div>
                <button style={styles.primaryBtn} onClick={saveProfile} disabled={saving}>
                  {saving ? "Saving..." : "Save Profile"}
                </button>

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
                  Please read our terms and conditions carefully.
                </p>
                <div style={styles.termsContent}>
                  <h3 style={styles.termsTitle}>1. Service Agreement</h3>
                  <p style={styles.termsText}>
                    By using our auto detailing services, you agree to the terms and conditions outlined here.
                  </p>
                  
                  <h3 style={styles.termsTitle}>2. Booking Policy</h3>
                  <p style={styles.termsText}>
                    All bookings must be made at least 30 minutes in advance. Cancellations must be requested 24 hours before the scheduled appointment.
                  </p>
                  
                  <h3 style={styles.termsTitle}>3. Payment Terms</h3>
                  <p style={styles.termsText}>
                    Full payment is required upon completion of services. For bookings over ₱5,000, a downpayment may be required to secure your slot.
                  </p>
                  
                  <h3 style={styles.termsTitle}>4. Vehicle Responsibility</h3>
                  <p style={styles.termsText}>
                    While we take utmost care with your vehicle, please remove all personal belongings before the service appointment.
                  </p>
                  
                  <h3 style={styles.termsTitle}>5. Privacy Policy</h3>
                  <p style={styles.termsText}>
                    Your personal information is protected and will only be used for service-related communications.
                  </p>
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
    fontFamily: "Poppins, system-ui"
  },
  main: {
    marginLeft: "260px",
    padding: "40px",
    width: "100%",
    color: "var(--text-primary)"
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
    background: "#f59e0b",
    color: "#020617",
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
  termsContent: {
    background: "var(--bg-secondary)",
    padding: "24px",
    borderRadius: "12px"
  },
  termsTitle: {
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
    borderColor: "#f59e0b",
    background: "rgba(245, 158, 11, 0.1)"
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
