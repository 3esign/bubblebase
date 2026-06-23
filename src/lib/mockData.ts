export const MOCK_AGENT_ADDRESSES = [
  "0x111111125434b319222222222222222222222222",
  "0x222222225434b319222222222222222222222222",
  "0x333333335434b319222222222222222222222222",
  "0x444444445434b319222222222222222222222222",
  "0x555555555434b319222222222222222222222222",
  "0x666666665434b319222222222222222222222222",
];

import { encodeCoordinate } from "../utils/coordinates";

export function generateMockFormations() {
  const nodes: any[] = [];
  const connections: any[] = [];
  
  const positions = [
    {x:0, y:0}, {x:1, y:0}, {x:-1, y:0}, {x:0, y:1}, {x:0, y:-1},
    {x:5, y:5}, {x:6, y:5}, {x:5, y:6}, {x:6, y:6},
    {x:-5, y:-5}, {x:-6, y:-5}, {x:-5, y:-6}, {x:-6, y:-6}
  ];
  
  positions.forEach((pos, i) => {
    const owner = MOCK_AGENT_ADDRESSES[i % MOCK_AGENT_ADDRESSES.length];
    const id = encodeCoordinate(pos.x, pos.y).toString();
    nodes.push({ id, x: pos.x, y: pos.y, owner, connectionsCount: 0 });
  });

  const connect = (n1: any, n2: any) => {
    const fromId = n1.id;
    const toId = n2.id;
    const bigFrom = BigInt(fromId);
    const bigTo = BigInt(toId);
    const connId = bigFrom < bigTo ? `${fromId}-${toId}` : `${toId}-${fromId}`;
    connections.push({
      id: connId,
      fromNode: fromId,
      toNode: toId,
      weight: 1,
      lastNurturedAt: Math.floor(Date.now() / 1000),
      boostMultiplier: 100,
      active: true,
      isPending: false
    });
    n1.connectionsCount++;
    n2.connectionsCount++;
  };
  
  connect(nodes[0], nodes[1]);
  connect(nodes[0], nodes[2]);
  connect(nodes[0], nodes[3]);
  connect(nodes[0], nodes[4]);
  connect(nodes[5], nodes[6]);
  connect(nodes[5], nodes[7]);
  connect(nodes[6], nodes[8]);
  connect(nodes[7], nodes[8]);
  connect(nodes[9], nodes[10]);
  connect(nodes[9], nodes[11]);
  connect(nodes[10], nodes[12]);
  connect(nodes[11], nodes[12]);
  connect(nodes[1], nodes[5]);
  connect(nodes[2], nodes[9]);

  return { nodes, connections };
}
