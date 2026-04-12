import React from "react";
import toast from "react-hot-toast";

export const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", type = "danger" }) => {
  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (err) {
      // Error handled by caller
    }
  };

  const getConfirmButtonStyle = () => {
    if (type === "danger") return { ...confirmBtn, background: "var(--accent-red)" };
    if (type === "success") return { ...confirmBtn, background: "var(--accent-green)" };
    return confirmBtn;
  };

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: "10px", color: "var(--text-primary)" }}>{title}</h3>
        <p style={{ marginBottom: "20px", opacity: 0.8, color: "var(--text-secondary)" }}>{message}</p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button style={cancelBtn} onClick={onCancel}>
            {cancelText}
          </button>
          <button style={getConfirmButtonStyle()} onClick={handleConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Toast-based confirmation helper
export const confirmAction = async ({ title, message, confirmText = "Confirm", cancelText = "Cancel", type = "danger" }) => {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
    `;
    
    const getButtonColor = () => type === "danger" ? "#ef4444" : type === "success" ? "#22c55e" : type === "warning" ? "#f59e0b" : "#3b82f6";
    const formattedMessage = message.replace(/\n/g, '<br>');
    
    modal.innerHTML = `
      <div style="
        background: var(--card-bg, #0f172a);
        padding: 24px;
        border-radius: 12px;
        width: 320px;
        border: 1px solid var(--border-color, #334155);
        color: var(--text-primary, #e2e8f0);
      ">
        <h3 style="margin-bottom: 10px; color: var(--text-primary, #e2e8f0);">${title}</h3>
        <p style="margin-bottom: 20px; opacity: 0.8; color: var(--text-secondary, #94a3b8); line-height: 1.5;">${formattedMessage}</p>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="modal-cancel" style="
            padding: 6px 12px;
            background: var(--bg-tertiary, #1e293b);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            color: var(--text-primary, #e2e8f0);
          ">${cancelText}</button>
          <button id="modal-confirm" style="
            padding: 6px 12px;
            background: ${getButtonColor()};
            border: none;
            border-radius: 6px;
            cursor: pointer;
            color: white;
          ">${confirmText}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector("#modal-cancel").onclick = () => {
      document.body.removeChild(modal);
      resolve(false);
    };
    
    modal.querySelector("#modal-confirm").onclick = () => {
      document.body.removeChild(modal);
      resolve(true);
    };
    
    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        resolve(false);
      }
    };
  });
};

const overlay = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999
};

const modal = {
  background: "var(--card-bg)",
  padding: "24px",
  borderRadius: "12px",
  width: "320px",
  border: "1px solid var(--border-color)",
  color: "var(--text-primary)"
};

const cancelBtn = {
  padding: "6px 12px",
  background: "var(--bg-tertiary)",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  color: "var(--text-primary)"
};

const confirmBtn = {
  padding: "6px 12px",
  background: "var(--accent-green)",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  color: "white"
};

export default ConfirmModal;