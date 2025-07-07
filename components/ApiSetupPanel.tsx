

import React, { useState, useEffect } from 'react';
import { ApiConfig } from '../types';

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
            }
        }
    }, [currentConfig]);

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
                setError("Veuillez entrer l'identifiant du modèle personnalisé.");
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
    
    const renderOptionButton = (type: SelectionType, title: string, description: string, priceInfo: React.ReactNode) => {
        return (
            <button
                onClick={() => setSelectionType(type)}
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in-backdrop" aria-modal="true" role="dialog">
            <div className="bg-[#1c1e1d] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl m-4 p-8 text-white animate-fade-in">
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
                        <div className="animate-fade-in">
                            <label htmlFor="custom-model-id" className="text-sm font-bold text-gray-300 mb-2 block">Identifiant du modèle personnalisé</label>
                            <p className="text-xs text-gray-500 mb-2">
                                Copiez et collez l'identifiant du modèle depuis OpenRouter.
                            </p>
                            <input
                                id="custom-model-id"
                                type="text"
                                value={customModelId}
                                onChange={(e) => setCustomModelId(e.target.value)}
                                placeholder="ex: openai/gpt-4.1-mini"
                                className="w-full bg-black/20 border border-white/10 rounded-lg py-2.5 px-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D7FE40] focus:bg-black/30 transition-all font-mono text-sm"
                            />
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
        </div>
    );
};