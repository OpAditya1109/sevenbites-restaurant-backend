// Lightweight admin gate — checks a shared secret header against process.env.ADMIN_API_KEY.
// There's no admin user model/login flow in this backend yet, so this is intentionally
// simple. Swap it out for real admin auth (JWT + role check) once that exists — for now
// it's enough to keep the pricing-config write endpoint off the open internet.
module.exports = function verifyAdminKey(req, res, next) {
  const provided = req.headers["x-admin-key"];
  const expected = process.env.ADMIN_API_KEY;

  if (!expected) {
    console.error("ADMIN_API_KEY is not set — refusing all admin requests until it is.");
    return res.status(500).json({ success: false, message: "Admin API is not configured" });
  }
  if (!provided || provided !== expected) {
    return res.status(401).json({ success: false, message: "Invalid or missing admin key" });
  }
  next();
};