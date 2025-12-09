
// A-Frame VRM Component Bundle
// Uses official @pixiv/three-vrm and @pixiv/three-vrm-animation libraries
// Built for Three.js r137 (A-Frame 1.3.0)

(function() {
  'use strict';

  // Check if A-Frame is loaded
  if (typeof AFRAME === 'undefined') {
    console.error('A-Frame not found. Please load A-Frame before this script.');
    return;
  }

  // Wait for THREE and three-vrm libraries to be available
  // These are loaded from the three-vrm UMD builds which add to the THREE global
  if (typeof THREE === 'undefined' ||
      !THREE.VRMLoaderPlugin ||
      !THREE.VRMAnimationLoaderPlugin) {
    console.error('three-vrm libraries not loaded yet. Make sure to load them before aframe-vrm-bundle.js');
    return;
  }

  // Get references to the library functions
  const libs = {
    VRMLoaderPlugin: THREE.VRMLoaderPlugin,
    VRMUtils: THREE.VRMUtils,
    VRMAnimationLoaderPlugin: THREE.VRMAnimationLoaderPlugin,
    createVRMAnimationClip: THREE.createVRMAnimationClip,
    VRMLookAtQuaternionProxy: THREE.VRMLookAtQuaternionProxy
  };

  console.log('Official three-vrm libraries loaded:', Object.keys(libs));

    // VRM Model Component
    AFRAME.registerComponent('vrm', {
      schema: {
        src: { type: 'string' },
        lookAt: { type: 'selector' }
      },

      init: function () {
        console.log('VRM component init called');
        this.model = null;
        this.vrm = null;
        this.mixer = null;
        this.clock = new THREE.Clock();
      },

      update: function (oldData) {
        const data = this.data;
        console.log('VRM component update called with src:', data.src);

        if (oldData.src !== data.src && data.src) {
          this.loadVRM(data.src);
        }

        // Update look-at target
        if (this.vrm && this.vrm.lookAt) {
          if (data.lookAt) {
            if (data.lookAt.tagName === 'A-CAMERA') {
              this.vrm.lookAt.target = this.el.sceneEl.camera;
            } else {
              this.vrm.lookAt.target = data.lookAt.object3D;
            }
          } else {
            this.vrm.lookAt.target = null;
          }
        }
      },

      loadVRM: async function (url) {
        const loader = new THREE.GLTFLoader();

        // Register the official VRMLoaderPlugin
        loader.register((parser) => new libs.VRMLoaderPlugin(parser));

        try {
          const gltf = await loader.loadAsync(url);
          this.vrm = gltf.userData.vrm;
          this.model = this.vrm.scene;

          // Add to A-Frame entity
          this.el.setObject3D('mesh', this.model);

          // Create mixer for animations
          this.mixer = new THREE.AnimationMixer(this.model);

          console.log('VRM loaded successfully:', url);

          // Emit event
          this.el.emit('model-loaded', {
            format: 'vrm',
            model: this.model,
            vrm: this.vrm
          });

        } catch (error) {
          console.error('Error loading VRM:', error);
          this.el.emit('model-error', { src: url, error: error });
        }
      },

      tick: function (time, deltaTime) {
        const delta = deltaTime / 1000;

        if (this.vrm) {
          this.vrm.update(delta);
        }

        if (this.mixer) {
          this.mixer.update(delta);
        }
      },

      remove: function () {
        if (this.model) {
          this.el.removeObject3D('mesh');
        }
        if (this.vrm) {
          libs.VRMUtils.deepDispose(this.vrm.scene);
        }
      }
    });

    // VRM Animation Component (supports VRMA)
    AFRAME.registerComponent('vrm-anim', {
      schema: {
        src: { type: 'string' },
        loop: { default: true },
        fixUpperLegs: { default: true } // Enable upper leg rotation fix
      },

      init: function () {
        this.vrm = null;
        this.mixer = null;
        this.currentAction = null;
        this.lookAtProxy = null;
        this.leftUpperLegBone = null;
        this.rightUpperLegBone = null;

        // Listen for VRM model load
        this.onModelLoaded = (e) => {
          this.vrm = e.detail.vrm;
          this.mixer = this.el.components.vrm.mixer;

          // Cache upper leg bone references for fix
          if (this.vrm.humanoid) {
            const humanBones = this.vrm.humanoid.humanBones;
            this.leftUpperLegBone = humanBones.leftUpperLeg?.node;
            this.rightUpperLegBone = humanBones.rightUpperLeg?.node;
            console.log('Upper leg bones cached:', {
              left: !!this.leftUpperLegBone,
              right: !!this.rightUpperLegBone
            });
          }

          if (this.data.src) {
            this.loadAnimation(this.data.src);
          }
        };

        this.el.addEventListener('model-loaded', this.onModelLoaded);
      },

      update: function (oldData) {
        if (oldData.src !== this.data.src && this.data.src && this.vrm) {
          this.loadAnimation(this.data.src);
        }
      },

      loadAnimation: async function (url) {
        if (!this.vrm || !this.mixer) {
          console.warn('VRM not loaded yet, waiting...');
          return;
        }

        // Stop current animation
        if (this.currentAction) {
          this.currentAction.stop();
          this.currentAction = null;
        }

        const loader = new THREE.GLTFLoader();

        // Register official VRMAnimationLoaderPlugin for VRMA support
        // Note: We need to patch the plugin to assume spec version 1.0 for files without a version
        loader.register((parser) => {
          const plugin = new libs.VRMAnimationLoaderPlugin(parser);
          // Override the afterRoot method to add default spec version if missing
          const originalAfterRoot = plugin.afterRoot.bind(plugin);
          plugin.afterRoot = async function(gltf) {
            // Check if VRMC_vrm_animation extension exists but has no specVersion
            if (gltf.parser.json.extensions && gltf.parser.json.extensions.VRMC_vrm_animation) {
              const vrmcAnim = gltf.parser.json.extensions.VRMC_vrm_animation;
              if (!vrmcAnim.specVersion) {
                console.log('Adding default specVersion "1.0" to VRMA file');
                vrmcAnim.specVersion = '1.0';
              }
            }
            return originalAfterRoot(gltf);
          };
          return plugin;
        });

        try {
          const gltf = await loader.loadAsync(url);
          console.log('Animation file loaded:', url);
          console.log('gltf.userData:', Object.keys(gltf.userData));
          console.log('gltf.userData.vrmAnimations:', gltf.userData.vrmAnimations);

          // Check for VRM animations (VRMA format)
          if (gltf.userData.vrmAnimations && gltf.userData.vrmAnimations.length > 0) {
            const vrmAnimation = gltf.userData.vrmAnimations[0];
            console.log('Using VRM animation (VRMA)');

            // Setup VRMLookAtQuaternionProxy for proper look-at animations
            if (this.vrm.lookAt && !this.lookAtProxy) {
              this.lookAtProxy = new libs.VRMLookAtQuaternionProxy(this.vrm.lookAt);
              this.lookAtProxy.name = 'lookAtQuaternionProxy';
              this.vrm.scene.add(this.lookAtProxy);
              console.log('Created VRMLookAtQuaternionProxy');
            }

            // Use the official createVRMAnimationClip function
            // This handles all coordinate transformations correctly
            const clip = libs.createVRMAnimationClip(vrmAnimation, this.vrm);

            if (clip) {
              console.log('Playing VRM animation clip:', clip.name);
              this.currentAction = this.mixer.clipAction(clip);
              this.currentAction.loop = this.data.loop ? THREE.LoopRepeat : THREE.LoopOnce;
              this.currentAction.play();
            }
          }
          // Fallback to standard glTF animations
          else if (gltf.animations && gltf.animations.length > 0) {
            console.log('Using standard glTF animation');
            const clip = gltf.animations[0];
            this.currentAction = this.mixer.clipAction(clip);
            this.currentAction.loop = this.data.loop ? THREE.LoopRepeat : THREE.LoopOnce;
            this.currentAction.play();
          } else {
            console.warn('No animations found in file:', url);
          }

        } catch (error) {
          console.error('Error loading animation:', error);
        }
      },

      tick: function () {
        // Apply upper leg rotation fix to compensate for CMU mocap coordinate system mismatch
        if (this.data.fixUpperLegs && this.currentAction && this.currentAction.isRunning()) {
          // Fix left upper leg - only invert Z axis (CMU data has opposite signs for L/R)
          if (this.leftUpperLegBone) {
            const euler = new THREE.Euler().setFromQuaternion(this.leftUpperLegBone.quaternion, 'XYZ');
            euler.z = -euler.z;  // Invert Z to prevent crossing
            this.leftUpperLegBone.quaternion.setFromEuler(euler);
          }

          // Fix right upper leg - leave as-is (no inversion needed)
          if (this.rightUpperLegBone) {
            const euler = new THREE.Euler().setFromQuaternion(this.rightUpperLegBone.quaternion, 'XYZ');
            // No changes - CMU data already has correct sign for right leg
            this.rightUpperLegBone.quaternion.setFromEuler(euler);
          }
        }
      },

      remove: function () {
        this.el.removeEventListener('model-loaded', this.onModelLoaded);
        if (this.currentAction) {
          this.currentAction.stop();
        }
      }
    });

  console.log('✓ A-Frame VRM components registered (using official three-vrm libraries)');

})();
