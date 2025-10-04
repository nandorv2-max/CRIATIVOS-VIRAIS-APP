import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { getAdminSupportTickets, updateSupportTicketStatus, adminAddSupportMessage } from '../../services/databaseService.ts';
import type { SupportTicket, TicketStatus } from '../../types.ts';
import { helpContent } from './HelpView.tsx';
import Button from '../Button.tsx';

const parseHelpContent = (content: string): { question: string; answer: string }[] => {
    const faqs: { question: string; answer: string }[] = [];
    const sections = content.split('# ').filter(s => s.trim());
  
    sections.forEach(section => {
      const subSections = section.split('## ').slice(1);
      subSections.forEach(subSection => {
        const lines = subSection.split('\n');
        const question = lines[0].trim();
        const answer = lines.slice(1).join('\n')
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/`{3}[\s\S]*?`{3}/g, '') // Remove code blocks
            .replace(/(\*|_|`)/g, '') // Remove markdown emphasis
            .trim();
        if (question && answer) {
          faqs.push({ question, answer });
        }
      });
    });
  
    return faqs;
};

const TicketCard: React.FC<{ 
    ticket: SupportTicket; 
    onReply: (ticketId: string, message: string) => void;
    faqs: { question: string; answer: string }[];
}> = ({ ticket, onReply, faqs }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [reply, setReply] = useState('');

    const handleSendReply = () => {
        if (reply.trim()) {
            onReply(ticket.id, reply.trim());
            setReply('');
        }
    };

    return (
        <Reorder.Item
            value={ticket}
            id={ticket.id}
            className="bg-brand-light p-4 rounded-lg shadow-md cursor-grab active:cursor-grabbing"
            draggable={true}
            onDragStart={(e) => {
                e.dataTransfer.setData('application/json', JSON.stringify(ticket));
            }}
        >
            <div onClick={() => setIsExpanded(!isExpanded)} className="cursor-pointer">
                <p className="font-semibold text-white truncate">{ticket.subject}</p>
                <p className="text-xs text-gray-400 truncate">{ticket.user_email}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(ticket.created_at).toLocaleString()}</p>
            </div>
            <AnimatePresence>
            {isExpanded && (
                <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-4 pt-4 border-t border-brand-accent/50 space-y-4 overflow-hidden"
                >
                    <div>
                        <h4 className="text-sm font-bold mb-2">Histórico do Chat:</h4>
                        <div className="max-h-40 overflow-y-auto pr-2 space-y-2">
                            {ticket.messages.map(msg => (
                                <div key={msg.id} className={`text-xs p-2 rounded-md ${msg.sender === 'user' ? 'bg-brand-dark/50' : 'bg-brand-accent/30'}`}>
                                    <span className={`font-bold ${msg.sender === 'user' ? 'text-brand-secondary' : 'text-brand-primary'}`}>{msg.sender === 'user' ? 'Usuário' : 'Agente'}: </span>
                                    {msg.content}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold mb-2">Respostas Rápidas (FAQ)</h4>
                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                            {faqs.map((faq, i) => (
                                <button key={i} onClick={() => onReply(ticket.id, faq.answer)} className="w-full text-left text-xs p-2 rounded bg-brand-dark/50 hover:bg-brand-accent/50 transition-colors">
                                    {faq.question}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escreva uma resposta personalizada..." className="w-full bg-brand-dark border border-brand-accent rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary resize-y" rows={3}></textarea>
                        <Button onClick={handleSendReply} primary className="w-full !py-1 text-sm">Enviar Resposta</Button>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
        </Reorder.Item>
    );
};

const KanbanColumn: React.FC<{
    title: string;
    tickets: SupportTicket[];
    onReply: (ticketId: string, message: string) => void;
    faqs: { question: string; answer: string }[];
}> = ({ title, tickets, onReply, faqs }) => {
    return (
        <div className="w-80 bg-brand-dark/50 rounded-lg p-3 flex flex-col flex-shrink-0 h-full">
            <h3 className="font-bold text-lg mb-4 px-2 flex-shrink-0">{title} ({tickets.length})</h3>
            <Reorder.Group
                axis="y"
                values={tickets}
                onReorder={() => {}} // Reordering is visual only, status change on drop
                className="flex-grow space-y-3 overflow-y-auto p-1"
            >
                {tickets.map(ticket => (
                    <TicketCard key={ticket.id} ticket={ticket} onReply={onReply} faqs={faqs} />
                ))}
            </Reorder.Group>
        </div>
    );
};

const SupportKanbanView: React.FC = () => {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const faqs = useMemo(() => parseHelpContent(helpContent), []);

    const fetchTickets = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getAdminSupportTickets();
            setTickets(data);
        } catch (err) {
            setError("Falha ao carregar os tickets de suporte.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    const handleDragEnd = async (ticket: SupportTicket, newStatus: TicketStatus) => {
        if (ticket.status === newStatus) return;

        const originalTickets = tickets;
        setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: newStatus } : t));

        try {
            await updateSupportTicketStatus(ticket.id, newStatus);
        } catch (err) {
            setError("Falha ao atualizar o status do ticket.");
            setTickets(originalTickets);
        }
    };

    const handleAdminReply = async (ticketId: string, message: string) => {
        try {
            await adminAddSupportMessage(ticketId, message);
            await fetchTickets();
        } catch (err) {
            setError("Falha ao enviar a resposta.");
        }
    };

    const columns: { title: string, status: TicketStatus }[] = [
        { title: "Novos", status: "new" },
        { title: "Em Andamento", status: "in_progress" },
        { title: "Resolvido", status: "resolved" },
    ];

    return (
        <div className="h-full w-full flex flex-col p-6">
            <header className="mb-6 flex-shrink-0">
                <h1 className="text-3xl font-bold">Painel de Suporte</h1>
                <p className="text-gray-300 mt-1">Gerencie os tickets de suporte dos usuários.</p>
            </header>
            {isLoading ? (
                <div className="flex-grow flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
                </div>
            ) : error ? (
                <div className="flex-grow flex items-center justify-center text-red-400">{error}</div>
            ) : (
                <div className="flex-grow flex gap-6 overflow-x-auto pb-4">
                    {columns.map(({ title, status }) => (
                        <motion.div
                            key={status}
                            className="h-full"
                            onDrop={(e) => {
                                e.preventDefault();
                                const ticketJSON = e.dataTransfer.getData('application/json');
                                if (ticketJSON) {
                                    try {
                                        const ticket = JSON.parse(ticketJSON);
                                        handleDragEnd(ticket, status);
                                    } catch (e) { console.error("Failed to parse dropped ticket data", e); }
                                }
                            }}
                            onDragOver={(e) => e.preventDefault()}
                        >
                            <KanbanColumn
                                title={title}
                                tickets={tickets.filter(t => t.status === status)}
                                onReply={handleAdminReply}
                                faqs={faqs}
                            />
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SupportKanbanView;