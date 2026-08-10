import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './strength.css';
import StrengthIndex from './strength/StrengthIndex.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StrengthIndex />
  </StrictMode>,
);
