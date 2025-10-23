"use client";
import {toast,Toaster} from 'react-hot-toast';
import { deinit, isInitialized } from "../lib/nexus/nexusClient";

export default function DeinitButton({
  className,
  onDone,
}: {
  className?: string;
  onDone?: () => void;
}) {
  const onClick = async () => {
    await deinit();
    onDone?.();
    toast.success("Nexus de-initialized");
  };
  return (
    <div>
       <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1a1a1a',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        
    <button className={className} onClick={onClick} disabled={!isInitialized()}>
      De-initialize
    </button>
    </div>
  );
}
