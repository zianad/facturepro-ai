import { GeneratedInvoice, InventoryItem, ProfileData, InvoiceItem } from './types';

const DB_NAME = 'FactureProDB';
const DB_VERSION = 1;
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
            if (!dbInstance.objectStoreNames.contains(INVENTORY_STORE_NAME)) {
                const inventoryStore = dbInstance.createObjectStore(INVENTORY_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                inventoryStore.createIndex('reference', 'reference', { unique: false });
                // Add a compound index for efficient lookup
                inventoryStore.createIndex('ref_name', ['reference', 'name'], { unique: false });
            }
            if (!dbInstance.objectStoreNames.contains(INVOICES_STORE_NAME)) {
                dbInstance.createObjectStore(INVOICES_STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
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

const restockStockFromInvoice = async (
    transaction: IDBTransaction,
    items: InvoiceItem[]
): Promise<void> => {
    const inventoryStore = transaction.objectStore(INVENTORY_STORE_NAME);
    const inventoryIndex = inventoryStore.index('ref_name');

    for (const item of items) {
        const key = [item.reference, item.description];
        const getAllRequest = inventoryIndex.getAll(key);

        const matchingItems: InventoryItem[] = await new Promise((res, rej) => {
            getAllRequest.onsuccess = () => res(getAllRequest.result);
            getAllRequest.onerror = () => rej(getAllRequest.error);
        });

        if (matchingItems.length > 0) {
            // Add quantity back to the most recent batch of this item
            matchingItems.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
            const latestBatch = matchingItems[0];
            latestBatch.quantity += item.quantity;
             await new Promise<void>((res, rej) => {
                const putRequest = inventoryStore.put(latestBatch);
                putRequest.onsuccess = () => res();
                putRequest.onerror = () => rej(putRequest.error);
            });
        } else {
            // If the item was completely depleted and deleted, re-create it.
            const newItem: Omit<InventoryItem, 'id'> = {
                reference: item.reference,
                name: item.description,
                quantity: item.quantity,
                price: parseFloat(item.unitPrice.toFixed(2)), // Use invoice price, rounded
                purchaseDate: new Date().toISOString().split('T')[0],
            };
            await new Promise<void>((res, rej) => {
                const addRequest = inventoryStore.add(newItem);
                addRequest.onsuccess = () => res();
                addRequest.onerror = () => rej(addRequest.error);
            });
        }
    }
};

export const deleteInvoiceAndRestock = (invoiceId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([INVOICES_STORE_NAME, INVENTORY_STORE_NAME], 'readwrite');
        const invoiceStore = transaction.objectStore(INVOICES_STORE_NAME);

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject((event.target as IDBTransaction).error);

        const getInvoiceRequest = invoiceStore.get(invoiceId);

        getInvoiceRequest.onsuccess = async () => {
            const invoice: GeneratedInvoice | undefined = getInvoiceRequest.result;
            if (!invoice) {
                return reject(new Error(`Invoice with ID ${invoiceId} not found.`));
            }

            try {
                await restockStockFromInvoice(transaction, invoice.items);
                invoiceStore.delete(invoiceId);
            } catch (error) {
                console.error("Failed to restock items:", error);
                transaction.abort();
                reject(error);
            }
        };

        getInvoiceRequest.onerror = () => {
            transaction.abort();
            reject(getInvoiceRequest.error);
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

                if (Math.abs(roundedTargetTTC - roundedAvailableTTC) <= 1) {
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
                    
                    availableInventory.sort((a, b) => b.price - a.price);

                    for (const stockItem of availableInventory) {
                        const remainingValueNeeded = targetTotalHT - currentTotalHT;
                        if (remainingValueNeeded <= 0.001) break;

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

                for (const { stockItem, quantityToTake } of itemsToSell) {
                    const updatedItem = { ...stockItem, quantity: stockItem.quantity - quantityToTake };
                    inventoryStore.put(updatedItem);

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

                const newInvoice: Omit<GeneratedInvoice, 'id'> = {
                    ...invoiceData,
                    totalAmount: finalActualTotalTTC,
                    items: finalInvoiceItems
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
