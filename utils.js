// Полифилл для roundRect
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
        if (!Array.isArray(radii)) radii = [radii, radii, radii, radii];
        const [tl, tr, br, bl] = radii.map(r => Math.min(r || 0, w/2, h/2));
        this.moveTo(x + tl, y);
        this.lineTo(x + w - tr, y);
        this.quadraticCurveTo(x + w, y, x + w, y + tr);
        this.lineTo(x + w, y + h - br);
        this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
        this.lineTo(x + bl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - bl);
        this.lineTo(x, y + tl);
        this.quadraticCurveTo(x, y, x + tl, y);
        this.closePath();
        return this;
    };
}

// Удаление белого фона
function removeWhiteBackground(img, options = {}) {
    const threshold = options.threshold || 235;
    const smoothness = options.smoothness || 25;

    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        if (canvas.width === 0 || canvas.height === 0) {
            resolve(img);
            return;
        }

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a === 0) continue;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const saturation = max - min;

            if (max > threshold && saturation < 40) {
                data[i + 3] = 0;
            } else if (max > threshold - smoothness && saturation < 40) {
                const factor = (max - (threshold - smoothness)) / smoothness;
                data[i + 3] = Math.round(a * (1 - factor));
            }
        }

        ctx.putImageData(imageData, 0, 0);

        const newImg = new Image();
        newImg.onload = () => resolve(newImg);
        newImg.onerror = () => resolve(img);
        newImg.src = canvas.toDataURL();
    });
}

class Vector {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    add(v) { return new Vector(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector(this.x - v.x, this.y - v.y); }
    scale(s) { return new Vector(this.x * s, this.y * s); }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    clone() { return new Vector(this.x, this.y); }
}

class Particle {
    constructor(x, y, color, options = {}) {
        this.pos = new Vector(x, y);
        this.vel = new Vector(
            (Math.random() - 0.5) * (options.speed || 6),
            (Math.random() - 0.5) * (options.speed || 6) - (options.upward || 2)
        );
        this.color = color;
        this.size = options.size || Math.random() * 4 + 2;
        this.life = options.life || 1.0;
        this.decay = options.decay || 0.02;
        this.gravity = options.gravity || 0.1;
        this.shape = options.shape || 'circle';
    }

    update() {
        this.vel.y += this.gravity;
        this.pos = this.pos.add(this.vel);
        this.life -= this.decay;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;

        if (this.shape === 'star') {
            this.drawStar(ctx, this.pos.x, this.pos.y, 5, this.size, this.size / 2);
        } else if (this.shape === 'square') {
            ctx.fillRect(this.pos.x - this.size/2, this.pos.y - this.size/2, this.size, this.size);
        } else {
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, this.size, 0, Math.PI * 2);
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
        ctx.fill();
    }

    isDead() { return this.life <= 0; }
}

class ParticleSystem {
    constructor() { this.particles = []; }

    emit(x, y, color, count = 10, options = {}) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color, options));
        }
    }

    update() {
        this.particles = this.particles.filter(p => !p.isDead());
        this.particles.forEach(p => p.update());
    }

    draw(ctx) { this.particles.forEach(p => p.draw(ctx)); }
}

class SoundEngine {
    constructor() { this.ctx = null; this.initialized = false; }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) { console.warn('Audio not supported'); }
    }

    playTone(freq, duration = 0.1, type = 'sine', volume = 0.15) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + duration);
    }

    jump() { this.playTone(520, 0.12, 'sine', 0.1); }
    superJump() { this.playTone(780, 0.2, 'sine', 0.12); }
    collect() { this.playTone(880, 0.15, 'triangle', 0.08); }
    combo() { this.playTone(1200, 0.2, 'sine', 0.1); }
    hit() { this.playTone(150, 0.3, 'sawtooth', 0.1); }
    gameOver() {
        this.playTone(400, 0.3, 'square', 0.1);
        setTimeout(() => this.playTone(300, 0.3, 'square', 0.1), 200);
        setTimeout(() => this.playTone(200, 0.5, 'square', 0.1), 400);
    }
}

function randomRange(min, max) { return Math.random() * (max - min) + min; }
function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function lightenColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
    const b = Math.min(255, (num & 0x0000FF) + amount);
    return `rgb(${r},${g},${b})`;
}
