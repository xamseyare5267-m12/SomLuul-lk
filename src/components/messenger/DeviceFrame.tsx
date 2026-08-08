import React from 'react';

interface DeviceFrameProps {
  children: React.ReactNode;
  language: 'so' | 'en';
}

export const DeviceFrame: React.FC<DeviceFrameProps> = ({ children }) => {
  return (
    <div className="w-full h-full">
      {children}
    </div>
  );
};

