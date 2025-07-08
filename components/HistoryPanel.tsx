import React from 'react';
import { PromptData, PromptPartKey } from '../types';

interface HistoryPanelProps {
    history: { data: PromptData; order: PromptPartKey[] }[];
    onClose: () => void;
    onRestore: (item: { data: PromptData; order: PromptPartKey[] }) => void;
    getLabel: (key: PromptPartKey) => string;
}

const HistoryItem: React.FC<{
    item: { data: PromptData; order: PromptPartKey[] },
    onRestore: () => void,
    versionNumber: number,
    getLabel: (key: PromptPartKey) => string,
}> = ({ item, onRestore, versionNumber, getLabel }) => {
    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 transition-all hover:bg-white/10 hover:border-white/20">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-lg text-gray-200">Version {versionNumber}</h4>
                <button
                    onClick={onRestore}
                    className="bg-[#D7FE40] text-black rounded-lg px-4 py-1.5 text-sm font-semibold hover:brightness-110 transition-all shadow-[0_0_10px_rgba(215,254,64,0.4)]"
                >
                    Restaurer
                </button>
            </div>
            <div className="space-y-2 text-sm">
                {item.order.map(key => (
                    <div key={key} className="grid grid-cols-[120px_1fr] gap-2 items-start">
                        <span className="font-semibold text-gray-400 truncate">{getLabel(key)}:</span>
                        <span className="text-gray-300 break-words">{item.data[key].valeur}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onClose, onRestore, getLabel }) => {
    
    // Show newest first
    const reversedHistory = [...history].reverse();
    
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-start overflow-y-auto p-4 animate-fade-in-backdrop" aria-modal="true" role="dialog">
            <div className="bg-[#1c1e1d] border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl my-auto flex flex-col max-h-[90vh]">
                <header className="flex justify-between items-center p-6 border-b border-white/10 shrink-0">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <i className="fa-solid fa-clock-rotate-left text-[#D7FE40]"></i>
                        Historique des versions
                    </h2>
                    <button 
                        onClick={onClose} 
                        className="h-10 w-10 flex items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Fermer"
                    >
                        <i className="fa-solid fa-times text-xl"></i>
                    </button>
                </header>
                
                <main className="p-6 flex-grow overflow-y-auto">
                    {reversedHistory.length > 0 ? (
                        <div className="space-y-6">
                            {reversedHistory.map((item, index) => (
                                <HistoryItem 
                                    key={history.length - 1 - index} // Use original index for stable key
                                    item={item}
                                    onRestore={() => onRestore(item)}
                                    versionNumber={history.length - index}
                                    getLabel={getLabel}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-gray-400">L'historique des modifications est vide.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
