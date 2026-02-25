// back-end/models/Pin.js
const mongoose = require("mongoose");

const pinSchema = new mongoose.Schema({
  pin: String
});

module.exports = mongoose.model("Pin", pinSchema); // automatically uses "pins" collection
