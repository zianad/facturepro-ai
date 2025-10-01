
import { GeneratedInvoice, InventoryItem, ProfileData } from './types';

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
                // We use an index on 'reference' to look up items when updating stock.
                // It is not unique to prevent database errors if user data contains duplicates.
                inventoryStore.createIndex('reference', 'reference', { unique: false });
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
        const index = store.index('reference');

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject((event.target as IDBTransaction).error);

        const processNext = (itemIndex: number) => {
            if (itemIndex >= items.length) return;
            const item = items[itemIndex];

            const getRequest = index.get(item.reference);
            getRequest.onsuccess = () => {
                const existingItem: InventoryItem = getRequest.result;
                let putRequest: IDBRequest;
                if (existingItem) {
                    existingItem.quantity += item.quantity;
                    existingItem.name = item.name;
                    existingItem.price = item.price;
                    existingItem.purchaseDate = item.purchaseDate;
                    putRequest = store.put(existingItem);
                } else {
                    putRequest = store.add(item);
                }
                putRequest.onsuccess = () => processNext(itemIndex + 1);
            };
        };
        processNext(0);
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

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);

        const getInvoiceRequest = invoiceStore.get(invoiceId);

        getInvoiceRequest.onsuccess = () => {
            const invoice: GeneratedInvoice | undefined = getInvoiceRequest.result;
            if (!invoice) {
                resolve();
                return;
            }

            const deleteRequest = invoiceStore.delete(invoiceId);
            deleteRequest.onsuccess = () => {
                const inventoryIndex = inventoryStore.index('reference');
                const processNextItem = (index: number) => {
                    if (index >= invoice.items.length) return;

                    const itemToRestock = invoice.items[index];
                    const getStockItemRequest = inventoryIndex.get(itemToRestock.reference);
                    getStockItemRequest.onsuccess = () => {
                        const stockItem: InventoryItem | undefined = getStockItemRequest.result;
                        if (stockItem) {
                            stockItem.quantity += itemToRestock.quantity;
                            inventoryStore.put(stockItem).onsuccess = () => processNextItem(index + 1);
                        } else {
                            processNextItem(index + 1);
                        }
                    };
                };
                processNextItem(0);
            };
        };
    });
};

export const clearAllInvoicesAndRestock = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([INVOICES_STORE_NAME, INVENTORY_STORE_NAME], 'readwrite');
        const invoiceStore = transaction.objectStore(INVOICES_STORE_NAME);
        const inventoryStore = transaction.objectStore(INVENTORY_STORE_NAME);

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject((event.target as IDBTransaction).error);

        const getAllInvoicesRequest = invoiceStore.getAll();
        getAllInvoicesRequest.onsuccess = () => {
            const allInvoices: GeneratedInvoice[] = getAllInvoicesRequest.result;
            if (allInvoices.length === 0) return;
            
            const inventoryIndex = inventoryStore.index('reference');
            const itemsToRestock: { reference: string; quantity: number }[] = allInvoices.flatMap(inv => inv.items);

            const processNextItem = (index: number) => {
                if (index >= itemsToRestock.length) {
                    invoiceStore.clear();
                    return;
                }
                const itemToRestock = itemsToRestock[index];
                const getRequest = inventoryIndex.get(itemToRestock.reference);
                getRequest.onsuccess = () => {
                    const stockItem: InventoryItem | undefined = getRequest.result;
                    if (stockItem) {
                        stockItem.quantity += itemToRestock.quantity;
                        inventoryStore.put(stockItem).onsuccess = () => processNextItem(index + 1);
                    } else {
                        processNextItem(index + 1);
                    }
                };
            };
            processNextItem(0);
        };
    });
};

export const createInvoiceAndUpdateStock = (invoiceData: Omit<GeneratedInvoice, 'id'>): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([INVOICES_STORE_NAME, INVENTORY_STORE_NAME], 'readwrite');
        const invoiceStore = transaction.objectStore(INVOICES_STORE_NAME);
        const inventoryStore = transaction.objectStore(INVENTORY_STORE_NAME);
        
        transaction.oncomplete = () => {
            console.log("Invoice created and stock updated successfully.");
            resolve();
        };

        transaction.onerror = (event) => {
            const error = (event.target as IDBTransaction).error;
            console.error("Transaction error:", error);
            reject(error || new Error('A database transaction error occurred.'));
        };

        const addInvoiceRequest = invoiceStore.add(invoiceData);

        addInvoiceRequest.onsuccess = () => {
            const itemsToUpdate = invoiceData.items;
            if (itemsToUpdate.length === 0) {
                return;
            }

            const inventoryIndex = inventoryStore.index('reference');

            const processNextItem = (index: number) => {
                if (index >= itemsToUpdate.length) {
                    return;
                }

                const itemToDeduct = itemsToUpdate[index];
                const getRequest = inventoryIndex.get(itemToDeduct.reference);

                getRequest.onsuccess = () => {
                    const stockItem: InventoryItem | undefined = getRequest.result;

                    if (!stockItem) {
                        const error = new Error(`Item with reference ${itemToDeduct.reference} was not found in inventory.`);
                        transaction.abort();
                        reject(error);
                        return;
                    }

                    if (stockItem.quantity < itemToDeduct.quantity) {
                        const error = new Error(`Insufficient stock for ${stockItem.name} (Ref: ${stockItem.reference}). Required: ${itemToDeduct.quantity}, Available: ${stockItem.quantity}.`);
                        transaction.abort();
                        reject(error);
                        return;
                    }

                    stockItem.quantity -= itemToDeduct.quantity;
                    const putRequest = inventoryStore.put(stockItem);

                    putRequest.onsuccess = () => {
                        processNextItem(index + 1);
                    };
                };
            };

            processNextItem(0);
        };
    });
};
