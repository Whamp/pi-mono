import React, { useEffect, useState, useRef } from 'react';
import { Send, Square, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RpcClient } from '../rpc-client';

interface ChatInterfaceProps {
    client: RpcClient;
}

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    toolCalls?: any[];
    thinking?: string;
    isStreaming?: boolean;
}

export function ChatInterface({ client }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Subscribe to events
        const unsubscribe = client.subscribe((event) => {
            handleEvent(event);
        });

        // Initial connection check
        // We'll rely on the event 'connection_status' from RpcClient

        return () => {
            unsubscribe();
        };
    }, [client]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isStreaming]);

    const handleEvent = (event: any) => {
        if (event.type === 'connection_status') {
            setIsConnected(event.status === 'connected');
            if (event.status === 'connected') {
                // Fetch state/history on connect
                client.send('get_messages').then((res) => {
                    if (res.success && res.data?.messages) {
                        // Map AppMessage to our Message format
                        const mapped = res.data.messages.map((m: any) => ({
                            id: m.id || crypto.randomUUID(),
                            role: m.role,
                            content: extractText(m.content),
                            // TODO: Handle tool calls properly
                        }));
                        setMessages(mapped);
                    }
                }).catch(console.error);
            }
            return;
        }

        // Handle streaming events
        switch (event.type) {
            case 'text_start':
            case 'text_delta':
            case 'text_end':
                handleTextEvent(event);
                break;
            case 'thinking_start':
            case 'thinking_delta':
            case 'thinking_end':
                // TODO: Handle thinking
                break;
            case 'message_start':
                // New message started
                if (event.message.role === 'assistant') {
                    setIsStreaming(true);
                    setMessages(prev => [...prev, {
                        id: crypto.randomUUID(), // Temporarily ID
                        role: 'assistant',
                        content: '',
                        isStreaming: true
                    }]);
                }
                break;
            case 'message_end':
                setIsStreaming(false);
                setMessages(prev => {
                   const last = prev[prev.length - 1];
                   if (last && last.isStreaming) {
                       return [...prev.slice(0, -1), { ...last, isStreaming: false }];
                   }
                   return prev;
                });
                break;
            case 'agent_end':
                setIsStreaming(false);
                break;
        }
    };

    const handleTextEvent = (event: any) => {
        setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.isStreaming) {
                // If delta, append. If full content (end), replace?
                // Pi agent sends deltas.
                const newContent = last.content + (event.delta || '');
                return [...prev.slice(0, -1), { ...last, content: newContent }];
            }
            return prev;
        });
    };

    const extractText = (content: any): string => {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content.filter(c => c.type === 'text').map(c => c.text).join('');
        }
        return '';
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const text = input;
        setInput('');

        // Slash command parsing
        if (text.startsWith('/')) {
            const [cmd, ...args] = text.slice(1).split(' ');

            if (cmd === 'clear' || cmd === 'reset') {
                await client.send('reset');
                setMessages([]);
                return;
            }

            if (cmd === 'model') {
                 // Example: /model openai gpt-4
                 if (args.length >= 2) {
                     await client.send('set_model', { provider: args[0], modelId: args[1] });
                 } else {
                     // Just show current model? Needs another RPC call or UI state
                     console.log('Usage: /model <provider> <modelId>');
                 }
                 return;
            }

            // Fallback: send as prompt if not handled
        }

        // Optimistic UI update
        setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'user',
            content: text
        }]);

        try {
            await client.send('prompt', { message: text });
        } catch (err) {
            console.error('Failed to send', err);
            // TODO: Show error in UI
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
            {/* Header */}
            <div className="bg-gray-800 p-4 shadow-md flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-green-400" />
                    <h1 className="font-bold text-lg">Pi Remote</h1>
                </div>
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-lg p-3 ${
                            msg.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-800 border border-gray-700'
                        }`}>
                            <div className="prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                            {msg.isStreaming && <span className="animate-pulse inline-block w-2 h-4 bg-gray-400 ml-1"/>}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-gray-800 border-t border-gray-700">
                <div className="flex gap-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message or command (e.g. /help)..."
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-md p-2 focus:outline-none focus:border-blue-500 resize-none h-[44px] max-h-[120px]"
                        rows={1}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!isConnected || isStreaming}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2 rounded-md"
                    >
                        {isStreaming ? <Square className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
