const jwt = require("jsonwebtoken");
const User = require("../models/user"); // Adjust the path to your User model

const authenticateUser = async (req, res, next) => {
  // Get the token from the Authorization header
  const token = req.header("Authorization")?.replace("Bearer", "").trim();
  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user using the ID from the decoded token
    const user = await User.findOne({ where: { id: decoded.userId } });

    // If the user does not exist, deny access
    if (!user) {
      return res.status(403).json({ error: "Access Denied. Invalid user." });
    }

    // Attach the user to the request object for later use
    req.user = user;

    // Proceed to the next middleware or route handler
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid Token.", details: err.message });
  }
};

module.exports = {
  authenticateUser,
};
