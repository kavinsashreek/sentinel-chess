import createChessModule from './chessEngine.js';

let Module, game;
let myId = '';
const socket = io("https://sentinel-chess.onrender.com"); 

let mode = 'AI'; 
let myColor = 0; 
let roomName = '';
let selectedSquare = null;
let currentMatchData = { opponent: '', moves: [] };
let hintsRemaining = 2; 

// Track the current perspective (2D/3D)
let perspective = '2D'; 

const UI = {
    board: document.getElementById('chessboard'),
    status: document.getElementById('status'),
    menu: document.getElementById('primaryMenu'),
    alert: document.getElementById('floatingAlert'),
    hintBtn: document.getElementById('btnHint'),
    hintCount: document.getElementById('hintCount'),
    nickInput: document.getElementById('nicknameInput'),
    myDisplayName: document.getElementById('myDisplayName'),
    viewBtn: document.getElementById('btnToggleView'),
    capturedMe: document.getElementById('capturedMe'),
    capturedOpp: document.getElementById('capturedOpponent')
};

// Isometric/3D piece set (Hack method: Opposite Skew will make them stand)
const PIECE_IMAGES = {
    0: { 0: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/wP.svg', 1: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/bP.svg' },
    1: { 0: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/wN.svg', 1: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/bN.svg' },
    2: { 0: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/wB.svg', 1: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/bB.svg' },
    3: { 0: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/wR.svg', 1: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/bR.svg' },
    4: { 0: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/wQ.svg', 1: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/bQ.svg' },
    5: { 0: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/wK.svg', 1: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/bK.svg' }
};

const COLUMNS = ['a','b','c','d','e','f','g','h'];
const SOUNDS = { move: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_standard_/default/move-self.mp3'), capture: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_standard_/default/capture.mp3') };

async function init() {
    Module = await createChessModule(); game = new Module.Game(); createBoardUI();

    myId = localStorage.getItem('sentinel_id');
    if (!myId) { myId = Math.random().toString(36).substring(2, 8).toUpperCase(); localStorage.setItem('sentinel_id', myId); }
    document.getElementById('myPlayerId').innerText = myId;
    
    // Default Nickname Handling
    const myNickname = localStorage.getItem('sentinel_nick_secure') || '';
    UI.nickInput.value = myNickname; UI.myDisplayName.innerText = myNickname || "You";
    socket.emit('register_user', { id: myId, name: myNickname });

    // Handle initial orientation: Portrait only for menus
    // This requires the Capacitor Orientation plugin to be installed.
    // If it's not installed, rotation is simply unlocked always.
    try {
        await window.Capacitor.Plugins.App.requestLock({orientation: 'portrait'});
    } catch (e) { console.log("Orientation plugin required for menu portrait lock."); }

    setupEventListeners(); loadHistoryList();
}

function setupEventListeners() {
    UI.nickInput.addEventListener('change', (e) => socket.emit('update_profile', { id: myId, name: e.target.value }));
    socket.on('profile_error', (msg) => { alert(msg); UI.nickInput.value = localStorage.getItem('sentinel_nick_secure') || ''; });
    socket.on('profile_success', (name) => { localStorage.setItem('sentinel_nick_secure', name); UI.myDisplayName.innerText = name; UI.nickInput.style.borderColor = "#3fb950"; setTimeout(() => UI.nickInput.style.borderColor = "#30363d", 1000); });
    socket.on('leaderboard_data', (players) => renderLeaderboard(players));
    document.querySelector('[data-target="leaderboardPage"]').addEventListener('click', () => socket.emit('get_leaderboard'));

    document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); e.target.classList.add('active'); showPage(e.target.dataset.target);
    }));

    // Toggle 2D/3D
    UI.viewBtn.addEventListener('click', () => {
        if(perspective === '2D') { perspective = '3D'; UI.board.classList.add('board-3d'); }
        else { perspective = '2D'; UI.board.classList.remove('board-3d'); }
    });

    document.getElementById('btnSinglePlayer').addEventListener('click', () => { UI.menu.classList.add('hidden'); document.getElementById('difficultySelector').classList.remove('hidden'); });
    document.querySelectorAll('.btn-diff').forEach(btn => { btn.addEventListener('click', (e) => { mode = 'AI'; myColor = 0; currentMatchData.opponent = 'AI'; game.setDifficulty(parseInt(e.target.dataset.level)); startMatch(); }); });

    document.getElementById('btnResign').addEventListener('click', () => triggerEndgame(myColor === 0 ? 1 : 0, "Resignation"));
    document.getElementById('btnReturnHome').addEventListener('click', () => returnToHome());

    UI.hintBtn.addEventListener('click', () => {
        if (game.getCurrentTurn() !== myColor) return;
        if (hintsRemaining <= 0) return alert("No hints remaining!");
        const hint = game.getHint();
        if (hint.get(0) !== -1) {
            clearHighlights();
            document.querySelector(`.square[data-x="${hint.get(0)}"][data-y="${hint.get(1)}"]`).style.boxShadow = "inset 0 0 0 6px #00c6ff";
            document.querySelector(`.square[data-x="${hint.get(2)}"][data-y="${hint.get(3)}"]`).style.boxShadow = "inset 0 0 0 6px #00c6ff";
            hintsRemaining--; UI.hintCount.innerText = hintsRemaining;
        }
        hint.delete();
    });
}

function showPage(pageId) { document.querySelectorAll('.page-container').forEach(p => p.classList.add('hidden')); document.getElementById(pageId).classList.remove('hidden', 'active-page'); document.getElementById(pageId).classList.add('active-page'); }

function startMatch() {
    game.startNewGame(); selectedSquare = null; currentMatchData.moves = [];
    hintsRemaining = 2; UI.hintCount.innerText = hintsRemaining;
    UI.capturedMe.innerHTML = ''; UI.capturedOpp.innerHTML = '';
    
    // 1. Fullscreen Immersive Mode (Requires StatusBar Plugin)
    try { window.Capacitor.Plugins.App.hide(); } catch (e) {} 
    
    // 2. Unlock Screen Rotation during the game
    try { window.Capacitor.Plugins.App.requestLock({orientation: 'any'}); } catch (e) {}

    // Show captured piece tables (will auto-adjust for orientation)
    document.getElementById('capturedTableLeft').classList.remove('hidden');
    document.getElementById('capturedTableRight').classList.remove('hidden');
    
    updateBoardFromEngine(); showPage('gamePage'); UI.status.innerText = "White to Move";
}

function returnToHome() {
    clearInterval(timerInterval);
    try { window.Capacitor.Plugins.App.show(); } catch (e) {} // Show native bars again
    // Lock back to Portrait for menus
    try { window.Capacitor.Plugins.App.requestLock({orientation: 'portrait'}); } catch (e) {}
    
    showPage('homePage'); UI.menu.classList.remove('hidden'); document.getElementById('difficultySelector').classList.add('hidden');
    document.getElementById('capturedTableLeft').classList.add('hidden');
    document.getElementById('capturedTableRight').classList.add('hidden');
}

function createBoardUI() {
    UI.board.innerHTML = '';
    for (let y = 0; y < 8; y++) { for (let x = 0; x < 8; x++) {
        const sq = document.createElement('div'); sq.className = `square ${(x + y) % 2 === 0 ? 'light' : 'dark'}`; sq.dataset.x = x; sq.dataset.y = y; sq.addEventListener('click', handleSquareClick); UI.board.appendChild(sq);
    } }
}

function clearHighlights() { document.querySelectorAll('.square').forEach(sq => { sq.classList.remove('selected', 'hint-dot', 'hint-capture'); sq.style.boxShadow = ''; }); }

function updateBoardFromEngine() {
    for (let y = 0; y < 8; y++) { for (let x = 0; x < 8; x++) {
        const sq = document.querySelector(`.square[data-x="${x}"][data-y="${y}"]`);
        const type = game.getPieceTypeAt(x, y); const color = game.getPieceColorAt(x, y);
        let img = sq.querySelector('img');
        if (type !== -1 && type !== 6) { if (!img) { img = document.createElement('img'); img.className = 'piece-img'; sq.appendChild(img); } img.src = PIECE_IMAGES[type][color];
        } else if (img) sq.removeChild(img);
    } }
}

function addCapturedPiece(type, color) {
    const img = document.createElement('img'); img.src = PIECE_IMAGES[type][color];
    if (color !== myColor) UI.capturedOpp.appendChild(img);
    else UI.capturedMe.appendChild(img);
}

function handleSquareClick(e) {
    if (game.getCurrentTurn() !== myColor) return;
    const x = parseInt(e.currentTarget.dataset.x), y = parseInt(e.currentTarget.dataset.y);
    if (selectedSquare === null) {
        if (game.getPieceColorAt(x, y) === game.getCurrentTurn()) { selectedSquare = { x, y }; clearHighlights(); e.currentTarget.classList.add('selected'); }
    } else { executeMove(selectedSquare.x, selectedSquare.y, x, y); selectedSquare = null; }
}

function executeMove(startX, startY, endX, endY) {
    const targetType = game.getPieceTypeAt(endX, endY); const targetColor = game.getPieceColorAt(endX, endY);
    const isCapture = targetColor !== -1;
    if (game.makeMove(startX, startY, endX, endY)) {
        clearHighlights();
        if(isCapture) { SOUNDS.capture.play(); addCapturedPiece(targetType, targetColor); } else SOUNDS.move.play();
        updateBoardFromEngine(); currentMatchData.moves.push({ startX, startY, endX, endY });
        
        const state = game.getGameState();
        if (state === 2) return triggerEndgame(myColor === 0 ? 0 : 1, "Checkmate"); else if (state === 3) return triggerEndgame(-1, "Stalemate");
        
        // AI Turn
        UI.status.innerText = "AI Computing...";
        setTimeout(() => { 
            const aiMove = game.makeAIMove(); const aiCapture = game.getPieceColorAt(aiMove.get(2), aiMove.get(3)) !== -1;
            if(aiMove.get(0) !== -1) { SOUNDS.move.play(); updateBoardFromEngine(); currentMatchData.moves.push({ startX:aiMove.get(0), startY:aiMove.get(1), endX:aiMove.get(2), endY:aiMove.get(3) }); }
            aiMove.delete(); UI.status.innerText = "White to Move";
            const state2 = game.getGameState();
            if (state2 === 2) triggerEndgame(1, "Checkmate"); else if (state2 === 3) triggerEndgame(-1, "Stalemate");
        }, 400);
    }
}

function triggerEndgame(winnerColor, reason) { document.getElementById('endgameScreen').classList.remove('hidden'); document.getElementById('endgameTitle').innerText = winnerColor === myColor ? "WON!" : (winnerColor === -1 ? "DRAW" : "LOST"); document.getElementById('endgameSub').innerText = reason; }
function renderLeaderboard(players) { const list = document.getElementById('leaderboardList'); list.innerHTML = ''; players.forEach((p, i) => list.innerHTML += `<li><span>#${i+1} <b>${p.nickname || p.id}</b></span><span style="color:#3fb950; font-weight:bold;">${p.elo} ELO</span></li>`); }

init();