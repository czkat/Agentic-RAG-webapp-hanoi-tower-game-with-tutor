// main.js - Updated to integrate with the tutoring chatbot
import { EducationalChatbot } from './EducationalChatbot.js';

// Game state variables
let towers = [[], [], []];
let diskCount = 3;
let moves = 0;
let startTime = null;
let gameHistory = [];
let chatbot = null;

// DOM elements
const towerElements = document.querySelectorAll('.tower');
const resetButton = document.getElementById('reset-btn');
const diskCountInput = document.getElementById('disk-count');
const movesCounter = document.getElementById('moves-counter');
const statusElement = document.getElementById('game-status');

// Initialize the game and chatbot
document.addEventListener('DOMContentLoaded', function() {
    initializeGame();
    initializeChatbot();
    setupEventListeners();
});

function initializeGame() {
    diskCount = parseInt(diskCountInput.value) || 3;
    resetGame();
}

function initializeChatbot() {
    // Initialize the educational chatbot
    chatbot = new EducationalChatbot({
        gameType: 'hanoi-tower',
        difficulty: getDifficultyLevel(),
        onGameStateRequest: getCurrentGameState,
        onHintRequest: handleHintRequest
    });

    // Add chatbot to the page
    document.body.appendChild(chatbot.getElement());

    // Send initial game state to chatbot
    updateChatbotGameState();
}

function setupEventListeners() {
    resetButton.addEventListener('click', resetGame);
    diskCountInput.addEventListener('change', handleDiskCountChange);

    // Add drag and drop listeners
    towerElements.forEach((tower, index) => {
        tower.addEventListener('dragover', handleDragOver);
        tower.addEventListener('drop', (e) => handleDrop(e, index));
    });

    // Add click listeners for mobile/accessibility
    towerElements.forEach((tower, index) => {
        tower.addEventListener('click', (e) => handleTowerClick(e, index));
    });
}

function resetGame() {
    towers = [[], [], []];
    moves = 0;
    startTime = Date.now();
    gameHistory = [];

    // Initialize first tower with disks
    for (let i = diskCount; i >= 1; i--) {
        towers[0].push(i);
    }

    updateDisplay();
    updateMovesCounter();
    updateStatus('Game started! Move all disks to the rightmost tower.');

    // Update chatbot with new game state
    updateChatbotGameState();

    // Log game reset in history
    logGameAction('reset', {
        diskCount: diskCount,
        timestamp: Date.now()
    });
}

function handleDiskCountChange() {
    const newCount = parseInt(diskCountInput.value);
    if (newCount >= 3 && newCount <= 8) {
        diskCount = newCount;
        resetGame();
    }
}

let selectedTower = -1;

function handleTowerClick(e, towerIndex) {
    e.preventDefault();

    if (selectedTower === -1) {
        // First click - select source tower
        if (towers[towerIndex].length > 0) {
            selectedTower = towerIndex;
            highlightTower(towerIndex, true);
            updateStatus(`Selected tower ${towerIndex + 1}. Click destination tower.`);
        } else {
            updateStatus('Cannot select empty tower. Choose a tower with disks.');
        }
    } else {
        // Second click - attempt move
        if (selectedTower === towerIndex) {
            // Clicked same tower - deselect
            highlightTower(selectedTower, false);
            selectedTower = -1;
            updateStatus('Selection cancelled. Click a tower to select.');
        } else {
            // Attempt move
            const moveResult = attemptMove(selectedTower, towerIndex);
            highlightTower(selectedTower, false);
            selectedTower = -1;

            if (moveResult.success) {
                updateStatus(`Moved disk from tower ${selectedTower + 1} to tower ${towerIndex + 1}`);
            } else {
                updateStatus(moveResult.message);
            }
        }
    }
}

function highlightTower(towerIndex, highlight) {
    const towerElement = towerElements[towerIndex];
    if (highlight) {
        towerElement.classList.add('selected');
    } else {
        towerElement.classList.remove('selected');
    }
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e, towerIndex) {
    e.preventDefault();
    const diskSize = parseInt(e.dataTransfer.getData('text/plain'));
    const sourceTower = findDiskTower(diskSize);

    if (sourceTower !== -1) {
        attemptMove(sourceTower, towerIndex);
    }
}

function findDiskTower(diskSize) {
    for (let i = 0; i < towers.length; i++) {
        if (towers[i].length > 0 && towers[i][towers[i].length - 1] === diskSize) {
            return i;
        }
    }
    return -1;
}

function attemptMove(fromTower, toTower) {
    const moveData = {
        from: fromTower,
        to: toTower,
        timestamp: Date.now(),
        gameState: getCurrentGameState()
    };

    if (towers[fromTower].length === 0) {
        return {
            success: false,
            message: 'No disk to move from selected tower.'
        };
    }

    const diskToMove = towers[fromTower][towers[fromTower].length - 1];
    const topDiskOnTarget = towers[toTower].length > 0 ?
        towers[toTower][towers[toTower].length - 1] : Infinity;

    if (diskToMove > topDiskOnTarget) {
        // Log failed move attempt
        logGameAction('failed_move', {
            ...moveData,
            reason: 'larger_on_smaller',
            diskSize: diskToMove,
            targetDiskSize: topDiskOnTarget
        });

        return {
            success: false,
            message: 'Cannot place larger disk on smaller disk!'
        };
    }

    // Valid move
    towers[fromTower].pop();
    towers[toTower].push(diskToMove);
    moves++;

    // Log successful move
    logGameAction('move', {
        ...moveData,
        diskSize: diskToMove,
        success: true
    });

    updateDisplay();
    updateMovesCounter();
    updateChatbotGameState();

    // Check for win condition
    if (checkWinCondition()) {
        handleGameWin();
    }

    return {
        success: true,
        message: `Moved disk ${diskToMove}`
    };
}

function checkWinCondition() {
    return towers[2].length === diskCount;
}

function handleGameWin() {
    const endTime = Date.now();
    const totalTime = Math.floor((endTime - startTime) / 1000);
    const optimalMoves = Math.pow(2, diskCount) - 1;

    updateStatus(`🎉 Congratulations! You solved it in ${moves} moves and ${totalTime} seconds!`);

    // Log game completion
    logGameAction('game_complete', {
        moves: moves,
        time: totalTime,
        optimalMoves: optimalMoves,
        efficiency: Math.round((optimalMoves / moves) * 100),
        diskCount: diskCount,
        timestamp: endTime
    });

    // Notify chatbot of game completion
    if (chatbot) {
        chatbot.handleGameComplete({
            moves,
            time: totalTime,
            optimalMoves,
            diskCount
        });
    }
}

function updateDisplay() {
    towerElements.forEach((towerElement, index) => {
        // Clear existing disks
        const disksContainer = towerElement.querySelector('.disks') || towerElement;
        disksContainer.innerHTML = '';

        // Add disks from bottom to top
        towers[index].forEach((diskSize, diskIndex) => {
            const diskElement = createDiskElement(diskSize, diskIndex === towers[index].length - 1);
            disksContainer.appendChild(diskElement);
        });
    });
}

function createDiskElement(size, isTopDisk) {
    const disk = document.createElement('div');
    disk.className = `disk disk-${size}`;
    disk.draggable = isTopDisk;
    disk.style.width = `${size * 20 + 40}px`;
    disk.style.height = '20px';
    disk.style.backgroundColor = `hsl(${size * 40}, 70%, 60%)`;
    disk.style.margin = '2px auto';
    disk.style.borderRadius = '10px';
    disk.style.border = '2px solid #333';
    disk.style.cursor = isTopDisk ? 'grab' : 'default';

    if (isTopDisk) {
        disk.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', size.toString());
            disk.style.opacity = '0.5';
        });

        disk.addEventListener('dragend', () => {
            disk.style.opacity = '1';
        });
    }

    return disk;
}

function updateMovesCounter() {
    if (movesCounter) {
        const optimalMoves = Math.pow(2, diskCount) - 1;
        movesCounter.textContent = `Moves: ${moves} (Optimal: ${optimalMoves})`;
    }
}

function updateStatus(message) {
    if (statusElement) {
        statusElement.textContent = message;
    }
}

function getCurrentGameState() {
    return {
        towers: towers.map(tower => [...tower]), // Deep copy
        moves: moves,
        diskCount: diskCount,
        isComplete: checkWinCondition(),
        timeElapsed: startTime ? Date.now() - startTime : 0,
        selectedTower: selectedTower,
        lastMove: gameHistory.length > 0 ? gameHistory[gameHistory.length - 1] : null,
        efficiency: moves > 0 ? Math.round(((Math.pow(2, diskCount) - 1) / moves) * 100) : 0
    };
}

function getDifficultyLevel() {
    if (diskCount <= 3) return 'beginner';
    if (diskCount <= 5) return 'intermediate';
    return 'advanced';
}

function logGameAction(action, data) {
    const logEntry = {
        action: action,
        timestamp: Date.now(),
        gameState: getCurrentGameState(),
        ...data
    };

    gameHistory.push(logEntry);

    // Keep history manageable (last 50 actions)
    if (gameHistory.length > 50) {
        gameHistory = gameHistory.slice(-30);
    }

    // Provide context to chatbot
    if (chatbot) {
        chatbot.updateGameHistory(gameHistory);
    }
}

function updateChatbotGameState() {
    if (chatbot) {
        const gameState = getCurrentGameState();
        chatbot.updateGameState(gameState);
    }
}

function handleHintRequest() {
    // This will be called by the chatbot when user asks for hints
    const gameState = getCurrentGameState();

    if (gameState.isComplete) {
        return "You've already solved the puzzle! Try increasing the difficulty.";
    }

    if (gameState.moves === 0) {
        return "Start by moving the smallest disk. Remember, you can never place a larger disk on a smaller one.";
    }

    // Provide contextual hints based on game state
    const hints = generateContextualHints(gameState);
    return hints[0] || "Think about which disk you need to move to make progress toward your goal.";
}

function generateContextualHints(gameState) {
    const hints = [];

    // Check if player is making efficient moves
    const optimalMoves = Math.pow(2, gameState.diskCount) - 1;
    const efficiency = (optimalMoves / gameState.moves) * 100;

    if (efficiency < 50 && gameState.moves > 5) {
        hints.push("Try to think ahead - each move should bring you closer to the goal.");
    }

    // Check for common patterns
    if (gameState.towers[0].length === gameState.diskCount) {
        hints.push("Start by moving the smallest disk first.");
    }

    if (gameState.selectedTower !== -1) {
        hints.push("You've selected a tower. Now choose where to move the top disk.");
    }

    // General strategy hints
    hints.push("Remember: to move a large disk, you first need to move all smaller disks out of the way.");
    hints.push("The smallest disk alternates between the three towers in a pattern.");

    return hints;
}

// Export functions for use by chatbot
window.gameAPI = {
    getCurrentGameState,
    getGameHistory: () => gameHistory,
    resetGame,
    getDifficultyLevel,
    handleHintRequest
};

// Add some CSS for selected tower highlighting
const style = document.createElement('style');
style.textContent = `
    .tower.selected {
        background-color: rgba(102, 126, 234, 0.2);
        border: 2px solid #667eea;
        border-radius: 8px;
    }

    .tower {
        transition: all 0.2s ease;
        cursor: pointer;
        padding: 10px;
        min-height: 200px;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
    }

    .tower:hover {
        background-color: rgba(0, 0, 0, 0.05);
    }

    .disk {
        transition: all 0.2s ease;
    }

    .disk:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
`;
document.head.appendChild(style);
