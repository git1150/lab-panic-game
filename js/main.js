// Main application for Lab Panic
class LabPanicApp {
    constructor() {
        this.game = null;
        this.api = new LabPanicAPI();
        this.currentScreen = 'start';
        
        this.initializeApp();
    }

    initializeApp() {
        // Initialize game when canvas is ready
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            this.game = new LabPanicGame(canvas);
        }

        this.setupEventListeners();
        this.loadLeaderboards();
        
        // Test API connection
        this.testAPIConnection();
    }

    setupEventListeners() {
        // Start button
        const startButton = document.getElementById('startButton');
        if (startButton) {
            startButton.addEventListener('click', () => this.startGame());
        }

        // How to Play button
        const howToPlayButton = document.getElementById('howToPlayButton');
        if (howToPlayButton) {
            howToPlayButton.addEventListener('click', () => this.showHowToPlay());
        }

        // Back to Menu button (How to Play screen)
        const backToMenuButton = document.getElementById('backToMenuButton');
        if (backToMenuButton) {
            backToMenuButton.addEventListener('click', () => this.backToMenu());
        }

        // Leaderboard tabs
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchLeaderboardTab(e.target.dataset.tab);
            });
        });

        // Game over events
        window.addEventListener('gameOver', (e) => {
            this.showGameOver(e.detail.score);
        });

        // Game over screen buttons
        const submitScoreButton = document.getElementById('submitScore');
        if (submitScoreButton) {
            submitScoreButton.addEventListener('click', () => this.submitScore());
        }

        const playAgainButton = document.getElementById('playAgain');
        if (playAgainButton) {
            playAgainButton.addEventListener('click', () => this.playAgain());
        }

        const backToMenuGameOverButton = document.getElementById('backToMenu');
        if (backToMenuGameOverButton) {
            backToMenuGameOverButton.addEventListener('click', () => this.backToMenu());
        }

        const copyUrlButton = document.getElementById('copyUrl');
        if (copyUrlButton) {
            copyUrlButton.addEventListener('click', () => this.copyShareUrl());
        }

        // Name input enter key
        const playerNameInput = document.getElementById('playerName');
        if (playerNameInput) {
            playerNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.submitScore();
                }
            });
        }

        // Window focus/blur events for pause
        window.addEventListener('blur', () => {
            if (this.game && this.game.gameState === 'playing') {
                this.game.pause();
            }
        });

        window.addEventListener('focus', () => {
            if (this.game && this.game.gameState === 'paused') {
                this.game.resume();
            }
        });
    }

    async testAPIConnection() {
        try {
            await this.api.healthCheck();
            console.log('API connection successful');
        } catch (error) {
            console.warn('API connection failed:', error);
            // Show offline mode indicator
            this.showOfflineMode();
        }
    }

    showOfflineMode() {
        // Add offline indicator to UI
        const offlineIndicator = document.createElement('div');
        offlineIndicator.id = 'offlineIndicator';
        offlineIndicator.textContent = 'Offline Mode';
        offlineIndicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #ff6b6b;
            color: white;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 1000;
        `;
        document.body.appendChild(offlineIndicator);
    }

    startGame() {
        this.switchScreen('game');
        if (this.game) {
            // Ensure UI is properly reset before starting
            this.resetGameUI();
            this.game.startGame();
        }
    }

    resetGameUI() {
        // Reset hearts display
        const hearts = ['heart1', 'heart2', 'heart3'];
        hearts.forEach(heartId => {
            const heart = document.getElementById(heartId);
            if (heart) {
                heart.classList.remove('lost');
            }
        });
        
        // Reset score display
        const scoreText = document.getElementById('scoreText');
        if (scoreText) {
            scoreText.textContent = 'Score: 0';
        }
        
        // Reset powerup indicator
        const indicator = document.getElementById('powerupIndicator');
        if (indicator) {
            indicator.classList.remove('active');
        }
    }

    switchScreen(screenName) {
        // Hide all screens
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => screen.classList.remove('active'));

        // Show target screen
        const targetScreen = document.getElementById(`${screenName}Screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }

        this.currentScreen = screenName;
    }

    switchLeaderboardTab(tabName) {
        // Update tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabName);
        });

        // Update leaderboard content
        const leaderboards = document.querySelectorAll('.leaderboard');
        leaderboards.forEach(leaderboard => {
            leaderboard.classList.toggle('active', leaderboard.id === `${tabName}Leaderboard`);
        });

        // Load leaderboard data
        this.loadLeaderboard(tabName);
        
        // Adjust height after tab switch
        setTimeout(() => {
            this.adjustMainMenuHeight();
        }, 100);
    }

    async loadLeaderboards() {
        await Promise.all([
            this.loadLeaderboard('weekly'),
            this.loadLeaderboard('alltime')
        ]);
        
        // Adjust height after loading leaderboards
        setTimeout(() => {
            this.adjustMainMenuHeight();
        }, 100);
    }

    async loadLeaderboard(scope) {
        const listElement = document.getElementById(`${scope}List`);
        if (!listElement) return;

        try {
            listElement.innerHTML = '<div class="loading">Loading...</div>';
            
            const data = await this.api.getLeaderboard(scope, 25);
            this.renderLeaderboard(listElement, data.entries || []);
        } catch (error) {
            console.error(`Failed to load ${scope} leaderboard:`, error);
            listElement.innerHTML = '<div class="loading">Error loading</div>';
        }
    }

    renderLeaderboard(container, entries) {
        if (entries.length === 0) {
            container.innerHTML = '<div class="loading">No scores available</div>';
            return;
        }

        container.innerHTML = entries.map((entry, index) => `
            <div class="leaderboard-entry">
                <span class="rank">#${entry.rank}</span>
                <span class="player-name">${this.escapeHtml(entry.player_name)}</span>
                <span class="score">${entry.score.toLocaleString()}</span>
            </div>
        `).join('');
        
        // Adjust container height based on number of entries (desktop only)
        this.adjustLeaderboardHeight(container, entries.length);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    adjustLeaderboardHeight(container, entryCount) {
        // Only adjust on desktop
        if (window.innerWidth <= 768) return;
        
        const leaderboardContainer = container.closest('.leaderboard-container');
        if (!leaderboardContainer) return;
        
        // Simple calculation: each entry needs about 50px
        const entryHeight = 50;
        const titleHeight = 60;
        const padding = 40;
        
        // Calculate needed height
        const neededHeight = titleHeight + (entryCount * entryHeight) + padding;
        
        // Set limits
        const minHeight = 200;
        const maxHeight = 600;
        const finalHeight = Math.max(minHeight, Math.min(neededHeight, maxHeight));
        
        console.log(`Adjusting leaderboard: ${entryCount} entries, height: ${finalHeight}px`);
        
        // Force the height
        leaderboardContainer.style.maxHeight = `${finalHeight}px`;
        leaderboardContainer.style.height = `${finalHeight}px`;
        
        // Adjust list height too
        const listHeight = Math.max(100, Math.min(entryCount * entryHeight, 700));
        container.style.maxHeight = `${listHeight}px`;
        
        // Force main menu adjustment
        this.forceMainMenuResize();
    }

    forceMainMenuResize() {
        // Only adjust on desktop
        if (window.innerWidth <= 768) return;
        
        const mainMenu = document.getElementById('startScreen');
        const gameContainer = document.getElementById('gameContainer');
        if (!mainMenu || !gameContainer) return;
        
        // Get the leaderboard container height
        const leaderboardContainer = mainMenu.querySelector('.leaderboard-container');
        const leaderboardHeight = leaderboardContainer ? leaderboardContainer.offsetHeight : 400;
        
        // Calculate total height based on fixed components + dynamic leaderboard
        const titleHeight = 200; // Approximate title height
        const tabsHeight = 60;   // Approximate tabs height
        const buttonsHeight = 120; // Approximate buttons height
        const padding = 120;     // Total padding (increased)
        
        const totalHeight = titleHeight + tabsHeight + leaderboardHeight + buttonsHeight + padding;
        
        // Set limits - allow much more height
        const minHeight = 700;  // Increased minimum
        const maxHeight = window.innerHeight * 0.95; // Allow more of screen height
        const finalHeight = Math.max(minHeight, Math.min(totalHeight, maxHeight));
        
        console.log(`Resizing main menu: leaderboard=${leaderboardHeight}px, total=${totalHeight}px, final=${finalHeight}px`);
        
        // Force the height
        mainMenu.style.height = `${finalHeight}px`;
        mainMenu.style.minHeight = `${finalHeight}px`;
        gameContainer.style.height = `${finalHeight}px`;
        
        // Ensure the border scales with the container
        gameContainer.style.border = '2px solid #00ff88';
        gameContainer.style.borderRadius = '15px';
    }

    adjustMainMenuHeight() {
        // Alias for the new function
        this.forceMainMenuResize();
    }
    showGameOver(score) {
        this.switchScreen('gameOver');
        
        // Set final score
        const finalScoreElement = document.getElementById('finalScore');
        if (finalScoreElement) {
            finalScoreElement.textContent = score.toLocaleString();
        }

        // Show name input container (in case it was hidden from previous save)
        const nameInputContainer = document.querySelector('.name-input-container');
        if (nameInputContainer) {
            nameInputContainer.style.display = 'block';
        }

        // Reset submit button
        const submitButton = document.getElementById('submitScore');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Save Score';
        }

        // Clear name input
        const playerNameInput = document.getElementById('playerName');
        if (playerNameInput) {
            playerNameInput.value = '';
            playerNameInput.focus();
        }

        // Hide share container
        const shareContainer = document.getElementById('shareContainer');
        if (shareContainer) {
            shareContainer.style.display = 'none';
        }
    }

    async submitScore() {
        const playerNameInput = document.getElementById('playerName');
        const submitButton = document.getElementById('submitScore');
        const shareContainer = document.getElementById('shareContainer');
        
        if (!playerNameInput || !submitButton) return;

        const playerName = playerNameInput.value.trim();
        
        // Validate player name
        if (!playerName) {
            alert('Please enter a name!');
            return;
        }

        if (playerName.length > 12) {
            alert('Name must be maximum 12 characters!');
            return;
        }

        // Validate name format (alphanumeric + space / _ / -)
        const nameRegex = /^[a-zA-Z0-9\s_-]+$/;
        if (!nameRegex.test(playerName)) {
            alert('Name can only contain letters, numbers, spaces, _ and -!');
            return;
        }

        // Disable submit button
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';

        try {
            console.log('Submitting score:', {
                playerName,
                score: this.game.score,
                sessionInfo: this.api.getSessionInfo()
            });
            
            const response = await this.api.submitScore(playerName, this.game.score);
            
            // Show share container
            if (shareContainer) {
                const shareUrl = this.api.generateShareUrl(response.share_slug);
                const shareUrlInput = document.getElementById('shareUrl');
                if (shareUrlInput) {
                    shareUrlInput.value = shareUrl;
                }
                shareContainer.style.display = 'block';
            }

            // Show success message
            alert(`Score saved! You are ranked #${response.weekly_rank || '?'} in the weekly top!`);
            
            // Hide the name input and submit button after successful save
            const nameInputContainer = document.querySelector('.name-input-container');
            if (nameInputContainer) {
                nameInputContainer.style.display = 'none';
            }
            
            // Reload leaderboards
            this.loadLeaderboards();
            
        } catch (error) {
            console.error('Failed to submit score:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                gameScore: this.game.score
            });
            
            let errorMessage = 'Error saving score. Please try again.';
            if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Cannot connect to server. Please check if the server is running.';
            } else if (error.message.includes('INVALID_SESSION') || error.message.includes('SESSION_EXPIRED')) {
                errorMessage = 'Session expired. Please restart the game.';
            } else if (error.message.includes('INVALID_NAME')) {
                errorMessage = 'Invalid name. Use only letters, numbers, spaces, _ and -.';
            } else if (error.message.includes('Geen actieve sessie')) {
                errorMessage = 'Session problem. Please try again.';
            }
            
            alert(errorMessage);
        } finally {
            // Always reset submit button
            submitButton.disabled = false;
            submitButton.textContent = 'Save Score';
        }
    }

    copyShareUrl() {
        const shareUrlInput = document.getElementById('shareUrl');
        if (!shareUrlInput) return;

        shareUrlInput.select();
        shareUrlInput.setSelectionRange(0, 99999); // For mobile devices

        try {
            document.execCommand('copy');
            alert('Link copied to clipboard!');
        } catch (err) {
            // Fallback for modern browsers
            navigator.clipboard.writeText(shareUrlInput.value).then(() => {
                alert('Link copied to clipboard!');
            }).catch(() => {
                alert('Could not copy link. Copy manually: ' + shareUrlInput.value);
            });
        }
    }

    playAgain() {
        this.switchScreen('game');
        if (this.game) {
            // Ensure UI is properly reset before starting
            this.resetGameUI();
            this.game.startGame();
        }
    }

    showHowToPlay() {
        this.switchScreen('howToPlay');
    }

    backToMenu() {
        this.switchScreen('start');
        this.loadLeaderboards();
    }

    // Utility function to generate share slug
    generateShareSlug() {
        return Math.random().toString(36).substring(2, 8);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.labPanicApp = new LabPanicApp();
});

// Handle share URLs
if (window.location.pathname.startsWith('/share/')) {
    const shareSlug = window.location.pathname.split('/share/')[1];
    if (shareSlug) {
        // Redirect to main page with share parameter
        window.location.href = `/?share=${shareSlug}`;
    }
}

// Handle share parameter in URL
const urlParams = new URLSearchParams(window.location.search);
const shareParam = urlParams.get('share');
if (shareParam) {
    // Show share info when page loads
    document.addEventListener('DOMContentLoaded', () => {
        const shareUrl = `${window.location.origin}/share/${shareParam}`;
        alert(`Share this link: ${shareUrl}`);
    });
}
