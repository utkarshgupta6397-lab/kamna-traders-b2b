'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import TaskFloatingTrigger from './TaskFloatingTrigger';
import GlobalTaskDrawer from './GlobalTaskDrawer';
import GlobalNewTaskModal from './GlobalNewTaskModal';

interface TaskDrawerContextType {
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  openNewTaskModal: (prefilledOrder?: any) => void;
}

const TaskDrawerContext = createContext<TaskDrawerContextType | undefined>(undefined);

export function useGlobalTaskDrawer() {
  const context = useContext(TaskDrawerContext);
  if (!context) {
    throw new Error('useGlobalTaskDrawer must be used within a GlobalTaskDrawerProvider');
  }
  return context;
}

interface GlobalTaskDrawerProviderProps {
  children: ReactNode;
  currentUserId: string;
}

export function GlobalTaskDrawerProvider({ children, currentUserId }: GlobalTaskDrawerProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [prefilledOrder, setPrefilledOrder] = useState<any | undefined>(undefined);
  
  const [users, setUsers] = useState<any[]>([]);

  // Fetch users once for the modal
  useEffect(() => {
    fetch('/api/solar-tasks?filter=ALL')
      .then(res => res.json())
      .then(data => {
        if (data.users) setUsers(data.users);
      })
      .catch(console.error);
  }, []);

  const openDrawer = () => setIsOpen(true);
  const closeDrawer = () => setIsOpen(false);
  const toggleDrawer = () => setIsOpen(prev => !prev);
  const openNewTaskModal = (order?: any) => {
    setPrefilledOrder(order);
    setIsNewTaskModalOpen(true);
  };

  return (
    <TaskDrawerContext.Provider value={{ isOpen, openDrawer, closeDrawer, toggleDrawer, openNewTaskModal }}>
      {children}
      <TaskFloatingTrigger />
      <GlobalTaskDrawer currentUserId={currentUserId} />
      {isNewTaskModalOpen && (
        <GlobalNewTaskModal 
          users={users} 
          currentUserId={currentUserId}
          prefilledOrder={prefilledOrder}
          onClose={() => {
            setIsNewTaskModalOpen(false);
            setPrefilledOrder(undefined);
          }} 
          onSuccess={() => {
            setIsNewTaskModalOpen(false);
            setPrefilledOrder(undefined);
            // We could trigger a refresh of the drawer if it's open, but it fetches on open anyway
          }} 
        />
      )}
    </TaskDrawerContext.Provider>
  );
}
