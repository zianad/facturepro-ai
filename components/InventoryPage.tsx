import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useLanguage } from '../context/LanguageContext';
import { InventoryItem } from '../types';
import { parseInventoryFile } from '../services/geminiService';
import { initDB, getAllInventoryItems, addInventoryItem, updateInventoryItem, deleteInventoryItem, addMultipleInventoryItems, clearInventory } from '../db';

// --- Icons ---
const BoxIcon = () => <svg xmlns="http://www.w.org/2000/svg" className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7v10l8 4m0-14L4 7" /></svg>;
const CollectionIcon = () => <svg xmlns="http://www.w.org/2000/svg" className="h-6 w-6 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v2m14 0H5" /></svg>;
const CashIcon = () => <svg xmlns="http://www.w.org/2000/svg" className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const EditIcon = () => <svg xmlns="http://www.w.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const Spinner = () => <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;

// --- Modal Form Icons ---
const ReferenceIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5a2 2 0 012 2v5a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zm0 14h.01M7 17h5a2 2 0 012 2v5a2 2 0 01-2 2H7a2 2 0 01-2-2v-5a2 2 0 012-2z" /></svg>;
const ItemNameIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7v10l8 4m0-14L4 7" /></svg>;
const DateIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const PriceIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2m0-4H9m6 0h-3" /></svg>;
const QuantityIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l3-3m0 0l3 3m-3-3v8m0-13H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H9z" /></svg>;


// --- Components ---
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center space-x-4">
    <div className="bg-gray-100 p-3 rounded-full">{icon}</div>
    <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

const SkeletonLoader = () => (
    <tbody>
        {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="bg-white border-b animate-pulse">
                <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded"></div></td>
                <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded"></div></td>
                <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded"></div></td>
                <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded"></div></td>
                <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded"></div></td>
                <td className="px-6 py-4 text-right space-x-2"><div className="h-4 w-16 bg-gray-200 rounded inline-block"></div></td>
            </tr>
        ))}
    </tbody>
);

const InventoryPage: React.FC = () => {
  const { t } = useLanguage();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbInitialized, setDbInitialized] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<InventoryItem | null>(null);
  
  const defaultFormData = {
    reference: '', name: '', price: '', quantity: '1',
    purchaseDate: new Date().toISOString().split('T')[0],
  };
  const [formData, setFormData] = useState(defaultFormData);
  const [formErrors, setFormErrors] = useState<{ price?: string; quantity?: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  
  const [inventoryFile, setInventoryFile] = useState<File | null>(null);
  const [isFileProcessing, setIsFileProcessing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileSuccess, setFileSuccess] = useState<string | null>(null);

  // --- Autocomplete state ---
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestionField, setActiveSuggestionField] = useState<'name' | null>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const uniqueItemNames = useMemo(() => [...new Set(items.map(item => item.name))], [items]);
  
  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    try {
        const inventoryItems = await getAllInventoryItems();
        setItems(inventoryItems.sort((a, b) => b.id - a.id));
    } catch (error) {
        console.error("Failed to load inventory from DB:", error);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initDB().then(success => {
        if (success) {
            setDbInitialized(true);
            loadInventory();
        } else {
            setIsLoading(false);
        }
    });
  }, [loadInventory]);

  // Effect to handle clicks outside the suggestion box
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
            setActiveSuggestionField(null);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const lowercasedTerm = searchTerm.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(lowercasedTerm) ||
      item.reference.toLowerCase().includes(lowercasedTerm)
    );
  }, [items, searchTerm]);

  const summaryData = useMemo(() => {
    let totalQuantity = 0;
    let totalValue = 0;

    for (const item of items) {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      totalQuantity += quantity;
      totalValue += quantity * price;
    }
    
    return {
      uniqueCount: items.length,
      totalQuantity,
      totalValue: totalValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };
  }, [items]);


  const openModal = (item: InventoryItem | null = null) => {
    setCurrentItem(item);
    setFormErrors({});
    setFormData(item ? { 
        name: item.name, 
        quantity: String(item.quantity), 
        price: String(item.price),
        reference: item.reference,
        purchaseDate: item.purchaseDate,
    } : defaultFormData);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setCurrentItem(null);
    setFormErrors({});
    setActiveSuggestionField(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Handle Autocomplete
    if (name === 'name') {
        if (value) {
            const filteredSuggestions = uniqueItemNames.filter(s => 
                s.toLowerCase().includes(value.toLowerCase())
            );
            setSuggestions(filteredSuggestions);
            setActiveSuggestionField(name);
        } else {
            setSuggestions([]);
            setActiveSuggestionField(null);
        }
    }

    if (formErrors[name as keyof typeof formErrors]) {
        setFormErrors(prev => {
            const newErrors = {...prev};
            delete newErrors[name as keyof typeof formErrors];
            return newErrors;
        });
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (activeSuggestionField) {
        setFormData(prev => ({ ...prev, [activeSuggestionField]: suggestion }));
    }
    setSuggestions([]);
    setActiveSuggestionField(null);
  };
  
  const handleSaveFromModal = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!dbInitialized) return;

      const price = parseFloat(formData.price.replace(',', '.'));
      const quantity = parseFloat(formData.quantity);
      
      const errors: { price?: string; quantity?: string } = {};

      if (isNaN(price) || price < 0) {
        errors.price = t('pricePositiveError');
      }
      if (isNaN(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
        errors.quantity = t('quantityPositiveIntegerError');
      }

      setFormErrors(errors);
      if (Object.keys(errors).length > 0) {
        return;
      }
      
      setIsSaving(true);
      try {
        const newItemData = {
            reference: formData.reference, name: formData.name,
            quantity: parseInt(formData.quantity, 10), 
            price: price,
            purchaseDate: formData.purchaseDate,
        };

        if (currentItem) {
            await updateInventoryItem({ ...currentItem, ...newItemData });
        } else {
            await addInventoryItem(newItemData);
        }
        await loadInventory();
        closeModal();
      } catch (error) {
        console.error("Failed to save item:", error);
      } finally {
        setIsSaving(false);
      }
  }

  const handleDelete = async (id: number) => {
    if (window.confirm(t('confirmDeleteMessage'))) {
      if (!dbInitialized) return;
      await deleteInventoryItem(id);
      await loadInventory();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null); setFileSuccess(null);
    setInventoryFile(e.target.files?.[0] || null);
  };

  const handleProcessFile = async () => {
    if (!inventoryFile || !dbInitialized) return;
    setIsFileProcessing(true); setFileError(null); setFileSuccess(null);
    try {
      let fileContent = '';
      if (inventoryFile.name.endsWith('.xlsx') || inventoryFile.name.endsWith('.xls')) {
        const data = await inventoryFile.arrayBuffer();
        const workbook = XLSX.read(data);
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("The Excel file is empty.");
        const worksheet = workbook.Sheets[sheetName];
        fileContent = XLSX.utils.sheet_to_csv(worksheet);
      } else {
        fileContent = await inventoryFile.text();
      }

      if (!fileContent.trim()) throw new Error("The file is empty.");

      const parsedItems = await parseInventoryFile(fileContent);
      if (!Array.isArray(parsedItems)) throw new Error("Parsed data is not an array.");
      
      if (parsedItems.length === 0) {
        throw new Error(t('fileEmptyError'));
      }

      await addMultipleInventoryItems(parsedItems);
      await loadInventory();

      setFileSuccess(t('fileProcessingSuccess'));
      setInventoryFile(null);
      const fileInput = document.getElementById('excel-importer') as HTMLInputElement;
      if(fileInput) fileInput.value = '';

    } catch (err) {
      console.error("File processing error:", err);
      setFileError(err instanceof Error ? err.message : String(t('fileProcessingError')));
    } finally {
      setIsFileProcessing(false);
    }
  };

  const handleClearInventory = async () => {
    if (window.confirm(t('confirmClearInventory'))) {
        if (!dbInitialized) return;
        await clearInventory();
        await loadInventory();
    }
  };
  
  return (
    <div className="container mx-auto p-4 sm:p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">{t('inventoryPageTitle')}</h1>

      {/* Summary Section */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">{t('inventorySummaryTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard title={t('totalUniqueItems')} value={summaryData.uniqueCount} icon={<BoxIcon />} />
            <StatCard title={t('totalItemQuantity')} value={summaryData.totalQuantity} icon={<CollectionIcon />}/>
            <StatCard title={t('totalInventoryValue')} value={`${summaryData.totalValue} DH`} icon={<CashIcon />}/>
          </div>
      </div>
      
      {/* Actions Section */}
       <div className="bg-white p-4 rounded-lg shadow-md mb-6 border border-gray-200">
           <h2 className="text-xl font-semibold mb-4 text-gray-700">{t('actions')}</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <p className="text-md font-semibold text-gray-600 mb-2">{t('addNewItem')}</p>
                    <button onClick={() => openModal()} className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md disabled:bg-indigo-400" disabled={!dbInitialized}>{t('addItem')}</button>
                </div>
                 <div>
                    <p className="text-md font-semibold text-gray-600 mb-2">{t('importFromExcel')}</p>
                    <p className="text-xs text-gray-500 mb-3">{t('importInstructions')}</p>
                    <div className="flex items-center space-x-2">
                         <input type="file" id="excel-importer" onChange={handleFileSelect} accept=".xlsx,.xls,.csv,.txt" className="hidden"/>
                         <label htmlFor="excel-importer" className="cursor-pointer px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 inline-flex items-center shadow-sm hover:shadow-md">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                            {t('selectAFile')}
                         </label>
                        {inventoryFile && <span className="text-sm text-gray-600 flex-1 truncate">{inventoryFile.name}</span>}
                    </div>
                    {inventoryFile && (
                         <button onClick={handleProcessFile} disabled={isFileProcessing || !dbInitialized} className="mt-3 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400">
                            {isFileProcessing ? t('fileProcessing') : t('uploadAndProcess')}
                        </button>
                    )}
                    {fileError && <p className="mt-2 text-sm text-red-600">{fileError}</p>}
                    {fileSuccess && <p className="mt-2 text-sm text-green-600">{fileSuccess}</p>}
                </div>
           </div>
       </div>


      {/* Current Inventory Table Card */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 mb-6">
        <div className="p-4 flex flex-col sm:flex-row justify-between items-center border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-700 mb-2 sm:mb-0">{t('currentInventoryTitle')} ({items.length})</h2>
            <input type="text" placeholder={t('searchPlaceholder') ?? 'Search...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-2 border border-gray-300 rounded-md shadow-sm w-full sm:w-64"/>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-700 uppercase bg-gray-100">
              <tr>
                <th scope="col" className="px-6 py-3">{t('reference')}</th>
                <th scope="col" className="px-6 py-3">{t('itemNameLabel')}</th>
                <th scope="col" className="px-6 py-3">{t('quantityLabel')}</th>
                <th scope="col" className="px-6 py-3">{t('unitPriceLabel')}</th>
                <th scope="col" className="px-6 py-3">{t('purchaseDate')}</th>
                <th scope="col" className="px-6 py-3 text-right">{t('actions')}</th>
              </tr>
            </thead>
            {isLoading ? <SkeletonLoader /> : (
            <tbody>
              {filteredItems.length > 0 ? filteredItems.map(item => (
                <tr key={item.id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-800">{item.reference}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">{item.name}</td>
                  <td className="px-6 py-4">{item.quantity}</td>
                  <td className="px-6 py-4">{item.price.toFixed(2)} DH</td>
                  <td className="px-6 py-4">{item.purchaseDate}</td>
                  <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                    <button onClick={() => openModal(item)} className="text-indigo-600 hover:text-indigo-800 transition-colors" title={t('edit')}><EditIcon /></button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800 transition-colors" title={t('delete')}><TrashIcon /></button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="text-center py-12 text-gray-500">
                    <h3 className="text-lg font-medium">{searchTerm ? t('noItemsFound') : t('emptyInventoryMessage')}</h3>
                    {!searchTerm && <button onClick={() => openModal()} className="mt-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">{t('addNewItem')}</button>}
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
              <p className="text-md font-semibold text-gray-700 mb-2">{t('clearInventoryTitle')}</p>
              <p className="text-xs text-red-700 mb-3">{t('clearInventoryDescription')}</p>
              <button 
                  onClick={handleClearInventory}
                  className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-all shadow-sm hover:shadow-md disabled:bg-red-400 disabled:cursor-not-allowed" 
                  disabled={!dbInitialized || items.length === 0}
              >
                  {t('clearInventoryButton')}
              </button>
          </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-fade-in-up">
            <form onSubmit={handleSaveFromModal} autoComplete="off">
              <div className="p-5 border-b"><h2 className="text-xl font-bold text-gray-900">{currentItem ? t('editItemModalTitle') : t('addItemModalTitle')}</h2></div>
              <fieldset disabled={isSaving}>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  
                  <div className="sm:col-span-2">
                    <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-1">{t('reference')}</label>
                    <div className="flex rounded-md shadow-sm">
                      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500"><ReferenceIcon /></span>
                      <input type="text" name="reference" id="reference" value={formData.reference} onChange={handleFormChange} className="flex-1 block w-full rounded-none rounded-r-md p-2.5 border border-gray-300 bg-white text-gray-900 focus:ring-indigo-500 focus:border-indigo-500" required />
                    </div>
                  </div>
                  
                  <div className="sm:col-span-2 relative" ref={activeSuggestionField === 'name' ? suggestionRef : null}>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">{t('itemNameLabel')}</label>
                    <div className="flex rounded-md shadow-sm">
                      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500"><ItemNameIcon /></span>
                      <input type="text" name="name" id="name" value={formData.name} onChange={handleFormChange} className="flex-1 block w-full rounded-none rounded-r-md p-2.5 border border-gray-300 bg-white text-gray-900 focus:ring-indigo-500 focus:border-indigo-500" required />
                    </div>
                     {activeSuggestionField === 'name' && suggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {suggestions.map((s, index) => (
                                <div key={index} onClick={() => handleSuggestionClick(s)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">{s}</div>
                            ))}
                        </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">{t('unitPriceLabel')}</label>
                    <div className="flex rounded-md shadow-sm">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500"><PriceIcon /></span>
                        <input type="text" name="price" id="price" value={formData.price} onChange={handleFormChange} className={`flex-1 block w-full rounded-none rounded-r-md p-2.5 border ${formErrors.price ? 'border-red-500' : 'border-gray-300'} bg-white text-gray-900 focus:ring-indigo-500 focus:border-indigo-500`} required />
                    </div>
                    {formErrors.price && <p className="text-red-500 text-xs mt-1">{formErrors.price}</p>}
                  </div>

                  <div>
                    <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">{t('quantityLabel')}</label>
                    <div className="flex rounded-md shadow-sm">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500"><QuantityIcon /></span>
                        <input type="number" step="1" min="1" name="quantity" id="quantity" value={formData.quantity} onChange={handleFormChange} className={`flex-1 block w-full rounded-none rounded-r-md p-2.5 border ${formErrors.quantity ? 'border-red-500' : 'border-gray-300'} bg-white text-gray-900 focus:ring-indigo-500 focus:border-indigo-500`} required />
                    </div>
                    {formErrors.quantity && <p className="text-red-500 text-xs mt-1">{formErrors.quantity}</p>}
                  </div>
                  
                  <div className="sm:col-span-2">
                    <label htmlFor="purchaseDate" className="block text-sm font-medium text-gray-700 mb-1">{t('purchaseDate')}</label>
                     <div className="flex rounded-md shadow-sm">
                      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500"><DateIcon /></span>
                      <input type="date" name="purchaseDate" id="purchaseDate" value={formData.purchaseDate} onChange={handleFormChange} className="flex-1 block w-full rounded-none rounded-r-md p-2.5 border border-gray-300 bg-white text-gray-900 focus:ring-indigo-500 focus:border-indigo-500" required />
                    </div>
                  </div>

                </div>
              </fieldset>
              <div className="p-4 flex justify-end space-x-3 bg-gray-50 rounded-b-lg">
                <button type="button" onClick={closeModal} disabled={isSaving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-200">{t('cancel')}</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 w-24 flex justify-center items-center text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400">
                    {isSaving ? <Spinner /> : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;