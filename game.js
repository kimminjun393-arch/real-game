const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let client, room, isHost, gameActive = false;
let shakeTime = 0; // 화면 흔들림 지속 시간

// 물리 및 상태 객체
const paddleSpeed = 9;
const p1 = { x: 30, y: 250, w: 15, h: 100, score: 0, color: "#0ff" }; 
const p2 = { x: 955, y: 250, w: 15, h: 100, score: 0, color: "#f0f" }; 
const ball = { x: 500, y: 300, r: 12, dx: 8, dy: 8, speed: 8, color: "#fff" }; 

// 이펙트 배열
let particles = [];
let trails = [];

// 키보드 입력
const keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

// UI 요소
const uiContainer = document.getElementById("ui-container");
const scoreBoard = document.getElementById("score-board");
const statusEl = document.getElementById("status");

// 버튼 이벤트 리스너 연결
document.getElementById("btn-host").onclick = () => startGame(true);
document.getElementById("btn-guest").onclick = () => startGame(false);

// [핵심 이펙트 1] 파티클(폭발) 생성기
function createParticles(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            life: 1.0, // 투명도
            color: color
        });
    }
}

// [핵심 이펙트 2] 화면 흔들림 발동
function screenShake() { shakeTime = 12; }

// 게임 시작 및 네트워크 연결
function startGame(hostRole) {
    const roomName = document.getElementById("roomInput").value.trim();
    if (!roomName) return alert("방 이름을 입력하세요!");

    isHost = hostRole;
    room = "hq-neon-smash/" + roomName;
    statusEl.innerText = "서버 접속 중...";

    client = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
    
    client.on('connect', () => {
        client.subscribe(room + '/host');
        client.subscribe(room + '/guest');
        
        uiContainer.style.display = "none";
        scoreBoard.style.display = "block";
        canvas.style.display = "block";
        gameActive = true;
        
        requestAnimationFrame(gameLoop);
    });

    client.on('message', (topic, message) => {
        const data = JSON.parse(message.toString());
        
        if (isHost && topic === room + '/guest') {
            p2.y = data.p2y; 
        } else if (!isHost && topic === room + '/host') {
            p1.y = data.p1y;
            ball.dx = data.bdx;
            ball.dy = data.bdy;
            
            // 데이터 동기화 및 충돌 예측 파티클
            if (Math.abs(ball.x - data.bx) > 25) {
                ball.x = data.bx; ball.y = data.by;
            }

            // 상대방 점수가 오르면 화면 흔들기
            if (p1.score !== data.s1 || p2.score !== data.s2) {
                p1.score = data.s1; p2.score = data.s2;
                document.getElementById("score1").innerText = p1.score;
                document.getElementById("score2").innerText = p2.score;
                screenShake();
                createParticles(ball.x, ball.y, "#fff");
            }
        }
    });

    setInterval(() => {
        if (!gameActive) return;
        if (isHost) {
            client.publish(room + '/host', JSON.stringify({ p1y: p1.y, bx: ball.x, by: ball.y, bdx: ball.dx, bdy: ball.dy, s1: p1.score, s2: p2.score }));
        } else {
            client.publish(room + '/guest', JSON.stringify({ p2y: p2.y }));
        }
    }, 1000/20);
}

function resetBall() {
    ball.x = canvas.width / 2; ball.y = canvas.height / 2;
    ball.dx = (Math.random() > 0.5 ? 1 : -1) * ball.speed;
    ball.dy = (Math.random() > 0.5 ? 1 : -1) * ball.speed;
}

function updatePhysics() {
    ball.x += ball.dx; ball.y += ball.dy;

    // 위아래 벽 충돌
    if (ball.y - ball.r < 0 || ball.y + ball.r > canvas.height) {
        ball.dy *= -1;
        createParticles(ball.x, ball.y, "#ffeb3b");
    }

    // P1 패들 충돌
    if (ball.x - ball.r < p1.x + p1.w && ball.y > p1.y && ball.y < p1.y + p1.h) {
        ball.dx = Math.abs(ball.dx) + 0.4; 
        ball.x = p1.x + p1.w + ball.r; 
        createParticles(ball.x, ball.y, p1.color);
        screenShake();
    }

    // P2 패들 충돌
    if (ball.x + ball.r > p2.x && ball.y > p2.y && ball.y < p2.y + p2.h) {
        ball.dx = -Math.abs(ball.dx) - 0.4;
        ball.x = p2.x - ball.r;
        createParticles(ball.x, ball.y, p2.color);
        screenShake();
    }

    // 점수 판정
    if (ball.x < 0) { 
        p2.score++; 
        document.getElementById("score2").innerText = p2.score;
        screenShake(); resetBall(); 
    } else if (ball.x > canvas.width) { 
        p1.score++; 
        document.getElementById("score1").innerText = p1.score;
        screenShake(); resetBall(); 
    }
}

// 메인 게임 루프
function gameLoop() {
    // 플레이어 조작
    if (keys["ArrowUp"] || keys["w"]) {
        if (isHost && p1.y > 0) p1.y -= paddleSpeed;
        if (!isHost && p2.y > 0) p2.y -= paddleSpeed;
    }
    if (keys["ArrowDown"] || keys["s"]) {
        if (isHost && p1.y < canvas.height - p1.h) p1.y += paddleSpeed;
        if (!isHost && p2.y < canvas.height - p2.h) p2.y += paddleSpeed;
    }

    if (isHost) {
        updatePhysics();
    } else {
        ball.x += ball.dx; ball.y += ball.dy;
        if (ball.y - ball.r < 0 || ball.y + ball.r > canvas.height) ball.dy *= -1;
    }

    // [핵심 이펙트 3] 공의 잔상(Trail) 저장
    trails.push({ x: ball.x, y: ball.y, life: 1.0 });
    if (trails.length > 15) trails.shift();

    // 화면 그리기 (흔들림 적용)
    ctx.save();
    if (shakeTime > 0) {
        const dx = (Math.random() - 0.5) * 10;
        const dy = (Math.random() - 0.5) * 10;
        ctx.translate(dx, dy);
        shakeTime--;
    }

    // 배경 (모션 블러 효과)
    ctx.fillStyle = "rgba(5, 5, 8, 0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 중앙 점선
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    for (let i = 0; i < canvas.height; i += 40) ctx.fillRect(canvas.width / 2 - 2, i, 4, 20);

    // 공 잔상 그리기
    trails.forEach((t, i) => {
        t.life -= 0.05;
        ctx.beginPath();
        ctx.arc(t.x, t.y, ball.r * (i / trails.length), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${t.life * 0.5})`;
        ctx.fill();
    });

    // 패들과 공
    ctx.shadowBlur = 20; 
    ctx.shadowColor = p1.color; ctx.fillStyle = p1.color; ctx.fillRect(p1.x, p1.y, p1.w, p1.h);
    ctx.shadowColor = p2.color; ctx.fillStyle = p2.color; ctx.fillRect(p2.x, p2.y, p2.w, p2.h);
    ctx.shadowColor = ball.color; ctx.fillStyle = ball.color; 
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2); ctx.fill();

    // 파티클 업데이트 및 그리기
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) {
            particles.splice(i, 1);
        } else {
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.fillRect(p.x, p.y, 4, 4);
            ctx.globalAlpha = 1.0;
        }
    }

    ctx.restore();
    requestAnimationFrame(gameLoop);
}
