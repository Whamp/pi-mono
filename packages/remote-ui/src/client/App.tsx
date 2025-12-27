import React, { useEffect, useState, useRef } from 'react';
import {
  ChatPanel,
  Agent,
} from '@mariozechner/pi-web-ui';
import { WebSocketTransport } from './WebSocketTransport.js';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'chat-panel': any;
    }
  }
}

function App() {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [agent, setAgent] = useState<Agent | null>(null);
  const transportRef = useRef<WebSocketTransport | null>(null);
  const chatPanelRef = useRef<any>(null);

  useEffect(() => {
    // Initialize transport
    const transport = new WebSocketTransport(() => {
      // On connect, fetch sessions
      fetch('/api/sessions')
        .then(res => res.json())
        .then(data => setSessions(data))
        .catch(err => console.error("Failed to fetch sessions", err));
    });

    transport.onSessionStarted = (data: any) => {
        // Create Agent with initial state
        const newAgent = new Agent({
            initialState: {
                messages: data.history || [],
                model: data.model,
                thinkingLevel: 'off',
                systemPrompt: '',
                tools: [],
            },
            transport: transport
        });

        setAgent(newAgent);
        setSessionStarted(true);
    };

    transport.onHistoryUpdate = (history: any[]) => {
        if (agent) {
             // Sync history to get tool calls/results correctly displayed
             agent.replaceMessages(history);
        }
    };

    transportRef.current = transport;

    return () => {
        transport.abort();
    };
  }, [agent]); // Re-bind onHistoryUpdate if agent changes (though agent is closure)

  // Actually transport.onHistoryUpdate relies on `agent` state variable which is captured in closure.
  // We need to update the callback when agent changes.

  useEffect(() => {
      if (transportRef.current && agent) {
          transportRef.current.onHistoryUpdate = (history: any[]) => {
              agent.replaceMessages(history);
          };
      }
  }, [agent]);


  useEffect(() => {
    if (sessionStarted && agent && chatPanelRef.current) {
        chatPanelRef.current.setAgent(agent);
    }
  }, [sessionStarted, agent]);

  const startNewSession = () => {
      transportRef.current?.startSession(); // No path = new
  };

  const resumeSession = (path: string) => {
      transportRef.current?.startSession(path);
  };

  if (!sessionStarted) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-4">
        <h1 className="text-2xl mb-8">Pi Remote</h1>

        <div className="w-full max-w-md space-y-4">
          <button
            onClick={startNewSession}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Start New Session
          </button>

          <div className="border-t border-gray-700 my-4 pt-4">
            <h2 className="text-xl mb-4 text-gray-400">Resume Session</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sessions.map((session: any) => (
                <button
                  key={session.path}
                  onClick={() => resumeSession(session.path)}
                  className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-colors"
                >
                  <div className="font-medium truncate">{session.path.split('/').pop()}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(session.modified).toLocaleString()}
                  </div>
                </button>
              ))}
              {sessions.length === 0 && (
                <div className="text-gray-500 text-center py-4">No saved sessions found</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-900">
      <chat-panel ref={chatPanelRef} class="h-full w-full"></chat-panel>
    </div>
  );
}

export default App;
