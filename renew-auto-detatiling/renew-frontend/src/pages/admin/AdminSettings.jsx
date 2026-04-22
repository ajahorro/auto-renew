import { useEffect, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import API from "../../api/axios";
import toast from "react-hot-toast";
import { useTheme } from "../../context/ThemeContext";

const AdminSettings = () => {
  const { theme, setThemeMode } = useTheme();
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [activeTab, setActiveTab] = useState("profile");

  const [profile, setProfile] = useState({
    fullName: storedUser.fullName || "",
    email: storedUser.email || ""
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [businessSettings, setBusinessSettings] = useState({
    openingHour: 8,
    closingHour: 18,
    slotDurationMinutes: 60,
    maxBookingsPerSlot: 2
  });

  const [staffList, setStaffList] = useState([]);
  const [customerList, setCustomerList] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaff, setNewStaff] = useState({ email: "", password: "", fullName: "", role: "STAFF" });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);

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

      try {
        const settingsRes = await API.get("/business-settings");
        if (settingsRes.data) {
          setBusinessSettings(settingsRes.data);
        }
      } catch {
        console.log("No business settings yet");
      }

      const usersRes = await API.get("/admin/users");
      const users = usersRes.data.users || [];
      setStaffList(users.filter(u => u.role === "STAFF" || u.role === "ADMIN"));
      setCustomerList(users.filter(u => u.role === "CUSTOMER"));
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

  const saveBusinessSettings = async () => {
    if (businessSettings.openingHour >= businessSettings.closingHour) {
      toast.error("Opening must be earlier than closing");
      return;
    }
    setSaving(true);
    try {
      await API.patch("/business-settings", businessSettings);
      toast.success("Business settings saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const addStaff = async () => {
    if (!newStaff.email || !newStaff.password || !newStaff.fullName) {
      toast.error("All fields required");
      return;
    }
    setSaving(true);
    try {
      await API.post("/users", newStaff);
      toast.success("Staff account created");
      setShowAddModal(false);
      setNewStaff({ email: "", password: "", fullName: "", role: "STAFF" });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create staff");
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    const action = currentStatus ? "deactivate" : "activate";
    try {
      await API.patch(`/users/${userId}/${action}`);
      toast.success(`User ${action}d`);
      loadData();
    } catch {
      toast.error("Failed");
    }
  };

  const deleteCustomer = async () => {
    if (!deletingUser) return;
    try {
      await API.patch(`/users/${deletingUser.id}/archive`);
      toast.success("Customer archived. Will be permanently deleted after 15 days.");
      setShowDeleteModal(false);
      setDeletingUser(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to archive customer");
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
    { id: "staff", label: "Staff Management" },
    { id: "business", label: "Business Settings" },
    { id: "terms", label: "Terms & Conditions" }
  ];

  return (
    <div style={pageStyles.page}>
      <AdminSidebar active="settings" />
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

            {activeTab === "staff" && (
              <div>
                <div style={styles.contentHeader}>
                  <h2 style={styles.sectionHeader}>Staff Accounts</h2>
                  <button style={styles.addBtn} onClick={() => setShowAddModal(true)}>
                    + Add Staff
                  </button>
                </div>

                <div style={styles.tableCard}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeaderRow}>
                        <th style={styles.tableHeader}>Name</th>
                        <th style={styles.tableHeader}>Email</th>
                        <th style={styles.tableHeader}>Role</th>
                        <th style={styles.tableHeader}>Status</th>
                        <th style={styles.tableHeader}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffList.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={styles.emptyCell}>
                            No staff accounts yet. Click "Add Staff" to create one.
                          </td>
                        </tr>
                      ) : (
                        staffList.map(user => (
                          <tr key={user.id} style={styles.tableRow}>
                            <td style={styles.tableCell}>{user.fullName}</td>
                            <td style={styles.tableCell}>{user.email}</td>
                            <td style={styles.tableCell}>
                              <span style={{
                                ...styles.roleBadge,
                                background: user.role === "ADMIN" ? "#8b5cf6" : "#f59e0b"
                              }}>
                                {user.role}
                              </span>
                            </td>
                            <td style={styles.tableCell}>
                              <span style={{
                                ...styles.statusBadge,
                                background: user.isActive ? "#22c55e" : "#ef4444"
                              }}>
                                {user.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td style={styles.tableCell}>
                              <button 
                                style={{
                                  ...styles.actionBtn,
                                  background: user.isActive ? "#ef4444" : "#22c55e"
                                }}
                                onClick={() => toggleUserStatus(user.id, user.isActive)}
                              >
                                {user.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{...styles.contentHeader, marginTop: "40px"}}>
                  <h2 style={styles.sectionHeader}>Customer Accounts</h2>
                </div>

                <div style={styles.tableCard}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeaderRow}>
                        <th style={styles.tableHeader}>Name</th>
                        <th style={styles.tableHeader}>Email</th>
                        <th style={styles.tableHeader}>Status</th>
                        <th style={styles.tableHeader}>Created</th>
                        <th style={styles.tableHeader}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerList.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={styles.emptyCell}>
                            No customer accounts found.
                          </td>
                        </tr>
                      ) : (
                        customerList.map(user => (
                          <tr key={user.id} style={styles.tableRow}>
                            <td style={styles.tableCell}>{user.fullName}</td>
                            <td style={styles.tableCell}>{user.email}</td>
                            <td style={styles.tableCell}>
                              <span style={{
                                ...styles.statusBadge,
                                background: user.isActive ? "#22c55e" : "#ef4444"
                              }}>
                                {user.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td style={styles.tableCell}>
                              {new Date(user.createdAt).toLocaleDateString()}
                            </td>
                            <td style={styles.tableCell}>
                              <button 
                                style={{
                                  ...styles.actionBtn,
                                  background: user.isActive ? "#ef4444" : "#22c55e"
                                }}
                                onClick={() => toggleUserStatus(user.id, user.isActive)}
                              >
                                {user.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {showAddModal && (
                  <div style={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
                    <div style={styles.modal} onClick={e => e.stopPropagation()}>
                      <h3 style={styles.modalTitle}>Add New Staff</h3>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Full Name</label>
                        <input
                          placeholder="Full Name"
                          value={newStaff.fullName}
                          onChange={(e) => setNewStaff(s => ({ ...s, fullName: e.target.value }))}
                          style={styles.input}
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Email</label>
                        <input
                          placeholder="Email"
                          type="email"
                          value={newStaff.email}
                          onChange={(e) => setNewStaff(s => ({ ...s, email: e.target.value }))}
                          style={styles.input}
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Password</label>
                        <input
                          placeholder="Password"
                          type="password"
                          value={newStaff.password}
                          onChange={(e) => setNewStaff(s => ({ ...s, password: e.target.value }))}
                          style={styles.input}
                        />
                      </div>
                      <div style={styles.modalActions}>
                        <button style={styles.cancelBtn} onClick={() => setShowAddModal(false)}>
                          Cancel
                        </button>
                        <button style={styles.primaryBtn} onClick={addStaff} disabled={saving}>
                          {saving ? "Creating..." : "Create Staff"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {showDeleteModal && deletingUser && (
                  <div style={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
                    <div style={styles.modal} onClick={e => e.stopPropagation()}>
                      <h3 style={styles.modalTitle}>Archive Customer Account</h3>
                      <p style={styles.deleteWarning}>
                        Are you sure you want to archive <strong>{deletingUser.fullName}</strong>'s account?
                      </p>
                      <p style={styles.deleteInfo}>
                        The account will be archived for 15 days. During this period, the customer can recover their account by simply logging in. After 15 days, the account and all associated booking history will be permanently deleted.
                      </p>
                      <div style={styles.modalActions}>
                        <button style={styles.cancelBtn} onClick={() => {
                          setShowDeleteModal(false);
                          setDeletingUser(null);
                        }}>
                          Cancel
                        </button>
                        <button style={{...styles.dangerBtn, flex: 1}} onClick={deleteCustomer}>
                          Yes, Archive Account
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "business" && (
              <div style={styles.contentCard}>
                <h2 style={styles.sectionHeader}>Business Hours</h2>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Opening Hour</label>
                    <select
                      value={businessSettings.openingHour}
                      onChange={(e) => setBusinessSettings(s => ({ ...s, openingHour: parseInt(e.target.value) }))}
                      style={styles.input}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i.toString().padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Closing Hour</label>
                    <select
                      value={businessSettings.closingHour}
                      onChange={(e) => setBusinessSettings(s => ({ ...s, closingHour: parseInt(e.target.value) }))}
                      style={styles.input}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i.toString().padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={styles.divider} />
                <h2 style={styles.sectionHeader}>Booking Settings</h2>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Slot Duration (minutes)</label>
                    <select
                      value={businessSettings.slotDurationMinutes}
                      onChange={(e) => setBusinessSettings(s => ({ ...s, slotDurationMinutes: parseInt(e.target.value) }))}
                      style={styles.input}
                    >
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={90}>1.5 hours</option>
                      <option value={120}>2 hours</option>
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Max Bookings Per Slot</label>
                    <select
                      value={businessSettings.maxBookingsPerSlot}
                      onChange={(e) => setBusinessSettings(s => ({ ...s, maxBookingsPerSlot: parseInt(e.target.value) }))}
                      style={styles.input}
                    >
                      {[1, 2, 3, 4, 5].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Max Services Per Booking</label>
                    <select
                      value={businessSettings.maxServicesPerBooking || 5}
                      onChange={(e) => setBusinessSettings(s => ({ ...s, maxServicesPerBooking: parseInt(e.target.value) }))}
                      style={styles.input}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <option key={n} value={n}>{n} services</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={styles.divider} />
                <h2 style={styles.sectionHeader}>Payment Rules</h2>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Downpayment Threshold (₱)</label>
                    <input
                      type="number"
                      value={businessSettings.downpaymentThreshold}
                      onChange={(e) => setBusinessSettings(s => ({ ...s, downpaymentThreshold: parseFloat(e.target.value) }))}
                      style={styles.input}
                      placeholder="5000"
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Downpayment Percentage (0.0 - 1.0)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={businessSettings.downpaymentPercentage}
                      onChange={(e) => setBusinessSettings(s => ({ ...s, downpaymentPercentage: parseFloat(e.target.value) }))}
                      style={styles.input}
                      placeholder="0.5"
                    />
                  </div>
                </div>

                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>GCash Name</label>
                    <input
                      type="text"
                      value={businessSettings.gcashName || ""}
                      onChange={(e) => setBusinessSettings(s => ({ ...s, gcashName: e.target.value }))}
                      style={styles.input}
                      placeholder="Business GCash Name"
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>GCash Number</label>
                    <input
                      type="text"
                      value={businessSettings.gcashNumber || ""}
                      onChange={(e) => setBusinessSettings(s => ({ ...s, gcashNumber: e.target.value }))}
                      style={styles.input}
                      placeholder="09XXXXXXXXX"
                    />
                  </div>
                </div>

                <button style={styles.primaryBtn} onClick={saveBusinessSettings} disabled={saving}>
                  {saving ? "Saving..." : "Save Settings"}
                </button>
              </div>
            )}

            {activeTab === "terms" && (
              <div style={styles.contentCard}>
                <h2 style={styles.sectionHeader}>Terms & Conditions</h2>
                <p style={styles.helperText}>
                  Manage your business terms and conditions.
                </p>
                <div style={styles.termsPlaceholder}>
                  <p>Terms and conditions content will be added here.</p>
                  <p style={styles.helperText}>This section allows you to define your service agreement, cancellation policy, and other important terms for your customers.</p>
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
  contentHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px"
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
    background: "#8b5cf6",
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
  addBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "#8b5cf6",
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
  tableCard: {
    background: "var(--card-bg)",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    overflow: "hidden"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse"
  },
  tableHeaderRow: {
    background: "var(--bg-secondary)"
  },
  tableHeader: {
    padding: "14px 16px",
    textAlign: "left",
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.5px"
  },
  tableRow: {
    borderBottom: "1px solid var(--border-color)"
  },
  tableCell: {
    padding: "16px",
    fontSize: "14px"
  },
  emptyCell: {
    padding: "40px",
    textAlign: "center",
    color: "var(--text-secondary)"
  },
  roleBadge: {
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
    color: "#fff"
  },
  statusBadge: {
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
    color: "#fff"
  },
  actionBtn: {
    padding: "8px 14px",
    borderRadius: "6px",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "500"
  },
  modalOverlay: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000
  },
  modal: {
    background: "var(--card-bg)",
    padding: "32px",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "480px",
    border: "1px solid var(--border-color)"
  },
  modalTitle: {
    marginBottom: "20px",
    fontSize: "20px",
    fontWeight: "600"
  },
  modalActions: {
    display: "flex",
    gap: "12px",
    marginTop: "24px"
  },
  cancelBtn: {
    flex: 1,
    padding: "14px",
    borderRadius: "10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border-color)",
    background: "transparent",
    color: "var(--text-primary)",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px"
  },
  dangerBtn: {
    padding: "14px",
    borderRadius: "10px",
    border: "none",
    background: "#ef4444",
    color: "#fff",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px"
  },
  deleteWarning: {
    fontSize: "16px",
    marginBottom: "16px"
  },
  deleteInfo: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    lineHeight: "1.6"
  },
  termsPlaceholder: {
    padding: "40px",
    background: "var(--bg-secondary)",
    borderRadius: "12px",
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
    borderColor: "#8b5cf6",
    background: "rgba(139, 92, 246, 0.1)"
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

export default AdminSettings;
