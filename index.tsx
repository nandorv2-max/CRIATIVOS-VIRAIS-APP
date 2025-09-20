import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// Este bloco de verificação garante que o código de manipulação do DOM só é executado num ambiente de navegador,
// prevenindo um crash de "window is not defined" em ambientes de servidor ou de compilação,
// o que estava a causar a falha no arranque do contentor no Cloud Run.
if (typeof window !== 'undefined') {
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
}
