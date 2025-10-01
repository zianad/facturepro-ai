import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { GeneratedInvoice, InventoryItem, ExtractedInvoiceData, ProfileData, InvoiceItem } from '../types';
import { initDB, getAllInvoices, deleteInvoiceAndRestock, createInvoiceAndUpdateStock, getAllInventoryItems, getProfile } from '../db';
import { analyzeInvoiceImage, suggestInvoiceItemsForTotal } from '../services/geminiService';

// --- Icons ---
const Spinner = () => <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>;

const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
});

const InvoicePage: React.FC = () => {
    const { t } = useLanguage();
    const [invoices, setInvoices] = useState<GeneratedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dbInitialized, setDbInitialized] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // For AI Invoice Analysis
    const [analysisFile, setAnalysisFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<ExtractedInvoiceData | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    // For Generating Invoice by Total
    const [isGeneratingModalOpen, setGeneratingModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [targetTotal, setTargetTotal] = useState('');
    const [clientNameForGeneration, setClientNameForGeneration] = useState('');

    // For Viewing Invoice
    const [viewingInvoice, setViewingInvoice] = useState<GeneratedInvoice | null>(null);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAnalysisError(null);
        setAnalysisResult(null);
        setAnalysisFile(e.target.files?.[0] || null);
    };

    const handleAnalyze = async () => {
        if (!analysisFile) return;
        setIsAnalyzing(true);
        setAnalysisError(null);
        setAnalysisResult(null);

        try {
            const base64Image = await toBase64(analysisFile);
            const result = await analyzeInvoiceImage(base64Image, analysisFile.type);
            setAnalysisResult(result);
        } catch (err) {
            setAnalysisError(err instanceof Error ? err.message : String(t('analysisError')));
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleGenerateByTotal = async (e: React.FormEvent) => {
        e.preventDefault();
        const total = parseFloat(targetTotal);
        if (!clientNameForGeneration.trim() || isNaN(total) || total <= 0) {
            setGenerationError(t('invoiceCreationError'));
            return;
        }

        setIsGenerating(true);
        setGenerationError(null);
        
        try {
            const inventory = await getAllInventoryItems();
            const availableInventory = inventory.filter(i => i.quantity > 0 && new Date(i.purchaseDate) <= new Date());
            
            if (availableInventory.length === 0) {
                throw new Error(t('inventoryEmptyWarning'));
            }

            const suggested = await suggestInvoiceItemsForTotal(total * 1.2, availableInventory);
            
            if (suggested.length === 0) {
                throw new Error(t('generateByTotalError'));
            }
            
            const invoiceItems: InvoiceItem[] = suggested.map(sItem => {
                const inventoryItem = availableInventory.find(i => i.id === sItem.id);
                if (!inventoryItem) throw new Error("Suggested item not found in inventory.");
                return {
                    reference: inventoryItem.reference,
                    description: inventoryItem.name,
                    quantity: sItem.quantity,
                    unitPrice: inventoryItem.price,
                    total: sItem.quantity * inventoryItem.price
                };
            });

            const totalAmount = invoiceItems.reduce((sum, item) => sum + item.total, 0);

            const newInvoice: Omit<GeneratedInvoice, 'id'> = {
                invoiceNumber: `F-${Date.now()}`,
                customerName: clientNameForGeneration,
                invoiceDate: new Date().toISOString().split('T')[0],
                totalAmount: totalAmount * 1.2,
                items: invoiceItems
            };

            await createInvoiceAndUpdateStock(newInvoice);
            setGeneratingModalOpen(false);
            setTargetTotal('');
            setClientNameForGeneration('');
            await loadData();

        } catch (err) {
            setGenerationError(err instanceof Error ? err.message : String(t('generateByTotalError')));
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
            const newWindow = window.open('', '_blank');
            newWindow?.document.write('<html><head><title>Print Invoice</title>');
            // Basic styles for printing
            newWindow?.document.write('<style>body{font-family:sans-serif;}.invoice-box{max-width:800px;margin:auto;padding:30px;border:1px solid #eee;box-shadow:0 0 10px rgba(0,0,0,.15);font-size:16px;line-height:24px;color:#555;}.invoice-box table{width:100%;line-height:inherit;text-align:left;border-collapse:collapse;}.invoice-box table td{padding:5px;vertical-align:top;}.invoice-box table tr td:nth-child(2){text-align:right;}.invoice-box table tr.top table td{padding-bottom:20px;}.invoice-box table tr.heading td{background:#eee;border-bottom:1px solid #ddd;font-weight:bold;}.invoice-box table tr.item td{border-bottom:1px solid #eee;}.invoice-box table tr.total td:nth-child(2){border-top:2px solid #eee;font-weight:bold;} @media print { .no-print { display: none; } }</style>');
            newWindow?.document.write('</head><body>');
            newWindow?.document.write(printContent.innerHTML);
            newWindow?.document.write('</body></html>');
            newWindow?.document.close();
            newWindow?.focus();
            newWindow?.print();
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                 {/* AI Invoice Analysis Card */}
                <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                    <h2 className="text-