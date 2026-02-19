export interface NodeMetrics {
  id: number;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  signalStrength: number; // dBm
  batteryLevel?: number; // 0-100%
  uptime: number; // seconds
  packetLoss: number; // 0-1 (percentage as decimal)
  latency: number; // milliseconds
  lastSeen: number; // timestamp
}

export interface LinkMetrics {
  sourceId: number;
  targetId: number;
  rssi: number; // dBm
  snr: number; // dB
  quality: number; // 0-1 (percentage as decimal)
  throughput: number; // bytes/sec
  packetLoss: number; // 0-1
  latency: number; // milliseconds
}

export interface NetworkTopologyMetrics {
  totalNodes: number;
  activeNodes: number;
  totalLinks: number;
  activeLinks: number;
  averageNodeDegree: number;
  networkDiameter: number;
  clusteringCoefficient: number;
  connectedComponents: number;
}

export interface NetworkHealthMetrics {
  overallHealth: number; // 0-1
  averageSignalStrength: number; // dBm
  averagePacketLoss: number; // 0-1
  averageLatency: number; // milliseconds
  nodeAvailability: number; // 0-1
  linkReliability: number; // 0-1
  criticalNodes: number[];
  criticalLinks: Array<{ sourceId: number; targetId: number }>;
}

export interface NetworkDashboardData {
  timestamp: number;
  topology: NetworkTopologyMetrics;
  health: NetworkHealthMetrics;
  nodes: NodeMetrics[];
  links: LinkMetrics[];
}

export type MetricTrend = 'up' | 'down' | 'stable';

export interface MetricHistory {
  timestamp: number;
  value: number;
}

export interface DashboardAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  nodeId?: number;
  linkId?: { sourceId: number; targetId: number };
  acknowledged: boolean;
}
