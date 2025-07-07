

import React, { useState, useCallback, useRef, DragEvent, useEffect } from 'react';
import { PromptData, PromptPartKey, ApiConfig, ChatMessage } from './types';
import { 
    generatePromptAndAlternatives, 
    getAlternatives, 
    translateToEnglish, 
    generateCustomAlternatives,
    improveFullPrompt,
    editFullPromptWithQuery,
    generateNewPart,
    continueChat,
} from './services/geminiService';
import { SidePanel } from './components/PromptPart';
import { ApiSetupPanel } from './components/ApiSetupPanel';
import { Chatbot } from './components/Chatbot';


const Header: React.FC<{ onStartOver: () => void; hasPrompt: boolean; onShowSettings: () => void; onShowChatbot: () => void; }> = ({ onStartOver, hasPrompt, onShowSettings, onShowChatbot }) => {
    const handleGeneratorClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (hasPrompt) {
            onStartOver();
        }
    };

    return (
        <header className="bg-[#D7FE40] text-black w-full py-3 px-4 sm:px-8 shadow-lg fixed top-0 left-0 z-50">
            <nav className="max-w-7xl mx-auto flex justify-between items-center">
                 <div className="flex justify-center items-center gap-2 sm:gap-4 flex-grow">
                    <a 
                        href="#" 
                        onClick={handleGeneratorClick}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full hover:bg-black/10 transition-colors"
                    >
                        <i className="fa-solid fa-wand-magic-sparkles text-lg"></i>
                        <span className="font-bold text-base sm:text-lg hidden sm:inline">Générateur</span>
                    </a>
                    <a 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); onShowChatbot(); }}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full hover:bg-black/10 transition-colors"
                    >
                        <i className="fa-solid fa-comments text-lg"></i>
                        <span className="font-bold text-base sm:text-lg hidden sm:inline">Chatbot</span>
                    </a>
                    <a 
                        href="https://graphistedubinks.gumroad.com/" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full hover:bg-black/10 transition-colors"
                    >
                         <i className="fa-solid fa-palette text-lg"></i>
                        <span className="font-bold text-base sm:text-lg hidden sm:inline">Ressources</span>
                    </a>
                </div>
                <button onClick={onShowSettings} className="text-black hover:bg-black/10 h-10 w-10 flex items-center justify-center rounded-full transition-colors" aria-label="Paramètres API">
                    <i className="fa-solid fa-gear text-xl"></i>
                </button>
            </nav>
        </header>
    );
};


const DropIndicator = () => <div className="h-1.5 w-full bg-[#D7FE40] rounded-full my-2 transition-all shadow-[0_0_10px_#D7FE40]" />;
const LoadingSpinner: React.FC<{className?: string}> = ({className = ''}) => (
    <div className={`animate-spin rounded-full h-5 w-5 border-b-2 ${className}`}></div>
);

// Animated showcase for the welcome screen
const PromptShowcase: React.FC = () => {
    const examplePrompt = {
        sujet: 'Photographie produit d\'une montre de luxe sur un rocher volcanique',
        style: 'Style éditorial, macro photographie, couleurs contrastées',
        éclairage: 'Lumière naturelle dure, ombres profondes, reflets nets sur le métal',
        composition: 'Règle des tiers, focus sur le cadran, arrière-plan texturé',
        détails: 'Grains de la roche visibles, micro-rayures sur le fermoir, condensation subtile'
    };
    const promptKeys = Object.keys(examplePrompt) as (keyof typeof examplePrompt)[];
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex(prev => (prev + 1) % promptKeys.length);
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-black/20 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-xl h-full flex flex-col justify-center">
            <h3 className="text-center text-lg font-bold text-gray-300 mb-6 tracking-wider uppercase">Exemple de Prompt</h3>
            <div className="space-y-4">
                {promptKeys.map((key, index) => (
                    <div key={key} className={`transition-all duration-700 ${activeIndex === index ? 'opacity-100' : 'opacity-50'}`}>
                        <p className="text-xs text-[#D7FE40] font-bold uppercase tracking-widest">{key}</p>
                        <p className={`text-gray-200 pl-3 border-l-2 transition-all duration-300 ${activeIndex === index ? 'border-[#D7FE40] text-shadow' : 'border-gray-600'}`}>
                            {examplePrompt[key]}
                        </p>
                    </div>
                ))}
            </div>
             <style>{`.text-shadow { text-shadow: 0 0 8px rgba(215, 254, 64, 0.5); }`}</style>
        </div>
    );
};


const App: React.FC = () => {
    const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    
    const [userInput, setUserInput] = useState<string>('');
    const [promptData, setPromptData] = useState<PromptData | null>(null);
    const [promptOrder, setPromptOrder] = useState<PromptPartKey[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isTranslating, setIsTranslating] = useState<boolean>(false);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    
    const [activePanelKey, setActivePanelKey] = useState<PromptPartKey | null>(null);
    const [isSidePanelLoading, setIsSidePanelLoading] = useState<boolean>(false);

    const [isModifying, setIsModifying] = useState<boolean>(false);
    const [fullPromptQuery, setFullPromptQuery] = useState<string>('');
    
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isAddingField, setIsAddingField] = useState(false);
    const [newFieldKey, setNewFieldKey] = useState('');
    const [isAddingFieldLoading, setIsAddingFieldLoading] = useState(false);
    const [addFieldError, setAddFieldError] = useState('');
    
    const [showChatbot, setShowChatbot] = useState(false);
    const [chatbotContext, setChatbotContext] = useState<PromptData | null>(null);


    const dragItem = useRef<number | null>(null);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dropIndicator, setDropIndicator] = useState<number | null>(null);

    const isAppBusy = isLoading || isModifying || isAddingFieldLoading || showChatbot;

    useEffect(() => {
        try {
            const savedConfigStr = localStorage.getItem('apiConfig');
            if (savedConfigStr) {
                const parsedConfig = JSON.parse(savedConfigStr);
                // Migration from old format
                if (parsedConfig.modelSelection) {
                    const newConfig: ApiConfig = {
                        apiKey: parsedConfig.apiKey,
                        model: parsedConfig.modelSelection === 'premium' 
                            ? "openai/gpt-4.1-mini" 
                            : "mistralai/mistral-small-3.2-24b-instruct:free"
                    };
                    setApiConfig(newConfig);
                    localStorage.setItem('apiConfig', JSON.stringify(newConfig));
                } else if (parsedConfig.apiKey && parsedConfig.model) {
                    setApiConfig(parsedConfig);
                }
            } else {
                setShowSettings(true); // Show settings on first visit
            }
        } catch (e) {
            console.error("Could not load API config from localStorage", e);
            setShowSettings(true);
        }
    }, []);

    const handleConfigured = (config: ApiConfig) => {
        setApiConfig(config);
        localStorage.setItem('apiConfig', JSON.stringify(config));
        setShowSettings(false);
        setError(null);
    };

    
    const handleStartOver = () => {
        setPromptData(null);
        setUserInput('');
        setError(null);
        handleRemoveImage();
        setIsAddingField(false);
        setNewFieldKey('');
        setAddFieldError('');
    };

    const getLabel = useCallback((key: PromptPartKey): string => {
        const defaultLabels: Record<string, string> = {
            sujet: 'Sujet',
            style: 'Style',
            éclairage: 'Éclairage',
            composition: 'Composition',
            détails: 'Détails',
        };
        const label = defaultLabels[key] || key;
        return label.charAt(0).toUpperCase() + label.slice(1);
    }, []);


    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (showChatbot) {
                    setShowChatbot(false);
                } else if (activePanelKey) {
                    setActivePanelKey(null);
                } else if (isAddingField) {
                    setIsAddingField(false);
                } else if (showSettings) {
                    if (apiConfig) { // only allow escape to close if a config is already set
                        setShowSettings(false);
                    }
                }
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
    
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [activePanelKey, isAddingField, showSettings, apiConfig, showChatbot]);
    
    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError("Veuillez sélectionner un fichier image valide (PNG, JPG, etc.).");
                return;
            }
            setImageFile(file);
            // Create a URL for preview
            const previewUrl = URL.createObjectURL(file);
            setImagePreviewUrl(previewUrl);
            setError(null);
        }
    };
    
    const handleRemoveImage = () => {
        setImageFile(null);
        if (imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl);
            setImagePreviewUrl(null);
        }
        // Also reset the file input so the same file can be re-selected
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleGenerate = async () => {
        if (!apiConfig) {
            setError('Veuillez configurer votre clé API avant de générer un prompt.');
            setShowSettings(true);
            return;
        }
        if (!userInput.trim() && !imageFile) {
            setError('Veuillez entrer une idée ou importer une image.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setPromptOrder([]);
        setActivePanelKey(null);
        
        try {
            const result = await generatePromptAndAlternatives(apiConfig, userInput, imageFile);
            if (result) {
                setPromptData(result);
                setPromptOrder(Object.keys(result) as PromptPartKey[]);
            } else {
                setError("Une erreur est survenue lors de la génération. Le modèle a peut-être renvoyé un format inattendu. Veuillez réessayer.");
                setPromptData(null);
            }
        } catch (e: any) {
            setError(e.message || "Une erreur inconnue est survenue.");
            setPromptData(null);
        }
        
        setIsLoading(false);
    };

    const handleUpdatePromptPart = useCallback((partKey: PromptPartKey, newValue: string) => {
        setPromptData(prevData => {
            if (!prevData) return null;
            return {
                ...prevData,
                [partKey]: {
                    ...prevData[partKey],
                    valeur: newValue,
                },
            };
        });
        setActivePanelKey(null);
    }, []);
    
    const handleRefreshAlternatives = useCallback(async (partKey: PromptPartKey) => {
        if (!promptData || !apiConfig) return;
        setIsSidePanelLoading(true);
        const category = getLabel(partKey);
        const value = promptData[partKey].valeur;
        const newAlternatives = await getAlternatives(apiConfig, category, value);
        if (newAlternatives) {
            setPromptData(prevData => {
                if (!prevData) return null;
                return {
                    ...prevData,
                    [partKey]: {
                        ...prevData[partKey],
                        alternatives: newAlternatives,
                    }
                }
            });
        }
        setIsSidePanelLoading(false);
    }, [promptData, apiConfig, getLabel]);

    const handleCustomQuery = useCallback(async (partKey: PromptPartKey, query: string) => {
        if (!promptData || !apiConfig) return;
        setIsSidePanelLoading(true);
        const category = getLabel(partKey);
        const existingAlternatives = promptData[partKey].alternatives;
        const newAlternatives = await generateCustomAlternatives(apiConfig, category, query, existingAlternatives);
        if (newAlternatives) {
             setPromptData(prevData => {
                if (!prevData) return null;
                return {
                    ...prevData,
                    [partKey]: {
                        ...prevData[partKey],
                        alternatives: newAlternatives,
                    }
                }
            });
        }
        setIsSidePanelLoading(false);

    }, [promptData, apiConfig, getLabel]);

    const handleApiModification = async (apiCall: Promise<PromptData | null>) => {
        setIsModifying(true);
        setError(null);
        const result = await apiCall;
        if (result) {
            setPromptData(result);
            // Don't change order if API doesn't guarantee it for custom fields
            const newOrder = Object.keys(result);
            setPromptOrder(currentOrder => newOrder.length === currentOrder.length ? currentOrder : newOrder);
        } else {
            setError("Une erreur est survenue lors de la mise à jour du prompt. Veuillez réessayer.");
        }
        setIsModifying(false);
    };

    const handleImprovePrompt = async () => {
        if (!promptData || !apiConfig) return;
        const orderedPromptData = promptOrder.reduce((obj, key) => {
            obj[key] = promptData[key];
            return obj;
        }, {} as PromptData);
        handleApiModification(improveFullPrompt(apiConfig, orderedPromptData));
    };

    const handleEditFullPrompt = async () => {
        if (!promptData || !fullPromptQuery.trim() || !apiConfig) return;
        const orderedPromptData = promptOrder.reduce((obj, key) => {
            obj[key] = promptData[key];
            return obj;
        }, {} as PromptData);
        handleApiModification(editFullPromptWithQuery(apiConfig, orderedPromptData, fullPromptQuery));
        setFullPromptQuery('');
    };
    
    const handleOpenChatbot = (context: PromptData | null) => {
        if (!apiConfig) {
            setShowSettings(true);
            return;
        }
        setChatbotContext(context);
        setShowChatbot(true);
    };

    const handleChatPromptUpdate = (newPromptData: PromptData) => {
        setPromptData(newPromptData);
        setPromptOrder(Object.keys(newPromptData));
    };

    const handleCopy = async () => {
        if (!promptData || !apiConfig) return;

        setIsTranslating(true);
        const fullPromptFrench = promptOrder
            .map(key => promptData[key].valeur)
            .join(', ');
        
        const translatedPrompt = await translateToEnglish(apiConfig, fullPromptFrench);
        setIsTranslating(false);

        if (translatedPrompt) {
            navigator.clipboard.writeText(translatedPrompt).then(() => {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2500);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                setError('Impossible de copier le texte dans le presse-papiers.');
            });
        } else {
            setError('La traduction a échoué. Impossible de copier.');
        }
    };
    

    const handleDragStart = (index: number) => {
        dragItem.current = index;
        setDraggedIndex(index);
    };

    const handleDragOverItem = (e: DragEvent<HTMLDivElement>, index: number) => {
        e.preventDefault();
        if (dragItem.current === index) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
            setDropIndicator(index);
        } else {
            setDropIndicator(index + 1);
        }
    }

    const handleDropContainer = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (dragItem.current === null || dropIndicator === null) return;

        if (dropIndicator === dragItem.current || dropIndicator === dragItem.current + 1) {
            handleDragEnd();
            return;
        }

        const newOrder = [...promptOrder];
        const draggedItemContent = newOrder.splice(dragItem.current, 1)[0];
        
        const adjustedIndex = dropIndicator > dragItem.current ? dropIndicator - 1 : dropIndicator;
        newOrder.splice(adjustedIndex, 0, draggedItemContent);
        
        setPromptOrder(newOrder);
        handleDragEnd();
    }

    const handleDragEnd = () => {
        dragItem.current = null;
        setDraggedIndex(null);
        setDropIndicator(null);
    };

    const handleConfirmAddField = async () => {
        if (!promptData || !newFieldKey.trim() || !apiConfig) return;

        const keyToAdd = newFieldKey.trim().toLowerCase().replace(/\s+/g, '_');
        if (promptOrder.includes(keyToAdd)) {
            setAddFieldError("Ce champ existe déjà. Veuillez choisir un autre nom.");
            return;
        }

        setIsAddingFieldLoading(true);
        setAddFieldError('');
        
        const newSegment = await generateNewPart(apiConfig, promptData, newFieldKey.trim());
        
        if (newSegment) {
            setPromptData(prev => ({...prev, [keyToAdd]: newSegment }));
            setPromptOrder(prev => [...prev, keyToAdd]);
            setNewFieldKey('');
            setIsAddingField(false);
        } else {
            setAddFieldError("L'IA n'a pas pu générer de contenu pour ce champ. Essayez une autre formulation.");
        }
        setIsAddingFieldLoading(false);
    };

    const handleDeletePart = (keyToDelete: PromptPartKey) => {
        if (isAppBusy) return;

        const newOrder = promptOrder.filter(key => key !== keyToDelete);
        
        if (newOrder.length === 0) {
            handleStartOver();
            return;
        }

        setPromptOrder(newOrder);

        setPromptData(prevData => {
            if (!prevData) return null;
            const newData = { ...prevData };
            delete newData[keyToDelete];
            return newData;
        });
    };

    
    const getPartStyle = (key: PromptPartKey): string => {
        const base = "w-full text-left px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 font-medium text-base";
        if (key === 'sujet') {
            return `${base} bg-[#D7FE40] text-black hover:brightness-110 shadow-[0_0_15px_rgba(215,254,64,0.4)]`;
        }
        return `${base} bg-white/5 text-gray-300 border border-transparent hover:border-white/20 hover:bg-white/10`;
    };

    if (!apiConfig && !showSettings) {
        return (
            <div className="min-h-screen text-gray-200 flex flex-col items-center justify-center font-sans">
                 <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D7FE40]"></div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen text-gray-200 flex flex-col items-center font-sans">
            <Header onStartOver={handleStartOver} hasPrompt={!!promptData} onShowSettings={() => setShowSettings(true)} onShowChatbot={() => handleOpenChatbot(null)} />
            
            <main className="w-full flex-grow pt-24 sm:pt-28 pb-16">
            {showSettings && (
                 <ApiSetupPanel 
                    currentConfig={apiConfig}
                    onConfigured={handleConfigured} 
                    onClose={() => apiConfig && setShowSettings(false)} 
                />
            )}

            {!promptData ? (
                // Welcome View
                 <div className="w-full">
                    <header className="relative text-center mb-10 overflow-hidden">
                        <img 
                            src="https://i.ibb.co/DHPhsqpR/freepik-enhance-11080.jpg" 
                            alt="Arrière-plan abstrait" 
                            className="absolute inset-0 w-full h-full object-cover opacity-30"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#111312] via-transparent to-black/50"></div>
                        <div className="relative z-10 py-20 sm:py-28 px-4 animate-fade-in">
                            <div className="flex justify-center mb-8">
                                <svg id="Calque_1" data-name="Calque 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2993.95 1070.37" className="h-16 w-auto">
                                    <defs>
                                    <style>
                                    {`.cls-1 { fill: #fbfdfe; }`}
                                    </style>
                                    </defs>
                                    <g>
                                    <path className="cls-1" d="M1423.15,381.2l-42.37,417.77h-208.29l41.78-417.77h208.88Z"/>
                                    <path className="cls-1" d="M1466.71,381.2h180.83l66.84,167.11,16.71-167.11h218.43l-41.77,417.77h-192.77l-61.47-153.38-14.92,153.38h-213.66l41.78-417.77Z"/>
                                    <path className="cls-1" d="M1991.31,381.2h222.61l-16.12,162.33h51.33l16.12-162.33h217.83l-17.3,176.66-100.86,39.39,93.7,32.23-17.3,169.49h-217.84l16.12-162.33h-50.73l-16.71,162.33h-222.61l41.78-417.77Z"/>
                                    <path className="cls-1" d="M2723,492.81l-5.37,50.73h260.21l-18.5,187.99-81.17,67.44h-395.09l11.34-111.01h260.21l4.78-51.33h-259.62l18.5-185.61,81.17-69.83h394.49l-10.74,111.6h-260.21Z"/>
                                    </g>
                                    <path className="cls-1" d="M1511.87,40.52c-14.11-14.6-31.24-25.03-51.5-31.24-20.26-6.18-40.52-9.28-60.79-9.28-34.89,0-71.74,7.9-110.57,23.63-38.83,15.78-77.95,37.73-117.35,65.85-28.14-12.36-62.46-21.64-102.98-27.85-40.52-6.18-87.8-9.28-141.81-9.28-111.43,0-211.62,16.32-300.52,48.97-88.92,32.65-164.91,74.84-227.92,126.61-63.06,51.79-111.17,106.37-144.36,163.77-33.2,57.4-49.81,111.43-49.81,162.07,0,47.28,15.75,87.26,47.28,119.88,31.5,32.65,80.48,51.79,146.89,57.4,10.12,0,15.18-2.24,15.18-6.75,0-3.36-3.94-5.06-11.81-5.06-50.64-4.49-87.52-19.14-110.57-43.89-23.08-24.75-34.63-55.15-34.63-91.17,0-38.26,11.24-79.9,33.77-124.94,22.5-45.01,54.03-90.33,94.56-135.92,40.52-45.58,88.9-86.94,145.2-124.08,56.25-37.16,118.44-67.25,186.53-90.33,68.09-23.05,139.85-34.6,215.27-34.6,46.13,0,86.37,3.36,120.71,10.12,34.32,6.75,63.32,16.32,86.94,28.71-66.42,51.79-132.26,114.79-197.54,189.09-65.27,74.27-124.36,149.68-177.25,226.22-23.65,32.65-48.71,69.81-75.13,111.43-26.47,41.65-53.77,83.32-81.88,124.94-28.16,41.65-56.3,79.64-84.41,113.96-28.16,34.34-55.73,61.07-82.74,80.19,34.89-2.24,69.24-14.89,102.98-38,33.77-23.05,66.42-52.89,97.95-89.47,31.48-36.56,61.88-75.68,91.17-117.32,29.23-41.65,57.4-81.05,84.41-118.18,34.87-50.64,72-103.55,111.43-158.71,39.38-55.13,80.19-108.61,122.38-160.38,42.22-51.76,84.67-96.8,127.47-135.08,28.14,27.02,42.22,59.69,42.22,97.92,0,7.9-.6,15.49-1.7,22.79-1.12,7.35-2.82,15.49-5.06,24.49-13.51,48.4-36.3,90.91-68.38,127.47-32.08,36.59-78.52,67.83-139.28,93.7-11.27,5.66-23.1,9.28-35.47,10.98-12.39,1.7-24.77,2.53-37.13,2.53-42.79,3.39-64.15,14.66-64.15,33.77,0,5.63,1.67,12.96,5.06,21.96,15.75-14.63,31.5-23.91,47.28-27.88,15.72-3.91,32.62-5.89,50.64-5.89,36.01,0,60.76,11.55,74.27,34.6,13.51,23.08,20.26,48.69,20.26,76.82s-4.51,54.01-13.51,77.66c-27.02,72.03-70.36,131.43-130,178.11-59.67,46.73-126.06,76.25-199.21,88.64-14.66,2.27-29.28,3.96-43.89,5.06-14.66,1.15-29.28,1.69-43.91,1.69-23.63,0-46.16-1.12-67.51-3.39-21.41-2.24-42.22-4.49-62.48-6.75-90.05-12.36-165.17-24.17-225.39-35.44-60.21-11.24-110.02-16.9-149.4-16.9-23.65,0-42.79,2.27-57.42,6.75-28.11,7.9-47.51,20-58.23,36.3-10.69,16.32-16.04,32.36-16.04,48.11s5.06,27.59,15.2,35.47c17.99-27.02,49.23-45.32,93.7-54.87,44.44-9.54,90.88-14.34,139.28-14.34,15.75,0,30.38.29,43.89.83,13.51.57,27.02,1.43,40.52,2.53,57.4,4.51,113.96,9.88,169.66,16.04,55.73,6.18,106.08,9.28,151.12,9.28,57.4,0,112.81-5.06,166.3-15.18,53.43-10.14,104.39-28.71,152.79-55.73,31.5-19.11,61.05-42.77,88.64-70.9,27.56-28.11,49.81-59.35,66.68-93.7,16.87-34.32,25.32-68.92,25.32-103.84,0-15.75-1.7-30.93-5.06-45.58-3.39-14.6-9.57-29.26-18.57-43.89-14.66-23.63-34.34-41.62-59.09-54.03-24.77-12.36-50.64-18.57-77.66-18.57,64.15-11.24,118.44-32.08,162.91-62.46,5.82-3.96,11.42-8.01,16.87-12.13,8.58-6.49,16.69-13.14,24.36-19.98,2.48-2.22,4.93-4.46,7.33-6.73,21.38-20.16,38.99-41.83,52.75-65.01,7.2-12.15,13.3-24.07,18.25-35.83,10.9-25.84,16.35-50.75,16.35-74.76,0-25.87-5.92-51.19-17.73-75.96-11.81-24.75-31.81-46.13-59.93-64.15,32.62-25.87,65.25-46.13,97.92-60.79,32.62-14.6,64.7-21.93,96.23-21.93,27.02,0,52.88,7.04,77.66,21.1,24.75,14.08,40.52,32.36,47.28,54.87,0-28.11-7.04-49.52-21.1-64.15Z"/>
                                </svg>
                            </div>
                            <h1 className="text-5xl sm:text-6xl md:text-8xl text-white tracking-tighter font-extrabold uppercase" style={{textShadow: '0 3px 20px rgba(0,0,0,0.7)'}}>
                                Générateur de <span className="text-[#D7FE40] prompt-glow">Prompt</span> IA
                            </h1>
                            <p className="text-gray-300 mt-5 text-lg max-w-2xl mx-auto" style={{textShadow: '0 2px 8px rgba(0,0,0,0.7)'}}>
                                Transformez une idée simple ou une image en un prompt riche et détaillé.
                            </p>
                        </div>
                    </header>
                    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8">
                         <div className="grid lg:grid-cols-2 gap-12 items-start animate-fade-in">
                            <div className="bg-black/20 backdrop-blur-lg border border-gray-800/80 p-6 sm:p-8 rounded-2xl shadow-2xl space-y-8">
                                <div>
                                    <h2 className="text-2xl font-bold mb-4 text-white">1. Décrivez votre idée ou importez une image</h2>
                                    
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImageChange}
                                        accept="image/png, image/jpeg, image/webp"
                                        style={{ display: 'none' }}
                                        disabled={isAppBusy}
                                    />

                                    {imagePreviewUrl && (
                                        <div className="mb-4 relative w-32 h-32 group animate-fade-in">
                                            <img src={imagePreviewUrl} alt="Aperçu de l'image" className="w-full h-full object-cover rounded-lg border-2 border-white/20" />
                                            <button
                                                onClick={handleRemoveImage}
                                                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full h-7 w-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-700 disabled:opacity-50"
                                                aria-label="Supprimer l'image"
                                                disabled={isAppBusy}
                                            >
                                                <i className="fa-solid fa-times text-sm"></i>
                                            </button>
                                        </div>
                                    )}

                                    <div className="relative flex flex-col sm:flex-row gap-4">
                                         <div className="relative w-full flex items-center bg-black/20 border border-white/10 rounded-xl focus-within:ring-2 focus-within:ring-[#D7FE40] focus-within:shadow-[0_0_15px_rgba(215,254,64,0.4)] focus-within:border-transparent transition-all">
                                            <i className="fa-solid fa-lightbulb absolute left-4 text-gray-500 z-10"></i>
                                            <input
                                                type="text"
                                                value={userInput}
                                                onChange={(e) => setUserInput(e.target.value)}
                                                placeholder={imageFile ? "Ajoutez une instruction (optionnel)" : "Ex: un astronaute sur une plage tropicale"}
                                                className="w-full bg-transparent py-4 pl-12 pr-14 text-gray-200 placeholder-gray-500 focus:outline-none"
                                                disabled={isAppBusy}
                                                onKeyDown={(e) => e.key === 'Enter' && !isAppBusy && handleGenerate()}
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isAppBusy}
                                                className="absolute right-3 h-8 w-8 bg-white/10 rounded-full flex items-center justify-center text-gray-300 hover:bg-white/20 hover:text-white transition-colors"
                                                aria-label="Importer une image"
                                            >
                                                <i className="fa-solid fa-image"></i>
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleGenerate}
                                            disabled={isAppBusy || (!userInput.trim() && !imageFile)}
                                            className="bg-[#D7FE40] hover:brightness-110 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none text-black font-bold py-4 px-8 rounded-xl transition-all duration-200 flex items-center justify-center shadow-[0_0_20px_rgba(215,254,64,0.5)] transform hover:scale-105"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black mr-3"></div>
                                                    Génération...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>
                                                    Générer
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    {error && <p className="text-red-400 mt-4 text-center font-medium">{error}</p>}
                                </div>

                                 <div>
                                     <h3 className="text-lg font-bold text-gray-400 mb-3">Pas d'inspiration ? Essayez un exemple :</h3>
                                    <div className="flex gap-3 flex-wrap">
                                        {[
                                            'Mockup de t-shirt oversize',
                                            'Mockup de bucket hat avec une carré blanc brodé',
                                            'mockup hoodie porté par une femme'
                                        ].map(ex => (
                                            <button 
                                                key={ex} 
                                                onClick={() => { setUserInput(ex); handleRemoveImage(); }}
                                                disabled={isAppBusy} 
                                                className="bg-white/5 text-gray-300 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-sm disabled:opacity-50 transform hover:scale-105"
                                            >
                                                {ex}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="hidden lg:block">
                                <PromptShowcase />
                            </div>
                        </div>

                         <section className="py-20 animate-fade-in">
                            <div className="text-center mb-12">
                                <h2 className="text-4xl font-extrabold text-white tracking-tight">Comment ça marche ?</h2>
                                <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">De l'idée à l'image parfaite en 3 étapes simples.</p>
                            </div>
                            <div className="grid md:grid-cols-3 gap-8 text-center">
                                <div className="bg-black/20 p-8 rounded-xl border border-white/10">
                                    <div className="text-5xl text-[#D7FE40] mb-4"><i className="fa-solid fa-lightbulb"></i></div>
                                    <h3 className="text-xl font-bold text-white mb-2">1. Votre Idée</h3>
                                    <p className="text-gray-400">Décrivez une scène, téléchargez une image, ou les deux. Soyez aussi simple ou détaillé que vous le souhaitez.</p>
                                </div>
                                <div className="bg-black/20 p-8 rounded-xl border border-white/10">
                                    <div className="text-5xl text-[#D7FE40] mb-4"><i className="fa-solid fa-wand-magic-sparkles"></i></div>
                                    <h3 className="text-xl font-bold text-white mb-2">2. Génération IA</h3>
                                    <p className="text-gray-400">Notre IA analyse votre demande et la transforme en un prompt structuré et riche, prêt à être utilisé.</p>
                                </div>
                                <div className="bg-black/20 p-8 rounded-xl border border-white/10">
                                    <div className="text-5xl text-[#D7FE40] mb-4"><i className="fa-solid fa-sliders"></i></div>
                                    <h3 className="text-xl font-bold text-white mb-2">3. Raffinement</h3>
                                    <p className="text-gray-400">Modifiez chaque détail, réorganisez les sections et générez des alternatives pour atteindre la perfection.</p>
                                </div>
                            </div>
                        </section>

                    </div>
                </div>
            ) : (
                // Editor View
                 <div className="w-full mx-auto animate-fade-in p-4 sm:p-8 max-w-4xl">
                    <div className="grid grid-cols-1">
                        {/* Editor Column */}
                        <div>
                            <header className="text-center mb-6">
                                <button
                                    onClick={handleStartOver}
                                    disabled={isAppBusy}
                                    className="bg-white/10 hover:bg-white/20 text-gray-200 font-semibold py-2 px-4 rounded-xl transition-all duration-200 flex items-center justify-center mx-auto mb-4 disabled:opacity-50"
                                >
                                    <i className="fa-solid fa-arrow-left mr-2"></i>
                                    Démarrer une nouvelle génération
                                </button>
                                <p className="text-gray-400 text-lg">Votre prompt est prêt. Affinez-le, réorganisez-le ou copiez-le.</p>
                            </header>
                            <main>
                                {isLoading ? (
                                    <div className="flex justify-center items-center h-96">
                                        <div className="text-center">
                                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D7FE40] shadow-[0_0_15px_#D7FE40] mx-auto"></div>
                                            <p className="mt-4 text-gray-400">Génération de votre nouveau prompt...</p>
                                        </div>
                                    </div>
                                ) : promptData && (
                                    <div className="bg-gray-500/10 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl">
                                        <div 
                                            onDrop={handleDropContainer} 
                                            onDragOver={e => e.preventDefault()}
                                            onDragLeave={() => setDropIndicator(null)}
                                        >
                                            {promptOrder.map((key, index) => (
                                                <React.Fragment key={key}>
                                                    {dropIndicator === index && <DropIndicator />}
                                                    <div 
                                                        className={`group grid grid-cols-[auto_max-content_1fr_auto] gap-x-3 items-center rounded-xl transition-all duration-300 my-2 ${draggedIndex === index ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}
                                                        draggable
                                                        onDragStart={() => handleDragStart(index)}
                                                        onDragOver={(e) => handleDragOverItem(e, index)}
                                                        onDragEnd={handleDragEnd}
                                                    >
                                                        <div className="cursor-grab text-gray-400 hover:text-white p-2 touch-none" aria-label="Réorganiser">
                                                            <i className="fa-solid fa-grip-vertical"></i>
                                                        </div>
                                                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                                            {getLabel(key)}
                                                        </h3>
                                                        <div className="w-full">
                                                            <button
                                                                onClick={() => setActivePanelKey(key)}
                                                                className={getPartStyle(key)}
                                                                disabled={isAppBusy}
                                                            >
                                                                {promptData[key].valeur}
                                                            </button>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDeletePart(key)}
                                                            disabled={isAppBusy}
                                                            className="text-gray-500 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                                            aria-label={`Supprimer ${getLabel(key)}`}
                                                        >
                                                            <i className="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    </div>
                                                </React.Fragment>
                                            ))}
                                            {dropIndicator === promptOrder.length && <DropIndicator />}
                                        </div>

                                        <div className="mt-6">
                                            {isAddingField ? (
                                                <div className="bg-white/5 p-4 rounded-lg animate-fade-in">
                                                    <label htmlFor="new-field-name" className="text-sm font-bold text-gray-300 mb-2 block">Nom du nouveau champ</label>
                                                    <div className="flex flex-col sm:flex-row gap-2">
                                                        <input
                                                            id="new-field-name"
                                                            type="text"
                                                            value={newFieldKey}
                                                            onChange={(e) => {
                                                                setNewFieldKey(e.target.value);
                                                                setAddFieldError('');
                                                            }}
                                                            placeholder="Ex: Palette de couleurs"
                                                            className="flex-grow bg-black/20 border border-white/10 rounded-lg py-2 px-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D7FE40]"
                                                            disabled={isAddingFieldLoading}
                                                            onKeyDown={(e) => e.key === 'Enter' && !isAddingFieldLoading && handleConfirmAddField()}
                                                        />
                                                        <div className='flex gap-2'>
                                                            <button
                                                                onClick={handleConfirmAddField}
                                                                disabled={isAddingFieldLoading || !newFieldKey.trim()}
                                                                className="bg-[#D7FE40] text-black rounded-lg px-4 py-2 text-sm font-semibold hover:brightness-110 disabled:bg-gray-600 disabled:text-gray-400 flex-grow sm:flex-grow-0 flex items-center justify-center"
                                                            >
                                                                {isAddingFieldLoading ? <LoadingSpinner className="border-black"/> : 'Ajouter'}
                                                            </button>
                                                            <button
                                                                onClick={() => setIsAddingField(false)}
                                                                disabled={isAddingFieldLoading}
                                                                className="bg-white/10 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-white/20 flex-grow sm:flex-grow-0"
                                                            >
                                                                Annuler
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {addFieldError && <p className="text-red-400 mt-2 text-sm">{addFieldError}</p>}
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setIsAddingField(true)}
                                                    disabled={isAppBusy}
                                                    className="w-full border-2 border-dashed border-white/20 text-white/50 hover:border-white/40 hover:text-white/80 transition-all rounded-xl py-3 px-4 flex items-center justify-center disabled:opacity-50"
                                                >
                                                    <i className="fa-solid fa-plus mr-2"></i>
                                                    Ajouter un champ personnalisé
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div className="mt-8 pt-6 border-t border-white/10 space-y-6">
                                            <div>
                                                <h3 className="text-base font-bold text-gray-200 mb-2 block">
                                                    Modifier le prompt entier
                                                </h3>
                                                <p className="text-gray-400 text-sm mb-3">Donnez une instruction pour réécrire tout le prompt. (Ex: "rends-le plus sombre et gothique")</p>
                                                <div className="flex flex-col sm:flex-row gap-4">
                                                    <input
                                                        id="full-prompt-query"
                                                        type="text"
                                                        value={fullPromptQuery}
                                                        onChange={(e) => setFullPromptQuery(e.target.value)}
                                                        placeholder="Votre instruction ici..."
                                                        className="flex-grow bg-black/20 border border-white/10 rounded-xl p-4 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D7FE40] focus:shadow-[0_0_15px_rgba(215,254,64,0.4)] focus:border-transparent transition-all"
                                                        disabled={isAppBusy}
                                                        onKeyDown={(e) => e.key === 'Enter' && !isAppBusy && handleEditFullPrompt()}
                                                    />
                                                    <button
                                                        onClick={handleEditFullPrompt}
                                                        disabled={isAppBusy || !fullPromptQuery.trim()}
                                                        className="bg-white/10 hover:bg-white/20 border border-white/20 disabled:bg-gray-800 disabled:text-gray-500 disabled:border-transparent text-gray-200 font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center"
                                                    >
                                                        {isModifying && (fullPromptQuery.trim()) ? (
                                                            <>
                                                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-3"></div>
                                                                Modification...
                                                            </>
                                                        ) : (
                                                            'Modifier'
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-center mt-8 pt-6 border-t border-white/10">
                                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                                <button
                                                    onClick={handleImprovePrompt}
                                                    disabled={isAppBusy}
                                                    className="bg-white/10 hover:bg-white/20 border border-white/20 disabled:bg-gray-800 disabled:text-gray-500 disabled:border-transparent text-gray-200 font-bold py-3 px-6 rounded-xl transition-all duration-300 w-full sm:w-auto flex items-center justify-center"
                                                >
                                                    {isModifying && !fullPromptQuery.trim() ? (
                                                        <>
                                                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-200 mr-3"></div>
                                                            Amélioration...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>
                                                            Améliorer avec l'IA
                                                        </>
                                                    )}
                                                </button>
                                                 <button
                                                    onClick={() => handleOpenChatbot(promptData)}
                                                    disabled={isAppBusy}
                                                    className="bg-white/10 hover:bg-white/20 border border-white/20 disabled:bg-gray-800 disabled:text-gray-500 disabled:border-transparent text-gray-200 font-bold py-3 px-6 rounded-xl transition-all duration-300 w-full sm:w-auto flex items-center justify-center"
                                                >
                                                     <i className="fa-solid fa-comments mr-2"></i>
                                                     Discuter avec l'IA
                                                </button>
                                                <button
                                                    onClick={handleCopy}
                                                    disabled={isTranslating || copySuccess || isAppBusy}
                                                    className="bg-[#D7FE40] hover:brightness-110 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none text-black font-bold py-3 px-6 rounded-xl transition-all duration-300 w-full sm:w-auto flex items-center justify-center shadow-[0_0_20px_rgba(215,254,64,0.5)]"
                                                >
                                                    {isTranslating ? (
                                                        <>
                                                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black mr-3"></div>
                                                            Traduction...
                                                        </>
                                                    ) : copySuccess ? (
                                                        <>
                                                            <i className="fa-solid fa-check mr-2"></i>
                                                            Copié en anglais !
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i className="fa-solid fa-copy mr-2"></i>
                                                            Copier le prompt
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            <p className="text-gray-500 text-sm mt-3">Le prompt sera copié en anglais dans votre presse-papiers.</p>
                                        </div>
                                    </div>
                                )}
                            </main>
                        </div>
                    </div>
                </div>
            )}
            </main>

            {/* Side Panels & Modals */}
             {activePanelKey && promptData && (
                <SidePanel 
                    activeKey={activePanelKey}
                    activeLabel={getLabel(activePanelKey)}
                    promptData={promptData}
                    onClose={() => setActivePanelKey(null)}
                    onUpdate={handleUpdatePromptPart}
                    onRefresh={handleRefreshAlternatives}
                    onCustomQuery={handleCustomQuery}
                    isLoading={isSidePanelLoading}
                />
             )}
             
            {showChatbot && apiConfig && (
                <Chatbot
                    apiConfig={apiConfig}
                    initialPrompt={chatbotContext}
                    onClose={() => setShowChatbot(false)}
                    onPromptUpdate={handleChatPromptUpdate}
                />
            )}
            
             <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.6s ease-out forwards;
                }
                @keyframes slide-in-right {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.35s cubic-bezier(0.25, 1, 0.5, 1) forwards;
                }
                 @keyframes fade-in-backdrop {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in-backdrop {
                    animation: fade-in-backdrop 0.35s ease-out forwards;
                }
                .prompt-glow {
                    text-shadow: 0 0 12px rgba(215, 254, 64, 0.7), 
                                 0 0 25px rgba(215, 254, 64, 0.5), 
                                 0 0 40px rgba(215, 254, 64, 0.3);
                }
            `}</style>
        </div>
    );
};

export default App;