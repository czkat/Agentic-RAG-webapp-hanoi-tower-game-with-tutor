class Game {
    constructor() {
        this.towers = [new Tower(0), new Tower(1), new Tower(2)];
        this.moveCount = 0;
        this.totalDisks = 3;
        this.moveLog = [];
        this.solving = false;
        this.solvingTimeouts = [];
        this.previousMoveCount = 0;
        
        // Set up event handlers
        this.setupEventHandlers();
        
        // Clean up when drag ends
        document.addEventListener('dragend', e => {
            if (e.target.classList.contains('disk')) {
                e.target.classList.remove('dragging');
            }
        });
        
        // Detect stuck player
        setInterval(() => {
            this.previousMoveCount = this.moveCount;
        }, 5000);
        
        // Initialize the game
        this.initializeGame(this.totalDisks);

        document.querySelectorAll('.rod').forEach(rod => {
        rod.addEventListener('dragover', this.handleDragOver.bind(this));
        rod.addEventListener('drop', this.handleDrop.bind(this));
    });
    }

    handleDragOver(e) {
        e.preventDefault();
    }

    handleDrop(e) {
        e.preventDefault();
        const targetRod = parseInt(e.target.closest('.rod').dataset.rod);
        const diskSize = parseInt(e.dataTransfer.getData('text/plain'));
        
        // Find source rod
        let sourceRod = -1;
        this.towers.forEach((tower, index) => {
            if (tower.getTopDiskSize() === diskSize) {
                sourceRod = index;
            }
        });
        
        if (sourceRod !== -1) {
            this.moveDisk(sourceRod, targetRod);
        }
    }
    
    setupEventHandlers() {
        document.getElementById('reset-btn').addEventListener('click', () => this.resetGame());
        document.getElementById('hint-btn').addEventListener('click', () => this.showHint());
        document.getElementById('log-btn').addEventListener('click', () => this.showLog());
        document.getElementById('solve-btn').addEventListener('click', () => this.solve());
        
        // Add functionality to the Next Game button
        const nextGameButton = document.querySelector('.next-game-button');
        if (nextGameButton) {
            nextGameButton.addEventListener('click', () => {
                alert('Next game feature coming soon!');
            });
        }
        
        // Close the modal when clicking the X
        document.querySelector('.close').addEventListener('click', () => {
            document.getElementById('log-modal').style.display = 'none';
        });
        
        // Close the modal when clicking outside of it
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('log-modal');
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    renderDisks() {
        this.towers.forEach((tower, index) => {
            const rod = document.querySelector(`.rod[data-rod="${index}"]`);
            rod.innerHTML = `<div class="rod-label">${['Source', 'Auxiliary', 'Destination'][index]}</div>`;
            
            tower.disks.forEach(disk => {
                const diskElement = document.createElement('div');
                diskElement.className = `disk disk-${disk.size}`;
                diskElement.style.width = `${40 + (disk.size * 20)}px`;
                rod.appendChild(diskElement);
            });
        });
    }

    initializeGame(diskNumber) {
        this.totalDisks = diskNumber;
        
        // Clear all towers
        this.towers.forEach(tower => {
            tower.disks = [];
        });
        
        // Add disks to the first tower
        for (let i = diskNumber; i >= 1; i--) {
            const disk = new Disk(i);
            this.towers[0].addDisk(disk);
        }
        
        this.moveCount = 0;
        this.moveLog = [];
        
        document.getElementById('moves').textContent = `Moves: ${this.moveCount}`;
        document.getElementById('min-moves').textContent = `Minimum Moves: ${Math.pow(2, this.totalDisks) - 1}`;
        document.getElementById('message').textContent = '';
        document.getElementById('hint').textContent = '';
        
        // Clear any ongoing solving
        this.solving = false;
        this.solvingTimeouts.forEach(timeout => clearTimeout(timeout));
        this.solvingTimeouts = [];
        
        // Render all towers
        this.render();
        this.renderDisks();
    }
    
    resetGame() {
        const diskSelect = document.getElementById('diskCount');
        const selectedDisks = parseInt(diskSelect.value);
        this.initializeGame(selectedDisks);
    }
    
    render() {
        this.towers.forEach(tower => tower.render());
        
        if (this.towers[2].disks.length === this.totalDisks) {
            document.getElementById('message').textContent = 'Congratulations. You won!';
        }
    }
    
    moveDisk(from, to) {
        const fromTower = this.towers[from];
        const toTower = this.towers[to];
        
        if (fromTower.isEmpty()) return false;
        
        const diskSize = fromTower.getTopDiskSize();
        
        if (toTower.isEmpty() || diskSize < toTower.getTopDiskSize()) {
            const disk = fromTower.removeDisk();
            toTower.addDisk(disk);
            
            this.moveCount++;
            document.getElementById('moves').textContent = `Moves: ${this.moveCount}`;
            
            // Log the move
            const fromPeg = String.fromCharCode(65 + from); // A, B, or C
            const toPeg = String.fromCharCode(65 + to); // A, B, or C
            this.moveLog.push(`Disk ${diskSize} from ${fromPeg} to ${toPeg}`);
            
            this.render();
            
            fetch('/.netlify/functions/logMove', {
                method: 'POST',
                body: JSON.stringify({ moves: this.moveCount }),
                headers: { 'Content-Type': 'application/json' }
            }).catch(error => console.error('Error logging move:', error));
            
            return true;
        }
        this.renderDisks();
        return false;
    }
    
    showLog() {
        const modal = document.getElementById('log-modal');
        const logContent = document.getElementById('log-content');
        
        if (this.moveLog.length === 0) {
            logContent.innerHTML = '<p>No moves recorded yet.</p>';
        } else {
            logContent.innerHTML = this.moveLog.map((log, index) => 
                `<p>${index + 1}. ${log}</p>`
            ).join('');
        }
        
        modal.style.display = 'block';
    }
    
    showHint() {
        // Calculate optimal solution steps
        const optimalMoves = Math.pow(2, this.totalDisks) - 1;
        const progress = Math.min(100, Math.round((this.moveCount / optimalMoves) * 100));
        
        // Analyze game state
        const state = this.analyzeGameState();
        
        // Generate context-aware hints
        let hint = "";
        
        if (this.moveCount === 0) {
            hint = "Start by moving the smallest disk. For an odd number of disks, move it to the destination tower; for even, move to the auxiliary tower.";
        } else if (state.isStuck) {
            hint = "You seem stuck. Remember the pattern: move the smallest disk in a clockwise direction (A to B, B to C, or C to A), then make the only valid move that doesn't involve the smallest disk.";
        } else if (state.suboptimalMoves > 5) {
            hint = "Your solution is taking longer than needed. Try to develop a consistent pattern when moving the disks.";
        } else if (state.nearCompletion) {
            hint = "You're almost there! Focus on moving the remaining smaller disks in the right sequence to build on top of the larger ones.";
        } else {
            // Choose a hint based on the specific game situation
            const situationalHints = [
                "Look for the smallest disk - it should move in a consistent cycle between towers.",
                "After moving the smallest disk, there's always exactly one other valid move. Can you spot it?",
                "Think about which tower needs to be cleared to receive the next largest disk.",
                "The Tower of Hanoi has a recursive pattern. How you moved 2 disks is how you'll move groups of disks.",
                "Sometimes you need to make moves that temporarily seem to take you further from your goal."
            ];
            
            // Choose a hint based on disk count, move count, and tower state
            const hintIndex = (this.moveCount + this.totalDisks + this.towers[1].disks.length) % situationalHints.length;
            hint = situationalHints[hintIndex];
        }
        
        document.getElementById("hint").innerHTML = hint;
    }
    
    analyzeGameState() {
        return {
            isStuck: this.moveCount > 0 && this.previousMoveCount === this.moveCount,
            suboptimalMoves: this.moveCount - this.calculateMinimumMoves(),
            nearCompletion: this.towers[2].disks.length >= this.totalDisks - 2
        };
    }
    
    calculateMinimumMoves() {
        return Math.pow(2, this.totalDisks) - 1 - this.towers[2].disks.length * 2;
    }
    
    solve() {
        if (this.solving) return;
        
        // Reset the game first
        this.resetGame();
        this.solving = true;
        
        // Set move durations
        const moveDuration = 500; // 0.5 seconds for the move
        const pauseDuration = 500; // 0.5 seconds pause between moves
        const totalStepTime = moveDuration + pauseDuration;
        
        // Queue to store all moves
        const moveQueue = [];
        
        // Recursive function to determine all moves needed
        const hanoiMoves = (n, source, auxiliary, destination) => {
            if (n === 0) return;
            
            // Move n-1 disks from source to auxiliary
            hanoiMoves(n-1, source, destination, auxiliary);
            
            // Move the nth disk from source to destination
            moveQueue.push([source, destination]);
            
            // Move n-1 disks from auxiliary to destination
            hanoiMoves(n-1, auxiliary, source, destination);
        };
        
        // Calculate all moves needed
        hanoiMoves(this.totalDisks, 0, 1, 2);
        
        // Execute moves with animation
        moveQueue.forEach((move, index) => {
            const timeout = setTimeout(() => {
                const [from, to] = move;
                this.animateMove(from, to, moveDuration);
            }, index * totalStepTime);
            
            this.solvingTimeouts.push(timeout);
        });
        
        // Reset solving status after completion
        const finalTimeout = setTimeout(() => {
            this.solving = false;
        }, moveQueue.length * totalStepTime);
        
        this.solvingTimeouts.push(finalTimeout);
    }
    
    animateMove(from, to, duration) {
        const fromTower = document.querySelector(`.tower[data-index="${from}"]`);
        const toTower = document.querySelector(`.tower[data-index="${to}"]`);
        
        if (!this.towers[from].disks.length) return;
        
        const diskToMove = fromTower.lastChild;
        if (!diskToMove) return;
        
        const diskValue = this.towers[from].getTopDiskSize();
        
        // Create a clone for animation
        const diskClone = diskToMove.cloneNode(true);
        document.body.appendChild(diskClone);
        
        // Position the clone at the source disk position
        const diskRect = diskToMove.getBoundingClientRect();
        const toTowerRect = toTower.getBoundingClientRect();
        
        diskClone.style.position = 'fixed';
        diskClone.style.left = `${diskRect.left}px`;
        diskClone.style.top = `${diskRect.top}px`;
        diskClone.style.zIndex = '1000';
        
        // Calculate destination position
        const destX = toTowerRect.left + (toTowerRect.width - diskRect.width) / 2;
        const destY = toTowerRect.bottom - diskRect.height - (this.towers[to].disks.length * diskRect.height);
        
        // Hide the original disk during animation
        diskToMove.style.visibility = 'hidden';
        
        // Animate
        const startTime = performance.now();
        const animate = (currentTime) => {
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            
            const currentX = diskRect.left + (destX - diskRect.left) * progress;
            const currentY = diskRect.top + (destY - diskRect.top) * progress;
            
            diskClone.style.left = `${currentX}px`;
            diskClone.style.top = `${currentY}px`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete
                document.body.removeChild(diskClone);
                
                // Actually move the disk in the game state
                this.moveDisk(from, to);


                // Ensure all disks are visible after animation
                document.querySelectorAll('.disk').forEach(disk => {
                    disk.style.visibility = 'visible';
                });
            }
        };
        
        requestAnimationFrame(animate);
    }
}
