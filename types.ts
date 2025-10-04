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
