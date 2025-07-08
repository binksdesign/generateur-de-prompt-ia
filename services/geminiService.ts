
import { PromptData, PromptPartKey, PromptSegmentData, ApiConfig } from './types';

const SITE_URL = "https://prompt-generator.app"; // Optional: Your app's URL for OpenRouter rankings
const SITE_NAME = "Générateur de Prompt IA";   // Optional: Your app's name for OpenRouter rankings

const FREE_MODEL_ID = "mistralai/mistral-small-3.2-24b-instruct:free";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
    });
};

const parseJsonResponse = <T,>(text: string): T | null => {
    let jsonStr = text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
        jsonStr = match[2].trim();
    }
    try {
        return JSON.parse(jsonStr) as T;
    } catch (e) {
        console.error("Failed to parse JSON response:", e, "Original text:", text);
        return null;
    }
};

const isValidPromptData = (data: any, originalData: PromptData): data is PromptData => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return false;
    }
    const originalKeys = Object.keys(originalData);
    const newKeys = Object.keys(data);

    if (originalKeys.length !== newKeys.length || !originalKeys.every(key => newKeys.includes(key))) {
        console.error("Key mismatch between original and new prompt data.");
        return false;
    }

    for (const key of newKeys) {
        const segment = data[key];
        if (
            !segment ||
            typeof segment.valeur !== 'string' ||
            !Array.isArray(segment.alternatives) ||
            segment.alternatives.some((alt: any) => typeof alt !== 'string')
        ) {
            console.error(`Invalid structure for key ${key}:`, segment);
            return false;
        }
    }
    return true;
};

// More flexible validation for chat updates, allows adding/removing keys
const isValidChatPromptUpdate = (data: any): data is PromptData => {
     if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
        return false;
    }
     for (const key in data) {
        const segment = data[key];
        if (
            !segment ||
            typeof segment.valeur !== 'string' ||
            !Array.isArray(segment.alternatives) ||
            segment.alternatives.some((alt: any) => typeof alt !== 'string')
        ) {
             console.error(`Invalid structure for key ${key} in chat update:`, segment);
            return false;
        }
    }
    return true;
}


const fetchOpenRouter = async (url: string, body: object, apiKey: string) => {
    const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": SITE_URL,
        "X-Title": SITE_NAME,
        "Content-Type": "application/json"
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorBody = await response.json();
        console.error("OpenRouter API Error:", errorBody);
        throw new Error(`La requête API a échoué (statut ${response.status}). Vérifiez votre clé API ou le statut d'OpenRouter.`);
    }

    return response.json();
};

export const generatePromptAndAlternatives = async (config: ApiConfig, userInput: string, imageFile: File | null): Promise<PromptData | null> => {
    try {
        const systemInstruction = `Tu es un expert de renommée mondiale en rédaction de prompts pour les générateurs d'images IA (Midjourney, DALL-E, etc.). Ton but est de transformer l'idée de l'utilisateur, fournie sous forme de texte, d'image, ou les deux, en un prompt extrêmement riche, précis et visuellement évocateur, en utilisant un vocabulaire rarement employé.

**SI UNE IMAGE EST FOURNIE :**
- Analyse son contenu visuel (sujet, style, éclairage, composition, ambiance).
- Si du texte est aussi fourni, utilise-le comme une instruction pour guider ou affiner l'interprétation de l'image.
- Ta sortie DOIT se baser sur l'analyse de l'image.

**EXIGENCES CLÉS :**
1.  **Structure de sortie :** Réponds UNIQUEMENT avec un objet JSON. Ne renvoie AUCUN texte en dehors de cet objet JSON.
2.  **Format JSON :** L'objet doit contenir les clés : "sujet", "style", "éclairage", "composition", "détails".
3.  **Contenu des clés :** Pour chaque clé, la valeur doit être un objet JSON avec deux clés :
    - "valeur": Une chaîne de caractères en français qui constitue un segment du prompt.
    - "alternatives": Un tableau de 4 autres chaînes de caractères en français, qui sont des suggestions variées et créatives pour ce segment.
4.  **Qualité du contenu :**
    - **Vocabulaire :** Utilise une terminologie visuelle riche et technique (ex: "lumières en clair-obscur", "dégradés anodisés", "brume volumétrique", "reflets rétrofuturistes", "diffusion sous la surface").
    - **Style photographique :** Si l'idée s'y prête, sois très spécifique sur le style (ex: "Photographie éditoriale", "Plan cinématographique", "Photographie de produit", "Style documentaire").
    - **Mockups :** Si l'utilisateur demande un mockup (ex: un t-shirt), utilise la formule "Full blank [objet]" dans la valeur du sujet. N'utilise JAMAIS le mot "mockup".
    - **Exhaustivité :** Assure-toi que les différentes parties couvrent le sujet, le décor, l'angle, la palette de couleurs, l'éclairage et les textures.`;
        
        const userContent: any[] = [];
        let textPrompt = "";

        if (imageFile) {
             textPrompt = userInput.trim()
                ? `En te basant sur l'image fournie, génère un prompt structuré qui incorpore l'idée suivante : "${userInput.trim()}".`
                : "Analyse l'image fournie et génère un prompt structuré détaillé qui capture son essence.";
            const dataUrl = await fileToDataUrl(imageFile);
            userContent.push({ type: "image_url", image_url: { url: dataUrl } });
        } else {
             textPrompt = `Développe cette idée simple en un prompt structuré pour un générateur d'images : "${userInput.trim()}"`;
        }
        
        userContent.unshift({ type: "text", text: textPrompt });
        
        const requestBody: any = {
            model: config.model,
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: userContent }
            ]
        };
        
        if (config.model !== FREE_MODEL_ID) {
            requestBody.response_format = { type: "json_object" };
        }
        
        const data = await fetchOpenRouter(OPENROUTER_CHAT_URL, requestBody, config.apiKey);
        
        const text = data.choices[0].message.content;
        const parsedData = parseJsonResponse<PromptData>(text);
        
        if (!parsedData || Object.keys(parsedData).length < 5) {
             console.error("Invalid JSON structure received from API.", parsedData);
             return null;
        }
        for (const key in parsedData) {
            const part = parsedData[key as PromptPartKey];
            if (!part || typeof part.valeur !== 'string' || !Array.isArray(part.alternatives)) {
                console.error(`Invalid segment for key ${key}:`, part);
                return null;
            }
        }
        return parsedData;

    } catch (error) {
        console.error("Error generating initial prompt:", error);
        throw error;
    }
};

export const getAlternatives = async (config: ApiConfig, category: string, value: string): Promise<string[] | null> => {
    try {
        const systemInstruction = `Tu es un assistant créatif expert en vocabulaire visuel pour l'IA générative. Basé sur la catégorie et la valeur fournies, génère 4 alternatives créatives et techniquement précises. Utilise un vocabulaire riche et évocateur (ex: "lumières en clair-obscur", "brume volumétrique", "style cinématique"). Réponds UNIQUEMENT avec un objet JSON contenant la clé "alternatives", qui est un tableau de 4 chaînes de caractères en français. Ne fournis aucun texte ou formatage supplémentaire.`;
        const userMessage = `Catégorie : "${category}", Valeur actuelle : "${value}"`;

        const requestBody: any = {
            model: config.model,
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: userMessage }
            ],
        };
        if (config.model !== FREE_MODEL_ID) {
            requestBody.response_format = { type: "json_object" };
        }
        
        const data = await fetchOpenRouter(OPENROUTER_CHAT_URL, requestBody, config.apiKey);
        
        const text = data.choices[0].message.content;
        const parsedData = parseJsonResponse<{ alternatives: string[] }>(text);
        return parsedData ? parsedData.alternatives : null;

    } catch (error) {
        console.error("Error getting alternatives:", error);
        return null;
    }
};


export const generateCustomAlternatives = async (config: ApiConfig, category: string, userQuery: string, existingAlternatives: string[]): Promise<string[] | null> => {
    try {
        const systemInstruction = `Tu es un assistant créatif expert en vocabulaire visuel pour l'IA générative. Réponds UNIQUEMENT avec un objet JSON contenant la clé "alternatives", qui est un tableau de 4 chaînes de caractères en français. Ne fournis aucun texte ou formatage supplémentaire.`;
        const userMessage = `Pour la catégorie de prompt "${category}", génère 4 nouvelles suggestions alternatives basées sur la requête utilisateur suivante : "${userQuery}". Utilise un vocabulaire riche et évocateur. Évite de répéter les suggestions existantes suivantes : ${JSON.stringify(existingAlternatives)}.`;
        
        const requestBody: any = {
            model: config.model,
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: userMessage }
            ],
        };
        if (config.model !== FREE_MODEL_ID) {
            requestBody.response_format = { type: "json_object" };
        }
        
        const data = await fetchOpenRouter(OPENROUTER_CHAT_URL, requestBody, config.apiKey);

        const text = data.choices[0].message.content;
        const parsedData = parseJsonResponse<{ alternatives: string[] }>(text);
        return parsedData ? parsedData.alternatives : null;

    } catch (error) {
        console.error("Error getting custom alternatives:", error);
        return null;
    }
};

export const improveFullPrompt = async (config: ApiConfig, currentPrompt: PromptData): Promise<PromptData | null> => {
    try {
        const systemInstruction = `Tu es un expert en art et en rédaction de prompts. Ta tâche est de réécrire et d'enrichir le prompt JSON fourni.
1.  **Conserve la structure :** Le JSON de sortie doit avoir exactement les mêmes clés que le JSON d'entrée.
2.  **Conserve les sous-structures :** Chaque clé doit pointer vers un objet avec "valeur" (string) et "alternatives" (array of 4 strings).
3.  **Améliore le contenu :** Remplace les chaînes de "valeur" par des versions plus évocatrices. Génère 4 nouvelles "alternatives" pour chaque catégorie, en lien avec la nouvelle "valeur".
4.  **Format de sortie :** Réponds UNIQUEMENT avec l'objet JSON complet. Pas de texte avant, pas de texte après, pas de markdown \`\`\`json.
5.  **ORDRE DES CLÉS :** Le JSON de sortie doit impérativement conserver le MÊME ORDRE de clés que le JSON d'entrée.`;
        const userMessage = `Voici un prompt structuré pour un générateur d'images. Améliore-le en le rendant plus créatif, détaillé et poétique, tout en respectant scrupuleusement sa structure JSON d'origine. Prompt actuel : ${JSON.stringify(currentPrompt)}`;
        
        const requestBody: any = {
            model: config.model,
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: userMessage }
            ],
        };
        if (config.model !== FREE_MODEL_ID) {
            requestBody.response_format = { type: "json_object" };
        }
        
        const data = await fetchOpenRouter(OPENROUTER_CHAT_URL, requestBody, config.apiKey);

        const text = data.choices[0].message.content;
        const parsedData = parseJsonResponse<PromptData>(text);
        if (!isValidPromptData(parsedData, currentPrompt)) {
            console.error("Invalid JSON structure received from improveFullPrompt API.", parsedData);
            return null;
        }
        return parsedData;

    } catch (error) {
        console.error("Error improving full prompt:", error);
        return null;
    }
};

export const editFullPromptWithQuery = async (config: ApiConfig, currentPrompt: PromptData, userQuery: string): Promise<PromptData | null> => {
    try {
        const systemInstruction = `Tu es un expert en rédaction de prompts. Modifie le prompt JSON fourni en suivant l'instruction de l'utilisateur.
1.  **Applique la modification :** Applique l'instruction de manière cohérente à toutes les parties pertinentes du prompt.
2.  **Conserve la structure :** Le JSON de sortie doit avoir exactement les mêmes clés que le JSON d'entrée.
3.  **Mets à jour le contenu :** Change les "valeur" pour refléter la demande. Génère 4 nouvelles "alternatives" pertinentes pour chaque catégorie modifiée.
4.  **Format de sortie :** Réponds UNIQUEMENT avec l'objet JSON complet. Pas de texte, pas de markdown.
5.  **ORDRE DES CLÉS :** Le JSON de sortie doit impérativement conserver le MÊME ORDRE de clés que le JSON d'entrée.`;
        const userMessage = `Instruction de l'utilisateur : "${userQuery}". Prompt JSON à modifier : ${JSON.stringify(currentPrompt)}`;
        
        const requestBody: any = {
            model: config.model,
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: userMessage }
            ],
        };
        if (config.model !== FREE_MODEL_ID) {
            requestBody.response_format = { type: "json_object" };
        }
        
        const data = await fetchOpenRouter(OPENROUTER_CHAT_URL, requestBody, config.apiKey);
        
        const text = data.choices[0].message.content;
        const parsedData = parseJsonResponse<PromptData>(text);
         if (!isValidPromptData(parsedData, currentPrompt)) {
            console.error("Invalid JSON structure received from editFullPromptWithQuery API.", parsedData);
            return null;
        }
        return parsedData;

    } catch (error) {
        console.error("Error editing full prompt with query:", error);
        return null;
    }
};


export const translateToEnglish = async (config: ApiConfig, text: string): Promise<string | null> => {
    try {
        const systemInstruction = "Tu es un traducteur expert. Traduis le texte donné du français vers l'anglais. Réponds UNIQUEMENT avec la traduction anglaise, rien d'autre.";
        
        const data = await fetchOpenRouter(OPENROUTER_CHAT_URL, {
            model: config.model,
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: text }
            ]
        }, config.apiKey);

        return data.choices[0].message.content.trim();
    } catch (error) {
        console.error("Error translating text:", error);
        return null;
    }
};

export const generateNewPart = async (config: ApiConfig, currentPrompt: PromptData, newPartName: string): Promise<PromptSegmentData | null> => {
    try {
        const systemInstruction = `Tu es un expert en rédaction de prompts. Ta tâche est de créer un segment de prompt pour une nouvelle catégorie.
1.  **Analyse le prompt existant** pour comprendre le contexte global.
2.  **Génère du contenu pertinent** pour la nouvelle catégorie demandée.
3.  **Structure de sortie :** Réponds UNIQUEMENT avec un objet JSON. Ne renvoie AUCUN texte en dehors de cet objet.
4.  **Format JSON :** L'objet doit contenir deux clés :
    - "valeur": Une chaîne de caractères en français qui constitue le segment du prompt.
    - "alternatives": Un tableau de 4 autres chaînes de caractères en français, qui sont des suggestions variées et créatives.
5.  **Pas de Markdown :** Le JSON ne doit pas être enveloppé dans des blocs de code \`\`\`json.`;
        
        const userMessage = `Prompt structuré actuel : ${JSON.stringify(currentPrompt)}.
            L'utilisateur souhaite ajouter une nouvelle catégorie nommée : "${newPartName}".
            Génère une valeur pertinente et 4 alternatives pour cette nouvelle catégorie, en cohérence avec le reste du prompt.`;

        const requestBody: any = {
            model: config.model,
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: userMessage }
            ]
        };
        if (config.model !== FREE_MODEL_ID) {
            requestBody.response_format = { type: "json_object" };
        }
        
        const data = await fetchOpenRouter(OPENROUTER_CHAT_URL, requestBody, config.apiKey);
        
        const text = data.choices[0].message.content;
        const parsedData = parseJsonResponse<PromptSegmentData>(text);
        
        if (!parsedData || typeof parsedData.valeur !== 'string' || !Array.isArray(parsedData.alternatives)) {
            console.error("Invalid JSON structure received from generateNewPart API.", parsedData);
            return null;
        }

        return parsedData;

    } catch (error) {
        console.error("Error generating new prompt part:", error);
        return null;
    }
};

export const continueChat = async (config: ApiConfig, apiMessages: any[], systemInstruction: string): Promise<string | PromptData | null> => {
    try {
        const requestMessages = [{ role: 'system', content: systemInstruction }, ...apiMessages];

        const requestBody: any = {
            model: config.model,
            messages: requestMessages,
        };

        const data = await fetchOpenRouter(OPENROUTER_CHAT_URL, requestBody, config.apiKey);
        const textResponse = data.choices[0].message.content;

        const potentialJson = parseJsonResponse<PromptData>(textResponse);
        // Important: check if the parsed data is a valid prompt structure.
        // This prevents normal JSON in conversation from being misinterpreted as a prompt update.
        if (potentialJson && isValidChatPromptUpdate(potentialJson)) {
            return potentialJson;
        }

        return textResponse.trim();
    } catch (error) {
        console.error("Error in chat continuation:", error);
        throw error;
    }
};
