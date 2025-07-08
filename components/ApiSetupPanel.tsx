

import React, { useState, useEffect, useCallback } from 'react';
import { ApiConfig, OpenRouterModel } from '../types';

interface ApiSetupPanelProps {
    onConfigured: (config: ApiConfig) => void;
    onClose: () => void;
    currentConfig: ApiConfig | null;
}

type SelectionType = 'premium' | 'free' | 'custom';
const PREMIUM_MODEL = "openai/gpt-4.1-mini";
const FREE_MODEL = "mistralai/mistral-small-3.2-24b-instruct:free";

export const ApiSetupPanel: React.FC<ApiSetupPanelProps> = ({ onConfigured, onClose, currentConfig }) => {
    const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '');
    const [selectionType, setSelectionType] = useState<SelectionType>('premium');
    const [customModelId, setCustomModelId] = useState('');
    const [error, setError] = useState('');

    const [models, setModels] = useState<OpenRouterModel[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [modelSearch, setModelSearch] = useState('');

    const fetchModels = useCallback(async () => {
        setIsLoadingModels(true);
        setError('');
        setModels([]);
        try {
            const response = await fetch("https://openrouter.ai/api/v1/models");
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error?.message || `La requête a échoué (${response.status})`);
            }
            const data = await response.json();
            const sortedModels = (data.data as OpenRouterModel[]).sort((a, b) => {
                const priceA = parseFloat(a.pricing.prompt) + parseFloat(a.pricing.output ?? a.pricing.completion);
                const priceB = parseFloat(b.pricing.prompt) + parseFloat(b.pricing.output ?? b.pricing.completion);
                if (isNaN(priceA)) return 1;
                if (isNaN(priceB)) return -1;
                if (priceA === 0 && priceB > 0) return -1;
                if (priceB === 0 && priceA > 0) return 1;
                if (priceA === priceB) return a.name.localeCompare(b.name);
                return priceA - priceB;
            });
            setModels(sortedModels);
        } catch (e: any) {
            setError(`Impossible de charger les modèles: ${e.message}`);
        } finally {
            setIsLoadingModels(false);
        }
    }, []);

    useEffect(() => {
        if (currentConfig) {
            setApiKey(currentConfig.apiKey);
            if (currentConfig.model === PREMIUM_MODEL) {
                setSelectionType('premium');
            } else if (currentConfig.model === FREE_MODEL) {
                setSelectionType('free');
            } else {
                setSelectionType('custom');
                setCustomModelId(currentConfig.model);
                fetchModels();
            }
        }
    }, [currentConfig, fetchModels]);

    const handleSelectType = (type: SelectionType) => {
        setSelectionType(type);
        if (type === 'custom') {
            fetchModels();
        }
    };


    const handleSubmit = () => {
        if (!apiKey.trim()) {
            setError('Veuillez entrer une clé API OpenRouter.');
            return;
        }

        let model = '';
        if (selectionType === 'premium') {
            model = PREMIUM_MODEL;
        } else if (selectionType === 'free') {
            model = FREE_MODEL;
        } else if (selectionType === 'custom') {
            if (!customModelId.trim()) {
                setError("Veuillez sélectionner un modèle dans la liste.");
                return;
            }
            model = customModelId.trim();
        }

        if (!model) {
             setError("Veuillez sélectionner un modèle.");
             return;
        }

        setError('');
        onConfigured({ apiKey: apiKey.trim(), model });
    };

    const filteredModels = models.filter(model => 
        model.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
        model.id.toLowerCase().includes(modelSearch.toLowerCase())
    );
    
    const renderOptionButton = (type: SelectionType, title: string, description: string, priceInfo: React.ReactNode) => {
        return (
            <button
                onClick={() => handleSelectType(type)}
                className={`p-4 rounded-lg border-2 text-left transition-all h-full flex flex-col justify-between ${selectionType === type ? 'border-[#D7FE40] bg-lime-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
            >
                <div>
                    <p className="font-bold text-white">{title}</p>
                    <p className="text-sm text-gray-400 mt-1">{description}</p>
                </div>
                <div className="mt-2">{priceInfo}</div>
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-start overflow-y-auto p-4 animate-fade-in-backdrop" aria-modal="true" role="dialog">
            <div className="bg-[#1c1e1d] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl my-auto p-6 sm:p-8 text-white animate-fade-in">
                <div className="flex justify-between items-start">
                    <h2 className="text-2xl font-bold mb-4">Configuration de l'API</h2>
                    {currentConfig && (
                         <button 
                            onClick={onClose} 
                            className="h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                            aria-label="Fermer"
                        >
                            <i className="fa-solid fa-times"></i>
                        </button>
                    )}
                </div>
                
                <p className="text-gray-400 mb-6">
                    Entrez votre clé API OpenRouter pour utiliser ce service. Les coûts d'utilisation seront facturés sur votre compte OpenRouter.
                </p>

                <div className="space-y-6">
                    <div>
                        <label htmlFor="api-key" className="text-sm font-bold text-gray-300 mb-2 block">Clé API OpenRouter</label>
                        <input
                            id="api-key"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-or-..."
                            className="w-full bg-black/20 border border-white/10 rounded-lg py-2.5 px-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D7FE40] focus:bg-black/30 transition-all"
                        />
                         <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-[#D7FE40] transition-colors mt-1 block">
                            Où trouver ma clé ? <i className="fa-solid fa-arrow-up-right-from-square text-xs ml-1"></i>
                        </a>
                    </div>
                    
                    <div>
                        <h3 className="text-sm font-bold text-gray-300 mb-3 block">Choix du modèle d'IA</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {renderOptionButton('premium', 'Premium', 'Qualité supérieure (OpenAI GPT-4.1 Mini). Recommandé.', <span className="font-semibold text-gray-300">Payant</span>)}
                            {renderOptionButton('free', 'Basique', 'Moins performant mais suffisant pour tester (Mistral Small).', <span className="font-semibold text-lime-400">Gratuit</span>)}
                            {renderOptionButton('custom', 'Personnalisé', 'Utilisez n\'importe quel autre modèle depuis OpenRouter.', <span className="font-semibold text-cyan-400">Variable</span>)}
                        </div>
                    </div>
                    
                    {selectionType === 'custom' && (
                        <div className="animate-fade-in space-y-3 pt-4 border-t border-white/10 mt-4">
                            <div>
                                <label htmlFor="model-search" className="text-sm font-bold text-gray-300 mb-2 block">Rechercher un modèle</label>
                                <input
                                    id="model-search"
                                    type="text"
                                    value={modelSearch}
                                    onChange={(e) => setModelSearch(e.target.value)}
                                    placeholder="Chercher par nom ou ID..."
                                    className="w-full bg-black/20 border border-white/10 rounded-lg py-2.5 px-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D7FE40] focus:bg-black/30 transition-all"
                                />
                                 <p className="text-xs text-gray-400 mt-2">
                                    Pour les tarifs exacts, consultez <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">les modèles sur OpenRouter</a>. La liste est mise à jour à chaque sélection.
                                </p>
                            </div>
                            
                            {isLoadingModels ? (
                                <div className="flex justify-center items-center h-48">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#D7FE40]"></div>
                                </div>
                            ) : models.length > 0 ? (
                                <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {filteredModels.map(model => {
                                        const priceIn = parseFloat(model.pricing.prompt);
                                        const priceOut = parseFloat(model.pricing.output ?? model.pricing.completion);
                                        const isFree = isNaN(priceIn) || (priceIn === 0 && priceOut === 0);
                                        return (
                                            <button
                                                key={model.id}
                                                onClick={() => setCustomModelId(model.id)}
                                                className={`w-full text-left p-3 rounded-lg border-2 transition-all ${customModelId === model.id ? 'border-[#D7FE40] bg-lime-500/10' : 'border-transparent bg-white/5 hover:bg-white/10'}`}
                                            >
                                                <div className="flex justify-between items-start gap-2">
                                                    <div>
                                                        <p className="font-semibold text-white">{model.name}</p>
                                                        <p className="text-xs text-gray-500 mt-1 font-mono">{model.id}</p>
                                                    </div>
                                                    {isFree ? (
                                                        <span className="text-xs shrink-0 font-bold bg-lime-400/20 text-lime-300 px-2 py-1 rounded-full">Gratuit</span>
                                                    ) : (
                                                        <span className="text-xs shrink-0 font-bold bg-cyan-400/20 text-cyan-300 px-2 py-1 rounded-full">Payant</span>
                                                    )}
                                                </div>
                                            </button>
                                        )
                                    })}
                                    {filteredModels.length === 0 && (
                                        <p className="text-center text-gray-400 py-8">Aucun modèle trouvé.</p>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>

                {error && <p className="text-red-400 mt-4 text-center font-medium">{error}</p>}

                <div className="mt-8">
                    <button
                        onClick={handleSubmit}
                        className="w-full bg-[#D7FE40] text-black rounded-lg px-3 py-3 text-base font-semibold hover:brightness-110 transition-all shadow-[0_0_15px_rgba(215,254,64,0.4)]"
                    >
                        Sauvegarder et commencer
                    </button>
                </div>
            </div>
             <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.3);
                }
            `}</style>
        </div>
    );
};