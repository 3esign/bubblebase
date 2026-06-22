# BubbleBase (Base L2 Civilization Game)

BubbleBase is a dystopian, cyberpunk civilization game built directly on the Base L2 Ethereum network. In this world, raw coordinate space is real estate, and survival depends on network connectivity.

---

## 🎮 Gameplay & Interfaces

Here is the visual progression of the Grid, showcasing zoom levels, nodes, connections, and the isometric graphics engine:

```carousel
![Gameplay Map Overview](/public/gameplay_map.png)
<!-- slide -->
![Medium Zoom Node Cluster](/public/gameplay_mid_zoom.png)
<!-- slide -->
![Detailed Zoom Wires and Citadels](/public/gameplay_detailed_zoom.png)
```

### The Lore
Welcome to the Grid. Players are Architects placing core Nodes on an infinite 2.5D isometric plane. A solitary Node is weak and yields no influence. To grow your node into a towering Citadel, you must forge Connections with other players' Nodes. 

However, bandwidth is finite. Every connection requires a dynamic fee paid in Ethereum—calculated parametrically based on the physical distance across the grid and the congestion (connection density) of the target Node. 

Even worse, the Grid suffers from entropy. Connections decay over a 24-hour cycle. Decayed connections turn into dead gray wires, severing the flow of rewards. To keep your empire alive, you must "Nurture" links, or "Boost" them to overclock your data streams.

---

## 🛠️ Transparent Architecture & Mechanics

The application is architected in three main layers:

### 1. Smart Contracts (`contracts/Bubbles.sol`)
- **Grid Real Estate**: Nodes are stored natively using a unique coordinate hash mapping. 
- **Dynamic Connection Economics**: The fee to request a connection is calculated on-chain using a Manhattan distance premium and a density disparity premium. 
- **Equitable Split**: When a connection is approved, the dynamic fee is split—a minor cut to the protocol, and a massive 95% reward distributed between the Node owners.
- **Decay & Overclocking**: Features a 24-hour `CONNECTION_LIFETIME` enforced by block timestamps. Players can call `nurtureConnection` (to reset the timer) or `boostConnection` (to pay a premium for a 3x yield multiplier). 

### 2. Graphics Engine (`src/components/GameMap.tsx`)
- **True Isometric Projection**: Instead of relying on container skewing/rotation, the GameMap implements mathematically pure isometric coordinate projection (`toIso` and `fromIso`). This ensures towering structures rise perfectly straight vertically on the monitor.
- **Parametric Citadels**: The geometry of each Node scales procedurally based on its on-chain `connectionsCount`.
  - *Tier 0 (Pylon)*: Basic slab and single crystal.
  - *Tier 1 (Spire)*: Dual-stepped segments with gyroscopic rings.
  - *Tier 2 (Bastion)*: Triple segments with 4 corner stabilizer pylons.
  - *Tier 3 (Citadel)*: Enormous architectural monoliths with floating orbital satellites and glowing particle exhaust.
- **Dynamic Heatmap LOD (Level of Detail)**: As users zoom out, sharp connection lasers crossfade into a deeply blurred, glowing "heatmap" displaying network congestion. The sharp explicit wires only fade in when zooming closely into a Citadel cluster.

### 3. Web3 Frontend
- Built on **Next.js (App Router)** and **TailwindCSS**.
- Integrates **RainbowKit** and **wagmi/viem** for seamless Base L2 wallet interactions.
- Live RPC polling keeps the countdown timers and game UI perfectly synced with the blockchain state.

---

## ⚡ Technical Optimizations & Analysis

### 🪙 Smart Contract Gas Optimization
The `Connection` struct has been packed into a single 32-byte storage slot:
```solidity
struct Connection {
    uint64 lastNurturedAt;
    uint16 boostMultiplier; // 100 = 1.0x, 200 = 2.0x, max 300 = 3.0x
    bool active;
}
```
* **Impact**: Previously, using `uint256` for `lastNurturedAt` and `boostMultiplier` consumed 3 full 32-byte storage slots (96 bytes). By packing them down to a single slot, we save ~40,000 gas on initial connection approval, and ~20,000 gas on every `nurtureConnection` and `boostConnection` call.

### 🖥️ Graphics Loop Performance & Memory Leaks
* **Garbage Collection**: Fixed a memory leak in `rebuildNetwork()` by explicitly iterating over the previous `nodeContainersMap` and calling `.destroy({ children: true })` on each node's container tree before clearing the map. This safely unregisters internal PixiJS graphics objects, text objects, and listeners from the GPU memory buffer.
* **Canvas Listeners**: Refactored the window `wheel` listener to use a named handler function (`handleWheel`), which is cleanly unregistered with `removeEventListener` when the component unmounts.

### 🌐 Next.js Advanced Caching Recommendations
To make the application blazing fast while maintaining Web3 reactivity:
1. **ISR for Node Metadata**: Use Incremental Static Regeneration (ISR) with a short revalidation interval (e.g. `revalidate = 10`) for the initial map loading API. This ensures users get instant visual feedback on page load without waiting for direct RPC node count scans.
2. **React Query SWR (Stale-While-Revalidate)**: Keep contract read polling within the client. Use react-query's `refetchInterval` for live states but configure aggressive window focus cache-times to avoid unnecessary RPC request spam when the user is tabbed out.
