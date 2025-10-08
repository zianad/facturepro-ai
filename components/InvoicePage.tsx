// FINAL, DEFINITIVE FIX: This version definitively removes all traces of 'Unité', 'ICE', and 'RC' from the invoice template and creation logic.
import * as React from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useLanguage } from '../context/LanguageContext';
import { GeneratedInvoice, ProfileData, InvoiceItem } from '../types';
import { initDB, getAllInvoices, deleteInvoiceAndRestock, createInvoiceFromTotal, getProfile, getAvailableInventoryValue, clearAllInvoicesAndRestock } from '../db';

// --- Icons ---
const Spinner = () => <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>;
const PrintIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v3a2 2 0 002 2h8a2 2 0 002-2v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg>;
const PdfIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm5 1a1 1 0 00-1 1v1a1 1 0 001 1h2a1 1 0 001-1V6a1 1 0 00-1-1H9z" clipRule="evenodd" /><path d="M15 12H5a1 1 0 000 2h10a1 1 0 000-2z" /></svg>;
const WordIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm4.293 4.293a1 1 0 011.414 0L12 10.586l2.293-2.293a1 1 0 111.414 1.414L13.414 12l2.293 2.293a1 1 0 01-1.414 1.414L12 13.414l-2.293 2.293a1 1 0 01-1.414-1.414L10.586 12 8.293 9.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;

const formatCurrencyFr = (num: number): string => {
    return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, '\u00A0');
};

const numberToWordsFr = (num: number): string => {
    if (num === 0) return 'ZÉRO DIRHAMS';

    const units = ['', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF'];
    const teens = ['DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE', 'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF'];
    const tens = ['', 'DIX', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE-DIX', 'QUATRE-VINGT', 'QUATRE-VINGT-DIX'];

    const convertChunk = (n: number): string => {
        if (n === 0) return '';
        let words = '';

        if (n >= 100) {
            const hundreds = Math.floor(n / 100);
            words += (hundreds > 1 ? units[hundreds] + ' ' : '') + 'CENT';
            if (hundreds > 1 && n % 100 === 0) {
                words += 'S';
            }
            n %= 100;
            if (n > 0) words += ' ';
        }

        if (n > 0) {
            if (n < 10) {
                words += units[n];
            } else if (n < 20) {
                words += teens[n - 10];
            } else {
                const ten = Math.floor(n / 10);
                const unit = n % 10;
                
                if (ten === 8) { // quatre-vingt(s)
                    words += tens[ten] + (unit === 0 ? 'S' : '-' + units[unit]);
                } else if (ten === 7 || ten === 9) { // soixante-dix, quatre-vingt-dix
                    words += tens[ten - 1] + ((ten === 7 && unit === 1) ? ' ET ' : '-') + teens[unit];
                } else { // 20-69
                    words += tens[ten] + (unit > 0 ? ((unit === 1) ? ' ET ' : '-') + units[unit] : '');
                }
            }
        }
        return words;
    };

    const integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100);

    let words = '';
    if (integerPart === 0) {
        words = "ZÉRO";
    } else {
        let tempNum = integerPart;
        const scales = ['', 'MILLE', 'MILLION', 'MILLIARD'];
        let parts: string[] = [];
        let scaleIndex = 0;

        while (tempNum > 0) {
            const chunk = tempNum % 1000;
            if (chunk > 0) {
                let chunkWords = convertChunk(chunk).trim();
                const scale = scales[scaleIndex];

                if (scale === 'MILLE' && chunk === 1) {
                    chunkWords = scale;
                } else if (scale) {
                     chunkWords += ' ' + scale + (chunk > 1 && (scale === 'MILLION' || scale === 'MILLIARD') ? 'S' : '');
                }
                parts.unshift(chunkWords);
            }
            tempNum = Math.floor(tempNum / 1000);
            scaleIndex++;
        }
        words = parts.join(' ').replace('UN MILLE', 'MILLE').trim();
    }

    words += ' DIRHAMS';

    if (decimalPart > 0) {
        words += ' ET ' + convertChunk(decimalPart) + ' CENTIMES';
    }

    return words.replace(/\s+/g, ' ').toUpperCase().trim();
};


const InvoicePage: React.FC = () => {
    const { t } = useLanguage();
    const [invoices, setInvoices] = React.useState<GeneratedInvoice[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [dbInitialized, setDbInitialized] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');

    const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = React.useState(false);
    const [selectedInvoice, setSelectedInvoice] = React.useState<GeneratedInvoice | null>(null);

    const [createFormData, setCreateFormData] = React.useState({ customerName: '', invoiceNumber: '', totalAmount: '', invoiceDate: new Date().toISOString().split('T')[0] });
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [profile, setProfile] = React.useState<ProfileData | null>(null);
    const [maxAvailableValue, setMaxAvailableValue] = React.useState<number | null>(null);


    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const [invoiceList, profileData] = await Promise.all([getAllInvoices(), getProfile()]);
            setInvoices(invoiceList.sort((a, b) => b.id - a.id));
            setProfile(profileData);
        } catch (err) {
            console.error("Failed to load data from DB:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        initDB().then(success => {
            if (success) {
                setDbInitialized(true);
                loadData();
            } else {
                setIsLoading(false);
            }
        });
    }, [loadData]);
    
    React.useEffect(() => {
        const fetchMaxValue = async () => {
            if (dbInitialized && createFormData.invoiceDate) {
                try {
                    const value = await getAvailableInventoryValue(createFormData.invoiceDate);
                    setMaxAvailableValue(value);
                } catch (err) {
                    console.error("Failed to get max available value:", err);
                    setMaxAvailableValue(null);
                }
            }
        };
        fetchMaxValue();
    }, [dbInitialized, createFormData.invoiceDate]);

    const filteredInvoices = React.useMemo(() => {
        if (!searchTerm) return invoices;
        const lowercasedTerm = searchTerm.toLowerCase();
        return invoices.filter(inv =>
            inv.customerName.toLowerCase().includes(lowercasedTerm) ||
            inv.invoiceNumber.toLowerCase().includes(lowercasedTerm)
        );
    }, [invoices, searchTerm]);
    
    const handleCreateFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCreateFormData(prev => ({ ...prev, [name]: value }));
        setError(null);
    };

    const handleGenerateByTotal = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!createFormData.customerName || !createFormData.totalAmount || !createFormData.invoiceDate || !createFormData.invoiceNumber) {
            setError(t('invoiceCreationError'));
            return;
        }
        
        const totalAmount = parseFloat(createFormData.totalAmount.replace(',', '.'));
        if (isNaN(totalAmount) || totalAmount <= 0) {
            setError(t('invoiceCreationError'));
            return;
        }

        if (maxAvailableValue !== null && totalAmount > maxAvailableValue) {
             setError(t('inventoryValueExceededError').replace('{requested}', totalAmount.toFixed(2)).replace('{available}', maxAvailableValue.toFixed(2)));
             return;
        }

        setIsGenerating(true);
        try {
            await createInvoiceFromTotal({
                customerName: createFormData.customerName,
                invoiceDate: createFormData.invoiceDate,
                invoiceNumber: createFormData.invoiceNumber,
                totalAmount
            });
            await loadData();
            setIsCreateModalOpen(false);
            setCreateFormData({ customerName: '', invoiceNumber: '', totalAmount: '', invoiceDate: new Date().toISOString().split('T')[0] });
        } catch (err) {
            console.error("Invoice generation error:", err);
            setError(err instanceof Error ? err.message : String(t('generateByTotalError')));
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleDeleteInvoice = async (id: number) => {
        if (window.confirm(t('confirmDeleteInvoiceAndRestock'))) {
            if (!dbInitialized) return;
            try {
                await deleteInvoiceAndRestock(id);
                await loadData();
            } catch (err) {
                console.error("Failed to delete invoice:", err);
                alert("Error: " + (err as Error).message);
            }
        }
    };
    
    const handleClearInvoices = async () => {
        if (window.confirm(t('confirmClearInvoices'))) {
            if (!dbInitialized) return;
             try {
                await clearAllInvoicesAndRestock();
                await loadData();
            } catch (err) {
                console.error("Failed to clear invoices:", err);
                alert("Error: " + (err as Error).message);
            }
        }
    };

    const handlePrint = () => {
        const originalTitle = document.title;
        document.title = '';

        const handleAfterPrint = () => {
            document.title = originalTitle;
            window.removeEventListener('afterprint', handleAfterPrint);
        };
        window.addEventListener('afterprint', handleAfterPrint);

        window.print();
    };

    const handleDownloadPdf = () => {
        const input = document.getElementById('printable-invoice');
        if (input) {
            html2canvas(input, { scale: 2 }).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const ratio = canvasWidth / canvasHeight;
                const height = pdfWidth / ratio;
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, height);
                pdf.save(`facture-${selectedInvoice?.invoiceNumber}.pdf`);
            });
        }
    };

    const handleDownloadWord = async () => {
        const invoiceHtml = document.getElementById('printable-invoice')?.innerHTML;
        if (!invoiceHtml || !selectedInvoice) return;

        try {
            // @ts-ignore
            const { default: htmlToDocx } = await import('https://cdn.jsdelivr.net/npm/html-to-docx@1.8.0/+esm');

            const fullHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Facture</title>
                </head>
                <body>
                    ${invoiceHtml}
                </body>
                </html>
            `;
            
            const fileBuffer = await htmlToDocx(fullHtml, undefined, {
                orientation: 'portrait',
                margins: { top: 720, right: 720, bottom: 720, left: 720 }
            });

            const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `facture-${selectedInvoice.invoiceNumber}.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Failed to download Word document:', error);
            alert('Could not download Word document.');
        }
    };


    const openViewModal = (invoice: GeneratedInvoice) => {
        setSelectedInvoice(invoice);
        setIsViewModalOpen(true);
    };

    return (
        <div className="container mx-auto p-4 sm:p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">{t('invoices')}</h1>

            <div className="bg-white p-6 rounded-lg shadow-md mb-6 border border-gray-200">
                <h2 className="text-xl font-semibold mb-2 text-gray-700">{t('createInvoiceTitle')}</h2>
                <p className="text-gray-500 mb-4">{t('generateInvoiceByTotal')}</p>
                <button onClick={() => { setIsCreateModalOpen(true); setError(null); }} className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md disabled:bg-indigo-400" disabled={!dbInitialized}>
                    {t('createNewInvoice')}
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 mb-6">
                <div className="p-4 flex flex-col sm:flex-row justify-between items-center border-b border-gray-200 bg-gray-50">
                    <h2 className="text-xl font-semibold text-gray-700 mb-2 sm:mb-0">{t('invoiceHistoryTitle')} ({invoices.length})</h2>
                    <input type="text" placeholder={t('searchByClientOrInvoice') ?? 'Search...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-2 border border-gray-300 rounded-md shadow-sm w-full sm:w-64"/>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                                <th scope="col" className="px-6 py-3">{t('invoiceNumber')}</th>
                                <th scope="col" className="px-6 py-3">{t('clientName')}</th>
                                <th scope="col" className="px-6 py-3">{t('invoiceDate')}</th>
                                <th scope="col" className="px-6 py-3">{t('totalAmountTTC')}</th>
                                <th scope="col" className="px-6 py-3 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        {isLoading ? (
                            <tbody><tr><td colSpan={5} className="text-center py-12">{t('loading')}...</td></tr></tbody>
                        ) : (
                        <tbody>
                            {filteredInvoices.length > 0 ? filteredInvoices.map(inv => (
                                <tr key={inv.id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-800">{inv.invoiceNumber}</td>
                                    <td className="px-6 py-4 font-bold text-gray-900">{inv.customerName}</td>
                                    <td className="px-6 py-4">{inv.invoiceDate}</td>
                                    <td className="px-6 py-4">{formatCurrencyFr(inv.totalAmount)} DH</td>
                                    <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                                        <button onClick={() => openViewModal(inv)} className="text-gray-500 hover:text-indigo-600 transition-colors" title={t('edit')}><EyeIcon /></button>
                                        <button onClick={() => handleDeleteInvoice(inv.id)} className="text-red-600 hover:text-red-800 transition-colors" title={t('delete')}><TrashIcon /></button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={5} className="text-center py-12 text-gray-500">
                                    <h3 className="text-lg font-medium">{t('emptyInvoicesMessage')}</h3>
                                    <button onClick={() => setIsCreateModalOpen(true)} className="mt-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">{t('createNewInvoice')}</button>
                                </td></tr>
                            )}
                        </tbody>
                        )}
                    </table>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50 p-4 rounded-lg shadow-md mb-6 border border-red-300">
                <h2 className="text-xl font-semibold mb-4 text-red-800">{t('dangerZone')}</h2>
                <div>
                    <p className="text-md font-semibold text-gray-700 mb-2">{t('clearInvoicesTitle')}</p>
                    <p className="text-xs text-red-700 mb-3">{t('clearInvoicesDescription')}</p>
                    <button 
                        onClick={handleClearInvoices}
                        className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-all shadow-sm hover:shadow-md disabled:bg-red-400 disabled:cursor-not-allowed" 
                        disabled={!dbInitialized || invoices.length === 0}
                    >
                        {t('clearInvoicesButton')}
                    </button>
                </div>
            </div>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-fade-in-up">
                        <form onSubmit={handleGenerateByTotal}>
                            <div className="p-5 border-b"><h2 className="text-xl font-bold text-gray-900">{t('createInvoiceTitle')}</h2></div>
                            <fieldset disabled={isGenerating}>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">{t('clientName')}</label>
                                        <input type="text" name="customerName" id="customerName" value={createFormData.customerName} onChange={handleCreateFormChange} className="w-full p-2 border border-gray-300 rounded-md" required />
                                    </div>
                                     <div>
                                        <label htmlFor="invoiceNumber" className="block text-sm font-medium text-gray-700 mb-1">{t('invoiceNumber')}</label>
                                        <input type="text" name="invoiceNumber" id="invoiceNumber" value={createFormData.invoiceNumber} onChange={handleCreateFormChange} className="w-full p-2 border border-gray-300 rounded-md" required />
                                    </div>
                                    <div>
                                        <label htmlFor="invoiceDate" className="block text-sm font-medium text-gray-700 mb-1">{t('invoiceDate')}</label>
                                        <input type="date" name="invoiceDate" id="invoiceDate" value={createFormData.invoiceDate} onChange={handleCreateFormChange} className="w-full p-2 border border-gray-300 rounded-md" required />
                                    </div>
                                    <div>
                                        <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700 mb-1">{t('targetTotal')}</label>
                                        <input type="text" name="totalAmount" id="totalAmount" value={createFormData.totalAmount} onChange={handleCreateFormChange} className="w-full p-2 border border-gray-300 rounded-md" required />
                                        {maxAvailableValue !== null && (
                                            <p className="text-xs text-gray-500 mt-1">{t('maxAvailableValue')} {formatCurrencyFr(maxAvailableValue)} DH</p>
                                        )}
                                    </div>
                                    {error && <p className="text-red-600 text-sm">{error}</p>}
                                </div>
                            </fieldset>
                            <div className="p-4 flex justify-end space-x-3 bg-gray-50 rounded-b-lg">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} disabled={isGenerating} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-200">{t('cancel')}</button>
                                <button type="submit" disabled={isGenerating} className="px-4 py-2 w-24 flex justify-center items-center text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400">
                                    {isGenerating ? <Spinner /> : t('generate')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* View Modal */}
            {isViewModalOpen && selectedInvoice && (
                <div className="fixed inset-0 bg-black bg-opacity-75 z-40 flex justify-center items-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in-up print-modal-container">
                        <div className="p-4 border-b flex justify-between items-center no-print">
                            <h2 className="text-xl font-bold text-gray-900">{t('invoice')} N° {selectedInvoice.invoiceNumber}</h2>
                             <div className="flex items-center space-x-2">
                                <button onClick={handlePrint} className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"><PrintIcon /> {t('print')}</button>
                                <button onClick={handleDownloadPdf} className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"><PdfIcon /> {t('downloadPdf')}</button>
                                <button onClick={handleDownloadWord} className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"><WordIcon /> {t('downloadWord')}</button>
                                <button onClick={() => setIsViewModalOpen(false)} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 ml-4">{t('close')}</button>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto print-modal-content">
                           <div id="printable-invoice" className="p-8 bg-white text-black text-sm font-serif">
                               <header className="flex justify-between items-start mb-10">
                                   <div>
                                       <h1 className="font-bold text-3xl mb-2 text-gray-800">{profile?.companyName.toUpperCase()}</h1>
                                   </div>
                                   <div className="text-right">
                                       <h2 className="text-2xl font-bold uppercase text-gray-700">{t('invoice')}</h2>
                                       <p className="mt-1"><span className="font-bold text-gray-600">N°:</span> {selectedInvoice.invoiceNumber}</p>
                                       <p><span className="font-bold text-gray-600">{t('invoiceDate')}:</span> {selectedInvoice.invoiceDate}</p>
                                   </div>
                               </header>

                               <section className="mb-10">
                                   <div className="border border-gray-300 p-4 rounded-md bg-gray-50 w-full sm:w-1/2">
                                       <h3 className="font-semibold text-gray-800 mb-2">{t('billTo')}:</h3>
                                       <p className="font-bold text-lg text-gray-900">{selectedInvoice.customerName}</p>
                                   </div>
                               </section>

                               <section>
                                   <table className="w-full mb-8 border-collapse">
                                       <thead>
                                           <tr className="bg-gray-800 text-white">
                                               <th className="p-3 text-left font-bold w-1/2">{t('designation')}</th>
                                               <th className="p-3 text-right font-bold">{t('puHT')}</th>
                                               <th className="p-3 text-center font-bold">{t('quantityLabel')}</th>
                                               <th className="p-3 text-right font-bold">{t('montantHT')}</th>
                                           </tr>
                                       </thead>
                                       <tbody>
                                          {selectedInvoice.items.map((item, index) => (
                                              <tr key={index} className="border-b border-gray-200">
                                                   <td className="p-3 align-top">{item.description}</td>
                                                   <td className="p-3 text-right align-top">{formatCurrencyFr(item.unitPrice)} DH</td>
                                                   <td className="p-3 text-center align-top">{item.quantity}</td>
                                                   <td className="p-3 text-right align-top">{formatCurrencyFr(item.total)} DH</td>
                                              </tr>
                                          ))}
                                       </tbody>
                                   </table>
                               </section>
                               
                               <section className="flex justify-end mb-8">
                                    <div className="w-full max-w-sm text-gray-700">
                                        <div className="flex justify-between border-b border-gray-300 py-2">
                                            <span className="font-semibold">{t('totalHTBox')}</span>
                                            <span>{formatCurrencyFr(selectedInvoice.totalAmount / 1.2)} DH</span>
                                        </div>
                                         <div className="flex justify-between border-b border-gray-300 py-2">
                                            <span className="font-semibold">{t('mtva')}</span>
                                            <span>{formatCurrencyFr(selectedInvoice.totalAmount - (selectedInvoice.totalAmount / 1.2))} DH</span>
                                        </div>
                                         <div className="flex justify-between font-bold text-lg bg-gray-100 p-3 mt-2 rounded-md">
                                            <span>{t('totalTTCBox')}</span>
                                            <span>{formatCurrencyFr(selectedInvoice.totalAmount)} DH</span>
                                        </div>
                                    </div>
                               </section>

                               <section className="mb-8 p-4 bg-gray-50 rounded-md">
                                  <p className="font-semibold"><span className="font-bold">{t('invoiceSumInWordsPrefix')}</span> {numberToWordsFr(selectedInvoice.totalAmount)}</p>
                               </section>
                               
                               <footer className="mt-12 text-center text-xs text-gray-500 border-t pt-4">
                                  <p><span className="font-bold">{t('companyName')}:</span> {profile?.companyName}</p>
                                  <p><span className="font-bold">{t('companyAddressTitle')}:</span> {profile?.companyAddress}</p>
                               </footer>
                           </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoicePage;