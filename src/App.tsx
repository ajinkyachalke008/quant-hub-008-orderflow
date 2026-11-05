/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TerminalProvider, useTerminal } from './context/TerminalContext';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Workspace } from './components/Workspace';
import { CommandPalette } from './components/CommandPalette';

const TerminalShell: React.FC = () => {
  const { scanlines, theme } = useTerminal();

  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden ${
        scanlines || theme === 'retro' ? 'crt-scanlines' : ''
      }`}
      style={{
        backgroundColor: 'var(--ot-bg-root)',
        color: 'var(--ot-text-primary)',
      }}
    >
      {/* Top HUD & Navigation Bar */}
      <TopBar />

      {/* Main Body: Sidebar + Dynamic Workspace */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Workspace />
        </main>
      </div>

      {/* Global ⌘K Command Palette Modal */}
      <CommandPalette />
    </div>
  );
};

export default function App() {
  return (
    <TerminalProvider>
      <TerminalShell />
    </TerminalProvider>
  );
}
