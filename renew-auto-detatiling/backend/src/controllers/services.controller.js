const prisma = require("../config/prisma");

const getServices = async (req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      where: { active: true },
      orderBy: { id: "asc" }
    });

    res.json(services);
  } catch (error) {
    next(error);
  }
};

const createService = async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const price = Number(req.body.price);
    const durationMin = Number(req.body.durationMin);

    if (!name || !Number.isFinite(price) || !Number.isFinite(durationMin)) {
      return res.status(400).json({ message: "name, price and durationMin required" });
    }

    const service = await prisma.service.create({
      data: {
        name,
        price: Math.round(price),
        durationMin: Math.round(durationMin)
      }
    });

    res.json(service);
  } catch (error) {
    next(error);
  }
};

module.exports = { getServices, createService };