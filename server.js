const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('web'));

let waitingPlayer = null;
let players = {}; // Maps persistent ID to socket

io.on('connection', (socket) => {
    let currentId = null;

    // Client sends their persistent ID from LocalStorage
    socket.on('register_user', (playerId) => {
        currentId = playerId;
        players[currentId] = socket;
        console.log(`User logged in: ${currentId}`);
    });

    socket.on('random_match', () => {
        if (waitingPlayer && waitingPlayer.id !== currentId) {
            const room = `room_${currentId}_${Date.now()}`;
            socket.join(room);
            waitingPlayer.socket.join(room);
            
            socket.emit('match_start', { color: 1, room: room, opponent: waitingPlayer.id });
            waitingPlayer.socket.emit('match_start', { color: 0, room: room, opponent: currentId });
            waitingPlayer = null;
        } else {
            waitingPlayer = { socket: socket, id: currentId };
            socket.emit('waiting_for_opponent');
        }
    });

    socket.on('friend_match', (targetId) => {
        targetId = targetId.toUpperCase();
        if (players[targetId] && players[targetId] !== socket) {
            const room = `room_${currentId}_${Date.now()}`;
            socket.join(room);
            players[targetId].join(room);
            
            socket.emit('match_start', { color: 0, room: room, opponent: targetId });
            players[targetId].emit('match_start', { color: 1, room: room, opponent: currentId });
        } else {
            socket.emit('error_msg', 'Player is offline or does not exist.');
        }
    });

    socket.on('make_move', (data) => {
        socket.to(data.room).emit('opponent_move', data);
    });

    socket.on('disconnect', () => {
        if (waitingPlayer && waitingPlayer.socket === socket) waitingPlayer = null;
        if (currentId) delete players[currentId];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Enterprise Server on port ${PORT}`));