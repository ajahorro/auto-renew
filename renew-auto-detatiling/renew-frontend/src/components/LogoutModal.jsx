import React from "react";

const LogoutModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3>Are you sure you want to log out?</h3>
        <div style={styles.actions}>
          <button onClick={onClose}>Cancel</button>
          <button onClick={onConfirm} style={{ color: "red" }}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
  },
  modal: {
    background: "#fff",
    padding: "20px",
    margin: "100px auto",
    width: "300px",
    borderRadius: "8px",
  },
  actions: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "20px",
  },
};

export default LogoutModal;