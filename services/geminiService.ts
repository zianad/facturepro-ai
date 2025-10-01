import { GoogleGenAI, Type } from "@google/genai";
import { InventoryItem, SuggestedItem } from '../types';

// Singleton instance of the GoogleGenAI client.
let aiInstance: GoogleGenAI | null = null;

/**
 * Lazily initializes and returns the GoogleGenAI client.
 * Throws a user-friendly error if the API key is not configured.
 */
const getAiClient = (): GoogleGenAI => {
    if (aiInstance) {
        return aiInstance;
    }

    // Safely access the API key from either Vite's `import.meta.env` (for production/Vercel)
    // or from `window.process.env` (for local development via env.js).
    const apiKey = (import.meta as any).env?.VITE_API_KEY || (window as any).process?.env?.VITE_API_KEY;

    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
        throw new Error(
            "Gemini API key not configured. Please create `env.js` from `env.example.js` and add your key."
        );
    }

    aiInstance = new GoogleGenAI({ apiKey });
    return aiInstance;
};

/**
 * Parses the text content of an inventory file (e.g., CSV, TXT) using Gemini
 * to extract a structured list of inventory items.
 * @param fileContent The string content of the file.
 * @returns A promise that resolves to an array of inventory items.
 */
export const parseInventoryFile = async (fileContent: string): Promise<Omit<InventoryItem, 'id'>[]> => {
  const model = 'gemini-2.5-flash';
  const ai = getAiClient(); // Get client on-demand

  const prompt = `
    Parse the following inventory data, which is in CSV or a similar plain text format.
    The data contains columns for reference/ID, item name/description, quantity, unit price, and purchase date.
    Column headers might be in French (e.g., REFERENCE, DESIGNATION, QUANTITE, PRIX UNITAIRE, DATE D'ACHAT) or English.
    - Extract the reference, name, quantity, price, and purchase date for each item.
    - Prices might use a comma as a decimal separator; convert it to a period.
    - Quantities and prices must be numbers.
    - If a purchase date is missing or invalid, use today's date in YYYY-MM-DD format.
    - Return the data strictly as a JSON array of objects.
    
    Inventory Data:
    ---
    ${fileContent}
    ---
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              reference: { type: Type.STRING, description: 'The item reference code.' },
              name: { type: Type.STRING, description: 'The name or description of the item.' },
              quantity: { type: Type.INTEGER, description: 'The available quantity of the item.' },
              price: { type: Type.NUMBER, description: 'The unit price of the item.' },
              purchaseDate: { type: Type.STRING, description: 'The purchase date in YYYY-MM-DD format.' },
            },
            required: ['reference', 'name', 'quantity', 'price', 'purchaseDate'],
          },
        },
      },
    });

    const jsonString = response.text.trim();
    const parsedItems = JSON.parse(jsonString);

    if (!Array.isArray(parsedItems)) {
      console.error("Parsed data is not an array:", parsedItems);
      throw new Error("Failed to parse inventory file: AI response was not a valid array.");
    }
    
    return parsedItems.map(item => ({
      reference: String(item.reference || ''),
      name: String(item.name || 'N/A'),
      quantity: Number(item.quantity) || 0,
      price: Number(item.price) || 0,
      purchaseDate: item.purchaseDate || new Date().toISOString().split('T')[0]
    }));

  } catch (error) {
    console.error('Error parsing inventory file with Gemini:', error);
    // Re-throw the specific error from getAiClient or a generic one.
    if (error instanceof Error && error.message.startsWith("Gemini API key")) {
        throw error;
    }
    if (error instanceof SyntaxError) {
        throw new Error('Failed to parse the AI response. The format was invalid.');
    }
    throw new Error('An error occurred while communicating with the AI service to parse the file.');
  }
};

/**
 * Suggests a combination of inventory items that add up to a target total value.
 * @param targetTotal The desired total amount for the invoice.
 * @param inventory A list of available inventory items.
 * @returns A promise that resolves to an array of suggested items with their quantities.
 */
export const suggestInvoiceItemsForTotal = async (targetTotal: number, inventory: InventoryItem[]): Promise<SuggestedItem[]> => {
    const model = 'gemini-2.5-flash';
    const ai = getAiClient();

    // Prepare a simplified list of inventory for the prompt to save tokens and improve focus.
    const inventoryForPrompt = inventory
        .filter(item => item.quantity > 0 && item.price > 0)
        .map(({ id, name, quantity, price }) => ({ id, name, quantity, price }));

    if (inventoryForPrompt.length === 0) {
        throw new Error("Inventory is empty or items have no price/quantity.");
    }
    
    const prompt = `
      From the following list of available inventory items, select a combination of items and their quantities
      whose total price (item.price * quantity) is as close as possible to the target amount of ${targetTotal}.

      Constraints:
      1.  The quantity for any selected item must NOT exceed its available quantity in stock.
      2.  The goal is to reach the target total. You can be slightly under or over, but aim for the closest possible sum.
      3.  Prioritize using a variety of items if possible, but accuracy to the total is most important.
      4.  If the target total is too small or large to be met, return an empty array.
      5.  Return ONLY a JSON array of objects, where each object contains the item 'id' (as a number) and the 'quantity' (as a number) to be included in the invoice.
      
      Inventory List:
      ---
      ${JSON.stringify(inventoryForPrompt, null, 2)}
      ---
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.INTEGER, description: "The unique ID of the inventory item." },
                            quantity: { type: Type.INTEGER, description: "The quantity of this item to include." }
                        },
                        required: ['id', 'quantity']
                    }
                }
            }
        });
        
        const jsonString = response.text.trim();
        const suggestedItems = JSON.parse(jsonString);

        if (!Array.isArray(suggestedItems)) {
            throw new Error("AI response was not a valid array.");
        }

        return suggestedItems as SuggestedItem[];

    } catch (error) {
        console.error('Error suggesting invoice items with Gemini:', error);
        if (error instanceof Error && error.message.startsWith("Gemini API key")) {
            throw error;
        }
        if (error instanceof SyntaxError) {
            throw new Error('Failed to parse the AI response for suggested items. The format was invalid.');
        }
        throw new Error('An error occurred while communicating with the AI service to create the invoice.');
    }
};