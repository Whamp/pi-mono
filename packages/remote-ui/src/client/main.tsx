import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './index.css';

// Polyfills
import { Buffer } from './mocks/buffer.js';
(window as any).Buffer = Buffer;

// Process polyfill
if (typeof (window as any).process === 'undefined') {
    (window as any).process = {
        env: {},
        cwd: () => '/',
        platform: 'browser',
        versions: {},
        version: ''
    };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
