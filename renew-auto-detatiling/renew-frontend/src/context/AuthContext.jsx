import { createContext, useState, useEffect, useContext } from "react";

export const AuthContext = createContext();

// ✅ This is what your AdminDashboard was missing
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAuth = () => {
      try {
        const storedUser = localStorage.getItem("user");
        const token = localStorage.getItem("token");

        if (storedUser && token) {
          const parsedUser = JSON.parse(storedUser);
          setUser({
            ...parsedUser,
            role: String(parsedUser.role).toUpperCase()
          });
        }
      } catch (err) {
        console.error("Auth load error:", err);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      } finally {
        setLoading(false);
      }
    };
    loadAuth();
  }, []);

  const login = (token, userData) => {
    if (!token || !userData) return;

    // Clean start
    localStorage.clear(); 

    const normalizedUser = {
      id: userData.id,
      email: userData.email,
      fullName: userData.fullName || userData.name,
      phone: userData.phone || "",
      role: String(userData.role).toUpperCase(),
      notifyEmail: userData.notifyEmail ?? false,
      notifyWeb: userData.notifyWeb ?? true
    };

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(normalizedUser));
    
    setUser(normalizedUser);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    window.location.href = "/login"; // Force a clean state
  };

  const updateUser = (updatedData) => {
    const newUser = { ...user, ...updatedData };
    localStorage.setItem("user", JSON.stringify(newUser));
    setUser(newUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};