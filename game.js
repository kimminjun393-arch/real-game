const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let client, room, isHost, gameActive = false;
let shakeTime = 0; 

// 물리 및 상태 객체 (기본 속도 4로 낮추고 baseSpeed 기억)
const paddleSpeed = 9;
const p1 = { x: 30, y: 250, w: 15, h: 100, score: 0, color: "#0ff" }; 
const p2 = { x: 955, y: 250, w: 15, h: 100, score: 0, color: "#f0f" }; 
const ball = { x: 500, y: 300, r: 12, dx: 4, dy: 4, baseSpeed: 4, color: "#fff" }; 

let particles = [];
let trails = [];

const keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

const uiContainer = document.getElementById("ui-container");
const scoreBoard = document.getElementById("score-board");
const statusEl = document.getElementById("status");
const btnHost = document.getElementById("btn-host");
const btnGuest = document.getElementById("btn-guest");

btnHost.onclick = () => startGame(true);
btnGuest.onclick = () => startGame(false);

// 버튼 임시 비활성화
btnHost.style.opacity = "0.5"; btnGuest.style.opacity = "0.5";
btnHost.disabled = true; btnGuest.disabled = true;

// ==========================================
// 백그라운드 서버 사전 연결
// ==========================================
statusEl.innerText = "서버망 사전 구축 중... 📡";
client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt'); 

client.on('connect', () => {
    statusEl.innerText = "서버 연결 완료! 바로 접속 가능 🟢";
    statusEl.style.color = "#0f0";
    btnHost.style.opacity = "1"; btnGuest.style.opacity = "1";
    btnHost.disabled = false; btnGuest.disabled = false;
});

client.on('message', (topic, message) => {
    const data = JSON.parse(message.toString());
    
    if (isHost && topic === room + '/guest') {
        p2.y = data.p2y; 
    } else if (!isHost && topic === room + '/host') {
        p1.y = data.p1y;
        ball.dx = data.bdx;
        ball.dy = data.bdy;
        
        if (Math.abs(ball.x - data.bx) > 25) {
            ball.x = data.bx; ball.y = data.by;
        }

        if (p1.score !== data.s1 || p2.score !== data.s2) {
            p1.score = data.s1; p2.score = data.s2;
            document.getElementById("score1").innerText = p1.score;
            document.getElementById("score2").innerText = p2.score;
            screenShake();
            createParticles(ball.x, ball.y, "#fff");
        }
    }
});
// ==========================================

function createParticles(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: x, y: y, vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15,
            life: 1.0, color: color
        });
    }
}

function screenShake() { shakeTime = 12; }

function startGame(hostRole) {
    const roomName = document.getElementById("roomInput").value.trim();
    if (!roomName) return alert("방 이름을 입력하세요!");

    isHost = hostRole;
    room = "hq-neon-smash/" + roomName;
    
    client.subscribe(room + '/host');
    client.subscribe(room + '/guest');
    
    uiContainer.style.display = "none";
    scoreBoard.style.display = "block";
    canvas.style.display = "block";
    gameActive = true;
    
    requestAnimationFrame(gameLoop);

    setInterval(() => {
        if (!gameActive) return;
        if (isHost) {
            client.publish(room + '/host', JSON.stringify({ p1y: p1.y, bx: ball.x, by: ball.y, bdx: ball.dx, bdy: ball.dy, s1: p1.score, s2: p2.score }));
        } else {
            client.publish(room + '/guest', JSON.stringify({ p2y: p2.y }));
        }
    }, 1000/20);
}

// 득점 시 기본 속도로 완벽 리셋
function resetBall() {
    ball.x = canvas.width / 2; ball.y = canvas.height / 2;
    ball.dx = (Math.random() > 0.5 ? 1 : -1) * ball.baseSpeed;
    ball.dy = (Math.random() > 0.5 ? 1 : -1) * ball.baseSpeed;
}

function updatePhysics() {
    ball.x += ball.dx; ball.y += ball.dy;

    if (ball.y - ball.r < 0 || ball.y + ball.r > canvas.height) {
        ball.dy *= -1; createParticles(ball.x, ball.y, "#ffeb3b");
    }

    // 패들에 닿을 때마다 5%씩 곱연산으로 가속!
    if (ball.x - ball.r < p1.x + p1.w && ball.y > p1.y && ball.y < p1.y + p1.h) {
        ball.dx = Math.abs(ball.dx) * 1.05; 
        ball.dy *= 1.05;
        ball.x = p1.x + p1.w + ball.r; 
        createParticles(ball.x, ball.y, p1.color); screenShake();
    }

    if (ball.x + ball.r > p2.x && ball.y > p2.y && ball.y < p2.y + p2.h) {
        ball.dx = -Math.abs(ball.dx) * 1.05; 
        ball.dy *= 1.05;
        ball.x = p2.x - ball.r;
        createParticles(ball.x, ball.y, p2.color); screenShake();
    }

    if (ball.x < 0) { p2.score++; document.getElementById("score2").innerText = p2.score; screenShake(); resetBall(); } 
    else if (ball.x > canvas.width) { p1.score++; document.getElementById("score1").innerText = p1.score; screenShake(); resetBall(); }
}

function gameLoop() {
    if (keys["ArrowUp"] || keys["w"]) {
        if (isHost && p1.y > 0) p1.y -= paddleSpeed;
        if (!isHost && p2.y > 0) p2.y -= paddleSpeed;
    }
    if (keys["ArrowDown"] || keys["s"]) {
        if (isHost && p1.y < canvas.height - p1.h) p1.y += paddleSpeed;
        if (!isHost && p2.y < canvas.height - p2.h) p2.y += paddleSpeed;
    }

    if (isHost) { updatePhysics(); } 
    else {
        ball.x += ball.dx; ball.y += ball.dy;
        if (ball.y - ball.r < 0 || ball.y + ball.r > canvas.height) ball.dy *= -1;
    }

    trails.push({ x: ball.x, y: ball.y, life: 1.0 });
    if (trails.length > 15) trails.shift();

    ctx.save();
    if (shakeTime > 0) {
        const dx = (Math.random() - 0.5) * 10; const dy = (Math.random() - 0.5) * 10;
        ctx.translate(dx, dy); shakeTime--;
    }

    ctx.fillStyle = "rgba(5, 5, 8, 0.4)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    for (let i = 0; i < canvas.height; i += 40) ctx.fillRect(canvas.width / 2 - 2, i, 4, 20);

    trails.forEach((t, i) => {
        t.life -= 0.05;
        ctx.beginPath(); ctx.arc(t.x, t.y, ball.r * (i / trails.length), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${t.life * 0.5})`; ctx.fill();
    });

    ctx.shadowBlur = 20; 
    ctx.shadowColor = p1.color; ctx.fillStyle = p1.color; ctx.fillRect(p1.x, p1.y, p1.w, p1.h);
    ctx.shadowColor = p2.color; ctx.fillStyle = p2.color; ctx.fillRect(p2.x, p2.y, p2.w, p2.h);
    ctx.shadowColor = ball.color; ctx.fillStyle = ball.color; 
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2); ctx.fill();

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.05;
        if (p.life <= 0) particles.splice(i, 1);
        else {
            ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life; ctx.fillRect(p.x, p.y, 4, 4); ctx.globalAlpha = 1.0;
        }
    }

    ctx.restore();
    requestAnimationFrame(gameLoop);
}
