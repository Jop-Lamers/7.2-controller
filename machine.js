const canvas = document.getElementById("machineCanvas");
const ctx = canvas.getContext("2d");

const connectionStatus = document.getElementById("connectionStatus");
const turnsStatus = document.getElementById("turnsStatus");
const newRoundButton = document.getElementById("newRoundButton");
const roundModal = document.getElementById("roundModal");
const roundModalMessage = document.getElementById("roundModalMessage");
const clawStatus = document.getElementById("clawStatus");
const positionStatus = document.getElementById("positionStatus");
const scoreStatus = document.getElementById("scoreStatus");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const FLOOR_Y = HEIGHT - 24;
const WALL_LEFT = 24;
const WALL_RIGHT = WIDTH - 24;
const PRIZE_BIN = {
  x: WALL_RIGHT - 200,
  y: FLOOR_Y - 150,
  width: 180,
  height: 130,
};

const controls = {
  left: false,
  right: false,
  up: false,
  down: false,
  axisX: 0,
  axisTarget: 0,
};

let lastNetworkSeenAt = 0;
let lastControllerId = "";
let networkStateInitialized = false;
const lastGrabSeqByController = Object.create(null);
const lastReleaseSeqByController = Object.create(null);
const API_STATE_URL = new URL("api/state.php", window.location.href).toString();

const claw = {
  x: WIDTH / 2,
  y: 78,
  speed: 820,
  minY: 70,
  maxY: HEIGHT - 150,
  open: true,
  fingerGap: 155,
  targetGap: 155,
  grabbedId: null,
  auto: null,
};

const gravity = 820;
const balls = [];
let score = 0;
let totalWonValue = 0;
const MAX_TURNS = 3;
const ROUND_COST = 30;
let turnsUsed = 0;
const INITIAL_BALL_COUNT = 30;

function updateTurnsStatus() {
  if (!turnsStatus) return;
  const turnsLeft = Math.max(0, MAX_TURNS - turnsUsed);
  turnsStatus.textContent = `Beurten over: ${turnsLeft}/${MAX_TURNS}`;
  turnsStatus.classList.toggle("is-empty", turnsLeft === 0);
  updateNewRoundButton();
}

function isRoundFinished() {
  // End the round only after the last turn is fully resolved:
  // no auto cycle running and no ball still hanging in the claw.
  return turnsUsed >= MAX_TURNS && !claw.auto && claw.grabbedId === null;
}

function canStartGrabTurn() {
  return turnsUsed < MAX_TURNS;
}

function consumeGrabTurn() {
  if (!canStartGrabTurn()) return false;
  turnsUsed += 1;
  updateTurnsStatus();
  return true;
}

function updateNewRoundButton() {
  if (!newRoundButton || !roundModal) return;

  const roundFinished = isRoundFinished();
  const canAfford = totalWonValue >= ROUND_COST;
  roundModal.hidden = !roundFinished;
  newRoundButton.disabled = !canAfford;

  if (document.body) {
    document.body.classList.toggle("is-round-modal-open", roundFinished);
  }

  if (!roundFinished) {
    newRoundButton.textContent = `Nieuwe ronde starten voor €${ROUND_COST}`;
    if (roundModalMessage) {
      roundModalMessage.textContent = "Je hebt 3 beurten gebruikt.";
    }
    return;
  }

  if (!canAfford) {
    newRoundButton.textContent = `Te weinig saldo voor €${ROUND_COST}`;
    if (roundModalMessage) {
      roundModalMessage.textContent = `Je saldo is €${totalWonValue}. Je hebt €${ROUND_COST} nodig voor een nieuwe ronde.`;
    }
    return;
  }

  if (roundModalMessage) {
    roundModalMessage.textContent = `Je saldo is €${totalWonValue}. Start direct een nieuwe ronde voor €${ROUND_COST}.`;
  }
  newRoundButton.textContent = `Nieuwe ronde starten voor €${ROUND_COST}`;
}

function buyNewRound() {
  if (claw.auto || !isRoundFinished()) return;

  if (totalWonValue < ROUND_COST) {
    connectionStatus.textContent = `Te weinig saldo voor nieuwe ronde (€${ROUND_COST})`;
    updateNewRoundButton();
    return;
  }

  totalWonValue -= ROUND_COST;
  turnsUsed = 0;
  updateScoreStatus();
  updateTurnsStatus();
  connectionStatus.textContent = "Nieuwe ronde gestart";
}

function spawnBallPosition(radius) {
  let x = 0;
  let y = 0;
  let safe = false;

  while (!safe) {
    // Keep all initial spawns on the left/top side of the machine.
    x = WALL_LEFT + 60 + Math.random() * (WIDTH * 0.58 - WALL_LEFT - 60);
    y = 120 + Math.random() * 150;

    const withinPrizeX =
      x + radius >= PRIZE_BIN.x - 20 &&
      x - radius <= PRIZE_BIN.x + PRIZE_BIN.width + 20;
    const withinPrizeY = y + radius >= PRIZE_BIN.y - 120;

    // Keep initial balls away from the money bin so they do not score automatically at start.
    safe = !(withinPrizeX && withinPrizeY);
  }

  return { x, y };
}

for (let i = 0; i < INITIAL_BALL_COUNT; i += 1) {
  const radius = 16 + Math.random() * 10;
  const value = [5, 10, 20, 50][Math.floor(Math.random() * 4)];
  const spawn = spawnBallPosition(radius);
  balls.push({
    id: i,
    x: spawn.x,
    y: spawn.y,
    vx: (Math.random() - 0.5) * 24,
    vy: 0,
    radius,
    value,
    carried: false,
    color: value >= 50 ? "#f59e0b" : value >= 20 ? "#fbbf24" : "#fde68a",
  });
}

function getBallById(id) {
  return balls.find((item) => item.id === id) || null;
}

function updateScoreStatus() {
  if (scoreStatus) {
    scoreStatus.textContent = `Gewonnen: €${totalWonValue} (${score})`;
  }
  updateNewRoundButton();
}

function isInsidePrizeBin(ball) {
  const r = ball.radius;

  // Use overlap checks so fast-falling balls and edge drops still count.
  return (
    ball.x + r >= PRIZE_BIN.x &&
    ball.x - r <= PRIZE_BIN.x + PRIZE_BIN.width &&
    ball.y + r >= PRIZE_BIN.y &&
    ball.y - r <= PRIZE_BIN.y + PRIZE_BIN.height
  );
}

function isEligibleForPrize(ball) {
  return ball.carried && isInsidePrizeBin(ball);
}

function collectPrize(ballId) {
  const index = balls.findIndex((item) => item.id === ballId);
  if (index === -1) return;
  totalWonValue += balls[index].value;
  balls.splice(index, 1);
  score += 1;
  updateScoreStatus();

  if (scoreStatus) {
    scoreStatus.classList.remove("is-jackpot");
    // Force reflow so animation can retrigger on consecutive wins.
    void scoreStatus.offsetWidth;
    scoreStatus.classList.add("is-jackpot");
  }
}

function releaseGrab() {
  if (claw.grabbedId === null) return;
  const grabbed = getBallById(claw.grabbedId);
  if (grabbed) {
    grabbed.vx = 0;
    grabbed.vy = 0;

    // Only count if the ball was actually carried by the claw.
    if (isEligibleForPrize(grabbed)) {
      const wonId = grabbed.id;
      claw.grabbedId = null;
      collectPrize(wonId);
      return;
    }
  }
  claw.grabbedId = null;
}

function tryGrab() {
  if (claw.grabbedId !== null || claw.open) return;

  // Only allow grabbing when the claw is low enough (more manual/fair-like control).
  if (claw.y < HEIGHT - 190) return;

  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const ball of balls) {
    const dx = ball.x - claw.x;
    const dy = ball.y - (claw.y + 48);
    const dist = Math.hypot(dx, dy);
    const reach = ball.radius + claw.fingerGap * 0.28 + 6;
    if (dist < reach && dist < bestDist) {
      best = ball;
      bestDist = dist;
    }
  }

  if (best) {
    claw.grabbedId = best.id;
    best.carried = true;
    best.vx = 0;
    best.vy = 0;
  }
}

function setOpenState(open) {
  claw.open = open;
  claw.targetGap = open ? 155 : 52;
  if (open) {
    releaseGrab();
  } else {
    tryGrab();
  }
}

function startDropAutomation() {
  if (claw.auto) return false;
  if (!consumeGrabTurn()) {
    connectionStatus.textContent = "Geen beurten meer";
    return false;
  }
  claw.auto = {
    phase: "down",
    closeTimer: 0,
  };
  return true;
}

function handleControlMessage(msg) {
  if (!msg || msg.type !== "control") return;

  connectionStatus.textContent = "Controller verbonden";
  console.log("[Machine] BroadcastChannel message:", msg.action, msg.pressed);

  if (msg.action === "open" && msg.pressed) {
    setOpenState(true);
    return;
  }

  if (msg.action === "close" && msg.pressed) {
    setOpenState(false);
    return;
  }

  if (msg.action === "release" && msg.pressed) {
    setOpenState(true);
    return;
  }

  if ((msg.action === "drop" || msg.action === "grab") && msg.pressed) {
    if (claw.auto) return;

    // Same button behavior as a fair machine:
    // - If currently holding a prize, release it.
    // - Otherwise run one pick cycle (down -> close -> up).
    if (claw.grabbedId !== null) {
      setOpenState(true);
      return;
    }

    if (!claw.open) {
      setOpenState(true);
      return;
    }

    startDropAutomation();
    return;
  }

  if (msg.action === "axis") {
    const axisVal = Math.max(-1, Math.min(1, Number(msg.pressed) || 0));
    controls.axisTarget = axisVal;
    console.log("[Machine] Axis set via BroadcastChannel:", axisVal);
    return;
  }

  if (msg.action in controls) {
    controls[msg.action] = Boolean(msg.pressed);
  }
}

let channel = null;
if ("BroadcastChannel" in window) {
  channel = new BroadcastChannel("grijpmachine-control");
  channel.onmessage = (event) => handleControlMessage(event.data);
}

window.addEventListener("storage", (event) => {
  if (event.key !== "grijpmachine-control" || !event.newValue) return;
  try {
    handleControlMessage(JSON.parse(event.newValue));
  } catch {
    // Ignore malformed fallback messages.
  }
});

async function pollNetworkState() {
  try {
    const response = await fetch(`${API_STATE_URL}?t=${Date.now()}`, {
      cache: "no-store",
      method: "GET",
      credentials: "same-origin",
    });
    if (!response.ok) {
      console.warn("[Machine] API state error:", response.status);
      return;
    }

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      const text = await response.text();
      console.warn(
        "[Machine] JSON parse failed. Response:",
        text.substring(0, 200),
      );
      return;
    }

    const axis = Math.max(-1, Math.min(1, Number(data.axis) || 0));
    const grabSeq = Number(data.grabSeq) || 0;
    const releaseSeq = Number(data.releaseSeq) || 0;
    const controllerId = String(data.controllerId || "");

    controls.axisTarget = axis;

    if (!networkStateInitialized) {
      lastGrabSeqByController[controllerId] = grabSeq;
      lastReleaseSeqByController[controllerId] = releaseSeq;
      lastControllerId = controllerId;
      lastNetworkSeenAt = performance.now();
      networkStateInitialized = true;
      return;
    }

    if (!(controllerId in lastGrabSeqByController)) {
      lastGrabSeqByController[controllerId] = grabSeq;
    }
    if (!(controllerId in lastReleaseSeqByController)) {
      lastReleaseSeqByController[controllerId] = releaseSeq;
    }

    let prevGrabSeq = lastGrabSeqByController[controllerId];
    let prevReleaseSeq = lastReleaseSeqByController[controllerId];

    // Controller counters can reset after refresh. Re-baseline per controller.
    if (grabSeq < prevGrabSeq) {
      prevGrabSeq = grabSeq;
      lastGrabSeqByController[controllerId] = grabSeq;
    }
    if (releaseSeq < prevReleaseSeq) {
      prevReleaseSeq = releaseSeq;
      lastReleaseSeqByController[controllerId] = releaseSeq;
    }

    if (grabSeq > prevGrabSeq) {
      lastGrabSeqByController[controllerId] = grabSeq;
      console.log("[Machine] Grab triggered via network, seq=", grabSeq);
      // If a ball is already held, this click is the user's release action.
      // Do not restart the auto cycle, otherwise the claw immediately grabs again.
      if (claw.grabbedId === null && claw.open) {
        startDropAutomation();
      }
    }

    if (releaseSeq > prevReleaseSeq) {
      lastReleaseSeqByController[controllerId] = releaseSeq;
      console.log("[Machine] Release triggered via network, seq=", releaseSeq);
      setOpenState(true);
    }

    lastControllerId = controllerId;
    lastNetworkSeenAt = performance.now();
  } catch (err) {
    console.warn("[Machine] Network poll failed:", err.message);
  }
}

setInterval(pollNetworkState, 30);
pollNetworkState();
updateTurnsStatus();
if (newRoundButton) {
  newRoundButton.addEventListener("click", buyNewRound);
}

function updateClaw(dt) {
  const fallbackHorizontal = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
  const horizontal =
    Math.abs(controls.axisTarget) > 0.02
      ? controls.axisTarget
      : fallbackHorizontal;
  const vertical = (controls.down ? 1 : 0) - (controls.up ? 1 : 0);

  if (Math.abs(horizontal) > 0.02 && Math.random() < 0.05) {
    console.log(
      "[Machine] Claw movement - axisTarget:",
      controls.axisTarget.toFixed(2),
      "horizontal:",
      horizontal.toFixed(2),
    );
  }

  let dx = 0;
  let dy = vertical * claw.speed * dt;

  if (Math.abs(horizontal) > 0.02) {
    const travelCenter = (WALL_LEFT + WALL_RIGHT) / 2;
    const travelRange = (WALL_RIGHT - WALL_LEFT) / 2 - 18;
    const targetX = travelCenter + horizontal * travelRange;
    claw.x += (targetX - claw.x) * Math.min(1, dt * 40);
  } else {
    dx = 0;
  }

  if (claw.auto) {
    if (claw.auto.phase === "down") {
      dy = claw.speed * dt;
      dx = 0;
      if (claw.y >= claw.maxY - 1) {
        setOpenState(false);
        claw.auto.phase = "close-wait";
        claw.auto.closeTimer = 0.32;
      }
    } else if (claw.auto.phase === "close-wait") {
      dx = 0;
      dy = 0;
      claw.auto.closeTimer -= dt;
      if (claw.auto.closeTimer <= 0) {
        claw.auto.phase = "up";
      }
    } else if (claw.auto.phase === "up") {
      dx = 0;
      dy = -claw.speed * dt;
      if (claw.y <= claw.minY + 1) {
        // Keep holding when a ball is grabbed so player can drag it to the prize bin.
        if (claw.grabbedId === null) {
          setOpenState(true);
        }
        claw.auto = null;
      }
    }
  }

  claw.x += dx;
  claw.y += dy;

  claw.x = Math.max(WALL_LEFT + 6, Math.min(WALL_RIGHT - 6, claw.x));
  claw.y = Math.max(claw.minY, Math.min(claw.maxY, claw.y));

  if (positionStatus) {
    const normalized = (claw.x - WALL_LEFT) / (WALL_RIGHT - WALL_LEFT);
    if (normalized < 0.33) {
      positionStatus.textContent = "Positie: links";
    } else if (normalized > 0.66) {
      positionStatus.textContent = "Positie: rechts";
    } else {
      positionStatus.textContent = "Positie: midden";
    }
  }

  claw.fingerGap += (claw.targetGap - claw.fingerGap) * Math.min(1, dt * 16);

  if (!claw.open) {
    tryGrab();
  }

  const grabbed = getBallById(claw.grabbedId);
  if (grabbed) {
    grabbed.x = claw.x;
    grabbed.y = claw.y + 60;
    grabbed.vx = 0;
    grabbed.vy = 0;
  }

  if (clawStatus) {
    if (claw.grabbedId !== null) {
      clawStatus.textContent = "Klauw: dicht (prijs vast)";
    } else {
      clawStatus.textContent = claw.open ? "Klauw: open" : "Klauw: dicht";
    }
  }

  const networkAge = performance.now() - lastNetworkSeenAt;
  if (networkAge < 2500 && lastControllerId) {
    connectionStatus.textContent = "Controller verbonden (netwerk)";
  } else if (networkAge < 2500) {
    connectionStatus.textContent = "Controller verbonden";
  } else {
    connectionStatus.textContent = "Wacht op controller...";
  }

  if (positionStatus) {
    positionStatus.textContent = `Positie: ${claw.x < WIDTH * 0.33 ? "links" : claw.x > WIDTH * 0.66 ? "rechts" : "midden"} | axis: ${controls.axisTarget.toFixed(2)}`;
  }

  updateNewRoundButton();
}

function updateBalls(dt) {
  const binTop = PRIZE_BIN.y + 16;
  const binLeft = PRIZE_BIN.x;
  const binRight = PRIZE_BIN.x + PRIZE_BIN.width;
  const rightBlockTop = PRIZE_BIN.y - 120;

  for (const ball of balls) {
    if (ball.id === claw.grabbedId) continue;

    ball.vy += gravity * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Score only if the ball was carried by the claw before entering the bin.
    if (isEligibleForPrize(ball)) {
      collectPrize(ball.id);
      continue;
    }

    if (ball.x - ball.radius < WALL_LEFT) {
      ball.x = WALL_LEFT + ball.radius;
      ball.vx *= -0.55;
    }

    if (ball.x + ball.radius > WALL_RIGHT) {
      ball.x = WALL_RIGHT - ball.radius;
      ball.vx *= -0.55;
    }

    if (ball.y + ball.radius > FLOOR_Y) {
      ball.y = FLOOR_Y - ball.radius;
      ball.vy *= -0.35;
      ball.vx *= 0.96;
      if (Math.abs(ball.vy) < 6) ball.vy = 0;
    }

    // Hard no-pass wall: balls cannot move to the right of the money bin region.
    if (
      ball.y + ball.radius >= rightBlockTop &&
      ball.x + ball.radius > binRight
    ) {
      ball.x = binRight - ball.radius;
      ball.vx = Math.min(0, ball.vx) * -0.45;
    }

    // Left barrier of the money bin: balls should not slide past this side.
    if (
      ball.y + ball.radius >= binTop &&
      ball.x - ball.radius < binLeft &&
      ball.x + ball.radius > binLeft
    ) {
      ball.x = binLeft - ball.radius;
      ball.vx = -Math.abs(ball.vx) * 0.45;
    }
  }

  for (let i = 0; i < balls.length; i += 1) {
    for (let j = i + 1; j < balls.length; j += 1) {
      const a = balls[i];
      const b = balls[j];
      if (a.id === claw.grabbedId || b.id === claw.grabbedId) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = a.radius + b.radius;
      if (dist === 0 || dist >= minDist) continue;

      const overlap = minDist - dist;
      const nx = dx / dist;
      const ny = dy / dist;

      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;

      const relativeVx = b.vx - a.vx;
      const relativeVy = b.vy - a.vy;
      const impulse = (relativeVx * nx + relativeVy * ny) * 0.35;
      a.vx += impulse * nx;
      a.vy += impulse * ny;
      b.vx -= impulse * nx;
      b.vy -= impulse * ny;
    }
  }
}

function drawMachine() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(WALL_LEFT - 10, 20, 20, FLOOR_Y - 10);
  ctx.fillRect(WALL_RIGHT - 10, 20, 20, FLOOR_Y - 10);
  ctx.fillRect(WALL_LEFT - 10, FLOOR_Y, WALL_RIGHT - WALL_LEFT + 20, 20);

  ctx.fillStyle = "#475569";
  ctx.fillRect(WALL_LEFT, 20, WALL_RIGHT - WALL_LEFT, 18);

  // Open-top money basket at bottom-right.
  ctx.fillStyle = "#fef3c7";
  ctx.fillRect(
    PRIZE_BIN.x,
    PRIZE_BIN.y + 16,
    PRIZE_BIN.width,
    PRIZE_BIN.height - 16,
  );
  ctx.fillStyle = "#92400e";
  ctx.fillRect(PRIZE_BIN.x - 8, PRIZE_BIN.y + 16, 8, PRIZE_BIN.height - 16);
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(PRIZE_BIN.x - 10, PRIZE_BIN.y + 10, PRIZE_BIN.width + 20, 8);
  ctx.strokeStyle = "#92400e";
  ctx.lineWidth = 7;
  ctx.strokeRect(
    PRIZE_BIN.x,
    PRIZE_BIN.y + 16,
    PRIZE_BIN.width,
    PRIZE_BIN.height - 16,
  );
  ctx.fillStyle = "#7c2d12";
  ctx.font = "bold 16px Trebuchet MS";
  ctx.fillText("GELDBAK", PRIZE_BIN.x + 42, PRIZE_BIN.y + 36);

  for (const ball of balls) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(120, 53, 15, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#7c2d12";
    ctx.font = `bold ${Math.max(12, ball.radius * 0.9)}px Trebuchet MS`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`€${ball.value}`, ball.x, ball.y + 0.5);
  }

  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";

  const railY = 38;
  const bodyY = claw.y - 20;

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(claw.x, railY);
  ctx.lineTo(claw.x, bodyY);
  ctx.stroke();

  ctx.fillStyle = "#334155";
  ctx.fillRect(claw.x - 30, bodyY - 14, 60, 28);

  const leftFingerX = claw.x - claw.fingerGap / 2;
  const rightFingerX = claw.x + claw.fingerGap / 2;
  const fingerTop = bodyY + 14;
  const fingerBottom = claw.y + 76;

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 9;

  ctx.beginPath();
  ctx.moveTo(leftFingerX, fingerTop);
  ctx.lineTo(leftFingerX - 18, fingerBottom);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(rightFingerX, fingerTop);
  ctx.lineTo(rightFingerX + 18, fingerBottom);
  ctx.stroke();
}

let previous = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - previous) / 1000);
  previous = now;

  updateClaw(dt);
  updateBalls(dt);
  drawMachine();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
