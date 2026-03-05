// test.js
const bcrypt = require("bcrypt");

const hashFromDB = "$2b$10$ytyAA7Y18OfuDmZwDh5DrOz69cAhfNQNX4/BuXz85.yIImU8UTm";

bcrypt.compare("123456", hashFromDB).then(result => {
  console.log("Does 123456 match?", result);
});