import { GeneratedInvoice, InventoryItem, ProfileData, InvoiceItem } from './types';

const DB_NAME = 'FactureProDB';
const DB_VERSION = 2; // Incremented version to trigger upgrade
const INVENTORY_STORE_NAME = 'inventory';
const INVOICES_STORE_NAME = 'invoices';
const PROFILE_STORE_NAME = 'profile';

let db: IDBDatabase;

export const initDB = (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(true);
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const dbInstance = (event.target as IDBOpenDBRequest).result;
            const transaction = (event.target as IDBOpenDBRequest).transaction;
            
            // --- Upgrade Inventory Store (more robustly) ---
            let inventoryStore: IDBObjectStore;
            if (dbInstance.objectStoreNames.contains(INVENTORY_STORE_NAME)) {
                inventoryStore = transaction!.objectStore(INVENTORY_STORE_NAME);
            } else {
                inventoryStore = dbInstance.createObjectStore(INVENTORY_STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
            // Ensure all necessary indexes exist on the inventory store
            if (!inventoryStore.indexNames.contains('reference')) {
                inventoryStore.createIndex('reference', 'reference', { unique: false });
            }
            if (!inventoryStore.indexNames.contains('ref_name')) {
                inventoryStore.createIndex('ref_name', ['reference', 'name'], { unique: false });
            }

            // --- Upgrade Invoices Store ---
            if (!dbInstance.objectStoreNames.contains(INVOICES_STORE_NAME)) {
                dbInstance.createObjectStore(INVOICES_STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }

            // --- Upgrade Profile Store ---
            if (!dbInstance.objectStoreNames.contains(PROFILE_STORE_NAME)) {
                dbInstance.createObjectStore(PROFILE_STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            db = (event.target as IDBOpenDBRequest).result;
            resolve(true);
        };

        request.onerror = (event) => {
            console.error('Database error:', (event.target as IDBOpenDBRequest).error);
            reject(false);
        };
    });
};

// --- Inventory Functions ---

export const getAllInventoryItems = (): Promise<InventoryItem[]> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([INVENTORY_STORE_NAME], 'readonly');
        const store = transaction.objectStore(INVENTORY_STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const addInventoryItem = (item: Omit<InventoryItem, 'id'>): Promise<number> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([INVENTORY_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(INVENTORY_STORE_NAME);
        const request = store.add(item);
        request.onsuccess = () => resolve(request.result as number);
        request.onerror = () => reject(request.error);
    });
};

export const addMultipleInventoryItems = (items: Omit<InventoryItem, 'id'>[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([INVENTORY_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(INVENTORY_STORE_NAME);

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject((event.target as IDBTransaction).error);

        items.forEach(item => {
            store.add(item);
        });
    });
};


export const updateInventoryItem = (item: InventoryItem): Promise<number> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([INVENTORY_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(INVENTORY_STORE_NAME);
        const request = store.put(item);
        request.onsuccess = () => resolve(request.result as number);
        request.onerror = () => reject(request.error);
    });
};

export const deleteInventoryItem = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([INVENTORY_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(INVENTORY_STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const clearInventory = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([INVENTORY_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(INVENTORY_STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// --- Profile Functions ---

export const getProfile = (): Promise<ProfileData | null> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([PROFILE_STORE_NAME], 'readonly');
        const store = transaction.objectStore(PROFILE_STORE_NAME);
        const request = store.get(1);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

export const updateProfile = (profileData: Omit<ProfileData, 'id'>): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([PROFILE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(PROFILE_STORE_NAME);
        const dataToStore: ProfileData = { ...profileData, id: 1 };
        const request = store.put(dataToStore);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// --- Invoice Functions ---

export const getAllInvoices = (): Promise<GeneratedInvoice[]> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([INVOICES_STORE_NAME], 'readonly');
        const store = transaction.objectStore(INVOICES_STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const deleteInvoiceAndRestock = (invoiceId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([INVOICES_STORE_NAME, INVENTORY_STORE_NAME], 'readwrite');
        const invoiceStore = transaction.objectStore(INVOICES_STORE_NAME);
        const inventoryStore = transaction.objectStore(INVENTORY_STORE_NAME);
        const inventoryIndex = inventoryStore.index('ref_name');

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject((event.target as IDBTransaction).error);

        const getInvoiceRequest = invoiceStore.get(invoiceId);

        getInvoiceRequest.onerror = () => reject(getInvoiceRequest.error);
        getInvoiceRequest.onsuccess = () => {
            const invoice: GeneratedInvoice | undefined = getInvoiceRequest.result;
            if (!invoice) {
                return reject(new Error(`Invoice with ID ${invoiceId} not found.`));
            }
            if (invoice.items.length === 0) {
                invoiceStore.delete(invoiceId); // Just delete and finish
                return;
            }

            let pendingOperations = invoice.items.length;

            const operationFailed = (event: Event) => {
                 if (!transaction.error) {
                    transaction.abort();
                    reject((event.target as IDBRequest).error);
                }
            };
            
            const operationSucceeded = () => {
                pendingOperations--;
                if (pendingOperations === 0) {
                    // Last item restocked, now delete the invoice
                    invoiceStore.delete(invoiceId);
                }
            };
            
            invoice.items.forEach(item => {
                const key = [item.reference, item.description];
                const getMatchingRequest = inventoryIndex.getAll(key);
                
                getMatchingRequest.onerror = operationFailed;
                getMatchingRequest.onsuccess = () => {
                    const matchingItems: InventoryItem[] = getMatchingRequest.result;
                    let writeRequest: IDBRequest;

                    if (matchingItems.length > 0) {
                        matchingItems.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
                        const latestBatch = matchingItems[0];
                        latestBatch.quantity += item.quantity;
                        writeRequest = inventoryStore.put(latestBatch);

                    } else {
                        const newItem: Omit<InventoryItem, 'id'> = {
                            reference: item.reference,
                            name: item.description,
                            quantity: item.quantity,
                            price: parseFloat(item.unitPrice.toFixed(2)),
                            purchaseDate: new Date().toISOString().split('T')[0],
                        };
                        writeRequest = inventoryStore.add(newItem);
                    }
                    writeRequest.onsuccess = operationSucceeded;
                    writeRequest.onerror = operationFailed;
                };
            });
        };
    });
};

export const clearAllInvoicesAndRestock = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([INVOICES_STORE_NAME, INVENTORY_STORE_NAME], 'readwrite');
        const invoiceStore = transaction.objectStore(INVOICES_STORE_NAME);
        const inventoryStore = transaction.objectStore(INVENTORY_STORE_NAME);
        const inventoryIndex = inventoryStore.index('ref_name');

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject((event.target as IDBTransaction).error || new Error("Transaction failed during clear invoices and restock."));

        const getAllInvoicesRequest = invoiceStore.getAll();

        getAllInvoicesRequest.onsuccess = () => {
            const allInvoices: GeneratedInvoice[] = getAllInvoicesRequest.result;
            if (allInvoices.length === 0) {
                return; // Nothing to do, transaction will complete successfully.
            }

            const allItemsToRestock: InvoiceItem[] = allInvoices.flatMap(inv => inv.items);
            const aggregatedItems = new Map<string, InvoiceItem>();
            for (const item of allItemsToRestock) {
                const key = `${item.reference}::${item.description}`;
                const existing = aggregatedItems.get(key);
                if (existing) {
                    existing.quantity += item.quantity;
                } else {
                    aggregatedItems.set(key, { ...item });
                }
            }

            const itemsToProcess = Array.from(aggregatedItems.values());
            let pendingOperations = itemsToProcess.length;

            if (pendingOperations === 0) {
                invoiceStore.clear(); // Clear invoices even if they had no items.
                return;
            }

            const operationFailed = (event: Event) => {
                if (!transaction.error) { // Avoid multiple rejects
                    transaction.abort();
                    reject((event.target as IDBRequest).error);
                }
            };
            
            const operationSucceeded = () => {
                pendingOperations--;
                if (pendingOperations === 0) {
                    // This is the last successful inventory update, now we can safely clear invoices.
                    invoiceStore.clear();
                }
            };

            itemsToProcess.forEach(item => {
                const key = [item.reference, item.description];
                const getMatchingRequest = inventoryIndex.getAll(key);
                
                getMatchingRequest.onerror = operationFailed;
                getMatchingRequest.onsuccess = () => {
                    const matchingItems: InventoryItem[] = getMatchingRequest.result;
                    let writeRequest: IDBRequest;

                    if (matchingItems.length > 0) {
                        matchingItems.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
                        const latestBatch = matchingItems[0];
                        latestBatch.quantity += item.quantity;
                        writeRequest = inventoryStore.put(latestBatch);

                    } else {
                        const newItem: Omit<InventoryItem, 'id'> = {
                            reference: item.reference,
                            name: item.description,
                            quantity: item.quantity,
                            price: parseFloat(item.unitPrice.toFixed(2)),
                            purchaseDate: new Date().toISOString().split('T')[0],
                        };
                        writeRequest = inventoryStore.add(newItem);
                    }
                    writeRequest.onsuccess = operationSucceeded;
                    writeRequest.onerror = operationFailed;
                };
            });
        };

        getAllInvoicesRequest.onerror = () => {
            reject(getAllInvoicesRequest.error);
        };
    });
};

export const getAvailableInventoryValue = (date: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        const VAT_RATE = 0.20;
        const transaction = db.transaction([INVENTORY_STORE_NAME], 'readonly');
        const store = transaction.objectStore(INVENTORY_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const allInventory: InventoryItem[] = request.result;
            const availableInventory = allInventory.filter(i =>
                i.quantity > 0 && new Date(i.purchaseDate) <= new Date(date)
            );
            const totalAvailableValueHT = availableInventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            const totalAvailableValueTTC = totalAvailableValueHT * (1 + VAT_RATE);
            resolve(totalAvailableValueTTC);
        };

        request.onerror = () => reject(request.error);
    });
};


export const createInvoiceFromTotal = (
    invoiceData: {
        invoiceNumber: string;
        customerName: string;
        invoiceDate: string;
        totalAmount: number; // This is the target TTC
    }
): Promise<void> => {
    return new Promise((resolve, reject) => {
        const VAT_RATE = 0.20;
        const transaction = db.transaction([INVENTORY_STORE_NAME, INVOICES_STORE_NAME], 'readwrite');
        const inventoryStore = transaction.objectStore(INVENTORY_STORE_NAME);
        const invoiceStore = transaction.objectStore(INVOICES_STORE_NAME);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject((event.target as IDBTransaction).error || new Error("Transaction failed"));
        
        const getAllRequest = inventoryStore.getAll();
        
        getAllRequest.onsuccess = async () => {
            try {
                const allInventory = getAllRequest.result as InventoryItem[];
                const availableInventory = allInventory.filter(i =>
                    i.quantity > 0 && new Date(i.purchaseDate) <= new Date(invoiceData.invoiceDate)
                );

                if (availableInventory.length === 0) {
                    throw new Error("لا توجد عناصر متاحة في المخزون في تاريخ الفاتورة المحدد أو قبله.");
                }

                const totalAvailableValueHT = availableInventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                const totalAvailableValueTTC = totalAvailableValueHT * (1 + VAT_RATE);

                let itemsToSell: { stockItem: InventoryItem; quantityToTake: number }[] = [];
                const roundedTargetTTC = Math.round(invoiceData.totalAmount * 100);
                const roundedAvailableTTC = Math.round(totalAvailableValueTTC * 100);

                if (Math.abs(roundedTargetTTC - roundedAvailableTTC) <= 1) { // Use a small tolerance for floating point issues
                    itemsToSell = availableInventory.map(item => ({
                        stockItem: item,
                        quantityToTake: item.quantity
                    }));
                } else {
                    if (invoiceData.totalAmount > totalAvailableValueTTC) {
                         throw new Error(`قيمة الفاتورة المطلوبة (${invoiceData.totalAmount.toFixed(2)}) تتجاوز قيمة المخزون المتاح (${totalAvailableValueTTC.toFixed(2)}).`);
                    }

                    const targetTotalHT = invoiceData.totalAmount / (1 + VAT_RATE);
                    let currentTotalHT = 0;
                    
                    // Prioritize more expensive items to reach the total faster with fewer items
                    availableInventory.sort((a, b) => b.price - a.price);

                    for (const stockItem of availableInventory) {
                        const remainingValueNeeded = targetTotalHT - currentTotalHT;
                        if (remainingValueNeeded <= 0.001) break; // Stop if we're close enough

                        if(stockItem.price <= 0) continue;

                        const maxQtyFromValue = Math.floor(remainingValueNeeded / stockItem.price);
                        const qtyToTake = Math.min(stockItem.quantity, maxQtyFromValue);

                        if (qtyToTake > 0) {
                            itemsToSell.push({ stockItem: stockItem, quantityToTake: qtyToTake });
                            currentTotalHT += qtyToTake * stockItem.price;
                        }
                    }
                }

                if (itemsToSell.length === 0) {
                    throw new Error("تعذر إنشاء الفاتورة للمبلغ الإجمالي المحدد. قد يكون المبلغ صغيرًا جدًا بالنسبة للمخزون الحالي.");
                }

                const invoiceItemsMap = new Map<string, InvoiceItem>();
                let finalActualTotalHT = 0;

                // Step 1: Deduct real stock and calculate actual totals
                for (const { stockItem, quantityToTake } of itemsToSell) {
                    // Deduct from inventory using real values
                    const updatedItem = { ...stockItem, quantity: stockItem.quantity - quantityToTake };
                    inventoryStore.put(updatedItem); // This operation uses the real price

                    const itemValue = quantityToTake * stockItem.price;
                    finalActualTotalHT += itemValue;
                    
                    const key = `${stockItem.reference}::${stockItem.name}::${stockItem.price}`;
                    const existing = invoiceItemsMap.get(key);
                    if (existing) {
                        existing.quantity += quantityToTake;
                        existing.total += itemValue;
                    } else {
                        invoiceItemsMap.set(key, {
                            reference: stockItem.reference,
                            description: stockItem.name,
                            quantity: quantityToTake,
                            unitPrice: stockItem.price,
                            total: itemValue,
                        });
                    }
                }
                
                const finalInvoiceItems = Array.from(invoiceItemsMap.values());
                const finalActualTotalTTC = finalActualTotalHT * (1 + VAT_RATE);
                const targetTotalTTC = invoiceData.totalAmount;

                // Step 2: Adjust invoice item prices to match the requested total
                const differenceTTC = targetTotalTTC - finalActualTotalTTC;
                
                if (finalInvoiceItems.length > 0 && Math.abs(differenceTTC) > 0.001) {
                    // Find the item with the highest total value to absorb the difference
                    let itemToAdjust = finalInvoiceItems.reduce((prev, current) => (prev.total > current.total) ? prev : current);
                    
                    // The difference needs to be applied to the HT value of the item
                    const differenceHT = differenceTTC / (1 + VAT_RATE);

                    // Adjust the total and unit price of that single item for the invoice document
                    itemToAdjust.total += differenceHT;
                    itemToAdjust.unitPrice = itemToAdjust.total / itemToAdjust.quantity;
                }

                // Step 3: Create the final invoice with the adjusted values
                const newInvoice: Omit<GeneratedInvoice, 'id'> = {
                    invoiceNumber: invoiceData.invoiceNumber,
                    customerName: invoiceData.customerName,
                    invoiceDate: invoiceData.invoiceDate,
                    totalAmount: targetTotalTTC, // Use the user's requested total
                    items: finalInvoiceItems // Use the potentially adjusted items
                };

                invoiceStore.add(newInvoice);

            } catch (error) {
                console.error("Error during invoice creation:", error);
                transaction.abort();
            }
        };
        
        getAllRequest.onerror = () => {
            reject(getAllRequest.error);
        };
    });
};
