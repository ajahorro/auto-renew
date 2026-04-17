const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/auth.middleware");
const {
  SEND_MESSAGE,
  GET_MESSAGES,
  DELETE_MESSAGE
} = require("../controllers/communications.controller");

router.post("/send", authenticate, SEND_MESSAGE);

router.get("/:bookingId", authenticate, GET_MESSAGES);

router.delete("/:id", authenticate, DELETE_MESSAGE);

module.exports = router;
