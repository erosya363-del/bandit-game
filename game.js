const CONFIG = {
    gravity: 0.45,
    jumpForce: -13,
    superJumpForce: -20,
    moveSpeed: 6,
    friction: 0.88,
    maxFallSpeed: 15,
    mattressGap: 120,          // будет переопределяться при выборе сложности
    mattressMinWidth: 80,
    mattressMaxWidth: 160,
    collectibleSpawnRate: 0.35,
    cameraSmooth: 0.08,
    difficultyIncrease: 0.0003, // будет переопределяться
    colors: {
        player: { skin: '#fdbcb4', hair: '#4a3728', shirt: '#6c5ce7', pants: '#2d3436' },
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

// ---------- Вспомогательные классы ----------
class Mattress { /* без изменений, только для краткости копируем оригинал */ }
class Collectible { /* оригинал */ }
class Player { /* оригинал */ }

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
        this.bestScore = parseInt(localStorage.getItem('bandit_best') || '0');
        this.difficulty = 1;
        this.time = 0;
        this.cameraY = 0;
        this.targetCameraY = 0;

        // ---- новые поля ----
        this.playerName = '';
        this.difficultyMode = 'medium';  // выбранный режим

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

    // Инициализация игры с текущими настройками сложности
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
        // обновляем таблицу рекордов на стартовом экране
        this.updateLeaderboardDisplay('leaderboardList');
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

    // ---------- РАБОТА С РЕКОРДАМИ ----------
    loadLeaderboard() {
        const data = localStorage.getItem('bandit_leaderboard');
        if (data) {
            try { return JSON.parse(data); } catch { return []; }
        }
        return [];
    }

    saveLeaderboard(lb) {
        localStorage.setItem('bandit_leaderboard', JSON.stringify(lb));
    }

    addScore(name, score) {
        let lb = this.loadLeaderboard();
        lb.push({ name, score, date: new Date().toISOString() });
        lb.sort((a, b) => b.score - a.score);
        if (lb.length > 10) lb = lb.slice(0, 10);
        this.saveLeaderboard(lb);
        return lb;
    }

    getRank(score) {
        const lb = this.loadLeaderboard();
        // временно добавляем текущий счёт для определения места
        const all = [...lb, { score }];
        all.sort((a, b) => b.score - a.score);
        return all.findIndex(item => item.score === score) + 1;
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
            const isCurrent = (this.state === 'gameOver' && entry.score === this.score && entry.name === this.playerName);
            html += `
                <div class="leaderboard-item ${isCurrent ? 'current' : ''}">
                    <span><span class="rank">#${rank}</span><span class="name">${escapeHtml(entry.name)}</span></span>
                    <span class="score">${entry.score}</span>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    // ---------- НАСТРОЙКА СОБЫТИЙ ----------
    setupEvents() {
        window.addEventListener('resize', () => this.resize());

        // Клавиатура
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

        // Кнопки старта и рестарта
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.restart());

        // Загрузка аватара (оригинальный код)
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

        // ---------- НОВЫЕ ОБРАБОТЧИКИ ----------
        // Выбор сложности
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.difficultyMode = btn.dataset.diff;
            });
        });

        // Кнопка "Рекорды" на стартовом экране (показать/скрыть таблицу)
        const leaderboardBlock = document.getElementById('leaderboard');
        document.getElementById('showLeaderboardBtn').addEventListener('click', () => {
            if (leaderboardBlock.style.display === 'none') {
                leaderboardBlock.style.display = 'block';
                this.updateLeaderboardDisplay('leaderboardList');
            } else {
                leaderboardBlock.style.display = 'none';
            }
        });

        // Мобильные кнопки (оригинал)
        this.setupMobileControls();
    }

    setupMobileControls() {
        // ... (оригинальный код, без изменений) ...
        // Для краткости пропускаем, но в реальном проекте нужно вставить полный код.
        // Убедитесь, что он присутствует.
    }

    // ---------- УПРАВЛЕНИЕ ИГРОЙ ----------
    startGame() {
        // Получаем имя
        const nameInput = document.getElementById('playerName');
        this.playerName = nameInput.value.trim() || 'Аноним';

        // Применяем выбранную сложность
        const mode = CONFIG.difficultyModes[this.difficultyMode] || CONFIG.difficultyModes.medium;
        CONFIG.mattressGap = mode.gap;
        CONFIG.difficultyIncrease = mode.increase;
        CONFIG.superJumpForce = mode.superJump;

        this.sound.init();
        this.state = 'playing';
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');

        // Скрываем таблицу рекордов на старте
        document.getElementById('leaderboard').style.display = 'none';

        const controls = document.getElementById('mobileControls');
        if (controls) controls.style.display = this.isMobile ? 'flex' : 'none';

        // Переинициализируем игру с новыми параметрами
        this.init();
    }

    restart() {
        // При рестарте имя и сложность сохраняются из предыдущего запуска
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

        // Обновляем личный рекорд (bandit_best)
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('bandit_best', this.bestScore.toString());
        }

        // Сохраняем в таблицу рекордов
        const leaderboard = this.addScore(this.playerName, this.score);

        // Отображаем финальный счёт и рекорд
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('bestScore').textContent = this.bestScore;

        // Отображаем таблицу рекордов на экране Game Over
        this.updateLeaderboardDisplay('gameOverLeaderboardList');

        document.getElementById('gameOverScreen').classList.remove('hidden');

        const controls = document.getElementById('mobileControls');
        if (controls) controls.style.display = 'none';
    }

    // ---------- ИГРОВОЙ ЦИКЛ (update, draw) ----------
    update() {
        if (this.state !== 'playing') return;

        this.time += 0.016;
        this.difficulty += CONFIG.difficultyIncrease;

        this.player.update(this.input, this.width);
        this.player.onGround = false;

        // Столкновения с матрасами (оригинал)
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

        // Сбор предметов
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

        // Камера
        const playerScreenY = this.player.y - this.cameraY;
        if (playerScreenY < this.height * 0.4) {
            this.targetCameraY = this.player.y - this.height * 0.4;
        }
        this.cameraY += (this.targetCameraY - this.cameraY) * CONFIG.cameraSmooth;

        // Начисление очков за подъём
        if (this.player.y < this.highestY) {
            const gained = Math.floor((this.highestY - this.player.y) * 0.1);
            this.score += gained * this.combo;
            this.highestY = this.player.y;
        }

        // Комбо
        if (this.comboTimer > 0) this.comboTimer--;
        else if (this.combo > 1) this.combo = 1;

        // Генерация новых матрасов (исправляем – убираем break)
        const topEdge = this.cameraY - 100;
        const highestMattress = Math.min(...this.mattresses.map(m => m.y));
        while (highestMattress > topEdge - 300) {
            this.addMattress(highestMattress - CONFIG.mattressGap / this.difficulty);
        }

        // Очистка устаревших объектов
        this.mattresses = this.mattresses.filter(m => m.y - this.cameraY < this.height + 200);
        this.collectibles = this.collectibles.filter(c => !c.collected && c.y - this.cameraY < this.height + 200);

        this.particles.update();

        // Падение вниз
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
        // ... (оригинал) ...
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

// ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ----------
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Запуск игры
window.addEventListener('load', () => {
    new Game();
});
