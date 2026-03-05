require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const routes = require("./routes");
const errorHandler = require("./middleware/error.middleware");
const rateLimiter = require("./middleware/rateLimiter.middleware");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimiter);

app.get("/health", (req, res) => {
  res.json({ success: true, status: "ok" });
});

app.use("/api", routes);

app.get("/", (req, res) => {
  res.json({ success: true, message: "RENEW Auto Detailing Backend Running" });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});