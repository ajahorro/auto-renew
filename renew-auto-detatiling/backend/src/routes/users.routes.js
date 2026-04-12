const express = require("express");

const router = express.Router();

const prisma = require("../config/prisma");

const authenticate = require("../middleware/auth.middleware");
const authorize = require("../middleware/rbac.middleware");

const bcrypt = require("bcryptjs");
/* ===============================
   GET USERS
   Optional filter: role
   Excludes archived users by default
 =============================== */

router.get("/", authenticate, async (req, res) => {
  try {
    const { role, includeArchived } = req.query;

    const where = { archivedAt: null };

    if (role) {
      where.role = role;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        active: true,
        archivedAt: true,
        createdAt: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.json({
      success: true,
      users
    });

  } catch (error) {

    console.error("GET USERS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch users"
    });

  }
});

/* ===============================
   UPDATE USER ROLE
=============================== */

router.patch("/:id/role",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {

    try {

      const { id } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({
          success: false,
          message: "Role required"
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { role }
      });

      res.json({
        success: true,
        user: updatedUser
      });

    } catch (error) {

      console.error("UPDATE ROLE ERROR:", error);

      res.status(500).json({
        success: false,
        message: "Failed to update role"
      });

    }

  }
);

/* ===============================
   ARCHIVE USER (SOFT DELETE)
 =============================== */

router.patch("/:id/archive",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {

    try {

      const { id } = req.params;

      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Cannot archive admin accounts"
        });
      }

      const archiveDate = new Date();
      archiveDate.setDate(archiveDate.getDate() + 15);

      await prisma.user.update({
        where: { id },
        data: {
          archivedAt: archiveDate,
          active: false
        }
      });

      res.json({
        success: true,
        message: "User archived. Will be permanently deleted after 15 days."
      });

    } catch (error) {

      console.error("ARCHIVE USER ERROR:", error);

      res.status(500).json({
        success: false,
        message: "Failed to archive user"
      });

    }

  }
);

/* ===============================
   RESTORE ARCHIVED USER
 =============================== */

router.patch("/:id/restore",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {

    try {

      const { id } = req.params;

      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      await prisma.user.update({
        where: { id },
        data: {
          archivedAt: null,
          active: true
        }
      });

      res.json({
        success: true,
        message: "User restored successfully"
      });

    } catch (error) {

      console.error("RESTORE USER ERROR:", error);

      res.status(500).json({
        success: false,
        message: "Failed to restore user"
      });

    }

  }
);

/* ===============================
   PERMANENTLY DELETE USER
 =============================== */

router.delete("/:id",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {

    try {

      const { id } = req.params;

      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      await prisma.user.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: "User permanently deleted"
      });

    } catch (error) {

      console.error("DELETE USER ERROR:", error);

      res.status(500).json({
        success: false,
        message: "Failed to delete user"
      });

    }

  }
);

/* ===============================
   GET CURRENT USER PROFILE
=============================== */

router.get("/me",
  authenticate,
  async (req, res) => {

    try {

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true
        }
      });

      res.json({
        success: true,
        user
      });

    } catch (error) {

      console.error("GET PROFILE ERROR:", error);

      res.status(500).json({
        success: false,
        message: "Failed to load profile"
      });

    }

  }
);


/* ===============================
   UPDATE CURRENT USER PROFILE
=============================== */

router.patch("/me",
  authenticate,
  async (req, res) => {

    try {

      const { fullName, phone } = req.body;

      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          fullName,
          phone
        }
      });

      res.json({
        success: true,
        user: updated
      });

    } catch (error) {

      console.error("UPDATE PROFILE ERROR:", error);

      res.status(500).json({
        success: false,
        message: "Failed to update profile"
      });

    }

  }
);


/* ===============================
   CHANGE PASSWORD
 =============================== */

router.patch("/me/password",
  authenticate,
  async (req, res) => {

    try {

      const { currentPassword, newPassword } = req.body;

      const user = await prisma.user.findUnique({
        where: { id: req.user.id }
      });

      const match = await bcrypt.compare(currentPassword, user.password);

      if (!match) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect"
        });
      }

      const hashed = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          password: hashed
        }
      });

      res.json({
        success: true,
        message: "Password updated"
      });

    } catch (error) {

      console.error("CHANGE PASSWORD ERROR:", error);

      res.status(500).json({
        success: false,
        message: "Failed to change password"
      });

    }

  }
);

/* ===============================
   REQUEST ACCOUNT DELETION
 =============================== */

router.post("/me/request-delete",
  authenticate,
  async (req, res) => {

    try {

      const user = await prisma.user.findUnique({
        where: { id: req.user.id }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + 15);

      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          archivedAt: deletionDate,
          active: false
        }
      });

      res.json({
        success: true,
        message: "Account deletion scheduled. You can cancel by logging in within 15 days.",
        deletionDate: deletionDate
      });

    } catch (error) {

      console.error("REQUEST DELETE ERROR:", error);

      res.status(500).json({
        success: false,
        message: "Failed to request account deletion"
      });

    }

  }
);

module.exports = router;