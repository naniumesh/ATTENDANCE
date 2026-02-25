const mongoose = require("mongoose");

// Connect a SECOND mongoose connection for login DB
const loginConnection = mongoose.createConnection(process.env.LOGIN_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define the admin schema
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

// Export the model bound to the separate connection
module.exports = loginConnection.model("Admin", adminSchema);

