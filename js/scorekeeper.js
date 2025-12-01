class Player {
    constructor(data = {}) {
        this.id = Object.hasOwn(data, 'id') ? data.id : Date.now().toString();
        this.name = Object.hasOwn(data, 'name') ? data.name : '';
        this.createdAt = Object.hasOwn(data, 'createdAt') ? data.createdAt : new Date().toISOString();
    }
}

class Game {
    constructor(data = {}) {
        this.id = Object.hasOwn(data, 'id') ? data.id : Date.now().toString();
        this.players = Object.hasOwn(data, 'players') ? data.players : []; // Array of player IDs in turn order
        this.playerNames = Object.hasOwn(data, 'playerNames') ? data.playerNames : {}; // Map of player ID to name
        this.dealerIndex = Object.hasOwn(data, 'dealerIndex') ? data.dealerIndex : 0;
        this.scores = Object.hasOwn(data, 'scores') ? data.scores : {}; // Map of playerId -> [round1, round2, ...]
        this.currentRound = Object.hasOwn(data, 'currentRound') ? data.currentRound : 1;
        this.completed = Object.hasOwn(data, 'completed') ? data.completed : false;
        this.createdAt = Object.hasOwn(data, 'createdAt') ? data.createdAt : new Date().toISOString();
    }

    addScore(playerId, round, score) {
        if (!this.scores[playerId]) {
            this.scores[playerId] = [];
        }
        this.scores[playerId][round - 1] = parseInt(score);
    }

    getTotal(playerId) {
        if (!this.scores[playerId]) return 0;
        return this.scores[playerId].reduce((sum, score) => sum + (score || 0), 0);
    }

    getDealerForRound(round) {
        const dealerIndex = (this.dealerIndex + round - 1) % this.players.length;
        return this.players[dealerIndex];
    }

    isComplete() {
        // Check if all players have scores for all 5 rounds
        return this.players.every(playerId => {
            const playerScores = this.scores[playerId] || [];
            return playerScores.length === 5 && playerScores.every(s => s !== null && s !== undefined);
        });
    }
}

// IndexedDB Manager
class ScorekeeperDB {
    constructor() {
        this.dbName = 'ignyos.trepenta';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Players store
                if (!db.objectStoreNames.contains('players')) {
                    const playerStore = db.createObjectStore('players', { keyPath: 'id' });
                    playerStore.createIndex('name', 'name', { unique: false });
                    playerStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Games store
                if (!db.objectStoreNames.contains('games')) {
                    const gameStore = db.createObjectStore('games', { keyPath: 'id' });
                    gameStore.createIndex('createdAt', 'createdAt', { unique: false });
                    gameStore.createIndex('completed', 'completed', { unique: false });
                }
            };
        });
    }

    async addPlayer(player) {
        const tx = this.db.transaction('players', 'readwrite');
        const store = tx.objectStore('players');
        await store.add(player);
        return tx.complete;
    }

    async getAllPlayers() {
        const tx = this.db.transaction('players', 'readonly');
        const store = tx.objectStore('players');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveGame(game) {
        const tx = this.db.transaction('games', 'readwrite');
        const store = tx.objectStore('games');
        await store.put(game);
        return tx.complete;
    }

    async getGame(id) {
        const tx = this.db.transaction('games', 'readonly');
        const store = tx.objectStore('games');
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllGames() {
        const tx = this.db.transaction('games', 'readonly');
        const store = tx.objectStore('games');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result.sort((a, b) => 
                new Date(b.createdAt) - new Date(a.createdAt)
            ));
            request.onerror = () => reject(request.error);
        });
    }

    async deleteGame(id) {
        const tx = this.db.transaction('games', 'readwrite');
        const store = tx.objectStore('games');
        await store.delete(id);
        return tx.complete;
    }
}

// Initialize database and app
let db = new ScorekeeperDB();
let currentGame = null;

db.init().then(() => {
    console.log('Scorekeeper database initialized');
    loadApp();
}).catch(err => {
    console.error('Failed to initialize database:', err);
});

function loadApp() {
    // Check if we have a current game in progress
    const savedGameId = localStorage.getItem('currentGameId');
    if (savedGameId) {
        db.getGame(savedGameId).then(game => {
            if (game && !game.completed) {
                currentGame = new Game(game);
                showScoreGrid();
            } else {
                showSetup();
            }
        });
    } else {
        showSetup();
    }
}

function showSetup() {
    document.getElementById('setup-view').style.display = 'block';
    document.getElementById('score-view').style.display = 'none';
    document.getElementById('history-view').style.display = 'none';
    loadPlayerSuggestions();
}

function showScoreGrid() {
    document.getElementById('setup-view').style.display = 'none';
    document.getElementById('score-view').style.display = 'block';
    document.getElementById('history-view').style.display = 'none';
    renderScoreGrid();
}

function showHistory() {
    document.getElementById('setup-view').style.display = 'none';
    document.getElementById('score-view').style.display = 'none';
    document.getElementById('history-view').style.display = 'block';
    loadGameHistory();
}

async function loadPlayerSuggestions() {
    const players = await db.getAllPlayers();
    const datalist = document.getElementById('player-suggestions');
    datalist.innerHTML = '';
    players.forEach(player => {
        const option = document.createElement('option');
        option.value = player.name;
        datalist.appendChild(option);
    });
}

async function loadGameHistory() {
    const games = await db.getAllGames();
    const container = document.getElementById('game-history-list');
    container.innerHTML = '';

    if (games.length === 0) {
        container.innerHTML = '<p class="no-games">No games played yet.</p>';
        return;
    }

    games.forEach(game => {
        const gameCard = createGameHistoryCard(game);
        container.appendChild(gameCard);
    });
}

function createGameHistoryCard(gameData) {
    const game = new Game(gameData);
    const card = document.createElement('div');
    card.className = 'history-card';

    const date = new Date(game.createdAt);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    const playerNames = game.players.map(id => game.playerNames[id]).join(', ');
    
    let winnerInfo = '';
    if (game.completed) {
        const totals = game.players.map(id => ({ id, total: game.getTotal(id), name: game.playerNames[id] }));
        totals.sort((a, b) => a.total - b.total);
        winnerInfo = `<div class="winner">🏆 Winner: ${totals[0].name} (${totals[0].total} pts)</div>`;
    }

    card.innerHTML = `
        <div class="history-header">
            <span class="history-date">${dateStr}</span>
            ${game.completed ? '<span class="badge">Completed</span>' : '<span class="badge in-progress">In Progress</span>'}
        </div>
        <div class="history-players">${playerNames}</div>
        ${winnerInfo}
        <div class="history-actions">
            <button onclick="viewGame('${game.id}')" class="btn-small">View</button>
            <button onclick="deleteGameConfirm('${game.id}')" class="btn-small btn-danger">Delete</button>
        </div>
    `;

    return card;
}

async function viewGame(gameId) {
    const gameData = await db.getGame(gameId);
    currentGame = new Game(gameData);
    showScoreGrid();
}

function deleteGameConfirm(gameId) {
    if (confirm('Are you sure you want to delete this game?')) {
        db.deleteGame(gameId).then(() => {
            if (currentGame && currentGame.id === gameId) {
                currentGame = null;
                localStorage.removeItem('currentGameId');
            }
            loadGameHistory();
        });
    }
}

function renderScoreGrid() {
    const grid = document.getElementById('score-grid');
    const totalsDiv = document.getElementById('score-totals');
    
    let html = '<table class="score-table"><thead><tr>';
    html += '<th>Player</th>';
    for (let i = 1; i <= 5; i++) {
        const dealerId = currentGame.getDealerForRound(i);
        const dealerInitials = getInitials(currentGame.playerNames[dealerId]);
        html += `<th class="round-header">R${i}<br><span class="dealer-initials" title="Dealer: ${currentGame.playerNames[dealerId]}">${dealerInitials}</span></th>`;
    }
    html += '<th class="total-col">Total</th></tr></thead><tbody>';

    currentGame.players.forEach((playerId, index) => {
        html += '<tr>';
        
        html += `<td class="player-name">${currentGame.playerNames[playerId]}</td>`;
        
        // Score inputs for each round
        for (let round = 1; round <= 5; round++) {
            const score = currentGame.scores[playerId]?.[round - 1];
            const isEditable = !currentGame.completed;
            html += `<td><input type="number" 
                class="score-input" 
                value="${score !== undefined && score !== null ? score : ''}" 
                data-player="${playerId}" 
                data-round="${round}"
                ${isEditable ? '' : 'disabled'}
                min="0" 
                placeholder="-"></td>`;
        }
        
        // Total
        const total = currentGame.getTotal(playerId);
        html += `<td class="total-col"><strong>${total}</strong></td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    grid.innerHTML = html;

    // Add event listeners to score inputs
    document.querySelectorAll('.score-input').forEach(input => {
        input.addEventListener('change', handleScoreChange);
    });

    // Show winner if game is complete
    if (currentGame.isComplete() && !currentGame.completed) {
        currentGame.completed = true;
        db.saveGame(currentGame);
    }

    if (currentGame.completed) {
        showWinner();
    }
}

function handleScoreChange(event) {
    const input = event.target;
    const playerId = input.dataset.player;
    const round = parseInt(input.dataset.round);
    const score = input.value === '' ? null : parseInt(input.value);

    if (score !== null && score >= 0) {
        currentGame.addScore(playerId, round, score);
    }

    // Save to database
    db.saveGame(currentGame);
    
    // Update totals
    renderScoreGrid();
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function showWinner() {
    const totals = currentGame.players.map(id => ({
        id,
        name: currentGame.playerNames[id],
        total: currentGame.getTotal(id)
    }));
    totals.sort((a, b) => a.total - b.total);

    const winnerDiv = document.getElementById('winner-announcement');
    winnerDiv.style.display = 'block';
    winnerDiv.innerHTML = `
        <h3>🏆 Game Complete!</h3>
        <p class="winner-name">${totals[0].name} wins with ${totals[0].total} points!</p>
        <button onclick="newGame()" class="btn btn-primary">New Game</button>
    `;
}

function newGame() {
    if (currentGame && !currentGame.completed) {
        if (!confirm('Current game is not complete. Start a new game anyway?')) {
            return;
        }
    }
    currentGame = null;
    localStorage.removeItem('currentGameId');
    showSetup();
    document.getElementById('player-inputs').innerHTML = '';
    addPlayerInput();
    addPlayerInput();
}