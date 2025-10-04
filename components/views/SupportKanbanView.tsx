import React, { useState, useEffect, useCallback } from 'react';
import { motion, Reorder } from 'framer-motion';
import { getAdminSupportTickets, updateSupportTicketStatus } from '../../services/databaseService.ts';
import type { SupportTicket, TicketStatus } from '../../types.ts';

const TicketCard: React.FC<{ ticket: SupportTicket }> = ({ ticket }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    return (
        <Reorder.Item
            value={ticket}
            className="bg-brand-light p-4 rounded-lg shadow-md cursor-grab active:cursor-grabbing"
        >
            <div onClick={() => setIsExpanded(!isExpanded)} className="cursor-pointer">
                <p className="font-semibold text-white truncate">{ticket.subject}</p>
                <p className="text-xs text-gray-400 truncate">{ticket.user_email}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(ticket.created_at).toLocaleString()}</p>
            </div>
            {isExpanded && (
                <div className="mt-4 pt-2 border-t border-brand-accent/50 max-h-60 overflow-y-auto pr-2">
                    <h4 className="text-sm font-bold mb-2">Histórico do Chat:</h4>
                    {ticket.messages.map(msg => (
                        <div key={msg.id} className={`mb-2 text-xs p-2 rounded-md ${msg.sender === 'user' ? 'bg-brand-dark/50' : 'bg-brand-accent/30'}`}>
                            <span className={`font-bold ${msg.sender === 'user' ? 'text-brand-secondary' : 'text-brand-primary'}`}>{msg.sender === 'user' ? 'Usuário' : 'IA'}: </span>
                            {msg.content}
                        </div>
                    ))}
                </div>
            )}
        </Reorder.Item>
    );
};

const KanbanColumn: React.FC<{
    title: string;
    status: TicketStatus;
    tickets: SupportTicket[];
    setTickets: React.Dispatch<React.SetStateAction<SupportTicket[]>>;
}> = ({ title, status, tickets, setTickets }) => {
    const handleReorder = (newOrder: SupportTicket[]) => {
        // This only updates the visual order. The status change is handled on drop.
        setTickets(currentTickets => {
            const otherTickets = currentTickets.filter(t => t.status !== status);
            return [...otherTickets, ...newOrder];
        });
    };

    return (
        <div className="w-80 bg-brand-dark/50 rounded-lg p-3 flex flex-col flex-shrink-0">
            <h3 className="font-bold text-lg mb-4 px-2">{title} ({tickets.length})</h3>
            <Reorder.Group
                axis="y"
                values={tickets}
                onReorder={handleReorder}
                className="flex-grow space-y-3 overflow-y-auto p-1"
            >
                {tickets.map(ticket => (
                    <TicketCard key={ticket.id} ticket={ticket} />
                ))}
            </Reorder.Group>
        </div>
    );
};

const SupportKanbanView: React.FC = () => {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
        // Optimistic update
        setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: newStatus } : t));

        try {
            await updateSupportTicketStatus(ticket.id, newStatus);
        } catch (err) {
            setError("Falha ao atualizar o status do ticket.");
            // Revert on failure
            setTickets(originalTickets);
        }
    };

    const columns: { title: string, status: TicketStatus }[] = [
        { title: "Novos", status: "new" },
        { title: "Em Andamento", status: "in_progress" },
        { title: "Resolvido", status: "resolved" },
    ];

    return (
        <div className="h-full w-full flex flex-col p-6">
            <header className="mb-6">
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
                            onDrop={(e) => {
                                const ticketId = e.dataTransfer.getData('application/json');
                                const ticket = tickets.find(t => t.id === ticketId);
                                if (ticket) handleDragEnd(ticket, status);
                            }}
                            onDragOver={(e) => e.preventDefault()}
                        >
                            <KanbanColumn
                                title={title}
                                status={status}
                                tickets={tickets.filter(t => t.status === status)}
                                setTickets={setTickets}
                            />
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SupportKanbanView;