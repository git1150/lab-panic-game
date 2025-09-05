// Lab Panic Game Engine
class LabPanicGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.api = new LabPanicAPI();
        
        // Game state
        this.gameState = 'menu'; // menu, playing, paused, gameOver
        this.score = 0;
        this.lives = 3;
        this.gameTime = 0;
        this.difficulty = 1;
        
        // Game objects
        this.bottles = [];
        this.particles = [];
        this.powerups = [];
        
        // Power-up system
        this.activePowerup = null;
        this.powerupTimer = 0;
        
        // Spawn system
        this.spawnTimer = 0;
        this.spawnRate = 2000; // ms tussen spawns
        this.maxBottles = 3;
        
        // Input handling
        this.mouseX = 0;
        this.mouseY = 0;
        this.isPointerDown = false;
        
        // Audio
        this.audio = {
            bgMusic: document.getElementById('bgMusic'),
            popSound: document.getElementById('popSound'),
            fizzSound: document.getElementById('fizzSound'),
            buzzerSound: document.getElementById('buzzerSound'),
            powerupSound: document.getElementById('powerupSound')
        };
        
        this.setupCanvas();
        this.setupEventListeners();
        this.loadAssets();
    }

    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handlePointerDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handlePointerMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handlePointerUp(e));
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handlePointerDown(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handlePointerMove(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handlePointerUp(e);
        });
    }

    handlePointerDown(e) {
        this.isPointerDown = true;
        this.handlePointerMove(e);
    }

    handlePointerMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
    }

    handlePointerUp(e) {
        this.isPointerDown = false;
    }

    loadAssets() {
        // Voor nu gebruiken we eenvoudige shapes, later kunnen we sprites toevoegen
        this.assets = {
            bottleColors: {
                good: ['#00ff88', '#00cc6a', '#88ff88'],
                dangerous: ['#ff6b6b', '#ff4444', '#cc0000'],
                powerup: ['#ffd700', '#ffed4e', '#ffb347']
            }
        };
    }

    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.lives = 3;
        this.gameTime = 0;
        this.difficulty = 1;
        this.bottles = [];
        this.particles = [];
        this.powerups = [];
        this.activePowerup = null;
        this.powerupTimer = 0;
        this.spawnTimer = 0;
        this.spawnRate = 2000;
        this.maxBottles = 3;
        
        // Start session
        this.api.startSession().then(response => {
            console.log('Game session started:', response);
        }).catch(error => {
            console.warn('Could not start session:', error);
        });
        
        // Start background music
        this.playAudio(this.audio.bgMusic);
        
        this.gameLoop();
    }

    gameLoop() {
        if (this.gameState !== 'playing') return;
        
        const now = Date.now();
        const deltaTime = now - (this.lastTime || now);
        this.lastTime = now;
        
        this.update(deltaTime);
        this.render();
        
        requestAnimationFrame(() => this.gameLoop());
    }

    update(deltaTime) {
        this.gameTime += deltaTime;
        
        // Update difficulty
        this.updateDifficulty();
        
        // Spawn bottles
        this.updateSpawnSystem(deltaTime);
        
        // Update game objects
        this.updateBottles(deltaTime);
        this.updateParticles(deltaTime);
        this.updatePowerups(deltaTime);
        
        // Update power-up timer
        if (this.activePowerup) {
            this.powerupTimer -= deltaTime;
            if (this.powerupTimer <= 0) {
                this.deactivatePowerup();
            }
        }
        
        // Check for collisions
        this.checkCollisions();
        
        // Remove off-screen objects
        this.cleanupObjects();
    }

    updateDifficulty() {
        const difficultyLevel = Math.floor(this.gameTime / 30000); // Elke 30 seconden
        this.difficulty = 1 + difficultyLevel * 0.5;
        
        // Update spawn rate
        this.spawnRate = Math.max(500, 2000 - difficultyLevel * 300);
        
        // Update max bottles
        this.maxBottles = Math.min(6, 3 + Math.floor(difficultyLevel / 2));
    }

    updateSpawnSystem(deltaTime) {
        this.spawnTimer += deltaTime;
        
        if (this.spawnTimer >= this.spawnRate && this.bottles.length < this.maxBottles) {
            this.spawnBottle();
            this.spawnTimer = 0;
        }
    }

    spawnBottle() {
        const x = Math.random() * (this.canvas.width - 60) + 30;
        const y = -50;
        
        // Determine bottle type
        const rand = Math.random();
        let type, color;
        
        if (rand < 0.05) { // 5% power-up
            type = 'powerup';
            color = this.assets.bottleColors.powerup[Math.floor(Math.random() * 3)];
        } else if (rand < 0.3) { // 25% dangerous
            type = 'dangerous';
            color = this.assets.bottleColors.dangerous[Math.floor(Math.random() * 3)];
        } else { // 70% good
            type = 'good';
            color = this.assets.bottleColors.good[Math.floor(Math.random() * 3)];
        }
        
        const bottle = new Bottle(x, y, type, color, this.difficulty);
        this.bottles.push(bottle);
    }

    updateBottles(deltaTime) {
        this.bottles.forEach(bottle => {
            bottle.update(deltaTime);
        });
    }

    updateParticles(deltaTime) {
        this.particles.forEach(particle => {
            particle.update(deltaTime);
        });
    }

    updatePowerups(deltaTime) {
        this.powerups.forEach(powerup => {
            powerup.update(deltaTime);
        });
    }

    checkCollisions() {
        if (!this.isPointerDown) return;
        
        this.bottles.forEach((bottle, index) => {
            const distance = Math.sqrt(
                Math.pow(this.mouseX - bottle.x, 2) + 
                Math.pow(this.mouseY - bottle.y, 2)
            );
            
            if (distance < bottle.radius) {
                this.handleBottleClick(bottle, index);
            }
        });
    }

    handleBottleClick(bottle, index) {
        // Create explosion particles
        this.createExplosion(bottle.x, bottle.y, bottle.color);
        
        // Handle different bottle types
        switch (bottle.type) {
            case 'good':
                this.score += 10;
                this.playAudio(this.audio.popSound);
                break;
                
            case 'dangerous':
                this.score += 5;
                this.playAudio(this.audio.fizzSound);
                break;
                
            case 'powerup':
                this.activatePowerup();
                this.playAudio(this.audio.powerupSound);
                break;
        }
        
        // Remove bottle
        this.bottles.splice(index, 1);
        
        // Update UI
        this.updateUI();
    }

    activatePowerup() {
        const powerupTypes = ['slowMotion', 'explosion', 'multiplier'];
        const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
        
        this.activePowerup = type;
        
        switch (type) {
            case 'slowMotion':
                this.powerupTimer = 5000; // 5 seconds
                break;
            case 'explosion':
                this.powerupTimer = 1000; // 1 second
                this.explodeAllBottles();
                break;
            case 'multiplier':
                this.powerupTimer = 10000; // 10 seconds
                break;
        }
        
        this.updatePowerupUI();
    }

    deactivatePowerup() {
        this.activePowerup = null;
        this.powerupTimer = 0;
        this.updatePowerupUI();
    }

    explodeAllBottles() {
        this.bottles.forEach(bottle => {
            this.createExplosion(bottle.x, bottle.y, bottle.color);
            if (bottle.type === 'good') {
                this.score += 10;
            } else if (bottle.type === 'dangerous') {
                this.score += 5;
            }
        });
        this.bottles = [];
    }

    createExplosion(x, y, color) {
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const speed = 2 + Math.random() * 3;
            const particle = new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                color
            );
            this.particles.push(particle);
        }
    }

    cleanupObjects() {
        // Remove bottles that hit the ground
        this.bottles = this.bottles.filter(bottle => {
            if (bottle.y > this.canvas.height + 50) {
                if (bottle.type === 'dangerous') {
                    this.loseLife();
                }
                return false;
            }
            return true;
        });
        
        // Remove dead particles
        this.particles = this.particles.filter(particle => particle.life > 0);
    }

    loseLife() {
        this.lives--;
        this.playAudio(this.audio.buzzerSound);
        
        if (this.lives <= 0) {
            this.gameOver();
        }
        
        this.updateUI();
    }

    gameOver() {
        this.gameState = 'gameOver';
        this.audio.bgMusic.pause();
        this.audio.bgMusic.currentTime = 0;
        
        // Trigger game over event
        const event = new CustomEvent('gameOver', { detail: { score: this.score } });
        window.dispatchEvent(event);
    }

    updateUI() {
        // Update score display
        const scoreText = document.getElementById('scoreText');
        if (scoreText) {
            let displayScore = this.score;
            if (this.activePowerup === 'multiplier') {
                displayScore *= 2;
            }
            scoreText.textContent = `Score: ${displayScore}`;
        }
        
        // Update lives display
        const hearts = ['heart1', 'heart2', 'heart3'];
        hearts.forEach((heartId, index) => {
            const heart = document.getElementById(heartId);
            if (heart) {
                if (index < this.lives) {
                    heart.classList.remove('lost');
                } else {
                    heart.classList.add('lost');
                }
            }
        });
    }

    updatePowerupUI() {
        const indicator = document.getElementById('powerupIndicator');
        const icon = document.getElementById('powerupIcon');
        const timer = document.getElementById('powerupTimer');
        
        if (this.activePowerup) {
            indicator.classList.add('active');
            
            // Set icon based on powerup type
            const icons = {
                slowMotion: '⏰',
                explosion: '💥',
                multiplier: '⭐'
            };
            icon.textContent = icons[this.activePowerup] || '⭐';
            
            // Update timer
            const seconds = Math.ceil(this.powerupTimer / 1000);
            timer.textContent = `${seconds}s`;
        } else {
            indicator.classList.remove('active');
        }
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#0f0f23';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background effects
        this.drawBackground();
        
        // Apply slow motion effect
        if (this.activePowerup === 'slowMotion') {
            this.ctx.filter = 'blur(1px)';
        }
        
        // Draw game objects
        this.bottles.forEach(bottle => bottle.draw(this.ctx));
        this.particles.forEach(particle => particle.draw(this.ctx));
        this.powerups.forEach(powerup => powerup.draw(this.ctx));
        
        // Reset filter
        this.ctx.filter = 'none';
    }

    drawBackground() {
        // Draw laboratory background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw some neon lines
        this.ctx.strokeStyle = '#00ff88';
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.3;
        
        for (let i = 0; i < 5; i++) {
            const x = (i / 4) * this.canvas.width;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        this.ctx.globalAlpha = 1;
    }

    playAudio(audioElement) {
        if (audioElement) {
            audioElement.currentTime = 0;
            audioElement.play().catch(e => console.log('Audio play failed:', e));
        }
    }

    pause() {
        this.gameState = 'paused';
        this.audio.bgMusic.pause();
    }

    resume() {
        this.gameState = 'playing';
        this.audio.bgMusic.play().catch(e => console.log('Audio resume failed:', e));
        this.gameLoop();
    }
}

// Bottle class
class Bottle {
    constructor(x, y, type, color, difficulty) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.color = color;
        this.radius = 25;
        this.speed = 100 + difficulty * 50; // pixels per second
        this.rotation = 0;
        this.rotationSpeed = (Math.random() - 0.5) * 2;
    }

    update(deltaTime) {
        this.y += (this.speed * deltaTime) / 1000;
        this.rotation += this.rotationSpeed * deltaTime / 1000;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Draw bottle body
        ctx.fillStyle = this.color;
        ctx.fillRect(-15, -25, 30, 50);
        
        // Draw bottle neck
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-8, -35, 16, 10);
        
        // Draw bottle cap
        ctx.fillStyle = '#888888';
        ctx.fillRect(-10, -40, 20, 5);
        
        // Draw liquid
        ctx.fillStyle = this.color;
        ctx.fillRect(-12, -20, 24, 30);
        
        // Draw type indicator
        if (this.type === 'dangerous') {
            ctx.fillStyle = '#000000';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('☠', 0, 0);
        } else if (this.type === 'powerup') {
            ctx.fillStyle = '#000000';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⭐', 0, 0);
        }
        
        ctx.restore();
    }
}

// Particle class for explosions
class Particle {
    constructor(x, y, vx, vy, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = 1.0;
        this.decay = 0.02;
        this.size = 3 + Math.random() * 3;
    }

    update(deltaTime) {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // gravity
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Export voor gebruik in andere modules
window.LabPanicGame = LabPanicGame;
