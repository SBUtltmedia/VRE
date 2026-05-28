/**
 * VrmaPlayer.ts — playback state manager for a single VRMA clip on one VRM actor.
 *
 * Mirrors the role of THREE.AnimationMixer + clipAction():
 *   - Delegates retargeting to buildVrmaClip() (VrmaLoader.ts)
 *   - Owns the current group + container lifecycle (stop / dispose)
 *
 * Constructor takes a VrmModel (from loadVrm) instead of a raw vrmManager,
 * matching the three-vrm pattern where the VRM object is the retargeting target.
 */

import { VrmModel } from './VrmModel';
import { buildVrmaClip } from './VrmaLoader';

interface FadingGroup {
  group: any;
  container: any;
  startTime: number;
}

export class VrmaPlayer {
  private scene: any;
  private vrm: VrmModel;
  private currentGroup: any = null;
  private currentContainer: any = null;
  private fadingGroups: FadingGroup[] = [];
  private observer: any = null;
  
  public transitionDuration: number = 0.5; // seconds

  constructor(scene: any, vrm: VrmModel) {
    this.scene = scene;
    this.vrm   = vrm;
    
    // Register the update loop for crossfading
    this.observer = this.scene.onBeforeRenderObservable.add(() => this.updateWeights());
  }

  /**
   * Load and play a VRMA clip with crossfading.
   *
   * @param vrmaUrl URL or path to the .vrma file
   * @param loop    Whether to loop the animation (default true)
   * @returns The started AnimationGroup, or null on error
   */
  async play(vrmaUrl: string, loop = true): Promise<any> {
    // If we have a current group, move it to fading
    if (this.currentGroup) {
      this.fadingGroups.push({
        group: this.currentGroup,
        container: this.currentContainer,
        startTime: performance.now()
      });
    }

    let clip;
    try {
      clip = await buildVrmaClip(vrmaUrl, this.vrm, this.scene);
    } catch (err) {
      console.warn('[VrmaPlayer]', err);
      return null;
    }

    const { group, container } = clip;
    this.currentGroup     = group;
    this.currentContainer = container;

    // Start with 0 weight if we are crossfading
    group.weight = this.fadingGroups.length > 0 ? 0 : 1;
    group.start(loop, 1.0, group.from, group.to, false);
    group.goToFrame(group.from);
    
    console.log(`[VrmaPlayer] ${vrmaUrl} — ${group.targetedAnimations.length} tracks (crossfade enabled)`);
    return group;
  }

  private updateWeights(): void {
    const now = performance.now();
    const dt = this.scene.getEngine().getDeltaTime() / 1000;

    // Fade in current group
    if (this.currentGroup && this.currentGroup.weight < 1) {
      this.currentGroup.weight = Math.min(1, this.currentGroup.weight + (dt / this.transitionDuration));
    }

    // Fade out and cleanup old groups
    for (let i = this.fadingGroups.length - 1; i >= 0; i--) {
      const f = this.fadingGroups[i];
      f.group.weight = Math.max(0, f.group.weight - (dt / this.transitionDuration));
      
      if (f.group.weight <= 0) {
        f.group.stop();
        f.group.dispose();
        f.container.dispose();
        this.fadingGroups.splice(i, 1);
      }
    }
  }

  stop(): void {
    this.currentGroup?.stop();
    for (const f of this.fadingGroups) {
      f.group.stop();
    }
  }

  dispose(): void {
    if (this.observer) {
      this.scene.onBeforeRenderObservable.remove(this.observer);
      this.observer = null;
    }
    
    this.currentGroup?.stop();
    this.currentGroup?.dispose();
    this.currentContainer?.dispose();
    this.currentGroup     = null;
    this.currentContainer = null;
    
    for (const f of this.fadingGroups) {
      f.group.stop();
      f.group.dispose();
      f.container.dispose();
    }
    this.fadingGroups = [];
  }
}
