const prisma = require("../config/prisma");

/* ===============================
GET USERS
OPTIONAL ROLE FILTER
=============================== */

const getUsers = async (req, res) => {

  try {

    const { role } = req.query;

    const where = {};

    if (role) {
      where.role = role;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.json(users);

  } catch (error) {

    console.error("GET USERS ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch users"
    });

  }

};

/* ===============================
UPDATE USER ROLE
=============================== */

const updateUserRole = async (req, res) => {

  try {

    const id = req.params.id;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        message: "Role required"
      });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role }
    });

    res.json({
      success: true,
      user: updated
    });

  } catch (error) {

    console.error("UPDATE USER ROLE ERROR:", error);

    res.status(500).json({
      message: "Failed to update role"
    });

  }

};

/* ===============================
DELETE USER
=============================== */

const deleteUser = async (req, res) => {

  try {

    const id = req.params.id;

    await prisma.user.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: "User removed"
    });

  } catch (error) {

    console.error("DELETE USER ERROR:", error);

    res.status(500).json({
      message: "Failed to delete user"
    });

  }

};

module.exports = {
  getUsers,
  updateUserRole,
  deleteUser
};