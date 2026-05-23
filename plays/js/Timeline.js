/**
 * Timeline.js - Synchronous Audio Event Processor, VRMA Retargeter, and Array-Based Expression Streamer
 * Support Accumulative Root Motion and Orientation across consecutive timeline steps with smooth animation blending.
 */
export class TimelineManager {
    constructor(stage, actors) {
        this.stage = stage;
        this.actors = actors;
        
        this.progEl = document.getElementById("prog-bar");
        this.speakerEl = document.getElementById("speaker");
        this.lineEl = document.getElementById("line");
        this.dumpEl = document.getElementById("tracking-dump");
        
        // Store cumulative world transform states for actors, initialized from scene
        this.cumulativeTransforms = {};
        for (const [id, actor] of Object.entries(actors)) {
            // Ensure rotationQuaternion exists for accumulation
            if (!actor.root.rotationQuaternion) {
                actor.root.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(actor.root.rotation.y, actor.root.rotation.x, actor.root.rotation.z);
            }
            
            // Force Officer to face camera (+Z) if they aren't already
            if (id === 'officer' && Math.abs(actor.root.rotationQuaternion.toEulerAngles().y) < 0.1) {
                console.log("[Timeline] Force-aligning Officer to face camera.");
                BABYLON.Quaternion.RotationYawPitchRollToRef(Math.PI, 0, 0, actor.root.rotationQuaternion);
            }

            this.cumulativeTransforms[id] = {
                position: actor.root.position.clone(),
                rotation: actor.root.rotationQuaternion.clone()
            };
        }

        this._setupGlobalTick();
    }

    _setupGlobalTick() {
        this.stage.scene.onBeforeRenderObservable.add(() => {
            const now = performance.now() / 1000;
            let hudHtml = "";

            for (const actor of Object.values(this.actors)) {
                actor.tickProceduralHead(now, actor.activeExpressions || []);

                if (actor.activeExpressions && actor.activeExpressions.length > 0) {
                    actor.activeExpressions.forEach(e => {
                        hudHtml += `<div class="track-row"><span>${actor.id}.${e.name}</span><span class="track-val">${e.val.toFixed(2)}</span></div>`;
                    });
                }
            }

            if (this.dumpEl) {
                this.dumpEl.innerHTML = hudHtml || "<div style='opacity:0.4'>No active blendshapes</div>";
            }

            // Smooth camera follow for current speaker
            if (this.currentSpeaker && this.actors[this.currentSpeaker]) {
                const actor = this.actors[this.currentSpeaker];
                const hips = actor.mgr.humanoidBone["hips"];
                if (hips) {
                    const worldHips = hips.getAbsolutePosition();
                    const target = new BABYLON.Vector3(worldHips.x * 0.4, 1.1, worldHips.z * 0.4);
                    const cam = this.stage.perspCam || this.stage.camera;
                    if (cam) cam.setTarget(BABYLON.Vector3.Lerp(cam.target, target, 0.05));
                }
            }
        });
    }

    resolveAsset(p) {
        return (p && !p.startsWith("http")) ? "../" + p : p;
    }

    async loadAndRetargetVRMA(actor, url, name) { 
        const scene = this.stage.scene;
        const managersBefore = new Set(scene.metadata?.vrmAnimationManagers ?? []);
        
        let container;
        try { 
            container = await BABYLON.LoadAssetContainerAsync(url, scene); 
        } catch (e) { 
            console.error("[Timeline Engine] Failed to load VRMA layer:", url, e); 
            return null; 
        }

        const managersAfter = scene.metadata?.vrmAnimationManagers ?? [];
        const vrmAnimMgr = managersAfter.find(m => !managersBefore.has(m));
        const srcGroup = container.animationGroups[0];

        if (!vrmAnimMgr || !srcGroup) {
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
            animationGroupName: `${actor.id}-${name}-${Date.now()}`,
            fixAnimations: true,
            fixRootPosition: false,
            rootNodeName: actor.mgr.humanoidBone["hips"]?.name,
            groundReferenceNodeName: actor.mgr.humanoidBone["leftFoot"]?.name,
            mapNodeNames,
        });

        container.dispose();
        return remapped;
    }

    _fadeOutAndDispose(groups, durationMs = 300) {
        if (!groups || groups.length === 0) return;
        groups.forEach(g => {
            let weight = g.weight;
            const step = 0.1;
            const interval = durationMs * step;
            const timer = setInterval(() => {
                weight -= step;
                if (weight <= 0) {
                    g.weight = 0;
                    g.stop();
                    g.dispose();
                    clearInterval(timer);
                } else {
                    g.weight = weight;
                }
            }, interval);
        });
    }

    _fadeInGroups(groups, durationMs = 300) {
        groups.forEach(g => {
            g.weight = 0.0;
            g.start(false, 1.0, g.from, g.to, false);
            let weight = 0.0;
            const step = 0.1;
            const interval = durationMs * step;
            const timer = setInterval(() => {
                weight += step;
                if (weight >= 1.0) {
                    g.weight = 1.0;
                    clearInterval(timer);
                } else {
                    g.weight = weight;
                }
            }, interval);
        });
    }

    async playEvent(event) {
        const actor = this.actors[event.actor];
        if (!actor) return;

        this.currentSpeaker = event.actor;
        this.speakerEl.textContent = event.actor.toUpperCase();
        this.lineEl.textContent = event.description ?? "";

        const state = this.cumulativeTransforms[event.actor];
        const hips = actor.mgr.humanoidBone["hips"];
        
        // A. EXTRACT motion from PREVIOUSLY active clips before they are stopped
        if (hips && actor.curGroups.length > 0) {
            hips.computeWorldMatrix(true);
            const hipsWorldPos = hips.getAbsolutePosition();
            const hipsWorldMatrix = hips.getWorldMatrix();
            
            const rootPos = actor.root.position;
            const displacement = hipsWorldPos.subtract(rootPos);
            
            state.position.addInPlace(new BABYLON.Vector3(displacement.x, 0, displacement.z));
            
            const localForward = new BABYLON.Vector3(0, 0, -1);
            const worldForward = BABYLON.Vector3.TransformCoordinates(localForward, hipsWorldMatrix);
            const dir = worldForward.subtract(hipsWorldPos);
            const rawYaw = Math.atan2(dir.x, dir.z);
            
            const currentYaw = actor.root.rotationQuaternion.toEulerAngles().y;
            let yawDelta = rawYaw - currentYaw;
            while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
            while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
            
            const newYaw = currentYaw + yawDelta;
            BABYLON.Quaternion.RotationYawPitchRollToRef(newYaw, 0, 0, state.rotation);
            
            console.log(`[Timeline] Chained motion for ${actor.id}. New Pos: ${state.position.toString()}`);

            // B. Apply new root transform and zero the hips for the upcoming clips
            actor.root.position.copyFrom(state.position);
            actor.root.rotationQuaternion.copyFrom(state.rotation);
            
            hips.position.x = 0;
            hips.position.z = 0;
            hips.rotationQuaternion = BABYLON.Quaternion.Identity();
        } else {
            // First time loading - ensure root matches state
            actor.root.position.copyFrom(state.position);
            actor.root.rotationQuaternion.copyFrom(state.rotation);
        }

        Object.values(this.actors).forEach(a => a.resetFace());

        // C. Load new layers SEQUENTIALLY
        const layers = event.layers || {};
        if (event.clip && !layers.BODY) layers.BODY = event.clip;

        const newGroups = [];
        for (const [name, url] of Object.entries(layers)) {
            if (name === "FACE") continue; 
            const g = await this.loadAndRetargetVRMA(actor, this.resolveAsset(url), name);
            if (g) newGroups.push(g);
        }
        
        // D. Cross-fade between clips
        this._fadeOutAndDispose(actor.curGroups, 300);
        actor.curGroups = newGroups;
        this._fadeInGroups(newGroups, 300);

        if (event.audio) {
            const audio = new Audio(this.resolveAsset(event.audio));
            let trackingData = null;

            if (event.lipSync) {
                try { 
                    trackingData = await fetch(this.resolveAsset(event.lipSync)).then(r => r.json()); 
                } catch(e) { }
            }

            let renderObs = this.stage.scene.onBeforeRenderObservable.add(() => {
                const clock = audio.currentTime;
                const ratio = audio.duration > 0 ? clock / audio.duration : 0;
                this.progEl.style.width = (ratio * 100).toFixed(1) + "%";

                if (trackingData && trackingData.frames && trackingData.names) {
                    actor.activeExpressions = actor.face.evaluateInterpolated(trackingData.names, trackingData.frames, clock);
                } 
            });

            await new Promise(res => {
                audio.onended = () => { 
                    this.stage.scene.onBeforeRenderObservable.remove(renderObs); 
                    res(); 
                };
                audio.onerror = () => {
                    this.stage.scene.onBeforeRenderObservable.remove(renderObs);
                    res();
                };
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
