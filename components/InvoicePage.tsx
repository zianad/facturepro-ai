import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { GeneratedInvoice, InventoryItem, InvoiceItem, ProfileData, SuggestedItem } from '../types';
import { initDB, getAllInvoices, deleteInvoiceAndRestock, getAllInventoryItems, getProfile, clearAllInvoicesAndRestock, createInvoiceAndUpdateStock } from '../db';

// --- Icons ---
const ViewIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>;
const PrintIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v6a2 2 0 002 2h1v-4a1 1 0 011-1h10a1 1 0 011 1v4h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const Spinner = () => <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;


/**
 * Selects a combination of inventory items to match a target total using a greedy algorithm
 * that prioritizes wholesale-style quantities for more realistic invoices.
 * @param targetTotal The desired total amount for the invoice.
 * @param inventory A list of available inventory items.
 * @returns An array of suggested items with their quantities.
 */
const selectInvoiceItemsForTotalLocally = (targetTotal: number, inventory: InventoryItem[]): SuggestedItem[] => {
    const availableItems = inventory
        .filter(item => item.quantity > 0 && item.price > 0)
        .sort((a, b) => a.price - b.price); // Sort by price ascending to include more variety

    if (availableItems.length === 0) {
        return [];
    }
    
    let remainingTotal = targetTotal;
    const solutionMap = new Map<number, SuggestedItem>();
    // Define wholesale pack sizes, from large cases to single units for fine-tuning
    const wholesaleQuantities = [100, 60, 50, 48, 24, 12, 1];

    for (const packQty of wholesaleQuantities) {
        for (const item of availableItems) {
            // Price of a full pack of this item
            const packPrice = item.price * packQty;
            if (packPrice <= 0 || packPrice > remainingTotal) {
                continue; // Too expensive or invalid price, skip
            }
            
            const currentAddedQty = solutionMap.get(item.id)?.quantity || 0;
            const remainingStockForItem = item.quantity - currentAddedQty;

            if (remainingStockForItem < packQty) {
                continue; // Not enough stock for a full pack
            }

            // Calculate how many packs of this size can be added
            const maxPacksByTotal = Math.floor(remainingTotal / packPrice);
            const maxPacksByStock = Math.floor(remainingStockForItem / packQty);
            const packsToAdd = Math.min(maxPacksByTotal, maxPacksByStock);

            if (packsToAdd > 0) {
                const quantityToAdd = packsToAdd * packQty;
                solutionMap.set(item.id, { id: item.id, quantity: currentAddedQty + quantityToAdd });
                remainingTotal -= quantityToAdd * item.price;
            }
        }
    }
    
    // --- Overshoot Logic to get closer ---
    const currentSolution = Array.from(solutionMap.values());
    const diff = remainingTotal; // This is the small amount left to fill

    // If we are very close, no need to overshoot
    if (diff < 0.01) {
        return currentSolution;
    }

    // Find the best single item to add that creates the smallest positive overshoot
    let bestOvershootItem: InventoryItem | null = null;
    let minOvershoot = Infinity;

    for (const item of availableItems) {
        const currentSelection = solutionMap.get(item.id);
        const canAddMore = !currentSelection || item.quantity > currentSelection.quantity;

        if (canAddMore) {
            const overshoot = item.price - diff;
            if (overshoot >= 0 && overshoot < minOvershoot) {
                 minOvershoot = overshoot;
                 bestOvershootItem = item;
            }
        }
    }

    // If overshooting with a single item is better than the current remainder, apply it
    if (bestOvershootItem && minOvershoot < diff) {
        const existingItem = solutionMap.get(bestOvershootItem.id);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            solutionMap.set(bestOvershootItem.id, { id: bestOvershootItem.id, quantity: 1 });
        }
        return Array.from(solutionMap.values());
    }
    
    const resultingSolution = Array.from(solutionMap.values());
    const finalTotal = resultingSolution.reduce((acc, s) => {
        const item = inventory.find(i => i.id === s.id);
        return acc + (item ? item.price * s.quantity : 0);
    }, 0);

    // If the generated total is too far from the target, consider it a failure.
    // This prevents returning a very small invoice for a large target.
    if (finalTotal < targetTotal * 0.9) { 
        return []; 
    }

    return resultingSolution;
};


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
    // Data state
    const [invoices, setInvoices] = useState<GeneratedInvoice[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    
    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [dbInitialized, setDbInitialized] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    // Form state for new invoice
    const initialInvoiceDetails = {
        invoiceNumber: '',
        customerName: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        targetTotal: ''
    };
    const [newInvoiceDetails, setNewInvoiceDetails] = useState(initialInvoiceDetails);

    // History and Modal state
    const [historySearchTerm, setHistorySearchTerm] = useState('');
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
            setError("Failed to load data.");
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
                setError("Failed to initialize database.");
            }
        });
    }, [loadData]);

    const handleNewInvoiceDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setNewInvoiceDetails(prev => ({ ...prev, [name]: value }));
    };
    
    const handleCreateInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        const { invoiceNumber, customerName, invoiceDate, targetTotal } = newInvoiceDetails;
        const totalTTC = parseFloat(targetTotal); // User enters total with tax

        if (!invoiceNumber.trim() || !customerName.trim() || isNaN(totalTTC) || totalTTC <= 0) {
            setError(t('invoiceCreationError'));
            return;
        }
        if (inventory.length === 0) {
            setError(t('inventoryEmptyWarning'));
            return;
        }

        setIsCreating(true);
        setError(null);
        setSuccessMessage(null);

        try {
            // Filter inventory to only include items available on or before the invoice date.
            const historicallyAvailableItems = inventory.filter(item => item.purchaseDate <= invoiceDate);
            
            if (historicallyAvailableItems.length === 0) {
                throw new Error(t('noItemsForDateError'));
            }

            const targetSubtotal = totalTTC / 1.20; // Calculate target before tax
            const suggestedItems = selectInvoiceItemsForTotalLocally(targetSubtotal, historicallyAvailableItems);

            if (suggestedItems.length === 0) {
                throw new Error(t('generateByTotalError'));
            }

            const inventoryMap = new Map(inventory.map(item => [item.id, item]));
            const invoiceItems: InvoiceItem[] = [];

            for (const suggested of suggestedItems) {
                const inventoryItem = inventoryMap.get(suggested.id);
                if (inventoryItem && inventoryItem.quantity >= suggested.quantity) {
                    invoiceItems.push({
                        reference: inventoryItem.reference,
                        description: inventoryItem.name,
                        quantity: suggested.quantity,
                        unitPrice: inventoryItem.price,
                        total: suggested.quantity * inventoryItem.price
                    });
                } else {
                   throw new Error(`Suggested item ID ${suggested.id} not found or insufficient stock.`);
                }
            }

            const subTotalBeforeAdjustment = invoiceItems.reduce((sum, item) => sum + item.total, 0);
            const difference = targetSubtotal - subTotalBeforeAdjustment;

            // Adjust the price of one item to make the subtotal match the target exactly.
            if (difference !== 0 && invoiceItems.length > 0) {
                // Find the item with the highest total value to absorb the difference.
                const itemToAdjust = invoiceItems.reduce((prev, current) => (prev.total > current.total) ? prev : current);

                // Ensure the adjustment doesn't result in a negative total for the item.
                if (itemToAdjust.total + difference > 0) {
                    const newTotalForItem = itemToAdjust.total + difference;
                    const newUnitPrice = newTotalForItem / itemToAdjust.quantity;

                    // Update the item in the array with the adjusted values.
                    itemToAdjust.total = newTotalForItem;
                    itemToAdjust.unitPrice = newUnitPrice;
                } else {
                    console.warn("Could not adjust invoice total exactly without making an item's total negative.");
                }
            }
            
            const finalSubtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);

            const newInvoice: Omit<GeneratedInvoice, 'id'> = {
                invoiceNumber,
                customerName,
                invoiceDate,
                totalAmount: finalSubtotal, // This is the exact subtotal (HT)
                items: invoiceItems,
            };

            await createInvoiceAndUpdateStock(newInvoice);
            setSuccessMessage(t('invoiceGeneratedSuccess'));
            setNewInvoiceDetails(initialInvoiceDetails);
            setTimeout(() => setSuccessMessage(null), 4000);
            await loadData();

        } catch (err) {
            console.error("Failed to create invoice:", err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(errorMessage);
        } finally {
            setIsCreating(false);
        }
    };
    
    const filteredHistoryInvoices = useMemo(() => {
        if (!historySearchTerm) return invoices;
        const lowercasedTerm = historySearchTerm.toLowerCase();
        return invoices.filter(invoice =>
            invoice.customerName.toLowerCase().includes(lowercasedTerm) ||
            invoice.invoiceNumber.toLowerCase().includes(lowercasedTerm)
        );
    }, [invoices, historySearchTerm]);
    
    const handlePrint = useCallback(() => {
        const content = invoicePrintRef.current;
        if (content) {
            const printWindow = window.open('', '', 'height=800,width=800');
            printWindow?.document.write('<html><head><title>Print Invoice</title>');
            // Include Tailwind CSS for printing
            printWindow?.document.write('<script src="https://cdn.tailwindcss.com"></script>');
            printWindow?.document.write('<style>@media print { body { -webkit-print-color-adjust: exact; } }</style>');
            printWindow?.document.write('</head><body >');
            printWindow?.document.write(content.innerHTML);
            printWindow?.document.write('</body></html>');
            printWindow?.document.close();
            setTimeout(() => {
                printWindow?.print();
            }, 500); // Wait for styles to apply
        }
    }, []);

    const handleDeleteInvoice = async (id: number) => {
        if (window.confirm(t('confirmDeleteInvoiceAndRestock'))) {
            try {
                await deleteInvoiceAndRestock(id);
                await loadData();
            } catch (err) {
                console.error("Failed to delete invoice:", err);
                setError("Failed to delete invoice.");
            }
        }
    };
    
    const handleClearInvoices = async () => {
        if (window.confirm(t('confirmClearAllInvoices'))) {
            try {
                await clearAllInvoicesAndRestock();
                await loadData();
            } catch(err) {
                console.error("Failed to clear invoices:", err);
                setError("Failed to clear invoices.");
            }
        }
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">{t('createInvoiceTitle')}</h1>

            {/* Create Invoice Section */}
            <form onSubmit={handleCreateInvoice}>
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">{t('invoiceDetails')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <input name="invoiceNumber" value={newInvoiceDetails.invoiceNumber} onChange={handleNewInvoiceDetailsChange} placeholder={t('invoiceNumber') ?? "Invoice Number"} required className="p-2 border rounded-md" />
                        <input name="customerName" value={newInvoiceDetails.customerName} onChange={handleNewInvoiceDetailsChange} placeholder={t('clientName') ?? "Client Name"} required className="p-2 border rounded-md" />
                        <input name="invoiceDate" type="date" value={newInvoiceDetails.invoiceDate} onChange={handleNewInvoiceDetailsChange} required className="p-2 border rounded-md" />
                        <input name="targetTotal" type="number" step="0.01" value={newInvoiceDetails.targetTotal} onChange={handleNewInvoiceDetailsChange} placeholder={t('targetTotal') ?? "Target Total"} required className="p-2 border rounded-md" />
                    </div>
                </div>
                 <div className="mt-6 flex justify-end">
                    <button type="submit" disabled={isCreating || !dbInitialized} className="w-full sm:w-auto flex justify-center items-center px-6 py-2.5 text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-all shadow-md hover:shadow-lg">
                        {isCreating ? <Spinner /> : t('generateInvoiceButton')}
                    </button>
                </div>
                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                {successMessage && <p className="mt-4 text-sm text-green-600">{successMessage}</p>}
            </form>

            {/* Invoice History */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                <div className="p-4 flex flex-col sm:flex-row justify-between items-start border-b border-gray-200 bg-gray-50 gap-4">
                    <div><h2 className="text-xl font-semibold text-gray-700">{t('invoiceHistoryTitle')} ({invoices.length})</h2></div>
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                        <input type="text" placeholder={t('searchByClientOrInvoice') ?? 'Search...'} value={historySearchTerm} onChange={(e) => setHistorySearchTerm(e.target.value)} className="p-2 border border-gray-300 rounded-md shadow-sm w-full sm:w-64 bg-white text-gray-900"/>
                        <button onClick={handleClearInvoices} className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 disabled:opacity-50" disabled={!dbInitialized || invoices.length === 0}>{t('clearInvoicesButton')}</button>
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
                            {filteredHistoryInvoices.length > 0 ? filteredHistoryInvoices.map(invoice => (
                                <tr key={invoice.id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-800">{invoice.invoiceNumber}</td>
                                    <td className="px-6 py-4 font-bold text-gray-900">{invoice.customerName}</td>
                                    <td className="px-6 py-4">{invoice.invoiceDate}</td>
                                    <td className="px-6 py-4">{(invoice.totalAmount * 1.20).toFixed(2)} DH</td>
                                    <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                                        <button onClick={() => setSelectedInvoice(invoice)} className="text-gray-500 hover:text-indigo-600" title={t('view')}><ViewIcon /></button>
                                        <button onClick={() => { setSelectedInvoice(invoice); setTimeout(() => handlePrint(), 100); }} className="text-gray-500 hover:text-blue-600" title={t('print')}><PrintIcon/></button>
                                        <button onClick={() => handleDeleteInvoice(invoice.id)} className="text-gray-500 hover:text-red-600" title={t('delete')}><TrashIcon/></button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={5} className="text-center py-12 text-gray-500">
                                    <h3 className="text-lg font-medium">{historySearchTerm ? t('noInvoicesFound') : t('emptyInvoicesMessage')}</h3>
                                    {!historySearchTerm && <p className="text-sm">{t('createNewInvoice')}</p>}
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
                    <div className="bg-gray-100 rounded-lg shadow-xl w-full max-w-4xl my-8">
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