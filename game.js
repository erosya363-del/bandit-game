const CONFIG = {
    gravity: 0.45,
    jumpForce: -13,
    superJumpForce: -20,
    moveSpeed: 6,
    friction: 0.88,
    maxFallSpeed: 15,
    mattressGap: 120,
    mattressMinWidth: 80,
    mattressMaxWidth: 160,
    collectibleSpawnRate: 0.35,
    cameraSmooth: 0.08,
    difficultyIncrease: 0.0003,
    colors: {
        player: { skin: '#fdbcb4', hair: '#4a3728', shirt: '#6c5ce7', pants: '#2d3436' },
        mattress: ['#6c5ce7', '#a29bfe', '#fd79a8', '#00cec9', '#fdcb6e', '#e17055'],
        collectibles: { star: '#fdcb6e', pillow: '#fd79a8', toy: '#00cec9' }
    }
};

let playerAvatarImage = null;

class Mattress {
    constructor(x, y, width, colorIndex = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = 20;
        this.color = CONFIG.colors.mattress[colorIndex % CONFIG.colors.mattress.length];
        this.squash = 0;
        this.broken = false;
        this.type = 'normal';
        this.moveDir = 1;
        this.moveSpeed = randomRange(1, 3);
        this.moveRange = randomRange(60, 150);
        this.startX = x;

        const r = Math.random();
        if (r < 0.15) this.type = 'moving';
        else if (r < 0.25) this.type = 'bouncy';
        else if (r < 0.35) this.type = 'breakable';
    }

    update() {
        if (this.type === 'moving') {
            this.x += this.moveSpeed * this.moveDir;
            if (this.x > this.startX + this.moveRange || this.x < this.startX - this.moveRange) {
                this.moveDir *= -1;
            }
        }
        this.squash *= 0.85;
    }

    draw(ctx, cameraY) {
        const screenY = this.y - cameraY;
        const squashOffset = this.squash * 4;

        ctx.save();

        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width/2, screenY + this.height + 5, this.width/2 + 4, 6, 0, 0, Math.PI*2);
        ctx.fill();

        const gradient = ctx.createLinearGradient(this.x, screenY, this.x, screenY + this.height);
        gradient.addColorStop(0, lightenColor(this.color, 30));
        gradient.addColorStop(1, this.color);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(this.x, screenY - squashOffset, this.width, this.height + squashOffset*2, [8, 8, 4, 4]);
        ctx.fill();

        ctx.strokeStyle = lightenColor(this.color, 50);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(this.x + 8, screenY + this.height/2 - squashOffset/2);
        ctx.lineTo(this.x + this.width - 8, screenY + this.height/2 - squashOffset/2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (this.type === 'bouncy') {
            ctx.strokeStyle = '#fdcb6e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                ctx.moveTo(this.x + this.width/2 - 6, screenY - 5 - i*5);
                ctx.lineTo(this.x + this.width/2 + 6, screenY - 5 - i*5 - 2);
                ctx.lineTo(this.x + this.width/2 - 6, screenY - 5 - i*5 - 4);
            }
            ctx.stroke();
        } else if (this.type === 'breakable') {
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(this.x + this.width/2 - 10, screenY + this.height/2);
            ctx.lineTo(this.x + this.width/2 - 3, screenY + this.height/2 - 5);
            ctx.lineTo(this.x + this.width/2 + 2, screenY + this.height/2 + 3);
            ctx.lineTo(this.x + this.width/2 + 8, screenY + this.height/2 - 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    onLand() {
        this.squash = 1;
        if (this.type === 'breakable') { this.broken = true; return 'breakable'; }
        if (this.type === 'bouncy') return 'bouncy';
        return 'normal';
    }
}

class Collectible {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 30;
        this.height = 30;
        this.collected = false;
        this.bobOffset = Math.random() * Math.PI * 2;
        this.glow = 0;
    }

    update(time) {
        this.bobY = Math.sin(time * 3 + this.bobOffset) * 5;
        this.glow = (Math.sin(time * 4) + 1) / 2;
    }

    draw(ctx, cameraY, time) {
        if (this.collected) return;
        const screenY = this.y - cameraY + (this.bobY || 0);
        const screenX = this.x + this.width/2;
        const drawY = screenY + this.height/2;

        ctx.save();
        ctx.translate(screenX, drawY);
        ctx.shadowColor = CONFIG.colors.collectibles[this.type];
        ctx.shadowBlur = 15 + this.glow * 10;

        if (this.type === 'star') this.drawStar(ctx);
        else if (this.type === 'pillow') this.drawPillow(ctx);
        else if (this.type === 'toy') this.drawToy(ctx);

        ctx.restore();
    }

    drawStar(ctx) {
        ctx.fillStyle = CONFIG.colors.collectibles.star;
        ctx.beginPath();
        let rot = -Math.PI/2;
        const step = Math.PI/5;
        ctx.moveTo(Math.cos(rot)*14, Math.sin(rot)*14);
        for (let i = 0; i < 5; i++) {
            ctx.lineTo(Math.cos(rot)*14, Math.sin(rot)*14);
            rot += step;
            ctx.lineTo(Math.cos(rot)*7, Math.sin(rot)*7);
            rot += step;
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(-3, -5, 2, 0, Math.PI*2);
        ctx.fill();
    }

    drawPillow(ctx) {
        ctx.fillStyle = CONFIG.colors.collectibles.pillow;
        ctx.beginPath();
        ctx.roundRect(-14, -12, 28, 24, 8);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -12); ctx.lineTo(0, 12);
        ctx.moveTo(-14, 0); ctx.lineTo(14, 0);
        ctx.stroke();

        ctx.fillStyle = lightenColor(CONFIG.colors.collectibles.pillow, 30);
        ctx.beginPath();
        ctx.arc(-14, -12, 4, 0, Math.PI*2);
        ctx.arc(14, -12, 4, 0, Math.PI*2);
        ctx.arc(-14, 12, 4, 0, Math.PI*2);
        ctx.arc(14, 12, 4, 0, Math.PI*2);
        ctx.fill();
    }

    drawToy(ctx) {
        ctx.fillStyle = CONFIG.colors.collectibles.toy;
        ctx.beginPath(); ctx.arc(0, 2, 12, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(-8, -10, 5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(8, -10, 5, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = lightenColor(CONFIG.colors.collectibles.toy, 40);
        ctx.beginPath(); ctx.arc(-8, -10, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(8, -10, 3, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = lightenColor(CONFIG.colors.collectibles.toy, 25);
        ctx.beginPath(); ctx.ellipse(0, 4, 6, 5, 0, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = '#2d3436';
        ctx.beginPath(); ctx.arc(-4, -1, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(4, -1, 2, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-3.5, -1.5, 0.8, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(4.5, -1.5, 0.8, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = '#2d3436';
        ctx.beginPath(); ctx.ellipse(0, 3, 2, 1.5, 0, 0, Math.PI*2); ctx.fill();
    }

    getHitbox() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 50;
        this.vel = new Vector(0, 0);
        this.onGround = false;
        this.facing = 1;
        this.animFrame = 0;
        this.animTimer = 0;
        this.trail = [];
        this.invulnerable = 0;
    }

    update(input, canvasWidth) {
        if (input.left) { this.vel.x -= CONFIG.moveSpeed * 0.3; this.facing = -1; }
        if (input.right) { this.vel.x += CONFIG.moveSpeed * 0.3; this.facing = 1; }

        this.vel.x *= CONFIG.friction;
        this.vel.y += CONFIG.gravity;
        this.vel.y = Math.min(this.vel.y, CONFIG.maxFallSpeed);

        this.x += this.vel.x;
        this.y += this.vel.y;

        if (this.x > canvasWidth + this.width) this.x = -this.width;
        if (this.x < -this.width) this.x = canvasWidth + this.width;

        this.animTimer++;
        if (this.animTimer > 6) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % 4;
        }

        this.trail.push({ x: this.x + this.width/2, y: this.y + this.height/2, life: 1 });
        if (this.trail.length > 12) this.trail.shift();
        this.trail.forEach(t => t.life -= 0.08);

        if (this.invulnerable > 0) this.invulnerable--;
    }

    jump(superJump = false) {
        this.vel.y = superJump ? CONFIG.superJumpForce : CONFIG.jumpForce;
        this.onGround = false;
    }

    draw(ctx, cameraY, time) {
        const screenX = this.x;
        const screenY = this.y - cameraY;
        const cx = screenX + this.width/2;
        const colors = CONFIG.colors.player;

        ctx.save();

        if (this.invulnerable > 0 && Math.floor(this.invulnerable / 3) % 2 === 0) {
            ctx.globalAlpha = 0.4;
        }

        this.trail.forEach((t, i) => {
            if (t.life > 0) {
                ctx.fillStyle = `rgba(108, 92, 231, ${t.life * 0.2})`;
                ctx.beginPath();
                ctx.arc(t.x, t.y - cameraY, 3 + i * 0.3, 0, Math.PI*2);
                ctx.fill();
            }
        });

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(cx, screenY + this.height + 3, 14, 4, 0, 0, Math.PI*2);
        ctx.fill();

        const legOffset = this.onGround ? Math.sin(this.animFrame * Math.PI/2) * 5 : 0;

        ctx.fillStyle = colors.pants;
        ctx.fillRect(cx - 10, screenY + 35 + legOffset, 8, 15 - legOffset);
        ctx.fillRect(cx + 2, screenY + 35 - legOffset, 8, 15 + legOffset);

        ctx.fillStyle = '#2d3436';
        ctx.fillRect(cx - 12, screenY + 46 + legOffset, 12, 5);
        ctx.fillRect(cx, screenY + 46 - legOffset, 12, 5);

        ctx.fillStyle = colors.shirt;
        ctx.beginPath();
        ctx.roundRect(cx - 12, screenY + 18, 24, 22, 4);
        ctx.fill();
        ctx.fillStyle = lightenColor(colors.shirt, 20);
        ctx.fillRect(cx - 3, screenY + 20, 6, 18);

        ctx.fillStyle = colors.skin;
        const armSwing = this.onGround ? Math.sin(this.animFrame * Math.PI/2) * 8 : -5;

        ctx.save();
        ctx.translate(cx - 14, screenY + 22);
        ctx.rotate(armSwing * Math.PI/180);
        ctx.fillRect(-3, 0, 6, 16);
        ctx.restore();

        ctx.save();
        ctx.translate(cx + 14, screenY + 22);
        ctx.rotate(-armSwing * Math.PI/180);
        ctx.fillRect(-3, 0, 6, 16);
        ctx.restore();

        const headX = cx;
        const headY = screenY + 12;
        const headRadius = 12;

        ctx.fillStyle = colors.hair;
        ctx.beginPath();
        ctx.ellipse(headX, headY - 6, 13, 8, 0, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.ellipse(headX, headY - 7, 14, 6, 0, Math.PI, Math.PI*2);
        ctx.fill();
        ctx.fillRect(headX + (this.facing === 1 ? 4 : -14), headY - 4, 10, 3);

        if (playerAvatarImage && playerAvatarImage.complete && playerAvatarImage.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(headX, headY, headRadius, 0, Math.PI*2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(playerAvatarImage, headX - headRadius, headY - headRadius, headRadius * 2, headRadius * 2);
            ctx.restore();

            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(headX, headY, headRadius, 0, Math.PI*2);
            ctx.stroke();
        } else {
            ctx.fillStyle = colors.skin;
            ctx.beginPath();
            ctx.arc(headX, headY, headRadius, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(headX - 4 * this.facing, headY - 1, 3, 0, Math.PI*2);
            ctx.arc(headX + 4 * this.facing, headY - 1, 3, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = '#2d3436';
            const eyeOffset = this.facing * 1.2;
            ctx.beginPath();
            ctx.arc(headX - 4 * this.facing + eyeOffset, headY - 1, 1.8, 0, Math.PI*2);
            ctx.arc(headX + 4 * this.facing + eyeOffset, headY - 1, 1.8, 0, Math.PI*2);
            ctx.fill();

            if (!this.onGround && this.vel.y < -5) {
                ctx.fillStyle = '#c44';
                ctx.beginPath();
                ctx.arc(headX, headY + 6, 2, 0, Math.PI*2);
                ctx.fill();
            } else {
                ctx.strokeStyle = '#c44';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(headX, headY + 4, 3, 0, Math.PI);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    getHitbox() {
        return { x: this.x + 4, y: this.y + 5, width: this.width - 8, height: this.height - 5 };
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = new ParticleSystem();
        this.sound = new SoundEngine();

        this.state = 'menu';
        this.score = 0;
        this.combo = 1;
        this.comboTimer = 0;
        this.lives = 3;
        this.bestScore = parseInt(localStorage.getItem('bandit_best') || '0');
        this.difficulty = 1;
        this.time = 0;
        this.cameraY = 0;
        this.targetCameraY = 0;

        this.input = {
            left: false,
            right: false,
            superJumpPressed: false
        };

        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        this.resize();
        this.init();
        this.setupEvents();
        this.gameLoop();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.canvas.offsetWidth * dpr;
        this.canvas.height = this.canvas.offsetHeight * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = this.canvas.offsetWidth;
        this.height = this.canvas.offsetHeight;
    }

    init() {
        this.player = new Player(this.width/2 - 15, this.height - 150);
        this.mattresses = [];
        this.collectibles = [];
        this.cameraY = 0;
        this.targetCameraY = 0;
        this.score = 0;
        this.combo = 1;
        this.comboTimer = 0;
        this.lives = 3;
        this.difficulty = 1;
        this.highestY = this.height - 150;

        this.generateInitialMattresses();
        this.updateUI();
    }

    generateInitialMattresses() {
        this.mattresses.push(new Mattress(this.width/2 - 80, this.height - 100, 160, 0));
        for (let i = 1; i < 20; i++) {
            this.addMattress(this.height - 100 - i * CONFIG.mattressGap);
        }
    }

    addMattress(y) {
        const width = randomRange(CONFIG.mattressMinWidth, CONFIG.mattressMaxWidth);
        const x = randomRange(0, this.width - width);
        const colorIdx = Math.floor(Math.random() * CONFIG.colors.mattress.length);
        this.mattresses.push(new Mattress(x, y, width, colorIdx));

        if (Math.random() < CONFIG.collectibleSpawnRate) {
            const types = ['star', 'pillow', 'toy'];
            this.collectibles.push(new Collectible(x + width/2 - 15, y - 50, randomChoice(types)));
        }
    }

    setupEvents() {
        window.addEventListener('resize', () => this.resize());

        document.addEventListener('keydown', (e) => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.input.left = true;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') this.input.right = true;

            if (e.code === 'Space') {
                e.preventDefault();
                if (!this.input.superJumpPressed) {
                    this.input.superJumpPressed = true;
                    if (this.state === 'playing') this.useSuperJump();
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.input.left = false;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') this.input.right = false;
            if (e.code === 'Space') this.input.superJumpPressed = false;
        });

        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.restart());

        const avatarInput = document.getElementById('avatarInput');
        const avatarPreview = document.getElementById('avatarPreview');
        const avatarLoader = document.getElementById('avatarLoader');
        const clearBtn = document.getElementById('clearAvatar');

        avatarPreview.addEventListener('click', () => avatarInput.click());

        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            avatarLoader.classList.add('active');

            const reader = new FileReader();
            reader.onload = async (event) => {
                const img = new Image();
                img.onload = async () => {
                    try {
                        const processedImg = await removeWhiteBackground(img, {
                            threshold: 235,
                            smoothness: 25
                        });
                        playerAvatarImage = processedImg;

                        avatarPreview.innerHTML = '';
                        const previewImg = document.createElement('img');
                        previewImg.src = processedImg.src;
                        avatarPreview.appendChild(previewImg);
                        avatarPreview.classList.add('has-image');
                        clearBtn.style.display = 'inline-block';

                        const loader = document.createElement('div');
                        loader.className = 'avatar-loader';
                        loader.id = 'avatarLoader';
                        loader.innerHTML = '<div class="loader-spinner"></div><span>Обработка...</span>';
                        avatarPreview.appendChild(loader);
                    } catch (err) {
                        console.error('Ошибка:', err);
                        playerAvatarImage = img;
                        avatarPreview.innerHTML = '';
                        const previewImg = document.createElement('img');
                        previewImg.src = event.target.result;
                        avatarPreview.appendChild(previewImg);
                        avatarPreview.classList.add('has-image');
                        clearBtn.style.display = 'inline-block';
                    } finally {
                        const loader = document.getElementById('avatarLoader');
                        if (loader) loader.classList.remove('active');
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playerAvatarImage = null;
            avatarPreview.innerHTML = `
                <div class="avatar-placeholder">📷</div>
                <div class="avatar-loader" id="avatarLoader">
                    <div class="loader-spinner"></div>
                    <span>Обработка...</span>
                </div>
            `;
            avatarPreview.classList.remove('has-image');
            avatarInput.value = '';
            clearBtn.style.display = 'none';
        });

        this.setupMobileControls();
    }

    setupMobileControls() {
        const controlsDiv = document.createElement('div');
        controlsDiv.id = 'mobileControls';
        controlsDiv.className = 'mobile-controls';
        controlsDiv.innerHTML = `
            <div class="mobile-buttons-left">
                <div class="mobile-btn" id="btnLeft">←</div>
                <div class="mobile-btn" id="btnRight">→</div>
            </div>
            <div class="mobile-buttons-right">
                <div class="mobile-btn jump-btn" id="btnJump"></div>
            </div>
        `;
        
        document.querySelector('.game-container').appendChild(controlsDiv);

        const btnLeft = document.getElementById('btnLeft');
        const btnRight = document.getElementById('btnRight');
        const btnJump = document.getElementById('btnJump');

        btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.left = true; btnLeft.classList.add('active'); });
        btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); this.input.left = false; btnLeft.classList.remove('active'); });
        btnLeft.addEventListener('mousedown', () => { this.input.left = true; btnLeft.classList.add('active'); });
        btnLeft.addEventListener('mouseup', () => { this.input.left = false; btnLeft.classList.remove('active'); });
        btnLeft.addEventListener('mouseleave', () => { this.input.left = false; btnLeft.classList.remove('active'); });

        btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.right = true; btnRight.classList.add('active'); });
        btnRight.addEventListener('touchend', (e) => { e.preventDefault(); this.input.right = false; btnRight.classList.remove('active'); });
        btnRight.addEventListener('mousedown', () => { this.input.right = true; btnRight.classList.add('active'); });
        btnRight.addEventListener('mouseup', () => { this.input.right = false; btnRight.classList.remove('active'); });
        btnRight.addEventListener('mouseleave', () => { this.input.right = false; btnRight.classList.remove('active'); });

        btnJump.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.state === 'playing') {
                this.player.jump(false);
                this.sound.jump();
                this.particles.emit(this.player.x + this.player.width/2, this.player.y + this.player.height, '#a29bfe', 8, { speed: 4, upward: 2 });
            }
            btnJump.classList.add('active');
        });
        btnJump.addEventListener('touchend', (e) => { e.preventDefault(); btnJump.classList.remove('active'); });
        btnJump.addEventListener('mousedown', () => {
            if (this.state === 'playing') {
                this.player.jump(false);
                this.sound.jump();
                this.particles.emit(this.player.x + this.player.width/2, this.player.y + this.player.height, '#a29bfe', 8, { speed: 4, upward: 2 });
            }
            btnJump.classList.add('active');
        });
        btnJump.addEventListener('mouseup', () => { btnJump.classList.remove('active'); });
    }

    startGame() {
        this.sound.init();
        this.state = 'playing';
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
        
        const controls = document.getElementById('mobileControls');
        if (controls) controls.style.display = this.isMobile ? 'flex' : 'none';
    }

    restart() {
        this.init();
        this.state = 'playing';
        document.getElementById('gameOverScreen').classList.add('hidden');
        
        const controls = document.getElementById('mobileControls');
        if (controls) controls.style.display = this.isMobile ? 'flex' : 'none';
    }

    useSuperJump() {
        if (this.score > 0) {
            this.player.jump(true);
            this.sound.superJump();
            this.particles.emit(this.player.x + this.player.width/2, this.player.y + this.player.height, '#fdcb6e', 15, { speed: 8, upward: 3, shape: 'star' });
        } else {
            this.player.jump(false);
            this.sound.jump();
        }
    }

    gameOver() {
        this.state = 'gameOver';
        this.sound.gameOver();

        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('bandit_best', this.bestScore.toString());
        }

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('bestScore').textContent = this.bestScore;
        document.getElementById('gameOverScreen').classList.remove('hidden');

        const controls = document.getElementById('mobileControls');
        if (controls) controls.style.display = 'none';
    }

    update() {
        if (this.state !== 'playing') return;

        this.time += 0.016;
        this.difficulty += CONFIG.difficultyIncrease;

        this.player.update(this.input, this.width);
        this.player.onGround = false;

        for (const m of this.mattresses) {
            if (m.broken) continue;
            const playerHB = this.player.getHitbox();

            if (this.player.vel.y > 0) {
                if (playerHB.x < m.x + m.width &&
                    playerHB.x + playerHB.width > m.x &&
                    playerHB.y + playerHB.height >= m.y &&
                    playerHB.y + playerHB.height <= m.y + m.height + 10) {

                    const result = m.onLand();
                    this.player.y = m.y - this.player.height;

                    if (result === 'breakable') {
                        this.player.jump(false);
                        this.particles.emit(m.x + m.width/2, m.y, m.color, 20, { speed: 6, shape: 'square' });
                        this.sound.hit();
                        setTimeout(() => { m.broken = true; }, 200);
                    } else if (result === 'bouncy') {
                        this.player.jump(true);
                        this.sound.superJump();
                        this.particles.emit(m.x + m.width/2, m.y, '#fdcb6e', 12, { speed: 5, shape: 'star' });
                    } else {
                        this.player.jump(false);
                        this.sound.jump();
                        this.particles.emit(m.x + m.width/2, m.y, m.color, 6, { speed: 3 });
                    }
                    break;
                }
            }
            m.update();
        }

        const playerHB = this.player.getHitbox();
        for (const c of this.collectibles) {
            if (c.collected) continue;
            c.update(this.time);
            const ch = c.getHitbox();

            if (playerHB.x < ch.x + ch.width &&
                playerHB.x + playerHB.width > ch.x &&
                playerHB.y < ch.y + ch.height &&
                playerHB.y + playerHB.height > ch.y) {
                c.collected = true;
                this.collectItem(c);
            }
        }

        const playerScreenY = this.player.y - this.cameraY;
        if (playerScreenY < this.height * 0.4) {
            this.targetCameraY = this.player.y - this.height * 0.4;
        }
        this.cameraY += (this.targetCameraY - this.cameraY) * CONFIG.cameraSmooth;

        if (this.player.y < this.highestY) {
            const gained = Math.floor((this.highestY - this.player.y) * 0.1);
            this.score += gained * this.combo;
            this.highestY = this.player.y;
        }

        if (this.comboTimer > 0) this.comboTimer--;
        else if (this.combo > 1) this.combo = 1;

        const topEdge = this.cameraY - 100;
        const highestMattress = Math.min(...this.mattresses.map(m => m.y));
        while (highestMattress > topEdge - 300) {
            this.addMattress(highestMattress - CONFIG.mattressGap / this.difficulty);
            break;
        }

        this.mattresses = this.mattresses.filter(m => m.y - this.cameraY < this.height + 200);
        this.collectibles = this.collectibles.filter(c => !c.collected && c.y - this.cameraY < this.height + 200);

        this.particles.update();

        if (this.player.y - this.cameraY > this.height + 100) {
            this.lives--;
            this.sound.hit();
            this.particles.emit(this.player.x + this.player.width/2, this.height, '#e17055', 30, { speed: 8, shape: 'circle' });

            if (this.lives <= 0) {
                this.gameOver();
            } else {
                const safeMat = this.mattresses
                    .filter(m => !m.broken && m.y > this.cameraY && m.y < this.cameraY + this.height)
                    .sort((a, b) => b.y - a.y)[0];

                if (safeMat) {
                    this.player.x = safeMat.x + safeMat.width/2 - this.player.width/2;
                    this.player.y = safeMat.y - this.player.height - 50;
                    this.player.vel.y = 0;
                    this.player.vel.x = 0;
                    this.player.invulnerable = 60;
                }
            }
        }

        this.updateUI();
    }

    collectItem(item) {
        const points = { star: 50, pillow: 25, toy: 100 }[item.type];
        this.score += points * this.combo;
        this.combo = Math.min(this.combo + 1, 10);
        this.comboTimer = 180;

        this.sound.collect();
        if (this.combo > 3) this.sound.combo();

        const color = CONFIG.colors.collectibles[item.type];
        this.particles.emit(item.x + item.width/2, item.y - this.cameraY + item.height/2, color, 20, { speed: 6, shape: item.type === 'star' ? 'star' : 'circle', upward: 4 });

        const comboEl = document.getElementById('combo');
        comboEl.classList.add('pulse');
        setTimeout(() => comboEl.classList.remove('pulse'), 150);
    }

    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('combo').textContent = `x${this.combo}`;
        const hearts = '♥'.repeat(this.lives) + '♡'.repeat(Math.max(0, 3 - this.lives));
        document.getElementById('lives').textContent = hearts;
    }

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        this.drawBackground(ctx);

        for (const m of this.mattresses) {
            if (!m.broken) m.draw(ctx, this.cameraY);
        }

        for (const c of this.collectibles) {
            c.draw(ctx, this.cameraY, this.time);
        }

        this.particles.draw(ctx);
        this.player.draw(ctx, this.cameraY, this.time);
    }

    drawBackground(ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#0a0a1a');
        gradient.addColorStop(0.5, '#12122a');
        gradient.addColorStop(1, '#1a1a3e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.save();
        ctx.globalAlpha = 0.03;
        const offset = this.cameraY * 0.1;

        for (let i = 0; i < 15; i++) {
            const x = (i * 137 + 50) % this.width;
            const y = ((i * 193 + offset) % (this.height + 200)) - 100;
            const size = 30 + (i % 5) * 20;

            ctx.strokeStyle = CONFIG.colors.mattress[i % CONFIG.colors.mattress.length];
            ctx.lineWidth = 1;
            ctx.beginPath();

            if (i % 3 === 0) ctx.arc(x, y, size, 0, Math.PI*2);
            else if (i % 3 === 1) ctx.rect(x - size/2, y - size/2, size, size);
            else {
                ctx.moveTo(x, y - size);
                ctx.lineTo(x + size, y + size);
                ctx.lineTo(x - size, y + size);
                ctx.closePath();
            }
            ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 50; i++) {
            const x = (i * 97.3) % this.width;
            const y = ((i * 71.7 + this.cameraY * 0.05) % this.height);
            const size = (i % 3 === 0) ? 2 : 1;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

window.addEventListener('load', () => { new Game(); });
