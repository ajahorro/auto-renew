const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

/* AUTHENTICATION MIDDLEWARE */
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please login again.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: String(decoded.id) },
      select: { id: true, email: true, role: true, isActive: true, archivedAt: true }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found. Please login again."
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Contact admin for support."
      });
    }

    if (user.archivedAt) {
      return res.status(403).json({
        success: false,
        message: "Account has been archived. Contact admin for support."
      });
    }

    req.user = {
      id: String(decoded.id),
      email: decoded.email,
      role: decoded.role ? String(decoded.role).toUpperCase() : "CUSTOMER"
    };

    next();

  } catch (error) {
    console.error("AUTH ERROR:", error);
    
    // Check if it's a database connection error (Prisma P2024 or similar)
    const isDbError = error.code?.startsWith('P2') || error.message?.includes('connection') || error.message?.includes('timeout');
    
    if (isDbError) {
      return res.status(503).json({
        success: false,
        message: "Database busy, please try again in a moment.",
        isRetryable: true
      });
    }

    return res.status(401).json({
      success: false,
      message: "Session expired or invalid.",
    });
  }
};

module.exports = authenticate;