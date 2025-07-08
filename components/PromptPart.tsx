import React, { useState, useEffect, useRef } from 'react';
import { PromptPartKey, PromptData } from '../types';

interface SidePanelProps {
    activeKey: PromptPartKey;
    activeLabel: string;
    promptData: PromptData;
    onClose: () => void;
    onUpdate: (partKey: PromptPartKey, newValue: string) => void;
    onRefresh: (partKey: PromptPartKey) => void;
    onCustomQuery: (partKey: PromptPartKey, query: string) => void;
    isLoading: boolean;
}

const LoadingSpinner: React.FC<{className?: string}> = ({className = ''}) => (
    <div className={`animate-spin rounded-full h-5 w-5 border-b-2 ${className}`}></div>
);


export const SidePanel: React.FC<SidePanelProps> = ({ activeKey, activeLabel, promptData, onClose, onUpdate, onRefresh, onCustomQuery, isLoading }) => {
    const segmentData = promptData[activeKey];
    const [manualValue, setManualValue] = useState(segmentData.valeur);
    const [customQuery, setCustomQuery] = useState('');
    const panelRef = useRef<HTMLDivElement>(null);

    // Sync manual value if the prompt data changes from outside
    useEffect(() => {
        setManualValue(segmentData.valeur);
    }, [segmentData.valeur]);


    // Close on escape key
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);
    
    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleCustomSubmit = () => {
        if(customQuery.trim() && !isLoading) {
            onCustomQuery(activeKey, customQuery);
            setCustomQuery('');
        }
    }

    const handleManualSubmit = () => {
        if (manualValue.trim() && !isLoading) {
            onUpdate(activeKey, manualValue);
        }
    };
    
    return (
        <div 
             className="fixed inset-0 z-50 animate-fade-in-backdrop"
             aria-modal="true"
             role="dialog"
        >
            <div className="absolute inset-0 bg-black/30"></div>
            <div 
                ref={panelRef}
                className="fixed top-0 right-0 h-full w-full max-w-md bg-[#1c1e1d]/80 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col animate-slide-in-right"
            >
                <header className="p-4 sm:p-6 flex items-center justify-between border-b border-white/10">
                    <h2 className="text-xl font-bold text-gray-100">Modifier "{activeLabel}"</h2>
                    <button 
                        onClick={onClose} 
                        className="h-12 w-12 flex items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Fermer le panneau"
                    >
                        <i className="fa-solid fa-times text-2xl"></i>
                    </button>
                </header>

                <div className="p-4 sm:p-6 flex-grow overflow-y-auto">
                    {/* Manual Edit Section */}
                    <div className="mb-6">
                        <label htmlFor="manual-edit" className="text-sm font-bold text-gray-400 mb-2 block">Édition manuelle</label>
                        <textarea
                            id="manual-edit"
                            value={manualValue}
                            onChange={(e) => setManualValue(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg py-2.5 px-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D7FE40] focus:bg-black/30 transition-all min-h-[80px]"
                            rows={3}
                            disabled={isLoading}
                        />
                        <button
                            onClick={handleManualSubmit}
                            disabled={isLoading || manualValue === segmentData.valeur}
                            className="mt-3 w-full bg-[#D7FE40] text-black rounded-lg px-3 py-2.5 text-sm font-semibold hover:brightness-110 transition-all disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none shadow-[0_0_15px_rgba(215,254,64,0.4)]"
                        >
                            Appliquer le changement
                        </button>
                    </div>

                    {/* Separator */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-[#1c1e1d] px-2 text-sm text-gray-400 uppercase font-semibold">OU</span>
                        </div>
                    </div>

                    {/* AI Assistance Section */}
                    <div className="mb-6">
                        <label htmlFor="custom-query" className="text-sm font-bold text-gray-400 mb-2 block">Demander à l'IA</label>
                        <div className="relative">
                            <input
                                id="custom-query"
                                type="text"
                                value={customQuery}
                                onChange={(e) => setCustomQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                                placeholder="Ex: dans un style cyberpunk..."
                                className="w-full bg-black/20 border border-white/10 rounded-lg py-2.5 pl-3 pr-24 text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D7FE40] focus:bg-black/30 transition-all"
                                disabled={isLoading}
                            />
                            <button 
                                onClick={handleCustomSubmit}
                                disabled={isLoading || !customQuery.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#D7FE40] text-black rounded-md px-3 py-1 text-sm font-semibold hover:brightness-110 transition-all disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none shadow-[0_0_10px_rgba(215,254,64,0.4)]"
                            >
                                { isLoading ? <LoadingSpinner className="border-black h-4 w-4" /> : 'Créer'}
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-gray-400">Suggestions de l'IA</h3>
                        <button 
                            onClick={() => onRefresh(activeKey)} 
                            disabled={isLoading}
                            className="h-8 w-8 flex items-center justify-center text-gray-400 hover:bg-white/10 disabled:text-gray-600 disabled:cursor-not-allowed rounded-full transition-colors"
                            aria-label="Rafraîchir les suggestions"
                        >
                             { isLoading ? <LoadingSpinner className="border-gray-200"/> : <i className="fa-solid fa-arrows-rotate"></i> }
                        </button>
                    </div>

                    <ul className="space-y-2">
                        {segmentData.alternatives.map((alt, index) => (
                            <li key={index}>
                                <button
                                    onClick={() => onUpdate(activeKey, alt)}
                                    className="w-full text-left bg-white/5 text-gray-300 p-3 rounded-lg border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 disabled:opacity-50"
                                    disabled={isLoading}
                                >
                                    {alt}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};