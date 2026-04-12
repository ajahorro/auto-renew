/* ROLE BASED ACCESS CONTROL (RBAC) */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // 1. Safety check: Did the Auth middleware run first?
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User context missing. Auth middleware required first."
        });
      }

      const userRole = String(req.user.role || "").toUpperCase();
      const normalizedRoles = allowedRoles.map(role => String(role).toUpperCase());

      // 2. Logic: Let them in if they are a SUPER_ADMIN OR if their role is in the list
      const isAllowed = userRole === 'SUPER_ADMIN' || normalizedRoles.includes(userRole);

      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: You do not have the required permissions (${normalizedRoles.join(", ")})`
        });
      }

      next(); // Success! Move to the Controller.

    } catch (error) {
      console.error("RBAC ERROR:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during permission check"
      });
    }
  };
};

module.exports = authorize;