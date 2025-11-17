import React, { createContext, useContext, useEffect, useState } from 'react';

interface ContrastContextType {
  isHighContrast: boolean;
  toggleHighContrast: () => void;
}

const ContrastContext = createContext<ContrastContextType | undefined>(undefined);

export const ContrastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isHighContrast, setIsHighContrast] = useState(() => {
    const stored = localStorage.getItem('high-contrast-mode');
    return stored === 'true';
  });

  useEffect(() => {
    if (isHighContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    localStorage.setItem('high-contrast-mode', String(isHighContrast));
  }, [isHighContrast]);

  const toggleHighContrast = () => {
    setIsHighContrast(prev => !prev);
  };

  return (
    <ContrastContext.Provider value={{ isHighContrast, toggleHighContrast }}>
      {children}
    </ContrastContext.Provider>
  );
};

export const useContrast = () => {
  const context = useContext(ContrastContext);
  if (context === undefined) {
    throw new Error('useContrast must be used within a ContrastProvider');
  }
  return context;
};
