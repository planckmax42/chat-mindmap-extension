/**
 * SidePanel 入口
 * React 18 createRoot 初始化，引入 Tailwind CSS 样式。
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
