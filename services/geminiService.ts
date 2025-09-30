
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

    // The API key is expected to be available in the execution environment.
    // For local development, this is polyfilled by `env.js`.
    const apiKey = (window as any).process?.env?.API_KEY;

    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
        throw new Error(
            "Gemini API key not configured. Please ensure the API_KEY environment variable is set."
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
 * Suggests a combination of inventory items to match a target total invoice amount (pre-tax).
 * @param inventory The available list of inventory items.
 * @param targetTotal The target invoice total (HT - hors taxes).
 * @returns A promise that resolves to an array of suggested items with their IDs and quantities.
 */
export const suggestInvoiceItemsForTotal = async (
  inventory: InventoryItem[],
  targetTotal: number
): Promise<SuggestedItem[]> => {
  const model = 'gemini-2.5-flash';
  const ai = getAiClient(); // Get client on-demand

  const inventoryForPrompt = inventory
    .filter(item => item.quantity > 0)
    .map(({ id, name, price, quantity }) => ({ id, name, price, quantity }));

  if (inventoryForPrompt.length === 0) {
      return [];
  }

  const prompt = `
    You are an expert system for generating invoices. Your task is to select a combination of items from the provided inventory list to create an invoice that totals as close as possible to a target amount, without exceeding it.

    Rules:
    - You MUST strictly respect the available 'quantity' for each item. You cannot suggest more than what is available.
    - The goal is to reach a total value as close as possible to ${targetTotal}, but not over.
    - To make invoices more realistic, prioritize using a variety of items and quantities greater than two, ideally more than ten if possible, rather than many items with a quantity of one.
    - The result MUST be a JSON array of objects, where each object contains an 'id' and a 'quantity'.
    - If the inventory is empty or no combination can be made to approach the target total, return an empty array.

    Here is the available inventory in JSON format:
    ---
    ${JSON.stringify(inventoryForPrompt)}
    ---

    Target Invoice Total (before tax): ${targetTotal}
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
              id: { type: Type.INTEGER },
              quantity: { type: Type.INTEGER },
            },
            required: ['id', 'quantity'],
          },
        },
      },
    });

    const jsonString = response.text.trim();
    const suggestions = JSON.parse(jsonString);
    
    if (!Array.isArray(suggestions)) {
      console.error("Suggestions data is not an array:", suggestions);
      throw new Error("Failed to suggest items: AI response was not a valid array.");
    }

    return suggestions
        .map(s => ({
            id: Number(s.id),
            quantity: Number(s.quantity)
        }))
        .filter(s => s.id > 0 && s.quantity > 0);

  } catch (error) {
    console.error('Error suggesting invoice items with Gemini:', error);
    // Re-throw the specific error from getAiClient or a generic one.
    if (error instanceof Error && error.message.startsWith("Gemini API key")) {
        throw error;
    }
    if (error instanceof SyntaxError) {
        throw new Error('Failed to parse the AI response. The format was invalid.');
    }
    throw new Error('An error occurred while communicating with the AI service to suggest items.');
  }
};
