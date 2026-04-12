const express = require("express");

const router = express.Router();

const prisma = require("../config/prisma");

const authenticate = require("../middleware/auth.middleware");
const authorize = require("../middleware/rbac.middleware");

/* ===============================
   GET ALL SERVICES
=============================== */

router.get("/", async (req, res) => {

  try {

    const services = await prisma.service.findMany({
      where: {
        active: true
      },
      orderBy: {
        name: "asc"
      }
    });

    const exterior = services.filter(s => s.category === "EXTERIOR");
    const interior = services.filter(s => s.category === "INTERIOR");
    const specialized = services.filter(s => s.category === "SPECIALIZED");

    res.json({
      services: {
        exterior,
        interior,
        specialized
      }
    });

  } catch (error) {

    console.error("GET SERVICES ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch services"
    });

  }

});

/* ===============================
   CREATE SERVICE
   ADMIN ONLY
=============================== */

router.post("/",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {

    try {

      const { name, description, category, price, durationMin } = req.body;

      if (!name || !category || !price) {

    return res.status(400).json({
      success: false,
      message: "Missing required fields"
    });

      }

      const service = await prisma.service.create({
        data: {
          name,
          description,
          category,
          price: Number(price),
          durationMin: Number(durationMin || 30)
        }
      });

      res.json({
        success: true,
        service
      });

    } catch (error) {

      console.error("CREATE SERVICE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create service"
    });

    }

  }
);

/* ===============================
   UPDATE SERVICE
=============================== */

router.patch("/:id",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {

    try {

      const id = Number(req.params.id);

      const updated = await prisma.service.update({
        where: { id },
        data: req.body
      });

      res.json({
        success: true,
        service: updated
      });

    } catch (error) {

      console.error("UPDATE SERVICE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update service"
    });

    }

  }
);

/* ===============================
   DELETE SERVICE
=============================== */

router.delete("/:id",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {

    try {

      const id = Number(req.params.id);

      await prisma.service.update({
        where: { id },
        data: {
          active: false
        }
      });

      res.json({
        success: true,
        message: "Service deactivated"
      });

    } catch (error) {

      console.error("DELETE SERVICE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete service"
    });

    }

  }
);

module.exports = router;