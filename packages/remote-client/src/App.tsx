import { useEffect, useState } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { RpcClient } from './rpc-client';

function App() {
  const [client, setClient] = useState<RpcClient | null>(null);

  useEffect(() => {
    // Get token from URL query param
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      const newClient = new RpcClient(token);
      newClient.connect();
      setClient(newClient);
    }
  }, []);

  if (!client) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center p-8 bg-gray-800 rounded-lg shadow-xl max-w-sm mx-4">
          <h1 className="text-2xl font-bold mb-4 text-red-400">Authentication Required</h1>
          <p className="text-gray-300">
            No access token found. Please open the link provided by the server console (e.g. scan the QR code).
          </p>
        </div>
      </div>
    );
  }

  return <ChatInterface client={client} />;
}

export default App;
