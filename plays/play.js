/**
 * play.js - Main Babylon Cinematic Engine with Custom ARKit Diagnostics
 */

BABYLON.TransformNode.prototype.getTotalVertices ??= () => 0;

const speakerEl    = document.getElementById('speaker');
const lineEl       = document.getElementById('line');
const progEl       = document.getElementById('prog-bar');
const platesEl     = document.getElementById('plates');
const loadEl       = document.getElementById('loading');
const startEl      = document.getElementById('start-overlay');
const headToggleEl = document.getElementById('head-toggle');

const sceneData = await fetch('traffic_scene.json').then(r => r.json());

const canvas = document.getElementById('renderCanvas');
const engine = new BABYLON.Engine(canvas, true);
const scene  = new BABYLON.Scene(engine);
window.scene = scene;

scene.ambientColor = new BABYLON.Color3(.04, .04, .08);
scene.clearColor   = new BABYLON.Color4(.03, .03, .07, 1);

const fill = new BABYLON.HemisphericLight('fill', new BABYLON.Vector3(0, 1, 0), scene);
fill.intensity   = .3;
fill.diffuse     = new BABYLON.Color3(.55, .65, 1);
fill.groundColor = new BABYLON.Color3(.04, .04, .08);

const key = new BABYLON.DirectionalLight('key', new BABYLON.Vector3(.2, -1, .4), scene);
key.intensity = .9;
key.diffuse   = new BABYLON.Color3(1, .93, .8);

const spot = new BABYLON.PointLight('spot', new BABYLON.Vector3(0, 2, 1), scene);
spot.diffuse    = new BABYLON.Color3(1, .97, .9);
spot.intensity  = 1.1;
spot.range      = 3.0;

const camera = new BABYLON.FreeCamera('cam', new BABYLON.Vector3(0, 1.6, 1.5), scene);
camera.setTarget(new BABYLON.Vector3(0, 1.55, 0));
camera.minZ = 0.01;

const RHUBARB_MAP = {
  'A': 'ih', 'B': 'ou', 'C': 'oh', 'D': 'aa', 'E': 'ee',
  'F': 'aa', 'G': 'aa', 'H': 'ih', 'X': null
};

const FALLBACK_VOWEL_MAP = {
  'jawOpen': 'aa',
  'mouthFunnel': 'oh',
  'mouthPucker': 'ou',
  'eyeBlinkLeft': 'blink',
  'eyeBlinkRight': 'blink'
};

function evalExprChannel(ch, t) {
  const { times, weights } = ch;
  if (t <= times[0]) return weights[0];
  if (t >= times[times.length - 1]) return weights[weights.length - 1];
  for (let i = 1; i < times.length; i++) {
    if (t <= times[i]) {
      const u = (t - times[i - 1]) / (times[i] - times[i - 1]);
      return weights[i - 1] * (1 - u) + weights[i] * u;
    }
  }
  return weights[weights.length - 1];
}

async function loadFaceJSON(url) {
  if (!url || url.endsWith('.vrma') || url.endsWith('.vrm') || url.endsWith('.glb')) return null;
  let data;
  try { data = await fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  catch (e) { console.warn('[side] Face JSON fetch failed:', url, e); return null; }

  if (data.mouthCues) {
    const times = [];
    const cues = [];
    for (const cue of data.mouthCues) {
      times.push(cue.start, cue.end);
      cues.push(cue.value, cue.value);
    }
    const duration = data.metadata?.duration ?? times[times.length - 1];
    const channels = ['aa', 'ih', 'uu', 'ee', 'oh'].map(v => ({
      name: v, times,
      weights: times.map((t, i) => RHUBARB_MAP[cues[i]] === v ? 1.0 : 0.0)
    }));
    return { channels, duration, startT: null };
  }

  const { names, frames } = data;
  if (!names?.length || !frames?.length) return null;
  const times    = frames.map(f => f.time);
  const duration = times[times.length - 1] ?? 0;
  const channels = names.map((name, i) => ({
    name, times,
    weights: frames.map(f => f.weights[i] ?? 0),
  }));
  return { channels, duration, startT: null };
}

const actors = {};
window.actors = actors;

async function loadActor(id, vrmPath, worldX) {
  console.log(`%c[DIAG-ACTOR] Starting asset import for ID: "${id}" from: ${vrmPath}`, "color: #4caf50; font-weight: bold;");
  loadEl.textContent = `Loading ${id}…`;
  const preMgrCount = scene.metadata?.vrmManagers?.length ?? 0;
  const preRootIds  = new Set(scene.rootNodes.map(n => n.uniqueId));

  const lastSlash = vrmPath.lastIndexOf('/');
  const rootUrl = lastSlash !== -1 ? vrmPath.substring(0, lastSlash + 1) : '';
  const fileName = lastSlash !== -1 ? vrmPath.substring(lastSlash + 1) : vrmPath;

  await BABYLON.SceneLoader.ImportMeshAsync('', rootUrl, fileName, scene);

  const mgr  = scene.metadata?.vrmManagers?.[preMgrCount];
  const root = scene.rootNodes.find(n => !preRootIds.has(n.uniqueId));
  if (!mgr || !root) { console.error('[side] Load failed for', id); return; }

  root.position.set(worldX, 0, 0);

  const morphMap = new Map();
  const rawMorphNames = [];

  for (const mesh of root.getChildMeshes(false)) {
    const mtm = mesh.morphTargetManager;
    if (!mtm) continue;
    for (let i = 0; i < mtm.numTargets; i++) {
      const mt = mtm.getTarget(i);
      if (!mt.name) continue;
      
      rawMorphNames.push(mt.name);
      morphMap.set(mt.name, mt);
      morphMap.set(mt.name.toLowerCase(), mt);
      
      const dot = mt.name.indexOf('.');
      if (dot !== -1) {
        const cleanName = mt.name.slice(dot + 1);
        morphMap.set(cleanName, mt);
        morphMap.set(cleanName.toLowerCase(), mt);
      }
    }
  }

  console.log(`%c[DIAG-ACTOR] "${id}" successfully rigged. Total GPU morph targets extracted: ${rawMorphNames.length}`, "color: #00bcd4;");
  console.log(`[DIAG-ACTOR] Sample of available target keys for "${id}":`, rawMorphNames.slice(0, 15));

  actors[id] = { id, mgr, root, morphMap, faceAnim: null, worldX };
}

const MODEL_PREFIX = 'https://media.githubusercontent.com/media/TLTMedia/valid-vrm-avatars/master/';
const resolveAsset = p => (p && !p.startsWith('http')) ? '../' + p : p;
const resolveVRM = p => {
  if (p.startsWith('http')) return p;
  if (p.startsWith('models/')) return '../' + p;
  if (MODEL_PREFIX.startsWith('http')) return p.replace('models/', MODEL_PREFIX);
  return MODEL_PREFIX + p;
};

const [a0, a1] = sceneData.actors;
await loadActor(a0.id, resolveVRM(a0.vrm), +0.3);
await loadActor(a1.id, resolveVRM(a1.vrm), -0.3);

loadEl.textContent = 'Positioning camera…';
scene.render();

function getFacePos(actor) {
  const bones = actor.mgr?.humanoidBone ?? {};
  const pts = ['leftEye','rightEye','head']
    .map(n => { const b = bones[n]; b?.computeWorldMatrix?.(true); return b?.getAbsolutePosition?.(); })
    .filter(Boolean);
  if (!pts.length) return new BABYLON.Vector3(actor.worldX, 1.6, 0);
  return new BABYLON.Vector3(
    pts.reduce((s,p)=>s+p.x,0)/pts.length,
    pts.reduce((s,p)=>s+p.y,0)/pts.length,
    pts.reduce((s,p)=>s+p.z,0)/pts.length,
  );
}

const faceA = getFacePos(actors[a0.id]);
const faceB = getFacePos(actors[a1.id]);
const mid = faceA.add(faceB).scale(0.5);
const halfW = Math.abs(faceB.x - faceA.x) * 0.5 + 0.15;
const camDist = Math.max(0.65, halfW / Math.tan(37 * Math.PI / 180));

camera.position = new BABYLON.Vector3(mid.x, mid.y, mid.z + camDist);
camera.setTarget(mid);
spot.position   = new BABYLON.Vector3(mid.x, mid.y + 0.4, mid.z + camDist * 0.6);

let headTiltEnabled = true;
const headStates = {};

for (const actor of Object.values(actors)) {
  const head = actor.mgr?.humanoidBone?.head;
  const neck = actor.mgr?.humanoidBone?.neck;
  if (!head) continue;
  headStates[actor.id] = {
    energy: 0, tiltZ: 0, tiltX: 0,
    phase:    Math.random() * Math.PI * 2,
    head,     neck,
    headBase: head.rotationQuaternion?.clone() ?? BABYLON.Quaternion.Identity(),
    neckBase: neck?.rotationQuaternion?.clone() ?? BABYLON.Quaternion.Identity(),
  };
}

function tickHead(actor, now) {
  const s = headStates[actor.id];
  if (!s) return;

  if (!headTiltEnabled) {
    s.tiltZ  *= 0.85;
    s.tiltX  *= 0.85;
    s.energy *= 0.85;
  } else {
    let targetEnergy = 0;
    const fa = actor.faceAnim;
    if (fa?.startT) {
      const t = now - fa.startT;
      const jawCh = fa.channels.find(c => c.name === 'jawOpen' || c.name === 'aa');
      const lipCh = fa.channels.find(c => c.name === 'mouthFunnel' || c.name === 'oh');
      if (jawCh) targetEnergy += evalExprChannel(jawCh, t) * 0.7;
      if (lipCh) targetEnergy += evalExprChannel(lipCh, t) * 0.3;
    }
    s.energy += (targetEnergy - s.energy) * 0.08;
    const driftTarget = Math.sin(now * 0.38 + s.phase) * 0.06;
    s.tiltZ += (driftTarget - s.tiltZ) * 0.04;
    s.tiltX += (s.energy * -0.12 - s.tiltX) * 0.06;
  }

  const headTilt = BABYLON.Quaternion.FromEulerAngles(s.tiltX,       0, s.tiltZ);
  const neckTilt = BABYLON.Quaternion.FromEulerAngles(s.tiltX * 0.4, 0, s.tiltZ * 0.4);
  s.head.rotationQuaternion = s.headBase.multiply(headTilt);
  if (s.neck) s.neck.rotationQuaternion = s.neckBase.multiply(neckTilt);
}

headToggleEl.addEventListener('click', () => {
  headTiltEnabled = !headTiltEnabled;
  headToggleEl.className = headTiltEnabled ? '' : 'off';
});
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'h') {
    headTiltEnabled = !headTiltEnabled;
    headToggleEl.className = headTiltEnabled ? '' : 'off';
  }
});

const plateMap = {};
for (const def of sceneData.actors) {
  const div = document.createElement('div');
  div.className = 'plate';
  div.textContent = def.id;
  div.id = `plate-${def.id}`;
  platesEl.appendChild(div);
  plateMap[def.id] = div;
}

function setActiveSpeaker(id) {
  for (const [aid, div] of Object.entries(plateMap)) {
    div.className = 'plate' + (aid === id ? ' active' : '');
  }
  const actor = actors[id];
  if (actor) {
    const fp = getFacePos(actor);
    spot.position = new BABYLON.Vector3(fp.x, fp.y + 0.35, fp.z + 0.8);
  }
}

let currentAudio = null;
let currentFaceActor = null;
const _timers = [];
const trackedFailures = new Set();

function setExpression(actor, name, value) {
  const lowerName = name.toLowerCase();
  let routeFound = false;

  // 1. Direct Morph Target Fallback
  if (actor.morphMap.has(name) || actor.morphMap.has(lowerName)) {
    const target = actor.morphMap.get(name) || actor.morphMap.get(lowerName);
    if (target) {
      target.influence = value;
      routeFound = true;
    }
  }

  // 2. VRM 0.0 Legacy BlendShape Manager Routing
  if (!routeFound && actor.mgr && typeof actor.mgr.setBlendShapeWeight === 'function') {
    actor.mgr.setBlendShapeWeight(name, value);
    actor.mgr.setBlendShapeWeight(lowerName, value);
    if (FALLBACK_VOWEL_MAP[name]) {
      actor.mgr.setBlendShapeWeight(FALLBACK_VOWEL_MAP[name], value);
    }
    routeFound = true;
  }

  // 3. VRM 1.0 Expression Engine Routing
  if (!routeFound && actor.mgr?.isVRM1 && actor.mgr.expressionManager) {
    actor.mgr.expressionManager.setExpressionWeight(name, value);
    actor.mgr.expressionManager.setExpressionWeight(lowerName, value);
    routeFound = true;
  }

  // Diagnostics alert for missing parameters
  if (!routeFound && value > 0.1) {
    const failKey = `${actor.id}:${name}`;
    if (!trackedFailures.has(failKey)) {
      trackedFailures.add(failKey);
      console.warn(`%c[DIAG-EXPR] Target key "${name}" cannot be resolved on actor "${actor.id}". It is missing from both geometry morph maps and VRM expression configurations.`, "color: #ff9800; font-weight: bold;");
    }
  }
}

function resetFace(actor) {
  if (!actor?.faceAnim) return;
  for (const ch of actor.faceAnim.channels) {
    setExpression(actor, ch.name, 0);
  }
  actor.faceAnim = null;
}

async function playEvent(event) {
  const actor = actors[event.actor];
  if (!actor) return;

  speakerEl.textContent = event.actor.toUpperCase();
  lineEl.textContent    = event.description ?? '';
  setActiveSpeaker(event.actor);

  if (currentFaceActor && currentFaceActor !== actor) resetFace(currentFaceActor);
  resetFace(actor);

  const faceURL = resolveAsset(event.lipSync || event.layers?.FACE);
  if (faceURL) {
    console.log(`%c[DIAG-TIMELINE] Loading tracking track for "${event.actor}": ${faceURL}`, "color: #e91e63;");
    const fa = await loadFaceJSON(faceURL);
    if (fa) {
      fa.startT = performance.now() / 1000;
      actor.faceAnim = fa;
      currentFaceActor = actor;
      console.log(`[DIAG-TIMELINE] Active tracking channels inside file:`, fa.channels.map(c => c.name));
    }
  }

  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  if (event.audio) {
    const aud = new Audio(resolveAsset(event.audio));
    aud.play().catch(e => console.warn('[side] audio:', e));
    currentAudio = aud;
  }

  const dur = event.duration ?? 3;
  progEl.style.transition = 'none';
  progEl.style.width = '0%';
  requestAnimationFrame(() => {
    progEl.style.transition = `width ${dur}s linear`;
    progEl.style.width = '100%';
  });
}

function startTimeline() {
  console.log("%c[DIAG-MAIN] Timeline playback triggered by user action.", "color: #9c27b0; font-weight: bold;");
  for (const event of sceneData.timeline) {
    _timers.push(setTimeout(() => playEvent(event), event.start * 1000));
  }
  const last = sceneData.timeline.at(-1);
  if (last) {
    _timers.push(setTimeout(() => {
      speakerEl.textContent = '';
      lineEl.textContent    = '';
      progEl.style.width    = '0%';
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      resetFace(currentFaceActor);
      for (const div of Object.values(plateMap)) div.className = 'plate';
    }, (last.start + last.duration + 1) * 1000));
  }
}

loadEl.style.display   = 'none';
startEl.style.display  = 'flex';
startEl.addEventListener('click', () => {
  startEl.style.display = 'none';
  startTimeline();
}, { once: true });

engine.runRenderLoop(() => {
  const now = performance.now() / 1000;
  for (const actor of Object.values(actors)) {
    const fa = actor.faceAnim;
    if (fa?.startT) {
      const t = now - fa.startT;
      if (t > fa.duration + 0.1) {
        for (const ch of fa.channels) setExpression(actor, ch.name, 0);
        actor.faceAnim = null;
      } else {
        for (const ch of fa.channels) setExpression(actor, ch.name, evalExprChannel(ch, t));
      }
    }
    tickHead(actor, now);
  }
  scene.render();
});

window.addEventListener('resize', () => engine.resize());