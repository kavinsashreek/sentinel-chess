const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// The code is perfect. The block is just your local internet!
const MONGO_URI = "mongodb+srv://ksashreek08_db_user:kavin098@sentinelchess.3mm4sjc.mongodb.net/?appName=sentinelchess";

mongoose.connect(MONGO_URI)
    .then(() => console.log("Connected to MongoDB Atlas"))
    .catch(err => console.log("MongoDB connection error:", err));

// Define the Player Schema
const playerSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    nickname: { type: String, unique: true, sparse: true },
    elo: { type: Number, default: 1000 },
    matchesPlayed: { type: Number, default: 0 }
});
const Player = mongoose.model('Player', playerSchema);

app.use(express.static('web'));

const activeSockets = {}; 
const waitingQueue = [];

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('register_user', async (data) => {
        const { id, name } = data;
        let player = await Player.findOne({ id: id });
        
        if (!player) {
            player = new Player({ id: id, nickname: name || '' });
            await player.save();
        }
        
        activeSockets[id] = socket.id;
        socket.emit('profile_success', player.nickname || player.id);
    });

    socket.on('update_profile', async (data) => {
        try {
            // Check if nickname is taken by someone else
            const existing = await Player.findOne({ nickname: data.name });
            if (existing && existing.id !== data.id) {
                return socket.emit('profile_error', 'Nickname already taken!');
            }
            
            await Player.findOneAndUpdate({ id: data.id }, { nickname: data.name });
            socket.emit('profile_success', data.name);
        } catch (err) {
            socket.emit('profile_error', 'Update failed.');
        }
    });

    // Leaderboard Logic
    socket.on('get_leaderboard', async () => {
        const topPlayers = await Player.find().sort({ elo: -1 }).limit(10);
        socket.emit('leaderboard_data', topPlayers);
    });

    socket.on('random_match', async () => {
        const myId = Object.keys(activeSockets).find(key => activeSockets[key] === socket.id);
        if (!waitingQueue.includes(myId)) waitingQueue.push(myId);

        if (waitingQueue.length >= 2) {
            const p1Id = waitingQueue.shift();
            const p2Id = waitingQueue.shift();
            const room = `room_${p1Id}_${p2Id}`;
            
            const p1 = await Player.findOne({ id: p1Id });
            const p2 = await Player.findOne({ id: p2Id });

            io.to(activeSockets[p1Id]).emit('match_start', { color: 0, room, opponent: p2.nickname || p2.id });
            io.to(activeSockets[p2Id]).emit('match_start', { color: 1, room, opponent: p1.nickname || p1.id });
        }
    });

    socket.on('friend_match', async (targetQuery) => {
        const myId = Object.keys(activeSockets).find(key => activeSockets[key] === socket.id);
        if (!myId) return;

        // Scan DB for exact ID or Nickname
        const opponent = await Player.findOne({
            $or: [
                { id: targetQuery },
                { nickname: new RegExp(`^${targetQuery}$`, 'i') } // case-insensitive nickname search
            ]
        });

        if (opponent && activeSockets[opponent.id] && io.sockets.sockets.get(activeSockets[opponent.id])) {
            const room = `room_${myId}_${opponent.id}`;
            const oppSocketId = activeSockets[opponent.id];
            
            socket.join(room);
            io.sockets.sockets.get(oppSocketId).join(room);

            const p1 = await Player.findOne({ id: myId });

            io.to(socket.id).emit('match_start', { color: 0, room: room, opponent: opponent.nickname || opponent.id });
            io.to(oppSocketId).emit('match_start', { color: 1, room: room, opponent: p1.nickname || p1.id });
        } else {
            socket.emit('error_msg', 'Player not found or offline.');
        }
    });

    socket.on('make_move', (data) => {
        socket.to(data.room).emit('opponent_move', data);
    });

    socket.on('disconnect', () => {
        const myId = Object.keys(activeSockets).find(key => activeSockets[key] === socket.id);
        const index = waitingQueue.indexOf(myId);
        if (index !== -1) waitingQueue.splice(index, 1);
        if (myId) delete activeSockets[myId];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Enterprise Sentinel Server running on port ${PORT}`);
});