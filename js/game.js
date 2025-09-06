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
        this.brokenBottles = []; // Gebroken flesjes op de grond
        
        // Power-up system
        this.activePowerup = null;
        this.powerupTimer = 0;
        
        // Spawn system
        this.spawnTimer = 0;
        this.spawnRate = 1200; // ms tussen spawns (sneller starten)
        this.maxBottles = 4; // Meer bottles direct
        
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
        // Set canvas dimensions based on screen size
        if (window.innerWidth > 768) {
            // Desktop: fixed dimensions
            this.canvas.width = 800;
            this.canvas.height = 600;
        } else {
            // Mobile: full screen
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }
        
        // Handle resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                // Desktop: fixed dimensions
                this.canvas.width = 800;
                this.canvas.height = 600;
            } else {
                // Mobile: full screen
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;
            }
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
        this.brokenBottles = []; // Reset gebroken flesjes
        this.activePowerup = null;
        this.powerupTimer = 0;
        this.spawnTimer = 0;
        this.spawnRate = 1200; // Sneller starten
        this.maxBottles = 4; // Meer bottles direct
        
        // Reset timing to prevent high speed start
        this.lastTime = Date.now();
        
        // Reset UI immediately
        this.updateUI();
        this.updatePowerupUI();
        
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
        
        // Cap deltaTime to prevent huge jumps when resuming
        const cappedDeltaTime = Math.min(deltaTime, 100); // Max 100ms per frame
        
        this.update(cappedDeltaTime);
        this.render();
        
        // Use setTimeout instead of requestAnimationFrame to prevent freezing when window loses focus
        setTimeout(() => this.gameLoop(), 16); // ~60 FPS
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
        this.updateBrokenBottles(deltaTime);
        
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
        const difficultyLevel = Math.floor(this.gameTime / 15000); // Elke 15 seconden (sneller)
        this.difficulty = 1.5 + difficultyLevel * 0.8; // Hogere base difficulty
        
        // Update spawn rate (sneller escaleren)
        this.spawnRate = Math.max(300, 1200 - difficultyLevel * 200);
        
        // Update max bottles (sneller meer bottles)
        this.maxBottles = Math.min(8, 4 + Math.floor(difficultyLevel / 1.5));
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
        
        // Determine bottle type (uitdagender percentages)
        const rand = Math.random();
        let type, color;
        
        if (rand < 0.03) { // 3% power-up (zeldzamer)
            type = 'powerup';
            color = this.assets.bottleColors.powerup[Math.floor(Math.random() * 3)];
        } else if (rand < 0.4) { // 37% dangerous (meer gevaarlijk)
            type = 'dangerous';
            color = this.assets.bottleColors.dangerous[Math.floor(Math.random() * 3)];
        } else { // 60% good (minder makkelijk)
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

    createBrokenBottle(x, y) {
        // Adjust Y position based on screen size
        let groundY = y;
        if (window.innerWidth <= 768) {
            // Mobile: use viewport height instead of canvas height
            groundY = window.innerHeight - 30;
        }
        
        const brokenBottle = new BrokenBottle(x, groundY);
        this.brokenBottles.push(brokenBottle);
    }

    updateBrokenBottles(deltaTime) {
        this.brokenBottles.forEach(brokenBottle => {
            brokenBottle.update(deltaTime);
        });
    }

    cleanupObjects() {
        // Remove bottles that hit the ground
        this.bottles = this.bottles.filter(bottle => {
            // Calculate ground level based on screen size
            let groundLevel = this.canvas.height + 50;
            if (window.innerWidth <= 768) {
                groundLevel = window.innerHeight + 50;
            }
            
            if (bottle.y > groundLevel) {
                if (bottle.type === 'dangerous') {
                    this.loseLife();
                    // Create broken bottle on the ground
                    this.createBrokenBottle(bottle.x, 0); // Y will be calculated in createBrokenBottle
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
        this.brokenBottles.forEach(brokenBottle => brokenBottle.draw(this.ctx));
        
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
        this.lastTime = Date.now(); // Reset time to prevent large deltaTime jumps
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
        this.speed = 150 + difficulty * 80; // pixels per second (sneller starten)
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
        
        // Draw Erlenmeyer flask (conical shape)
        ctx.fillStyle = this.color;
        
        // Main conical body of the flask (more curved like real Erlenmeyer)
        ctx.beginPath();
        ctx.moveTo(-20, 20); // Bottom left (wide)
        ctx.quadraticCurveTo(-25, 0, -15, -10); // Left curve
        ctx.lineTo(-10, -15); // Top left (narrow)
        ctx.lineTo(10, -15); // Top right (narrow)
        ctx.quadraticCurveTo(25, 0, 20, 20); // Right curve
        ctx.closePath();
        ctx.fill();
        
        // Add rounded bottom corners
        ctx.beginPath();
        ctx.arc(-20, 20, 3, 0, Math.PI / 2); // Bottom left corner
        ctx.arc(20, 20, 3, Math.PI / 2, Math.PI); // Bottom right corner
        ctx.fill();
        
        // Draw glass outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw neck of the flask (straight tube section)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(-8, -15);
        ctx.lineTo(-8, -25); // Extended straight section
        ctx.lineTo(8, -25);
        ctx.lineTo(8, -15);
        ctx.closePath();
        ctx.fill();
        
        // Draw top opening of the tube
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(-6, -25);
        ctx.lineTo(-6, -30);
        ctx.lineTo(6, -30);
        ctx.lineTo(6, -25);
        ctx.closePath();
        ctx.fill();
        
        // Draw stopper/cap
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(-6, -30);
        ctx.lineTo(-8, -35);
        ctx.lineTo(8, -35);
        ctx.lineTo(6, -30);
        ctx.closePath();
        ctx.fill();
        
        // Draw liquid inside the flask (70% fill level)
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(-18, 8); // Liquid level at 70% (wide at bottom)
        ctx.quadraticCurveTo(-22, -2, -12, -8); // Left curve for liquid
        ctx.lineTo(-8, -10); // Top left (narrow)
        ctx.lineTo(8, -10); // Top right (narrow)
        ctx.quadraticCurveTo(22, -2, 18, 8); // Right curve for liquid
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Draw type indicator
        if (this.type === 'dangerous') {
            ctx.fillStyle = '#000000';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('☠', 0, 5);
        } else if (this.type === 'powerup') {
            ctx.fillStyle = '#000000';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⭐', 0, 5);
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

// BrokenBottle class voor gebroken flesjes op de grond
class BrokenBottle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.rotation = Math.random() * Math.PI * 2;
        this.scale = 0.8 + Math.random() * 0.4; // Variatie in grootte
        this.alpha = 0.8; // Iets transparant
        this.time = 0;
    }

    update(deltaTime) {
        this.time += deltaTime;
        // Langzaam vervagen over tijd
        this.alpha = Math.max(0.3, 0.8 - (this.time / 30000)); // 30 seconden
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);
        ctx.globalAlpha = this.alpha;
        
        // Draw broken Erlenmeyer flask pieces
        ctx.fillStyle = '#ff6b6b';
        
        // Main broken conical piece (curved like real Erlenmeyer)
        ctx.beginPath();
        ctx.moveTo(-12, 12); // Bottom left (wide)
        ctx.quadraticCurveTo(-15, 2, -10, -5); // Left curve
        ctx.lineTo(-6, -8); // Top left (narrow)
        ctx.lineTo(6, -8); // Top right (narrow)
        ctx.quadraticCurveTo(15, 2, 12, 12); // Right curve
        ctx.closePath();
        ctx.fill();
        
        // Add rounded bottom corners for broken pieces
        ctx.beginPath();
        ctx.arc(-12, 12, 2, 0, Math.PI / 2); // Bottom left corner
        ctx.arc(12, 12, 2, Math.PI / 2, Math.PI); // Bottom right corner
        ctx.fill();
        
        // Broken pieces scattered around (conical shapes)
        ctx.fillStyle = '#ff4444';
        
        // Piece 1
        ctx.beginPath();
        ctx.moveTo(-6, -12);
        ctx.lineTo(-8, -16);
        ctx.lineTo(-2, -16);
        ctx.closePath();
        ctx.fill();
        
        // Piece 2
        ctx.beginPath();
        ctx.moveTo(4, -10);
        ctx.lineTo(2, -14);
        ctx.lineTo(8, -14);
        ctx.closePath();
        ctx.fill();
        
        // Piece 3
        ctx.beginPath();
        ctx.moveTo(-4, 8);
        ctx.lineTo(-8, 4);
        ctx.lineTo(2, 4);
        ctx.closePath();
        ctx.fill();
        
        // Piece 4
        ctx.beginPath();
        ctx.moveTo(6, 10);
        ctx.lineTo(2, 6);
        ctx.lineTo(10, 6);
        ctx.closePath();
        ctx.fill();
        
        // Glass shards (white highlights)
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = this.alpha * 0.6;
        
        // Shard 1
        ctx.beginPath();
        ctx.moveTo(-6, -6);
        ctx.lineTo(-4, -8);
        ctx.lineTo(-2, -6);
        ctx.closePath();
        ctx.fill();
        
        // Shard 2
        ctx.beginPath();
        ctx.moveTo(4, -4);
        ctx.lineTo(6, -6);
        ctx.lineTo(8, -4);
        ctx.closePath();
        ctx.fill();
        
        // Shard 3
        ctx.beginPath();
        ctx.moveTo(-2, 6);
        ctx.lineTo(-4, 4);
        ctx.lineTo(0, 4);
        ctx.closePath();
        ctx.fill();
        
        // Shard 4
        ctx.beginPath();
        ctx.moveTo(8, 8);
        ctx.lineTo(6, 6);
        ctx.lineTo(10, 6);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
}

// Export voor gebruik in andere modules
window.LabPanicGame = LabPanicGame;
