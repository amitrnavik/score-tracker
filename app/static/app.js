let currentGameId = null;
let currentGame = null;
let isViewer = false;
let isManager = false;


// ===============================
// CREATE GAME
// ===============================

const addPlayerInputButton =
    document.getElementById("add-player-input");

const createGameButton =
    document.getElementById("create-game");

const playerInputs =
    document.getElementById("player-inputs");

const createError =
    document.getElementById("create-error");

const newGameButton =
    document.getElementById("new-game-button");

const newGameForm =
    document.getElementById("new-game-form");


addPlayerInputButton.addEventListener("click", () => {

    const count =
        playerInputs.querySelectorAll("input").length;

    if (count >= 10) {
        createError.textContent =
            "Maximum 10 players allowed.";
        return;
    }

    const wrapper =
        document.createElement("div");

    wrapper.className = "player-input";

    wrapper.innerHTML = `
        <input
            type="text"
            placeholder="Player ${count + 1}"
        >
    `;

    playerInputs.appendChild(wrapper);
});


createGameButton.addEventListener("click", async () => {

    createError.textContent = "";

    const inputs =
        playerInputs.querySelectorAll("input");

    const players = [];

    inputs.forEach(input => {
        const name = input.value.trim();

        if (name) {
            players.push(name);
        }
    });

    if (players.length < 2) {
        createError.textContent =
            "Please enter at least 2 player names.";
        return;
    }

    try {

        createGameButton.disabled = true;
        createGameButton.textContent = "Creating...";

        const response = await fetch("/games/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                players: players
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || "Unable to create game"
            );
        }

        currentGameId = data.game_id;
        isManager = true;

        if (data.manage_code) {
            localStorage.setItem(
                `game_${data.game_id}_manage_code`,
                data.manage_code
            );
        }

        await loadGame();

        showScreen("game-screen");

    } catch (error) {

        createError.textContent =
            error.message;

    } finally {

        createGameButton.disabled = false;
        createGameButton.textContent = "Start Game";
    }
});


// ===============================
// LOAD GAME
// ===============================

async function loadGame() {

    const response = await fetch(
        `/games/${currentGameId}`
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.detail || "Unable to load game"
        );
    }

    currentGame = data;

    renderGame();
}


// ===============================
// RENDER GAME
// ===============================

function renderGame() {

    document.getElementById("game-code").textContent =
        currentGame.game_code;

    renderBalances();
    renderScoreboard();
    renderPlayers();

    const isActive =
        currentGame.status === "active";

    const canEdit =
        isActive && isManager;

    addRoundButton.disabled = !canEdit;
    addPlayerButton.disabled = !canEdit;
    endGameButton.disabled = !canEdit;

    if (!canEdit) {

        addRoundButton.classList.add("hidden");
        addPlayerButton.classList.add("hidden");
        endGameButton.classList.add("hidden");

    } else {

        addRoundButton.classList.remove("hidden");
        addPlayerButton.classList.remove("hidden");
        endGameButton.classList.remove("hidden");
    }
}


// ===============================
// BALANCES
// ===============================

function renderBalances() {

    const container =
        document.getElementById("balances");

    container.innerHTML = "";

    currentGame.players.forEach(player => {

        const row =
            document.createElement("div");

        row.className = "balance-row";

        const balance =
            player.balance;

        let amountText;

        if (balance > 0) {
            amountText = `+₹${balance}`;
        } else if (balance < 0) {
            amountText = `-₹${Math.abs(balance)}`;
        } else {
            amountText = "₹0";
        }

        row.innerHTML = `
            <span>${escapeHtml(player.name)}</span>
            <span class="${
                balance > 0
                    ? "positive"
                    : balance < 0
                        ? "negative"
                        : "zero"
            }">
                ${amountText}
            </span>
        `;

        container.appendChild(row);
    });
}


// ===============================
// SCOREBOARD
// ===============================

function renderScoreboard() {

    const header =
        document.getElementById("scoreboard-header");

    const body =
        document.getElementById("scoreboard-body");

    header.innerHTML = "<th>Round</th>";
    body.innerHTML = "";

    const activePlayers =
        currentGame.players.filter(
            player => player.status === "active"
        );

    activePlayers.forEach(player => {

        const th =
            document.createElement("th");

        th.textContent = player.name;

        header.appendChild(th);
    });

    currentGame.rounds.forEach(round => {

        const tr =
            document.createElement("tr");

        const roundCell =
            document.createElement("td");

        roundCell.textContent =
            round.round_number;

        tr.appendChild(roundCell);

        activePlayers.forEach(player => {

            const td =
                document.createElement("td");

            const amount =
                round.scores[player.name];

            if (amount === undefined) {
                td.textContent = "-";
            } else {

                td.textContent =
                    amount === 0
                        ? "0"
                        : `₹${amount}`;

                if (
                    round.winner === player.name
                ) {
                    td.classList.add("winner");
                }
            }

            tr.appendChild(td);
        });

        body.appendChild(tr);
    });
}


// ===============================
// PLAYERS
// ===============================

function renderPlayers() {

    const container =
        document.getElementById("players-list");

    container.innerHTML = "";

    currentGame.players.forEach(player => {

        const row =
            document.createElement("div");

        row.className = "player-row";

        const status =
            player.status === "active"
                ? "Active"
                : "Left";

        row.innerHTML = `
            <div>
                <strong>
                    ${escapeHtml(player.name)}
                </strong>

                <div class="player-status">
                    ${status}
                </div>
            </div>

            ${
                player.status === "active" && !isViewer
                    ? `
                        <button
                            class="secondary-button small"
                            onclick="removePlayer(${player.player_id})"
                        >
                            Remove
                        </button>
                    `
                    : ""
            }
        `;

        container.appendChild(row);
    });
}


// ===============================
// REMOVE PLAYER
// ===============================

async function removePlayer(playerId) {

    const player =
        currentGame.players.find(
            p => p.player_id === playerId
        );

    if (!player) {
        return;
    }

    const confirmed =
        confirm(
            `Remove ${player.name} from the game?`
        );

    if (!confirmed) {
        return;
    }

    try {

        const response = await fetch(
            `/games/${currentGameId}/players/${playerId}`,
            {
                method: "DELETE"
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || "Unable to remove player"
            );
        }

        await loadGame();

    } catch (error) {

        document.getElementById("game-error").textContent =
            error.message;
    }
}


// ===============================
// SCREEN MANAGEMENT
// ===============================

function showScreen(screenId) {

    document
        .querySelectorAll(".screen")
        .forEach(screen => {
            screen.classList.add("hidden");
        });

    document
        .getElementById(screenId)
        .classList.remove("hidden");
}


// ===============================
// HTML ESCAPE
// ===============================

function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent = value;

    return div.innerHTML;
}

// ===============================
// ADD ROUND
// ===============================

const addRoundButton =
    document.getElementById("add-round");

const roundForm =
    document.getElementById("round-form");

const roundScoreInputs =
    document.getElementById("round-score-inputs");

const saveRoundButton =
    document.getElementById("save-round");

const cancelRoundButton =
    document.getElementById("cancel-round");

const roundError =
    document.getElementById("round-error");


addRoundButton.addEventListener("click", () => {

    roundError.textContent = "";

    roundScoreInputs.innerHTML = "";

    const activePlayers =
        currentGame.players.filter(
            player => player.status === "active"
        );

    activePlayers.forEach(player => {

        const row =
            document.createElement("div");

        row.className = "round-score-row";

        row.innerHTML = `
            <label>
                ${escapeHtml(player.name)}
            </label>

            <input
                type="number"
                min="0"
                step="1"
                data-player-id="${player.player_id}"
                placeholder="Amount"
            >
        `;

        roundScoreInputs.appendChild(row);
    });

    roundForm.classList.remove("hidden");

    addRoundButton.classList.add("hidden");
});


cancelRoundButton.addEventListener("click", () => {

    roundForm.classList.add("hidden");

    addRoundButton.classList.remove("hidden");

    roundError.textContent = "";
});


saveRoundButton.addEventListener("click", async () => {

    roundError.textContent = "";

    const inputs =
        roundScoreInputs.querySelectorAll("input");

    const scores = [];

    for (const input of inputs) {

        if (input.value === "") {

            roundError.textContent =
                "Please enter an amount for every player.";

            return;
        }

        const amount =
            Number(input.value);

        if (!Number.isInteger(amount) || amount < 0) {

            roundError.textContent =
                "Amounts must be whole numbers greater than or equal to 0.";

            return;
        }

        scores.push({
            player_id:
                Number(input.dataset.playerId),

            amount: amount
        });
    }

    const winners =
        scores.filter(
            score => score.amount === 0
        );

    if (winners.length !== 1) {

        roundError.textContent =
            "Exactly one player must have 0.";

        return;
    }

    try {

        saveRoundButton.disabled = true;
        saveRoundButton.textContent = "Saving...";

        const response = await fetch(
            `/games/${currentGameId}/rounds/`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    scores: scores
                })
            }
        );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.detail || "Unable to save round"
            );
        }

        roundForm.classList.add("hidden");

        addRoundButton.classList.remove("hidden");

        await loadGame();

    } catch (error) {

        roundError.textContent =
            error.message;

    } finally {

        saveRoundButton.disabled = false;
        saveRoundButton.textContent = "Save Round";
    }
});


// ===============================
// ADD PLAYER
// ===============================

const addPlayerButton =
    document.getElementById("add-player");


addPlayerButton.addEventListener("click", async () => {

    const name = prompt("Enter player name:");

    if (name === null) {
        return;
    }

    const playerName = name.trim();

    if (!playerName) {
        alert("Please enter a player name.");
        return;
    }

    try {

        const response = await fetch(
            `/games/${currentGameId}/players/`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    name: playerName
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || "Unable to add player"
            );
        }

        await loadGame();

    } catch (error) {

        document.getElementById("game-error").textContent =
            error.message;
    }
});


// ===============================
// SHARE GAME
// ===============================

const shareGameButton =
    document.getElementById("share-game");


shareGameButton.addEventListener("click", async () => {

    const gameUrl =
        `${window.location.origin}/game/${currentGame.game_code}`;

    const shareText =
        `Join my 3 Patti game!\nGame Code: ${currentGame.game_code}`;

    try {

        if (navigator.share) {

            await navigator.share({
                title: "3 Patti Score Tracker",
                text: shareText,
                url: gameUrl
            });

        } else {

            await navigator.clipboard.writeText(
                `${shareText}\n${gameUrl}`
            );

            alert("Game link copied!");
        }

    } catch (error) {

        if (error.name !== "AbortError") {
            console.error(error);
        }
    }
});


// ===============================
// END GAME
// ===============================

const endGameButton =
    document.getElementById("end-game");


endGameButton.addEventListener("click", async () => {

    const confirmed =
        confirm(
            "Are you sure you want to end this game?"
        );

    if (!confirmed) {
        return;
    }

    try {

        const response = await fetch(
            `/games/${currentGameId}/end`,
            {
                method: "POST"
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || "Unable to end game"
            );
        }

        await loadGame();

        alert("Game ended successfully.");

    } catch (error) {

        document.getElementById("game-error").textContent =
            error.message;
    }
});


// ===============================
// SETTLEMENT
// ===============================

const settlementButton =
    document.getElementById("settlement-button");

const backToGameButton =
    document.getElementById("back-to-game");


settlementButton.addEventListener("click", async () => {

    try {

        const balanceResponse =
            await fetch(
                `/games/${currentGameId}/settlement`
            );

        const balanceData =
            await balanceResponse.json();

        if (!balanceResponse.ok) {
            throw new Error(
                balanceData.detail ||
                "Unable to load settlement"
            );
        }


        const paymentResponse =
            await fetch(
                `/games/${currentGameId}/settlement/payments`
            );

        const paymentData =
            await paymentResponse.json();

        if (!paymentResponse.ok) {
            throw new Error(
                paymentData.detail ||
                "Unable to load payments"
            );
        }

        renderSettlement(
            balanceData,
            paymentData
        );

        showScreen("settlement-screen");

    } catch (error) {

        document.getElementById("game-error").textContent =
            error.message;
    }
});


backToGameButton.addEventListener("click", () => {

    showScreen("game-screen");

});

newGameButton.addEventListener("click", () => {

    newGameForm.classList.remove("hidden");

    newGameButton.classList.add("hidden");

});


function renderSettlement(
    balanceData,
    paymentData
) {

    const balancesContainer =
        document.getElementById(
            "settlement-balances"
        );

    const paymentsContainer =
        document.getElementById(
            "payments"
        );


    balancesContainer.innerHTML = "";

    balanceData.settlement.forEach(player => {

        const row =
            document.createElement("div");

        row.className = "balance-row";

        const balance =
            player.balance;

        let amountText;

        if (balance > 0) {
            amountText = `+₹${balance}`;
        } else if (balance < 0) {
            amountText =
                `-₹${Math.abs(balance)}`;
        } else {
            amountText = "₹0";
        }

        row.innerHTML = `
            <span>
                ${escapeHtml(player.name)}
            </span>

            <span class="${
                balance > 0
                    ? "positive"
                    : balance < 0
                        ? "negative"
                        : "zero"
            }">
                ${amountText}
            </span>
        `;

        balancesContainer.appendChild(row);
    });


    paymentsContainer.innerHTML = "";

    if (paymentData.payments.length === 0) {

        paymentsContainer.innerHTML =
            "<p>Everyone is settled up.</p>";

        return;
    }


    paymentData.payments.forEach(payment => {

        const div =
            document.createElement("div");

        div.className = "payment";

        div.innerHTML = `
            <strong>
                ${escapeHtml(payment.from_player)}
            </strong>

            pays

            <strong>
                ${escapeHtml(payment.to_player)}
            </strong>

            <strong>
                ₹${payment.amount}
            </strong>
        `;

        paymentsContainer.appendChild(div);
    });
}

// ===============================
// LOAD GAME FROM URL
// ===============================

async function loadGameFromCode(gameCode) {

    const response = await fetch(
        `/games/code/${encodeURIComponent(gameCode)}`
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.detail || "Game not found"
        );
    }

    currentGameId = data.game_id;

    await loadGame();

    showScreen("game-screen");
}


// ===============================
// OPEN SHARED GAME
// ===============================

async function initializeApp() {

    const pathParts =
        window.location.pathname
            .split("/")
            .filter(Boolean);


    if (
        pathParts.length === 2 &&
        pathParts[0] === "game"
    ) {

        const gameCode =
            pathParts[1];

        isViewer = true;
        isManager = false;

        try {

            await loadGameFromCode(
                gameCode
            );

        } catch (error) {

            showScreen("create-screen");

            createError.textContent =
                error.message;
        }

        return;
    }


    if (
        pathParts.length === 2 &&
        pathParts[0] === "manage"
    ) {

        const manageCode =
            pathParts[1];

        isViewer = false;
        isManager = true;

        try {

            const response =
                await fetch(
                    `/games/manage/${encodeURIComponent(
                        manageCode
                    )}`
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.detail ||
                    "Game not found"
                );
            }

            currentGameId =
                data.game_id;

            await loadGame();

            showScreen("game-screen");

        } catch (error) {

            showScreen("create-screen");

            createError.textContent =
                error.message;
        }

        return;
    }


    isViewer = false;
    isManager = false;

    showScreen("create-screen");

    try {

        await loadGameList();

    } catch (error) {

        console.error(
            "Unable to load games:",
            error
        );
    }
}


// ===============================
// AUTO REFRESH
// ===============================

setInterval(async () => {

    if (!currentGameId) {
        return;
    }

    try {
        await loadGame();
    } catch (error) {
        console.error(
            "Unable to refresh game:",
            error
        );
    }

}, 5000);


async function loadGameList() {

    const response =
        await fetch("/games/");

    const games =
        await response.json();

    if (!response.ok) {
        throw new Error(
            games.detail || "Unable to load games"
        );
    }

    renderGameList(games);
}

function renderGameList(games) {
    const runningList = document.getElementById("running-games-list");
    const historyList = document.getElementById("history-games-list");

    const runningCount = document.getElementById("running-games-count");
    const historyCount = document.getElementById("history-games-count");

    runningList.innerHTML = "";
    historyList.innerHTML = "";

    const runningGames = games.filter(game => game.status === "active");
    const historyGames = games.filter(game => game.status !== "active");

    runningCount.textContent = runningGames.length;
    historyCount.textContent = historyGames.length;

    if (runningGames.length === 0) {
        runningList.innerHTML = `
            <div class="empty-state">
                No running games
            </div>
        `;
    } else {
        runningGames.forEach(game => {
            runningList.appendChild(
                createGameListItem(game, true)
            );
        });
    }

    if (historyGames.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                No games in history
            </div>
        `;
    } else {
        historyGames.forEach(game => {
            historyList.appendChild(
                createGameListItem(game, false)
            );
        });
    }
}

function createGameListItem(game, isRunning) {
    const card = document.createElement("div");
    card.className = "game-list-card";

    let playerNames = [];

    if (Array.isArray(game.players)) {
        playerNames = game.players
            .map(player => {
                if (typeof player === "string") {
                    return player;
                }

                return player.name || "";
            })
            .filter(Boolean);
    } else if (Array.isArray(game.player_names)) {
        playerNames = game.player_names.filter(Boolean);
    }

    const roundCount =
        Number.isFinite(game.round_count)
            ? game.round_count
            : Array.isArray(game.rounds)
                ? game.rounds.length
                : 0;

    const startedAt = game.created_at
        ? formatGameDateTime(game.created_at)
        : "";

    card.innerHTML = `
        <div class="game-info">
            <div class="game-main-info">
                <div class="game-code">
                    ${escapeHtml(game.game_code)}
                </div>

                <div class="game-details">
                    ${playerNames.length} Players
                    <span>•</span>
                    ${roundCount} Rounds
                </div>

                <div class="game-players">
                    ${escapeHtml(playerNames)}
                </div>
            </div>

            <div class="game-started">
                <div>${startedAt.date}</div>
                <div>${startedAt.time}</div>
            </div>
        </div>

        <div class="game-actions">
            ${
                isRunning
                    ? `
                        <button
                            class="secondary-btn continue-game-btn"
                            type="button"
                        >
                            Continue
                        </button>

                        <button
                            class="danger-btn end-game-btn"
                            type="button"
                        >
                            End Game
                        </button>
                    `
                    : `
                        <button
                            class="secondary-btn view-result-btn"
                            type="button"
                        >
                            View Result
                        </button>
                    `
            }
        </div>
    `;

    if (isRunning) {
        const continueButton =
            card.querySelector(".continue-game-btn");

        const endButton =
            card.querySelector(".end-game-btn");

        continueButton.addEventListener("click", () => {
            continueGame(game);
        });

        endButton.addEventListener("click", () => {
            endGameFromDashboard(game);
        });
    } else {
        const viewButton =
            card.querySelector(".view-result-btn");

        viewButton.addEventListener("click", () => {
            viewGameResult(game);
        });
    }

    return card;
}

function setupDashboardToggles() {
    const runningToggle = document.getElementById("toggle-running-games");
    const historyToggle = document.getElementById("toggle-history-games");

    const runningList = document.getElementById("running-games-list");
    const historyList = document.getElementById("history-games-list");

    // Default state:
    // Running Games = open
    // Game History = closed
    runningList.classList.remove("hidden");
    historyList.classList.add("hidden");

    runningToggle.textContent = "▲";
    historyToggle.textContent = "▼";

    runningToggle.setAttribute("aria-expanded", "true");
    historyToggle.setAttribute("aria-expanded", "false");

    if (runningToggle) {
        runningToggle.addEventListener("click", () => {
            const isHidden = runningList.classList.toggle("hidden");

            runningToggle.setAttribute(
                "aria-expanded",
                String(!isHidden)
            );

            runningToggle.textContent = isHidden ? "▼" : "▲";
        });
    }

    if (historyToggle) {
        historyToggle.addEventListener("click", () => {
            const isHidden = historyList.classList.toggle("hidden");

            historyToggle.setAttribute(
                "aria-expanded",
                String(!isHidden)
            );

            historyToggle.textContent = isHidden ? "▼" : "▲";
        });
    }
}


function formatGameDateTime(dateString) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return {
            date: "",
            time: ""
        };
    }

    return {
        date: date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }),
        time: date.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        })
    };
}

async function endGameFromDashboard(game) {

    const gameId = game.id ?? game.game_id;

    if (!gameId) {
        alert("Game ID not found.");
        console.error("Invalid game object:", game);
        return;
    }

    const confirmed = confirm(
        `Are you sure you want to end game ${game.game_code}?`
    );

    if (!confirmed) {
        return;
    }

    try {

        const response = await fetch(
            `/games/${gameId}/end`,
            {
                method: "POST"
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail ||
                "Failed to end game"
            );
        }

        await loadGameList();

        alert(
            "Game ended successfully."
        );

    } catch (error) {

        console.error(
            "End game error:",
            error
        );

        alert(error.message);
    }
}

function continueGame(game) {

    const gameId = game.id ?? game.game_id;

    let manageCode = game.manage_code;

    if (!manageCode && gameId) {
        manageCode = localStorage.getItem(
            `game_${gameId}_manage_code`
        );
    }

    if (!manageCode || manageCode === "undefined") {
        alert(
            "Management link not found for this game."
        );
        return;
    }

    window.location.href =
        `/manage/${manageCode}`;
}

function viewGameResult(game) {
    window.location.href = `/game/${game.game_code}`;
}

// ===============================
// INITIALIZE APP
// ===============================

setupDashboardToggles();
initializeApp();