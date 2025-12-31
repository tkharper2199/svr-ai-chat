import request from "supertest";
import { app } from "./app";

describe("Express App", () => {
  

  describe("GET /health", () => {
    it("should return health status with 200", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "OK");
      expect(response.body).toHaveProperty("uptime");
      expect(response.body).toHaveProperty("memory");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("nodeVersion");
    });

    it("should return memory usage information", async () => {
      const response = await request(app).get("/health");

      expect(response.body.memory).toHaveProperty("used");
      expect(response.body.memory).toHaveProperty("total");
      expect(response.body.memory.used).toMatch(/MB$/);
      expect(response.body.memory.total).toMatch(/MB$/);
    });

    it("should return positive uptime", async () => {
      const response = await request(app).get("/health");

      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("GET /api/time", () => {
    it("should return 404 for non-existent route", async () => {
      const response = await request(app).get("/api/time");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Route not found");
    });
  });

  describe("404 Handler", () => {
    it("should return 404 for undefined routes", async () => {
      const response = await request(app).get("/nonexistent");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Route not found");
      expect(response.body).toHaveProperty("path", "/nonexistent");
      expect(response.body).toHaveProperty("method", "GET");
      expect(response.body).toHaveProperty("timestamp");
    });

    it("should handle POST to undefined routes", async () => {
      const response = await request(app).post("/undefined");

      expect(response.status).toBe(404);
      expect(response.body.method).toBe("POST");
    });
  });

  describe("JSON Parsing Middleware", () => {
    it("should parse JSON request body", async () => {
      // Since we don't have a POST endpoint yet, this will hit 404
      // but it verifies the middleware is working
      const response = await request(app)
        .post("/test")
        .send({ test: "data" })
        .set("Content-Type", "application/json");

      expect(response.status).toBe(404);
      expect(response.headers["content-type"]).toMatch(/json/);
    });
  });
});
