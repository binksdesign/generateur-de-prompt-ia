import React, { useEffect, useRef } from 'react';
import { continueChat, fileToDataUrl } from '../services/geminiService';
import { ApiConfig, ChatMessage, PromptData } from '../types';

type Persona = 'expert' | 'generalist';

interface ChatbotProps {
    apiConfig: ApiConfig;
    currentPrompt: PromptData | null;
    onClose: () => void;
    onPromptUpdate: (newPrompt: PromptData) => void;
    persona: Persona;
    setPersona: (p: Persona) => void;
    conversations: Record<Persona, ChatMessage[]>;
    setConversations: React.Dispatch<React.SetStateAction<Record<Persona, ChatMessage[]>>>;
}


const LoadingSpinner: React.FC<{className?: string}> = ({className = ''}) => (
    <div className={`animate-spin rounded-full h-5 w-5 border-b-2 ${className}`}></div>
);

const ChatMessageView: React.FC<{ msg: ChatMessage, onUsePrompt: (prompt: PromptData) => void }> = ({ msg, onUsePrompt }) => {
    const parts = msg.content.split(/(\*\*.*?\*\*)/g);
    return (
        <div className={`max-w-xl p-4 rounded-2xl ${msg.role === 'user' ? 'bg-[#D7FE40] text-black rounded-br-lg' : 'bg-white/10 text-gray-200 rounded-bl-lg'}`}>
            {msg.imagePreviewUrl && (
                <img src={msg.imagePreviewUrl} alt="Aperçu" className="mb-2 rounded-lg max-w-xs" />
            )}
            <p className="whitespace-pre-wrap">
                {parts.map((part, i) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={i}>{part.slice(2, -2)}</strong>;
                    }
                    return part;
                })}
            </p>
            {msg.promptData && (
                <div className="mt-4 border-t border-white/20 pt-4">
                     <div className="bg-black/20 p-4 rounded-lg space-y-3 mb-4 border border-white/10">
                         {Object.keys(msg.promptData).map(key => (
                             <div key={key}>
                                 <p className="text-xs text-[#D7FE40] font-bold uppercase tracking-widest">{key.replace(/_/g, ' ')}</p>
                                 <p className="text-gray-200 pl-3 border-l-2 border-gray-600">
                                    {msg.promptData![key].valeur}
                                 </p>
                             </div>
                         ))}
                     </div>
                     <button
                        onClick={() => onUsePrompt(msg.promptData!)}
                        className="bg-lime-400/20 text-lime-300 border border-lime-400/30 rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-lime-400/30 w-full transition-all"
                    >
                        <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>
                        Utiliser ce prompt
                    </button>
                </div>
            )}
        </div>
    );
};


export const Chatbot: React.FC<ChatbotProps> = ({ 
    apiConfig, 
    currentPrompt, 
    onClose, 
    onPromptUpdate,
    persona,
    setPersona,
    conversations,
    setConversations
}) => {
    const [userInput, setUserInput] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [imageFile, setImageFile] = React.useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const personaConfig = {
        expert: {
            name: "Expert Prompt",
            systemInstruction: `Tu es un chatbot expert en rédaction de prompts pour les générateurs d'images IA. Ton but est d'aider l'utilisateur à créer ou affiner un prompt.
- **Mockups :** Pour les mockups (t-shirts, etc.), utilise la formule "Full blank [objet]" et ne jamais utiliser le mot "mockup" dans la sortie JSON.
- **Structure de prompt :** Tu connais la structure JSON que l'application utilise : un objet avec des clés (sujet, style, etc.), où chaque clé a un objet avec "valeur" (string) et "alternatives" (array of 4 strings).
- **Modification de prompt :** Si l'utilisateur demande une modification qui doit mettre à jour le prompt (ex: "ajoute un champ pour la météo", "rends le style plus vintage", "inspire-toi de cette image"), tu DOIS répondre **UNIQUEMENT** avec l'objet JSON complet et mis à jour du prompt. Ne mets AUCUN texte avant ou après, et pas de markdown. Tu peux ajouter, supprimer ou modifier des clés dans le JSON.
- **Réponse standard :** Pour toute autre question, réponds normalement en français, de manière concise et utile.`,
            initialMessage: currentPrompt
                ? "Je vois que vous travaillez sur un prompt. Comment puis-je vous aider à l'améliorer ? Vous pouvez me demander de modifier un champ, d'en ajouter un, ou de changer le style en vous basant sur du texte ou une image."
                : "Bonjour ! Je suis votre assistant expert en prompts. Comment puis-je vous aider à créer le prompt parfait aujourd'hui ?",
        },
        generalist: {
            name: "Généraliste",
            systemInstruction: "Tu es un assistant IA généraliste et serviable. Réponds aux questions de l'utilisateur de manière claire et concise.",
            initialMessage: "Bonjour ! Comment puis-je vous aider aujourd'hui ?"
        }
    };
    
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [conversations, persona]);

    const handleNewConversation = () => {
        setConversations(prev => ({
            ...prev,
            [persona]: [{ role: 'assistant', content: personaConfig[persona].initialMessage }]
        }));
    };

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            setImageFile(file);
            setImagePreviewUrl(URL.createObjectURL(file));
        }
    };
    
    const handleRemoveImage = () => {
        setImageFile(null);
        if (imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl);
            setImagePreviewUrl(null);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleUsePrompt = (promptData: PromptData) => {
        onPromptUpdate(promptData);
        
        const confirmationMessage: ChatMessage = { role: 'assistant', content: "Parfait, le prompt a été mis à jour dans l'éditeur !" };
        setConversations(prev => ({
            ...prev,
            [persona]: [...prev[persona], confirmationMessage]
        }));
    };

    const handleSubmit = async () => {
        if ((!userInput.trim() && !imageFile) || isLoading) return;

        const newUserMessage: ChatMessage = { role: 'user', content: userInput, imagePreviewUrl: imagePreviewUrl };
        setConversations(prev => ({ ...prev, [persona]: [...prev[persona], newUserMessage] }));
        
        const textToSend = userInput;
        const imageToSend = imageFile;
        setUserInput('');
        handleRemoveImage();
        setIsLoading(true);

        try {
            const apiMessages: any[] = [];
            const userMessageContent: any[] = [];
            if(textToSend.trim()) {
                userMessageContent.push({ type: 'text', text: textToSend });
            }
            if(imageToSend) {
                const dataUrl = await fileToDataUrl(imageToSend);
                userMessageContent.push({ type: 'image_url', image_url: { url: dataUrl } });
            }
            apiMessages.push({ role: 'user', content: userMessageContent });

            if (persona === 'expert' && currentPrompt) {
                 apiMessages.unshift({
                    role: 'system',
                    content: `CONTEXTE: L'utilisateur travaille actuellement sur ce prompt JSON : ${JSON.stringify(currentPrompt)}`
                });
            }
            
            const response = await continueChat(apiConfig, apiMessages, personaConfig[persona].systemInstruction);
            
            let assistantMessage: ChatMessage;
            if (response && typeof response === 'object') {
                assistantMessage = { role: 'assistant', content: "Voici une proposition de prompt :", promptData: response };
            } else if (typeof response === 'string') {
                assistantMessage = { role: 'assistant', content: response };
            } else {
                 assistantMessage = { role: 'assistant', content: "Désolé, je n'ai pas pu traiter cette demande. Veuillez réessayer." };
            }
            setConversations(prev => ({ ...prev, [persona]: [...prev[persona], assistantMessage]}));

        } catch (error: any) {
            const errorMessage: ChatMessage = { role: 'assistant', content: `Une erreur est survenue: ${error.message}` };
            setConversations(prev => ({ ...prev, [persona]: [...prev[persona], errorMessage]}));
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
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/png, image/jpeg, image/webp"
                style={{ display: 'none' }}
            />
            <header className="flex items-center justify-between p-3 sm:p-4 border-b border-white/10 shrink-0 flex-wrap gap-2">
                 <div className="flex items-center gap-2">
                    <div className="p-1 bg-white/5 rounded-lg flex items-center">
                        {(['expert', 'generalist'] as Persona[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setPersona(p)}
                                className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${persona === p ? 'bg-[#D7FE40] text-black' : 'text-gray-300 hover:bg-white/10'}`}
                            >
                                {personaConfig[p].name}
                            </button>
                        ))}
                    </div>
                 </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleNewConversation}
                        className="h-9 w-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Nouvelle conversation"
                    >
                        <i className="fa-solid fa-plus-square text-lg"></i>
                    </button>
                    <button 
                        onClick={onClose} 
                        className="h-9 w-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Fermer le chatbot"
                    >
                        <i className="fa-solid fa-times text-lg"></i>
                    </button>
                </div>
            </header>

            <main className="flex-grow p-4 sm:p-6 overflow-y-auto">
                <div className="space-y-6">
                    {conversations[persona].filter(m => m.role !== 'system').map((msg, index) => (
                        <div key={index} className={`flex gap-3 animate-fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-[#D7FE40] flex items-center justify-center text-black shrink-0">
                                    <i className="fa-solid fa-robot text-sm"></i>
                                </div>
                            )}
                            <ChatMessageView msg={msg} onUsePrompt={handleUsePrompt} />
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
                {imagePreviewUrl && (
                     <div className="mb-3 relative w-24 h-24 group animate-fade-in">
                        <img src={imagePreviewUrl} alt="Aperçu de l'image" className="w-full h-full object-cover rounded-lg border-2 border-white/20" />
                        <button
                            onClick={handleRemoveImage}
                            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full h-7 w-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-700"
                            aria-label="Supprimer l'image"
                        >
                            <i className="fa-solid fa-times text-sm"></i>
                        </button>
                    </div>
                )}
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
                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-14 text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-[#D7FE40]"
                        rows={1}
                        style={{ height: 'auto', maxHeight: '150px' }}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                        }}
                    />
                     <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 text-gray-400 rounded-full flex items-center justify-center hover:bg-white/10 hover:text-white transition-all"
                        aria-label="Envoyer une image"
                    >
                         <i className="fa-solid fa-paperclip"></i>
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || (!userInput.trim() && !imageFile)}
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