const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function verifyUserToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Not authorized" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: "Session expired, please log in again" });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Session expired, please log in again" });
  }
};