/**
 * ChainTimeline.js - Sequential Animation Accumulator for Chaining Test
 */
export class ChainTimeline {
    constructor(stage, actor) {
        this.stage = stage;
        this.actor = actor;
        this.currentIdx = 0;
        this.accumulatedOffset = new BABYLON.Vector3(0, 0, 0);
        this.accumulatedRotation = new BABYLON.Quaternion.Identity();
    }

    resolveAsset(p) {
        return (p && !p.startsWith("http")) ? "../" + p : p;
    }

    async loadVRMA(url) {
        const scene = this.stage.scene;
        const managersBefore = new Set(scene.metadata?.vrmAnimationManagers ?? []);
        const container = await BABYLON.LoadAssetContainerAsync(this.resolveAsset(url), scene);
        const managersAfter = scene.metadata?.vrmAnimationManagers ?? [];
        const mgr = managersAfter.find(m => !managersBefore.has(m));
        const group = container.animationGroups[0];
        
        if (!mgr || !group) {
            container.dispose();
            return null;
        }

        const mapNodeNames = new Map();
        group.targetedAnimations.forEach((ta, i) => {
            const boneName = mgr.animationMap.get(i);
            const bone = this.actor.mgr.humanoidBone[boneName];
            if (bone && ta.target?.name) {
                mapNodeNames.set(ta.target.name, bone.name);
            }
        });

        const remapped = this.actor.vrmAvatar.retargetAnimationGroup(group, {
            animationGroupName: `chain-${url}`,
            fixRootPosition: true,
            rootNodeName: this.actor.mgr.humanoidBone["hips"]?.name,
            groundReferenceNodeName: this.actor.mgr.humanoidBone["leftFoot"]?.name,
            mapNodeNames,
        });

        container.dispose();
        return remapped;
    }

    async playNext(sequence) {
        if (this.currentIdx >= sequence.length) {
            console.log("[Chain] Sequence complete.");
            document.body.setAttribute("data-status", "complete");
            document.body.removeAttribute("data-frame");
            return;
        }

        const step = sequence[this.currentIdx];
        console.log(`[Chain] Playing: ${step.name}`);
        document.body.setAttribute("data-current", step.name);
        document.body.setAttribute("data-status", "playing");

        // 1. Load layers
        const bodyGroup = await this.loadVRMA(step.body);
        const rootGroup = await this.loadVRMA(step.root);

        if (!bodyGroup || !rootGroup) {
            console.error("[Chain] Failed to load animation layers.");
            return;
        }

        // 2. Align root to current accumulated state
        this.actor.root.position.copyFrom(this.accumulatedOffset);
        // Note: For now we focus on position chaining. Rotation accumulation would require additional logic.

        // 3. Play
        bodyGroup.start(false);
        rootGroup.start(false);

        // 4. Wait for completion using observables
        // Signal start to Playwright
        document.body.setAttribute("data-frame", "start");

        await new Promise(res => {
            let bodyEnded = false;
            let rootEnded = false;
            
            const onEnd = () => {
                if (bodyEnded && rootEnded) {
                    // At the end, capture the hips delta
                    const hips = this.actor.mgr.humanoidBone["hips"];
                    if (hips) {
                        const finalPos = hips.getAbsolutePosition();
                        this.accumulatedOffset.copyFrom(finalPos);
                        console.log(`[Chain] Captured Hips Final: ${this.accumulatedOffset}`);
                    }
                    
                    bodyGroup.stop();
                    rootGroup.stop();
                    
                    // Signal end to Playwright
                    document.body.setAttribute("data-frame", "end");
                    
                    // Cleanup
                    bodyGroup.dispose();
                    rootGroup.dispose();
                    res();
                }
            };

            bodyGroup.onAnimationGroupEndObservable.addOnce(() => { bodyEnded = true; onEnd(); });
            rootGroup.onAnimationGroupEndObservable.addOnce(() => { rootEnded = true; onEnd(); });
        });

        this.currentIdx++;
        // Very small pause between clips
        setTimeout(() => this.playNext(sequence), 50);
    }
}
