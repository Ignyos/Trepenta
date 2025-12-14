class Player {
    constructor(data = {}) {
        this.id = Object.hasOwn(data, 'id') ? data.id : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.name = Object.hasOwn(data, 'name') ? data.name : '';
        this.createdAt = Object.hasOwn(data, 'createdAt') ? data.createdAt : new Date().toISOString();
    }
}

class Game {
    constructor(data = {}) {
        this.id = Object.hasOwn(data, 'id') ? data.id : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.players = Object.hasOwn(data, 'players') ? data.players : []; // Array of player IDs in turn order
        this.playerNames = Object.hasOwn(data, 'playerNames') ? data.playerNames : {}; // Map of player ID to name
        this.dealerIndex = Object.hasOwn(data, 'dealerIndex') ? data.dealerIndex : 0;
        this.scores = Object.hasOwn(data, 'scores') ? data.scores : {}; // Map of playerId -> [round1, round2, ...]
        this.currentRound = Object.hasOwn(data, 'currentRound') ? data.currentRound : 1;
        this.completed = Object.hasOwn(data, 'completed') ? data.completed : false;
        this.houseRules = Object.hasOwn(data, 'houseRules') ? data.houseRules : []; // Array of house rule objects
        this.deckConfig = Object.hasOwn(data, 'deckConfig') ? data.deckConfig : { type: 'standard', count: 1 }; // Deck configuration
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
    document.getElementById('winner-announcement').style.display = 'none';
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

async function loadPlayerSuggestions(excludeNames = []) {
    const players = await db.getAllPlayers();
    const datalist = document.getElementById('player-suggestions');
    datalist.innerHTML = '';
    
    // Get unique player names, exclude already entered names, and sort alphabetically
    const uniqueNames = [...new Set(players.map(p => p.name))]
        .filter(name => !excludeNames.map(n => n.toLowerCase()).includes(name.toLowerCase()))
        .sort();
    
    uniqueNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
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
    
    let deckConfigInfo = '';
    if (game.deckConfig) {
        const deckText = game.deckConfig.type === 'standard' 
            ? `${game.deckConfig.count} Standard Deck${game.deckConfig.count > 1 ? 's' : ''}`
            : `Trepenta Deck (${game.deckConfig.count} suits)`;
        deckConfigInfo = `<div class="history-deck-config">🃏 ${deckText}</div>`;
    }
    
    let houseRulesBadges = '';
    if (game.houseRules && game.houseRules.length > 0) {
        houseRulesBadges = '<div class="house-rules-tags">' + 
            game.houseRules.map(rule => 
                `<span class="rule-badge" style="background-color: ${rule.color}" title="${rule.brief}">${rule.name}</span>`
            ).join('') + 
            '</div>';
    }
    
    let winnerInfo = '';
    if (game.completed) {
        const totals = game.players.map(id => ({ id, total: game.getTotal(id), name: game.playerNames[id] }));
        totals.sort((a, b) => a.total - b.total);
        
        // Check for ties
        const lowestScore = totals[0].total;
        const winners = totals.filter(p => p.total === lowestScore);
        
        if (winners.length === 1) {
            winnerInfo = `<div class="winner">🏆 Winner: ${totals[0].name} (${totals[0].total} pts)</div>`;
        } else {
            const winnerNames = winners.map(w => w.name).join(' & ');
            winnerInfo = `<div class="winner">🏆 Tie: ${winnerNames} (${lowestScore} pts)</div>`;
        }
    }

    card.innerHTML = `
        <div class="history-header">
            <span class="history-date">${dateStr}</span>
            ${game.completed ? '<span class="badge">Completed</span>' : '<span class="badge in-progress">In Progress</span>'}
        </div>
        <div class="history-players">${playerNames}</div>
        ${deckConfigInfo}
        ${houseRulesBadges}
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
    
    // Display active house rules
    const houseRulesDiv = document.getElementById('active-house-rules');
    let houseRulesContent = '';
    
    // Add deck configuration
    if (currentGame.deckConfig) {
        const deckText = currentGame.deckConfig.type === 'standard' 
            ? `Standard Deck${currentGame.deckConfig.count > 1 ? 's' : ''}: ${currentGame.deckConfig.count}`
            : `Trepenta Deck: ${currentGame.deckConfig.count} suits`;
        houseRulesContent += `<div class="game-config-item"><strong>Deck:</strong> ${deckText}</div>`;
    }
    
    // Add house rules if any
    if (currentGame.houseRules && currentGame.houseRules.length > 0) {
        houseRulesContent += '<div class="house-rules-label">House Rules:</div>' +
            '<div class="house-rules-tags">' +
            currentGame.houseRules.map(rule => 
                `<span class="rule-badge" style="background-color: ${rule.color}" title="${rule.brief}">${rule.name}</span>`
            ).join('') +
            '</div>';
    }
    
    if (houseRulesContent) {
        houseRulesDiv.style.display = 'block';
        houseRulesDiv.innerHTML = houseRulesContent;
    } else {
        houseRulesDiv.style.display = 'none';
    }
    
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
        
        html += `<td class="player-name editable-name" 
            data-player="${playerId}" 
            title="Click to edit name">${currentGame.playerNames[playerId]}</td>`;
        
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

    // Add event listeners to editable player names
    document.querySelectorAll('.editable-name').forEach(cell => {
        cell.addEventListener('click', makeNameEditable);
    });

    // Show Finish Game button if game has enough scores and isn't completed
    const finishBtn = document.getElementById('finish-game-btn');
    if (finishBtn && !currentGame.completed && currentGame.isComplete()) {
        finishBtn.style.display = 'inline-block';
    } else if (finishBtn && !currentGame.completed) {
        finishBtn.style.display = 'none';
    }

    if (currentGame.completed) {
        showWinner();
        if (finishBtn) finishBtn.style.display = 'none';
    }
}

function handleScoreChange(event) {
    const input = event.target;
    const playerId = input.dataset.player;
    const round = parseInt(input.dataset.round);
    const score = input.value === '' ? null : parseInt(input.value);

    if (score !== null) {
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

function finishGame() {
    if (!currentGame.isComplete()) {
        alert('Please enter scores for all rounds before finishing the game.');
        return;
    }
    
    if (confirm('Mark this game as complete? Scores will be locked.')) {
        currentGame.completed = true;
        db.saveGame(currentGame);
        renderScoreGrid();
    }
}

function makeNameEditable(event) {
    const cell = event.target;
    const playerId = cell.dataset.player;
    const currentName = currentGame.playerNames[playerId];

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'name-edit-input';
    
    // Replace cell content with input
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    input.select();

    // Save on blur or Enter key
    const saveEdit = () => {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            currentGame.playerNames[playerId] = newName;
            db.saveGame(currentGame);
        }
        renderScoreGrid();
    };

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape') {
            renderScoreGrid(); // Cancel edit
        }
    });
}

function showWinner() {
    const totals = currentGame.players.map(id => ({
        id,
        name: currentGame.playerNames[id],
        total: currentGame.getTotal(id)
    }));
    totals.sort((a, b) => a.total - b.total);

    const lowestScore = totals[0].total;
    const winners = totals.filter(p => p.total === lowestScore);

    const winnerDiv = document.getElementById('winner-announcement');
    winnerDiv.style.display = 'block';
    
    if (winners.length === 1) {
        winnerDiv.innerHTML = `
            <h3>🏆 Game Complete!</h3>
            <p class="winner-name">${winners[0].name} wins with ${winners[0].total} points!</p>
            <button onclick="newGame()" class="btn btn-primary">New Game</button>
        `;
    } else {
        const winnerNames = winners.map(w => w.name).join(' and ');
        winnerDiv.innerHTML = `
            <h3>🏆 Game Complete!</h3>
            <p class="winner-name">It's a tie! ${winnerNames} tied with ${lowestScore} points!</p>
            <button onclick="newGame()" class="btn btn-primary">New Game</button>
        `;
    }
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