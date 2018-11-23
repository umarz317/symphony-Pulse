// libs
import * as THREE from 'three'

// base geometry class
import Base from '../base/Base'

// shaders
import fragmentShader from './shaders/occlusion.frag'
import vertexShader from './shaders/occlusion.vert'

export default class Occlusion extends Base {
  constructor (args) {
    super(args)

    this.normalMap = new THREE.TextureLoader().load('assets/images/textures/normalMap.jpg')
    this.normalMap.wrapS = THREE.RepeatWrapping
    this.normalMap.wrapT = THREE.RepeatWrapping
    this.normalMap.repeat.set(4, 4)

    this.instanceTotal = 100

    this.blockHeightIndex = {}

    this.cubeMap = new THREE.CubeTextureLoader()
      .setPath('assets/images/textures/cubemaps/playa2/')
      .load([
        '0004.png',
        '0002.png',
        '0006.png',
        '0005.png',
        '0001.png',
        '0003.png'
      ])

    this.material = new OcclusionMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      transparent: true
    })
  }

  async init (blockGeoData) {
    this.planeOffsetsArray = new Float32Array(this.instanceTotal * 2)
    this.quatArray = new Float32Array(this.instanceTotal * 4)

    // set up base geometry
    let planeGeo = new THREE.BoxGeometry(this.planeSize + 10, this.planeSize * 0.18, 0.01, 1, 1, 1)
    let planeGeoTop = planeGeo.clone()
    let planeGeoBottom = planeGeo.clone()

    planeGeo.rotateX(Math.PI / 2)
    planeGeo.rotateY(Math.PI / 2)
    planeGeo.translate(-300, -1.05, 0)
    planeGeo.scale(1, 1, 1.1)

    planeGeoTop.rotateX(Math.PI / 2)
    planeGeoTop.scale(1.18, 1, 10)
    planeGeoTop.translate(0, -1.05, -704.5)

    planeGeoBottom.rotateX(Math.PI / 2)
    planeGeoBottom.scale(1.18, 1, 10)
    planeGeoBottom.translate(0, -1.05, 704.5)

    let planeMesh = new THREE.Mesh(planeGeo)
    let planeMeshTop = new THREE.Mesh(planeGeoTop)
    let planeMeshBottom = new THREE.Mesh(planeGeoBottom)

    let singleGeometry = new THREE.Geometry()

    planeMesh.updateMatrix()
    singleGeometry.merge(planeMesh.geometry, planeMesh.matrix)

    planeMeshTop.updateMatrix()
    singleGeometry.merge(planeMeshTop.geometry, planeMeshTop.matrix)

    planeMeshBottom.updateMatrix()
    singleGeometry.merge(planeMeshBottom.geometry, planeMeshBottom.matrix)

    let planeBufferGeo = new THREE.BufferGeometry().fromGeometry(singleGeometry)

    this.geometry = new THREE.InstancedBufferGeometry().copy(planeBufferGeo)

    let blockPosition = blockGeoData.blockData.pos

    let object = new THREE.Object3D()
    object.position.set(blockPosition.x, 0, blockPosition.z)
    object.lookAt(0, 0, 0)

    this.quatArray[0] = object.quaternion.x
    this.quatArray[1] = object.quaternion.y
    this.quatArray[2] = object.quaternion.z
    this.quatArray[3] = object.quaternion.w

    this.planeOffsetsArray[0] = blockPosition.x
    this.planeOffsetsArray[1] = blockPosition.z

    this.blockHeightIndex[blockGeoData.blockData.height] = 0

    // attributes
    let planeOffsets = new THREE.InstancedBufferAttribute(this.planeOffsetsArray, 2)
    let quaternions = new THREE.InstancedBufferAttribute(this.quatArray, 4)

    this.geometry.addAttribute('planeOffset', planeOffsets)
    this.geometry.addAttribute('quaternion', quaternions)

    this.mesh = new THREE.Mesh(this.geometry, this.material)

    this.mesh.frustumCulled = false

    this.index++

    return this.mesh
  }

  async updateGeometry (blockGeoData) {
    if (this.index + 1 > this.instanceTotal) {
      this.index = 0
    }

    let blockPosition = blockGeoData.blockData.pos

    let object = new THREE.Object3D()
    object.position.set(blockPosition.x, 0, blockPosition.z)
    object.lookAt(0, 0, 0)

    this.blockHeightIndex[blockGeoData.blockData.height] = this.index * 2

    this.geometry.attributes.quaternion.array[this.index * 4 + 0] = object.quaternion.x
    this.geometry.attributes.quaternion.array[this.index * 4 + 1] = object.quaternion.y
    this.geometry.attributes.quaternion.array[this.index * 4 + 2] = object.quaternion.z
    this.geometry.attributes.quaternion.array[this.index * 4 + 3] = object.quaternion.w
    this.geometry.attributes.quaternion.needsUpdate = true

    this.geometry.attributes.planeOffset.array[this.index * 2 + 0] = blockPosition.x
    this.geometry.attributes.planeOffset.array[this.index * 2 + 1] = blockPosition.z
    this.geometry.attributes.planeOffset.needsUpdate = true
    this.index++
  }
}

class OcclusionMaterial extends THREE.MeshStandardMaterial {
  constructor (cfg) {
    super(cfg)
    this.type = 'ShaderMaterial'

    this.uniforms = THREE.ShaderLib.standard.uniforms

    this.uniforms.uTime = {
      type: 'f',
      value: 0.0
    }

    this.uniforms.uOriginOffset = {
      type: 'v2',
      value: new THREE.Vector2(0.0, 0.0)
    }

    this.vertexShader = vertexShader
    this.fragmentShader = fragmentShader
  }
}