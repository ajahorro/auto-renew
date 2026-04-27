const { PrismaClient, Prisma } = require("@prisma/client");

// Global serialization fix for BigInt and Decimal (Prisma types)
if (typeof BigInt.prototype.toJSON !== "function") {
  BigInt.prototype.toJSON = function() { return this.toString() };
}
if (Prisma && Prisma.Decimal && typeof Prisma.Decimal.prototype.toJSON !== "function") {
  Prisma.Decimal.prototype.toJSON = function() { return this.toString() };
}


const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"]
});

module.exports = prisma;