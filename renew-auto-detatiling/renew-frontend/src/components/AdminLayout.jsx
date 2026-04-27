import AdminSideBar from "./AdminSideBar";

const AdminLayout = ({ children, active }) => {
  return (
    <div style={styles.wrapper}>

      <AdminSideBar active={active} />

      <div style={styles.main}>
        {children}
      </div>

    </div>
  );
};

const styles = {
  wrapper: {
    display: "flex",
    background: "#020617",
    minHeight: "100vh",
    fontFamily: "Poppins, system-ui, sans-serif"
  },

  main: {
    marginLeft: "280px", // ✅ matches sidebar
    padding: "40px",
    width: "100%",
    maxWidth: "calc(100% - 280px)" // ✅ prevents overlap
  }
};

export default AdminLayout;