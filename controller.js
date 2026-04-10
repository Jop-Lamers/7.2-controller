let channel = null;
if ("BroadcastChannel" in window) {
  channel = new BroadcastChannel("grijpmachine-control");
}

const controllerId = (() => {
  const key = "grijpmachine-controller-id";
  let existing = localStorage.getItem(key);
  if (existing) return existing;
  existing = `ctrl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(key, existing);
  return existing;
})();

const seqStateKey = `grijpmachine-seq-${controllerId}`;
function loadSeqState() {
  try {
    const raw = localStorage.getItem(seqStateKey);
    if (!raw) return { grabSeq: 0, releaseSeq: 0 };
    const parsed = JSON.parse(raw);
    return {
      grabSeq: Math.max(0, Number(parsed.grabSeq) || 0),
      releaseSeq: Math.max(0, Number(parsed.releaseSeq) || 0),
    };
  } catch {
    return { grabSeq: 0, releaseSeq: 0 };
  }
}

function saveSeqState() {
  const snapshot = {
    grabSeq: netState.grabSeq,
    releaseSeq: netState.releaseSeq,
  };
  localStorage.setItem(seqStateKey, JSON.stringify(snapshot));
}

const storedSeqState = loadSeqState();

const netState = {
  axis: 0,
  grabSeq: storedSeqState.grabSeq,
  releaseSeq: storedSeqState.releaseSeq,
};
const API_UPDATE_URL = new URL(
  "api/update-state.php",
  window.location.href,
).toString();

function send(action, pressed) {
  const message = {
    type: "control",
    action,
    pressed,
    timestamp: Date.now(),
  };

  if (channel) {
    channel.postMessage(message);
  }

  localStorage.setItem("grijpmachine-control", JSON.stringify(message));
  syncNetworkState(action, pressed);
}

function syncNetworkState(action, pressed) {
  if (action === "axis") {
    netState.axis = Math.max(-1, Math.min(1, Number(pressed) || 0));
  } else if (action === "grab" && pressed) {
    netState.grabSeq += 1;
    saveSeqState();
  } else if (action === "release" && pressed) {
    netState.releaseSeq += 1;
    saveSeqState();
  }

  queueNetworkPost();
}

async function postNetworkState() {
  try {
    const payload = {
      controllerId,
      axis: netState.axis,
      grabSeq: netState.grabSeq,
      releaseSeq: netState.releaseSeq,
      clientTime: Date.now(),
    };

    const response = await fetch(API_UPDATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      credentials: "same-origin",
    });

    if (response.ok) {
      if (netState.axis !== 0) {
        console.log("[Controller] Posted axis:", netState.axis.toFixed(2));
      }
    } else {
      console.warn(
        "[Controller] POST error:",
        response.status,
        response.statusText,
      );
    }
  } catch (err) {
    console.warn("[Controller] Network error:", err.message);
  }
}

function queueNetworkPost() {
  if (document.hidden) return;
  postNetworkState();
}

const joystick = document.getElementById("joystick");
const joystickKnob = document.getElementById("joystickKnob");

let joystickPointerId = null;
let axisX = 0;

function updateMachineDirection(nextAxis) {
  axisX = Math.max(-1, Math.min(1, nextAxis));
  console.log("[Controller] Send axis:", axisX);
  send("axis", axisX);
}

function updateKnobPosition() {
  const track = joystick.querySelector(".joystick-track");
  const trackBounds = track.getBoundingClientRect();
  const maxOffset = Math.max(
    0,
    trackBounds.width / 2 - joystickKnob.offsetWidth / 2 - 10,
  );
  const offset = axisX * maxOffset;
  joystickKnob.style.transform = `translate(-50%, -50%) translateX(${offset}px)`;
}

function centerJoystick() {
  updateMachineDirection(0);
  updateKnobPosition();
}

joystick.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  joystickPointerId = event.pointerId;
  joystick.classList.add("is-active");
  joystick.setPointerCapture(event.pointerId);
});

joystick.addEventListener("pointermove", (event) => {
  if (joystickPointerId !== event.pointerId) return;

  const rect = joystick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const raw = (event.clientX - centerX) / (rect.width / 2);
  const clamped = Math.max(-1, Math.min(1, raw));
  console.log("[Controller] Joystick move:", {
    raw,
    clamped,
    track: rect.width,
  });
  updateMachineDirection(clamped);
  updateKnobPosition();
});

function releaseJoystick(event) {
  if (joystickPointerId !== null && event.pointerId !== joystickPointerId)
    return;
  joystickPointerId = null;
  joystick.classList.remove("is-active");
  // Stop movement on release but keep joystick visually where it was left.
  send("axis", 0);
  updateKnobPosition();
}

joystick.addEventListener("pointerup", releaseJoystick);
joystick.addEventListener("pointercancel", releaseJoystick);
joystick.addEventListener("lostpointercapture", releaseJoystick);

function triggerActionButton(button, action) {
  if (!button) return;
  button.classList.add("is-pressed");
  send(action, true);
  setTimeout(() => button.classList.remove("is-pressed"), 150);
}

function bindActionButton(button, action) {
  if (!button) return;
  let lastTriggerAt = 0;
  const triggerOnce = (event) => {
    if (event) event.preventDefault();
    const now = Date.now();
    if (now - lastTriggerAt < 250) return;
    lastTriggerAt = now;
    triggerActionButton(button, action);
  };

  button.addEventListener("pointerdown", triggerOnce);
  button.addEventListener(
    "touchstart",
    (event) => {
      triggerOnce(event);
    },
    { passive: false },
  );
  button.addEventListener("click", triggerOnce);
}

const grabButton = document.querySelector("[data-action='grab']");
bindActionButton(grabButton, "grab");

const releaseButton = document.querySelector("[data-action='release']");
bindActionButton(releaseButton, "release");

window.addEventListener("resize", updateKnobPosition);
centerJoystick();
console.log("[Controller] Initialized, controllerId:", controllerId);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    queueNetworkPost();
  }
});
queueNetworkPost();
setInterval(() => {
  if (document.hidden) return;
  queueNetworkPost();
}, 350);
