/**
 * Map Export Service
 * Export map as PNG, JPEG, or PDF
 * Iteration 11, Priority 3, Task 3.3
 */

export type ExportFormat = 'png' | 'jpeg' | 'pdf';
export type ExportOrientation = 'portrait' | 'landscape';
export type ExportPageSize = 'a4' | 'letter' | 'legal';

export interface ExportOptions {
  format: ExportFormat;
  quality?: number; // 0-1 for JPEG
  width?: number;
  height?: number;
  includeLegend?: boolean;
  title?: string;
  filename?: string;
}

export interface ExportProgress {
  stage: 'rendering' | 'converting' | 'downloading';
  percent: number;
}

export interface LegendItem {
  type: 'symbol' | 'line' | 'circle';
  label: string;
  color: string;
  style?: string;
  width?: number;
}

export interface PDFMetadata {
  title: string;
  author?: string;
  subject?: string;
  creator: string;
  creationDate: Date;
}

/**
 * Map Export Service
 */
export class MapExportService {
  private supported: boolean;
  private formats: ExportFormat[] = ['png', 'jpeg', 'pdf'];
  private onProgress?: (progress: ExportProgress) => void;

  constructor(onProgress?: (progress: ExportProgress) => void) {
    this.supported = typeof document !== 'undefined';
    this.onProgress = onProgress;
  }

  /**
   * Check if export is supported
   */
  isSupported(): boolean {
    return this.supported;
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): ExportFormat[] {
    return [...this.formats];
  }

  /**
   * Export map as image
   */
  async exportImage(
    mapElement: HTMLElement,
    options: ExportOptions
  ): Promise<void> {
    this.updateProgress('rendering', 0);

    const canvas = await this.elementToCanvas(mapElement, options);

    this.updateProgress('converting', 50);

    const format = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = options.format === 'jpeg' ? (options.quality || 0.95) : undefined;
    const dataUrl = canvas.toDataURL(format, quality);

    this.updateProgress('downloading', 90);

    this.downloadFile(dataUrl, options.filename || this.getDefaultFilename(options.format));

    this.updateProgress('downloading', 100);
  }

  /**
   * Export map as PDF
   */
  async exportPDF(
    mapElement: HTMLElement,
    options: ExportOptions & {
      orientation?: ExportOrientation;
      pageSize?: ExportPageSize;
      metadata?: Partial<PDFMetadata>;
    }
  ): Promise<void> {
    this.updateProgress('rendering', 0);

    // For now, capture as image and embed in PDF
    // In a real implementation, this would use a library like jsPDF
    const canvas = await this.elementToCanvas(mapElement, options);
    const imageData = canvas.toDataURL('image/png');

    this.updateProgress('converting', 50);

    // Simulate PDF generation
    // In production, use jsPDF library
    const pdfData = this.createPDFBlob(imageData, options);

    this.updateProgress('downloading', 90);

    this.downloadFile(
      URL.createObjectURL(pdfData),
      options.filename || this.getDefaultFilename('pdf')
    );

    this.updateProgress('downloading', 100);
  }

  /**
   * Generate legend items
   */
  generateLegend(): LegendItem[] {
    return [
      {
        type: 'symbol',
        label: 'Gateway',
        color: '#FF5722',
      },
      {
        type: 'symbol',
        label: 'Router',
        color: '#2196F3',
      },
      {
        type: 'symbol',
        label: 'Client',
        color: '#4CAF50',
      },
      {
        type: 'circle',
        label: 'LoRa Coverage (5 km)',
        color: '#2196F3',
        style: 'dashed',
      },
      {
        type: 'line',
        label: 'Strong Link',
        color: '#4CAF50',
        width: 3,
      },
      {
        type: 'line',
        label: 'Weak Link',
        color: '#FFA500',
        width: 2,
      },
      {
        type: 'line',
        label: 'No Link',
        color: '#F44336',
        width: 1,
      },
    ];
  }

  /**
   * Apply print styles
   */
  applyPrintStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        .no-print,
        .zoom-control,
        .layer-selector,
        .toolbar {
          display: none !important;
        }
        .page-break {
          page-break-after: always;
        }
        @page {
          margin: 1cm;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Convert element to canvas
   */
  private async elementToCanvas(
    element: HTMLElement,
    options: ExportOptions
  ): Promise<HTMLCanvasElement> {
    const scale = 2; // High DPI
    const width = options.width || element.offsetWidth;
    const height = options.height || element.offsetHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.scale(scale, scale);

    // In a real implementation, use html2canvas library
    // For now, return empty canvas
    return canvas;
  }

  /**
   * Create PDF blob
   */
  private createPDFBlob(imageData: string, options: any): Blob {
    // Simplified PDF creation
    // In production, use jsPDF library
    const metadata: PDFMetadata = {
      title: options.title || 'Mesh Network Plan',
      author: options.metadata?.author || 'User',
      subject: options.metadata?.subject || 'LoRa Mesh Network',
      creator: 'Mesh Community Planner',
      creationDate: new Date(),
    };

    // Return a simple blob for testing
    return new Blob(['PDF content'], { type: 'application/pdf' });
  }

  /**
   * Download file
   */
  private downloadFile(url: string, filename: string): void {
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
  }

  /**
   * Get default filename
   */
  private getDefaultFilename(format: ExportFormat): string {
    const timestamp = new Date().toISOString().slice(0, 10);
    return `mesh-network-plan-${timestamp}.${format}`;
  }

  /**
   * Update progress
   */
  private updateProgress(stage: ExportProgress['stage'], percent: number): void {
    if (this.onProgress) {
      this.onProgress({ stage, percent });
    }
  }
}

// Singleton instance
let exportService: MapExportService | null = null;

/**
 * Get export service instance
 */
export function getMapExportService(
  onProgress?: (progress: ExportProgress) => void
): MapExportService {
  if (!exportService) {
    exportService = new MapExportService(onProgress);
  }
  return exportService;
}
