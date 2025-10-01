const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  regNo: { type: String, required: true },
  pin: { type: String, required: true },
});

module.exports = mongoose.model("Staff", staffSchema);
