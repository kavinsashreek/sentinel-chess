const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('web'));

// THE MASTER DATABASE (In-Memory)
// Tracks: socketId, nickname, and elo (score)
const players = {}; 
const waitingQueue = [];

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // 1. Handle Registration & Nickname Locking
    socket.on('register_user', (data) => {
        const { id, name } = data;
        
        // If new player, initialize their profile with 1000 Elo
        if (!players[id]) {
            players[id] = { id: id, socketId: socket.id, nickname: '', elo: 1000 };
        } else {
            players[id].socketId = socket.id; // Update socket on reconnect
        }
        
        if (name) handleNameUpdate(id, name, socket);
    });

    socket.on('update_profile', (data) => {
        handleNameUpdate(data.id, data.name, socket);
    });

    // 2. Random Matchmaking Queue
    socket.on('random_match', () => {
        const pId = Object.keys(players).find(key => players[key].socketId === socket.id);
        if (!pId) return;

        if (waitingQueue.length > 0) {
            const opponentId = waitingQueue.shift();
            if (opponentId === pId) { waitingQueue.push(pId); return; } // Prevent self-match
            
            const room = `room_${pId}_${opponentId}`;
            socket.join(room);
            const oppSocket = io.sockets.sockets.get(players[opponentId].socketId);
            if (oppSocket) oppSocket.join(room);

            const myName = players[pId].nickname || pId;
            const oppName = players[opponentId].nickname || opponentId;

            io.to(socket.id).emit('match_start', { color: 0, room: room, opponent: oppName });
            if (oppSocket) io.to(oppSocket.id).emit('match_start', { color: 1, room: room, opponent: myName });
        } else {
            waitingQueue.push(pId);
        }
    });

    // 3. Dual-Search Friend Matchmaking (Search by ID or Nickname)
    socket.on('friend_match', (targetQuery) => {
        const myId = Object.keys(players).find(key => players[key].socketId === socket.id);
        if (!myId) return;

        let opponent = null;
        
        // Scan the master database for a match on EITHER the ID or the Nickname
        for (const key in players) {
            if (key === targetQuery || players[key].nickname.toLowerCase() === targetQuery.toLowerCase()) {
                opponent = players[key];
                break;
            }
        }

        if (opponent && opponent.socketId && io.sockets.sockets.get(opponent.socketId)) {
            const room = `room_${myId}_${opponent.id}`;
            socket.join(room);
            const oppSocket = io.sockets.sockets.get(opponent.socketId);
            oppSocket.join(room);

            const myName = players[myId].nickname || myId;
            const oppName = opponent.nickname || opponent.id;

            io.to(socket.id).emit('match_start', { color: 0, room: room, opponent: oppName });
            io.to(oppSocket.id).emit('match_start', { color: 1, room: room, opponent: myName });
        } else {
            socket.emit('error_msg', 'Player not found or offline.');
        }
    });

    // 4. In-Game Routing
    socket.on('make_move', (data) => {
        socket.to(data.room).emit('opponent_move', data);
    });

    socket.on('disconnect', () => {
        const index = waitingQueue.findIndex(id => players[id] && players[id].socketId === socket.id);
        if (index !== -1) waitingQueue.splice(index, 1);
    });
});

// Helper Function: The Name Bouncer
function handleNameUpdate(id, newName, socket) {
    if (!newName || newName.trim() === '') return;
    
    // Scan all OTHER players to see if the name is taken
    const nameTaken = Object.values(players).some(p => p.id !== id && p.nickname.toLowerCase() === newName.toLowerCase());
    
    if (nameTaken) {
        socket.emit('profile_error', 'Nickname already taken! Please choose another.');
    } else {
        players[id].nickname = newName.trim();
        socket.emit('profile_success', newName.trim());
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Enterprise Sentinel Server running on port ${PORT}`);
});