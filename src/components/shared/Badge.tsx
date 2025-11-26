import React from 'react';

interface BadgeProps {
  // Added 'pending' to the type definition to match your database status
  status: 'available' | 'in-use' | 'maintenance' | 'requested' | 'approved' | 'in-progress' | 'completed' | 'cancelled' | 'rejected' | 'pending';
  size?: 'sm' | 'md';
}

export function Badge({ status, size = 'md' }: BadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5';
  
  // Added type annotation for safety
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    available: { bg: 'bg-green-100', text: 'text-green-800', label: 'Available' },
    'in-use': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Use' },
    maintenance: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Maintenance' },
    requested: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Requested' },
    // Added 'pending' mapping (same style as requested)
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
    approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
    'in-progress': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Progress' },
    completed: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Completed' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
  };

  // Fallback to 'available' or a neutral style if status is missing/undefined
  const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };

  return (
    <span className={`inline-flex items-center rounded-full ${config.bg} ${config.text} ${sizeClasses}`}>
      {config.label}
    </span>
  );
}