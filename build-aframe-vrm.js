// Build script to create a custom A-Frame VRM component bundle
// This bundles the official @pixiv/three-vrm libraries with A-Frame's Three.js

const fs = require('fs');
const path = require('path');

console.log('Building A-Frame VRM component with official three-vrm libraries...');

// Create a bundle that wraps the official libraries for use with A-Frame
const bundleCode = `
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

  // Import the official libraries
  // These will be loaded from CDN in the HTML file
  function waitForLibraries() {
    return new Promise((resolve) => {
      const checkLibraries = setInterval(() => {
        if (typeof THREE_VRM !== 'undefined' && typeof THREE_VRM_ANIMATION !== 'undefined') {
          clearInterval(checkLibraries);
          resolve({
            VRMLoaderPlugin: THREE_VRM.VRMLoaderPlugin,
            VRMUtils: THREE_VRM.VRMUtils,
            VRMAnimationLoaderPlugin: THREE_VRM_ANIMATION.VRMAnimationLoaderPlugin,
            createVRMAnimationClip: THREE_VRM_ANIMATION.createVRMAnimationClip,
            VRMLookAtQuaternionProxy: THREE_VRM_ANIMATION.VRMLookAtQuaternionProxy
          });
        }
      }, 50);
    });
  }

  // Initialize components once libraries are loaded
  waitForLibraries().then((libs) => {
    console.log('Official three-vrm libraries loaded:', Object.keys(libs));

    // VRM Model Component
    AFRAME.registerComponent('vrm', {
      schema: {
        src: { type: 'string' },
        lookAt: { type: 'selector' }
      },

      init: function () {
        this.model = null;
        this.vrm = null;
        this.mixer = null;
        this.clock = new THREE.Clock();
      },

      update: function (oldData) {
        const data = this.data;

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
        loop: { default: true }
      },

      init: function () {
        this.vrm = null;
        this.mixer = null;
        this.currentAction = null;
        this.lookAtProxy = null;

        // Listen for VRM model load
        this.onModelLoaded = (e) => {
          this.vrm = e.detail.vrm;
          this.mixer = this.el.components.vrm.mixer;

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
        loader.register((parser) => new libs.VRMAnimationLoaderPlugin(parser));

        try {
          const gltf = await loader.loadAsync(url);
          console.log('Animation file loaded:', url);

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

      remove: function () {
        this.el.removeEventListener('model-loaded', this.onModelLoaded);
        if (this.currentAction) {
          this.currentAction.stop();
        }
      }
    });

    console.log('✓ A-Frame VRM components registered (using official three-vrm libraries)');
  });

})();
`;

// Write the bundle
const outputPath = path.join(__dirname, 'js', 'aframe-vrm-bundle.js');
fs.writeFileSync(outputPath, bundleCode);

console.log('✓ Bundle created:', outputPath);
console.log('');
console.log('To use this bundle, add to your HTML:');
console.log('  <script src="https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@1.0.10/lib/three-vrm.js"></script>');
console.log('  <script src="https://cdn.jsdelivr.net/npm/@pixiv/three-vrm-animation@1.0.3/lib/three-vrm-animation.js"></script>');
console.log('  <script src="js/aframe-vrm-bundle.js"></script>');
