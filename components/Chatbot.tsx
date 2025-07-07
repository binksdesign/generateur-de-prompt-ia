import React, { useState, useEffect, useRef } from 'react';
import { continueChat } from '../services/geminiService';
import { ApiConfig, ChatMessage, PromptData } from '../types';

interface ChatbotProps {
    apiConfig: ApiConfig;
    initialPrompt: PromptData | null;
    onClose: () => void;
    onPromptUpdate: (newPrompt: PromptData) => void;
}

const LoadingSpinner: React.FC<{className?: string}> = ({className = ''}) => (
    <div className={`animate-spin rounded-full h-5 w-5 border-b-2 ${className}`}></div>
);

export const Chatbot: React.FC<ChatbotProps> = ({ apiConfig, initialPrompt, onClose, onPromptUpdate }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [currentPrompt, setCurrentPrompt] = useState<PromptData | null>(initialPrompt);
    
    useEffect(() => {
        const firstMessage = initialPrompt 
            ? "Je vois que vous travaillez sur un prompt. Comment puis-je vous aider à l'améliorer ? Vous pouvez me demander de modifier un champ, d'en ajouter un, ou de changer le style."
            : "Bonjour ! Je suis votre assistant expert en prompts. Comment puis-je vous aider à créer le prompt parfait aujourd'hui ?";
        setMessages([{ role: 'assistant', content: firstMessage }]);
    }, [initialPrompt]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSubmit = async () => {
        if (!userInput.trim() || isLoading) return;

        const newUserMessage: ChatMessage = { role: 'user', content: userInput };
        const fullMessageHistory = [...messages, newUserMessage];

        // Add context of the current prompt to the conversation history for the AI
        if (currentPrompt) {
            const promptContextMessage: ChatMessage = {
                role: 'system',
                content: `CONTEXTE: L'utilisateur travaille actuellement sur ce prompt JSON : ${JSON.stringify(currentPrompt)}`
            };
            fullMessageHistory.unshift(promptContextMessage);
        }
        
        setMessages(prev => [...prev, newUserMessage]);
        setUserInput('');
        setIsLoading(true);

        try {
            const response = await continueChat(apiConfig, fullMessageHistory);
            
            if (typeof response === 'string') {
                setMessages(prev => [...prev, { role: 'assistant', content: response }]);
            } else if (response && typeof response === 'object') {
                // This is a prompt update
                onPromptUpdate(response);
                setCurrentPrompt(response); // Update local context
                setMessages(prev => [...prev, { role: 'assistant', content: "Parfait, j'ai mis à jour le prompt pour vous. Vous pouvez le voir en fermant cette fenêtre." }]);
            } else {
                 setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, je n'ai pas pu traiter cette demande. Veuillez réessayer." }]);
            }

        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Une erreur est survenue: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div 
             className="fixed inset-0 z-50 flex flex-col bg-[#111312]/90 backdrop-blur-lg animate-fade-in-backdrop"
             aria-modal="true"
             role="dialog"
        >
            <header className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
                 <h2 className="text-xl font-bold text-gray-100 flex items-center gap-3">
                    <i className="fa-solid fa-comments text-[#D7FE40]"></i>
                    Chatbot IA
                </h2>
                <button 
                    onClick={onClose} 
                    className="h-9 w-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                    aria-label="Fermer le chatbot"
                >
                    <i className="fa-solid fa-times text-lg"></i>
                </button>
            </header>

            <main className="flex-grow p-4 sm:p-6 overflow-y-auto">
                <div className="space-y-6">
                    {messages.filter(m => m.role !== 'system').map((msg, index) => (
                        <div key={index} className={`flex gap-3 animate-fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-[#D7FE40] flex items-center justify-center text-black shrink-0">
                                    <i className="fa-solid fa-robot text-sm"></i>
                                </div>
                            )}
                            <div className={`max-w-xl p-4 rounded-2xl ${msg.role === 'user' ? 'bg-[#D7FE40] text-black rounded-br-lg' : 'bg-white/10 text-gray-200 rounded-bl-lg'}`}>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                         <div className="flex gap-3 justify-start animate-fade-in">
                            <div className="w-8 h-8 rounded-full bg-[#D7FE40] flex items-center justify-center text-black shrink-0">
                                <i className="fa-solid fa-robot text-sm"></i>
                            </div>
                            <div className="max-w-xl p-4 rounded-2xl bg-white/10 text-gray-200 rounded-bl-lg flex items-center">
                                <div className="dot-flashing"></div>
                            </div>
                        </div>
                    )}
                </div>
                <div ref={messagesEndRef} />
            </main>

            <footer className="p-4 sm:p-6 shrink-0 border-t border-white/10">
                <div className="relative">
                    <textarea
                        value={userInput}
                        onChange={e => setUserInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                        placeholder="Posez votre question ou donnez une instruction..."
                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-4 pr-14 text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-[#D7FE40]"
                        rows={1}
                        style={{ height: 'auto', maxHeight: '150px' }}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                        }}
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || !userInput.trim()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 bg-[#D7FE40] text-black rounded-full flex items-center justify-center hover:brightness-110 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all"
                        aria-label="Envoyer"
                    >
                         {isLoading ? <LoadingSpinner className="border-black h-4 w-4"/> : <i className="fa-solid fa-paper-plane"></i>}
                    </button>
                </div>
            </footer>
             <style>{`
                .dot-flashing {
                    position: relative;
                    width: 5px; height: 5px;
                    border-radius: 5px;
                    background-color: #D7FE40;
                    color: #D7FE40;
                    animation: dotFlashing 1s infinite linear alternate;
                    animation-delay: .5s;
                }
                .dot-flashing::before, .dot-flashing::after {
                    content: '';
                    display: inline-block;
                    position: absolute;
                    top: 0;
                }
                .dot-flashing::before {
                    left: -10px;
                    width: 5px; height: 5px;
                    border-radius: 5px;
                    background-color: #D7FE40;
                    color: #D7FE40;
                    animation: dotFlashing 1s infinite alternate;
                    animation-delay: 0s;
                }
                .dot-flashing::after {
                    left: 10px;
                    width: 5px; height: 5px;
                    border-radius: 5px;
                    background-color: #D7FE40;
                    color: #D7FE40;
                    animation: dotFlashing 1s infinite alternate;
                    animation-delay: 1s;
                }
                @keyframes dotFlashing {
                    0% { background-color: #D7FE40; }
                    50%, 100% { background-color: rgba(215, 254, 64, 0.3); }
                }
            `}</style>
        </div>
    );
};
