import CustomerSidebar from "./CustomerSideBar";
import AdminSideBar from "./AdminSidebar";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

const CustomerLayout = ({ children, active }) => {

  const { user } = useContext(AuthContext);

  const role = user?.role?.toUpperCase();

  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  return (
    <div style={styles.wrapper}>

      {isAdmin
        ? <AdminSideBar active={active} />
        : <CustomerSidebar active={active} />
      }

      <div style={styles.main}>
        {children}
      </div>

    </div>
  );
};

const styles = {
  wrapper: {
    display: "flex",
    background: "var(--bg-primary)",
    minHeight: "100vh",
    fontFamily: "Poppins, system-ui, sans-serif"
  },

  main: {
    marginLeft: "260px",
    padding: "30px 30px 40px 20px",
    width: "100%",
    maxWidth: "calc(100% - 260px)",
    boxSizing: "border-box"
  }
};

export default CustomerLayout;