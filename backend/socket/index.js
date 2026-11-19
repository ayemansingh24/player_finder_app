import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let io = null;

/**
 * Initializes Socket.IO server attached to the Node HTTP server.
 *
 * @param {import("http").Server} httpServer
 */
export const initSocket = (httpServer) => {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    // Optional token auth during handshake
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");
    if (token && process.env.ACCESS_TOKEN_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        socket.userId = decoded._id;
      } catch (err) {
        // Allow unauthenticated connection for public spectator streams
      }
    }
    next();
  });

  io.on("connection", (socket) => {
    // If authenticated, join user private notification room
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Allow joining a user private notification room explicitly
    socket.on("join:user", (userId) => {
      if (userId) socket.join(`user:${userId}`);
    });

    // Join match live score room
    socket.on("join:match", (matchId) => {
      if (matchId) socket.join(`match:${matchId}`);
    });

    // Leave match live score room
    socket.on("leave:match", (matchId) => {
      if (matchId) socket.leave(`match:${matchId}`);
    });

    socket.on("disconnect", () => {
      // Disconnected
    });
  });

  console.log("⚡ Socket.IO initialized");
  return io;
};

export const getIO = () => io;

/**
 * Emits an event to a user's private notification room.
 *
 * @param {string} userId
 * @param {string} event
 * @param {any} data
 */
export const emitToUser = (userId, event, data) => {
  if (io && userId) {
    io.to(`user:${userId.toString()}`).emit(event, data);
  }
};

/**
 * Emits an event to all clients in a specific room (e.g. `match:${matchId}`).
 *
 * @param {string} room
 * @param {string} event
 * @param {any} data
 */
export const emitToRoom = (room, event, data) => {
  if (io && room) {
    io.to(room).emit(event, data);
  }
};

export default { initSocket, getIO, emitToUser, emitToRoom };
