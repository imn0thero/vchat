// server.js - Node.js WebSocket Server untuk Video Call
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static('public'));

// Store active rooms and users
const rooms = new Map();
const users = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join room
    socket.on('join-room', (data) => {
        const { roomId, username } = data;
        
        // Check if room exists and has space
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        
        const room = rooms.get(roomId);
        
        if (room.size >= 2) {
            socket.emit('room-full');
            return;
        }
        
        // Add user to room
        socket.join(roomId);
        room.add(socket.id);
        users.set(socket.id, { roomId, username });
        
        console.log(`User ${socket.id} joined room ${roomId}`);
        
        // Notify user they joined successfully
        socket.emit('joined-room', { 
            roomId, 
            userId: socket.id,
            userCount: room.size 
        });
        
        // Notify other users in room
        socket.to(roomId).emit('user-joined', { 
            userId: socket.id, 
            username,
            userCount: room.size 
        });
        
        // If room now has 2 users, start call
        if (room.size === 2) {
            io.to(roomId).emit('ready-to-call');
        }
    });

    // Handle WebRTC signaling
    socket.on('offer', (data) => {
        socket.to(data.roomId).emit('offer', {
            offer: data.offer,
            fromUser: socket.id
        });
    });

    socket.on('answer', (data) => {
        socket.to(data.roomId).emit('answer', {
            answer: data.answer,
            fromUser: socket.id
        });
    });

    socket.on('ice-candidate', (data) => {
        socket.to(data.roomId).emit('ice-candidate', {
            candidate: data.candidate,
            fromUser: socket.id
        });
    });

    // Handle chat messages
    socket.on('chat-message', (data) => {
        const user = users.get(socket.id);
        if (user) {
            socket.to(user.roomId).emit('chat-message', {
                message: data.message,
                username: user.username,
                timestamp: new Date().toLocaleTimeString(),
                fromUser: socket.id
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            const room = rooms.get(user.roomId);
            if (room) {
                room.delete(socket.id);
                
                // Notify remaining users
                socket.to(user.roomId).emit('user-left', { 
                    userId: socket.id,
                    username: user.username,
                    userCount: room.size 
                });
                
                // Remove empty rooms
                if (room.size === 0) {
                    rooms.delete(user.roomId);
                }
            }
            users.delete(socket.id);
        }
        console.log(`User disconnected: ${socket.id}`);
    });

    // Handle leave room
    socket.on('leave-room', () => {
        const user = users.get(socket.id);
        if (user) {
            socket.leave(user.roomId);
            const room = rooms.get(user.roomId);
            if (room) {
                room.delete(socket.id);
                socket.to(user.roomId).emit('user-left', { 
                    userId: socket.id,
                    username: user.username,
                    userCount: room.size 
                });
                
                if (room.size === 0) {
                    rooms.delete(user.roomId);
                }
            }
            users.delete(socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Video Call Server running on port ${PORT}`);
    console.log(`📱 Open http://localhost:${PORT} in your browser`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
