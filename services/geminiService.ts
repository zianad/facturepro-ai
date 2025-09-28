import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedInvoiceData, InventoryItem, SuggestedItem } from '../types';

// FIX: Switched to `process.env.API_KEY` to align with the provided guidelines for accessing the API key. This resolves the TypeScript error for `import.meta.env`.
const apiKey = process.env.API_KEY;

if (!apiKey) {
  // FIX: Updated the error message to reflect the change to `API_KEY`.
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey });

const invoiceSchema = {
  type: Type.OBJECT,
  properties: {
    invoiceNumber: { type: Type.STRING, description: "The invoice number or ID." },
    vendorName: { type: Type.STRING, description: "The name of the vendor or company." },
    invoiceDate: { type: Type.STRING, description: "The date of the invoice in YYYY-MM-DD format." },
    totalAmount: { type: Type.NUMBER, description: "The final total amount of the invoice." },
    items: {
      type: Type.ARRAY,
      description: "List of all items in the invoice.",
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING, description: "Description of the item." },
          quantity: { type: Type.NUMBER, description: "Quantity of the item." },
          unitPrice: { type: Type.NUMBER, description: "Price per unit of the item." },
          total: { type: Type.NUMBER, description: "Total price for this line item." },
        },
        required: ["description", "quantity", "unitPrice", "total"],
      },
    },
  },
  required: ["invoiceNumber", "vendorName", "invoiceDate", "totalAmount", "items"],
};

export const analyzeInvoiceImage = async (base64Image: string, mimeType: string): Promise<ExtractedInvoiceData> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: `Analyze the following invoice image and extract the key information. Provide the response as a JSON object that strictly follows the provided schema.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: invoiceSchema,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error analyzing invoice with Gemini API:", error);
    if (error instanceof Error && error.message.includes("xhr error")) {
        throw new Error("A network error occurred while analyzing the invoice. Please check your connection and try again.");
    }
    if (error instanceof Error) {
        throw new Error(`Failed to analyze invoice: ${error.message}`);
    }
    throw new Error("An unknown error occurred during invoice analysis.");
  }
};

const inventoryFileSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            reference: { type: Type.STRING, description: "The item's reference code or SKU. Can be alphanumeric." },
            name: { type: Type.STRING, description: "The name or designation of the item." },
            quantity: { type: Type.NUMBER, description: "The quantity of the item." },
            price: { type: Type.NUMBER, description: "The unit price of the item." },
            purchaseDate: { type: Type.STRING, description: "The date of purchase in YYYY-MM-DD format." },
        },
        required: ["reference", "name", "quantity", "price", "purchaseDate"]
    }
};

export const parseInventoryFile = async (fileContent: string): Promise<Omit<InventoryItem, 'id'>[]> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: `Parse the following inventory data, which could be in CSV or a similar text format. The data is provided in the next part. Extract the list of items according to the provided JSON schema. The column names in the text might be different (e.g., 'DESIGNATION' for name, 'PRIX UNITAIRE' for price), so interpret them correctly. Ensure the purchase date is in YYYY-MM-DD format.` },
                    { text: fileContent }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: inventoryFileSchema,
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error parsing inventory file with Gemini API:", error);
        if (error instanceof Error && error.message.includes("xhr error")) {
            throw new Error("A network error occurred while parsing the file with the AI service. This can happen with large files or network issues. Please check your connection and try again.");
        }
        if (error instanceof Error) {
            throw new Error(`Failed to parse file: ${error.message}`);
        }
        throw new Error("An unknown error occurred during file parsing.");
    }
};

export const analyzeInventoryData = async (inventory: InventoryItem[]): Promise<string> => {
  try {
    if (inventory.length === 0) {
      return "The inventory is currently empty. Add some items to get an analysis.";
    }
    const inventorySummary = inventory.map(item => 
      `- ${item.name} (Ref: ${item.reference}): ${item.quantity} units at $${item.price.toFixed(2)} each, purchased on ${item.purchaseDate}`
    ).join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze the following inventory data. Provide a brief summary of the overall stock health, identify any items that are low in stock (quantity less than 10), and suggest which items should be reordered soon. Be concise and format the response for readability.\n\nInventory:\n${inventorySummary}`,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error analyzing inventory with Gemini API:", error);
    if (error instanceof Error && error.message.includes("xhr error")) {
        throw new Error("A network error occurred while analyzing inventory. Please check your connection and try again.");
    }
    if (error instanceof Error) {
        throw new Error(`Failed to analyze inventory: ${error.message}`);
    }
    throw new Error("An unknown error occurred during inventory analysis.");
  }
};

const suggestedItemsSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.NUMBER, description: "The unique ID of the suggested inventory item." },
      quantity: { type: Type.NUMBER, description: "The quantity of this item to include in the invoice." },
    },
    required: ["id", "quantity"],
  },
};

export const suggestInvoiceItemsForTotal = async (inventory: InventoryItem[], total: number): Promise<SuggestedItem[]> => {
  try {
    if (inventory.length === 0) {
      return [];
    }
    const inventoryForPrompt = JSON.stringify(inventory.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })));
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `From the following inventory list, select a combination of items whose total price is as close as possible to the target amount of ${total}. The difference should be minimal. When selecting items, you must follow these rules: 1. Diversify the selection by including multiple different products. 2. The quantity for each selected item should ideally be more than 10 units and must not be 1 or 2. 3. The total quantity of any selected item must not exceed its available quantity in the inventory. Prioritize getting as close to the target total as possible while respecting these rules. Available items (with their ID, name, price, and available quantity): ${inventoryForPrompt}. Provide the response as a JSON object that strictly follows the provided schema. If no combination is reasonably close while following the rules, return an empty array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: suggestedItemsSchema,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error suggesting invoice items with Gemini API:", error);
    if (error instanceof Error && error.message.includes("xhr error")) {
        throw new Error("A network error occurred while generating the invoice. Please check your connection and try again.");
    }
    if (error instanceof Error) {
        throw new Error(`Failed to suggest items: ${error.message}`);
    }
    throw new Error("An unknown error occurred while suggesting invoice items.");
  }
};