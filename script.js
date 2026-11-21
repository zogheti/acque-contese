/* Battaglia Navale - Multiplayer & Single Player (Pulsante Avvia Partita in Sala d'Attesa) */
"use strict";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
    getDatabase,
    ref,
    set,
    onValue,
    get,
    update,
    runTransaction,
    onDisconnect,
    remove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// --- CONFIGURAZIONE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBkc2s0vZjby7EnGd_9gsrd8eySFFb-s50",
    authDomain: "battaglia-navale-multiplayer.firebaseapp.com",
    databaseURL: "https://battaglia-navale-multiplayer-default-rtdb.firebaseio.com",
    projectId: "battaglia-navale-multiplayer",
    storageBucket: "battaglia-navale-multiplayer.firebasestorage.app",
    messagingSenderId: "788659808148",
    appId: "1:788659808148:web:9d23a20f776eb1d6e99181"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const SIZE = 10;
const LETTERS = "ABCDEFGHIJ".split("");

const FLEET_TEMPLATE = [
    { length: 1, label: "Elicottero", count: 2, image: "assets/ships/1elicottero.gif" },
    { length: 2, label: "Motovedetta", count: 2, image: "assets/ships/2motovedetta.gif" },
    { length: 3, label: "Sottomarino", count: 1, image: "assets/ships/3sottomarino.gif" },
    { length: 3, label: "Incrociatore", count: 1, image: "assets/ships/3incrociatore.gif" },
    { length: 4, label: "Corazzata", count: 1, image: "assets/ships/4incrociatore.gif" },
    { length: 5, label: "Portaerei", count: 1, image: "assets/ships/5portaerei.gif" }
];

const SHIP_IMAGES = {
    1: "assets/ships/1elicottero.gif",
    2: "assets/ships/2motovedetta.gif",
    3: "assets/ships/3sottomarino.gif",
    4: "assets/ships/4incrociatore.gif",
    5: "assets/ships/5portaerei.gif"
};

const SOUND_FILES = {
    shot: "assets/sounds/shot.mp3",
    water: "assets/sounds/water.mp3",
    hit: "assets/sounds/hit.mp3",
    sinking: "assets/sounds/sinking.mp3",
    victory: "assets/sounds/victory.mp3",
    defeat: "assets/sounds/defeat.mp3",
    click: "assets/sounds/click.mp3",
    inizio: "assets/sounds/inizio.mp3"
};

const $ = id => document.getElementById(id);

const ui = {
    roomPanel: $("room-panel"),
    waitingPanel: $("waiting-panel"),
    waitingTitle: $("waiting-title"),
    waitingSubtitle: $("waiting-subtitle"),
    waitingP1Name: $("waiting-p1-name"),
    waitingP2Name: $("waiting-p2-name"),
    waitingCounter: $("waiting-counter"),
    startFromWaitingBtn: $("start-from-waiting-btn"),
    cancelWaitingBtn: $("cancel-waiting-btn"),
    playerNameInput: $("player-name-input"),
    createRoomBtn: $("create-room-btn"),
    activeRoomsList: $("active-rooms-list"),
    roomsLiveBadge: $("rooms-live-badge"),
    roomStatusBox: $("room-status-box"),
    roomMenuBtn: $("room-menu-btn"),
    statusTitle: $("status-title"),
    statusMessage: $("status-message"),
    statusLight: $("status-light"),
    playerShipsLeft: $("player-ships-left"),
    enemyShipsLeft: $("enemy-ships-left"),
    setupPanel: $("setup-panel"),
    battlePanel: $("battle-panel"),
    fleetList: $("fleet-list"),
    setupBoard: $("setup-board"),
    playerBoard: $("player-board"),
    enemyBoard: $("enemy-board"),
    placedCount: $("placed-count"),
    rotate: $("rotate-ship"),
    autoPlace: $("auto-place"),
    start: $("start-game"),
    soundToggle: $("sound-toggle"),
    fullscreenToggle: $("fullscreen-toggle"),
    difficulty: $("difficulty"),
    turn: $("turn-count"),
    playerChip: $("player-board-chip"),
    enemyChip: $("enemy-board-chip"),
    rulesToggle: $("rules-toggle"),
    rulesDialog: $("rules-dialog"),
    resultDialog: $("result-dialog"),
    resultTitle: $("result-title"),
    resultMessage: $("result-message"),
    playAgain: $("play-again"),
    btnModeMulti: $("btn-mode-multi"),
    btnModeSingle: $("btn-mode-single"),
    multiOptions: $("multi-options"),
    singleOptions: $("single-options"),
    startSingleBtn: $("start-single-btn"),
    rankPanel: $("rank-panel"),
    starsContainer: $("stars-container"),
    myRankText: $("my-rank-text"),
    opponentRankText: $("opponent-rank-text"),
    rankTurnAnnouncement: $("rank-turn-announcement"),
    beginBattleBtn: $("begin-battle-btn"),
    roomConfirmDialog: $("room-confirm-dialog"),
    confirmLeaveRoom: $("confirm-leave-room"),
};

const RANKS = [
    { name: "Ammiraglio", level: 5 },
    { name: "Capitano", level: 4 },
    { name: "Tenente", level: 3 },
    { name: "Maresciallo", level: 2 },
    { name: "Guardiamarina", level: 1 }
];

const MY_SESSION_ID = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const game = {
    mode: "multi", // "multi" oppure "single"
    playerName: "",
    opponentName: "Avversario",
    roomCode: null,
    playerRole: null,
    playerShips: [],
    enemyShips: [],
    myShots: new Set(),
    opponentShots: new Set(),
    myShotResults: {},
    selectedShipId: null,
    orientation: "H",
    phase: "room", // "room" | "waiting" | "setup" | "rank_selection" | "battle" | "finished"
    soundEnabled: true,
    busy: false,
    aiHitsInProgress: [],
    aiTargetQueue: [],
    previewCells: [],
    opponentShips: [],
    shuffledRanks: [],
    myRank: null,
    opponentRank: null,
    myStarIndex: null,
    battleStartedByMe: false,
    latestRoomsSnapshot: {},
    lobbyTimer: null
};

// Ripristina l'eventuale nome salvato in precedenza
if (ui.playerNameInput) {
    const savedName = localStorage.getItem("acque_contese_player_name");
    if (savedName) ui.playerNameInput.value = savedName;
    ui.playerNameInput.addEventListener("input", () => {
        localStorage.setItem("acque_contese_player_name", ui.playerNameInput.value.trim());
    });
}

function getChosenPlayerName() {
    const raw = ui.playerNameInput ? ui.playerNameInput.value.trim() : "";
    const clean = raw.replace(/\s+/g, " ").slice(0, 20);
    if (clean) {
        localStorage.setItem("acque_contese_player_name", clean);
        return clean;
    }
    return "Comandante";
}

function formatFullTitle(rankObj, playerName) {
    const name = (playerName && playerName.trim()) ? playerName.trim() : "Comandante";
    if (rankObj && rankObj.name) {
        return `${rankObj.name} ${name}`;
    }
    return name;
}

// --- GESTIONE LOBBY STANZE ATTIVE (AGGIORNAMENTO OGNI SECONDO) ---

function startLobbySync() {
    const roomsRef = ref(db, "battaglia_rooms");

    onValue(roomsRef, snapshot => {
        game.latestRoomsSnapshot = snapshot.val() || {};
        if (game.phase === "room") {
            renderActiveRooms();
        }
    });

    if (game.lobbyTimer) clearInterval(game.lobbyTimer);
    game.lobbyTimer = setInterval(() => {
        if (game.phase !== "room") return;
        get(roomsRef).then(snapshot => {
            game.latestRoomsSnapshot = snapshot.val() || {};
            renderActiveRooms();
        }).catch(() => {
            renderActiveRooms();
        });
    }, 1000);
}

function renderActiveRooms() {
    if (!ui.activeRoomsList) return;

    if (ui.roomsLiveBadge) {
        const sec = new Date().getSeconds();
        ui.roomsLiveBadge.style.opacity = sec % 2 === 0 ? "1" : "0.55";
    }

    const roomsObj = game.latestRoomsSnapshot || {};
    const entries = Object.entries(roomsObj);
    const activeRooms = [];

    for (const [roomId, roomData] of entries) {
        if (!roomData || typeof roomData !== "object") continue;

        const p1Online = roomData.p1?.connected === true;
        const p2Online = roomData.p2?.connected === true;

        if (!p1Online && !p2Online) {
            remove(ref(db, `battaglia_rooms/${roomId}`)).catch(() => { });
            continue;
        }

        const playersCount = (p1Online ? 1 : 0) + (p2Online ? 1 : 0);
        const hostName = p1Online
            ? (roomData.p1?.name || "Comandante")
            : (roomData.p2?.name || "Comandante");

        activeRooms.push({
            id: roomId,
            hostName,
            playersCount,
            isFull: playersCount >= 2 || Boolean(roomData.winner),
            createdAt: roomData.createdAt || 0
        });
    }

    activeRooms.sort((a, b) => {
        if (a.isFull !== b.isFull) return a.isFull ? 1 : -1;
        return b.createdAt - a.createdAt;
    });

    ui.activeRoomsList.innerHTML = "";

    if (activeRooms.length === 0) {
        const empty = document.createElement("div");
        empty.className = "rooms-empty";
        empty.textContent = "Nessuna stanza attiva al momento. Creane una!";
        ui.activeRoomsList.appendChild(empty);
        return;
    }

    activeRooms.forEach(room => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "room-card";
        btn.disabled = room.isFull;

        const info = document.createElement("div");
        info.className = "room-card-info";

        const title = document.createElement("strong");
        title.textContent = `Stanza di ${room.hostName}`;

        const sub = document.createElement("small");
        sub.textContent = room.isFull
            ? "Partita in corso (2/2 giocatori)"
            : "Clicca per entrare nella stanza";

        info.append(title, sub);

        const badge = document.createElement("span");
        badge.className = "room-card-badge";
        badge.textContent = room.isFull ? "2/2 PIENA" : "1/2 ENTRA →";

        btn.append(info, badge);

        if (!room.isFull) {
            btn.addEventListener("click", () => {
                playSound("click");
                game.mode = "multi";
                game.playerName = getChosenPlayerName();
                connectToRoom(room.id);
            });
        }

        ui.activeRoomsList.appendChild(btn);
    });
}

startLobbySync();

// --- GESTIONE CAMBIO MODALITÀ (MULTI / SINGLE) ---
if (ui.btnModeMulti && ui.btnModeSingle) {
    ui.btnModeMulti.addEventListener("click", () => {
        game.mode = "multi";
        ui.btnModeMulti.className = "button button-primary";
        ui.btnModeSingle.className = "button button-quiet";
        if (ui.multiOptions) ui.multiOptions.classList.remove("hidden");
        if (ui.singleOptions) ui.singleOptions.classList.add("hidden");
        if (ui.roomStatusBox) ui.roomStatusBox.textContent = "";
    });

    ui.btnModeSingle.addEventListener("click", () => {
        game.mode = "single";
        ui.btnModeSingle.className = "button button-primary";
        ui.btnModeMulti.className = "button button-quiet";
        if (ui.singleOptions) ui.singleOptions.classList.remove("hidden");
        if (ui.multiOptions) ui.multiOptions.classList.add("hidden");
        if (ui.roomStatusBox) ui.roomStatusBox.textContent = "";
    });
}

function makeFleet() {
    const fleet = [];
    let id = 1;
    FLEET_TEMPLATE.forEach(type => {
        for (let i = 0; i < type.count; i++) {
            fleet.push({
                id: `ship-${id++}`,
                length: type.length,
                label: type.label,
                image: type.image,
                cells: [],
                hits: new Set(),
                sunk: false
            });
        }
    });
    return fleet.sort((a, b) => b.length - a.length);
}

const key = (r, c) => `${r},${c}`;
const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
const cellLabel = (r, c) => `${LETTERS[c]}${r + 1}`;

function shipAt(ships, r, c) {
    return ships.find(ship => ship.cells.some(([sr, sc]) => sr === r && sc === c));
}

function setStatus(title, message, color = "gold") {
    if (ui.statusTitle) ui.statusTitle.textContent = title;
    if (ui.statusMessage) ui.statusMessage.textContent = message;

    const colors = {
        red: { bg: "#ff645f", shadow: "rgba(255,100,95,.6)" },
        cyan: { bg: "#56d7e9", shadow: "rgba(86,215,233,.6)" },
        gold: { bg: "#e8bd68", shadow: "rgba(232,189,104,.6)" }
    };

    const current = colors[color] || colors.gold;
    if (ui.statusLight) {
        ui.statusLight.style.background = current.bg;
        ui.statusLight.style.boxShadow = `0 0 12px ${current.shadow}`;
    }
}

function playSound(name) {
    if (!game.soundEnabled) return;
    const audio = new Audio(SOUND_FILES[name]);
    audio.volume = 0.45;
    audio.play().catch(e => console.log("Audio non riprodotto (interazione richiesta):", e));
}

function shipImage(ship, className = "ship-image") {
    const img = document.createElement("img");
    img.className = className;
    img.alt = "";
    img.draggable = false;
    img.src = ship.image || SHIP_IMAGES[ship.length];
    img.onerror = () => img.remove();
    return img;
}

function getPlacementCells(r, c, length, dir) {
    const cells = [];
    for (let i = 0; i < length; i++) {
        cells.push([
            r + (dir === "V" ? i : 0),
            c + (dir === "H" ? i : 0)
        ]);
    }
    return cells;
}

function isPlacementValid(cells, ships, ignoredShipId = null) {
    const occupied = new Set();
    ships
        .filter(s => s.id !== ignoredShipId)
        .forEach(s => s.cells.forEach(([r, c]) => occupied.add(key(r, c))));

    for (const [r, c] of cells) {
        if (!inBounds(r, c) || occupied.has(key(r, c))) return false;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (inBounds(r + dr, c + dc) && occupied.has(key(r + dr, c + dc))) {
                    return false;
                }
            }
        }
    }
    return true;
}

function placeShip(ship, r, c, dir, ships) {
    const cells = getPlacementCells(r, c, ship.length, dir);
    if (!isPlacementValid(cells, ships, ship.id)) return false;
    ship.cells = cells;
    if (ship.hits instanceof Set) ship.hits.clear();
    else ship.hits = [];
    ship.sunk = false;
    return true;
}

function randomPlacement(ships) {
    const ordered = [...ships].sort((a, b) => b.length - a.length);
    ordered.forEach(ship => {
        ship.cells = [];
        if (ship.hits instanceof Set) ship.hits.clear();
        else ship.hits = [];
        ship.sunk = false;
    });

    for (const ship of ordered) {
        let placed = false;
        for (let tries = 0; tries < 5000 && !placed; tries++) {
            const dir = Math.random() < 0.5 ? "H" : "V";
            const r = Math.floor(Math.random() * SIZE);
            const c = Math.floor(Math.random() * SIZE);
            placed = placeShip(ship, r, c, dir, ships);
        }
        if (!placed) return false;
    }
    return true;
}

function createBoard(container, boardType) {
    if (!container) return;
    container.innerHTML = "";
    const board = document.createElement("div");
    board.className = "board";
    board.setAttribute("role", "grid");

    const corner = document.createElement("div");
    corner.className = "axis";
    board.appendChild(corner);

    LETTERS.forEach(letter => {
        const axis = document.createElement("div");
        axis.className = "axis";
        axis.textContent = letter;
        board.appendChild(axis);
    });

    for (let r = 0; r < SIZE; r++) {
        const axis = document.createElement("div");
        axis.className = "axis";
        axis.textContent = r + 1;
        board.appendChild(axis);

        for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "cell";
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.setAttribute("role", "gridcell");

            if (boardType === "setup") {
                cell.addEventListener("mouseenter", () => showPreview(r, c));
                cell.addEventListener("focus", () => showPreview(r, c));
                cell.addEventListener("mouseleave", clearPreview);
                cell.addEventListener("blur", clearPreview);
                cell.addEventListener("click", () => handleSetupCell(r, c));
            } else if (boardType === "enemy") {
                cell.addEventListener("click", () => handleShotRouter(r, c));
            }
            board.appendChild(cell);
        }
    }
    container.appendChild(board);
}

const getBoardCell = (container, r, c) => container ? container.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`) : null;

function renderFleetList() {
    if (!ui.fleetList) return;
    ui.fleetList.innerHTML = "";
    game.playerShips.forEach(ship => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "fleet-item" +
            (ship.id === game.selectedShipId ? " selected" : "") +
            (ship.cells.length ? " placed" : "");
        button.disabled = game.phase !== "setup";

        const icon = document.createElement("span");
        icon.className = "fleet-icon";
        for (let i = 0; i < ship.length; i++) {
            icon.appendChild(document.createElement("i"));
        }

        const text = document.createElement("span");
        text.className = "fleet-text";
        const title = document.createElement("strong");
        title.textContent = ship.label;
        const sub = document.createElement("small");
        sub.textContent = ship.cells.length ? `Posizionata: ${cellLabel(...ship.cells[0])}` : "Da posizionare";
        text.append(title, sub);

        const state = document.createElement("span");
        state.className = "fleet-state";
        state.textContent = ship.cells.length ? "OK" : "Scegli";

        button.append(icon, text, state);
        button.addEventListener("click", () => {
            game.selectedShipId = ship.id;
            renderSetupBoard();
        });
        ui.fleetList.appendChild(button);
    });
}

function addShipOverlay(board, ship) {
    if (!board || !ship.cells.length) return;
    const [startR, startC] = ship.cells[0];
    const [endR, endC] = ship.cells[ship.cells.length - 1];

    const firstCell = getBoardCell(board, startR, startC);
    const lastCell = getBoardCell(board, endR, endC);
    if (!firstCell || !lastCell) return;

    board.style.position = "relative";
    const boardRect = board.getBoundingClientRect();
    const firstRect = firstCell.getBoundingClientRect();
    const lastRect = lastCell.getBoundingClientRect();

    const left = firstRect.left - boardRect.left - board.clientLeft;
    const top = firstRect.top - boardRect.top - board.clientTop;
    const right = lastRect.right - boardRect.left - board.clientLeft;
    const bottom = lastRect.bottom - boardRect.top - board.clientTop;

    const areaWidth = right - left;
    const areaHeight = bottom - top;
    const vertical = startC === endC && ship.length > 1;

    const img = shipImage(ship, "ship-overlay");
    img.style.position = "absolute";
    img.style.zIndex = "5";
    img.style.pointerEvents = "none";
    img.style.objectFit = "fill";

    if (vertical) {
        img.style.width = `${areaHeight}px`;
        img.style.height = `${areaWidth}px`;
        img.style.left = `${left + (areaWidth - areaHeight) / 2}px`;
        img.style.top = `${top + (areaHeight - areaWidth) / 2}px`;
        img.style.transform = "rotate(90deg)";
        img.style.transformOrigin = "center center";
    } else {
        img.style.left = `${left}px`;
        img.style.top = `${top}px`;
        img.style.width = `${areaWidth}px`;
        img.style.height = `${areaHeight}px`;
        img.style.transform = "none";
    }
    board.appendChild(img);
}

function addFireOverlay(cell) {
    if (!cell || cell.querySelector(".fire-overlay")) return;
    const fireImg = document.createElement("img");
    fireImg.src = "assets/ships/fuoco.gif";
    fireImg.className = "fire-overlay";
    cell.style.position = "relative";
    fireImg.alt = "Colpito";
    fireImg.draggable = false;
    fireImg.style.position = "absolute";
    fireImg.style.inset = "0";
    fireImg.style.width = "100%";
    fireImg.style.height = "100%";
    fireImg.style.objectFit = "contain";
    fireImg.style.zIndex = "10";
    fireImg.style.pointerEvents = "none";
    cell.appendChild(fireImg);
}

function renderSetupBoard() {
    if (!ui.setupBoard) return;
    createBoard(ui.setupBoard, "setup");
    const board = ui.setupBoard.querySelector(".board");
    if (!board) return;

    board.querySelectorAll(".cell").forEach(cell => {
        const r = Number(cell.dataset.r);
        const c = Number(cell.dataset.c);
        const ship = shipAt(game.playerShips, r, c);
        if (ship) cell.classList.add("ship");
    });

    game.playerShips.forEach(ship => {
        if (ship.cells.length) addShipOverlay(board, ship);
    });

    const placedCount = game.playerShips.filter(s => s.cells.length).length;
    if (ui.placedCount) ui.placedCount.textContent = `${placedCount} / ${game.playerShips.length} posizionate`;
    if (ui.start) ui.start.disabled = game.playerShips.some(s => !s.cells.length);
    renderFleetList();
}

function clearPreview() {
    game.previewCells.forEach(({ r, c }) => {
        const cell = getBoardCell(ui.setupBoard, r, c);
        if (cell) cell.classList.remove("preview", "invalid");
    });
    game.previewCells = [];
}

function showPreview(r, c) {
    if (game.phase !== "setup") return;
    clearPreview();
    const ship = game.playerShips.find(s => s.id === game.selectedShipId);
    if (!ship || ship.cells.length) return;

    const cells = getPlacementCells(r, c, ship.length, game.orientation);
    const valid = isPlacementValid(cells, game.playerShips, ship.id);

    cells.forEach(([rr, cc]) => {
        if (!inBounds(rr, cc)) return;
        const cell = getBoardCell(ui.setupBoard, rr, cc);
        if (cell) {
            cell.classList.add("preview");
            if (!valid) cell.classList.add("invalid");
        }
        game.previewCells.push({ r: rr, c: cc });
    });
}

function handleSetupCell(r, c) {
    if (game.phase !== "setup") return;
    const existing = shipAt(game.playerShips, r, c);
    if (existing) {
        existing.cells = [];
        if (existing.hits instanceof Set) existing.hits.clear();
        else existing.hits = [];
        existing.sunk = false;
        game.selectedShipId = existing.id;
        playSound("click");
        renderSetupBoard();
        return;
    }

    const ship = game.playerShips.find(s => s.id === game.selectedShipId);
    if (!ship) return;

    if (!placeShip(ship, r, c, game.orientation, game.playerShips)) {
        playSound("click");
        return;
    }

    playSound("click");
    game.selectedShipId = game.playerShips.find(s => !s.cells.length)?.id || null;
    renderSetupBoard();
}

function autoPlacePlayer() {
    if (game.phase !== "setup") return;
    playSound("click");
    if (!randomPlacement(game.playerShips)) return;
    game.selectedShipId = null;
    renderSetupBoard();
}

// --- GESTIONE CREAZIONE STANZA / SINGLE PLAYER ---

if (ui.createRoomBtn) {
    ui.createRoomBtn.addEventListener("click", () => {
        playSound("click");
        game.mode = "multi";
        game.playerName = getChosenPlayerName();
        const newRoomCode = `ROOM_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        connectToRoom(newRoomCode, true);
    });
}

if (ui.startFromWaitingBtn) {
    ui.startFromWaitingBtn.addEventListener("click", () => {
        if (!game.roomCode || ui.startFromWaitingBtn.disabled) return;
        playSound("click");
        ui.startFromWaitingBtn.disabled = true;
        ui.startFromWaitingBtn.textContent = "Avvio in corso...";
        set(ref(db, `battaglia_rooms/${game.roomCode}/matchStarted`), true)
            .then(() => {
                enterSetupPhaseFromWaiting();
            })
            .catch(err => {
                console.error("Errore avvio partita:", err);
                ui.startFromWaitingBtn.disabled = false;
                ui.startFromWaitingBtn.textContent = "Avvia Partita →";
            });
    });
}

if (ui.cancelWaitingBtn) {
    ui.cancelWaitingBtn.addEventListener("click", () => {
        playSound("click");
        if (game.mode === "multi" && game.roomCode && game.playerRole) {
            update(ref(db, `battaglia_rooms/${game.roomCode}/${game.playerRole}`), {
                connected: false,
                ready: false
            }).catch(() => { });
        }
        location.reload();
    });
}

if (ui.startSingleBtn) {
    ui.startSingleBtn.addEventListener("click", () => {
        game.mode = "single";
        game.playerName = getChosenPlayerName();
        if (ui.roomPanel) ui.roomPanel.classList.add("hidden");
        if (ui.setupPanel) ui.setupPanel.classList.remove("hidden");
        game.phase = "setup";
        game.playerShips = makeFleet();
        game.selectedShipId = game.playerShips[0].id;
        renderSetupBoard();
        setStatus("Schiera la tua flotta", `${game.playerName}, posiziona le tue navi.`);
    });
}

if (ui.start) {
    ui.start.addEventListener("click", () => {
        if (game.playerShips.some(s => !s.cells.length)) return;

        if (game.mode === "single") {
            startSinglePlayerGame();
        } else {
            startMultiplayerGame();
        }
    });
}

function shuffleRanks() {
    const copy = [...RANKS];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function setupRankScreen() {
    if (!game.shuffledRanks || game.shuffledRanks.length !== 5) {
        game.shuffledRanks = shuffleRanks();
    }
    game.myRank = null;
    game.myStarIndex = null;
    game.battleStartedByMe = false;

    if (ui.myRankText) ui.myRankText.textContent = `${game.playerName}, seleziona una stella per scoprire il tuo grado...`;
    if (ui.opponentRankText) ui.opponentRankText.textContent = "In attesa che l'avversario scelga la sua stella...";
    if (ui.rankTurnAnnouncement) ui.rankTurnAnnouncement.textContent = "";
    if (ui.beginBattleBtn) {
        ui.beginBattleBtn.disabled = true;
        ui.beginBattleBtn.textContent = "Inizia la Battaglia →";
    }

    if (ui.starsContainer) {
        const stars = ui.starsContainer.querySelectorAll(".star-btn");
        stars.forEach((btn, idx) => {
            btn.disabled = false;
            btn.classList.remove("chosen");
            btn.textContent = "★";
            btn.title = "Clicca per scoprire il tuo grado";
            btn.onclick = () => handleStarSelection(idx);
        });
    }
}

function handleStarSelection(starIndex) {
    if (game.myRank || !game.roomCode || !game.playerRole) return;

    const chosenRank = game.shuffledRanks[starIndex];
    game.myRank = chosenRank;
    game.myStarIndex = starIndex;
    playSound("click");

    if (ui.starsContainer) {
        const stars = ui.starsContainer.querySelectorAll(".star-btn");
        stars.forEach((btn, idx) => {
            btn.disabled = true;
            if (idx === starIndex) {
                btn.classList.add("chosen");
                btn.innerHTML = `★<div style="font-size: 13px; margin-top: 6px; color: #fff;">${chosenRank.name}</div>`;
            }
        });
    }

    if (ui.myRankText) {
        ui.myRankText.textContent = `Tu sei: ${formatFullTitle(chosenRank, game.playerName)}`;
    }

    update(ref(db, `battaglia_rooms/${game.roomCode}/${game.playerRole}`), {
        rank: chosenRank,
        starIndex: starIndex
    }).catch(err => console.error("Errore salvataggio grado:", err));
}

function startMultiplayerGame() {
    const serializedShips = game.playerShips.map(s => ({
        id: s.id,
        length: s.length,
        label: s.label,
        cells: s.cells
    }));

    update(ref(db, `battaglia_rooms/${game.roomCode}/${game.playerRole}`), {
        connected: true,
        name: game.playerName,
        ready: true,
        battleReady: false,
        rank: null,
        starIndex: null,
        ships: serializedShips
    }).then(() => {
        game.phase = "rank_selection";
        setupRankScreen();
        if (ui.setupPanel) ui.setupPanel.classList.add("hidden");
        if (ui.rankPanel) ui.rankPanel.classList.remove("hidden");
        playSound("inizio");
    }).catch(err => {
        console.error("Errore invio flotta:", err);
    });
}

if (ui.beginBattleBtn) {
    ui.beginBattleBtn.addEventListener("click", () => {
        if (!game.roomCode || !game.playerRole || game.battleStartedByMe) return;
        game.battleStartedByMe = true;
        playSound("click");
        ui.beginBattleBtn.disabled = true;
        ui.beginBattleBtn.textContent = "In attesa dell'avversario...";

        update(ref(db, `battaglia_rooms/${game.roomCode}/${game.playerRole}`), {
            battleReady: true
        }).catch(err => console.error("Errore conferma avvio battaglia:", err));
    });
}

function startSinglePlayerGame() {
    game.enemyShips = makeFleet();
    if (!randomPlacement(game.enemyShips)) {
        setStatus("Errore", "Impossibile preparare la flotta nemica.", "red");
        return;
    }

    game.phase = "battle";
    game.busy = false;
    game.myShots.clear();
    game.opponentShots.clear();
    game.aiHitsInProgress = [];
    game.aiTargetQueue = [];

    if (ui.setupPanel) ui.setupPanel.classList.add("hidden");
    if (ui.battlePanel) ui.battlePanel.classList.remove("hidden");
    if (ui.playerChip) ui.playerChip.textContent = game.playerName;
    if (ui.enemyChip) ui.enemyChip.textContent = "CPU";

    renderBattleBoards();
    setStatus("Battaglia Iniziata", `${game.playerName}, seleziona una casella nemica per sparare.`, "cyan");
    playSound("inizio");
}

// --- ROUTER DEI COLPI ---

function handleShotRouter(r, c) {
    if (game.mode === "single") {
        handleSinglePlayerShot(r, c);
    } else {
        handleMultiplayerShot(r, c);
    }
}

// --- LOGICA SINGLE PLAYER (IA) ---

function handleSinglePlayerShot(r, c) {
    if (game.phase !== "battle" || game.busy || game.myShots.has(key(r, c))) return;

    const k = key(r, c);
    game.myShots.add(k);
    playSound("shot");

    const ship = shipAt(game.enemyShips, r, c);
    if (ship) {
        if (ship.hits instanceof Set) ship.hits.add(k);
        else ship.hits.push(k);
        playSound("hit");

        const targetCell = getBoardCell(ui.enemyBoard, r, c);
        if (targetCell) addFireOverlay(targetCell);

        const currentHitsCount = ship.hits instanceof Set ? ship.hits.size : ship.hits.length;
        if (currentHitsCount === ship.length) {
            ship.sunk = true;
            playSound("sinking");
            setStatus("Nave nemica affondata!", `Hai affondato ${ship.label}. Tiri ancora!`, "cyan");
        } else {
            setStatus("Colpo a segno!", `Impatto confermato in ${cellLabel(r, c)}. Tiri ancora!`, "cyan");
        }

        renderBattleBoards();

        if (game.enemyShips.every(s => s.sunk)) {
            finishGameSingle(true);
            return;
        }
        game.busy = false;
        return;
    } else {
        playSound("water");
        setStatus("Acqua!", `Il colpo in ${cellLabel(r, c)} è in acqua. Turno del computer.`, "gold");
        game.busy = true;
        renderBattleBoards();
        window.setTimeout(computerTurn, 750);
    }
}

function computerTurn() {
    if (game.phase !== "battle") return;

    const target = getAiTarget();
    if (!target) {
        game.busy = false;
        return;
    }

    const [r, c] = target;
    const k = key(r, c);
    game.opponentShots.add(k);
    playSound("shot");

    const ship = shipAt(game.playerShips, r, c);
    if (ship) {
        if (ship.hits instanceof Set) ship.hits.add(k);
        else ship.hits.push(k);
        playSound("hit");
        game.aiHitsInProgress.push([r, c]);

        const targetCell = getBoardCell(ui.playerBoard, r, c);
        if (targetCell) addFireOverlay(targetCell);

        const currentHitsCount = ship.hits instanceof Set ? ship.hits.size : ship.hits.length;
        if (currentHitsCount === ship.length) {
            ship.sunk = true;
            playSound("sinking");
            game.aiHitsInProgress = [];
            game.aiTargetQueue = [];
            setStatus("Nave affondata!", `Il computer ha distrutto la tua nave in ${cellLabel(r, c)}.`, "red");
        }

        renderBattleBoards();

        if (game.playerShips.every(s => s.sunk)) {
            finishGameSingle(false);
            return;
        }

        window.setTimeout(computerTurn, 750);
    } else {
        playSound("water");
        setStatus("Il computer ha mancato", `Il colpo nemico in ${cellLabel(r, c)} è in acqua. Tocca a te!`, "cyan");
        game.busy = false;
        renderBattleBoards();
        if (ui.turn) ui.turn.textContent = "Tuo turno";
    }
}

function getAvailableTargets() {
    const available = [];
    const diff = ui.difficulty ? ui.difficulty.value : "normal";
    const forbiddenNearSunk = new Set();

    if (diff !== "easy") {
        game.playerShips.forEach(ship => {
            if (ship.sunk) {
                ship.cells.forEach(([sr, sc]) => {
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const rr = sr + dr;
                            const cc = sc + dc;
                            if (inBounds(rr, cc)) forbiddenNearSunk.add(key(rr, cc));
                        }
                    }
                });
            }
        });
    }

    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const k = key(r, c);
            if (!game.opponentShots.has(k) && !forbiddenNearSunk.has(k)) {
                available.push([r, c]);
            }
        }
    }
    if (available.length === 0) {
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (!game.opponentShots.has(key(r, c))) available.push([r, c]);
            }
        }
    }
    return available;
}

function getTargetFromHitsInProgress() {
    const availableKeys = new Set(getAvailableTargets().map(([r, c]) => key(r, c)));
    if (game.aiHitsInProgress.length > 1) {
        game.aiTargetQueue = [];
        const rows = game.aiHitsInProgress.map(p => p[0]);
        const cols = game.aiHitsInProgress.map(p => p[1]);
        const horizontal = rows.every(r => r === rows[0]);
        const vertical = cols.every(c => c === cols[0]);
        const candidates = [];

        if (horizontal) {
            const row = rows[0];
            candidates.push([row, Math.min(...cols) - 1], [row, Math.max(...cols) + 1]);
        } else if (vertical) {
            const col = cols[0];
            candidates.push([Math.min(...rows) - 1, col], [Math.max(...rows) + 1, col]);
        }

        for (const [r, c] of candidates) {
            if (inBounds(r, c) && availableKeys.has(key(r, c))) return [r, c];
        }
    }

    while (game.aiTargetQueue.length) {
        const target = game.aiTargetQueue.shift();
        if (availableKeys.has(key(target[0], target[1]))) return target;
    }

    if (game.aiHitsInProgress.length === 1) {
        const [r, c] = game.aiHitsInProgress[0];
        [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([cr, cc]) => {
            if (inBounds(cr, cc) && availableKeys.has(key(cr, cc))) game.aiTargetQueue.push([cr, cc]);
        });
        if (game.aiTargetQueue.length) return game.aiTargetQueue.shift();
    }
    return null;
}

function getAiTarget() {
    const diff = ui.difficulty ? ui.difficulty.value : "normal";
    const huntTarget = getTargetFromHitsInProgress();
    if (huntTarget) return huntTarget;

    const available = getAvailableTargets();
    if (!available.length) return null;

    if (diff === "normal" || diff === "hard") {
        const checkerboard = available.filter(([r, c]) => (r + c) % 2 === 0);
        const pool = checkerboard.length ? checkerboard : available;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
}

function finishGameSingle(playerWon) {
    game.phase = "finished";
    game.busy = false;
    if (ui.resultTitle) ui.resultTitle.textContent = playerWon ? "Vittoria!" : "Sconfitta";
    if (ui.resultMessage) ui.resultMessage.textContent = playerWon ? `${game.playerName}, hai distrutto la flotta del computer!` : "La tua flotta è stata distrutta.";
    playSound(playerWon ? "victory" : "defeat");
    setTimeout(() => { if (ui.resultDialog) ui.resultDialog.showModal(); }, 1000);
}

// --- LOGICA MULTIPLAYER FIREBASE ---

function enterSetupPhaseFromWaiting() {
    if (game.phase !== "waiting") return;
    game.phase = "setup";
    game.playerShips = makeFleet();
    game.selectedShipId = game.playerShips[0].id;

    if (ui.waitingPanel) ui.waitingPanel.classList.add("hidden");
    if (ui.setupPanel) ui.setupPanel.classList.remove("hidden");

    renderSetupBoard();
    setStatus(
        "Schiera la tua flotta",
        `${game.playerName} (${game.playerRole === "p1" ? "Giocatore 1" : "Giocatore 2"}) — Posiziona le navi.`
    );
    playSound("inizio");
}

function updateWaitingUI(p1, p2) {
    const p1Online = p1?.connected === true;
    const p2Online = p2?.connected === true;
    const count = (p1Online ? 1 : 0) + (p2Online ? 1 : 0);
    const bothConnected = p1Online && p2Online;

    if (ui.waitingP1Name) {
        ui.waitingP1Name.textContent = p1Online ? (p1.name || "Comandante") : "In attesa...";
    }
    if (ui.waitingP2Name) {
        ui.waitingP2Name.textContent = p2Online ? (p2.name || "Comandante") : "In attesa...";
    }
    if (ui.waitingCounter) {
        ui.waitingCounter.textContent = `Giocatori nella stanza: ${count} / 2`;
    }
    if (ui.waitingTitle) {
        ui.waitingTitle.textContent = bothConnected
            ? "Entrambi i giocatori sono pronti!"
            : "In attesa del secondo giocatore";
    }
    if (ui.startFromWaitingBtn) {
        ui.startFromWaitingBtn.disabled = !bothConnected;
        ui.startFromWaitingBtn.textContent = bothConnected
            ? "Avvia Partita →"
            : "In attesa del 2° giocatore...";
    }
}

async function connectToRoom(code, isCreating = false) {
    const roomRefPath = `battaglia_rooms/${code}`;
    const roomRef = ref(db, roomRefPath);
    if (ui.roomStatusBox) {
        ui.roomStatusBox.textContent = isCreating
            ? "Creazione stanza in corso..."
            : "Accesso alla stanza in corso...";
    }

    try {
        const txResult = await runTransaction(roomRef, (current) => {
            const p1Online = current?.p1?.connected === true;
            const p2Online = current?.p2?.connected === true;

            if (current === null || (!p1Online && !p2Online)) {
                return {
                    createdAt: Date.now(),
                    matchStarted: false,
                    p1: { connected: true, ready: false, sessionId: MY_SESSION_ID, name: game.playerName },
                    p2: { connected: false, ready: false, sessionId: null, name: null },
                    rankOrder: shuffleRanks(),
                    turn: null
                };
            }
            if (!current.rankOrder) {
                current.rankOrder = shuffleRanks();
            }
            if (!p1Online || current.p1?.sessionId === MY_SESSION_ID) {
                current.p1 = { connected: true, ready: false, sessionId: MY_SESSION_ID, name: game.playerName };
                return current;
            }
            if (!p2Online || current.p2?.sessionId === MY_SESSION_ID) {
                current.p2 = { connected: true, ready: false, sessionId: MY_SESSION_ID, name: game.playerName };
                return current;
            }
            return;
        });

        if (!txResult.committed) {
            if (ui.roomStatusBox) ui.roomStatusBox.textContent = "Stanza già piena! Scegli un'altra stanza attiva.";
            return;
        }

        const roomData = txResult.snapshot.val();
        if (roomData?.p1?.sessionId === MY_SESSION_ID) game.playerRole = "p1";
        else if (roomData?.p2?.sessionId === MY_SESSION_ID) game.playerRole = "p2";

        game.roomCode = code;
        game.phase = "waiting";
        onDisconnect(ref(db, `${roomRefPath}/${game.playerRole}`)).update({ connected: false, ready: false });

        if (ui.roomStatusBox) ui.roomStatusBox.textContent = "";
        if (ui.roomPanel) ui.roomPanel.classList.add("hidden");
        if (ui.waitingPanel) ui.waitingPanel.classList.remove("hidden");

        updateWaitingUI(roomData?.p1, roomData?.p2);
        initFirebaseListeners(roomRefPath);

        if (roomData?.matchStarted === true && roomData?.p1?.connected === true && roomData?.p2?.connected === true) {
            enterSetupPhaseFromWaiting();
        }
    } catch (error) {
        console.error("Errore connessione:", error);
        if (ui.roomStatusBox) ui.roomStatusBox.textContent = "Errore di connessione. Riprova.";
    }
}

function initFirebaseListeners(roomRefPath) {
    onValue(ref(db, roomRefPath), snapshot => {
        if (game.mode !== "multi") return;
        const data = snapshot.val();
        if (!data) return;

        // Sincronizza l'ordine condiviso delle 5 stelle della stanza
        if (Array.isArray(data.rankOrder) && data.rankOrder.length === 5) {
            game.shuffledRanks = data.rankOrder;
        }

        const p1 = data.p1 || {};
        const p2 = data.p2 || {};
        const myData = data[game.playerRole] || {};
        const opponentRole = game.playerRole === "p1" ? "p2" : "p1";
        const opponentData = data[opponentRole] || {};

        if (opponentData.name) {
            game.opponentName = opponentData.name;
        }
        if (opponentData.rank) {
            game.opponentRank = opponentData.rank;
        }

        // SALA D'ATTESA: aggiorna stato 1/2 o 2/2 e passa al setup quando si clicca "Avvia Partita"
        if (game.phase === "waiting") {
            updateWaitingUI(p1, p2);
            if (data.matchStarted === true && p1.connected === true && p2.connected === true) {
                enterSetupPhaseFromWaiting();
            }
            return;
        }

        const myFullTitle = formatFullTitle(myData.rank || game.myRank, game.playerName);
        const oppFullTitle = formatFullTitle(opponentData.rank || game.opponentRank, game.opponentName);

        // FASE INTERMEDIA: SCELTA DEL GRADO CON LE 5 STELLE
        if (game.phase === "rank_selection") {
            if (myData.rank && ui.myRankText) {
                ui.myRankText.textContent = `Tu giochi come: ${myFullTitle}`;
            }

            if (opponentData.rank) {
                if (ui.opponentRankText) {
                    ui.opponentRankText.textContent = `Avversario: ${oppFullTitle}`;
                }

                // Se non ho ancora scelto, disabilito la stella già presa dall'avversario
                if (!game.myRank && typeof opponentData.starIndex === "number" && ui.starsContainer) {
                    const oppBtn = ui.starsContainer.querySelector(`.star-btn[data-star="${opponentData.starIndex}"]`);
                    if (oppBtn && !oppBtn.disabled) {
                        oppBtn.disabled = true;
                        oppBtn.title = `Già scelta da ${oppFullTitle}`;
                        oppBtn.innerHTML = `★<div style="font-size: 11px; margin-top: 6px; color: #e8bd68;">Presa</div>`;
                    }
                }
            } else {
                if (ui.opponentRankText) {
                    ui.opponentRankText.textContent = `In attesa che ${game.opponentName} scelga la sua stella...`;
                }
            }

            // Entrambi hanno scelto la stella e schierato le navi
            if (p1.ready && p2.ready && p1.rank && p2.rank) {
                const firstTurn = p2.rank.level > p1.rank.level ? "p2" : "p1";

                if (game.playerRole === "p1" && !data.turn) {
                    set(ref(db, `${roomRefPath}/turn`), firstTurn);
                }

                const iAmFirst = firstTurn === game.playerRole;
                const firstPlayerTitle = iAmFirst ? myFullTitle : oppFullTitle;

                if (ui.rankTurnAnnouncement) {
                    ui.rankTurnAnnouncement.textContent = iAmFirst
                        ? `${firstPlayerTitle} è il più alto in grado: aprirai il fuoco per primo!`
                        : `${firstPlayerTitle} è il più alto in grado: aprirà il fuoco per primo!`;
                }

                if (ui.beginBattleBtn && !game.battleStartedByMe) {
                    ui.beginBattleBtn.disabled = false;
                }
            } else if (myData.rank && (!p2.ready || !p1.ready)) {
                if (ui.rankTurnAnnouncement) {
                    ui.rankTurnAnnouncement.textContent = `In attesa che ${game.opponentName} posizioni la flotta...`;
                }
            }

            // Quando entrambi cliccano "Inizia la Battaglia"
            if (p1.battleReady && p2.battleReady && data.turn) {
                game.phase = "battle";
                if (ui.rankPanel) ui.rankPanel.classList.add("hidden");
                if (ui.battlePanel) ui.battlePanel.classList.remove("hidden");
                playSound("inizio");
                updateBattleStateFromFirebase(data);
            }
            return;
        }

        if (game.phase === "battle") {
            updateBattleStateFromFirebase(data);
        }
    });
}

function updateBattleStateFromFirebase(data) {
    const opponentRole = game.playerRole === "p1" ? "p2" : "p1";
    const myData = data[game.playerRole] || {};
    const opponentData = data[opponentRole] || {};
    game.opponentShips = opponentData.ships || [];

    if (opponentData.name) game.opponentName = opponentData.name;
    if (opponentData.rank) game.opponentRank = opponentData.rank;
    if (myData.rank) game.myRank = myData.rank;

    const myFullTitle = formatFullTitle(game.myRank, game.playerName);
    const oppFullTitle = formatFullTitle(game.opponentRank, game.opponentName);

    if (ui.playerChip) ui.playerChip.textContent = myFullTitle;
    if (ui.enemyChip) ui.enemyChip.textContent = oppFullTitle;

    game.myShots = new Set(myData.shotsFired || []);
    game.myShotResults = myData.shotResults || {};
    game.opponentShots = new Set(opponentData.shotsFired || []);

    renderBattleBoards();

    if (data.turn === game.playerRole) {
        if (ui.turn) ui.turn.textContent = `Turno di ${myFullTitle}`;
        setStatus(`Tocca a te, ${myFullTitle}!`, `Clicca sul settore di ${oppFullTitle} per fare fuoco.`, "cyan");
    } else {
        if (ui.turn) ui.turn.textContent = `Turno di ${oppFullTitle}`;
        setStatus(`Turno di ${oppFullTitle}`, `${oppFullTitle} sta prendendo la mira...`, "gold");
    }
    checkWinConditionsMulti(data);
}

// Helper sicuro per convertire dati Firebase (array o oggetti numerici)
function toArraySafe(val) {
    if (!val) return [];
    return Array.isArray(val) ? val : Object.values(val);
}

function handleMultiplayerShot(r, c) {
    if (game.phase !== "battle") return;
    const roomRefPath = `battaglia_rooms/${game.roomCode}`;

    get(ref(db, roomRefPath)).then(snapshot => {
        const data = snapshot.val();
        if (!data || data.turn !== game.playerRole || data.winner) return;

        const shotKey = key(r, c);
        if (game.myShots.has(shotKey)) return;

        const opponentRole = game.playerRole === "p1" ? "p2" : "p1";
        const opponentShips = toArraySafe(data[opponentRole]?.ships);

        let hitShip = null;
        for (const ship of opponentShips) {
            const cells = toArraySafe(ship.cells);
            if (cells.some(([sr, sc]) => sr === r && sc === c)) {
                hitShip = ship;
                break;
            }
        }

        game.myShots.add(shotKey);
        game.myShotResults[shotKey] = !!hitShip;

        if (hitShip) playSound("hit");
        else playSound("water");

        const myShotsArray = Array.from(game.myShots);
        const myShotsSet = new Set(myShotsArray);

        const allEnemySunk = opponentShips.length > 0 && opponentShips.every(s => {
            const cells = toArraySafe(s.cells);
            return cells.length > 0 && cells.every(([sr, sc]) => myShotsSet.has(key(sr, sc)));
        });

        update(ref(db, `${roomRefPath}/${game.playerRole}`), {
            shotsFired: myShotsArray,
            shotResults: game.myShotResults
        }).then(() => {
            if (allEnemySunk) {
                return update(ref(db, roomRefPath), {
                    winner: game.playerRole,
                    turn: null
                });
            } else {
                const nextTurn = hitShip ? game.playerRole : opponentRole;
                return set(ref(db, `${roomRefPath}/turn`), nextTurn);
            }
        }).catch(err => console.error("Errore invio colpo:", err));
    });
}

function checkWinConditionsMulti(data) {
    if (game.phase !== "battle" && game.phase !== "finished") return;

    if (data.winner) {
        finishGameMulti(data.winner === game.playerRole);
        return;
    }

    const opponentRole = game.playerRole === "p1" ? "p2" : "p1";
    const myData = data[game.playerRole] || {};
    const opponentData = data[opponentRole] || {};

    const myShips = game.playerShips || [];
    const opponentShips = toArraySafe(opponentData.ships);
    const myShotsSet = new Set(toArraySafe(myData.shotsFired));
    const opponentShotsSet = new Set(toArraySafe(opponentData.shotsFired));

    const enemySunkCount = opponentShips.filter(s => {
        const cells = toArraySafe(s.cells);
        return cells.length > 0 && cells.every(([r, c]) => myShotsSet.has(key(r, c)));
    }).length;

    const mySunkCount = myShips.filter(s => {
        const cells = toArraySafe(s.cells);
        return cells.length > 0 && cells.every(([r, c]) => opponentShotsSet.has(key(r, c)));
    }).length;

    if (ui.playerShipsLeft) ui.playerShipsLeft.textContent = Math.max(0, myShips.length - mySunkCount);
    if (ui.enemyShipsLeft) ui.enemyShipsLeft.textContent = Math.max(0, opponentShips.length - enemySunkCount);

    if (opponentShips.length > 0 && enemySunkCount === opponentShips.length) {
        if (game.roomCode) {
            update(ref(db, `battaglia_rooms/${game.roomCode}`), { winner: game.playerRole }).catch(() => { });
        }
        finishGameMulti(true);
    } else if (myShips.length > 0 && mySunkCount === myShips.length) {
        if (game.roomCode) {
            update(ref(db, `battaglia_rooms/${game.roomCode}`), { winner: opponentRole }).catch(() => { });
        }
        finishGameMulti(false);
    }
}

function finishGameMulti(playerWon) {
    if (game.phase === "finished") return;
    game.phase = "finished";

    const myFullTitle = formatFullTitle(game.myRank, game.playerName);
    const oppFullTitle = formatFullTitle(game.opponentRank, game.opponentName);

    if (ui.resultTitle) ui.resultTitle.textContent = playerWon ? "Vittoria!" : "Sconfitta";
    if (ui.resultMessage) {
        ui.resultMessage.textContent = playerWon
            ? `${myFullTitle}, hai distrutto la flotta di ${oppFullTitle}!`
            : `${oppFullTitle} ha affondato tutta la tua flotta.`;
    }
    if (ui.turn) ui.turn.textContent = "Partita conclusa";
    setStatus(
        playerWon ? "Vittoria!" : "Sconfitta",
        playerWon ? `Missione compiuta, ${myFullTitle}!` : `Tutte le navi di ${myFullTitle} sono state affondate.`,
        playerWon ? "cyan" : "red"
    );

    playSound(playerWon ? "victory" : "defeat");

    const dialog = document.getElementById("result-dialog");
    setTimeout(() => {
        if (dialog && !dialog.open) {
            dialog.showModal();
        }
    }, 600);
}

// --- RENDER COMUNE DELLE PLANCE ---

function renderBattleBoards() {
    if (ui.playerBoard) {
        createBoard(ui.playerBoard, "player");
        const pBoard = ui.playerBoard.querySelector(".board");
        if (pBoard) {
            game.playerShips.forEach(ship => {
                if (ship.cells.length) addShipOverlay(pBoard, ship);
            });
        }
    }

    const incomingShots = game.opponentShots;
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cell = getBoardCell(ui.playerBoard, r, c);
            const k = key(r, c);
            const ship = shipAt(game.playerShips, r, c);

            if (cell && incomingShots.has(k)) {
                if (ship) {
                    cell.classList.add("hit");
                    addFireOverlay(cell);
                } else {
                    cell.classList.add("miss");
                }
            }
        }
    }

    if (ui.enemyBoard) {
        createBoard(ui.enemyBoard, "enemy");
        const eBoard = ui.enemyBoard.querySelector(".board");
        const targetShips = game.mode === "single" ? game.enemyShips : game.opponentShips;

        if (eBoard) {
            targetShips.forEach(ship => {
                const isSunk = game.mode === "single" ? ship.sunk : ship.cells.every(([r, c]) => game.myShots.has(key(r, c)));
                if (isSunk) addShipOverlay(eBoard, ship);
            });
        }
    }

    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cell = getBoardCell(ui.enemyBoard, r, c);
            const k = key(r, c);
            const isShot = game.myShots.has(k);

            if (cell) {
                cell.disabled = game.phase !== "battle" || isShot || game.busy;

                if (isShot) {
                    const wasHit = game.mode === "single" ? !!shipAt(game.enemyShips, r, c) : game.myShotResults[k] === true;
                    if (wasHit) {
                        cell.classList.add("hit");
                        addFireOverlay(cell);
                    } else {
                        cell.classList.add("miss");
                    }
                }
            }
        }
    }

    if (game.mode === "single") {
        if (ui.playerShipsLeft) ui.playerShipsLeft.textContent = game.playerShips.filter(s => !s.sunk).length;
        if (ui.enemyShipsLeft) ui.enemyShipsLeft.textContent = game.enemyShips.filter(s => !s.sunk).length;
        if (ui.turn) ui.turn.textContent = game.busy ? "Computer" : `Turno di ${game.playerName}`;
    }
}

// --- GESTIONE AUDIO E PULSANTI GENERALI ---

if (ui.rotate) {
    ui.rotate.addEventListener("click", () => {
        game.orientation = game.orientation === "H" ? "V" : "H";
        ui.rotate.textContent = `↻ Ruota: ${game.orientation === "H" ? "orizzontale" : "verticale"}`;
        playSound("click");
    });
}

if (ui.autoPlace) {
    ui.autoPlace.addEventListener("click", autoPlacePlayer);
}

if (ui.soundToggle) {
    ui.soundToggle.addEventListener("click", () => {
        game.soundEnabled = !game.soundEnabled;
        ui.soundToggle.textContent = game.soundEnabled ? "♫ Audio ON" : "♫ Audio OFF";
        ui.soundToggle.setAttribute("aria-pressed", String(game.soundEnabled));
        if (game.soundEnabled) playSound("click");
    });
}

if (ui.fullscreenToggle) {
    ui.fullscreenToggle.addEventListener("click", () => {
        playSound("click");
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn("Impossibile attivare lo schermo intero:", err);
            });
        } else {
            document.exitFullscreen().catch(() => { });
        }
    });

    document.addEventListener("fullscreenchange", () => {
        if (document.fullscreenElement) {
            ui.fullscreenToggle.textContent = "⛶ Esci";
        } else {
            ui.fullscreenToggle.textContent = "⛶ Schermo intero";
        }
    });
}

if (ui.roomMenuBtn && ui.roomConfirmDialog) {
    ui.roomMenuBtn.addEventListener("click", () => {
        playSound("click");
        if (game.phase === "room") return;
        ui.roomConfirmDialog.showModal();
    });
}

if (ui.confirmLeaveRoom) {
    ui.confirmLeaveRoom.addEventListener("click", () => {
        playSound("click");
        if (game.mode === "multi" && game.roomCode) {
            if (game.phase === "finished") {
                remove(ref(db, `battaglia_rooms/${game.roomCode}`)).catch(() => { });
            } else if (game.playerRole) {
                update(ref(db, `battaglia_rooms/${game.roomCode}/${game.playerRole}`), {
                    connected: false,
                    ready: false
                }).catch(() => { });
            }
        }
        location.reload();
    });
}

if (ui.rulesToggle && ui.rulesDialog) {
    ui.rulesToggle.addEventListener("click", () => ui.rulesDialog.showModal());
}

if (ui.playAgain) {
    ui.playAgain.addEventListener("click", () => {
        if (game.mode === "multi" && game.roomCode) {
            remove(ref(db, `battaglia_rooms/${game.roomCode}`)).catch(() => { });
        }
        location.reload();
    });
}

document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && game.phase === "setup") {
        e.preventDefault();
        game.orientation = game.orientation === "H" ? "V" : "H";
        if (ui.rotate) ui.rotate.textContent = `↻ Ruota: ${game.orientation === "H" ? "orizzontale" : "verticale"}`;
        playSound("click");
    }
});