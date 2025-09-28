import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { GeneratedInvoice, InventoryItem, InvoiceItem, ProfileData } from '../types';
import { suggestInvoiceItemsForTotal } from '../services/geminiService';
import { initDB, getAllInvoices, addInvoice, deleteInvoiceAndRestock, getAllInventoryItems, getProfile, updateInventoryItem, clearAllInvoicesAndRestock } from '../db';

// --- Icons ---
const ViewIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>;
const PrintIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v6a2 2 0 002 2h1v-4a1 1 0 011-1h10a1 1 0 011 1v4h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const Spinner = () => <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;

// --- Components ---
const InvoiceTemplate = React.forwardRef<HTMLDivElement, { invoice: GeneratedInvoice | null; profile: ProfileData | null; language: 'fr' | 'ar', t: (key: any) => string }>(({ invoice, profile, language, t }, ref) => {
    if (!invoice) return null;

    const subtotal = invoice.items.reduce((sum, item) => sum + item.total, 0);
    const vat = subtotal * 0.20;
    const totalWithVat = subtotal + vat;
    const isArabic = language === 'ar';
    
    const companyName = profile?.companyName || t('companyHeader');
    const companyAddress = profile?.companyAddress || t('companyInfo');
    const companyICE = profile?.companyICE ? `I.C.E: ${profile.companyICE}` : '';
    const companyPhone = profile?.companyPhone ? `Tél: ${profile.companyPhone}` : '';

    return (
        <div ref={ref} className={`bg-white p-6 sm:p-8 font-sans text-sm text-gray-800 ${isArabic ? 'rtl' : 'ltr'}`} dir={isArabic ? 'rtl' : 'ltr'}>
            <div className="flex justify-between items-start mb-6">
                <div className={`${isArabic ? 'text-right' : 'text-left'}`}>
                    <h1 className="text-xl font-bold text-gray-900">{companyName}</h1>
                    <p className="text-xs mt-2 font-semibold">{t('companyAddressTitle')}:</p>
                    <p className="text-xs text-gray-600">{companyAddress}</p>
                    <p className="text-xs text-gray-600">{companyPhone}</p>
                </div>
                <div className={`${isArabic ? 'text-left' : 'text-right'}`}>
                    <h2 className="text-2xl font-bold uppercase text-gray-900">{t('invoice')}</h2>
                    <p className="mt-1">{t('invoiceNumber')}: {invoice.invoiceNumber}</p>
                    <p>{t('invoiceDate')}: {invoice.invoiceDate}</p>
                </div>
            </div>

            <div className={`mb-8 border-t border-b py-2 ${isArabic ? 'text-right' : 'text-left'}`}>
                <h3 className="font-semibold text-gray-700">{t('billTo')}:</h3>
                <p className="font-bold text-gray-800">{invoice.customerName}</p>
            </div>

            <table className="w-full mb-8">
                <thead className="bg-gray-200 text-gray-700 uppercase text-xs">
                    <tr>
                        <th className={`px-4 py-2 font-bold ${isArabic ? 'text-right' : 'text-left'}`}>{t('invoiceReference')}</th>
                        <th className={`px-4 py-2 font-bold ${isArabic ? 'text-right' : 'text-left'}`}>{t('description')}</th>
                        <th className="px-4 py-2 font-bold text-center">{t('quantity')}</th>
                        <th className="px-4 py-2 font-bold text-center">{t('invoicePU')}</th>
                        <th className={`px-4 py-2 font-bold ${isArabic ? 'text-left' : 'text-right'}`}>{t('invoiceTotalHT')}</th>
                    </tr>
                </thead>
                <tbody>
                    {invoice.items.map((item, index) => (
                        <tr key={index} className="border-b">
                            <td className="px-4 py-2">{item.reference}</td>
                            <td className="px-4 py-2">{item.description}</td>
                            <td className="px-4 py-2 text-center">{item.quantity}</td>
                            <td className="px-4 py-2 text-center">{item.unitPrice.toFixed(2)}</td>
                            <td className={`px-4 py-2 ${isArabic ? 'text-left' : 'text-right'}`}>{item.total.toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="flex justify-end mb-8">
                <div className="w-full sm:w-1/2 md:w-1/3">
                    <div className="flex justify-between py-1 border-b text-gray-600">
                        <span>{t('subtotalHT')}:</span>
                        <span>{subtotal.toFixed(2)} DH</span>
                    </div>
                    <div className="flex justify-between py-1 border-b text-gray-600">
                        <span>{t('vat20')}:</span>
                        <span>{vat.toFixed(2)} DH</span>
                    </div>
                    <div className="flex justify-between py-2 font-bold bg-gray-100 px-2 mt-2">
                        <span className="text-gray-800">{t('totalTTC')}:</span>
                        <span className="text-gray-900">{totalWithVat.toFixed(2)} DH</span>
                    </div>
                </div>
            </div>
            
            <div className={`flex ${isArabic ? 'justify-end' : 'justify-start'} mt-12 pt-6 border-t`}>
                <div className="text-xs text-gray-500">
                     <p>{t('footerDisclaimer')}</p>
                     <p className="mt-2">{companyICE}</p>
                </div>
            </div>
        </div>
    );
});

const SkeletonLoader = () => (
    <tbody>
        {Array.from({ length: 4 }).map((_, i) => (
            <tr key={i} className="bg-white border-b animate-pulse">
                <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded"></div></td>
                <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded"></div></td>
                <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded"></div></td>
                <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded"></div></td>
                <td className="px-6 py-4 text-right space-x-2"><div className="h-4 w-20 bg-gray-200 rounded inline-block"></div></td>
            </tr>
        ))}
    </tbody>
);


const InvoicePage: React.FC = () => {
    const { t, language } = useLanguage();
    const [invoices, setInvoices] = useState<GeneratedInvoice[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dbInitialized, setDbInitialized] = useState(false);
    
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [targetTotal, setTargetTotal] = useState('');
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState<GeneratedInvoice | null>(null);
    const invoicePrintRef = useRef<HTMLDivElement>(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [invoiceItems, inventoryItems, profile] = await Promise.all([
                getAllInvoices(), 
                getAllInventoryItems(),
                getProfile()
            ]);
            setInvoices(invoiceItems.sort((a, b) => b.id - a.id));
            setInventory(inventoryItems);
            setProfileData(profile);
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
    
    const filteredInvoices = useMemo(() => {
        if (!searchTerm) return invoices;
        const lowercasedTerm = searchTerm.toLowerCase();
        return invoices.filter(invoice =>
            invoice.customerName.toLowerCase().includes(lowercasedTerm) ||
            invoice.invoiceNumber.toLowerCase().includes(lowercasedTerm)
        );
    }, [invoices, searchTerm]);
    
    const handlePrint = useCallback(() => {
        const printContent = invoicePrintRef.current;
        if (!printContent) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) {
            document.body.removeChild(iframe);
            return;
        }

        iframeDoc.open();
        iframeDoc.write('<!DOCTYPE html><html><head><title>Print</title></head><body></body></html>');
        
        const tailwindScript = document.querySelector('script[src="https://cdn.tailwindcss.com"]');
        if (tailwindScript) {
            iframeDoc.head.appendChild(tailwindScript.cloneNode(true));
        }

        const printStyles = iframeDoc.createElement('style');
        printStyles.textContent = `
          @media print {
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              margin: 0;
            }
            /* Universal rule to ensure all text is black and shadows are removed for clarity */
            * {
              color: #000 !important;
              text-shadow: none !important;
              box-shadow: none !important;
            }
            /* Preserve essential background colors for visual structure */
            .bg-gray-100 { background-color: #f3f4f6 !important; }
            .bg-gray-200 { background-color: #e5e7eb !important; }
          }
        `;
        iframeDoc.head.appendChild(printStyles);

        document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
            iframeDoc.head.appendChild(node.cloneNode(true));
        });
        
        iframeDoc.body.innerHTML = printContent.innerHTML;

        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
                 document.body.removeChild(iframe);
            }, 1000);
        }, 1000);
    }, []);
    
    const handleGenerateInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (inventory.length === 0) {
            setError(t('inventoryEmptyWarning'));
            return;
        }
        if (!customerName.trim() || !targetTotal || !invoiceNumber.trim()) return;

        setIsGenerating(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const totalTTC = parseFloat(targetTotal);
            const targetHT = totalTTC / 1.2;
            
            const suggested = await suggestInvoiceItemsForTotal(inventory, targetHT);
            if (suggested.length === 0) {
                throw new Error(t('generateByTotalError'));
            }

            // Pre-check for sufficient stock before making any changes
            for (const suggestedItem of suggested) {
                const inventoryItem = inventory.find(i => i.id === suggestedItem.id);
                if (!inventoryItem) throw new Error(`Inventory item with id ${suggestedItem.id} not found.`);
                
                if (inventoryItem.quantity < suggestedItem.quantity) {
                    const errorMessage = t('insufficientStockError')
                        .replace('{itemName}', inventoryItem.name)
                        .replace('{required}', String(suggestedItem.quantity))
                        .replace('{available}', String(inventoryItem.quantity));
                    throw new Error(errorMessage);
                }
            }
            
            let invoiceTotalHT = 0;
            const invoiceItems: InvoiceItem[] = suggested.map(suggestedItem => {
                const inventoryItem = inventory.find(i => i.id === suggestedItem.id)!;
                const total = suggestedItem.quantity * inventoryItem.price;
                invoiceTotalHT += total;
                return {
                    reference: inventoryItem.reference,
                    description: inventoryItem.name,
                    quantity: suggestedItem.quantity,
                    unitPrice: inventoryItem.price,
                    total: total,
                };
            });
            
            const newInvoice: Omit<GeneratedInvoice, 'id'> = {
                invoiceNumber,
                customerName,
                invoiceDate: new Date().toISOString().split('T')[0],
                totalAmount: invoiceTotalHT,
                items: invoiceItems,
            };

            // Deduct from inventory
            const updatePromises = suggested.map(suggestedItem => {
                const inventoryItem = inventory.find(i => i.id === suggestedItem.id)!;
                const updatedItem: InventoryItem = {
                    ...inventoryItem,
                    quantity: inventoryItem.quantity - suggestedItem.quantity,
                };
                return updateInventoryItem(updatedItem);
            });

            await Promise.all(updatePromises);
            await addInvoice(newInvoice);
            
            setSuccessMessage(t('invoiceGeneratedSuccess'));
            setCustomerName('');
            setTargetTotal('');
            setInvoiceNumber('');
            setTimeout(() => setSuccessMessage(null), 4000);
            await loadData();

        } catch (err) {
            console.error("Failed to generate invoice:", err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(errorMessage);
            setTimeout(() => setError(null), 4000);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDeleteInvoice = async (id: number) => {
        if (window.confirm(t('confirmDeleteInvoiceAndRestock'))) {
            await deleteInvoiceAndRestock(id);
            await loadData();
        }
    };

    const handleClearInvoices = async () => {
        if (window.confirm(t('confirmClearAllInvoices'))) {
            if (!dbInitialized) return;
            await clearAllInvoicesAndRestock();
            await loadData();
        }
    };
    
    return (
        <div className="container mx-auto p-4 sm:p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">{t('createInvoiceTitle')}</h1>

            {/* Create Invoice Form */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
                <form onSubmit={handleGenerateInvoice} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-600">{t('invoiceNumber')}</label>
                        <input 
                            type="text"
                            value={invoiceNumber}
                            onChange={(e) => setInvoiceNumber(e.target.value)}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900"
                            required
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-600">{t('clientName')}</label>
                        <input 
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600">{t('totalAmountTTC')}</label>
                        <input
                            type="number"
                            step="0.01"
                            value={targetTotal}
                            onChange={(e) => setTargetTotal(e.target.value)}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900"
                            placeholder="ex: 1500.00"
                            required
                        />
                    </div>
                    <button type="submit" disabled={isGenerating || !dbInitialized || inventory.length === 0} className="w-full flex justify-center items-center px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 transition-all shadow-sm hover:shadow-md">
                        {isGenerating ? <Spinner /> : t('generateInvoiceButton')}
                    </button>
                </form>
                {inventory.length === 0 && dbInitialized && <p className="mt-4 text-sm text-yellow-600">{t('inventoryEmptyWarning')}</p>}
                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                {successMessage && <p className="mt-4 text-sm text-green-600">{successMessage}</p>}
            </div>

            {/* Invoice History */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                <div className="p-4 flex flex-col sm:flex-row justify-between items-start border-b border-gray-200 bg-gray-50 gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-700">{t('invoiceHistoryTitle')} ({invoices.length})</h2>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                        <input
                            type="text"
                            placeholder={t('searchByClientOrInvoice') ?? 'Search...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="p-2 border border-gray-300 rounded-md shadow-sm w-full sm:w-64 bg-white text-gray-900"
                        />
                        <button 
                            onClick={handleClearInvoices}
                            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!dbInitialized || invoices.length === 0}
                        >
                            {t('clearInvoicesButton')}
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                                <th scope="col" className="px-6 py-3">{t('invoiceNumber')}</th><th scope="col" className="px-6 py-3">{t('clientName')}</th>
                                <th scope="col" className="px-6 py-3">{t('invoiceDate')}</th><th scope="col" className="px-6 py-3">{t('totalAmount')}</th>
                                <th scope="col" className="px-6 py-3 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        {isLoading ? <SkeletonLoader /> : (
                        <tbody>
                            {filteredInvoices.length > 0 ? filteredInvoices.map(invoice => (
                                <tr key={invoice.id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-800">{invoice.invoiceNumber}</td>
                                    <td className="px-6 py-4 font-bold text-gray-900">{invoice.customerName}</td>
                                    <td className="px-6 py-4">{invoice.invoiceDate}</td>
                                    <td className="px-6 py-4">{(invoice.totalAmount * 1.20).toFixed(2)} DH</td>
                                    <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                                        <button onClick={() => setSelectedInvoice(invoice)} className="text-gray-500 hover:text-indigo-600 transition-colors" title={t('view')}><ViewIcon /></button>
                                        <button onClick={() => { setSelectedInvoice(invoice); setTimeout(() => handlePrint(), 100); }} className="text-gray-500 hover:text-blue-600 transition-colors" title={t('print')}><PrintIcon/></button>
                                        <button onClick={() => handleDeleteInvoice(invoice.id)} className="text-gray-500 hover:text-red-600 transition-colors" title={t('delete')}><TrashIcon/></button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={5} className="text-center py-12 text-gray-500">
                                    <h3 className="text-lg font-medium">{searchTerm ? t('noInvoicesFound') : t('emptyInvoicesMessage')}</h3>
                                    {!searchTerm && <p className="text-sm">{t('createNewInvoice')}</p>}
                                </td></tr>
                            )}
                        </tbody>
                        )}
                    </table>
                </div>
            </div>
            
            {/* View/Print Modal */}
            {selectedInvoice && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-start p-4 overflow-y-auto">
                    <div className="bg-gray-100 rounded-lg shadow-xl w-full max-w-4xl my-8 animate-fade-in-up">
                        <div className="p-4 flex justify-between items-center bg-white rounded-t-lg border-b sticky top-0">
                            <h2 className="text-xl font-bold text-gray-900">{t('invoice')} - {selectedInvoice.invoiceNumber}</h2>
                            <div>
                                <button onClick={handlePrint} className="mr-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">{t('printInvoice')}</button>
                                <button onClick={() => setSelectedInvoice(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">{t('close')}</button>
                            </div>
                        </div>
                        <div className="p-2 sm:p-4">
                            <InvoiceTemplate ref={invoicePrintRef} invoice={selectedInvoice} profile={profileData} language={language} t={t} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoicePage;