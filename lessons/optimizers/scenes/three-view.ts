import type { OrbitState, PlainState } from "@narrable/core";
import * as THREE from "three";
import type { OptimizerFrame } from "./frame.js";
import { DOMAIN, sample, type OptimizerName, type Problem, type Trajectory } from "./model.js";
import { intersectLossSurface, normalizedLoss, surfacePoint } from "./surface.js";
import { landscapeBox, SERIES, type View } from "./view.js";

const GRID_CELLS = 56;
const INFERNO_COLORS = [
  "#000004",
  "#1b0c41",
  "#420a68",
  "#6a176e",
  "#932667",
  "#bc3754",
  "#dd513a",
  "#f98e09",
  "#fcffa4",
].map((value) => new THREE.Color(value));

/** Three.js loss surface drawn over the lesson's left-hand viewport. */
export class OptimizerThreeView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private raycaster = new THREE.Raycaster();
  private surface = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>();
  private grid = new THREE.Group();
  private content = new THREE.Group();
  private surfaceKey = "";
  private contentKey = "";
  private sizeKey = "";

  constructor(private canvas2d: HTMLCanvasElement, overlay: HTMLElement) {
    const canvas = canvas2d.ownerDocument.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Navigable three-dimensional loss surface with optimizer paths");
    canvas.style.position = "absolute";
    canvas.style.pointerEvents = "none";
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x050609, 1);
    overlay.append(canvas);

    this.surface.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.04 });
    this.scene.add(this.surface, this.grid, this.content);
    this.scene.add(new THREE.HemisphereLight(0xdde9ff, 0x101218, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(-3, 6, 4);
    this.scene.add(key);
  }

  render(frame: OptimizerFrame, state: Readonly<PlainState>, view: View): void {
    this.resize(view);
    this.updateSurface(frame.problem);
    this.updateContent(frame, state);
    this.updateCamera(state.camera as OrbitState);
    this.renderer.render(this.scene, this.camera);
  }

  projectStart(state: Readonly<PlainState>, view: View): { x: number; y: number } {
    const problem = problemFrom(state);
    this.updateCamera(state.camera as OrbitState);
    const point = surfacePoint(problem.startX, problem.startY, problem, 0.11).project(this.camera);
    const box = landscapeBox(view);
    return {
      x: box.x + ((point.x + 1) / 2) * box.width,
      y: box.y + ((1 - point.y) / 2) * box.height,
    };
  }

  pickSurface(px: number, py: number, state: Readonly<PlainState>, view: View): { x: number; y: number } | undefined {
    const box = landscapeBox(view);
    const pointer = new THREE.Vector2(((px - box.x) / box.width) * 2 - 1, -((py - box.y) / box.height) * 2 + 1);
    this.updateCamera(state.camera as OrbitState);
    this.raycaster.setFromCamera(pointer, this.camera);
    const problem = problemFrom(state);
    const hit = intersectLossSurface(this.raycaster.ray, problem);
    if (!hit) return undefined;
    return { x: clamp(hit.x, -DOMAIN, DOMAIN), y: clamp(-hit.z, -DOMAIN, DOMAIN) };
  }

  dispose(): void {
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize(view: View): void {
    const box = landscapeBox(view);
    const key = `${view.width}:${view.height}`;
    if (key === this.sizeKey) return;
    this.sizeKey = key;
    const dpr = this.canvas2d.clientWidth ? this.canvas2d.width / this.canvas2d.clientWidth : 1;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(box.width / dpr, box.height / dpr, false);
    const canvas = this.renderer.domElement;
    canvas.style.left = `${(box.x / view.width) * 100}%`;
    canvas.style.top = `${(box.y / view.height) * 100}%`;
    canvas.style.width = `${(box.width / view.width) * 100}%`;
    canvas.style.height = `${(box.height / view.height) * 100}%`;
    this.camera.aspect = box.width / box.height;
    this.camera.updateProjectionMatrix();
  }

  private updateSurface(problem: Problem): void {
    const key = `${problem.kappa.toFixed(5)}:${problem.roughness.toFixed(5)}`;
    if (key === this.surfaceKey) return;
    this.surfaceKey = key;
    this.surface.geometry.dispose();
    this.surface.geometry = surfaceGeometry(problem);
    clearGroup(this.grid);
    this.grid.add(...gridLines(problem));
  }

  private updateContent(frame: OptimizerFrame, state: Readonly<PlainState>): void {
    const keys = [
      "kappa",
      "roughness",
      "start.x",
      "start.y",
      "step",
      "active.sgd",
      "active.momentum",
      "active.adamw",
      "sgd.lr",
      "momentum.lr",
      "momentum.beta",
      "adamw.lr",
    ];
    const key = keys.map((name) => String(state[name])).join(":");
    if (key === this.contentKey) return;
    this.contentKey = key;
    clearGroup(this.content);
    this.content.add(startMarker(frame.problem));
    for (const trajectory of frame.trajectories) this.content.add(trajectoryGroup(trajectory, frame.step, frame.problem));
  }

  private updateCamera(orbit: OrbitState): void {
    const horizontal = orbit.distance * Math.cos(orbit.elevation);
    this.camera.position.set(
      orbit.target[0] + horizontal * Math.sin(orbit.azimuth),
      orbit.target[1] + orbit.distance * Math.sin(orbit.elevation),
      orbit.target[2] + horizontal * Math.cos(orbit.azimuth),
    );
    this.camera.lookAt(...orbit.target);
    this.camera.updateMatrixWorld();
  }
}

function surfaceGeometry(problem: Problem): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const color = new THREE.Color();

  for (let row = 0; row <= GRID_CELLS; row++) {
    const y = -DOMAIN + (row / GRID_CELLS) * DOMAIN * 2;
    for (let column = 0; column <= GRID_CELLS; column++) {
      const x = -DOMAIN + (column / GRID_CELLS) * DOMAIN * 2;
      const point = surfacePoint(x, y, problem);
      positions.push(point.x, point.y, point.z);
      const level = normalizedLoss(x, y, problem);
      infernoColor(1 - level, color);
      colors.push(color.r, color.g, color.b);
    }
  }

  const width = GRID_CELLS + 1;
  for (let row = 0; row < GRID_CELLS; row++) {
    for (let column = 0; column < GRID_CELLS; column++) {
      const a = row * width + column;
      const b = a + 1;
      const c = a + width;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function infernoColor(value: number, target: THREE.Color): void {
  const scaled = clamp(value, 0, 1) * (INFERNO_COLORS.length - 1);
  const lower = Math.min(Math.floor(scaled), INFERNO_COLORS.length - 2);
  target.copy(INFERNO_COLORS[lower]!).lerp(INFERNO_COLORS[lower + 1]!, scaled - lower);
}

function gridLines(problem: Problem): THREE.Line[] {
  const lines: THREE.Line[] = [];
  const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16 });
  for (let index = 0; index <= 12; index++) {
    const fixed = -DOMAIN + (index / 12) * DOMAIN * 2;
    const acrossX: THREE.Vector3[] = [];
    const acrossY: THREE.Vector3[] = [];
    for (let point = 0; point <= GRID_CELLS; point++) {
      const value = -DOMAIN + (point / GRID_CELLS) * DOMAIN * 2;
      acrossX.push(surfacePoint(value, fixed, problem, 0.008));
      acrossY.push(surfacePoint(fixed, value, problem, 0.008));
    }
    lines.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(acrossX), material));
    lines.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(acrossY), material));
  }
  return lines;
}

function startMarker(problem: Problem): THREE.Group {
  const group = new THREE.Group();
  const puck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 0.06, 24),
    new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.3 }),
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.105, 0.025, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xcbd0d8 }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(puck, ring);
  group.position.copy(surfacePoint(problem.startX, problem.startY, problem, 0.055));
  return group;
}

function trajectoryGroup(trajectory: Trajectory, step: number, problem: Problem): THREE.Group {
  const group = new THREE.Group();
  const shownStep = Math.min(step, trajectory.points.length - 1);
  const wholeSteps = Math.floor(shownStep);
  const points = trajectory.points.slice(0, wholeSteps + 1);
  if (shownStep > wholeSteps) points.push(sample(trajectory, shownStep));
  const world = points
    .map((point) => surfacePoint(clamp(point.x, -DOMAIN, DOMAIN), clamp(point.y, -DOMAIN, DOMAIN), problem, 0.04))
    .filter((point, index, all) => index === 0 || point.distanceTo(all[index - 1]!) > 1e-5);
  const material = new THREE.MeshBasicMaterial({ color: SERIES[trajectory.name].color });
  if (world.length > 1) {
    const curve = new THREE.CurvePath<THREE.Vector3>();
    for (let index = 1; index < world.length; index++) curve.add(new THREE.LineCurve3(world[index - 1]!, world[index]!));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, world.length * 3), 0.027, 7, false), material));
  }

  const current = sample(trajectory, shownStep);
  const head = markerGeometry(trajectory.name);
  const marker = new THREE.Mesh(head, material);
  marker.position.copy(surfacePoint(clamp(current.x, -DOMAIN, DOMAIN), clamp(current.y, -DOMAIN, DOMAIN), problem, 0.105));
  marker.rotation.y = Math.PI / 4;
  group.add(marker);
  return group;
}

function markerGeometry(name: OptimizerName): THREE.BufferGeometry {
  if (name === "sgd") return new THREE.SphereGeometry(0.09, 16, 10);
  if (name === "momentum") return new THREE.BoxGeometry(0.15, 0.15, 0.15);
  return new THREE.OctahedronGeometry(0.11);
}

function problemFrom(state: Readonly<PlainState>): Problem {
  return {
    kappa: state.kappa as number,
    roughness: state.roughness as number,
    startX: state["start.x"] as number,
    startY: state["start.y"] as number,
  };
}

function clearGroup(group: THREE.Group): void {
  for (const child of [...group.children]) {
    disposeObject(child);
    group.remove(child);
  }
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.Line)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}
