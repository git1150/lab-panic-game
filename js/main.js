// Hoofdapplicatie voor Lab Panic
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

        const backToMenuButton = document.getElementById('backToMenu');
        if (backToMenuButton) {
            backToMenuButton.addEventListener('click', () => this.backToMenu());
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
            this.game.startGame();
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
    }

    async loadLeaderboards() {
        await Promise.all([
            this.loadLeaderboard('weekly'),
            this.loadLeaderboard('alltime')
        ]);
    }

    async loadLeaderboard(scope) {
        const listElement = document.getElementById(`${scope}List`);
        if (!listElement) return;

        try {
            listElement.innerHTML = '<div class="loading">Laden...</div>';
            
            const data = await this.api.getLeaderboard(scope, 25);
            this.renderLeaderboard(listElement, data.entries || []);
        } catch (error) {
            console.error(`Failed to load ${scope} leaderboard:`, error);
            listElement.innerHTML = '<div class="loading">Fout bij laden</div>';
        }
    }

    renderLeaderboard(container, entries) {
        if (entries.length === 0) {
            container.innerHTML = '<div class="loading">Geen scores beschikbaar</div>';
            return;
        }

        container.innerHTML = entries.map((entry, index) => `
            <div class="leaderboard-entry">
                <span class="rank">#${entry.rank}</span>
                <span class="player-name">${this.escapeHtml(entry.player_name)}</span>
                <span class="score">${entry.score.toLocaleString()}</span>
            </div>
        `).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showGameOver(score) {
        this.switchScreen('gameOver');
        
        // Set final score
        const finalScoreElement = document.getElementById('finalScore');
        if (finalScoreElement) {
            finalScoreElement.textContent = score.toLocaleString();
        }

        // Focus on name input
        const playerNameInput = document.getElementById('playerName');
        if (playerNameInput) {
            playerNameInput.focus();
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
            alert('Voer een naam in!');
            return;
        }

        if (playerName.length > 12) {
            alert('Naam mag maximaal 12 tekens zijn!');
            return;
        }

        // Validate name format (alphanumeric + space / _ / -)
        const nameRegex = /^[a-zA-Z0-9\s_-]+$/;
        if (!nameRegex.test(playerName)) {
            alert('Naam mag alleen letters, cijfers, spaties, _ en - bevatten!');
            return;
        }

        // Disable submit button
        submitButton.disabled = true;
        submitButton.textContent = 'Bezig...';

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
            alert(`Score opgeslagen! Je staat op plaats ${response.weekly_rank || '?'} in de weekelijkse top!`);
            
            // Reload leaderboards
            this.loadLeaderboards();
            
        } catch (error) {
            console.error('Failed to submit score:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                gameScore: this.game.score
            });
            
            let errorMessage = 'Fout bij opslaan van score. Probeer het opnieuw.';
            if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Kan geen verbinding maken met de server. Controleer of de server draait.';
            } else if (error.message.includes('INVALID_SESSION') || error.message.includes('SESSION_EXPIRED')) {
                errorMessage = 'Sessie verlopen. Start het spel opnieuw.';
            } else if (error.message.includes('INVALID_NAME')) {
                errorMessage = 'Ongeldige naam. Gebruik alleen letters, cijfers, spaties, _ en -.';
            } else if (error.message.includes('Geen actieve sessie')) {
                errorMessage = 'Probleem met sessie. Probeer het opnieuw.';
            }
            
            alert(errorMessage);
            
            // Re-enable submit button
            submitButton.disabled = false;
            submitButton.textContent = 'Score Opslaan';
        }
    }

    copyShareUrl() {
        const shareUrlInput = document.getElementById('shareUrl');
        if (!shareUrlInput) return;

        shareUrlInput.select();
        shareUrlInput.setSelectionRange(0, 99999); // For mobile devices

        try {
            document.execCommand('copy');
            alert('Link gekopieerd naar klembord!');
        } catch (err) {
            // Fallback for modern browsers
            navigator.clipboard.writeText(shareUrlInput.value).then(() => {
                alert('Link gekopieerd naar klembord!');
            }).catch(() => {
                alert('Kon link niet kopiëren. Kopieer handmatig: ' + shareUrlInput.value);
            });
        }
    }

    playAgain() {
        this.switchScreen('game');
        if (this.game) {
            this.game.startGame();
        }
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
        alert(`Deel deze link: ${shareUrl}`);
    });
}
