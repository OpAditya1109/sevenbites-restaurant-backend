let ioInstance = null;

function initSocket(server) {
  const { Server } = require("socket.io");
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  ioInstance = new Server(server, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
    },
  });

  ioInstance.on("connection", (socket) => {
    // Restaurant dashboard joins its own private room right after connecting
    socket.on("join_restaurant_room", (restaurantId) => {
      if (restaurantId) socket.join(`restaurant_${restaurantId}`);
    });

    // Customer app joins a room scoped to its own user id, for order status pushes
    socket.on("join_user_room", (userId) => {
      if (userId) socket.join(`user_${userId}`);
    });

    // Customer app can also join a room scoped to one specific order (order tracking screen)
    socket.on("join_order_room", (orderId) => {
      if (orderId) socket.join(`order_${orderId}`);
    });
  });

  return ioInstance;
}

function getIO() {
  if (!ioInstance) {
    throw new Error("Socket.io not initialized yet. Call initSocket(server) first.");
  }
  return ioInstance;
}

module.exports = { initSocket, getIO };