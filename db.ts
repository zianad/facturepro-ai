
import { InventoryItem, GeneratedInvoice, ProfileData } from './types';

const DB_NAME = 'InvoiceAppDB';
const DB_VERSION = 5; // Incremented version to remove profile store
const INVENTORY_STORE_NAME = 'inventory';
const INVOICES_STORE_NAME = 'invoices';
const PROFILE_STORE_NAME = 'profile';


let db: IDBDatabase;

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction;
      
      let inventoryStore;
      if (!db.objectStoreNames.contains(INVENTORY_STORE_NAME)) {
        inventoryStore = db.createObjectStore(INVENTORY_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      } else if(transaction) {
        inventoryStore = transaction.objectStore(INVENTORY_STORE_NAME);
      }

      if (inventoryStore) {
        if (!inventoryStore.indexNames.contains('name')) inventoryStore.createIndex('name', 'name', { unique: false });
        if (!inventoryStore.indexNames.contains('reference')) inventoryStore.createIndex('reference', 'reference', { unique: false });
        if (inventoryStore.indexNames.contains('category')) inventoryStore.deleteIndex('category');
      }
      
      if (!db.objectStoreNames.contains(INVOICES_STORE_NAME)) {
        const invoiceStore = db.createObjectStore(INVOICES_STORE_NAME, { keyPath: 'id', autoIncrement: true });
        invoiceStore.createIndex('invoiceNumber', 'invoiceNumber', { unique: false });
        invoiceStore.createIndex('customerName', 'customerName', { unique: false });
      }

      if (!db.objectStoreNames.contains(PROFILE_STORE_NAME)) {
        db.createObjectStore(PROFILE_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      console.log("Database initialized successfully");
      resolve(true);
    };

    request.onerror = (event) => {
      console.error('Database error:', (event.target as IDBOpenDBRequest).error);
      reject(false);
    };
  });
};

const getStore = (storeName: string, mode: IDBTransactionMode) => {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
};

// --- PROFILE FUNCTIONS ---

export const getProfile = (): Promise<ProfileData | null> => {
    return new Promise((resolve, reject) => {
        const store = getStore(PROFILE_STORE_NAME, 'readonly');
        const request = store.get(1); // Always use a static key '1' for the single profile
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
};

export const updateProfile = (profile: Omit<ProfileData, 'id'>): Promise<ProfileData> => {
    return new Promise((resolve, reject) => {
        const store = getStore(PROFILE_STORE_NAME, 'readwrite');
        const profileWithId = { ...profile, id: 1 }; // Ensure static key is set
        const request = store.put(profileWithId);
        request.onsuccess = () => resolve(profileWithId);
        request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
};


// --- INVENTORY FUNCTIONS ---

export const getAllInventoryItems = (): Promise<InventoryItem[]> => {
  return new Promise((resolve, reject) => {
    const store = getStore(INVENTORY_STORE_NAME, 'readonly');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
};

export const addInventoryItem = (item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> => {
  return new Promise((resolve, reject) => {
    const store = getStore(INVENTORY_STORE_NAME, 'readwrite');
    const request = store.add(item);

    request.onsuccess = (event) => {
      const addedId = (event.target as IDBRequest).result as number;
      resolve({ ...item, id: addedId });
    };
    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
};

export const updateInventoryItem = (item: InventoryItem): Promise<InventoryItem> => {
  return new Promise((resolve, reject) => {
    const store = getStore(INVENTORY_STORE_NAME, 'readwrite');
    const request = store.put(item);
    request.onsuccess = () => resolve(item);
    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
};

export const deleteInventoryItem = (id: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const store = getStore(INVENTORY_STORE_NAME, 'readwrite');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
};

export const addMultipleInventoryItems = (items: Omit<InventoryItem, 'id'>[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (items.length === 0) {
            resolve();
            return;
        }
        const transaction = db.transaction(INVENTORY_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(INVENTORY_STORE_NAME);

        items.forEach(item => {
            const sanitizedItem = { ...item, quantity: Number(item.quantity) || 0, price: Number(item.price) || 0 };
            store.add(sanitizedItem);
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject((event.target as IDBRequest).error);
    });
};

export const clearInventory = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const store = getStore(INVENTORY_STORE_NAME, 'readwrite');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
};


// --- INVOICE FUNCTIONS ---

export const getAllInvoices = (): Promise<GeneratedInvoice[]> => {
    return new Promise((resolve, reject) => {
        const store = getStore(INVOICES_STORE_NAME, 'readonly');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
};

export const addInvoice = (invoice: Omit<GeneratedInvoice, 'id'>): Promise<GeneratedInvoice> => {
    return new Promise((resolve, reject) => {
        const store = getStore(INVOICES_STORE_NAME, 'readwrite');
        const request = store.add(invoice);
        request.onsuccess = (event) => {
            const addedId = (event.target as IDBRequest).result as number;
            resolve({ ...invoice, id: addedId });
        };
        request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
};

export const createInvoiceAndUpdateStock = (invoiceData: Omit<GeneratedInvoice, 'id'>): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([INVOICES_STORE_NAME, INVENTORY_STORE_NAME], 'readwrite');
        const invoiceStore = transaction.objectStore(INVOICES_STORE_NAME);
        const inventoryStore = transaction.objectStore(INVENTORY_STORE_NAME);
        const itemsToUpdate: { reference: string, quantityToDeduct: number }[] = invoiceData.items.map(item => ({
            reference: item.reference,
            quantityToDeduct: item.quantity
        }));

        transaction.oncomplete = () => {
            resolve();
        };
        transaction.onerror = (event) => {
            console.error("Transaction error:", (event.target as IDBRequest).error);
            reject((event.target as IDBRequest).error);
        };
        
        transaction.onabort = (event) => {
            console.error("Transaction aborted:", (event.target as IDBTransaction).error);
            reject((event.target as IDBTransaction).error);
        };


        // Add the new invoice
        invoiceStore.add(invoiceData);

        // Update inventory items
        const inventoryIndex = inventoryStore.index('reference');
        let processed = 0;
        
        if (itemsToUpdate.length === 0) return;

        itemsToUpdate.forEach(itemUpdate => {
            const getRequest = inventoryIndex.get(itemUpdate.reference);
            getRequest.onsuccess = () => {
                const item: InventoryItem = getRequest.result;
                if (item) {
                    if (item.quantity >= itemUpdate.quantityToDeduct) {
                        item.quantity -= itemUpdate.quantityToDeduct;
                        inventoryStore.put(item);
                    } else {
                        transaction.abort();
                        reject(new Error(`Insufficient stock for item reference ${item.reference}.`));
                    }
                } else {
                    transaction.abort();
                    reject(new Error(`Item with reference ${itemUpdate.reference} not found in inventory.`));
                }
            };
        });
    });
};

export const deleteInvoiceAndRestock = async (invoiceId: number): Promise<void> => {
    // Phase 1: Read all necessary data
    const getInvoicePromise = new Promise<GeneratedInvoice>((resolve, reject) => {
        const store = getStore(INVOICES_STORE_NAME, 'readonly');
        const request = store.get(invoiceId);
        request.onsuccess = () => {
            if (request.result) resolve(request.result);
            else reject(new Error(`Invoice with ID ${invoiceId} not found.`));
        };
        request.onerror = (e) => reject((e.target as IDBRequest).error);
    });

    const [invoice, allInventory] = await Promise.all([
        getInvoicePromise,
        getAllInventoryItems()
    ]);

    // Phase 2: Prepare updates in memory
    const inventoryMap = new Map<string, InventoryItem>(allInventory.map(item => [item.reference, item]));
    const itemsToUpdate: InventoryItem[] = [];
    const itemsToAdd: Omit<InventoryItem, 'id'>[] = [];

    for (const itemToRestock of invoice.items) {
        const existingItem = inventoryMap.get(itemToRestock.reference);
        if (existingItem) {
            existingItem.quantity += itemToRestock.quantity;
            itemsToUpdate.push(existingItem);
        } else {
            console.warn(`Item reference ${itemToRestock.reference} not found. Re-creating.`);
            itemsToAdd.push({
                reference: itemToRestock.reference,
                name: itemToRestock.description,
                quantity: itemToRestock.quantity,
                price: itemToRestock.unitPrice,
                purchaseDate: new Date().toISOString().split('T')[0]
            });
        }
    }

    // Phase 3: Execute all writes in a single transaction
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([INVOICES_STORE_NAME, INVENTORY_STORE_NAME], 'readwrite');
        const invoiceStore = transaction.objectStore(INVOICES_STORE_NAME);
        const inventoryStore = transaction.objectStore(INVENTORY_STORE_NAME);

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject((event.target as IDBRequest).error);

        itemsToUpdate.forEach(item => inventoryStore.put(item));
        itemsToAdd.forEach(item => inventoryStore.add(item));
        invoiceStore.delete(invoiceId);
    });
};


export const clearAllInvoicesAndRestock = async (): Promise<void> => {
    // Phase 1: Read all necessary data
    const [allInvoices, allInventory] = await Promise.all([
        getAllInvoices(),
        getAllInventoryItems()
    ]);

    if (allInvoices.length === 0) {
        return; // Nothing to do
    }

    // Phase 2: Prepare updates in memory
    const inventoryMap = new Map<string, InventoryItem>(allInventory.map(item => [item.reference, item]));
    const itemDetails: { [ref: string]: { description: string; unitPrice: number } } = {};
    const itemQuantitiesToRestock: { [ref: string]: number } = {};

    for (const invoice of allInvoices) {
        for (const item of invoice.items) {
            itemQuantitiesToRestock[item.reference] = (itemQuantitiesToRestock[item.reference] || 0) + item.quantity;
            if (!itemDetails[item.reference]) {
                itemDetails[item.reference] = { description: item.description, unitPrice: item.unitPrice };
            }
        }
    }

    const itemsToUpdate: InventoryItem[] = [];
    const itemsToAdd: Omit<InventoryItem, 'id'>[] = [];

    for (const ref in itemQuantitiesToRestock) {
        const existingItem = inventoryMap.get(ref);
        if (existingItem) {
            existingItem.quantity += itemQuantitiesToRestock[ref];
            itemsToUpdate.push(existingItem);
        } else {
            const details = itemDetails[ref];
            itemsToAdd.push({
                reference: ref,
                name: details.description,
                quantity: itemQuantitiesToRestock[ref],
                price: details.unitPrice,
                purchaseDate: new Date().toISOString().split('T')[0]
            });
        }
    }

    // Phase 3: Execute all writes in a single transaction
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([INVOICES_STORE_NAME, INVENTORY_STORE_NAME], 'readwrite');
        const invoiceStore = transaction.objectStore(INVOICES_STORE_NAME);
        const inventoryStore = transaction.objectStore(INVENTORY_STORE_NAME);

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject((event.target as IDBRequest).error);

        itemsToUpdate.forEach(item => inventoryStore.put(item));
        itemsToAdd.forEach(item => inventoryStore.add(item));
        invoiceStore.clear();
    });
};
