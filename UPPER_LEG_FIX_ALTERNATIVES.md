# Upper Leg Rotation Fix - Alternative Solutions

## Current Status:
- ✓ Z-inversion fixed the crossing
- ⚠️ Right leg has 45° bend issue

## Current Fix (line 252-270):
- **Left leg**: Z-inversion only (WORKING - don't change!)
- **Right leg**: Z + X inversion (testing for 45° bend)

---

## If Right Leg Still Bent - Try These Alternatives

Keep the left leg code unchanged. Only modify the right leg section (lines 263-268).

### Current Right Leg Fix:
```javascript
// Fix right upper leg - invert Z AND X rotation
if (this.rightUpperLegBone) {
  const euler = new THREE.Euler().setFromQuaternion(this.rightUpperLegBone.quaternion, 'XYZ');
  euler.z = -euler.z;
  euler.x = -euler.x;  // Additional fix for right leg bend
  this.rightUpperLegBone.quaternion.setFromEuler(euler);
}
```

### Alternative 1: Invert Z + Y (instead of Z + X)
```javascript
if (this.rightUpperLegBone) {
  const euler = new THREE.Euler().setFromQuaternion(this.rightUpperLegBone.quaternion, 'XYZ');
  euler.z = -euler.z;
  euler.y = -euler.y;
  this.rightUpperLegBone.quaternion.setFromEuler(euler);
}
```

### Alternative 2: Only invert X (no Z inversion for right)
```javascript
if (this.rightUpperLegBone) {
  const euler = new THREE.Euler().setFromQuaternion(this.rightUpperLegBone.quaternion, 'XYZ');
  euler.x = -euler.x;
  this.rightUpperLegBone.quaternion.setFromEuler(euler);
}
```

### Alternative 3: Swap Z and X axes
```javascript
if (this.rightUpperLegBone) {
  const euler = new THREE.Euler().setFromQuaternion(this.rightUpperLegBone.quaternion, 'XYZ');
  const temp = euler.x;
  euler.x = -euler.z;
  euler.z = -temp;
  this.rightUpperLegBone.quaternion.setFromEuler(euler);
}
```

### Alternative 4: Invert Z with 45° X offset
```javascript
if (this.rightUpperLegBone) {
  const euler = new THREE.Euler().setFromQuaternion(this.rightUpperLegBone.quaternion, 'XYZ');
  euler.z = -euler.z;
  euler.x = euler.x - (Math.PI / 4);  // Subtract 45 degrees
  this.rightUpperLegBone.quaternion.setFromEuler(euler);
}
```

### Alternative 5: Invert Z with 90° X offset
```javascript
if (this.rightUpperLegBone) {
  const euler = new THREE.Euler().setFromQuaternion(this.rightUpperLegBone.quaternion, 'XYZ');
  euler.z = -euler.z;
  euler.x = euler.x - (Math.PI / 2);  // Subtract 90 degrees
  this.rightUpperLegBone.quaternion.setFromEuler(euler);
}
```

### Alternative 6: Invert all three axes
```javascript
if (this.rightUpperLegBone) {
  const euler = new THREE.Euler().setFromQuaternion(this.rightUpperLegBone.quaternion, 'XYZ');
  euler.x = -euler.x;
  euler.y = -euler.y;
  euler.z = -euler.z;
  this.rightUpperLegBone.quaternion.setFromEuler(euler);
}
```

### Alternative 7: Mirror left leg fix (only Z inversion)
```javascript
if (this.rightUpperLegBone) {
  const euler = new THREE.Euler().setFromQuaternion(this.rightUpperLegBone.quaternion, 'XYZ');
  euler.z = -euler.z;
  this.rightUpperLegBone.quaternion.setFromEuler(euler);
}
```

---

## Debug: Check Current Rotation Values

Add this to see what rotations are being applied:

```javascript
if (this.rightUpperLegBone) {
  const euler = new THREE.Euler().setFromQuaternion(this.rightUpperLegBone.quaternion, 'XYZ');
  console.log('Right leg rotations (rad):', {
    x: euler.x.toFixed(2),
    y: euler.y.toFixed(2),
    z: euler.z.toFixed(2),
    xDeg: (euler.x * 180 / Math.PI).toFixed(1),
    yDeg: (euler.y * 180 / Math.PI).toFixed(1),
    zDeg: (euler.z * 180 / Math.PI).toFixed(1)
  });
  euler.z = -euler.z;
  euler.x = -euler.x;
  this.rightUpperLegBone.quaternion.setFromEuler(euler);
}
```

This will print rotation values to the browser console (F12) so you can see which axis has the ~45° problem.

---

## How to Test:
1. Edit `/Users/pstdenis/Downloads/VRE/js/aframe-vrm-bundle.js`
2. Replace only the right leg code (lines 263-268)
3. Keep the left leg code unchanged (it's working!)
4. Save and reload browser
5. Check if the right leg bend is fixed
