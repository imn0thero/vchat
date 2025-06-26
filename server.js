// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

io.on('connection', socket => {
    socket.on('join-room', ({ roomId, userName }) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', userName, socket.id);

        socket.on('offer', data => {
            socket.to(roomId).emit('offer', data);
        });

        socket.on('answer', data => {
            socket.to(roomId).emit('answer', data);
        });

        socket.on('ice-candidate', data => {
            socket.to(roomId).emit('ice-candidate', data);
        });

        socket.on('send-message', message => {
            socket.to(roomId).emit('receive-message', { userName, message });
        });

        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', socket.id);
        });
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
