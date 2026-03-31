declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';

  interface UserOptions {
    head?: unknown[][];
    body?: unknown[][];
    foot?: unknown[][];
    startY?: number;
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    styles?: Record<string, unknown>;
    headStyles?: Record<string, unknown>;
    bodyStyles?: Record<string, unknown>;
    footStyles?: Record<string, unknown>;
    alternateRowStyles?: Record<string, unknown>;
    columnStyles?: Record<string, Record<string, unknown>>;
    theme?: 'striped' | 'grid' | 'plain' | 'css';
    showHead?: 'everyPage' | 'firstPage' | 'never';
    showFoot?: 'everyPage' | 'lastPage' | 'never';
    tableWidth?: 'auto' | 'wrap' | number;
    tableLineColor?: number | number[];
    tableLineWidth?: number;
    didDrawPage?: (data: unknown) => void;
    didParseCell?: (data: unknown) => void;
    willDrawCell?: (data: unknown) => void;
    didDrawCell?: (data: unknown) => void;
    [key: string]: unknown;
  }

  function autoTable(doc: jsPDF, options: UserOptions): void;
  export default autoTable;
}
