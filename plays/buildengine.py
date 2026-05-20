import os

# Define the file pathways and their contents
FILES_MAP = {
    # ── 1. Character.js: Handles VRM Rig, Morph Caching, and Hip Baking ──
    "js/Character.js": """/**
 * Character.js - Handles VRM Rig, Morph Mappings, and Transform Deltas
 */
export class Character {
    constructor(id, rootNode, vrmManager) {
        this.id = id;
        this.root = rootNode;
        this.mgr = vrmManager;
        
        // Cache references to avoid runtime memory allocations or object creation
        this.curGroups = [];
        this.cachedMorphTargets = new Map();
        
        // Build unified animation tracking references
        this.vrmAvatar = new BABYLON.AnimatorAvatar(`avatar-${id}`, rootNode);
        
        // Pre-map and cache all 52 standard ARKit names immediately upon instantiation
        this.preMapMorphTargets();
    }

    preMapMorphTargets() {
        for (const mesh of this.root.getChildMeshes(false)) {
            const mtm = mesh.morphTargetManager;
            if (!mtm) continue;
            
            for (let i = 0; i < mtm.numTargets; i++) {
                const target = mtm.getTarget(i);
                if (!target.name) continue;

                const lowerName = target.name.toLowerCase();
                this.cachedMorphTargets.set(lowerName, target);

                // Handle direct string variations or dot prefixes (e.g., "mesh.jawOpen")
                const dotIdx = target.name.indexOf(".");
                if (dotIdx !== -1) {
                    this.cachedMorphTargets.set(target.name.slice(dotIdx + 1).toLowerCase(), target);
                }
            }
        }
    }

    getMorphTarget(shapeName) {
        return this.cachedMorphTargets.get(shapeName.toLowerCase()) || null;
    }

    applyExpressionWeights(names, weights) {
        for (let i = 0; i < weights.length; i++) {
            const target = this.getMorphTarget(names[i]);
            if (target) {
                target.influence = weights[i];
            }
        }
    }

    stopAnimations() {
        this.curGroups.forEach(g => { g.stop(); g.dispose(); });
        this.curGroups = [];
    }
}
""",

    # ── 2. Stage.js: Coordinates Environmental Components, Lights, Camera ──
    "js/Stage.js": """/**
 * Stage.js - Manages the Scene, Lighting rig, and Camera behaviors
 */
export class Stage {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = new BABYLON.Scene(this.engine);
        
        this.setupEnvironment();
        this.setupLights();
        this.setupCamera();
        
        window.addEventListener("resize", () => this.engine.resize());
    }

    setupEnvironment() {
        this.scene.ambientColor = new BABYLON.Color3(0.05, 0.05, 0.1);
        this.scene.clearColor = new BABYLON.Color4(0.04, 0.04, 0.08, 1);
    }

    setupLights() {
        this.keyLight = new BABYLON.DirectionalLight("key", new BABYLON.Vector3(0.3, -1, 0.5), this.scene);
        this.keyLight.intensity = 1.2;
        this.keyLight.diffuse = new BABYLON.Color3(1, 0.95, 0.85);

        this.fillLight = new BABYLON.HemisphericLight("fill", new BABYLON.Vector3(0, 1, 0), this.scene);
        this.fillLight.intensity = 0.35;
        this.fillLight.diffuse = new BABYLON.Color3(0.6, 0.7, 1);
        this.fillLight.groundColor = new BABYLON.Color3(0.05, 0.04, 0.08);
    }

    setupCamera() {
        this.camera = new BABYLON.ArcRotateCamera(
            "cam", 
            Math.PI / 2, 
            Math.PI / 2 - 0.22, 
            4.2, 
            new BABYLON.Vector3(0, 1.05, 0), 
            this.scene
        );
        this.camera.attachControl(this.canvas, true);
        this.camera.lowerRadiusLimit = 1;
        this.camera.upperRadiusLimit = 12;
    }

    startRenderLoop() {
        this.engine.runRenderLoop(() => this.scene.render());
    }
}
""",

    # ── 3. Timeline.js: Orchestrates Core Clock, Audio-Locks, and Retargeting ──
    "js/Timeline.js": """/**
 * Timeline.js - Synchronous Audio Event Processor and VRMA Retargeter
 */
export class TimelineManager {
    constructor(stage, actors) {
        this.stage = stage;
        this.actors = actors;
        this.progEl = document.getElementById("prog-bar");
        this.speakerEl = document.getElementById("speaker");
        this.lineEl = document.getElementById("line");
        
        // Maintain running spatial offset state mappings
        this.offsets = {
            jordan: { position: new BABYLON.Vector3(0, 0, 0) },
            officer: { position: new BABYLON.Vector3(1.2, 0, 0.3) }
        };
    }

    resolveAsset(p) {
        return (p && !p.startsWith("http")) ? "../" + p : p;
    }

    async loadAndRetargetVRMA(actor, url, name) {
        const scene = this.stage.scene;
        const managersBefore = (scene.metadata?.vrmAnimationManagers ?? []).length;
        
        let container;
        try { 
            container = await BABYLON.LoadAssetContainerAsync(url, scene); 
        } catch (e) { 
            console.warn("[Engine] VRMA stream failure:", url, e); 
            return null; 
        }

        const vrmAnimMgr = (scene.metadata?.vrmAnimationManagers ?? [])[managersBefore];
        const srcGroup = container.animationGroups[0];

        if (!vrmAnimMgr?.animationMap || !srcGroup) {
            container.dispose();
            return null;
        }

        const mapNodeNames = new Map();
        srcGroup.targetedAnimations.forEach((ta, i) => {
            const boneName = vrmAnimMgr.animationMap.get(i);
            const bone = actor.mgr.humanoidBone[boneName];
            if (bone && ta.target?.name) {
                mapNodeNames.set(ta.target.name, bone.name);
            }
        });

        const remapped = actor.vrmAvatar.retargetAnimationGroup(srcGroup, {
            animationGroupName: `${actor.id}-${name}`,
            fixRootPosition: true,
            rootNodeName: actor.mgr.humanoidBone["hips"]?.name,
            groundReferenceNodeName: actor.mgr.humanoidBone["leftFoot"]?.name,
            mapNodeNames,
        });

        container.dispose();
        return remapped;
    }

    async playEvent(event) {
        const actor = this.actors[event.actor];
        if (!actor) return;

        this.speakerEl.textContent = event.actor.toUpperCase();
        this.lineEl.textContent = event.description ?? "";

        // Absolute Hip Tracking Transition Delta Fix
        const hips = actor.mgr.humanoidBone["hips"];
        if (hips && actor.curGroups.length > 0) {
            const worldHips = hips.getAbsolutePosition();
            this.offsets[event.actor].position.x = worldHips.x;
            this.offsets[event.actor].position.z = worldHips.z;
        }

        actor.stopAnimations();
        actor.root.position.copyFrom(this.offsets[event.actor].position);

        // Dynamic linear target camera focal adjustments
        const targetX = actor.root.position.x * 0.4;
        this.stage.camera.setTarget(BABYLON.Vector3.Lerp(this.stage.camera.target, new BABYLON.Vector3(targetX, 1.05, 0), 0.6));

        // Evaluate body captures (Excluding legacy face tracks)
        const layers = event.layers || {};
        const groups = [];
        for (const [name, url] of Object.entries(layers)) {
            if (name === "FACE") continue; 
            const g = await this.loadAndRetargetVRMA(actor, this.resolveAsset(url), name);
            if (g) groups.push(g);
        }
        actor.curGroups = groups;
        groups.forEach(g => g.start(false, 1.0, g.from, g.to, false));

        // Sync rendering loop directly with Audio playback
        if (event.audio) {
            const audio = new Audio(this.resolveAsset(event.audio));
            let trackingData = null;

            if (event.lipSync) {
                try { trackingData = await fetch(this.resolveAsset(event.lipSync)).then(r => r.json()); }
                catch(e) { console.warn("Facial JSON fetch issue:", e); }
            }

            let renderObs = this.stage.scene.onBeforeRenderObservable.add(() => {
                const clock = audio.currentTime;
                const ratio = audio.duration > 0 ? clock / audio.duration : 0;
                this.progEl.style.width = (ratio * 100).toFixed(1) + "%";

                if (trackingData && trackingData.frames && trackingData.names) {
                    const frame = trackingData.frames.find(f => f.time >= clock) || trackingData.frames.at(-1);
                    if (frame && frame.weights) {
                        actor.applyExpressionWeights(trackingData.names, frame.weights);
                    }
                }
            });

            await new Promise(res => {
                audio.onended = () => { this.stage.scene.onBeforeRenderObservable.remove(renderObs); res(); };
                audio.onerror = () => { this.stage.scene.onBeforeRenderObservable.remove(renderObs); res(); };
                audio.play().catch(res);
            });
        }
        this.progEl.style.width = "0%";
    }

    async run(timeline) {
        for (let i = 0; i < timeline.length; i++) {
            await this.playEvent(timeline[i]);
            await new Promise(r => setTimeout(r, 400));
        }
        this.speakerEl.textContent = "";
        this.lineEl.textContent = "— end —";
    }
}
""",

    # ── 4. main.js: App Bootstrapper, Engine Initialization, Configuration Loader ──
    "js/main.js": """/**
 * main.js - Core application lifecycle entry point
 */
import { Stage } from "./Stage.js";
import { Character } from "./Character.js";
import { TimelineManager } from "./Timeline.js";

BABYLON.TransformNode.prototype.getTotalVertices ??= () => 0;

const loadEl = document.getElementById("loading");
const lineEl = document.getElementById("line");
const canvasEl = document.getElementById("renderCanvas");
const actors = {};

const stage = new Stage("renderCanvas");
const sceneData = await fetch("traffic_scene.json").then(r => r.json());

const resolveVRM = p => {
    if (p.startsWith("http") || p.startsWith("models/")) return p;
    return p;
};

async function initializeActor(def) {
    loadEl.textContent = `Hydrating ${def.id}…`;
    const beforeCount = stage.scene.metadata?.vrmManagers?.length ?? 0;
    const existingRoots = new Set(stage.scene.rootNodes.map(n => n.uniqueId));

    await BABYLON.ImportMeshAsync(resolveVRM(def.vrm), stage.scene);

    const mgr = stage.scene.metadata?.vrmManagers?.[beforeCount];
    const root = stage.scene.rootNodes.find(n => !existingRoots.has(n.uniqueId));

    if (!mgr || !root) throw new Error(`Asset initialization crashed for identifier: ${def.id}`);

    root.position.set(def.startPosition?.x ?? 0, def.startPosition?.y ?? 0, def.startPosition?.z ?? 0);
    actors[def.id] = new Character(def.id, root, mgr);
}

// Instantiate ecosystem characters asynchronously
try {
    for (const actorDef of (sceneData.actors ?? [])) {
        await initializeActor(actorDef);
    }
} catch (err) {
    console.error("Critical loading failure:", err);
}

// Complete loading sequences, handover control loop configurations to interactive hooks
loadEl.style.display = "none";
lineEl.textContent = "Click to begin";

canvasEl.addEventListener("click", () => {
    lineEl.textContent = "";
    const timeline = new TimelineManager(stage, actors);
    stage.startRenderLoop();
    timeline.run(sceneData.timeline);
}, { once: true });
"""
}

def build_architecture():
    print("🚀 Initializing Babylon Cinematic Engine Build Process...")
    
    # Ensure the js/ targeted directory exists
    os.makedirs("js", exist_ok=True)
    
    for filepath, content in FILES_MAP.items():
        clean_content = content.strip() + "\n"
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(clean_content)
        print(f"  ✓ Successfully compiled: {filepath} ({len(clean_content)} bytes)")
        
    print("\n🎉 Build Complete! All 4 modules have been generated into your 'js/' folder.")

if __name__ == "__main__":
    build_architecture()