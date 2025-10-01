// FIX: Define and export the User interface. Remove circular self-import.
export interface User {
  username: string;
  role: 'admin' | 'user';
}

export interface ProfileData {
  id: number; // Static key, e.g., 1
  userName: string;
  companyName: string;
  companyICE: string;
  companyAddress: string;
  companyPhone: string;
}

export interface InventoryItem {
  id: number;
  reference: string;
  name: string;
  quantity: number;
  price: number;
  purchaseDate: string; // YYYY-MM-DD
}

export interface InvoiceItem {
  reference: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface GeneratedInvoice {
  id: number;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string; // YYYY-MM-DD
  totalAmount: number;
  items: InvoiceItem[];
}

// FIX: Define and export SuggestedItem for AI-based invoice item suggestions.
export interface SuggestedItem {
  id: number; // Corresponds to InventoryItem.id
  quantity: number;
}

// FIX: Define and export types for data extracted from invoice images by AI.
export interface ExtractedInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ExtractedInvoiceData {
  invoiceNumber: string;
  vendorName: string;
  invoiceDate: string; // YYYY-MM-DD
  totalAmount: number;
  items: ExtractedInvoiceItem[];
}
