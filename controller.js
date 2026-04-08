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

const netState = {
  axis: 0,
  grabSeq: 0,
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
  }

  postNetworkState();
}

async function postNetworkState() {
  try {
    const payload = {
      controllerId,
      axis: netState.axis,
      grabSeq: netState.grabSeq,
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

const grabButton = document.querySelector("[data-action='grab']");
grabButton.addEventListener("click", () => {
  grabButton.classList.add("is-pressed");
  send("grab", true);
  setTimeout(() => grabButton.classList.remove("is-pressed"), 150);
});

window.addEventListener("resize", updateKnobPosition);
centerJoystick();
console.log("[Controller] Initialized, controllerId:", controllerId);
postNetworkState();
setInterval(postNetworkState, 120);
