const prisma = require('./src/config/prisma');
const { assignStaff } = require('./src/controllers/bookings.controller');

async function debugAssign() {
  console.log("--- STARTING DEBUG ASSIGNMENT ---");
  
  const mockReq = {
    params: { id: "1" },
    body: { assignedStaffId: "cm0i0p71c0000nq7n5jqbj56n" }, // Valid staff ID from previous checks
    user: { id: "cm0i0p71c0000nq7n5jqbj56n", role: "ADMIN" }
  };

  const mockRes = {
    status: function(code) {
      console.log("RES STATUS:", code);
      return this;
    },
    json: function(data) {
      console.log("RES JSON:", JSON.stringify(data, null, 2));
      return this;
    }
  };

  try {
    await assignStaff(mockReq, mockRes);
  } catch (err) {
    console.error("FATAL CONTROLLER ERROR:", err);
  } finally {
    await prisma.$disconnect();
  }
}

debugAssign();
