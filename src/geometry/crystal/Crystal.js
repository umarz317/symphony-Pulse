// libs
import * as THREE from 'three'

// shaders
import fragmentShader from './shaders/crystal.frag'
import vertexShader from './shaders/crystal.vert'
import { map } from '../../utils/math'

export default class Crystal {
  constructor (firebaseDB) {
    this.firebaseDB = firebaseDB
    this.docRefGeo = this.firebaseDB.collection('blocks_geometry')
  }

  getCentroid (coord) {
    var center = coord.reduce(function (x, y) {
      return [x[0] + y[0] / coord.length, x[1] + y[1] / coord.length]
    }, [0, 0])
    return center
  }

  async create (block, voronoiDiagram) {
    this.instanceCount = voronoiDiagram.cells.length

    let tubeGeo = new THREE.CylinderGeometry(1, 1, 1, 6)
    tubeGeo.vertices[12].add(new THREE.Vector3(0, 0.03, 0))

    let tubeBufferGeo = new THREE.BufferGeometry().fromGeometry(tubeGeo)

    this.geometry = new THREE.InstancedBufferGeometry().copy(tubeBufferGeo)
    this.geometry.rotateX(Math.PI / 2)

    let offsets = new THREE.InstancedBufferAttribute(new Float32Array(this.instanceCount * 2), 2)
    let scales = new THREE.InstancedBufferAttribute(new Float32Array(this.instanceCount), 1)
    let txValues = new THREE.InstancedBufferAttribute(new Float32Array(this.instanceCount), 1)

    // get min/max tx value in block
    let maxTxValue = 0
    let minTxValue = Number.MAX_SAFE_INTEGER
    block.tx.forEach((tx) => {
      maxTxValue = Math.max(maxTxValue, tx.value)
      minTxValue = Math.min(minTxValue, tx.value)
    })

    for (let i = 0; i < this.instanceCount; i++) {
      if (typeof block.tx[i] === 'undefined') {
        continue
      }
      let cell = voronoiDiagram.cells[i]

      let site = new THREE.Vector2(cell.site.x, cell.site.y)

      // look at all adjacent cells and get the closest site to this site
      let minDistToSite = Number.MAX_SAFE_INTEGER

      cell.halfedges.forEach((halfEdge, index) => {
        if (halfEdge.edge.rSite !== null) {
          let distanceToSiteSq = new THREE.Vector2(halfEdge.edge.rSite.x, halfEdge.edge.rSite.y).distanceToSquared(site)
          if (distanceToSiteSq > 0) {
            minDistToSite = Math.min(minDistToSite, distanceToSiteSq)
          }
        }
        if (halfEdge.edge.lSite !== null) {
          let distanceToSiteSq = new THREE.Vector2(halfEdge.edge.lSite.x, halfEdge.edge.lSite.y).distanceToSquared(site)
          if (distanceToSiteSq > 0) {
            minDistToSite = Math.min(minDistToSite, distanceToSiteSq)
          }
        }
      })

      // let radius = Math.max(0.01, (Math.sqrt(minDistToSite))) * 0.5
      let radius = Math.sqrt(minDistToSite) * 0.5

      offsets.setXY(
        i,
        site.x,
        site.y
      )

      scales.setX(
        i,
        radius
      )

      let tx = block.tx[i]
      txValues.setX(
        i,
        // map(tx.value, minTxValue, maxTxValue, 1.0, 5000.0)
        tx.value
      )
    }

    this.docRefGeo.doc(block.hash).set({
      offsets: JSON.stringify(offsets.array),
      scales: JSON.stringify(scales.array)
    }).then(function () {
      console.log('Document successfully written!')
    }).catch(function (error) {
      console.log('Error writing document: ', error)
    })

    this.geometry.addAttribute('offset', offsets)
    this.geometry.addAttribute('scale', scales)
    this.geometry.addAttribute('txValue', txValues)

    this.material = new CrystalMaterial({
      color: 0xffffff,
      flatShading: true,
      metalness: 0.5,
      roughness: 0.5,
      transparent: false,
      opacity: 1.0
    })

    this.mesh = new THREE.Mesh(this.geometry, this.material)

    this.mesh.frustumCulled = false

    return this.mesh
  }

  async fetch (block, offsetsArray, scalesArray) {
    this.instanceCount = scalesArray.length

    let tubeGeo = new THREE.CylinderGeometry(1, 1, 1, 6)
    tubeGeo.vertices[12].add(new THREE.Vector3(0, 0.03, 0))

    let tubeBufferGeo = new THREE.BufferGeometry().fromGeometry(tubeGeo)

    this.geometry = new THREE.InstancedBufferGeometry().copy(tubeBufferGeo)
    this.geometry.rotateX(Math.PI / 2)

    let offsets = new THREE.InstancedBufferAttribute(new Float32Array(offsetsArray), 2)
    let scales = new THREE.InstancedBufferAttribute(new Float32Array(scalesArray), 1)
    let txValues = new THREE.InstancedBufferAttribute(new Float32Array(this.instanceCount), 1)

    for (let i = 0; i < this.instanceCount; i++) {
      if (typeof block.tx[i] === 'undefined') {
        continue
      }
      let tx = block.tx[i]
      txValues.setX(
        i,
        // map(tx.value, minTxValue, maxTxValue, 1.0, 5000.0)
        tx.value
      )
    }

    this.geometry.addAttribute('offset', offsets)
    this.geometry.addAttribute('scale', scales)
    this.geometry.addAttribute('txValue', txValues)

    this.material = new CrystalMaterial({
      color: 0xffffff,
      flatShading: true,
      metalness: 0.5,
      roughness: 0.5,
      transparent: false,
      opacity: 1.0
    })

    this.mesh = new THREE.Mesh(this.geometry, this.material)

    this.mesh.frustumCulled = false

    return this.mesh
  }
}

class CrystalMaterial extends THREE.MeshStandardMaterial {
  constructor (cfg) {
    super(cfg)
    this.type = 'ShaderMaterial'

    this.uniforms = THREE.ShaderLib.standard.uniforms

    this.uniforms.uTime = {
      type: 'f',
      value: 0.0
    }

    this.vertexShader = vertexShader
    this.fragmentShader = fragmentShader
  }
}
