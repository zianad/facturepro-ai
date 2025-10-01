import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { GeneratedInvoice, InventoryItem, ProfileData, InvoiceItem } from '../types';
import { initDB, getAllInvoices, deleteInvoiceAndRestock, createInvoiceAndUpdateStock, getAllInventoryItems, getProfile } from '../db';

// --- Icons ---
const Spinner = () => <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>;
const PrintIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v3a2 2 0 002 2h8a2 2 0 002-2v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg>;

const InvoicePage: React.FC = () => {
    const { t } = useLanguage();
    const [invoices, setInvoices] = useState<GeneratedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dbInitialized, setDbInitialized] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // For Generating Invoice by Total
    const [isGeneratingModalOpen, setGeneratingModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    
    const [generationForm, setGenerationForm] = useState({
      invoiceNumber: '',
      customerName: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      totalAmount: ''
    });

    // For Viewing Invoice
    const [viewingInvoice, setViewingInvoice] = useState<GeneratedInvoice | null>(null);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const printRef = useRef<HTMLDivElement>(null);
    
    const VAT_RATE = 0.20;

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [invoiceList, profileData] = await Promise.all([getAllInvoices(), getProfile()]);
            setInvoices(invoiceList.sort((a, b) => b.id - a.id));
            setProfile(profileData);
        } catch (error) {
            console.error("Failed to load data from DB:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        initDB().then(success => {
            if (success) {
                setDbInitialized(true);
                loadData();
            } else {
                setIsLoading(false);
            }
        });
    }, [loadData]);
    
    // Algorithm to select items for invoice
    const selectInvoiceItemsForTotalLocally = (
      inventory: InventoryItem[],
      targetTotalTTC: number
    ): { items: InvoiceItem[], finalTotalTTC: number } => {
        const targetTotalHT = targetTotalTTC / (1 + VAT_RATE);
        let currentTotalHT = 0;
        const selectedItems: InvoiceItem[] = [];
        const availableItems = inventory.map(item => ({ ...item })); // Create a mutable copy

        if (availableItems.length === 0) return { items: [], finalTotalTTC: 0 };
        
        availableItems.sort((a, b) => b.price - a.price);

        const wholesaleQuantities = [100, 50, 24, 12, 6, 1];

        for (const qty of wholesaleQuantities) {
            for (const item of availableItems) {
                const neededForTotal = targetTotalHT - currentTotalHT;
                if (item.quantity > 0 && item.price > 0 && item.price * qty <= neededForTotal) {
                    const maxPossibleQty = Math.floor(neededForTotal / item.price);
                    const qtyToAdd = Math.min(item.quantity, maxPossibleQty, qty);
                    
                    if (qtyToAdd > 0) {
                        const existing = selectedItems.find(i => i.reference === item.reference);
                        if (existing) {
                            existing.quantity += qtyToAdd;
                            existing.total += qtyToAdd * item.price;
                        } else {
                            selectedItems.push({
                                reference: item.reference,
                                description: item.name,
                                quantity: qtyToAdd,
                                unitPrice: item.price,
                                total: qtyToAdd * item.price
                            });
                        }
                        currentTotalHT += qtyToAdd * item.price;
                        item.quantity -= qtyToAdd;
                    }
                }
            }
        }
        
        const calculatedTotalTTC = currentTotalHT * (1 + VAT_RATE);
        const difference = targetTotalTTC - calculatedTotalTTC;
        const differenceHT = difference / (1 + VAT_RATE);
        
        if (differenceHT !== 0 && selectedItems.length > 0) {
            selectedItems.sort((a, b) => b.total - a.total);
            const mostExpensiveItem = selectedItems[0];
            const originalTotal = mostExpensiveItem.total;
            const newTotal = originalTotal + differenceHT;
            
            if (newTotal > 0) {
                mostExpensiveItem.total = newTotal;
                mostExpensiveItem.unitPrice = newTotal / mostExpensiveItem.quantity;
            }
        }
        
        const finalTotalHT = selectedItems.reduce((sum, item) => sum + item.total, 0);

        return { items: selectedItems, finalTotalTTC: finalTotalHT * (1 + VAT_RATE) };
    };

    const handleGenerateByTotal = async (e: React.FormEvent) => {
        e.preventDefault();
        const total = parseFloat(generationForm.totalAmount);
        if (!generationForm.customerName.trim() || isNaN(total) || total <= 0 || !generationForm.invoiceNumber.trim()) {
            setGenerationError(t('invoiceCreationError'));
            return;
        }

        setIsGenerating(true);
        setGenerationError(null);
        
        try {
            const inventory = await getAllInventoryItems();
            const availableInventory = inventory.filter(i => 
                i.quantity > 0 && new Date(i.purchaseDate) <= new Date(generationForm.invoiceDate)
            );
            
            if (availableInventory.length === 0) {
                throw new Error(t('noItemsForDateError'));
            }
            
            const { items: invoiceItems, finalTotalTTC } = selectInvoiceItemsForTotalLocally(availableInventory, total);

            if (invoiceItems.length === 0) {
                throw new Error(t('generateByTotalError'));
            }

            const newInvoice: Omit<GeneratedInvoice, 'id'> = {
                invoiceNumber: generationForm.invoiceNumber,
                customerName: generationForm.customerName,
                invoiceDate: generationForm.invoiceDate,
                totalAmount: finalTotalTTC,
                items: invoiceItems
            };

            await createInvoiceAndUpdateStock(newInvoice);
            setGeneratingModalOpen(false);
            setGenerationForm({
              invoiceNumber: '', customerName: '', 
              invoiceDate: new Date().toISOString().split('T')[0], totalAmount: ''
            });
            await loadData();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(t('generateByTotalError'));
            if (errorMessage.includes("Insufficient stock")) {
              const match = /Insufficient stock for (.*?) \(Ref: (.*?)\). Required: (.*?), Available: (.*?)./.exec(errorMessage);
              if (match) {
                  const [, itemName, , required, available] = match;
                  setGenerationError(t('insufficientStockError').replace('{itemName}', itemName).replace('{required}', required).replace('{available}', available));
              } else {
                  setGenerationError(errorMessage);
              }
            } else {
              setGenerationError(errorMessage);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm(t('confirmDeleteInvoiceAndRestock'))) {
            await deleteInvoiceAndRestock(id);
            await loadData();
        }
    };

    const handlePrint = () => {
        const printContent = printRef.current;
        if (printContent) {
            const newWindow = window.open('', '_blank', 'height=800,width=800');
            const styles = `
              <style>
                @import url('https://rsms.me/inter/inter.css');
                body { font-family: 'Inter', sans-serif; margin: 0; }
                .invoice-container { width: 100%; max-width: 800px; margin: auto; padding: 20px; }
                .header, .footer { text-align: center; }
                .details { display: flex; justify-content: space-between; margin: 20px 0; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .totals { float: right; width: 40%; margin-top: 20px; }
                .totals table { width: 100%; }
                .totals td:first-child { text-align: right; font-weight: bold; }
                .page-break { page-break-before: always; }
                thead.report-header { display: table-header-group; }
                tfoot { display: table-footer-group; }
                .no-print { display: none; }
                @media print {
                  .invoice-container { padding: 0; }
                  thead.report-header { display: table-header-group; }
                  tbody { page-break-inside: auto; }
                  tr { page-break-inside: avoid; page-break-after: auto; }
                }
              </style>
            `;
            const headerHtml = `
              <div class="header">
                  <h2>${profile?.companyName || t('companyHeader')}</h2>
                  <p>${profile?.companyAddress || t('companyInfo')}</p>
              </div>`;

            newWindow?.document.write(`<html><head><title>${t('invoice')}</title>${styles}</head><body>`);
            newWindow?.document.write('<div class="invoice-container">');
            newWindow?.document.write(printContent.innerHTML.replace('<thead class="report-header">', `<thead class="report-header">${headerHtml}`));
            newWindow?.document.write('</div></body></html>');
            newWindow?.document.close();
            newWindow?.focus();
            setTimeout(() => newWindow?.print(), 500);
        }
    };
    
    const filteredInvoices = useMemo(() => {
        if (!searchTerm) return invoices;
        const lowercasedTerm = searchTerm.toLowerCase();
        return invoices.filter(inv =>
            inv.customerName.toLowerCase().includes(lowercasedTerm) ||
            inv.invoiceNumber.toLowerCase().includes(lowercasedTerm)
        );
    }, [invoices, searchTerm]);
    
    return (
        <div className="container mx-auto p-4 sm:p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">{t('invoices')}</h1>
            
            <div className="grid grid-cols-1 gap-6 mb-6">
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h2 className="text-xl font-semibold mb-2 text-gray-700">{t('createInvoiceTitle')}</h2>
                    <p className="text-sm text-gray-500 mb-4">{t('generateInvoiceByTotal')}</p>
                    <button onClick={() => setGeneratingModalOpen(true)} className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md disabled:bg-indigo-400" disabled={!dbInitialized}>
                        {t('createNewInvoice')}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                <div className="p-4 flex flex-col sm:flex-row justify-between items-center border-b bg-gray-50">
                    <h2 className="text-xl font-semibold text-gray-700 mb-2 sm:mb-0">{t('invoiceHistoryTitle')} ({invoices.length})</h2>
                    <input type="text" placeholder={t('searchByClientOrInvoice') ?? 'Search...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-2 border rounded-md shadow-sm w-full sm:w-64"/>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600">
                         <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                             <tr>
                                <th className="px-6 py-3">{t('invoiceNumber')}</th>
                                <th className="px-6 py-3">{t('clientName')}</th>
                                <th className="px-6 py-3">{t('invoiceDate')}</th>
                                <th className="px-6 py-3">{t('totalAmountTTC')}</th>
                                <th className="px-6 py-3 text-right">{t('actions')}</th>
                             </tr>
                         </thead>
                         <tbody>
                            {isLoading ? (
                                <tr><td colSpan={5} className="text-center py-10">{t('loading')}...</td></tr>
                            ) : filteredInvoices.length > 0 ? (
                                filteredInvoices.map(inv => (
                                    <tr key={inv.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium">{inv.invoiceNumber}</td>
                                        <td className="px-6 py-4 font-bold">{inv.customerName}</td>
                                        <td className="px-6 py-4">{inv.invoiceDate}</td>
                                        <td className="px-6 py-4">{inv.totalAmount.toFixed(2)} DH</td>
                                        <td className="px-6 py-4 text-right space-x-3">
                                            <button onClick={() => setViewingInvoice(inv)} className="text-indigo-600 hover:text-indigo-800"><EyeIcon /></button>
                                            <button onClick={() => handleDelete(inv.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={5} className="text-center py-12 text-gray-500">
                                    <h3 className="text-lg font-medium">{searchTerm ? t('noInvoicesFound') : t('emptyInvoicesMessage')}</h3>
                                    {!searchTerm && <button onClick={() => setGeneratingModalOpen(true)} className="mt-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">{t('createNewInvoice')}</button>}
                                </td></tr>
                            )}
                         </tbody>
                    </table>
                </div>
            </div>

            {isGeneratingModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                        <form onSubmit={handleGenerateByTotal}>
                            <div className="p-5 border-b"><h2 className="text-xl font-bold">{t('createInvoiceTitle')}</h2></div>
                            <fieldset disabled={isGenerating} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <label htmlFor="invoiceNumber" className="block text-sm font-medium text-gray-700">{t('invoiceNumber')}</label>
                                    <input type="text" id="invoiceNumber" value={generationForm.invoiceNumber} onChange={e => setGenerationForm(f => ({...f, invoiceNumber: e.target.value}))} className="mt-1 p-2 w-full border rounded-md" required/>
                                </div>
                                 <div className="sm:col-span-2">
                                    <label htmlFor="customerName" className="block text-sm font-medium text-gray-700">{t('clientName')}</label>
                                    <input type="text" id="customerName" value={generationForm.customerName} onChange={e => setGenerationForm(f => ({...f, customerName: e.target.value}))} className="mt-1 p-2 w-full border rounded-md" required/>
                                </div>
                                <div>
                                    <label htmlFor="invoiceDate" className="block text-sm font-medium text-gray-700">{t('invoiceDate')}</label>
                                    <input type="date" id="invoiceDate" value={generationForm.invoiceDate} onChange={e => setGenerationForm(f => ({...f, invoiceDate: e.target.value}))} className="mt-1 p-2 w-full border rounded-md" required/>
                                </div>
                                <div>
                                    <label htmlFor="targetTotal" className="block text-sm font-medium text-gray-700">{t('targetTotal')}</label>
                                    <input type="number" id="targetTotal" value={generationForm.totalAmount} onChange={e => setGenerationForm(f => ({...f, totalAmount: e.target.value}))} className="mt-1 p-2 w-full border rounded-md" placeholder="15000" required/>
                                </div>
                                {generationError && <p className="sm:col-span-2 text-sm text-red-600">{generationError}</p>}
                            </fieldset>
                            <div className="p-4 flex justify-end space-x-3 bg-gray-50">
                                <button type="button" onClick={() => setGeneratingModalOpen(false)} className="px-4 py-2 text-sm bg-white border rounded-md">{t('cancel')}</button>
                                <button type="submit" disabled={isGenerating} className="px-4 py-2 w-28 flex justify-center text-sm text-white bg-indigo-600 rounded-md disabled:bg-indigo-400">{isGenerating ? <Spinner /> : t('generate')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {viewingInvoice && (
                <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex justify-center items-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center no-print">
                            <h2 className="text-xl font-bold">{t('invoice')} #{viewingInvoice.invoiceNumber}</h2>
                            <div>
                                <button onClick={handlePrint} className="px-4 py-2 mr-2 text-sm text-white bg-indigo-600 rounded-md inline-flex items-center"><PrintIcon />{t('print')}</button>
                                <button onClick={() => setViewingInvoice(null)} className="px-4 py-2 text-sm bg-gray-200 rounded-md">{t('close')}</button>
                            </div>
                        </div>
                        <div className="p-8 overflow-y-auto" ref={printRef}>
                          <header className="text-center mb-10">
                              <h1 className="text-3xl font-bold uppercase">{profile?.companyName || t('companyHeader')}</h1>
                              <p className="text-sm">{t('companySubHeader')}</p>
                              <div className="text-xs text-gray-600 mt-2">
                                  <p>{t('companyAddressTitle')}: {profile?.companyAddress || t('companyInfo')}</p>
                                  <p>{profile?.companyPhone || ''}</p>
                                  <p>{t('companyLegal')}</p>
                              </div>
                          </header>
                          <div className="flex justify-between items-start mb-6 pb-4 border-b">
                              <div>
                                  <h3 className="font-bold mb-1">{t('billTo')}:</h3>
                                  <p>{viewingInvoice.customerName}</p>
                              </div>
                              <div className="text-right">
                                  <p><strong>{t('invoiceNumber')}:</strong> {viewingInvoice.invoiceNumber}</p>
                                  <p><strong>{t('invoiceDate')}:</strong> {viewingInvoice.invoiceDate}</p>
                              </div>
                          </div>
                          <table className="w-full text-sm mb-8">
                              <thead className="report-header">
                                  <tr className="bg-gray-100 text-left">
                                      <th className="p-2">{t('invoiceReference')}</th>
                                      <th className="p-2">{t('description')}</th>
                                      <th className="p-2">{t('quantity')}</th>
                                      <th className="p-2">{t('invoicePU')}</th>
                                      <th className="p-2">{t('invoiceTotalHT')}</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {viewingInvoice.items.map((item, i) => (
                                      <tr key={i}>
                                          <td className="p-2 border-b">{item.reference}</td>
                                          <td className="p-2 border-b">{item.description}</td>
                                          <td className="p-2 border-b">{item.quantity}</td>
                                          <td className="p-2 border-b">{item.unitPrice.toFixed(2)}</td>
                                          <td className="p-2 border-b">{item.total.toFixed(2)}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                          <div className="flex justify-end">
                              <div className="w-full max-w-xs">
                                  <table className="w-full text-sm">
                                      <tbody>
                                          <tr><td className="p-2 text-right font-bold">{t('subtotalHT')}:</td><td className="p-2 w-32 text-right">{(viewingInvoice.totalAmount / (1 + VAT_RATE)).toFixed(2)} DH</td></tr>
                                          <tr><td className="p-2 text-right font-bold">{t('vat20')}:</td><td className="p-2 text-right">{(viewingInvoice.totalAmount - (viewingInvoice.totalAmount / (1 + VAT_RATE))).toFixed(2)} DH</td></tr>
                                          <tr className="bg-gray-100 font-bold text-lg"><td className="p-2 text-right">{t('totalTTC')}:</td><td className="p-2 text-right">{viewingInvoice.totalAmount.toFixed(2)} DH</td></tr>
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                          <footer className="mt-20 pt-10 border-t text-center text-xs text-gray-600">
                              <p>{t('stampAndSignature')}</p>
                              <p className="mt-4">{t('footerDisclaimer')}</p>
                          </footer>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default InvoicePage;