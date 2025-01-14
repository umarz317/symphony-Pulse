import * as THREE from 'three'

/**
 * @author James Baicoianu / http://www.baicoianu.com/
 */

export default class FlyControls {
  constructor (object, domElement) {
    this.object = object

    this.closestBlockBBox = null

    this.domElement = (domElement !== undefined) ? domElement : document
    if (domElement) {
      this.domElement.setAttribute('tabindex', -1)
    }

    this.BBox = null
    this.boxMatrixInverse = null

    // API

    this.movementSpeed = 1.0
    this.rollSpeed = 0.005

    this.dragToLook = false
    this.autoForward = false

    // disable default target object behavior

    // internals

    this.prevCamPos = new THREE.Vector3(0, 0, 0)

    this.tmpQuaternion = new THREE.Quaternion()

    this.mouseStatus = 0

    this.moveState = { up: 0, down: 0, left: 0, right: 0, forward: 0, back: 0, pitchUp: 0, pitchDown: 0, yawLeft: 0, yawRight: 0, rollLeft: 0, rollRight: 0 }
    this.moveVector = new THREE.Vector3(0, 0, 0)
    this.rotationVector = new THREE.Vector3(0, 0, 0)

    this.mousemove = this.bind(this, this.mousemove)
    this.mousedown = this.bind(this, this.mousedown)
    this.mouseup = this.bind(this, this.mouseup)
    this.keydown = this.bind(this, this.keydown)
    this.keyup = this.bind(this, this.keyup)

    this.domElement.addEventListener('contextmenu', this.contextmenu, false)

    this.domElement.addEventListener('mousemove', this.mousemove, false)
    // this.domElement.addEventListener('mousedown', this.mousedown, false)
    // this.domElement.addEventListener('mouseup', this.mouseup, false)

    window.addEventListener('keydown', this.keydown, false)
    window.addEventListener('keyup', this.keyup, false)

    this.updateMovementVector()
    this.updateRotationVector()
  }

  updateClosestBlockBBox (BBox, boxMatrixInverse, BBoxOuter) {
    this.BBox = BBox
    this.BBoxOuter = BBoxOuter
    this.boxMatrixInverse = boxMatrixInverse
  }

  handleEvent (event) {
    if (typeof this[ event.type ] === 'function') {
      this[ event.type ](event)
    }
  }

  keydown (event) {
    if (event.altKey) {
      return
    }

    // event.preventDefault();

    switch (event.keyCode) {
      case 16: /* shift */ this.movementSpeedMultiplier = 0.1; break

      case 87: /* W */ this.moveState.forward = 1; break
      case 83: /* S */ this.moveState.back = 1; break

      case 65: /* A */ this.moveState.left = 1; break
      case 68: /* D */ this.moveState.right = 1; break

      case 82: /* R */ this.moveState.up = 1; break
      case 70: /* F */ this.moveState.down = 1; break

      case 38: /* up */ this.moveState.pitchUp = 1; break
      case 40: /* down */ this.moveState.pitchDown = 1; break

      case 37: /* left */ this.moveState.yawLeft = 1; break
      case 39: /* right */ this.moveState.yawRight = 1; break

      case 81: /* Q */ this.moveState.rollLeft = 1; break
      case 69: /* E */ this.moveState.rollRight = 1; break

      default: break
    }

    this.updateMovementVector()
    this.updateRotationVector()
  }

  keyup (event) {
    switch (event.keyCode) {
      case 16: /* shift */ this.movementSpeedMultiplier = 1; break

      case 87: /* W */ this.moveState.forward = 0; break
      case 83: /* S */ this.moveState.back = 0; break

      case 65: /* A */ this.moveState.left = 0; break
      case 68: /* D */ this.moveState.right = 0; break

      case 82: /* R */ this.moveState.up = 0; break
      case 70: /* F */ this.moveState.down = 0; break

      case 38: /* up */ this.moveState.pitchUp = 0; break
      case 40: /* down */ this.moveState.pitchDown = 0; break

      case 37: /* left */ this.moveState.yawLeft = 0; break
      case 39: /* right */ this.moveState.yawRight = 0; break

      case 81: /* Q */ this.moveState.rollLeft = 0; break
      case 69: /* E */ this.moveState.rollRight = 0; break

      default: break
    }

    this.updateMovementVector()
    this.updateRotationVector()
  }

  mousedown (event) {
    if (this.domElement !== document) {
      this.domElement.focus()
    }

    event.preventDefault()
    event.stopPropagation()

    if (this.dragToLook) {
      this.mouseStatus++
    } else {
      switch (event.button) {
        case 0: this.moveState.forward = 1; break
        case 2: this.moveState.back = 1; break
        default: break
      }

      this.updateMovementVector()
    }
  }

  mousemove (event) {
    if (!this.dragToLook || this.mouseStatus > 0) {
      var container = this.getContainerDimensions()
      var halfWidth = container.size[ 0 ] / 2
      var halfHeight = container.size[ 1 ] / 2

      this.moveState.yawLeft = -((event.pageX - container.offset[ 0 ]) - halfWidth) / halfWidth
      this.moveState.pitchDown = ((event.pageY - container.offset[ 1 ]) - halfHeight) / halfHeight

      this.updateRotationVector()
    }
  }

  mouseup (event) {
    event.preventDefault()
    event.stopPropagation()

    if (this.dragToLook) {
      this.mouseStatus--

      this.moveState.yawLeft = this.moveState.pitchDown = 0
    } else {
      switch (event.button) {
        case 0: this.moveState.forward = 0; break
        case 2: this.moveState.back = 0; break
        default: break
      }

      this.updateMovementVector()
    }

    this.updateRotationVector()
  }

  update (delta) {
    var moveMult = delta * this.movementSpeed
    var rotMult = delta * this.rollSpeed

    this.prevCamPos = this.object.position.clone()

    this.object.translateX(this.moveVector.x * moveMult)
    this.object.translateY(this.moveVector.y * moveMult)
    this.object.translateZ(this.moveVector.z * moveMult)

    if (this.BBox) {
      let inversePoint = this.object.position.clone()
      inversePoint.applyMatrix4(this.boxMatrixInverse)

      if (this.BBoxOuter) {
        if (!this.BBoxOuter.containsPoint(inversePoint)) {
          this.object.position.x = this.prevCamPos.x
          this.object.position.y = this.prevCamPos.y
          this.object.position.z = this.prevCamPos.z
        }
      }

      if (this.BBox.containsPoint(inversePoint)) {
        this.object.position.x = this.prevCamPos.x
        this.object.position.y = this.prevCamPos.y
        this.object.position.z = this.prevCamPos.z
      }
    }

    this.tmpQuaternion.set(this.rotationVector.x * rotMult, this.rotationVector.y * rotMult, this.rotationVector.z * rotMult, 1).normalize()
    this.object.quaternion.multiply(this.tmpQuaternion)

    // expose the rotation vector for convenience
    this.object.rotation.setFromQuaternion(this.object.quaternion, this.object.rotation.order)
  }

  updateMovementVector () {
    var forward = (this.moveState.forward || (this.autoForward && !this.moveState.back)) ? 1 : 0

    this.moveVector.x = (-this.moveState.left + this.moveState.right)
    this.moveVector.y = (-this.moveState.down + this.moveState.up)
    this.moveVector.z = (-forward + this.moveState.back)

    // console.log( 'move:', [ this.moveVector.x, this.moveVector.y, this.moveVector.z ] );
  }

  updateRotationVector () {
    this.rotationVector.x = (-this.moveState.pitchDown + this.moveState.pitchUp)
    this.rotationVector.y = (-this.moveState.yawRight + this.moveState.yawLeft)
    this.rotationVector.z = (-this.moveState.rollRight + this.moveState.rollLeft)

    // console.log( 'rotate:', [ this.rotationVector.x, this.rotationVector.y, this.rotationVector.z ] );
  }

  getContainerDimensions () {
    if (this.domElement !== document) {
      return {
        size: [ this.domElement.offsetWidth, this.domElement.offsetHeight ],
        offset: [ this.domElement.offsetLeft, this.domElement.offsetTop ]
      }
    } else {
      return {
        size: [ window.innerWidth, window.innerHeight ],
        offset: [ 0, 0 ]
      }
    }
  }

  bind (scope, fn) {
    return function () {
      fn.apply(scope, arguments)
    }
  }

  contextmenu (event) {
    event.preventDefault()
  }

  dispose () {
    this.domElement.removeEventListener('contextmenu', this.contextmenu, false)
    this.domElement.removeEventListener('mousedown', this.mousedown, false)
    this.domElement.removeEventListener('mousemove', this.mousemove, false)
    this.domElement.removeEventListener('mouseup', this.mouseup, false)

    window.removeEventListener('keydown', this.keydown, false)
    window.removeEventListener('keyup', this.keyup, false)
  }
}
