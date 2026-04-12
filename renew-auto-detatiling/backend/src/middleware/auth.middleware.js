const jwt = require("jsonwebtoken");

/* AUTHENTICATION MIDDLEWARE */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if the "Bearer <token>" header exists
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

// Change Number(decoded.id) to String(decoded.id)
req.user = {
  id: String(decoded.id), 
  email: decoded.email,
  role: decoded.role ? String(decoded.role).toUpperCase() : "CUSTOMER"
};

    next(); // Pass control to the next function (RBAC or Controller)

  } catch (error) {
    console.error("AUTH ERROR:", error.message);
    return res.status(401).json({
      success: false,
      message: "Session expired or invalid.",
    });
  }
};

module.exports = authenticate;