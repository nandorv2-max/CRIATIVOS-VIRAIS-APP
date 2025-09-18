import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// FIX: Use `(window as any).document` to access the DOM when the `Window` type definition is incomplete and causes a "Property 'document' does not exist on type 'Window'" error.
const rootElement = (window as any).document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);