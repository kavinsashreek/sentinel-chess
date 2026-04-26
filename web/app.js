import createChessModule from './chessEngine.js';

let Module, game;
let myId = '';
const socket = io("http://192.168.29.98:3000");

let mode = 'AI'; 
let myColor = 0; 
let roomName = '';
let selectedSquare = null;
let currentMatchData = { opponent: '', date: '', moves: [] };

let replayIndex = 0;
let previousEval = 0;
let reviewStats = { blunders: 0, mistakes: 0, good: 0 };

let learnProgress = 0; 
let learnTrackSet = false;

const LESSONS = [
    { 
        title: "Lesson 1: The Rook", 
        desc: "Rooks move in straight lines. Click your Rook and capture the enemy pawn.", 
        targetMoves: [{sx:4, sy:4, ex:4, ey:1}], 
        setup: (g) => { g.setCustomPiece(4, 4, 3, 0); g.setCustomPiece(4, 1, 0, 1); g.forceTurn(0); } 
    },
    { 
        title: "Lesson 2: Mate in One", 
        desc: "Find the single move that traps the opponent's king.", 
        targetMoves: [{sx:4, sy:6, ex:4, ey:7}], 
        setup: (g) => { g.setCustomPiece(4, 6, 4, 0); g.setCustomPiece(4, 7, 5, 1); g.setCustomPiece(3, 7, 3, 1); g.forceTurn(0); } 
    },
    { 
        title: "Lesson 3: The Knight Fork", 
        desc: "Use your Knight to attack two high-value pieces at once.", 
        targetMoves: [{sx:3, sy:4, ex:2, ey:2}], 
        setup: (g) => { g.setCustomPiece(3, 4, 1, 0); g.setCustomPiece(1, 2, 5, 1); g.setCustomPiece(4, 1, 3, 1); g.forceTurn(0); } 
    }
];

let timerInterval = null;
let useTimer = false;
let startingTimeMins = 0;
let timeWhite = 0, timeBlack = 0;

const UI = {
    board: document.getElementById('chessboard'),
    status: document.getElementById('status'),
    menu: document.getElementById('primaryMenu'),
    alert: document.getElementById('floatingAlert'),
    analysis: document.getElementById('analysisBadge'),
    tMe: document.getElementById('timerMe'),
    tOpp: document.getElementById('timerOpponent'),
    instruction: document.getElementById('learnInstruction')
};

const PIECE_IMAGES = {
    0: { 0: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/wP.svg', 1: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/bP.svg' },
    1: { 0: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/wN.svg', 1: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/bN.svg' },
    2: { 0: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/wB.svg', 1: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/bB.svg' },
    3: { 0: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/wR.svg', 1: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/bR.svg' },
    4: { 0: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/wQ.svg', 1: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/bQ.svg' },
    5: { 0: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/wK.svg', 1: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/bK.svg' }
};

const COLUMNS = ['a','b','c','d','e','f','g','h'];
const toNotation = (x, y) => `${COLUMNS[x]}${8-y}`;

const SOUNDS = {
    move: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_standard_/default/move-self.mp3'),
    capture: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_standard_/default/capture.mp3')
};

async function init() {
    Module = await createChessModule();
    game = new Module.Game();
    createBoardUI();

    myId = localStorage.getItem('sentinel_id');
    if (!myId) {
        myId = Math.random().toString(36).substring(2, 8).toUpperCase();
        localStorage.setItem('sentinel_id', myId);
    }
    document.getElementById('myPlayerId').innerText = myId;
    socket.emit('register_user', myId);

    learnTrackSet = localStorage.getItem('sentinel_learn_track_set') === 'true';
    learnProgress = parseInt(localStorage.getItem('sentinel_learn') || '0');

    setupEventListeners();
    loadFriendsList();
    loadHistoryList();
    renderLearnTab();
}

function setupEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        showPage(e.target.dataset.target);
    }));

    document.querySelectorAll('.btn-time').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-time').forEach(b => b.classList.remove('selected-time'));
            e.target.classList.add('selected-time');
            startingTimeMins = parseInt(e.target.dataset.time);
            document.getElementById('customTimeInput').value = '';
        });
    });

    document.getElementById('customTimeInput').addEventListener('input', (e) => {
        document.querySelectorAll('.btn-time').forEach(b => b.classList.remove('selected-time'));
        startingTimeMins = parseInt(e.target.value);
        if(isNaN(startingTimeMins) || startingTimeMins < 0) startingTimeMins = 0;
    });

    document.getElementById('btnSinglePlayer').addEventListener('click', () => {
        UI.menu.classList.add('hidden');
        document.getElementById('difficultySelector').classList.remove('hidden');
    });

    document.getElementById('btnPlayFriend').addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.nav-btn[data-target="friendsPage"]').classList.add('active');
        showPage('friendsPage');
    });

    document.getElementById('btnRandomMatch').addEventListener('click', () => {
        socket.emit('random_match');
        document.getElementById('btnRandomMatch').innerText = "Searching...";
    });

    document.querySelectorAll('.btn-diff').forEach(btn => {
        btn.addEventListener('click', (e) => {
            mode = 'AI'; myColor = 0; currentMatchData.opponent = 'AI Engine';
            game.setDifficulty(parseInt(e.target.dataset.level));
            startMatch();
        });
    });

    document.getElementById('btnAddFriend').addEventListener('click', () => {
        const fId = document.getElementById('friendIdInput').value.toUpperCase();
        if (fId.length === 6 && fId !== myId) {
            let friends = JSON.parse(localStorage.getItem('sentinel_friends') || '[]');
            if (!friends.includes(fId)) { friends.push(fId); localStorage.setItem('sentinel_friends', JSON.stringify(friends)); }
            document.getElementById('friendIdInput').value = '';
            loadFriendsList();
        }
    });

    document.getElementById('friendsList').addEventListener('click', (e) => {
        if(e.target.tagName === 'BUTTON') socket.emit('friend_match', e.target.dataset.id);
    });

    document.getElementById('historyList').addEventListener('click', (e) => {
        if(e.target.tagName === 'BUTTON') startReplay(parseInt(e.target.dataset.index));
    });

    document.querySelectorAll('.btn-track').forEach(btn => {
        btn.addEventListener('click', (e) => {
            learnProgress = parseInt(e.target.dataset.track);
            localStorage.setItem('sentinel_learn', learnProgress.toString());
            localStorage.setItem('sentinel_learn_track_set', 'true');
            learnTrackSet = true;
            renderLearnTab();
        });
    });

    document.getElementById('btnResetTrack').addEventListener('click', () => {
        learnTrackSet = false;
        localStorage.removeItem('sentinel_learn_track_set');
        renderLearnTab();
    });

    document.getElementById('btnStartLesson').addEventListener('click', () => loadScenario(learnProgress));
    document.getElementById('btnSkipRecap').addEventListener('click', () => loadScenario(learnProgress));
    document.getElementById('recapButtons').addEventListener('click', (e) => {
        if(e.target.tagName === 'BUTTON') loadScenario(parseInt(e.target.dataset.lesson));
    });

    document.getElementById('btnResign').addEventListener('click', () => {
        if (mode === 'LEARN') {
            document.getElementById('btnReturnHome').click(); 
        } else {
            triggerEndgame(myColor === 0 ? 1 : 0, "Resignation");
        }
    });
    
    document.getElementById('btnReturnHome').addEventListener('click', () => {
        document.getElementById('endgameScreen').classList.add('hidden');
        UI.menu.classList.remove('hidden');
        document.getElementById('difficultySelector').classList.add('hidden');
        document.getElementById('btnRandomMatch').innerText = "Random Match";
        showPage(mode === 'LEARN' ? 'learnPage' : 'homePage');
        loadHistoryList(); 
        renderLearnTab();
    });

    document.getElementById('btnEndReview').addEventListener('click', () => {
        document.getElementById('reviewScreen').classList.add('hidden');
        showPage('historyPage');
    });

    document.getElementById('btnHint').addEventListener('click', () => {
        if (mode === 'REPLAY' || mode === 'LEARN' || game.getCurrentTurn() !== myColor) return;
        const hint = game.getHint();
        if (hint.get(0) !== -1) {
            clearHighlights();
            document.querySelector(`.square[data-x="${hint.get(0)}"][data-y="${hint.get(1)}"]`).style.boxShadow = "inset 0 0 0 6px #00c6ff";
            document.querySelector(`.square[data-x="${hint.get(2)}"][data-y="${hint.get(3)}"]`).style.boxShadow = "inset 0 0 0 6px #00c6ff";
        }
        hint.delete();
    });

    document.getElementById('btnNextReplay').addEventListener('click', executeNextReplayMove);
}

function showPage(pageId) {
    document.querySelectorAll('.page-container').forEach(p => p.classList.remove('active-page', 'hidden'));
    document.getElementById(pageId).classList.add('active-page');
    document.querySelectorAll('.nav-btn').forEach(b => {
        if(b.dataset.target === pageId) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
}

function renderLearnTab() {
    const onboardUI = document.getElementById('learnOnboardingUI');
    const recapUI = document.getElementById('learnRecapUI');
    const mainUI = document.getElementById('learnMainUI');
    
    onboardUI.classList.add('hidden');
    recapUI.classList.add('hidden');
    mainUI.classList.add('hidden');

    if (!learnTrackSet) {
        onboardUI.classList.remove('hidden');
        return;
    }

    if (learnProgress >= LESSONS.length) {
        recapUI.classList.remove('hidden'); 
        document.getElementById('btnSkipRecap').innerText = "Curriculum Complete!";
        document.getElementById('btnSkipRecap').disabled = true;
    } else {
        if (learnProgress > 0) {
            recapUI.classList.remove('hidden');
        } else {
            mainUI.classList.remove('hidden');
            document.getElementById('lessonTitleDisplay').innerText = LESSONS[learnProgress].title;
            document.getElementById('lessonDescription').innerText = LESSONS[learnProgress].desc;
        }
    }

    const recapBtns = document.getElementById('recapButtons');
    recapBtns.innerHTML = '';
    const maxRecap = Math.min(learnProgress, LESSONS.length);
    for(let i = 0; i < maxRecap; i++) {
        recapBtns.innerHTML += `<button class="action-btn secondary hover-lift" data-lesson="${i}">Review: ${LESSONS[i].title}</button>`;
    }
}

function loadScenario(index) {
    mode = 'LEARN'; myColor = 0;
    const lesson = LESSONS[index];
    
    game.clearBoardForScenario();
    lesson.setup(game); 
    
    UI.instruction.innerText = `${lesson.title} - ${lesson.desc}`;
    UI.instruction.classList.remove('hidden');
    UI.tMe.classList.add('hidden'); UI.tOpp.classList.add('hidden');
    document.getElementById('btnHint').classList.add('hidden');
    document.getElementById('btnNextReplay').classList.add('hidden');
    document.getElementById('btnResign').innerText = "Exit Lesson";
    document.getElementById('btnResign').classList.remove('hidden');
    
    updateBoardFromEngine();
    showPage('gamePage');
    UI.status.innerText = "Solve the Puzzle";
}

function verifyLearnMove(startX, startY, endX, endY) {
    const targetMove = LESSONS[learnProgress].targetMoves[0];
    if (startX === targetMove.sx && startY === targetMove.sy && endX === targetMove.ex && endY === targetMove.ey) {
        UI.alert.innerText = "EXCELLENT!"; UI.alert.classList.remove('hidden');
        
        setTimeout(() => { 
            UI.alert.classList.add('hidden'); 
            if (learnProgress < LESSONS.length - 1) {
                learnProgress++;
                localStorage.setItem('sentinel_learn', learnProgress.toString());
                loadScenario(learnProgress); // Auto-advances to the next lesson!
            } else {
                learnProgress = LESSONS.length;
                localStorage.setItem('sentinel_learn', learnProgress.toString());
                document.getElementById('btnReturnHome').click();
            }
        }, 1500);
        
    } else {
        UI.alert.innerText = "TRY AGAIN"; UI.alert.classList.remove('hidden');
        setTimeout(() => { 
            UI.alert.classList.add('hidden');
            loadScenario(Math.min(learnProgress, LESSONS.length - 1)); 
        }, 1500);
    }
}

function startMatch() {
    game.startNewGame();
    selectedSquare = null;
    currentMatchData.date = new Date().toLocaleString();
    currentMatchData.moves = [];
    
    useTimer = startingTimeMins > 0;
    clearInterval(timerInterval);
    
    if (useTimer) {
        timeWhite = startingTimeMins * 60; timeBlack = startingTimeMins * 60;
        UI.tMe.classList.remove('hidden'); UI.tOpp.classList.remove('hidden');
        UI.tMe.innerText = formatTime(timeWhite); UI.tOpp.innerText = formatTime(timeBlack);
        timerInterval = setInterval(updateTimers, 1000);
    } else {
        UI.tMe.classList.add('hidden'); UI.tOpp.classList.add('hidden');
    }
    
    UI.instruction.classList.add('hidden');
    updateBoardFromEngine();
    document.getElementById('btnNextReplay').classList.add('hidden');
    document.getElementById('btnHint').classList.remove('hidden');
    document.getElementById('btnResign').innerText = "Resign";
    document.getElementById('btnResign').classList.remove('hidden');
    UI.analysis.classList.add('hidden');
    clearHighlights();
    
    showPage('gamePage');
    updateStatusText();
}

function updateTimers() {
    if (mode === 'REPLAY' || mode === 'LEARN' || !useTimer) return;
    if (game.getCurrentTurn() === 0) timeWhite--; else timeBlack--;
    
    UI.tMe.innerText = formatTime(myColor === 0 ? timeWhite : timeBlack);
    UI.tOpp.innerText = formatTime(myColor === 0 ? timeBlack : timeWhite);

    if (timeWhite <= 0) triggerEndgame(1, "Time Out");
    if (timeBlack <= 0) triggerEndgame(0, "Time Out");
}
function formatTime(secs) { const m = Math.floor(secs / 60); const s = secs % 60; return `${m}:${s < 10 ? '0' : ''}${s}`; }

function createBoardUI() {
    UI.board.innerHTML = '';
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const sq = document.createElement('div');
            sq.className = `square ${(x + y) % 2 === 0 ? 'light' : 'dark'}`;
            sq.dataset.x = x; sq.dataset.y = y;
            sq.addEventListener('click', handleSquareClick);
            UI.board.appendChild(sq);
        }
    }
}

function clearHighlights() {
    document.querySelectorAll('.square').forEach(sq => {
        sq.classList.remove('selected', 'hint-dot', 'hint-capture', 'last-move');
        sq.style.boxShadow = '';
    });
}

function updateBoardFromEngine() {
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const sq = document.querySelector(`.square[data-x="${x}"][data-y="${y}"]`);
            const type = game.getPieceTypeAt(x, y); const color = game.getPieceColorAt(x, y);
            let img = sq.querySelector('img');
            if (type !== -1 && type !== 6) {
                if (!img) { img = document.createElement('img'); img.className = 'piece-img'; sq.appendChild(img); }
                img.src = PIECE_IMAGES[type][color];
            } else if (img) sq.removeChild(img);
        }
    }
}

function updateStatusText() {
    if (mode === 'MULTIPLAYER') UI.status.innerText = game.getCurrentTurn() === myColor ? "Your Turn" : "Opponent Thinking...";
    else if (mode === 'REPLAY') UI.status.innerText = "Watching Replay - Analysis Mode";
    else if (mode === 'LEARN') return; 
    else UI.status.innerText = game.getCurrentTurn() === 0 ? "White to Move" : "AI Computing...";
}

function handleSquareClick(e) {
    if (mode === 'REPLAY') return; 
    if ((mode === 'MULTIPLAYER' || mode === 'LEARN') && game.getCurrentTurn() !== myColor) return;
    
    const x = parseInt(e.currentTarget.dataset.x), y = parseInt(e.currentTarget.dataset.y);

    if (selectedSquare === null) {
        if (game.getPieceColorAt(x, y) === game.getCurrentTurn()) {
            selectedSquare = { x, y };
            clearHighlights(); e.currentTarget.classList.add('selected');
            const moves = game.getLegalMovesForUI(x, y);
            for (let i = 0; i < moves.size(); i += 2) {
                const tx = moves.get(i), ty = moves.get(i + 1);
                const sq = document.querySelector(`.square[data-x="${tx}"][data-y="${ty}"]`);
                sq.classList.add(game.getPieceColorAt(tx, ty) !== -1 ? 'hint-capture' : 'hint-dot');
            }
            moves.delete();
        }
    } else {
        executeMove(selectedSquare.x, selectedSquare.y, x, y, true);
        selectedSquare = null;
    }
}

function executeMove(startX, startY, endX, endY, isSelfInitiated) {
    const isCapture = game.getPieceColorAt(endX, endY) !== -1;
    const isLegal = game.makeMove(startX, startY, endX, endY);
    
    if (isLegal) {
        clearHighlights();
        document.querySelector(`.square[data-x="${startX}"][data-y="${startY}"]`).classList.add('last-move');
        document.querySelector(`.square[data-x="${endX}"][data-y="${endY}"]`).classList.add('last-move');
        isCapture ? SOUNDS.capture.play() : SOUNDS.move.play();
        
        updateBoardFromEngine();

        if (mode === 'LEARN') {
            verifyLearnMove(startX, startY, endX, endY);
            return true;
        }

        currentMatchData.moves.push({ startX, startY, endX, endY });
        
        const state = game.getGameState();
        if (state === 1) { UI.alert.classList.remove('hidden'); setTimeout(() => UI.alert.classList.add('hidden'), 2000); }

        if (state === 2) triggerEndgame(game.getCurrentTurn() === 0 ? 1 : 0, "Checkmate");
        else if (state === 3) triggerEndgame(-1, "Stalemate");
        else {
            updateStatusText();
            if (isSelfInitiated && mode === 'MULTIPLAYER') {
                socket.emit('make_move', { room: roomName, startX, startY, endX, endY });
            } else if (isSelfInitiated && mode === 'AI') {
                setTimeout(() => { 
                    const aiMove = game.makeAIMove();
                    const aiSX = aiMove.get(0), aiSY = aiMove.get(1), aiEX = aiMove.get(2), aiEY = aiMove.get(3);
                    aiMove.delete();
                    
                    if (aiSX !== -1) {
                        currentMatchData.moves.push({ startX: aiSX, startY: aiSY, endX: aiEX, endY: aiEY });
                        clearHighlights();
                        document.querySelector(`.square[data-x="${aiSX}"][data-y="${aiSY}"]`).classList.add('last-move');
                        document.querySelector(`.square[data-x="${aiEX}"][data-y="${aiEY}"]`).classList.add('last-move');
                        SOUNDS.move.play();
                    }
                    
                    updateBoardFromEngine(); updateStatusText();
                    const state2 = game.getGameState();
                    if (state2 === 1) { UI.alert.classList.remove('hidden'); setTimeout(() => UI.alert.classList.add('hidden'), 2000); }
                    if (state2 === 2) triggerEndgame(1, "Checkmate");
                    else if (state2 === 3) triggerEndgame(-1, "Stalemate");
                }, 400);
            }
        }
    }
    return isLegal;
}

function triggerEndgame(winnerColor, reason) {
    clearInterval(timerInterval);
    if (mode !== 'REPLAY' && mode !== 'LEARN' && currentMatchData.moves.length > 0) {
        let history = JSON.parse(localStorage.getItem('sentinel_history') || '[]');
        currentMatchData.result = winnerColor === myColor ? 'Won' : (winnerColor === -1 ? 'Draw' : 'Lost');
        history.unshift(currentMatchData); 
        localStorage.setItem('sentinel_history', JSON.stringify(history));
    }
    const screen = document.getElementById('endgameScreen');
    const title = document.getElementById('endgameTitle');
    screen.className = 'endgame-overlay'; 
    if (winnerColor === -1) { screen.classList.add('draw'); title.innerText = "DRAW"; } 
    else if (winnerColor === myColor) { screen.classList.add('win'); title.innerText = "YOU WON!"; } 
    else { screen.classList.add('loss'); title.innerText = "YOU LOST"; }
    document.getElementById('endgameSub').innerText = reason;
    screen.classList.remove('hidden');
}

socket.on('match_start', (data) => {
    mode = 'MULTIPLAYER'; myColor = data.color; roomName = data.room;
    currentMatchData.opponent = data.opponent;
    startMatch();
});
socket.on('opponent_move', (data) => executeMove(data.startX, data.startY, data.endX, data.endY, false));
socket.on('error_msg', (msg) => alert(msg));

function loadFriendsList() {
    const list = document.getElementById('friendsList');
    const friends = JSON.parse(localStorage.getItem('sentinel_friends') || '[]');
    list.innerHTML = '';
    if (friends.length === 0) {
        list.innerHTML = '<li><span style="color:#8b949e">No friends added yet.</span></li>';
    } else {
        friends.forEach(f => {
            const li = document.createElement('li');
            li.innerHTML = `<span>ID: <b>${f}</b></span>`;
            const btn = document.createElement('button');
            btn.innerText = "Challenge";
            btn.dataset.id = f;
            li.appendChild(btn);
            list.appendChild(li);
        });
    }
}

function loadHistoryList() {
    const list = document.getElementById('historyList');
    const history = JSON.parse(localStorage.getItem('sentinel_history') || '[]');
    list.innerHTML = '';
    
    if (history.length === 0) {
        list.innerHTML = '<li><span style="color:#8b949e">No match history found.</span></li>';
    } else {
        history.forEach((m, i) => {
            let c = m.result === 'Won' ? 'color:#3fb950' : (m.result === 'Lost' ? 'color:#f85149' : 'color:#8b949e');
            const li = document.createElement('li');
            li.innerHTML = `<div><strong style="${c}">${m.result}</strong> vs ${m.opponent}<br><small style="color:#8b949e">${m.date}</small></div>`;
            
            const btn = document.createElement('button');
            btn.innerText = "Replay & Analyze";
            btn.dataset.index = i;
            
            li.appendChild(btn);
            list.appendChild(li);
        });
    }
}

function startReplay(index) {
    const history = JSON.parse(localStorage.getItem('sentinel_history') || '[]');
    currentMatchData = history[index];
    
    if(!currentMatchData.moves || currentMatchData.moves.length === 0) {
        alert("Corrupted match data."); return;
    }

    mode = 'REPLAY'; replayIndex = 0;
    reviewStats = { blunders: 0, mistakes: 0, good: 0 };
    
    game.startNewGame();
    previousEval = game.evaluateBoard();
    updateBoardFromEngine();
    
    document.getElementById('btnHint').classList.add('hidden');
    document.getElementById('btnResign').classList.add('hidden');
    document.getElementById('btnNextReplay').classList.remove('hidden');
    UI.tMe.classList.add('hidden'); UI.tOpp.classList.add('hidden');
    UI.instruction.classList.add('hidden');
    UI.analysis.classList.add('hidden');
    
    showPage('gamePage');
    updateStatusText();
}

function executeNextReplayMove() {
    if (replayIndex < currentMatchData.moves.length) {
        const move = currentMatchData.moves[replayIndex];
        const isCapture = game.getPieceColorAt(move.endX, move.endY) !== -1;
        const turnWhoJustMoved = game.getCurrentTurn(); 
        
        const hint = game.getHint();
        const bestX = hint.get(0), bestY = hint.get(1), bestEX = hint.get(2), bestEY = hint.get(3);
        hint.delete();
        
        game.makeMove(move.startX, move.startY, move.endX, move.endY);
        
        const currentEval = game.evaluateBoard(); 
        const delta = currentEval - previousEval; 
        let evaluationDrop = turnWhoJustMoved === 0 ? -delta : delta;
        
        let bestMoveStr = bestX !== -1 ? `${toNotation(bestX, bestY)}→${toNotation(bestEX, bestEY)}` : "None";

        UI.analysis.className = 'analysis-badge hidden'; 
        if (evaluationDrop > 100) {
            reviewStats.blunders++;
            UI.analysis.innerHTML = `BLUNDER<br><small style="font-size:0.7rem; color:#fff">Best: ${bestMoveStr}</small>`; 
            UI.analysis.classList.add('analysis-blunder');
        } else if (evaluationDrop > 40) {
            reviewStats.mistakes++;
            UI.analysis.innerHTML = `MISTAKE<br><small style="font-size:0.7rem; color:#fff">Best: ${bestMoveStr}</small>`; 
            UI.analysis.classList.add('analysis-mistake');
        } else {
            reviewStats.good++;
            UI.analysis.innerText = "GOOD MOVE"; 
            UI.analysis.classList.add('analysis-good');
        }
        UI.analysis.classList.remove('hidden');
        
        previousEval = currentEval;
        
        clearHighlights();
        document.querySelector(`.square[data-x="${move.startX}"][data-y="${move.startY}"]`).classList.add('last-move');
        document.querySelector(`.square[data-x="${move.endX}"][data-y="${move.endY}"]`).classList.add('last-move');
        
        isCapture ? SOUNDS.capture.play() : SOUNDS.move.play();
        updateBoardFromEngine();
        replayIndex++;
    } else {
        showReviewScreen();
    }
}

function showReviewScreen() {
    const total = reviewStats.blunders + reviewStats.mistakes + reviewStats.good;
    let accuracy = total > 0 ? Math.round((reviewStats.good / total) * 100) : 0;
    
    document.getElementById('reviewAccuracy').innerText = `${accuracy}%`;
    document.getElementById('revGood').innerText = reviewStats.good;
    document.getElementById('revMistake').innerText = reviewStats.mistakes;
    document.getElementById('revBlunder').innerText = reviewStats.blunders;
    
    const mot = document.getElementById('reviewMotivation');
    if (accuracy >= 85) mot.innerText = "Brilliant play! You controlled the board like a Grandmaster.";
    else if (accuracy >= 60) mot.innerText = "Solid game! A few inaccuracies, but good overall structure.";
    else mot.innerText = "Tough game. Study the blunders shown in the replay to crush it next time!";
    
    document.getElementById('reviewScreen').classList.remove('hidden');
}

init();