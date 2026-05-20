/**
 * Character.js - Handles VRM Rig, Morph Mappings, and Transform Deltas
 */
import { ExtendedVRMManager } from "./VRMFaceExtension.js";

export class Character {
    constructor(id, rootNode, vrmManager) {
        this.id = id;
        this.root = rootNode;
        this.mgr = vrmManager;
        this.curGroups = [];
        
        this.face = new ExtendedVRMManager(vrmManager, rootNode);
        this.vrmAvatar = new BABYLON.AnimatorAvatar(`avatar-${id}`, rootNode);

        // Procedural head movement state
        this.headState = {
            energy: 0, tiltZ: 0, tiltX: 0,
            phase: Math.random() * Math.PI * 2,
            head: vrmManager.humanoidBone?.head,
            neck: vrmManager.humanoidBone?.neck,
            headBase: vrmManager.humanoidBone?.head?.rotationQuaternion?.clone() ?? BABYLON.Quaternion.Identity(),
            neckBase: vrmManager.humanoidBone?.neck?.rotationQuaternion?.clone() ?? BABYLON.Quaternion.Identity()
        };
    }

    stopAnimations() {
        this.curGroups.forEach(g => { g.stop(); g.dispose(); });
        this.curGroups = [];
    }

    resetFace() {
        if (this.activeExpressions) {
            // Force zeroing out all blendshapes that were active
            const names = this.activeExpressions.map(e => e.name);
            const zeros = names.map(() => 0);
            this.face.applyExpressionFrame(names, zeros);
        }
        this.activeExpressions = [];
    }

    tickProceduralHead(now, activeExpressions) {
        const s = this.headState;
        if (!s.head) return;

        let targetEnergy = 0;
        // Jaw movement drives head energy
        const jaw = activeExpressions.find(e => e.name.toLowerCase() === 'jawopen' || e.name.toLowerCase() === 'aa');
        if (jaw) targetEnergy += jaw.val * 0.6;

        s.energy += (targetEnergy - s.energy) * 0.08;
        s.tiltZ += (Math.sin(now * 0.4 + s.phase) * 0.04 - s.tiltZ) * 0.04;
        s.tiltX += (s.energy * -0.1 - s.tiltX) * 0.06;

        s.head.rotationQuaternion = s.headBase.multiply(BABYLON.Quaternion.FromEulerAngles(s.tiltX, 0, s.tiltZ));
        if (s.neck) {
            s.neck.rotationQuaternion = s.neckBase.multiply(BABYLON.Quaternion.FromEulerAngles(s.tiltX * 0.4, 0, s.tiltZ * 0.4));
        }
    }
}
