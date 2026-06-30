import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';

declare global {
  interface Window {
    __BASE_URL__?: string;
  }
}

const basename =
  (typeof window !== 'undefined' && window.__BASE_URL__) || import.meta.env.BASE_URL;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
