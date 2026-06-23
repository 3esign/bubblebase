"use client";

import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";

export interface GameNode {
  id: string;
  x: number;
  y: number;
  owner: string;
  connectionsCount: number;
}

export interface GameConnection {
  from: string;
  to: string;
  isPending: boolean;
  lastNurturedAt?: number;
  boostMultiplier?: number;
}

interface GameMapProps {
  isDemoMode: boolean;
  nodes: GameNode[];
  connections: GameConnection[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  userAddress: string | null;
  onPlaceNode: (x: number, y: number) => void;
  onConnectNodes: (fromId: string, toId: string) => void;
  pendingTx: boolean;
  agentNodeIds?: Set<string>;
}

const ISO_PITCH = 0.6;

// Maps world grid coordinates (wx, wy) and vertical height (wz) to 2D screen space
const toIso = (wx: number, wy: number, wz: number = 0) => {
  const rx = (wx - wy) / Math.SQRT2;
  const ry = ((wx + wy) / Math.SQRT2) * ISO_PITCH - wz;
  return { x: rx, y: ry };
};

// Maps 2D screen ground coordinates back to world grid coordinates
const fromIso = (rx: number, ry: number) => {
  const wx = (rx + ry / ISO_PITCH) / Math.SQRT2;
  const wy = (ry / ISO_PITCH - rx) / Math.SQRT2;
  return { x: wx, y: wy };
};

// Local projection helper for drawing 3D geometry inside a node's container (0,0 is ground center)
const project = (lx: number, ly: number, lz: number = 0) => {
  const rx = (lx - ly) / Math.SQRT2;
  const ry = ((lx + ly) / Math.SQRT2) * ISO_PITCH - lz;
  return { x: rx, y: ry };
};

// Helper to draw an isometric prism (tower segment)
const drawPrism = (
  graphics: PIXI.Graphics,
  bw: number,
  tw: number,
  z0: number,
  z1: number,
  ox: number = 0,
  oy: number = 0,
  lineAlpha: number = 0.8,
  baseColor: number = 0x1e293b,
  highlightColor: number = 0x3b82f6
) => {
  const b1 = project(-bw + ox, -bw + oy, z0); // North
  const b2 = project(bw + ox, -bw + oy, z0);  // East
  const b3 = project(bw + ox, bw + oy, z0);   // South
  const b4 = project(-bw + ox, bw + oy, z0);  // West

  const t1 = project(-tw + ox, -tw + oy, z1);
  const t2 = project(tw + ox, -tw + oy, z1);
  const t3 = project(tw + ox, tw + oy, z1);
  const t4 = project(-tw + ox, tw + oy, z1);

  // Solid Sci-Fi Faces
  // Right Face (East/South) - Medium Light
  graphics.poly([b2.x, b2.y, b3.x, b3.y, t3.x, t3.y, t2.x, t2.y], true);
  graphics.fill({ color: baseColor, alpha: 0.95 });

  // Left Face (West/South) - Shadow
  graphics.poly([b3.x, b3.y, b4.x, b4.y, t4.x, t4.y, t3.x, t3.y], true);
  graphics.fill({ color: 0x0f172a, alpha: 0.95 });

  // Top Cap - Brightest
  graphics.poly([t1.x, t1.y, t2.x, t2.y, t3.x, t3.y, t4.x, t4.y], true);
  graphics.fill({ color: 0x334155, alpha: 1.0 });

  // Neon Edge Accents
  graphics.moveTo(b1.x, b1.y); graphics.lineTo(t1.x, t1.y);
  graphics.moveTo(b2.x, b2.y); graphics.lineTo(t2.x, t2.y);
  graphics.moveTo(b3.x, b3.y); graphics.lineTo(t3.x, t3.y);
  graphics.moveTo(b4.x, b4.y); graphics.lineTo(t4.x, t4.y);

  graphics.poly([b1.x, b1.y, b2.x, b2.y, b3.x, b3.y, b4.x, b4.y], true);
  graphics.poly([t1.x, t1.y, t2.x, t2.y, t3.x, t3.y, t4.x, t4.y], true);
  graphics.stroke({ width: 1.5, color: highlightColor, alpha: lineAlpha });

  // Power conduits (vertical center lines for high-tier detail)
  if (bw > 6) {
    const bcSE = project(bw + ox, oy, z0);
    const tcSE = project(tw + ox, oy, z1);
    graphics.moveTo(bcSE.x, bcSE.y); graphics.lineTo(tcSE.x, tcSE.y);

    const bcSW = project(ox, bw + oy, z0);
    const tcSW = project(ox, tw + oy, z1);
    graphics.moveTo(bcSW.x, bcSW.y); graphics.lineTo(tcSW.x, tcSW.y);

    graphics.stroke({ width: 1, color: highlightColor, alpha: lineAlpha * 1.5 });
  }
};

interface Pulse {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  speed: number;
  color: number;
}

interface NodeContainerData {
  container: PIXI.Container;
  groundPlate: PIXI.Graphics;
  spire: PIXI.Graphics;
  floatingCore: PIXI.Container;
  ringsWorldContainer: PIXI.Container;
  rotatingRings: PIXI.Graphics[];
  satellitesList?: PIXI.Graphics[];
  sparksGraphics?: PIXI.Graphics;
  sparks?: any[];
  glowRing: PIXI.Graphics;
  baseHeight: number;
  tier: number;
  phase: number;
  connectionsCount: number;
  owner: string;
  bobSpeed: number;
  spinSpeed: number;
}

export default function GameMap({
  isDemoMode,
  nodes,
  connections,
  selectedNodeId,
  onSelectNode,
  userAddress,
  onPlaceNode,
  onConnectNodes,
  pendingTx,
  agentNodeIds = new Set(),
}: GameMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  
  const rebuildRef = useRef<(() => void) | null>(null);
  const updateVisualsRef = useRef<(() => void) | null>(null);

  const stateRef = useRef({
    nodes,
    connections,
    selectedNodeId,
    userAddress,
    pendingTx,
    agentNodeIds,
  });

  useEffect(() => {
    stateRef.current = { nodes, connections, selectedNodeId, userAddress, pendingTx, agentNodeIds };
    if (rebuildRef.current) rebuildRef.current();
  }, [nodes, connections, userAddress, agentNodeIds]);

  useEffect(() => {
    stateRef.current.selectedNodeId = selectedNodeId;
    stateRef.current.pendingTx = pendingTx;
    if (updateVisualsRef.current) updateVisualsRef.current();
  }, [selectedNodeId, pendingTx]);

  useEffect(() => {
    if (!containerRef.current) return;

    let app: PIXI.Application;
    let isDestroyed = false;
    let isInitialized = false;
    let handleWheel: ((e: WheelEvent) => void) | null = null;

    const initPixi = async () => {
      app = new PIXI.Application();
      await app.init({
        resizeTo: containerRef.current!,
        backgroundColor: 0x050511,
        antialias: true,
      });

      app.canvas.style.position = "absolute";
      app.canvas.style.top = "0";
      app.canvas.style.left = "0";
      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";

      if (isDestroyed) {
        app.destroy(true);
        return;
      }

      containerRef.current?.appendChild(app.canvas);
      isInitialized = true;
      appRef.current = app;

      app.stage.eventMode = "static";
      app.stage.hitArea = new PIXI.Rectangle(-10000, -10000, 20000, 20000);

      // Camera Container (No rotation, standard 2D view mapping ISO points)
      const world = new PIXI.Container();
      world.x = window.innerWidth / 2;
      world.y = window.innerHeight / 2;
      world.scale.set(0.65); // Uniform scale for zooming
      app.stage.addChild(world);

      // Ambient Environment Particles Container (Data-dust / Stars)
      const ambientContainer = new PIXI.Container();
      world.addChild(ambientContainer);
      const ambientGraphics = new PIXI.Graphics();
      ambientContainer.addChild(ambientGraphics);

      const ambientParticles = Array.from({length: 250}).map(() => ({
        x: (Math.random() - 0.5) * 6000,
        y: (Math.random() - 0.5) * 6000,
        z: Math.random() * 150 - 50,
        size: Math.random() * 1.5 + 0.5,
        speedY: (Math.random() * 0.3 - 0.15),
        speedX: (Math.random() * 0.3 - 0.15),
        alphaOffset: Math.random() * Math.PI * 2,
        alphaSpeed: Math.random() * 0.02 + 0.01,
        color: Math.random() > 0.5 ? 0x00d2ff : 0x8b5cf6
      }));

      const gridGraphics = new PIXI.Graphics();
      world.addChild(gridGraphics);

      const fieldsContainer = new PIXI.Container();
      const blurFilter = new PIXI.BlurFilter();
      blurFilter.blur = 25;
      fieldsContainer.filters = [blurFilter];
      world.addChild(fieldsContainer);

      const fieldsGraphics = new PIXI.Graphics();
      fieldsContainer.addChild(fieldsGraphics);

      const nodesContainer = new PIXI.Container();
      world.addChild(nodesContainer);

      const heatMapContainer = new PIXI.Container();
      const connBlur = new PIXI.BlurFilter();
      connBlur.blur = 20; // High blur for heat map congestion
      heatMapContainer.filters = [connBlur];
      world.addChild(heatMapContainer);

      const heatMapLinks = new PIXI.Graphics();
      heatMapContainer.addChild(heatMapLinks);

      const explicitLinesContainer = new PIXI.Container();
      world.addChild(explicitLinesContainer);

      const explicitLinks = new PIXI.Graphics();
      explicitLinesContainer.addChild(explicitLinks);

      const explicitPulses = new PIXI.Graphics();
      explicitLinesContainer.addChild(explicitPulses);

      const previewGraphics = new PIXI.Graphics();
      world.addChild(previewGraphics);

      const nodeContainersMap = new Map<string, NodeContainerData>();
      const pulsesRef = { current: [] as Pulse[] };
      let hoveredNodeId: string | null = null;
      let worldMousePos = { x: 0, y: 0 }; // In local grid coordinates
      let isDragging = false;
      let lastPos = { x: 0, y: 0 };

      const drawDashedLine = (
        graphics: PIXI.Graphics,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        dashLength = 6,
        gapLength = 4
      ) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        let currentDist = 0;
        let draw = true;

        while (currentDist < distance) {
          const len = Math.min(dashLength, distance - currentDist);
          const nextDist = currentDist + len;
          
          if (draw) {
            graphics.moveTo(
              x1 + Math.cos(angle) * currentDist,
              y1 + Math.sin(angle) * currentDist
            );
            graphics.lineTo(
              x1 + Math.cos(angle) * nextDist,
              y1 + Math.sin(angle) * nextDist
            );
          }
          
          currentDist = nextDist + (draw ? gapLength : 0);
          draw = !draw;
        }
      };

      const drawGrid = () => {
        gridGraphics.clear();
        const gridSize = 100;
        const gridExtent = 2500;
        
        // Base lines
        for (let i = -gridExtent; i <= gridExtent; i += gridSize) {
          const px1 = toIso(i, -gridExtent, 0);
          const px2 = toIso(i, gridExtent, 0);
          gridGraphics.moveTo(px1.x, px1.y);
          gridGraphics.lineTo(px2.x, px2.y);
          
          const py1 = toIso(-gridExtent, i, 0);
          const py2 = toIso(gridExtent, i, 0);
          gridGraphics.moveTo(py1.x, py1.y);
          gridGraphics.lineTo(py2.x, py2.y);
        }
        gridGraphics.stroke({ width: 0.8, color: 0x1e293b, alpha: 0.25 });

        // Glowing crosshairs
        const maxDist = 2000;
        for (let x = -maxDist; x <= maxDist; x += gridSize) {
          for (let y = -maxDist; y <= maxDist; y += gridSize) {
            const dist = Math.sqrt(x * x + y * y);
            if (dist > maxDist) continue;
            
            const alpha = (1 - dist / maxDist) * 0.25;
            const cx1 = toIso(x - 5, y, 0);
            const cx2 = toIso(x + 5, y, 0);
            const cy1 = toIso(x, y - 5, 0);
            const cy2 = toIso(x, y + 5, 0);
            
            gridGraphics.moveTo(cx1.x, cx1.y);
            gridGraphics.lineTo(cx2.x, cx2.y);
            gridGraphics.moveTo(cy1.x, cy1.y);
            gridGraphics.lineTo(cy2.x, cy2.y);
            gridGraphics.stroke({ width: 1, color: 0x3b82f6, alpha });
          }
        }
      };

      const drawPreviews = () => {
        const {
          nodes: currentNodes,
          selectedNodeId: currentSelectedId,
          userAddress: currentUserAddr,
        } = stateRef.current;

        previewGraphics.clear();

        const snapX = Math.round(worldMousePos.x / 100);
        const snapY = Math.round(worldMousePos.y / 100);
        const nodeAtCursor = currentNodes.find((n) => n.x === snapX && n.y === snapY);
        const selectedNode = currentNodes.find((n) => n.id === currentSelectedId);

        if (
          selectedNode &&
          selectedNode.owner.toLowerCase() === currentUserAddr?.toLowerCase() &&
          hoveredNodeId &&
          hoveredNodeId !== currentSelectedId
        ) {
          const targetNode = currentNodes.find((n) => n.id === hoveredNodeId);
          if (targetNode) {
            const getH = (c: number) => c >= 6 ? 110 : (c >= 4 ? 80 : (c >= 2 ? 55 : 30));
            const p1 = toIso(selectedNode.x * 100, selectedNode.y * 100, getH(selectedNode.connectionsCount));
            const p2 = toIso(targetNode.x * 100, targetNode.y * 100, getH(targetNode.connectionsCount));

            drawDashedLine(previewGraphics, p1.x, p1.y, p2.x, p2.y, 6, 4);
            previewGraphics.stroke({ width: 2, color: 0x10b881, alpha: 0.8 });
          }
        }

        if (!nodeAtCursor && Math.abs(snapX) < 40 && Math.abs(snapY) < 40) {
          const px = snapX * 100;
          const py = snapY * 100;
          const color = 0x10b881;
          
          drawPrism(previewGraphics, 15, 8, 0, 28, px, py, 0.4);
          
          // Tint the prism hologram green
          previewGraphics.tint = color;
          
          const core = toIso(px, py, 28);
          previewGraphics.circle(core.x, core.y, 4);
          previewGraphics.fill({ color: 0xffffff, alpha: 0.5 });
          previewGraphics.stroke({ width: 0.8, color: 0xffffff, alpha: 0.7 });
        }
      };

      const updateVisualStates = () => {
        const { selectedNodeId: currentSelectedId, userAddress: currentUserAddr, agentNodeIds: currentAgentNodeIds } = stateRef.current;

        nodeContainersMap.forEach((nodeData, id) => {
          const isSelected = id === currentSelectedId;
          const isHovered = id === hoveredNodeId;
          const isUserOwned = nodeData.owner.toLowerCase() === currentUserAddr?.toLowerCase();
          const isAgentOwned = currentAgentNodeIds?.has(id);

          const activeColor = isSelected ? 0xf59e0b : isHovered ? 0xffffff : isUserOwned ? 0x10b881 : isAgentOwned ? 0x8b5cf6 : 0x3b82f6;

          nodeData.groundPlate.tint = activeColor;
          nodeData.spire.tint = activeColor;
          nodeData.floatingCore.children.forEach((child: any) => {
            if (child.tint !== undefined) child.tint = activeColor;
            if (child.children) {
               child.children.forEach((c: any) => { if (c.tint !== undefined) c.tint = activeColor; });
            }
          });
          if (nodeData.sparksGraphics) nodeData.sparksGraphics.tint = activeColor;

          if (isSelected) {
            nodeData.glowRing.visible = true;
            nodeData.glowRing.tint = 0xf59e0b;
            nodeData.glowRing.alpha = 0.8;
          } else if (isHovered) {
            nodeData.glowRing.visible = true;
            nodeData.glowRing.tint = 0x3b82f6;
            nodeData.glowRing.alpha = 0.4;
          } else {
            nodeData.glowRing.visible = false;
          }

          const targetScale = isHovered ? 1.12 : (isSelected ? 1.05 : 1.0);
          nodeData.container.scale.set(targetScale);
        });
      };

      const rebuildNetwork = () => {
        const {
          nodes: currentNodes,
          connections: currentConns,
          selectedNodeId: currentSelectedId,
          userAddress: currentUserAddr,
          agentNodeIds: currentAgentNodeIds,
        } = stateRef.current;

        // Destroy old containers to release GPU memory and event listeners
        nodeContainersMap.forEach((nodeData) => {
          nodeData.container.destroy({ children: true });
        });
        nodeContainersMap.clear();

        nodesContainer.removeChildren();

        drawGrid();

        fieldsGraphics.clear();
        currentNodes.forEach((node) => {
          const isUserOwned = node.owner.toLowerCase() === currentUserAddr?.toLowerCase();
          const isSelected = node.id === currentSelectedId;
          const isAgentOwned = currentAgentNodeIds?.has(node.id);
          
          // Influence Territories: Inner core + outer boundary fields
          const coreRadius = 40 + Math.min(node.connectionsCount * 12, 100);
          const outerRadius = 140 + Math.min(node.connectionsCount * 20, 160);
          const territoryColor = isSelected ? 0xf59e0b : isUserOwned ? 0x10b881 : isAgentOwned ? 0x8b5cf6 : 0x3b82f6;
          
          const p = toIso(node.x * 100, node.y * 100, 0);
          
          // Inner Node Core Field
          fieldsGraphics.ellipse(p.x, p.y, coreRadius, coreRadius * ISO_PITCH);
          fieldsGraphics.fill({ color: territoryColor, alpha: 0.12 });
          
          // Outer Influence territory zone
          fieldsGraphics.ellipse(p.x, p.y, outerRadius, outerRadius * ISO_PITCH);
          fieldsGraphics.fill({ color: territoryColor, alpha: 0.035 });
          fieldsGraphics.stroke({ width: 0.8, color: territoryColor, alpha: 0.15 });
        });

        heatMapLinks.clear();
        explicitLinks.clear();
        currentConns.forEach((conn) => {
          const fromNode = currentNodes.find((n) => n.id === conn.from);
          const toNode = currentNodes.find((n) => n.id === conn.to);
          if (!fromNode || !toNode) return;

          const getH = (c: number) => c >= 6 ? 110 : (c >= 4 ? 80 : (c >= 2 ? 55 : 30));
          const p1 = toIso(fromNode.x * 100, fromNode.y * 100, getH(fromNode.connectionsCount));
          const p2 = toIso(toNode.x * 100, toNode.y * 100, getH(toNode.connectionsCount));

          const lastNurtured = conn.lastNurturedAt || 0;
          const timeElapsed = Date.now() / 1000 - lastNurtured;
          const isDecayed = !conn.isPending && lastNurtured > 0 && timeElapsed > 86400;
          const isNearDecay = !conn.isPending && lastNurtured > 0 && !isDecayed && (86400 - timeElapsed < 21600); // 6 hours warning limit

          if (isDecayed) {
            explicitLinks.moveTo(p1.x, p1.y); explicitLinks.lineTo(p2.x, p2.y);
            explicitLinks.stroke({ width: 1.5, color: 0x475569, alpha: 0.35 });
            heatMapLinks.moveTo(p1.x, p1.y); heatMapLinks.lineTo(p2.x, p2.y);
            heatMapLinks.stroke({ width: 10, color: 0x475569, alpha: 0.1 });
          } else if (conn.isPending) {
            drawDashedLine(explicitLinks, p1.x, p1.y, p2.x, p2.y, 8, 6);
            explicitLinks.stroke({ width: 2, color: 0xf59e0b, alpha: 0.7 });
            heatMapLinks.moveTo(p1.x, p1.y); heatMapLinks.lineTo(p2.x, p2.y);
            heatMapLinks.stroke({ width: 15, color: 0xf59e0b, alpha: 0.2 });
          } else if (isNearDecay) {
            // Decay warning line (Amber glow + Red warnings)
            drawDashedLine(explicitLinks, p1.x, p1.y, p2.x, p2.y, 4, 3);
            explicitLinks.stroke({ width: 2, color: 0xef4444, alpha: 0.85 });
            heatMapLinks.moveTo(p1.x, p1.y); heatMapLinks.lineTo(p2.x, p2.y);
            heatMapLinks.stroke({ width: 20, color: 0xf59e0b, alpha: 0.25 });
          } else {
            const mult = (conn.boostMultiplier || 100) / 100;
            
            // Elevated Sci-Fi Highway Base
            explicitLinks.moveTo(p1.x, p1.y); explicitLinks.lineTo(p2.x, p2.y);
            explicitLinks.stroke({ width: 12 * mult, color: 0x050814, alpha: 0.9 });
            
            // Glowing neon lanes
            explicitLinks.moveTo(p1.x, p1.y); explicitLinks.lineTo(p2.x, p2.y);
            explicitLinks.stroke({ width: 4 * mult, color: 0x3b82f6, alpha: 0.5 * mult });
            explicitLinks.moveTo(p1.x, p1.y); explicitLinks.lineTo(p2.x, p2.y);
            explicitLinks.stroke({ width: 1.5 * mult, color: 0xb3e5fc, alpha: 0.9 });
            
            // Blurred Heat Map Congestion Lines
            heatMapLinks.moveTo(p1.x, p1.y); heatMapLinks.lineTo(p2.x, p2.y);
            heatMapLinks.stroke({ width: 30 * mult, color: 0x3b82f6, alpha: 0.15 * mult });
            heatMapLinks.moveTo(p1.x, p1.y); heatMapLinks.lineTo(p2.x, p2.y);
            heatMapLinks.stroke({ width: 15 * mult, color: 0x00d2ff, alpha: 0.3 });
          }
        });

        const pulses: Pulse[] = [];
        currentConns.forEach((conn) => {
          if (conn.isPending) return;
          const lastNurtured = conn.lastNurturedAt || 0;
          if (lastNurtured > 0 && (Date.now() / 1000 > lastNurtured + 86400)) return;

          const fromNode = currentNodes.find((n) => n.id === conn.from);
          const toNode = currentNodes.find((n) => n.id === conn.to);
          if (!fromNode || !toNode) return;

          const getH = (c: number) => c >= 6 ? 110 : (c >= 4 ? 80 : (c >= 2 ? 55 : 30));
          const p1 = toIso(fromNode.x * 100, fromNode.y * 100, getH(fromNode.connectionsCount));
          const p2 = toIso(toNode.x * 100, toNode.y * 100, getH(toNode.connectionsCount));

          const mult = (conn.boostMultiplier || 100) / 100;
          const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
          const numPulses = Math.floor((dist > 300 ? 2 : 1) * mult);
          
          for (let i = 0; i < numPulses; i++) {
            pulses.push({
              fromX: p1.x, fromY: p1.y, toX: p2.x, toY: p2.y,
              progress: Math.random(),
              speed: ((0.15 + Math.random() * 0.15) * mult) / 100,
              color: 0x00d2ff,
            });
          }
        });
        pulsesRef.current = pulses;

        // Build 3D Parametric Spire Nodes
        currentNodes.forEach((node) => {
          const isAgentOwned = currentAgentNodeIds?.has(node.id);
          const color = node.id === currentSelectedId ? 0xf59e0b : 
                       (node.owner.toLowerCase() === currentUserAddr?.toLowerCase() ? 0x10b881 : (isAgentOwned ? 0x8b5cf6 : 0x3b82f6));

          const seed = parseInt(node.id.substring(node.id.length - 8), 16) || Math.abs(node.x * 17 + node.y * 31);
          const rand = (s: number) => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };
          const r1 = rand(seed + 1); const r2 = rand(seed + 2);
          const r3 = rand(seed + 3); const r4 = rand(seed + 4);

          let tier = 0;
          if (node.connectionsCount >= 6) tier = 3;
          else if (node.connectionsCount >= 4) tier = 2;
          else if (node.connectionsCount >= 2) tier = 1;

          const baseW = tier === 3 ? 24 + r1 * 4 : (tier === 2 ? 20 + r1 * 3 : (tier === 1 ? 16 + r1 * 2 : 12 + r1 * 2));
          const height = tier === 3 ? 110 + r2 * 20 : (tier === 2 ? 80 + r2 * 15 : (tier === 1 ? 55 + r2 * 10 : 30 + r2 * 5));

          const nodeContainer = new PIXI.Container();
          const nodePos = toIso(node.x * 100, node.y * 100, 0);
          nodeContainer.x = nodePos.x;
          nodeContainer.y = nodePos.y;

          const isUserOwned = node.owner.toLowerCase() === currentUserAddr?.toLowerCase();
          const isSelected = node.id === currentSelectedId;
          const highlightColor = isSelected ? 0xf59e0b : isUserOwned ? 0x10b881 : isAgentOwned ? 0x8b5cf6 : 0x3b82f6;
          const baseColor = isUserOwned ? 0x1e293b : isAgentOwned ? 0x1e1b4b : 0x0f172a; 

          // Ground Plate Foundation (High-tech geometric plating)
          const groundPlate = new PIXI.Graphics();
          const s1 = project(-baseW * 1.8, -baseW * 1.8, 0);
          const s2 = project(baseW * 1.8, -baseW * 1.8, 0);
          const s3 = project(baseW * 1.8, baseW * 1.8, 0);
          const s4 = project(-baseW * 1.8, baseW * 1.8, 0);
          groundPlate.poly([s1.x, s1.y, s2.x, s2.y, s3.x, s3.y, s4.x, s4.y], true);
          groundPlate.fill({ color: 0x050814, alpha: 0.9 });
          groundPlate.stroke({ width: 2, color: highlightColor, alpha: 0.3 });

          // Socket Base
          drawPrism(groundPlate, baseW * 1.4, baseW * 1.4, 0, 4, 0, 0, 0.5, 0x0f172a, highlightColor);
          
          // Defensive Data-Walls for Tier 2+
          if (tier >= 2) {
            const wallDist = baseW * 1.6;
            drawPrism(groundPlate, baseW * 0.4, baseW * 0.2, 0, 15, wallDist, 0, 0.4, 0x1e293b, highlightColor);
            drawPrism(groundPlate, baseW * 0.4, baseW * 0.2, 0, 15, -wallDist, 0, 0.4, 0x1e293b, highlightColor);
            drawPrism(groundPlate, baseW * 0.4, baseW * 0.2, 0, 15, 0, wallDist, 0.4, 0x1e293b, highlightColor);
            drawPrism(groundPlate, baseW * 0.4, baseW * 0.2, 0, 15, 0, -wallDist, 0.4, 0x1e293b, highlightColor);
          }
          nodeContainer.addChild(groundPlate);

          const glowRing = new PIXI.Graphics();
          glowRing.ellipse(0, 0, baseW * 2, baseW * 2 * ISO_PITCH);
          glowRing.stroke({ width: 2, color: highlightColor, alpha: 0.8 });
          glowRing.visible = false;
          nodeContainer.addChild(glowRing);

          // Tower Obelisk Parametric Segments (Solid Sci-Fi Architecture)
          const spire = new PIXI.Graphics();
          if (tier === 0) {
            drawPrism(spire, baseW, baseW * 0.45, 4, height, 0, 0, 0.8, baseColor, highlightColor);
          } else if (tier === 1) {
            drawPrism(spire, baseW, baseW * 0.7, 4, height * 0.55, 0, 0, 0.8, baseColor, highlightColor);
            drawPrism(spire, baseW * 0.6, baseW * 0.35, height * 0.55, height, 0, 0, 0.8, baseColor, highlightColor);
          } else if (tier === 2) {
            drawPrism(spire, baseW, baseW * 0.8, 4, height * 0.35, 0, 0, 0.8, baseColor, highlightColor);
            drawPrism(spire, baseW * 0.7, baseW * 0.5, height * 0.35, height * 0.7, 0, 0, 0.8, baseColor, highlightColor);
            drawPrism(spire, baseW * 0.4, baseW * 0.2, height * 0.7, height, 0, 0, 0.8, baseColor, highlightColor);
            const cpDist = baseW * 1.3;
            drawPrism(spire, 3, 1.5, 4, 25, cpDist, cpDist, 0.6, baseColor, highlightColor);
            drawPrism(spire, 3, 1.5, 4, 25, -cpDist, cpDist, 0.6, baseColor, highlightColor);
            drawPrism(spire, 3, 1.5, 4, 25, cpDist, -cpDist, 0.6, baseColor, highlightColor);
            drawPrism(spire, 3, 1.5, 4, 25, -cpDist, -cpDist, 0.6, baseColor, highlightColor);
          } else if (tier === 3) {
            drawPrism(spire, baseW, baseW * 0.85, 4, height * 0.3, 0, 0, 0.9, baseColor, highlightColor);
            drawPrism(spire, baseW * 0.75, baseW * 0.55, height * 0.3, height * 0.65, 0, 0, 0.9, baseColor, highlightColor);
            drawPrism(spire, baseW * 0.5, baseW * 0.25, height * 0.65, height, 0, 0, 0.9, baseColor, highlightColor);
            const cpDist = baseW * 1.4;
            drawPrism(spire, 5, 2, 4, 40, cpDist, cpDist, 0.7, baseColor, highlightColor);
            drawPrism(spire, 5, 2, 4, 40, -cpDist, cpDist, 0.7, baseColor, highlightColor);
            drawPrism(spire, 5, 2, 4, 40, cpDist, -cpDist, 0.7, baseColor, highlightColor);
            drawPrism(spire, 5, 2, 4, 40, -cpDist, -cpDist, 0.7, baseColor, highlightColor);
          }
          nodeContainer.addChild(spire);

          // Sparks Emitter (Tier 3)
          let sparksGraphics: PIXI.Graphics | undefined;
          let sparks: any[] | undefined;
          if (tier === 3) {
             sparksGraphics = new PIXI.Graphics();
             sparks = Array.from({length: 8}).map(() => ({
                x: (Math.random() - 0.5) * 20,
                y: (Math.random() - 0.5) * 20,
                z: height + Math.random() * 40,
                speed: 0.5 + Math.random() * 1.5,
                life: Math.random()
             }));
             nodeContainer.addChild(sparksGraphics);
          }

          // Floating Crystal Core
          const floatingCore = new PIXI.Container();
          const corePos = project(0, 0, height);
          floatingCore.x = corePos.x;
          floatingCore.y = corePos.y;
          nodeContainer.addChild(floatingCore);

          const crystal = new PIXI.Graphics();
          const cw = tier >= 2 ? 8 + r3 * 2 : (tier === 1 ? 6 : 4);
          const ch = cw * 1.8;
          
          const top = project(0, 0, ch);
          const bot = project(0, 0, -ch);
          const cN = project(-cw, -cw, 0);
          const cE = project(cw, -cw, 0);
          const cS = project(cw, cw, 0);
          const cW = project(-cw, cw, 0);
          
          crystal.poly([cE.x, cE.y, cS.x, cS.y, top.x, top.y], true);
          crystal.fill({ color: 0xffffff, alpha: 0.6 });
          crystal.poly([cS.x, cS.y, cW.x, cW.y, top.x, top.y], true);
          crystal.fill({ color: 0xffffff, alpha: 0.8 });
          crystal.poly([cE.x, cE.y, cN.x, cN.y, top.x, top.y], true);
          crystal.fill({ color: 0xffffff, alpha: 0.3 });
          crystal.poly([cN.x, cN.y, cW.x, cW.y, top.x, top.y], true);
          crystal.fill({ color: 0xffffff, alpha: 0.5 });
          
          crystal.poly([cE.x, cE.y, cS.x, cS.y, bot.x, bot.y], true);
          crystal.fill({ color: 0xffffff, alpha: 0.4 });
          crystal.poly([cS.x, cS.y, cW.x, cW.y, bot.x, bot.y], true);
          crystal.fill({ color: 0xffffff, alpha: 0.5 });
          
          crystal.stroke({ width: 0.8, color: 0xffffff, alpha: 0.85 });
          floatingCore.addChild(crystal);

          // Rings container flattened to isometric
          const ringsWorldContainer = new PIXI.Container();
          ringsWorldContainer.scale.y = ISO_PITCH;
          floatingCore.addChild(ringsWorldContainer);

          const rotatingRings: PIXI.Graphics[] = [];
          const numRings = tier >= 3 ? 3 : (tier >= 2 ? 2 : 1);
          
          const r1g = new PIXI.Graphics();
          r1g.arc(0, 0, cw * 2.8, 0, Math.PI * 0.45); r1g.stroke({ width: 1.2, color: 0xffffff, alpha: 0.8 });
          r1g.arc(0, 0, cw * 2.8, Math.PI * 0.7, Math.PI * 1.15); r1g.stroke({ width: 1.2, color: 0xffffff, alpha: 0.8 });
          r1g.arc(0, 0, cw * 2.8, Math.PI * 1.35, Math.PI * 1.8); r1g.stroke({ width: 1.2, color: 0xffffff, alpha: 0.8 });
          ringsWorldContainer.addChild(r1g);
          rotatingRings.push(r1g);

          if (numRings >= 2) {
            const r2g = new PIXI.Graphics();
            r2g.arc(0, 0, cw * 4.2, Math.PI * 0.2, Math.PI * 0.65); r2g.stroke({ width: 0.8, color: 0xffffff, alpha: 0.5 });
            r2g.arc(0, 0, cw * 4.2, Math.PI * 1.0, Math.PI * 1.45); r2g.stroke({ width: 0.8, color: 0xffffff, alpha: 0.5 });
            ringsWorldContainer.addChild(r2g);
            rotatingRings.push(r2g);
          }

          if (numRings >= 3) {
            const r3g = new PIXI.Graphics();
            r3g.arc(0, 0, cw * 5.6, Math.PI * 0.5, Math.PI * 0.9); r3g.stroke({ width: 0.6, color: 0xffffff, alpha: 0.35 });
            r3g.arc(0, 0, cw * 5.6, Math.PI * 1.5, Math.PI * 1.9); r3g.stroke({ width: 0.6, color: 0xffffff, alpha: 0.35 });
            ringsWorldContainer.addChild(r3g);
            rotatingRings.push(r3g);
          }

          const satellitesList: PIXI.Graphics[] = [];
          if (tier >= 2) {
            const numSats = tier >= 3 ? 4 : 2;
            for (let i = 0; i < numSats; i++) {
              const sat = new PIXI.Graphics();
              sat.poly([3, 0, 0, 3, -3, 0, 0, -3], true);
              sat.fill({ color: 0xffffff, alpha: 0.95 });
              sat.stroke({ width: 0.5, color: 0xffffff, alpha: 0.5 });
              ringsWorldContainer.addChild(sat);
              satellitesList.push(sat);
            }
          }

          nodeContainer.eventMode = "static";
          nodeContainer.cursor = "pointer";

          nodeContainer.on("pointerover", (e) => {
            e.stopPropagation();
            hoveredNodeId = node.id;
            updateVisualStates();
            drawPreviews();
          });

          nodeContainer.on("pointerout", () => {
            if (hoveredNodeId === node.id) hoveredNodeId = null;
            updateVisualStates();
            drawPreviews();
          });

          nodeContainer.on("pointertap", (e) => {
            e.stopPropagation();
            const { selectedNodeId: activeSelectedId, userAddress: activeUserAddr, nodes: activeNodes } = stateRef.current;
            const activeSelectedNode = activeNodes.find((n) => n.id === activeSelectedId);

            if (
              activeSelectedNode &&
              activeSelectedNode.owner.toLowerCase() === activeUserAddr?.toLowerCase() &&
              activeSelectedId !== node.id
            ) {
              onConnectNodes(activeSelectedId!, node.id);
            } else {
              onSelectNode(activeSelectedId === node.id ? null : node.id);
            }
          });

          nodesContainer.addChild(nodeContainer);

          nodeContainersMap.set(node.id, {
            container: nodeContainer,
            groundPlate,
            spire,
            floatingCore,
            ringsWorldContainer,
            rotatingRings,
            satellitesList: satellitesList.length > 0 ? satellitesList : undefined,
            sparksGraphics,
            sparks,
            glowRing,
            baseHeight: height,
            tier,
            phase: r4 * Math.PI * 2,
            connectionsCount: node.connectionsCount,
            owner: node.owner,
            bobSpeed: 1.2 + r4 * 0.8,
            spinSpeed: (0.01 + r3 * 0.015) * (isAgentOwned ? 2.5 : 1.0),
          });
        });

        updateVisualStates();
        drawPreviews();
      };

      rebuildRef.current = rebuildNetwork;
      updateVisualsRef.current = updateVisualStates;

      app.stage.on("pointertap", (e) => {
        const { selectedNodeId: activeSelectedId, nodes: activeNodes } = stateRef.current;
        const localPos = world.toLocal(e.global);
        const gridPos = fromIso(localPos.x, localPos.y);
        const snapX = Math.round(gridPos.x / 100);
        const snapY = Math.round(gridPos.y / 100);

        const nodeAtClick = activeNodes.find((n) => n.x === snapX && n.y === snapY);
        if (!nodeAtClick) {
          if (activeSelectedId) onSelectNode(null);
          else if (Math.abs(snapX) < 40 && Math.abs(snapY) < 40) onPlaceNode(snapX, snapY);
        }
      });

      app.stage.on("pointerdown", (e) => {
        isDragging = true;
        lastPos = { x: e.global.x, y: e.global.y };
      });

      app.stage.on("pointerup", () => isDragging = false);
      app.stage.on("pointerupoutside", () => isDragging = false);

      app.stage.on("pointermove", (e) => {
        const localPos = world.toLocal(e.global);
        const gridPos = fromIso(localPos.x, localPos.y);
        worldMousePos = { x: gridPos.x, y: gridPos.y };

        if (isDragging) {
          world.x += (e.global.x - lastPos.x);
          world.y += (e.global.y - lastPos.y);
          lastPos = { x: e.global.x, y: e.global.y };
        }
        drawPreviews();
      });

      handleWheel = (e: WheelEvent) => {
        const zoomSensitivity = 0.001;
        const scaleFactor = 1 - e.deltaY * zoomSensitivity;
        const newScaleX = world.scale.x * scaleFactor;

        if (newScaleX > 0.12 && newScaleX < 4) {
          const mouseX = (e.clientX - world.x) / world.scale.x;
          const mouseY = (e.clientY - world.y) / world.scale.y;

          world.scale.set(newScaleX);
          world.x = e.clientX - mouseX * world.scale.x;
          world.y = e.clientY - mouseY * world.scale.y;
          drawPreviews();
        }
      };

      app.canvas.addEventListener("wheel", handleWheel, { passive: true });

      let time = 0;
      app.ticker.add((ticker) => {
        time += (ticker?.deltaTime || 1) * 0.025;

        // Ambient Environment Particles Update
        ambientGraphics.clear();
        ambientParticles.forEach(p => {
          p.x += p.speedX * (ticker?.deltaTime || 1);
          p.y += p.speedY * (ticker?.deltaTime || 1);
          if (p.x > 3000) p.x = -3000;
          if (p.x < -3000) p.x = 3000;
          if (p.y > 3000) p.y = -3000;
          if (p.y < -3000) p.y = 3000;
          
          const alpha = (0.2 + Math.sin(time + p.alphaOffset) * 0.2);
          const pos = project(p.x, p.y, p.z);
          ambientGraphics.circle(pos.x, pos.y, p.size);
          ambientGraphics.fill({ color: p.color, alpha: alpha });
        });

        // Dynamic crossfade based on zoom level (initial scale is 0.65)
        // At default zoom: Show only Heatmap. Lines fade in when zooming close.
        const zoom = world.scale.x;
        
        // Lines fade in between 1.2x and 2.2x zoom
        const linesFade = Math.max(0, Math.min(1, (zoom - 1.2) / 1.0));
        
        // Heatmap fades out slowly between 1.5x and 3.0x zoom
        const heatFade = Math.max(0, Math.min(1, (zoom - 1.5) / 1.5));
        
        // Subtle global pulsing effect for the explicit lines layer
        const linePulse = 0.6 + 0.4 * Math.sin(time * 0.8);
        
        explicitLinesContainer.alpha = linesFade * linePulse;
        heatMapContainer.alpha = 1 - heatFade;

        nodeContainersMap.forEach((nodeData) => {
          const bob = Math.sin(time * nodeData.bobSpeed + nodeData.phase) * 4.5;
          const corePos = project(0, 0, nodeData.baseHeight + bob);
          nodeData.floatingCore.x = corePos.x;
          nodeData.floatingCore.y = corePos.y;

          if (nodeData.rotatingRings[0]) nodeData.rotatingRings[0].rotation += nodeData.spinSpeed;
          if (nodeData.rotatingRings[1]) nodeData.rotatingRings[1].rotation -= nodeData.spinSpeed * 0.6;
          if (nodeData.rotatingRings[2]) nodeData.rotatingRings[2].rotation += nodeData.spinSpeed * 0.3;

          if (nodeData.satellitesList) {
            const orbitRadius = 15 + Math.min(nodeData.connectionsCount * 2, 8);
            const count = nodeData.satellitesList.length;
            for (let i = 0; i < count; i++) {
              const satAngle = time * (nodeData.spinSpeed * 12) + (i * Math.PI * 2) / count;
              nodeData.satellitesList[i].x = Math.cos(satAngle) * orbitRadius;
              nodeData.satellitesList[i].y = Math.sin(satAngle) * orbitRadius;
              nodeData.satellitesList[i].rotation += 0.03;
            }
          }

          if (nodeData.tier === 3 && nodeData.sparksGraphics && nodeData.sparks) {
             nodeData.sparksGraphics.clear();
             nodeData.sparks.forEach(spark => {
                spark.life += 0.008;
                spark.z += spark.speed;
                if (spark.life > 1 || spark.z > nodeData.baseHeight + 60) {
                   spark.life = 0;
                   spark.z = nodeData.baseHeight;
                   spark.x = (Math.random() - 0.5) * 20;
                   spark.y = (Math.random() - 0.5) * 20;
                }
                const p = project(spark.x, spark.y, spark.z);
                nodeData.sparksGraphics!.circle(p.x, p.y, 1.5);
                nodeData.sparksGraphics!.fill({ color: 0x00d2ff, alpha: 1 - spark.life });
             });
          }
        });

        explicitPulses.clear();
        pulsesRef.current.forEach((pulse) => {
          pulse.progress += pulse.speed * (ticker?.deltaTime || 1);
          if (pulse.progress > 1) pulse.progress = 0;

          const px = pulse.fromX + (pulse.toX - pulse.fromX) * pulse.progress;
          const py = pulse.fromY + (pulse.toY - pulse.fromY) * pulse.progress;

          // Draw vehicle body (Capsule)
          explicitPulses.circle(px, py, 2.5);
          explicitPulses.fill({ color: 0xffffff, alpha: 0.95 });
          
          // Outer vehicle glow
          explicitPulses.circle(px, py, 5);
          explicitPulses.fill({ color: pulse.color, alpha: 0.4 });
          
          // Draw trailing data tail
          const tailLength = Math.min(pulse.progress, 0.08); // Trailing length
          const trailPx = pulse.fromX + (pulse.toX - pulse.fromX) * (pulse.progress - tailLength);
          const trailPy = pulse.fromY + (pulse.toY - pulse.fromY) * (pulse.progress - tailLength);
          
          explicitPulses.moveTo(trailPx, trailPy);
          explicitPulses.lineTo(px, py);
          explicitPulses.stroke({ width: 3, color: pulse.color, alpha: 0.7 });
        });
      });

      rebuildNetwork();
    };

    initPixi();

    return () => {
      isDestroyed = true;
      rebuildRef.current = null;
      updateVisualsRef.current = null;
      if (app && isInitialized) {
        if (app.canvas && handleWheel) {
          app.canvas.removeEventListener("wheel", handleWheel);
        }
        app.destroy(true);
      }
    };
  }, [isDemoMode]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full outline-none bg-[#050511]"
      style={{ touchAction: "none" }}
    />
  );
}
