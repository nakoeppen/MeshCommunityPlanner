/**
 * CoT (Cursor-on-Target) Export Utility
 * Generates a TAK Data Package (.zip) containing individual CoT XML events
 * and a MANIFEST/manifest.xml file for import into ATAK, WinTAK, and iTAK.
 */

import JSZip from 'jszip';
import type { Node } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface CoTExportOptions {
  staleMinutes?: number;       // default 1440 (24 hours)
  cotType?: string;            // default "a-f-G-U-C" (friendly ground unit)
  callsignPrefix?: string;     // default "MESH-"
  includeRemarks?: boolean;    // default true
}

// ============================================================================
// Helpers
// ============================================================================

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateUUID(): string {
  return crypto.randomUUID();
}

/** Build a single CoT <event> XML string for one node. */
function buildCoTEvent(
  node: Node,
  eventUid: string,
  planName: string,
  now: Date,
  stale: Date,
  cotType: string,
  callsignPrefix: string,
  includeRemarks: boolean,
): string {
  const callsign = `${callsignPrefix}${escapeXml(node.name)}`;
  const hae = node.antenna_height_m || 0;

  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(`<event version="2.0" uid="${escapeXml(eventUid)}" type="${escapeXml(cotType)}" time="${now.toISOString()}" start="${now.toISOString()}" stale="${stale.toISOString()}" how="h-g-i-g-o">`);
  parts.push(`<point lat="${node.latitude}" lon="${node.longitude}" hae="${hae}" ce="9999999" le="9999999"/>`);
  parts.push(`<detail>`);
  parts.push(`<contact callsign="${callsign}"/>`);

  if (includeRemarks) {
    const remarks: string[] = [];
    if (node.device_id) remarks.push(`Device: ${node.device_id}`);
    if (node.tx_power_dbm) remarks.push(`TX: ${node.tx_power_dbm}dBm`);
    if (node.frequency_mhz) remarks.push(`Freq: ${node.frequency_mhz}MHz`);
    if (node.firmware) remarks.push(`FW: ${node.firmware}`);
    if (node.notes) remarks.push(node.notes);
    if (remarks.length > 0) {
      parts.push(`<remarks>${escapeXml(remarks.join(', '))}</remarks>`);
    }
  }

  parts.push(`<__group name="${escapeXml(planName)}" role="Team Member"/>`);
  parts.push(`</detail>`);
  parts.push(`</event>`);

  return parts.join('');
}

// ============================================================================
// Export — TAK Data Package (.zip)
// ============================================================================

/**
 * Export plan nodes as a TAK Data Package (zip).
 *
 * Structure:
 *   MANIFEST/manifest.xml
 *   <uuid1>/<uuid1>.cot
 *   <uuid2>/<uuid2>.cot
 *   ...
 *
 * Compatible with ATAK Import Manager, WinTAK, and iTAK.
 */
export async function exportTakDataPackage(
  nodes: Node[],
  planName: string,
  options?: CoTExportOptions,
): Promise<Blob> {
  const staleMinutes = options?.staleMinutes ?? 1440; // 24 hours
  const cotType = options?.cotType ?? 'a-f-G-U-C';
  const callsignPrefix = options?.callsignPrefix ?? 'MESH-';
  const includeRemarks = options?.includeRemarks ?? true;

  const now = new Date();
  const stale = new Date(now.getTime() + staleMinutes * 60 * 1000);
  const packageUid = generateUUID();

  const zip = new JSZip();
  const contentEntries: string[] = [];

  for (const node of nodes) {
    const eventUid = generateUUID();
    const callsign = `${callsignPrefix}${escapeXml(node.name)}`;

    const cotXml = buildCoTEvent(
      node, eventUid, planName, now, stale,
      cotType, callsignPrefix, includeRemarks,
    );

    // Add CoT file: <uid>/<uid>.cot
    zip.file(`${eventUid}/${eventUid}.cot`, cotXml);

    contentEntries.push(
      `<Content ignore="false" zipEntry="${eventUid}/${eventUid}.cot">` +
      `<Parameter name="uid" value="${eventUid}"/>` +
      `<Parameter name="name" value="${escapeXml(callsign)}"/>` +
      `</Content>`
    );
  }

  // Build MANIFEST.xml
  const zipFilename = `${planName}.zip`;
  const manifest =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<MissionPackageManifest version="2">` +
    `<Configuration>` +
    `<Parameter name="uid" value="${packageUid}"/>` +
    `<Parameter name="name" value="${escapeXml(zipFilename)}"/>` +
    `<Parameter name="onReceiveImport" value="true"/>` +
    `<Parameter name="onReceiveDelete" value="false"/>` +
    `</Configuration>` +
    `<Contents>` +
    contentEntries.join('') +
    `</Contents>` +
    `</MissionPackageManifest>`;

  zip.file('MANIFEST/manifest.xml', manifest);

  return zip.generateAsync({ type: 'blob' });
}
