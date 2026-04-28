const jwt = require("jsonwebtoken");

/* AUTHENTICATION MIDDLEWARE (OPTIMIZED) */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in your .env file");
    }

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }

    if (!decoded?.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
    }

    // ⚡ NO DATABASE CALL HERE (IMPORTANT)
    req.user = {
      id: String(decoded.id),
      email: decoded.email || null,
      role: decoded.role ? String(decoded.role).toUpperCase() : "CUSTOMER",
    };

    next();
  } catch (error) {
    console.error("AUTH ERROR:", error);

    const isDbError =
      error.code?.startsWith("P2") ||
      error.message?.includes("connection") ||
      error.message?.includes("timeout");

    if (isDbError) {
      return res.status(503).json({
        success: false,
        message: "Database busy, please try again in a moment.",
        isRetryable: true,
      });
    }

    return res.status(401).json({
      success: false,
      message: "Session expired or invalid.",
    });
  }
};

module.exports = authenticate;