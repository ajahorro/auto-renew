const request = require("supertest");
const app = require("../src/server");

describe("Auth API", () => {
  test("Register customer", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "test@example.com",
      password: "123456",
      fullName: "Test User"
    });

    expect(res.statusCode).toBe(200);
  });
});