import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl shadow-sm border border-gray-200 ${
        onClick ? 'cursor-pointer hover:shadow-md transition-all' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
