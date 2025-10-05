// FIX: Removed invalid text from the start of the file.
import * as React from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useLanguage } from '../context/LanguageContext';
import { GeneratedInvoice, InventoryItem, ProfileData, InvoiceItem } from '../types';
import { initDB, getAllInvoices, deleteInvoiceAndRestock, createInvoiceFromTotal, getProfile, getAvailableInventoryValue } from '../db';

// --- Icons ---
const Spinner = () => <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>;
const PrintIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v3a2 2 0 002 2h8a2 2 0 002-2v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg>;
const PdfIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm5 1a1 1 0 00-1 1v1a1 1 0 001 1h2a1 1 0 001-1V6a1 1 0 00-1-1H9z" clipRule="evenodd" /><path d="M15 12H5a1 1 0 000 2h10a1 1 0 000-2z" /></svg>;
const WordIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm4.293 4.293a1 1 0 011.414 0L12 10.586l2.293-2.293a1 1 0 111.414 1.414L13.414 12l2.293 2.293a1 1 0 01-1.414 1.414L12 13.414l-2.293 2.293a1 1 0 01-1.414-1.414L10.586 12 8.293 9.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;

const escapeHtml = (unsafe: string | null | undefined): string => {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

const formatCurrencyFr = (num: number): string => {
    return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, '\u00A0');
};

const numberToWordsFr = (num: number): string => {
    if (num === 0) return 'ZÉRO';

    const units = ['', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF'];
    const teens = ['DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE', 'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF'];
    const tens = ['', 'DIX', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE-DIX', 'QUATRE-VINGT', 'QUATRE-VINGT-DIX'];

    const convertChunk = (n: number): string => {
        if (n === 0) return '';
        let words = '';

        if (n >= 100) {
            const hundreds = Math.floor(n / 100);
            words += (hundreds > 1 ? units[hundreds] + ' ' : '') + 'CENT' + (n % 100 === 0 && hundreds > 1 ? 'S' : '');
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
                if (ten === 7 || ten === 9) { // 70s and 90s
                    words += tens[ten - 1] + '-' + teens[unit];
                } else {
                    words += tens[ten];
                    if (unit === 1 && ten < 8) { // 21, 31, ... 61
                        words += ' ET UN';
                    } else if (unit > 0) {
                        words += '-' + units[unit];
                    } else if (ten === 8 && unit === 0) { // 80
                        words += 'S';
                    }
                }
            }
        }
        return words;
    };

    const integerPart = Math.floor(num);
    
    if (integerPart === 0) return 'ZÉRO';

    let result = '';
    const billions = Math.floor(integerPart / 1000000000);
    const millions = Math.floor((integerPart % 1000000000) / 1000000);
    const thousands = Math.floor((integerPart % 1000000) / 1000);
    const remainder = integerPart % 1000;

    if (billions > 0) {
        result += convertChunk(billions) + ' MILLIARD' + (billions > 1 ? 'S' : '');
        if (integerPart % 1000000000 > 0) result += ' ';
    }
    if (millions > 0) {
        result += convertChunk(millions) + ' MILLION' + (millions > 1 ? 'S' : '');
        if (integerPart % 1000000 > 0) result += ' ';
    }
    if (thousands > 0) {
        if (thousands === 1) result += 'MILLE';
        else result += convertChunk(thousands) + ' MILLE';
        if (integerPart % 1000 > 0) result += ' ';
    }
    if (remainder > 0) {
        result += convertChunk(remainder);
    }
    
    return result.trim().replace(/\s-/g, '-');
};


const InvoicePage: React.FC = () => {
    const { t } = useLanguage();
    const [invoices, setInvoices] = React.useState<GeneratedInvoice[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [dbInitialized, setDbInitialized] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');
    
    // For Generating Invoice by Total
    const [isGeneratingModalOpen, setGeneratingModalOpen] = React.useState(false);
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [generationError, setGenerationError] = React.useState<string | null>(null);
    const [maxInvoiceValue, setMaxInvoiceValue] = React.useState<number | null>(null);
    const [isCheckingValue, setIsCheckingValue] = React.useState(false);
    
    const [generationForm, setGenerationForm] = React.useState({
      invoiceNumber: '',
      customerName: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      totalAmount: ''
    });

    // For Viewing Invoice
    const [viewingInvoice, setViewingInvoice] = React.useState<GeneratedInvoice | null>(null);
    const [profile, setProfile] = React.useState<ProfileData | null>(null);
    const printRef = React.useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = React.useState(false);
    
    const VAT_RATE = 0.20;

    const loadData = React.useCallback(async () => {
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
        if (isGeneratingModalOpen) {
            setIsCheckingValue(true);
            setGenerationError(null);
            getAvailableInventoryValue(generationForm.invoiceDate)
                .then(setMaxInvoiceValue)
                .catch(console.error)
                .finally(() => setIsCheckingValue(false));
        }
    }, [isGeneratingModalOpen, generationForm.invoiceDate]);
    
    const handleGenerateByTotal = async (e: React.FormEvent) => {
        e.preventDefault();
        const targetInvoiceTotalTTC = parseFloat(generationForm.totalAmount);
        if (!generationForm.customerName.trim() || isNaN(targetInvoiceTotalTTC) || targetInvoiceTotalTTC <= 0 || !generationForm.invoiceNumber.trim()) {
            setGenerationError(t('invoiceCreationError'));
            return;
        }

        if (maxInvoiceValue !== null && targetInvoiceTotalTTC > maxInvoiceValue) {
            setGenerationError(
                t('inventoryValueExceededError')
                    .replace('{requested}', targetInvoiceTotalTTC.toFixed(2))
                    .replace('{available}', maxInvoiceValue.toFixed(2))
            );
            return;
        }

        setIsGenerating(true);
        setGenerationError(null);
        
        try {
            await createInvoiceFromTotal({
              invoiceNumber: generationForm.invoiceNumber,
              customerName: generationForm.customerName,
              invoiceDate: generationForm.invoiceDate,
              totalAmount: targetInvoiceTotalTTC,
            });

            setGeneratingModalOpen(false);
            setGenerationForm({
              invoiceNumber: '', customerName: '', 
              invoiceDate: new Date().toISOString().split('T')[0], totalAmount: ''
            });
            await loadData();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(t('generateByTotalError'));
            setGenerationError(errorMessage);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm(t('confirmDeleteInvoiceAndRestock'))) {
            try {
                await deleteInvoiceAndRestock(id);
                await loadData();
            } catch (error) {
                console.error("Failed to delete invoice and restock:", error);
                alert(`Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
            }
        }
    };

    const handlePrint = () => {
        const printContent = printRef.current;
        if (printContent) {
            const newWindow = window.open('', '_blank', 'height=800,width=800');
            const styles = `
              <style>
                @import url('https://rsms.me/inter/inter.css');
                body { 
                    font-family: 'Inter', sans-serif; 
                    margin: 0; 
                    -webkit-print-color-adjust: exact; 
                    color-adjust: exact;
                }
                .invoice-container { width: 100%; max-width: 800px; margin: auto; padding: 20px; color: #000; }
                .no-print { display: none; }
                @media print {
                  .invoice-container { padding: 0; }
                }
                ${printRef.current?.querySelector('style')?.innerHTML ?? ''}
              </style>
            `;
            newWindow?.document.write(`<html><head><title>${t('invoice')}</title>${styles}</head><body>`);
            newWindow?.document.write('<div class="invoice-container">');
            // Remove the style block from the innerHTML before writing to avoid duplication
            const contentHtml = printContent.innerHTML.replace(/<style>[\s\S]*?<\/style>/, '');
            newWindow?.document.write(contentHtml);
            newWindow?.document.write('</div></body></html>');
            newWindow?.document.close();
            newWindow?.focus();
            setTimeout(() => newWindow?.print(), 500);
        }
    };
    
    const handleDownloadPdf = async () => {
      if (!viewingInvoice || !printRef.current) return;
      setIsExporting(true);

      try {
        const canvas = await html2canvas(printRef.current, {
            scale: 2, // Higher scale for better quality
            useCORS: true,
        });
        const imgData = canvas.toDataURL('image/png');
        
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / canvasHeight;

        const imgWidth = pdfWidth;
        const imgHeight = imgWidth / ratio;
        
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

        pdf.save(`${t('invoice')}-${viewingInvoice.invoiceNumber}.pdf`);
      } catch (error) {
        console.error("Failed to generate PDF document:", error);
        alert("Sorry, there was an error creating the PDF document.");
      } finally {
        setIsExporting(false);
      }
    };
    
    const loadScript = (src: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                return resolve();
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Script load error for ${src}`));
            document.head.appendChild(script);
        });
    };
    
    const handleDownloadWord = async () => {
        if (!viewingInvoice || !profile) return;
        setIsExporting(true);
        
        try {
            await loadScript('https://unpkg.com/html-to-docx@1.8.0/dist/html-to-docx.umd.js');

            const htmlToDocxFunc = (window as any).htmlToDocx;
            if (typeof htmlToDocxFunc !== 'function') {
                throw new Error("Word export library failed to load. Please try again.");
            }
            
            const totalHT = viewingInvoice.totalAmount / (1 + VAT_RATE);
            const totalTVA = viewingInvoice.totalAmount - totalHT;
            const totalInWords = numberToWordsFr(viewingInvoice.totalAmount);

            const mainContentHTML = `
                <div style="font-family: Arial, sans-serif; font-size: 10pt; color: #000;">
                    <header style="text-align: center; margin-bottom: 30px;">
                        <h1 style="font-size: 20pt; font-weight: bold; margin: 0;">${escapeHtml(profile.companyName)}</h1>
                    </header>
                    
                    <table style="width: 100%; margin-bottom: 20px;">
                        <tr>
                            <td style="width: 50%; vertical-align: top;">
                                <div style="border: 1px solid #000; padding: 10px;">
                                    <strong>${escapeHtml(t('factureDeVente'))}</strong> ${escapeHtml(viewingInvoice.invoiceNumber)}
                                </div>
                            </td>
                            <td style="width: 50%; vertical-align: top;">
                                <div style="border: 1px solid #000; padding: 10px; margin-left: 20px;">
                                    <p style="margin: 0 0 5px 0;"><strong>${escapeHtml(viewingInvoice.customerName)}</strong></p>
                                    <p style="margin: 0 0 5px 0;"><strong>ICE:</strong> ${escapeHtml(profile.companyICE)}</p>
                                    <p style="margin: 0;"><strong>RC:</strong> ${escapeHtml(profile.companyRC)}</p>
                                </div>
                                <p style="text-align: right; margin-top: 5px;">${escapeHtml(viewingInvoice.invoiceDate)}</p>
                            </td>
                        </tr>
                    </table>

                    <table style="width: 100%; border-collapse: collapse; font-size: 10pt; min-height: 300px;">
                        <thead style="background-color: #e0e0e0;">
                            <tr>
                                <th style="border: 1px solid #000; padding: 5px; text-align: left;">${escapeHtml(t('designation'))}</th>
                                <th style="border: 1px solid #000; padding: 5px; text-align: left;">${escapeHtml(t('puHT'))}</th>
                                <th style="border: 1px solid #000; padding: 5px; text-align: left;">${escapeHtml(t('quantity'))}</th>
                                <th style="border: 1px solid #000; padding: 5px; text-align: left;">${escapeHtml(t('montantHT'))}</th>
                                <th style="border: 1px solid #000; padding: 5px; text-align: left;">${escapeHtml(t('unite'))}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${viewingInvoice.items.map(item => `
                                <tr>
                                    <td style="border: 1px solid #000; padding: 5px;">${escapeHtml(item.description)}</td>
                                    <td style="border: 1px solid #000; padding: 5px;">${formatCurrencyFr(item.unitPrice)} DH</td>
                                    <td style="border: 1px solid #000; padding: 5px;">${item.quantity}</td>
                                    <td style="border: 1px solid #000; padding: 5px;">${formatCurrencyFr(item.total)} DH</td>
                                    <td style="border: 1px solid #000; padding: 5px;">kg</td>
                                </tr>
                            `).join('')}
                            <!-- Empty rows to fill space -->
                            ${Array.from({ length: Math.max(0, 15 - viewingInvoice.items.length) }).map(() => `
                                <tr>
                                    <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
                                    <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
                                    <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
                                    <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
                                    <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <table style="width: 100%; margin-top: 10px;">
                        <tr>
                            <td style="width: 55%; vertical-align: bottom;">
                                <div style="margin-bottom: 10px;">${escapeHtml(t('espece'))}</div>
                                <div style="margin-bottom: 10px;">
                                    <strong>${escapeHtml(t('avance'))}</strong> ${formatCurrencyFr(viewingInvoice.totalAmount)} DH<br/>
                                    <strong>${escapeHtml(t('rest'))}</strong> 0,00 DH<br/>
                                    <strong>${escapeHtml(t('creditClient'))}</strong> 0,00 DH
                                </div>
                                <div>
                                    <p style="font-size: 9pt; margin: 0;"><strong>${escapeHtml(t('invoiceSumInWordsPrefix'))}</strong></p>
                                    <p style="font-size: 9pt; margin: 0;">${escapeHtml(totalInWords)}</p>
                                </div>
                            </td>
                            <td style="width: 45%; vertical-align: top;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr><td style="padding: 5px; border: 1px solid #000; border-radius: 5px;">${escapeHtml(t('totalHTBox'))}</td><td style="padding: 5px; text-align: right; border: 1px solid #000; border-radius: 5px;">${formatCurrencyFr(totalHT)} DH</td></tr>
                                    <tr><td style="padding: 5px; border: 1px solid #000; border-radius: 5px;">${escapeHtml(t('remise'))}</td><td style="padding: 5px; text-align: right; border: 1px solid #000; border-radius: 5px;">${formatCurrencyFr(0)} DH</td></tr>
                                    <tr><td style="padding: 5px; border: 1px solid #000; border-radius: 5px;">${escapeHtml(t('mtva'))}</td><td style="padding: 5px; text-align: right; border: 1px solid #000; border-radius: 5px;">${formatCurrencyFr(totalTVA)} DH</td></tr>
                                    <tr><td style="padding: 5px; border: 1px solid #000; border-radius: 5px;"><strong>${escapeHtml(t('totalTTCBox'))}</strong></td><td style="padding: 5px; text-align: right; border: 1px solid #000; border-radius: 5px;"><strong>${formatCurrencyFr(viewingInvoice.totalAmount)} DH</strong></td></tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                     <div style="margin-top: 30px;">
                        <strong>Adresse:</strong> ${escapeHtml(profile.companyAddress)}
                    </div>
                </div>
            `;
            const blobResult = await htmlToDocxFunc(mainContentHTML);
            const docxBlob = blobResult instanceof Blob ? blobResult : new Blob([blobResult as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(docxBlob);
            link.download = `${t('invoice')}-${viewingInvoice.invoiceNumber}.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Sorry, there was an error creating the Word document.";
            console.error("Failed to generate Word document:", error);
            alert(message);
        } finally {
            setIsExporting(false);
        }
    };

    const filteredInvoices = React.useMemo(() => {
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
                                <div className="sm:col-span-2">
                                    {isCheckingValue ? (
                                        <p className="text-sm text-gray-500">{t('loading')}...</p>
                                    ) : maxInvoiceValue !== null ? (
                                        <div className="text-sm text-gray-600 bg-gray-100 p-2 rounded-md">
                                            <span className="font-semibold">{t('maxAvailableValue')}</span> {formatCurrencyFr(maxInvoiceValue)} DH
                                        </div>
                                    ) : null}
                                </div>
                                {generationError && <p className="sm:col-span-2 text-sm text-red-600 p-2 bg-red-50 rounded-md">{generationError}</p>}
                            </fieldset>
                            <div className="p-4 flex justify-end space-x-3 bg-gray-50">
                                <button type="button" onClick={() => setGeneratingModalOpen(false)} className="px-4 py-2 text-sm bg-white border rounded-md">{t('cancel')}</button>
                                <button type="submit" disabled={isGenerating || isCheckingValue} className="px-4 py-2 w-28 flex justify-center text-sm text-white bg-indigo-600 rounded-md disabled:bg-indigo-400">{isGenerating ? <Spinner /> : t('generate')}</button>
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
                            <div className="flex items-center gap-2">
                                <button onClick={handleDownloadWord} disabled={isExporting} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md inline-flex items-center hover:bg-blue-700 transition-colors disabled:bg-blue-400">
                                    {isExporting ? <Spinner /> : <><WordIcon /> {t('downloadWord')}</>}
                                </button>
                                <button onClick={handleDownloadPdf} disabled={isExporting} className="px-4 py-2 text-sm text-white bg-red-600 rounded-md inline-flex items-center hover:bg-red-700 transition-colors disabled:bg-red-400">
                                    {isExporting ? <Spinner /> : <><PdfIcon /> {t('downloadPdf')}</>}
                                </button>
                                <button onClick={handlePrint} disabled={isExporting} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md inline-flex items-center hover:bg-indigo-700 transition-colors">
                                    <PrintIcon />
                                    {t('print')}
                                </button>
                                <button onClick={() => setViewingInvoice(null)} className="px-4 py-2 text-sm bg-gray-200 rounded-md hover:bg-gray-300 transition-colors">
                                    {t('close')}
                                </button>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto" ref={printRef}>
                            <style>{`
                                .invoice-box { font-family: Arial, sans-serif; font-size: 10pt; color: #000; }
                                .invoice-box table { width: 100%; border-collapse: collapse; }
                                .invoice-box th, .invoice-box td { border: 1px solid #000; padding: 4px; }
                                .invoice-box .header-table td { border: none; }
                                .invoice-box .items-table { min-height: 400px; }
                                .invoice-box .items-table th { background-color: #e0e0e0; font-weight: bold; }
                                .invoice-box .totals-box { border-radius: 5px; }
                                .invoice-box .totals-box td { border: 1px solid #000; padding: 5px; }
                                .invoice-box .no-border { border: none; }
                                .invoice-box .text-right { text-align: right; }
                                .invoice-box .font-bold { font-weight: bold; }
                            `}</style>
                            <div className="invoice-box">
                                <header className="text-center mb-8">
                                    <h1 className="text-2xl font-bold uppercase">{profile?.companyName}</h1>
                                </header>

                                <table className="header-table mb-5">
                                    <tbody>
                                    <tr>
                                        <td className="w-1/2 align-top">
                                            <div className="border border-black p-2">
                                                <strong>{t('factureDeVente')}</strong> {viewingInvoice.invoiceNumber}
                                            </div>
                                        </td>
                                        <td className="w-1/2 align-top pl-5">
                                            <div className="border border-black p-2">
                                                <p className="font-bold m-0 mb-1">{viewingInvoice.customerName}</p>
                                                <p className="m-0 mb-1"><strong>ICE:</strong> {profile?.companyICE}</p>
                                                <p className="m-0"><strong>RC:</strong> {profile?.companyRC}</p>
                                            </div>
                                            <p className="text-right mt-1">{viewingInvoice.invoiceDate}</p>
                                        </td>
                                    </tr>
                                    </tbody>
                                </table>

                                <table className="items-table">
                                    <thead>
                                        <tr>
                                            <th>{t('designation')}</th>
                                            <th>{t('puHT')}</th>
                                            <th>{t('quantity')}</th>
                                            <th>{t('montantHT')}</th>
                                            <th>{t('unite')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewingInvoice.items.map((item, i) => (
                                            <tr key={i}>
                                                <td>{item.description}</td>
                                                <td>{formatCurrencyFr(item.unitPrice)} DH</td>
                                                <td>{item.quantity}</td>
                                                <td>{formatCurrencyFr(item.total)} DH</td>
                                                <td>kg</td>
                                            </tr>
                                        ))}
                                        {/* Fill empty rows to ensure consistent table height */}
                                        {Array.from({ length: Math.max(0, 15 - viewingInvoice.items.length) }).map((_, i) => (
                                            <tr key={`empty-${i}`}>
                                                <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <table className="mt-4">
                                  <tbody>
                                    <tr>
                                        <td className="w-3/5 align-bottom no-border">
                                            <div className="mb-3">{t('espece')}</div>
                                            <div className="mb-4">
                                                <span><strong>{t('avance')}</strong> {formatCurrencyFr(viewingInvoice.totalAmount)} DH</span><br/>
                                                <span><strong>{t('rest')}</strong> 0,00 DH</span><br/>
                                                <span><strong>{t('creditClient')}</strong> 0,00 DH</span>
                                            </div>
                                            <div className="text-xs">
                                                <p className="font-bold m-0">{t('invoiceSumInWordsPrefix')}</p>
                                                <p className="m-0">{numberToWordsFr(viewingInvoice.totalAmount)}</p>
                                            </div>
                                        </td>
                                        <td className="w-2/5 align-top no-border">
                                            <table className="totals-box">
                                                <tbody>
                                                <tr><td>{t('totalHTBox')}</td><td className="text-right">{formatCurrencyFr(viewingInvoice.totalAmount / (1 + VAT_RATE))} DH</td></tr>
                                                <tr><td>{t('remise')}</td><td className="text-right">{formatCurrencyFr(0)} DH</td></tr>
                                                <tr><td>{t('mtva')}</td><td className="text-right">{formatCurrencyFr(viewingInvoice.totalAmount - (viewingInvoice.totalAmount / (1 + VAT_RATE)))} DH</td></tr>
                                                <tr><td className="font-bold">{t('totalTTCBox')}</td><td className="text-right font-bold">{formatCurrencyFr(viewingInvoice.totalAmount)} DH</td></tr>
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                  </tbody>
                                </table>
                                <footer className="mt-5">
                                    <strong>Adresse:</strong> {profile?.companyAddress}
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