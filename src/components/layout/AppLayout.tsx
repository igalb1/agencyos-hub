import { ReactNode } from 'react';
import { OnboardingDialog } from '@/components/OnboardingDialog';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <OnboardingDialog />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
