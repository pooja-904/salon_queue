import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import './index.css';
import { LangProvider } from './i18n/i18n';
import Home from './pages/Home';
import Join from './pages/Join';
import Status from './pages/Status';
import Reception from './pages/Reception';
import Barber from './pages/Barber';
import Display from './pages/Display';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
    <LangProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/join" element={<Join />} />
          <Route path="/status/:id" element={<Status />} />
          <Route path="/reception" element={<Reception />} />
          <Route path="/barber" element={<Barber />} />
          <Route path="/barber/:id" element={<Barber />} />
          <Route path="/display" element={<Display />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </LangProvider>
    </MotionConfig>
  </StrictMode>,
);
