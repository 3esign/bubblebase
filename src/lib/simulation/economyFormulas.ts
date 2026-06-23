export interface EconomyNode {
  x: number;
  y: number;
  connectionsCount: number;
}

export const ACTION_FEE = 0.00001; // Base ether
export const CONNECTION_LIFETIME = 86400; // 24 hours in seconds

export function calculateDistance(n1: { x: number; y: number }, n2: { x: number; y: number }) {
  return Math.abs(n2.x - n1.x) + Math.abs(n2.y - n1.y);
}

export function calculateConnectionFee(fromNode: EconomyNode, toNode: EconomyNode) {
  const baseFee = ACTION_FEE;
  let connectionPremium = 0;
  if (toNode.connectionsCount > fromNode.connectionsCount) {
    connectionPremium = (toNode.connectionsCount - fromNode.connectionsCount) * 0.000005;
  }
  const distance = calculateDistance(fromNode, toNode);
  const distancePremium = distance * 0.000001;
  return {
    total: baseFee + connectionPremium + distancePremium,
    baseFee,
    connectionPremium,
    distancePremium,
    distance,
  };
}

export function calculateNurtureFee(fromNode: EconomyNode, toNode: EconomyNode) {
  const distance = calculateDistance(fromNode, toNode);
  return 0.000002 + distance * 0.0000002;
}

export function calculateBoostFee(fromNode: EconomyNode, toNode: EconomyNode) {
  const distance = calculateDistance(fromNode, toNode);
  return 0.000005 + distance * 0.0000005;
}

export function isConnectionDecayed(lastNurturedAt: number, currentTimestamp: number) {
  return currentTimestamp > lastNurturedAt + CONNECTION_LIFETIME;
}
