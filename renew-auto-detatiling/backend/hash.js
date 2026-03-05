const bcrypt = require("bcrypt");

bcrypt.hash("customer123", 10).then(hash => {
  console.log(hash);
});