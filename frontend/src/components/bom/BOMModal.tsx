/**
 * BOMModal Component
 * Displays Bill of Materials with consolidated view, per-node view, and info tab.
 * Shows "Category: Name" format with prettified specs from catalog data.
 * Supports export to CSV, PDF, and deployment cards.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import './BOMModal.css';

// ============================================================================
// Types
// ============================================================================

export interface BOMItem {
  category: string;
  name: string;
  description: string;
  quantity: number;
  unit_price_usd: number | null;
  total_price_usd: number | null;
  specs?: Record<string, any>;
}

export interface BOMNodeData {
  node_id: string;
  node_name: string;
  items: BOMItem[];
  total_cost_usd: number;
  item_count: number;
}

export interface BOMPlanData {
  plan_id: string;
  plan_name: string;
  total_nodes: number;
  total_cost_usd: number;
  consolidated_items: BOMItem[];
  node_boms: BOMNodeData[];
}

interface BOMModalProps {
  isOpen: boolean;
  onClose: () => void;
  bomData: BOMPlanData[] | null;
  loading: boolean;
  error: string | null;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  onExportCards?: () => void;
  exporting: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function formatPrice(value: number | null): string {
  if (value == null) return '--';
  return `$${value.toFixed(2)}`;
}

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    device: 'Device',
    antenna: 'Antenna',
    cable: 'Cable',
    connector: 'Connector',
    pa_module: 'PA Module',
    battery: 'Battery',
    solar: 'Solar Panel',
    bec: 'BEC',
    controller: 'Charge Controller',
    enclosure: 'Enclosure',
    mast: 'Mast',
    misc: 'Hardware',
  };
  return labels[cat] || cat;
}

/** Format a spec value for display */
function formatSpecValue(value: any): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (typeof value === 'number') return String(value);
  return String(value);
}

// ============================================================================
// Component
// ============================================================================

export function BOMModal({
  isOpen,
  onClose,
  bomData,
  loading,
  error,
  onExportCSV,
  onExportPDF,
  onExportCards,
  exporting,
}: BOMModalProps) {
  const [tab, setTab] = useState<'consolidated' | 'per-node' | 'info'>('consolidated');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [activePlanIdx, setActivePlanIdx] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Focus trap: constrain Tab to modal elements
  useEffect(() => {
    if (!isOpen) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTab('consolidated');
      setExpandedNodes(new Set());
      setActivePlanIdx(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const plans = bomData || [];
  const isMultiPlan = plans.length > 1;
  const activePlan = plans[activePlanIdx] || null;

  // Aggregate totals across all plans
  const grandTotalCost = plans.reduce((s, p) => s + p.total_cost_usd, 0);
  const grandTotalNodes = plans.reduce((s, p) => s + p.total_nodes, 0);
  const grandTotalItems = plans.reduce((s, p) => s + p.consolidated_items.length, 0);
  const hasPrices = grandTotalCost > 0;

  // Active plan stats for display
  const totalCost = activePlan?.total_cost_usd ?? 0;
  const totalItems = activePlan?.consolidated_items?.length ?? 0;
  const totalNodes = activePlan?.total_nodes ?? 0;

  return (
    <div className="bom-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Bill of Materials" ref={modalRef}>
      <div className="bom-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bom-header">
          <div>
            <h2 className="bom-title">Bill of Materials</h2>
            <p className="bom-summary">
              {loading ? 'Loading...' : error ? 'Error loading BOM' : isMultiPlan ? (
                <>
                  {plans.length} plans, {grandTotalNodes} node{grandTotalNodes !== 1 ? 's' : ''}, {grandTotalItems} item type{grandTotalItems !== 1 ? 's' : ''}
                  {hasPrices && <> — Est. total: <strong>{formatPrice(grandTotalCost)}</strong> USD</>}
                </>
              ) : (
                <>
                  {totalNodes} node{totalNodes !== 1 ? 's' : ''}, {totalItems} item type{totalItems !== 1 ? 's' : ''}
                  {totalCost > 0 && <> — Est. total: <strong>{formatPrice(totalCost)}</strong> USD</>}
                </>
              )}
            </p>
          </div>
          <div className="bom-actions">
            {onExportCSV && (
              <button className="bom-export-btn csv" type="button" onClick={onExportCSV}
                disabled={loading || !!error || exporting}
                title={isMultiPlan ? `Export ${plans.length} CSV files (one per plan)` : 'Export BOM as CSV spreadsheet'}>
                {exporting ? '...' : isMultiPlan ? `CSV (${plans.length})` : 'CSV'}
              </button>
            )}
            {onExportPDF && (
              <button className="bom-export-btn" type="button" onClick={onExportPDF}
                disabled={loading || !!error || exporting}
                title={isMultiPlan ? `Export ${plans.length} PDF files (one per plan)` : 'Export BOM as PDF report'}>
                {exporting ? '...' : isMultiPlan ? `PDF (${plans.length})` : 'PDF'}
              </button>
            )}
            {onExportCards && (
              <button className="bom-export-btn cards" type="button" onClick={onExportCards}
                disabled={loading || !!error || exporting}
                title={isMultiPlan ? `Export ${plans.length} deployment card files (one per plan)` : 'Export per-node deployment cards'}>
                {exporting ? '...' : isMultiPlan ? `Cards (${plans.length})` : 'Cards'}
              </button>
            )}
            <button className="bom-close" type="button" onClick={onClose} title="Close">&times;</button>
          </div>
        </div>

        {/* Plan selector (only shown for multi-plan) */}
        {isMultiPlan && !loading && !error && (
          <div className="bom-plan-selector">
            {plans.map((p, idx) => (
              <button
                key={p.plan_id}
                className={`bom-plan-tab${idx === activePlanIdx ? ' active' : ''}`}
                type="button"
                onClick={() => { setActivePlanIdx(idx); setExpandedNodes(new Set()); }}
              >
                {p.plan_name}
                <span className="bom-plan-tab-count">{p.total_nodes}</span>
              </button>
            ))}
          </div>
        )}

        {/* Content tabs */}
        {activePlan && !loading && !error && (
          <div className="bom-tabs">
            <button className={`bom-tab${tab === 'consolidated' ? ' active' : ''}`}
              type="button" onClick={() => setTab('consolidated')}>
              Consolidated
            </button>
            <button className={`bom-tab${tab === 'per-node' ? ' active' : ''}`}
              type="button" onClick={() => setTab('per-node')}>
              Per Node ({totalNodes})
            </button>
            <button className={`bom-tab${tab === 'info' ? ' active' : ''}`}
              type="button" onClick={() => setTab('info')}>
              Info
            </button>
          </div>
        )}

        {/* Body */}
        <div className="bom-body">
          {loading && <p className="bom-loading">Generating Bill of Materials...</p>}
          {error && <p className="bom-error">{error}</p>}

          {activePlan && !loading && !error && tab === 'consolidated' && (
            <ConsolidatedTable items={activePlan.consolidated_items} />
          )}

          {activePlan && !loading && !error && tab === 'per-node' && (
            <PerNodeView
              nodeBoms={activePlan.node_boms}
              expandedNodes={expandedNodes}
              onToggleNode={toggleNode}
            />
          )}

          {activePlan && !loading && !error && tab === 'info' && (
            <InfoTab bomData={activePlan} />
          )}
        </div>

        {/* Footer */}
        {activePlan && !loading && !error && (
          <div className="bom-footer">
            <div>
              <div className="bom-footer-label">
                {isMultiPlan ? `${activePlan.plan_name} — Estimated Total` : 'Estimated Network Total'}
              </div>
              <div className="bom-footer-note">
                All amounts are estimates in USD — verify pricing with suppliers before purchasing
                {isMultiPlan && ` | Grand total across all plans: ${formatPrice(grandTotalCost)} USD`}
              </div>
            </div>
            <div className="bom-footer-total">
              {totalCost > 0 ? `${formatPrice(totalCost)} USD` : 'No pricing data'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Item Row — shared by both table views
// ============================================================================

function ItemRow({ item }: { item: BOMItem }) {
  const specs = item.specs || {};
  const specEntries = Object.entries(specs).filter(([, v]) => v != null);

  return (
    <>
      <tr>
        <td><span className={`bom-category ${item.category}`}>{categoryLabel(item.category)}</span></td>
        <td>
          <div className="bom-item-name">{categoryLabel(item.category)}: {item.name}</div>
          {item.description && <div className="bom-item-desc">{item.description}</div>}
        </td>
        <td className="right">{item.quantity}</td>
        <td className={`right ${item.unit_price_usd != null ? 'bom-price' : 'bom-price-unknown'}`}>
          {formatPrice(item.unit_price_usd)}
        </td>
        <td className={`right ${item.total_price_usd != null ? 'bom-price' : 'bom-price-unknown'}`}>
          {formatPrice(item.total_price_usd)}
        </td>
      </tr>
      {specEntries.length > 0 && (
        <tr className="bom-specs-row">
          <td></td>
          <td colSpan={4}>
            <div className="bom-specs-grid">
              {specEntries.map(([key, val]) => (
                <span key={key} className="bom-spec-tag">
                  <span className="bom-spec-key">{key}:</span> {formatSpecValue(val)}
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ============================================================================
// Consolidated Table
// ============================================================================

function ConsolidatedTable({ items }: { items: BOMItem[] }) {
  if (items.length === 0) {
    return <p className="bom-empty">No items in Bill of Materials. Add nodes with hardware to generate BOM.</p>;
  }

  return (
    <table className="bom-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Item</th>
          <th className="right">Qty</th>
          <th className="right">Unit Price (USD)</th>
          <th className="right">Total (USD)</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <ItemRow key={`${item.category}-${item.name}-${i}`} item={item} />
        ))}
      </tbody>
    </table>
  );
}

// ============================================================================
// Per-Node View
// ============================================================================

function PerNodeView({
  nodeBoms,
  expandedNodes,
  onToggleNode,
}: {
  nodeBoms: BOMNodeData[];
  expandedNodes: Set<string>;
  onToggleNode: (id: string) => void;
}) {
  if (nodeBoms.length === 0) {
    return <p className="bom-empty">No node data available.</p>;
  }

  return (
    <div>
      {nodeBoms.map((nb) => {
        const isExpanded = expandedNodes.has(nb.node_id);
        return (
          <div key={nb.node_id} className="bom-node-section">
            <div className="bom-node-header" onClick={() => onToggleNode(nb.node_id)}>
              <span className="bom-node-name">{nb.node_name || nb.node_id}</span>
              <div className="bom-node-meta">
                <span>{nb.item_count} item{nb.item_count !== 1 ? 's' : ''}</span>
                <span className="bom-price">{nb.total_cost_usd > 0 ? formatPrice(nb.total_cost_usd) : '--'}</span>
                <span className="bom-collapse-icon">{isExpanded ? '\u25B2' : '\u25BC'}</span>
              </div>
            </div>
            {isExpanded && (
              <table className="bom-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Item</th>
                    <th className="right">Qty</th>
                    <th className="right">Unit Price (USD)</th>
                    <th className="right">Total (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {nb.items.map((item, i) => (
                    <ItemRow key={`${item.category}-${item.name}-${i}`} item={item} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Info Tab
// ============================================================================

function InfoTab({ bomData }: { bomData: BOMPlanData }) {
  // Build per-category cost breakdown from consolidated items
  const categoryBreakdown: Record<string, { count: number; cost: number }> = {};
  for (const item of bomData.consolidated_items) {
    const cat = categoryLabel(item.category);
    if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { count: 0, cost: 0 };
    categoryBreakdown[cat].count += item.quantity;
    categoryBreakdown[cat].cost += item.total_price_usd ?? 0;
  }
  const catEntries = Object.entries(categoryBreakdown).sort((a, b) => b[1].cost - a[1].cost);

  const avgCostPerNode = bomData.total_nodes > 0 ? bomData.total_cost_usd / bomData.total_nodes : 0;
  const totalQuantity = bomData.consolidated_items.reduce((s, i) => s + i.quantity, 0);

  // Most/least expensive node
  const nodeBoms = bomData.node_boms || [];
  const pricedNodes = nodeBoms.filter((nb) => nb.total_cost_usd > 0);
  const mostExpensive = pricedNodes.length > 0 ? pricedNodes.reduce((a, b) => a.total_cost_usd > b.total_cost_usd ? a : b) : null;
  const leastExpensive = pricedNodes.length > 0 ? pricedNodes.reduce((a, b) => a.total_cost_usd < b.total_cost_usd ? a : b) : null;

  return (
    <div className="bom-info-tab">
      {/* Plan Summary */}
      <section className="bom-info-section">
        <h3>Plan Summary</h3>
        <table className="bom-info-table">
          <tbody>
            <tr><td className="bom-info-key">Plan</td><td>{bomData.plan_name}</td></tr>
            <tr><td className="bom-info-key">Total Nodes</td><td>{bomData.total_nodes}</td></tr>
            <tr><td className="bom-info-key">Unique Item Types</td><td>{bomData.consolidated_items.length}</td></tr>
            <tr><td className="bom-info-key">Total Parts</td><td>{totalQuantity}</td></tr>
            <tr><td className="bom-info-key">Estimated Total Cost</td><td><strong>{formatPrice(bomData.total_cost_usd)}</strong> USD</td></tr>
            <tr><td className="bom-info-key">Avg. Cost Per Node</td><td>{formatPrice(avgCostPerNode)} USD</td></tr>
            {mostExpensive && leastExpensive && mostExpensive.node_id !== leastExpensive.node_id && (
              <>
                <tr><td className="bom-info-key">Most Expensive Node</td><td>{mostExpensive.node_name} ({formatPrice(mostExpensive.total_cost_usd)})</td></tr>
                <tr><td className="bom-info-key">Least Expensive Node</td><td>{leastExpensive.node_name} ({formatPrice(leastExpensive.total_cost_usd)})</td></tr>
              </>
            )}
          </tbody>
        </table>
      </section>

      {/* Cost by Category */}
      {catEntries.length > 0 && (
        <section className="bom-info-section">
          <h3>Cost by Category</h3>
          <table className="bom-info-table">
            <thead>
              <tr><th>Category</th><th className="right">Parts</th><th className="right">Cost (USD)</th><th className="right">% of Total</th></tr>
            </thead>
            <tbody>
              {catEntries.map(([cat, data]) => (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td className="right">{data.count}</td>
                  <td className="right">{formatPrice(data.cost)}</td>
                  <td className="right">{bomData.total_cost_usd > 0 ? `${((data.cost / bomData.total_cost_usd) * 100).toFixed(1)}%` : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Per-Node Cost Summary */}
      {nodeBoms.length > 0 && (
        <section className="bom-info-section">
          <h3>Per-Node Cost Summary</h3>
          <table className="bom-info-table">
            <thead>
              <tr><th>Node</th><th className="right">Items</th><th className="right">Cost (USD)</th></tr>
            </thead>
            <tbody>
              {nodeBoms.map((nb) => (
                <tr key={nb.node_id}>
                  <td>{nb.node_name}</td>
                  <td className="right">{nb.item_count}</td>
                  <td className="right">{nb.total_cost_usd > 0 ? formatPrice(nb.total_cost_usd) : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="bom-info-section">
        <h3>Pricing Information</h3>
        <p>
          All prices shown are <strong>estimates in USD</strong> based on the built-in hardware catalog.
          Users may customize catalog data and pricing via the Catalog Manager (toolbar &rarr; Catalog).{' '}
          <strong>The user is solely responsible for maintaining accurate pricing and specification data.</strong>{' '}
          Actual prices vary by supplier, region, quantity, and market conditions. This data is for
          estimation and planning purposes only &mdash; always verify current pricing with your preferred
          supplier before making purchasing decisions.
        </p>
      </section>

      <section className="bom-info-section">
        <h3>Export Formats</h3>
        <ul>
          <li><strong>CSV</strong> — Spreadsheet format with all items, quantities, and pricing. Import into Excel, Google Sheets, or any spreadsheet application.</li>
          <li><strong>PDF</strong> — Formatted report with per-node item tables, specifications, pricing subtotals, and disclaimers.</li>
          <li><strong>Cards</strong> — Deployment cards PDF with one page per node. Includes hardware checklists, GPS coordinates, power wiring details, and mounting notes for field technicians.</li>
        </ul>
      </section>

      <section className="bom-info-section bom-info-legal">
        <h3>Disclaimer</h3>
        <p>
          This software is provided for planning purposes only. The user assumes all responsibility
          for electronics installation, electrical wiring, device assembly, and any structural
          modifications. The software and its developers assume no liability for damage, injury,
          or property loss resulting from the use of this tool's output. All work involving
          electricity, RF equipment, and elevated installations should be performed by or
          under the supervision of qualified personnel.
        </p>
        <p>
          Catalog data, including hardware specifications and pricing, is provided as a starting
          point for planning. The user assumes full responsibility for the accuracy and completeness
          of any custom or modified catalog entries.
        </p>
      </section>
    </div>
  );
}
