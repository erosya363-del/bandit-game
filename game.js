const CONFIG = {
    gravity: 0.42,
    jumpForce: -11.5,
    superJumpForce: -15,
    moveSpeed: 5.5,
    walkSpeed: 5,
    airControl: 0.14,
    friction: 0.82,
    groundFriction: 0.7,
    maxFallSpeed: 14,
    maxJumpsInAir: 2,
    breakableWarningFrames: 120,
    mattressGap: 120,
    mattressMinWidth: 80,
    mattressMaxWidth: 160,
    collectibleSpawnRate: 0.28,
    cameraSmooth: 0.08,
    difficultyIncrease: 0.0003,
    colors: {
        player: { skin: '#fdbcb4', hair: '#4a3728', shirt: '#1a3b8e', pants: '#1a1a2e' },
        spiderSuit: { suit: '#1a3b8e', webs: '#e63946', emblem: '#e63946' },
        mattress: ['#6c5ce7', '#a29bfe', '#fd79a8', '#00cec9', '#fdcb6e', '#e17055'],
        collectibles: { star: '#fdcb6e', pillow: '#fd79a8', toy: '#00cec9' }
    },
    difficultyModes: {
        easy:   { gap: 160, increase: 0.00015, superJump: -22 },
        medium: { gap: 120, increase: 0.0003,  superJump: -20 },
        hard:   { gap: 90,  increase: 0.0005,  superJump: -18 }
    }
};

let playerAvatarImage = null;

// ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ----------
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

const INTEGRITY_SALT = 'bndt_spdr_2026_v2';

function simpleHash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
}

function signScore(name, score) {
    const timestamp = Date.now();
    const payload = `${name}|${score}|${timestamp}`;
    const encoded = btoa(unescape(encodeURIComponent(payload)));
    const hash = simpleHash(payload + INTEGRITY_SALT);
    return `${score}:${encoded}:${hash}`;
}

function verifyScore(signedScore, expectedName = null) {
    try {
        if (!signedScore || typeof signedScore !== 'string') return null;

        const parts = signedScore.split(':');
        if (parts.length === 2) {
            const score = parseInt(parts[0], 10);
            const decoded = decodeURIComponent(escape(atob(parts[1])));
            const segments = decoded.split('|');
            if (segments.length !== 3) return null;
            const name = segments[0];
            const payloadScore = parseInt(segments[1], 10);
            if (payloadScore !== score) return null;
            if (expectedName && name !== expectedName) return null;
            return { name, score, timestamp: parseInt(segments[2], 10) };
        }

        if (parts.length !== 3) return null;
        const score = parseInt(parts[0], 10);
        const decoded = decodeURIComponent(escape(atob(parts[1])));
        const segments = decoded.split('|');
        if (segments.length !== 3) return null;
        const name = segments[0];
        const payloadScore = parseInt(segments[1], 10);
        const timestamp = parseInt(segments[2], 10);
        if (payloadScore !== score || isNaN(score) || score < 0) return null;
        if (expectedName && name !== expectedName) return null;
        if (simpleHash(decoded + INTEGRITY_SALT) !== parts[2]) return null;
        return { name, score, timestamp };
    } catch {
        return null;
    }
}

function signBestScore(score) {
    return signScore('__best__', score);
}

function verifyBestScore(stored) {
    const verified = verifyScore(stored);
    return verified && verified.name === '__best__' ? verified.score : null;
}

// ---------- MATTRESS (платформа) ----------
class Mattress {
    constructor(x, y, width, colorIdx, altitudeFactor = 0, gameWidth = 800) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = 25;
        this.colorIdx = colorIdx % CONFIG.colors.mattress.length;
        this.color = CONFIG.colors.mattress[this.colorIdx];
        this.broken = false;
        this.type = 'normal';
        this.scaleY = 1;
        this.squashTimer = 0;
        this.deltaX = 0;
        this.warningActive = false;
        this.warningTimer = 0;
        this.moveSpeed = 0;
        this.moveDir = 1;
        this.linkedCollectibles = [];

        const breakChance = 0.08 + altitudeFactor * 0.22;
        const moveChance = altitudeFactor < 0.2 ? 0 : 0.15 + altitudeFactor * 0.55;

        if (Math.random() < breakChance) {
            this.type = 'breakable';
        } else if (Math.random() < moveChance) {
            this.type = 'moving';
            this.moveSpeed = 0.25 + altitudeFactor * 1.8;
            this.moveDir = Math.random() < 0.5 ? -1 : 1;
            this.movePhase = Math.random() * Math.PI * 2;
        }
    }

    onLand() {
        this.scaleY = 0.55;
        this.squashTimer = 8;

        if (this.type === 'breakable' && !this.warningActive && !this.broken) {
            this.warningActive = true;
            this.warningTimer = CONFIG.breakableWarningFrames;
        }
        return this.type;
    }

    update(gameWidth) {
        this.deltaX = 0;
        const prevX = this.x;

        if (this.squashTimer > 0) {
            this.squashTimer--;
            this.scaleY += (1 - this.scaleY) * 0.35;
        } else {
            this.scaleY = 1;
        }

        if (this.type === 'moving' && !this.broken) {
            this.x += this.moveSpeed * this.moveDir;
            if (this.x <= 0) {
                this.x = 0;
                this.moveDir = 1;
            } else if (this.x + this.width >= gameWidth) {
                this.x = gameWidth - this.width;
                this.moveDir = -1;
            }
        }

        this.deltaX = this.x - prevX;

        if (this.warningActive && !this.broken) {
            this.warningTimer--;
            if (this.warningTimer <= 0) {
                this.broken = true;
                this.warningActive = false;
            }
        }

        for (const c of this.linkedCollectibles) {
            if (!c.collected) c.x += this.deltaX;
        }
    }

    draw(ctx, cameraY, time) {
        if (this.broken) return;
        const screenY = this.y - cameraY;
        const scaledHeight = this.height * this.scaleY;
        const drawY = screenY + this.height - scaledHeight;

        ctx.save();

        if (this.warningActive) {
            const blink = Math.floor(this.warningTimer / 10) % 2 === 0;
            ctx.globalAlpha = blink ? 1 : 0.45;
            ctx.shadowColor = '#ff6b6b';
            ctx.shadowBlur = blink ? 18 : 8;
        } else if (this.type === 'moving') {
            ctx.shadowColor = '#00cec9';
            ctx.shadowBlur = 12;
        }

        const fillColor = this.warningActive
            ? (Math.floor(this.warningTimer / 10) % 2 === 0 ? this.color : '#e17055')
            : this.color;

        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.roundRect(this.x, drawY, this.width, scaledHeight, 8);
        ctx.fill();

        ctx.shadowBlur = 0;

        if (this.type === 'breakable' || this.warningActive) {
            ctx.strokeStyle = 'rgba(255,107,107,0.7)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.roundRect(this.x + 4, drawY + 3, this.width - 8, scaledHeight * 0.4, 4);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(this.x, drawY, this.width, scaledHeight, 8);
        ctx.stroke();

        if (this.warningActive) {
            const secs = Math.ceil(this.warningTimer / 60);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${secs}с`, this.x + this.width / 2, drawY - 6);
        }

        ctx.restore();
    }
}

// ---------- COLLECTIBLE ----------
class Collectible {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.type = type;
        this.collected = false;
        this.time = Math.random() * Math.PI * 2;
        this.bobOffset = Math.random() * Math.PI * 2;
    }

    update(time) {
        this.time = time;
    }

    draw(ctx, cameraY, time) {
        if (this.collected) return;
        const screenY = this.y - cameraY + Math.sin(time * 3 + this.bobOffset) * 6;

        ctx.save();

        const glow =
            this.type === 'star' ? '#fdcb6e' :
            this.type === 'pillow' ? '#fd79a8' : '#00cec9';

        ctx.shadowColor = glow;
        ctx.shadowBlur = 15;

        ctx.translate(this.x + this.width / 2, screenY + this.height / 2);
        ctx.rotate(time * 1.5);

        const s = 14;

        if (this.type === 'star') {
            this.drawStar(ctx, 0, 0, 5, s, s / 2);
            ctx.fillStyle = glow;
            ctx.fill();
        } else if (this.type === 'pillow') {
            ctx.fillStyle = '#fd79a8';
            ctx.beginPath();
            ctx.roundRect(-s, -s * 0.6, s * 2, s * 1.2, 6);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath();
            ctx.roundRect(-s + 3, -s * 0.6 + 2, s * 2 - 6, s * 1.2 * 0.4, 3);
            ctx.fill();
        } else if (this.type === 'toy') {
            ctx.fillStyle = '#00cec9';
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(-3, -3, s * 0.2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    drawStar(ctx, cx, cy, spikes, outerR, innerR) {
        let rot = Math.PI / 2 * 3;
        const step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerR);
        for (let i = 0; i < spikes; i++) {
            ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
            rot += step;
            ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerR);
        ctx.closePath();
    }

    getHitbox() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// ---------- PLAYER (Spider-Man) ----------
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 45;
        this.vel = new Vector(0, 0);
        this.invulnerable = 0;
        this.facing = 1;
        this.displayFacing = 1;
        this.webSwing = 0;
        this.jumpAnim = 0;
        this.isGrounded = false;
        this.standingOn = null;
        this.jumpsInAir = 0;
        this.maxJumps = CONFIG.maxJumpsInAir;
        this.walkCycle = 0;
    }

    update(input, boundsWidth, touchWalkX, touchActive) {
        if (this.isGrounded) {
            let moveX = 0;

            if (input.left) moveX -= 1;
            if (input.right) moveX += 1;

            if (touchActive && touchWalkX !== null) {
                const center = this.x + this.width / 2;
                const diff = touchWalkX - center;
                if (Math.abs(diff) > 4) {
                    moveX += Math.sign(diff) * Math.min(1, Math.abs(diff) / 40);
                }
            }

            if (moveX !== 0) {
                this.vel.x = moveX * CONFIG.walkSpeed;
                this.facing = moveX > 0 ? 1 : -1;
                this.walkCycle += 0.25;
            } else {
                this.vel.x *= CONFIG.groundFriction;
                if (Math.abs(this.vel.x) < 0.1) this.vel.x = 0;
            }

            this.vel.y = 0;
        } else {
            if (input.left) this.vel.x -= CONFIG.moveSpeed * CONFIG.airControl;
            if (input.right) this.vel.x += CONFIG.moveSpeed * CONFIG.airControl;

            if (touchActive && touchWalkX !== null) {
                const center = this.x + this.width / 2;
                const diff = touchWalkX - center;
                if (Math.abs(diff) > 8) {
                    this.vel.x += Math.sign(diff) * CONFIG.airControl * 2;
                    this.facing = diff > 0 ? 1 : -1;
                }
            }

            this.vel.x *= CONFIG.friction;
            this.vel.x = Math.max(-CONFIG.moveSpeed, Math.min(CONFIG.moveSpeed, this.vel.x));

            if (Math.abs(this.vel.x) > 0.8) {
                this.facing = this.vel.x > 0 ? 1 : -1;
            }

            this.vel.y += CONFIG.gravity;
            this.vel.y = Math.min(this.vel.y, CONFIG.maxFallSpeed);
            this.y += this.vel.y;
        }

        this.x += this.vel.x;
        this.displayFacing += (this.facing - this.displayFacing) * 0.35;

        if (this.x < 0) { this.x = 0; this.vel.x = 0; }
        if (this.x + this.width > boundsWidth) { this.x = boundsWidth - this.width; this.vel.x = 0; }

        if (this.jumpAnim > 0) this.jumpAnim--;
        if (this.webSwing > 0) this.webSwing--;
        if (this.invulnerable > 0) this.invulnerable--;
    }

    tryJump(force) {
        if (this.isGrounded) {
            this.doJump(force);
            this.isGrounded = false;
            this.standingOn = null;
            this.jumpsInAir = 1;
            return true;
        }
        if (this.jumpsInAir < this.maxJumps) {
            this.doJump(force);
            this.jumpsInAir++;
            return true;
        }
        return false;
    }

    doJump(force) {
        this.vel.y = force;
        this.jumpAnim = 12;
        this.webSwing = 15;
    }

    landOn(mattress) {
        this.isGrounded = true;
        this.standingOn = mattress;
        this.jumpsInAir = 0;
        this.vel.y = 0;
        this.y = mattress.y - this.height;
        mattress.onLand();
    }

    leavePlatform() {
        this.isGrounded = false;
        this.standingOn = null;
    }

    getHitbox() {
        return {
            x: this.x + 6,
            y: this.y + 8,
            width: this.width - 12,
            height: this.height - 8
        };
    }

    draw(ctx, cameraY, time) {
        if (this.invulnerable > 0 && Math.floor(this.invulnerable / 4) % 2 === 0) return;

        const screenY = this.y - cameraY;
        const cx = this.x + this.width / 2;
        const cy = screenY + this.height / 2;
        const lean = this.isGrounded
            ? Math.sin(this.walkCycle) * 0.04
            : this.vel.x * 0.06;
        const airTilt = this.isGrounded ? 0 : Math.min(0.15, Math.abs(this.vel.y) * 0.008) * Math.sign(this.vel.y);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(lean - airTilt);

        const flip = this.displayFacing < 0 ? -1 : 1;
        if (flip === -1) ctx.scale(-1, 1);

        const useAvatar = playerAvatarImage && playerAvatarImage.complete;
        const suit = CONFIG.colors.spiderSuit.suit;
        const red = CONFIG.colors.spiderSuit.webs;

        if (useAvatar) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, -8, 14, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(playerAvatarImage, -14, -22, 28, 28);
            ctx.restore();
        } else {
            this.drawSpiderMask(ctx, time);
        }

        ctx.fillStyle = suit;
        ctx.beginPath();
        ctx.roundRect(-12, -2, 24, 30, 5);
        ctx.fill();

        ctx.fillStyle = red;
        ctx.beginPath();
        ctx.moveTo(-12, 2);
        ctx.lineTo(12, 2);
        ctx.lineTo(10, 14);
        ctx.lineTo(-10, 14);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 0.8;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(i * 4, -2);
            ctx.lineTo(i * 6, 28);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 10, 8, 0, Math.PI);
        ctx.stroke();

        ctx.fillStyle = red;
        ctx.beginPath();
        ctx.ellipse(0, 8, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        const legSwing = this.isGrounded
            ? Math.sin(this.walkCycle) * 5
            : Math.sin(time * 14) * 4;
        ctx.fillStyle = suit;
        ctx.beginPath();
        ctx.roundRect(-11, 26, 9, 14 + legSwing * 0.3, 3);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(2, 26, 9, 14 - legSwing * 0.3, 3);
        ctx.fill();

        ctx.fillStyle = red;
        ctx.beginPath();
        ctx.roundRect(-14, 16, 7, 12, 2);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(7, 16, 7, 12, 2);
        ctx.fill();

        if (this.webSwing > 0 || this.jumpAnim > 0) {
            const intensity = this.jumpAnim > 0 ? this.jumpAnim / 12 : this.webSwing / 15;
            ctx.strokeStyle = `rgba(255,255,255,${intensity * 0.9})`;
            ctx.lineWidth = 1.5 * intensity;

            for (let i = -1; i <= 1; i += 2) {
                ctx.beginPath();
                ctx.moveTo(i * 5, -22);
                ctx.quadraticCurveTo(i * 18, -38 + Math.sin(time * 20) * 5, i * 28 + i * 12 * intensity, -55);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    drawSpiderMask(ctx, time) {
        const headY = -16 + Math.sin(time * 8) * 1;
        const red = '#e63946';

        ctx.fillStyle = red;
        ctx.beginPath();
        ctx.arc(0, headY, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1a3b8e';
        ctx.beginPath();
        ctx.arc(0, headY + 1, 9, Math.PI * 0.15, Math.PI * 0.85);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(-4, headY + 1, 5, 7, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(4, headY + 1, 5, 7, 0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.ellipse(-4, headY + 2, 2.2, 3.5, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(4, headY + 2, 2.2, 3.5, 0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.2;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(i * 3, headY - 8);
            ctx.lineTo(i * 5, headY + 10);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, headY + 2, 7, 0.3, Math.PI - 0.3);
        ctx.stroke();
    }
}

// ---------- ОСНОВНОЙ КЛАСС ИГРЫ ----------
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
        this.bestScore = this.loadBestScore();
        this.difficulty = 1;
        this.time = 0;
        this.cameraY = 0;
        this.targetCameraY = 0;

        this.playerName = '';
        this.difficultyMode = 'medium';

        this.input = {
            left: false,
            right: false,
            jumpPressed: false
        };

        this.touchActive = false;
        this.touchWalkX = null;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchMoved = false;
        this.startPlatformY = 0;

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
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.width = this.canvas.offsetWidth;
        this.height = this.canvas.offsetHeight;
    }

    init() {
        this.player = new Player(this.width / 2 - 15, this.height - 150);
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
        this.startPlatformY = this.height - 100;
        this.touchActive = false;
        this.touchWalkX = null;

        const startW = Math.min(180, this.width - 20);
        const startX = Math.max(0, this.width / 2 - startW / 2);
        const startMat = new Mattress(startX, this.startPlatformY, startW, 0, 0, this.width);
        this.mattresses.push(startMat);
        this.player.landOn(startMat);

        this.generateInitialMattresses();
        this.updateUI();
        this.updateLeaderboardDisplay('leaderboardList');
    }

    getAltitudeFactor(y) {
        const climbed = Math.max(0, this.startPlatformY - (y ?? this.highestY));
        return Math.min(1, climbed / (this.height * 10));
    }

    computePlatformGap(altitudeFactor) {
        const base = this.activeConfig?.mattressGap ?? CONFIG.mattressGap;
        const ease = altitudeFactor * altitudeFactor;
        return base * (1.15 + ease * 1.6);
    }

    generateInitialMattresses() {
        let y = this.startPlatformY;
        const count = 10;
        for (let i = 0; i < count; i++) {
            const alt = this.getAltitudeFactor(y);
            y -= this.computePlatformGap(alt);
            this.addMattress(y, alt);
        }
    }

    addMattress(y, altitudeFactor) {
        const alt = altitudeFactor ?? this.getAltitudeFactor(y);
        const minW = CONFIG.mattressMinWidth + (1 - alt) * 20;
        const maxW = CONFIG.mattressMaxWidth - alt * 50;
        const width = randomRange(Math.max(60, minW), Math.max(minW + 10, maxW));
        const x = randomRange(0, Math.max(0, this.width - width));
        const colorIdx = Math.floor(Math.random() * CONFIG.colors.mattress.length);
        const mattress = new Mattress(x, y, width, colorIdx, alt, this.width);
        this.mattresses.push(mattress);

        const spawnRate = CONFIG.collectibleSpawnRate * (1 - alt * 0.4);
        if (Math.random() < spawnRate) {
            const types = ['star', 'pillow', 'toy'];
            const collectible = new Collectible(x + width / 2 - 15, y - 50, randomChoice(types));
            mattress.linkedCollectibles.push(collectible);
            this.collectibles.push(collectible);
        }
    }

    loadBestScore() {
        const stored = localStorage.getItem('bandit_best');
        if (!stored) return 0;
        const verified = verifyBestScore(stored);
        if (verified !== null) return verified;
        const legacy = parseInt(stored, 10);
        return isNaN(legacy) ? 0 : legacy;
    }

    saveBestScore(score) {
        localStorage.setItem('bandit_best', signBestScore(score));
    }

    loadLeaderboard() {
        const data = localStorage.getItem('bandit_leaderboard');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                if (!Array.isArray(parsed)) return [];
                return parsed
                    .filter(e => e && typeof e.signature === 'string' && verifyScore(e.signature, e.name))
                    .map(e => {
                        const v = verifyScore(e.signature, e.name);
                        return { name: v.name, score: v.score, signature: e.signature, date: e.date || '' };
                    })
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 10);
            } catch { return []; }
        }
        return [];
    }

    saveLeaderboard(lb) {
        localStorage.setItem('bandit_leaderboard', JSON.stringify(lb));
    }

    addScore(name, score) {
        if (score <= 0) return this.loadLeaderboard();
        let lb = this.loadLeaderboard();
        const signature = signScore(name, score);
        lb.push({ name, score, signature, date: new Date().toISOString() });
        lb.sort((a, b) => b.score - a.score);
        if (lb.length > 10) lb = lb.slice(0, 10);
        this.saveLeaderboard(lb);
        return lb;
    }

    getRank(name, score) {
        const lb = this.loadLeaderboard();
        const all = [...lb, { name, score }];
        all.sort((a, b) => b.score - a.score);
        let rank = 1;
        for (let i = 0; i < all.length; i++) {
            if (all[i].name === name && all[i].score === score) {
                if (i > 0 && all[i].score === all[i - 1].score) {
                    for (let j = i - 1; j >= 0 && all[j].score === score; j--) rank = j + 1;
                }
                return rank;
            }
        }
        return all.length;
    }

    getLiveRank(score) {
        const lb = this.loadLeaderboard();
        let rank = 1;
        for (const entry of lb) {
            if (score >= entry.score) break;
            rank++;
        }
        return rank;
    }

    updateLeaderboardDisplay(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const lb = this.loadLeaderboard();
        if (lb.length === 0) {
            container.innerHTML = '<div class="leaderboard-item" style="color:var(--text-dim);">Пока нет записей</div>';
            return;
        }
        let html = '';
        lb.forEach((entry, idx) => {
            const rank = idx + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
            const isCurrent = (this.state === 'gameOver' && entry.score === this.score && entry.name === this.playerName);
            html += `
                <div class="leaderboard-item ${isCurrent ? 'current' : ''}">
                    <span><span class="rank">${medal}</span><span class="name">${escapeHtml(entry.name)}</span></span>
                    <span class="score">${entry.score}</span>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    setupEvents() {
        window.addEventListener('resize', () => this.resize());

        document.addEventListener('keydown', (e) => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.input.left = true;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') this.input.right = true;
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                e.preventDefault();
                if (!this.input.jumpPressed) {
                    this.input.jumpPressed = true;
                    if (this.state === 'playing') this.tryJump();
                }
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.input.left = false;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') this.input.right = false;
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                this.input.jumpPressed = false;
            }
        });

        this.setupCanvasInput();

        this.bindActionButton('startBtn', () => this.startGame());
        this.bindActionButton('restartBtn', () => this.restart());

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
                        const processedImg = await removeWhiteBackground(img, { threshold: 235, smoothness: 25 });
                        playerAvatarImage = processedImg;
                        avatarPreview.innerHTML = '';
                        const previewImg = document.createElement('img');
                        previewImg.src = processedImg.src;
                        avatarPreview.appendChild(previewImg);
                        avatarPreview.classList.add('has-image');
                        clearBtn.style.display = 'inline-block';
                    } catch (err) {
                        console.error('Ошибка обработки:', err);
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

        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.difficultyMode = btn.dataset.diff;
            });
        });

        const leaderboardBlock = document.getElementById('leaderboard');
        document.getElementById('showLeaderboardBtn').addEventListener('click', () => {
            if (leaderboardBlock.style.display === 'none') {
                leaderboardBlock.style.display = 'block';
                this.updateLeaderboardDisplay('leaderboardList');
            } else {
                leaderboardBlock.style.display = 'none';
            }
        });

        this.setupMobileControls();
    }

    bindActionButton(id, handler) {
        const btn = document.getElementById(id);
        if (!btn) return;
        let touchHandled = false;

        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            touchHandled = true;
            handler();
            setTimeout(() => { touchHandled = false; }, 500);
        }, { passive: false });

        btn.addEventListener('click', (e) => {
            if (touchHandled) return;
            e.preventDefault();
            handler();
        });
    }

    getCanvasX(clientX) {
        const rect = this.canvas.getBoundingClientRect();
        return (clientX - rect.left) * (this.width / rect.width);
    }

    setupCanvasInput() {
        const onTouchStart = (clientX, clientY) => {
            if (this.state !== 'playing') return;
            this.touchStartX = clientX;
            this.touchStartY = clientY;
            this.touchMoved = false;
            this.touchWalkX = this.getCanvasX(clientX);
            this.touchActive = true;
        };

        const onTouchMove = (clientX, clientY) => {
            if (this.state !== 'playing') return;
            if (Math.abs(clientX - this.touchStartX) > 12 || Math.abs(clientY - this.touchStartY) > 12) {
                this.touchMoved = true;
            }
            this.touchWalkX = this.getCanvasX(clientX);
            this.touchActive = true;
        };

        const onTouchEnd = () => {
            if (this.state === 'playing' && !this.touchMoved) {
                this.tryJump();
            }
            this.touchActive = false;
            this.touchWalkX = null;
        };

        this.canvas.addEventListener('touchstart', (e) => {
            if (e.target.closest('.mobile-btn')) return;
            e.preventDefault();
            const t = e.touches[0];
            onTouchStart(t.clientX, t.clientY);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            if (e.target.closest('.mobile-btn')) return;
            e.preventDefault();
            const t = e.touches[0];
            onTouchMove(t.clientX, t.clientY);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            if (e.target.closest('.mobile-btn')) return;
            onTouchEnd();
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (this.state !== 'playing') return;
            this.touchStartX = e.clientX;
            this.touchStartY = e.clientY;
            this.touchMoved = false;
            this.touchWalkX = this.getCanvasX(e.clientX);
            this.touchActive = true;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.touchActive || this.state !== 'playing') return;
            if (Math.abs(e.clientX - this.touchStartX) > 8) this.touchMoved = true;
            this.touchWalkX = this.getCanvasX(e.clientX);
        });

        this.canvas.addEventListener('mouseup', () => {
            if (this.state === 'playing' && this.touchActive && !this.touchMoved) {
                this.tryJump();
            }
            this.touchActive = false;
            this.touchWalkX = null;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.touchActive = false;
            this.touchWalkX = null;
        });
    }

    setupMobileControls() {
        const btnLeft = document.getElementById('btnLeft');
        const btnRight = document.getElementById('btnRight');
        const btnJump = document.getElementById('btnJump');

        const handleTouch = (btn, action) => (e) => {
            e.preventDefault();
            if (this.state !== 'playing') return;
            action();
            btn.classList.add('active');
            setTimeout(() => btn.classList.remove('active'), 100);
        };

        if (btnLeft) {
            btnLeft.addEventListener('touchstart', handleTouch(btnLeft, () => this.input.left = true), { passive: false });
            btnLeft.addEventListener('touchend', () => this.input.left = false);
            btnLeft.addEventListener('mousedown', () => { if (this.state === 'playing') this.input.left = true; });
            btnLeft.addEventListener('mouseup', () => this.input.left = false);
            btnLeft.addEventListener('mouseleave', () => this.input.left = false);
        }
        if (btnRight) {
            btnRight.addEventListener('touchstart', handleTouch(btnRight, () => this.input.right = true), { passive: false });
            btnRight.addEventListener('touchend', () => this.input.right = false);
            btnRight.addEventListener('mousedown', () => { if (this.state === 'playing') this.input.right = true; });
            btnRight.addEventListener('mouseup', () => this.input.right = false);
            btnRight.addEventListener('mouseleave', () => this.input.right = false);
        }
        if (btnJump) {
            btnJump.addEventListener('touchstart', handleTouch(btnJump, () => {
                if (this.state === 'playing') this.tryJump();
            }), { passive: false });
            btnJump.addEventListener('touchend', () => {});
            btnJump.addEventListener('mousedown', () => { if (this.state === 'playing') this.tryJump(); });
            btnJump.addEventListener('mouseup', () => {});
            btnJump.addEventListener('mouseleave', () => {});
        }
    }

    validateName(name) {
        const cleaned = name.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        return /^[a-zA-Zа-яА-ЯёЁіІїЇєЄ0-9]{2,20}$/u.test(cleaned);
    }

    startGame() {
        const nameInput = document.getElementById('playerName');
        const nameError = document.getElementById('nameError');

        this.playerName = nameInput.value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

        if (!this.validateName(this.playerName)) {
            nameError.style.display = 'block';
            nameError.classList.add('visible');
            nameInput.classList.add('error');
            nameInput.focus();
            nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (navigator.vibrate) navigator.vibrate(80);
            return;
        }

        nameError.style.display = 'none';
        nameError.classList.remove('visible');
        nameInput.classList.remove('error');
        nameInput.blur();

        const mode = CONFIG.difficultyModes[this.difficultyMode] || CONFIG.difficultyModes.medium;
        this.activeConfig = {
            mattressGap: mode.gap,
            difficultyIncrease: mode.increase,
            superJumpForce: mode.superJump
        };

        this.resize();
        this.init();
        this.sound.init();
        this.state = 'playing';

        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('leaderboard').style.display = 'none';

        const controls = document.getElementById('mobileControls');
        if (controls) {
            controls.classList.toggle('visible', this.isMobile);
            controls.style.display = this.isMobile ? 'flex' : 'none';
        }
    }

    restart() {
        document.getElementById('nameError').style.display = 'none';
        const nameInput = document.getElementById('playerName');
        if (nameInput) nameInput.classList.remove('error');

        this.resize();
        this.init();
        this.state = 'playing';
        document.getElementById('gameOverScreen').classList.add('hidden');

        const controls = document.getElementById('mobileControls');
        if (controls) {
            controls.classList.toggle('visible', this.isMobile);
            controls.style.display = this.isMobile ? 'flex' : 'none';
        }
    }

    tryJump() {
        const jumped = this.player.tryJump(CONFIG.jumpForce);
        if (jumped) {
            this.sound.jump();
            this.particles.emit(
                this.player.x + this.player.width / 2,
                this.player.y - this.cameraY + this.player.height,
                '#e63946',
                10,
                { speed: 6, upward: 3, shape: 'star' }
            );
        }
    }

    gameOver() {
        this.state = 'gameOver';
        this.sound.gameOver();

        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            this.saveBestScore(this.bestScore);
        }

        if (this.score > 0) {
            this.addScore(this.playerName, this.score);
        }
        const rank = this.getRank(this.playerName, this.score);

        const rankDisplay = document.getElementById('rankDisplay');
        if (this.score <= 0) {
            rankDisplay.textContent = 'Попробуйте ещё раз!';
        } else if (rank === 1) {
            rankDisplay.textContent = '🥇 Первое место!';
        } else if (rank === 2) {
            rankDisplay.textContent = '🥈 Второе место!';
        } else if (rank === 3) {
            rankDisplay.textContent = '🥉 Третье место!';
        } else if (rank <= 10) {
            rankDisplay.textContent = `#${rank} место в топ‑10`;
        } else {
            rankDisplay.textContent = `#${rank} в рейтинге`;
        }

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('bestScore').textContent = this.bestScore;
        const nameEl = document.getElementById('gameOverPlayerName');
        if (nameEl) nameEl.textContent = this.playerName;
        this.updateLeaderboardDisplay('gameOverLeaderboardList');
        document.getElementById('gameOverScreen').classList.remove('hidden');

        const controls = document.getElementById('mobileControls');
        if (controls) {
            controls.classList.remove('visible');
            controls.style.display = 'none';
        }
    }

    update() {
        if (this.state !== 'playing' || !this.player) return;

        this.time += 0.016;
        const diffIncrease = this.activeConfig?.difficultyIncrease ?? CONFIG.difficultyIncrease;
        this.difficulty += diffIncrease;

        this.mattresses.forEach(m => {
            if (!m.broken) m.update(this.width);
        });

        if (this.player.isGrounded && this.player.standingOn?.broken) {
            const m = this.player.standingOn;
            this.player.leavePlatform();
            this.particles.emit(
                m.x + m.width / 2,
                m.y - this.cameraY,
                m.color,
                14,
                { speed: 5, shape: 'square' }
            );
            this.sound.hit();
        }

        this.player.update(
            this.input,
            this.width,
            this.touchWalkX,
            this.touchActive
        );

        if (this.player.isGrounded && this.player.standingOn && !this.player.standingOn.broken) {
            const m = this.player.standingOn;
            this.player.x += m.deltaX;
            this.player.y = m.y - this.player.height;

            const hb = this.player.getHitbox();
            const feetY = hb.y + hb.height;
            const onPlatform = hb.x + hb.width > m.x + 4 &&
                hb.x < m.x + m.width - 4 &&
                Math.abs(feetY - m.y) < 14;

            if (!onPlatform) {
                this.player.leavePlatform();
            }
        }

        if (!this.player.isGrounded && this.player.vel.y > 0) {
            for (const m of this.mattresses) {
                if (m.broken) continue;
                const playerHB = this.player.getHitbox();

                if (playerHB.x < m.x + m.width &&
                    playerHB.x + playerHB.width > m.x &&
                    playerHB.y + playerHB.height >= m.y &&
                    playerHB.y + playerHB.height <= m.y + m.height + 12) {

                    this.player.landOn(m);
                    this.particles.emit(
                        m.x + m.width / 2,
                        m.y - this.cameraY,
                        m.color,
                        4,
                        { speed: 2 }
                    );
                    break;
                }
            }
        }

        for (const c of this.collectibles) {
            if (c.collected) continue;
            c.update(this.time);
            const ch = c.getHitbox();
            const playerHB = this.player.getHitbox();

            if (playerHB.x < ch.x + ch.width &&
                playerHB.x + playerHB.width > ch.x &&
                playerHB.y < ch.y + ch.height &&
                playerHB.y + playerHB.height > ch.y) {
                c.collected = true;
                this.collectItem(c);
            }
        }

        this.particles.update();

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
        if (this.mattresses.length > 0) {
            let highestY = Math.min(...this.mattresses.map(m => m.y));
            let guard = 0;
            while (highestY > topEdge - 350 && guard < 30) {
                const alt = this.getAltitudeFactor(highestY);
                highestY -= this.computePlatformGap(alt);
                this.addMattress(highestY, alt);
                guard++;
            }
        }

        this.collectibles = this.collectibles.filter(c => !c.collected && c.y - this.cameraY < this.height + 200);
        this.mattresses = this.mattresses.filter(m => m.y - this.cameraY < this.height + 200);

        if (this.player.y - this.cameraY > this.height + 100) {
            this.lives--;
            this.sound.hit();
            this.particles.emit(
                this.player.x + this.player.width / 2,
                this.player.y - this.cameraY + this.player.height,
                '#e17055',
                30,
                { speed: 8, shape: 'circle' }
            );

            if (this.lives <= 0) {
                this.gameOver();
            } else {
                const safeMat = this.mattresses
                    .filter(m => !m.broken && m.y > this.cameraY && m.y < this.cameraY + this.height)
                    .sort((a, b) => b.y - a.y)[0];

                if (safeMat) {
                    this.player.x = safeMat.x + safeMat.width / 2 - this.player.width / 2;
                    this.player.landOn(safeMat);
                    this.player.vel.x = 0;
                    this.player.invulnerable = 60;
                } else {
                    this.player.y = this.cameraY + this.height * 0.5;
                    this.player.leavePlatform();
                    this.player.vel.y = 0;
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
        this.particles.emit(
            item.x + item.width / 2,
            item.y - this.cameraY + item.height / 2,
            color,
            20,
            { speed: 6, shape: item.type === 'star' ? 'star' : 'circle', upward: 4 }
        );

        const comboEl = document.getElementById('combo');
        comboEl.classList.add('pulse');
        setTimeout(() => comboEl.classList.remove('pulse'), 150);
    }

    updateUI() {
        document.getElementById('score').textContent = this.score;
        const jumpsLeft = this.player.isGrounded
            ? this.player.maxJumps
            : Math.max(0, this.player.maxJumps - this.player.jumpsInAir);
        document.getElementById('combo').textContent = `x${this.combo} · ⬆${jumpsLeft}`;
        const hearts = '♥'.repeat(this.lives) + '♡'.repeat(Math.max(0, 3 - this.lives));
        document.getElementById('lives').textContent = hearts;

        const rankEl = document.getElementById('liveRank');
        if (rankEl && this.state === 'playing') {
            const rank = this.getLiveRank(this.score);
            rankEl.textContent = `#${rank}`;
        }
    }

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        this.drawBackground(ctx);

        for (const m of this.mattresses) {
            if (!m.broken) m.draw(ctx, this.cameraY, this.time);
        }
        for (const c of this.collectibles) {
            c.draw(ctx, this.cameraY, this.time);
        }
        this.particles.draw(ctx);
        this.player.draw(ctx, this.cameraY, this.time);
    }

    drawBackground(ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#050510');
        gradient.addColorStop(0.4, '#0a0a22');
        gradient.addColorStop(1, '#12123a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.strokeStyle = '#e63946';
        ctx.lineWidth = 0.6;
        const webOffset = this.cameraY * 0.15;
        for (let row = 0; row < 8; row++) {
            const baseY = ((row * 120 - webOffset) % (this.height + 200)) - 50;
            for (let col = 0; col < 6; col++) {
                const baseX = col * (this.width / 5);
                ctx.beginPath();
                ctx.moveTo(baseX, baseY);
                ctx.lineTo(baseX + 40, baseY + 80);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(baseX + 20, baseY + 40, 30, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.04;
        const offset = this.cameraY * 0.1;
        for (let i = 0; i < 12; i++) {
            const x = (i * 137 + 50) % this.width;
            const y = ((i * 193 + offset) % (this.height + 200)) - 100;
            const size = 25 + (i % 4) * 15;
            ctx.strokeStyle = i % 2 === 0 ? '#1a3b8e' : '#e63946';
            ctx.lineWidth = 1;
            ctx.strokeRect(x - size / 2, y - size / 4, size, size / 3);
        }
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 60; i++) {
            const x = (i * 97.3) % this.width;
            const y = ((i * 71.7 + this.cameraY * 0.05) % this.height);
            const size = (i % 3 === 0) ? 2 : 1;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
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

window.addEventListener('load', () => {
    new Game();
});
