import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './independence.css';
import IndependenceIndex from './independence/IndependenceIndex.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <IndependenceIndex />
  </StrictMode>,
);
