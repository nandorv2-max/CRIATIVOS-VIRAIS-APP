import React, { useState, useRef, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconHelpCircle, IconX, IconUser, IconSparkles } from './Icons.tsx';
import { helpContent } from './views/HelpView.tsx';
import { getChatResponse } from '../services/geminiService.ts';
import { createSupportTicket } from '../services/databaseService.ts';
import Button from './Button.tsx';
import { ApiKeyContext } from '../types.ts';

type Message = {
    role: 'user' | 'model';
    parts: string;
};

const SupportAgent: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const apiKey = useContext(ApiKeyContext);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', parts: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            if (!apiKey) {
                throw new Error("A chave de API do usuário não foi encontrada.");
            }
            const history = [...messages, userMessage];
            const response = await getChatResponse(history, helpContent, apiKey);
            const aiMessage: Message = { role: 'model', parts: response };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error("AI chat failed:", error);
            const errorMessage: Message = { role: 'model', parts: "Desculpe, ocorreu um erro ao conectar com o assistente de IA. Por favor, tente novamente ou escale para o suporte humano." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEscalate = async () => {
        if (messages.length === 0) {
            alert("Por favor, faça uma pergunta primeiro antes de escalar para o suporte.");
            return;
        }
        setIsLoading(true);
        try {
            const subject = messages.find(m => m.role === 'user')?.parts.substring(0, 50) || 'Pedido de Suporte';
            const messagesToSave = messages.map(m => ({ content: m.parts, sender: m.role as 'user' | 'ai' }));
            await createSupportTicket(subject, messagesToSave);
            const confirmationMessage: Message = { role: 'model', parts: "Seu pedido de suporte foi criado! Nossa equipe entrará em contato por e-mail em breve. Esta conversa foi encerrada." };
            setMessages(prev => [...prev, confirmationMessage]);
        } catch (error) {
            console.error("Failed to create support ticket:", error);
            const errorMessage: Message = { role: 'model', parts: "Não foi possível criar o ticket de suporte. Por favor, tente novamente." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 bg-brand-primary text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center z-40"
                aria-label="Abrir chat de ajuda"
            >
                <IconHelpCircle className="w-8 h-8" />
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-24 right-6 w-full max-w-sm h-[70vh] bg-brand-dark border border-brand-accent rounded-2xl shadow-2xl flex flex-col z-50"
                    >
                        <header className="flex justify-between items-center p-4 border-b border-brand-accent">
                            <h3 className="font-bold text-lg">Assistente de IA</h3>
                            <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-brand-light"><IconX /></button>
                        </header>

                        <div className="flex-grow p-4 overflow-y-auto space-y-4">
                            {messages.map((msg, index) => (
                                <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center flex-shrink-0"><IconSparkles className="w-5 h-5 text-white" /></div>}
                                    <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-brand-secondary text-white' : 'bg-brand-light'}`}>
                                        <p className="text-sm whitespace-pre-wrap">{msg.parts}</p>
                                    </div>
                                    {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center flex-shrink-0"><IconUser className="w-5 h-5" /></div>}
                                </div>
                            ))}
                             {isLoading && (
                                <div className="flex gap-3 justify-start">
                                    <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center flex-shrink-0"><IconSparkles className="w-5 h-5 text-white" /></div>
                                    <div className="max-w-[80%] p-3 rounded-lg bg-brand-light animate-pulse">
                                        <div className="h-2 w-16 bg-gray-500 rounded"></div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-4 border-t border-brand-accent">
                            <Button onClick={handleEscalate} disabled={isLoading} className="w-full mb-2 text-xs !py-1">Não encontrou o que precisava? Falar com um humano.</Button>
                            <form onSubmit={handleSendMessage} className="flex gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Pergunte algo..."
                                    className="flex-grow bg-brand-light border border-brand-accent rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                    disabled={isLoading}
                                />
                                <Button type="submit" primary disabled={isLoading || !input.trim()}>Enviar</Button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default SupportAgent;