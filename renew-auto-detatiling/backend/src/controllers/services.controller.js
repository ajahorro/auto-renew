const prisma = require("../config/prisma");

/* GET ALL SERVICES */

const getServices = async (req, res, next) => {

  try {

    const services = await prisma.service.findMany({
      where: { active: true },
      orderBy: { id: "asc" }
    });

    const grouped = {
      exterior: [],
      interior: [],
      specialized: []
    };
    const seen = new Set();

    for (const service of services) {

      const category = String(service.category).toUpperCase();

      const serviceData = {
        id: service.id,
        name: service.name,
        description: service.description,
        category,
        price: service.price,
        durationMin: service.durationMin,
        priceFormatted: `₱${service.price.toLocaleString()}`,
        durationText: `${service.durationMin} min`
      };

      const uniqueKey = [
        category,
        String(service.name || "").trim().toLowerCase(),
        Number(service.price || 0),
        Number(service.durationMin || 0)
      ].join("|");

      if (seen.has(uniqueKey)) {
        continue;
      }

      seen.add(uniqueKey);

      if (category === "EXTERIOR") {
        grouped.exterior.push(serviceData);
      }

      if (category === "INTERIOR") {
        grouped.interior.push(serviceData);
      }

      if (category === "SPECIALIZED") {
        grouped.specialized.push(serviceData);
      }

    }

    res.json({
      success: true,
      services: grouped
    });

  } catch (error) {
    next(error);
  }

};


/* GET SINGLE SERVICE */

const getServiceById = async (req, res, next) => {

  try {

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Invalid service id"
      });
    }

    const service = await prisma.service.findUnique({
      where: { id }
    });

    if (!service) {
      return res.status(404).json({
        message: "Service not found"
      });
    }

    res.json(service);

  } catch (error) {
    next(error);
  }

};


/* CREATE SERVICE (ADMIN) */

const createService = async (req, res, next) => {

  try {

    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim();
    const category = String(req.body.category || "").trim().toUpperCase();

    const price = Number(req.body.price);
    const durationMin = Number(req.body.durationMin);

    if (
      !name ||
      !description ||
      !category ||
      !Number.isFinite(price) ||
      !Number.isFinite(durationMin)
    ) {
      return res.status(400).json({
        message: "name, description, category, price and durationMin required"
      });
    }

    const validCategories = ["EXTERIOR", "INTERIOR", "SPECIALIZED"];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        message: "Invalid service category"
      });
    }

    const duplicate = await prisma.service.findFirst({
      where: {
        active: true,
        name,
        category,
        price,
        durationMin: Math.round(durationMin)
      }
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "A matching active service already exists"
      });
    }

    const service = await prisma.service.create({
      data: {
        name,
        description,
        category,
        price: Math.round(price),
        durationMin: Math.round(durationMin)
      }
    });

    res.json({
      success: true,
      service
    });

  } catch (error) {
    next(error);
  }

};


module.exports = {
  getServices,
  getServiceById,
  createService
};
