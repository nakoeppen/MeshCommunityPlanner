/**
 * PDFReportModal Component
 * Configuration modal for generating PDF network reports.
 * Allows users to select report sections, page size, and generate the report.
 */

import { useState, useEffect, useCallback } from 'react';
import { useDraggable } from '../../hooks/useDraggable';
import './PDFReportModal.css';

interface PDFReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasLOSOverlays: boolean;
  hasCoverageOverlays: boolean;
  onGenerate: (config: {
    sections: string[];
    page_size: 'letter' | 'A4';
    include_executive_summary: boolean;
    include_bom_summary: boolean;
    include_recommendations: boolean;
  }) => Promise<void>;
}

const REPORT_SECTIONS = [
  { id: 'executive_summary', label: 'Executive Summary', alwaysAvailable: true },
  { id: 'topology_map', label: 'Topology Map Screenshot', alwaysAvailable: true },
  { id: 'node_inventory', label: 'Node Inventory Table', alwaysAvailable: true },
  { id: 'link_quality', label: 'Link Quality Table', alwaysAvailable: false, requiresLOS: true },
  { id: 'coverage_stats', label: 'Coverage Statistics', alwaysAvailable: false, requiresCoverage: true },
  { id: 'bom_summary', label: 'BOM Summary', alwaysAvailable: true },
  { id: 'recommendations', label: 'Recommendations', alwaysAvailable: true },
] as const;

type SectionId = typeof REPORT_SECTIONS[number]['id'];

function getDefaultSections(hasLOS: boolean, hasCoverage: boolean): Set<SectionId> {
  const sections = new Set<SectionId>();
  for (const section of REPORT_SECTIONS) {
    if (section.alwaysAvailable) {
      sections.add(section.id);
    } else if ('requiresLOS' in section && section.requiresLOS && hasLOS) {
      sections.add(section.id);
    } else if ('requiresCoverage' in section && section.requiresCoverage && hasCoverage) {
      sections.add(section.id);
    }
  }
  return sections;
}

function isSectionAvailable(
  section: typeof REPORT_SECTIONS[number],
  hasLOS: boolean,
  hasCoverage: boolean,
): boolean {
  if (section.alwaysAvailable) return true;
  if ('requiresLOS' in section && section.requiresLOS) return hasLOS;
  if ('requiresCoverage' in section && section.requiresCoverage) return hasCoverage;
  return true;
}

export function PDFReportModal({
  isOpen,
  onClose,
  hasLOSOverlays,
  hasCoverageOverlays,
  onGenerate,
}: PDFReportModalProps) {
  const { handleDragStart, modalRef, resetDrag, dragStyle } = useDraggable();

  const [selectedSections, setSelectedSections] = useState<Set<SectionId>>(
    () => getDefaultSections(hasLOSOverlays, hasCoverageOverlays),
  );
  const [pageSize, setPageSize] = useState<'letter' | 'A4'>('letter');
  const [isGenerating, setIsGenerating] = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSelectedSections(getDefaultSections(hasLOSOverlays, hasCoverageOverlays));
      setPageSize('letter');
      setIsGenerating(false);
      resetDrag();
    }
  }, [isOpen, hasLOSOverlays, hasCoverageOverlays, resetDrag]);

  // Keyboard: Escape to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

  const toggleSection = useCallback((id: SectionId) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (isGenerating || selectedSections.size === 0) return;
    setIsGenerating(true);
    try {
      await onGenerate({
        sections: Array.from(selectedSections),
        page_size: pageSize,
        include_executive_summary: selectedSections.has('executive_summary'),
        include_bom_summary: selectedSections.has('bom_summary'),
        include_recommendations: selectedSections.has('recommendations'),
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate report.';
      alert(message);
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, selectedSections, pageSize, onGenerate, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="pdfrpt-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="PDF Report Configuration"
    >
      <div className="pdfrpt-modal" ref={modalRef} style={dragStyle}>
        {/* Header */}
        <div className="pdfrpt-header" onMouseDown={handleDragStart}>
          <div>
            <h2 className="pdfrpt-title">Generate PDF Report
              <span className="pdfrpt-drag-hint" aria-hidden="true"> · drag to move</span>
            </h2>
            <p className="pdfrpt-summary">
              Configure sections and options for the network planning report
            </p>
          </div>
          <button className="pdfrpt-close" type="button" onClick={onClose} title="Close">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="pdfrpt-body">
          {/* Sections */}
          <div>
            <h3 className="pdfrpt-field-label">Sections</h3>
            <div className="pdfrpt-section-list" style={{ marginTop: '0.5rem' }}>
              {REPORT_SECTIONS.map((section) => {
                const available = isSectionAvailable(section, hasLOSOverlays, hasCoverageOverlays);
                const checked = available && selectedSections.has(section.id);

                let hint: string | null = null;
                if (!available) {
                  if ('requiresLOS' in section && section.requiresLOS) {
                    hint = '(requires LOS analysis)';
                  } else if ('requiresCoverage' in section && section.requiresCoverage) {
                    hint = '(requires coverage analysis)';
                  }
                }

                return (
                  <label
                    key={section.id}
                    className={`pdfrpt-section-item${!available ? ' disabled' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="pdfrpt-checkbox"
                      checked={checked}
                      disabled={!available}
                      onChange={() => toggleSection(section.id)}
                    />
                    <span>{section.label}</span>
                    {hint && <span className="pdfrpt-hint">{hint}</span>}
                  </label>
                );
              })}
            </div>
          </div>

          <hr className="pdfrpt-divider" />

          {/* Page Size */}
          <div>
            <h3 className="pdfrpt-field-label">Page Size</h3>
            <div className="pdfrpt-radio-group" style={{ marginTop: '0.5rem' }}>
              <label className="pdfrpt-radio-item">
                <input
                  type="radio"
                  name="pdfrpt-pagesize"
                  value="letter"
                  checked={pageSize === 'letter'}
                  onChange={() => setPageSize('letter')}
                />
                <span>Letter (8.5 x 11 in)</span>
              </label>
              <label className="pdfrpt-radio-item">
                <input
                  type="radio"
                  name="pdfrpt-pagesize"
                  value="A4"
                  checked={pageSize === 'A4'}
                  onChange={() => setPageSize('A4')}
                />
                <span>A4 (210 x 297 mm)</span>
              </label>
            </div>
          </div>

          <hr className="pdfrpt-divider" />

          {/* Generate Button */}
          <button
            className="pdfrpt-btn-primary"
            type="button"
            disabled={selectedSections.size === 0 || isGenerating}
            onClick={handleGenerate}
            title={
              selectedSections.size === 0
                ? 'Select at least one section to generate a report'
                : 'Generate the PDF report with the selected sections'
            }
          >
            {isGenerating && <span className="pdfrpt-spinner" />}
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
