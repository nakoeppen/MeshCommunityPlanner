/**
 * Technical glossary data
 * Definitions for LoRa mesh networking terms
 */

export interface GlossaryTerm {
  term: string;
  definition: string;
  category: string;
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  // RF & Propagation
  {
    term: 'dBm',
    definition: 'Decibel-milliwatts. A power ratio in decibels (dB) referenced to one milliwatt (mW). Used to express absolute power levels in radio systems.',
    category: 'RF Propagation',
  },
  {
    term: 'FSPL',
    definition: 'Free-Space Path Loss. The loss in signal strength of an electromagnetic wave that would result from a line-of-sight path through free space, with no obstacles nearby to cause reflection or diffraction.',
    category: 'RF Propagation',
  },
  {
    term: 'Fresnel zone',
    definition: 'Ellipsoidal region of space between and around transmitter and receiver. For optimal transmission, 60% of the first Fresnel zone should be clear of obstacles.',
    category: 'RF Propagation',
  },
  {
    term: 'RSSI',
    definition: 'Received Signal Strength Indicator. A measurement of the power present in a received radio signal, typically expressed in dBm.',
    category: 'RF Propagation',
  },
  {
    term: 'SNR',
    definition: 'Signal-to-Noise Ratio. The ratio of signal power to noise power, often expressed in decibels. Higher SNR indicates better signal quality.',
    category: 'RF Propagation',
  },

  // LoRa Specific
  {
    term: 'LoRa',
    definition: 'Long Range. A wireless modulation technique that provides long-range communication at low data rates and low power consumption.',
    category: 'LoRa',
  },
  {
    term: 'SF',
    definition: 'Spreading Factor. A LoRa modulation parameter (SF7-SF12) that trades data rate for range and sensitivity. Higher SF = longer range but slower data rate.',
    category: 'LoRa',
  },
  {
    term: 'BW',
    definition: 'Bandwidth. The frequency range used for transmission. LoRa typically uses 125 kHz, 250 kHz, or 500 kHz bandwidth.',
    category: 'LoRa',
  },
  {
    term: 'CR',
    definition: 'Coding Rate. Forward error correction ratio (4/5, 4/6, 4/7, 4/8). Higher coding rate = more error correction but lower effective data rate.',
    category: 'LoRa',
  },

  // Networking
  {
    term: 'Mesh network',
    definition: 'A network topology where nodes relay data for other nodes, creating multiple pathways for communication and increasing reliability.',
    category: 'Networking',
  },
  {
    term: 'Hop',
    definition: 'A single transmission link between two nodes in a mesh network. Multi-hop paths use intermediate nodes to reach the destination.',
    category: 'Networking',
  },
  {
    term: 'Gateway',
    definition: 'A node that connects the mesh network to external networks (like the Internet). Typically has higher power and better connectivity.',
    category: 'Networking',
  },
  {
    term: 'Topology',
    definition: 'The arrangement and interconnection pattern of nodes in a network. Shows which nodes can communicate directly.',
    category: 'Networking',
  },

  // Planning
  {
    term: 'Coverage area',
    definition: 'The geographic region where a node can successfully receive transmissions, considering terrain, obstacles, and RF propagation.',
    category: 'Planning',
  },
  {
    term: 'Link budget',
    definition: 'Accounting of all gains and losses in a transmission path. Must be positive for reliable communication.',
    category: 'Planning',
  },
  {
    term: 'Line of sight',
    definition: 'A clear, unobstructed path between transmitter and receiver. RF signals require near-LOS for optimal performance.',
    category: 'Planning',
  },
  {
    term: 'Terrain profile',
    definition: 'A cross-section view of elevation between two points, used to assess line-of-sight and Fresnel zone clearance.',
    category: 'Planning',
  },
];

/**
 * Get a glossary term by name (case-insensitive)
 */
export function getGlossaryTerm(term: string): GlossaryTerm | undefined {
  return GLOSSARY_TERMS.find((t) => t.term.toLowerCase() === term.toLowerCase());
}

/**
 * Get all unique categories
 */
export function getGlossaryCategories(): string[] {
  return Array.from(new Set(GLOSSARY_TERMS.map((t) => t.category))).sort();
}
