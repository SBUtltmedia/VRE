/**
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
    if (p.startsWith("http")) return p;
    // Force lookups to search up one level in the common directory layout
    if (p.startsWith("models/")) return "../" + p;
    return p;
};

async function initializeActor(def) {
    loadEl.textContent = `Hydrating ${def.id}…`;
    const beforeCount = stage.scene.metadata?.vrmManagers?.length ?? 0;
    const animBeforeCount = stage.scene.metadata?.vrmAnimationManagers?.length ?? 0;
    const existingRoots = new Set(stage.scene.rootNodes.map(n => n.uniqueId));

    const fullPath = resolveVRM(def.vrm);
    console.log(`[Main] Loading actor ${def.id} from ${fullPath}`);

    await BABYLON.SceneLoader.ImportMeshAsync(
        null,        
        fullPath,    
        null,        
        stage.scene  
    );

    const mgr = stage.scene.metadata?.vrmManagers?.[beforeCount];
    const root = stage.scene.rootNodes.find(n => !existingRoots.has(n.uniqueId));

    if (!mgr || !root) {
        console.error(`[Main] Asset initialization failed for ${def.id}. Mgr: ${!!mgr}, Root: ${!!root}`);
        throw new Error(`Asset initialization crashed for identifier: ${def.id}`);
    }

    console.log(`[Main] Actor ${def.id} ready. Root name: ${root.name}`);
    root.position.set(def.startPosition?.x ?? 0, def.startPosition?.y ?? 0, def.startPosition?.z ?? 0);
    actors[def.id] = new Character(def.id, root, mgr);
}

try {
    for (const actorDef of (sceneData.actors ?? [])) {
        await initializeActor(actorDef);
    }
} catch (err) {
    console.error("Critical loading failure:", err.message);
}

loadEl.style.display = "none";
lineEl.textContent = "Click to begin";

canvasEl.addEventListener("click", () => {
    lineEl.textContent = "";
    const timeline = new TimelineManager(stage, actors);
    stage.startRenderLoop();
    timeline.run(sceneData.timeline);
}, { once: true });
