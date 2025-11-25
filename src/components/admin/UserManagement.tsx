import { useState } from 'react';
import { Search, User as UserIcon, Mail, Phone, IdCard, Calendar } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';

interface UserManagementProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

const users = [
  { 
    id: '1', 
    name: 'John Doe', 
    email: 'john.doe@company.com', 
    epf: 'EPF12345', 
    phone: '+94 77 123 4567',
    department: 'Marketing',
    joinDate: '2023-01-15',
    totalTrips: 24
  },
  { 
    id: '2', 
    name: 'Jane Smith', 
    email: 'jane.smith@company.com', 
    epf: 'EPF67890', 
    phone: '+94 77 234 5678',
    department: 'Sales',
    joinDate: '2022-08-20',
    totalTrips: 38
  },
  { 
    id: '3', 
    name: 'Robert Chen', 
    email: 'robert.chen@company.com', 
    epf: 'EPF54321', 
    phone: '+94 77 456 7890',
    department: 'IT',
    joinDate: '2024-03-10',
    totalTrips: 12
  },
];

export function UserManagement({ user, onNavigate, onLogout }: UserManagementProps) {
  const [searchType, setSearchType] = useState<'epf' | 'name' | 'email'>('epf');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    if (searchType === 'epf') return u.epf.toLowerCase().includes(query);
    if (searchType === 'name') return u.name.toLowerCase().includes(query);
    if (searchType === 'email') return u.email.toLowerCase().includes(query);
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="user-management" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-3xl text-gray-900 mb-2">User Management</h1>
          <p className="text-gray-600">Search and manage user accounts</p>
        </div>

        {/* Search Section */}
        <Card className="p-6 mb-8">
          <h2 className="text-lg text-gray-900 mb-4">Search Users</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm text-gray-700 mb-2">Search By</label>
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as any)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="epf">EPF Number</option>
                <option value="name">Name</option>
                <option value="email">Email</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm text-gray-700 mb-2">Search Query</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search by ${searchType === 'epf' ? 'EPF number' : searchType}...`}
                  className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>
        </Card>

        {/* Results */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Found {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
            </div>
            
            {filteredUsers.map((u) => (
              <Card 
                key={u.id} 
                onClick={() => setSelectedUser(u)}
                className={`p-6 cursor-pointer transition-all ${
                  selectedUser?.id === u.id ? 'ring-2 ring-[#2563EB]' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-lg text-gray-900 mb-1">{u.name}</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <IdCard className="w-4 h-4 text-gray-400" />
                        {u.epf}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4 text-gray-400" />
                        {u.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {u.phone}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl text-gray-900">{u.totalTrips}</div>
                    <div className="text-xs text-gray-500">Total Trips</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* User Details */}
          <div className="lg:col-span-1">
            {selectedUser ? (
              <Card className="p-6 sticky top-24">
                <h2 className="text-lg text-gray-900 mb-6">User Profile</h2>
                
                <div className="flex items-center justify-center mb-6">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                    <UserIcon className="w-10 h-10 text-gray-600" />
                  </div>
                </div>

                <div className="text-center mb-6">
                  <div className="text-xl text-gray-900 mb-1">{selectedUser.name}</div>
                  <div className="text-sm text-gray-500">{selectedUser.department}</div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">EPF Number</div>
                    <div className="text-gray-900">{selectedUser.epf}</div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">Email</div>
                    <div className="text-gray-900 text-sm break-all">{selectedUser.email}</div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">Phone</div>
                    <div className="text-gray-900">{selectedUser.phone}</div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">Join Date</div>
                    <div className="text-gray-900">{selectedUser.joinDate}</div>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">Total Trips</div>
                    <div className="text-2xl text-gray-900">{selectedUser.totalTrips}</div>
                  </div>
                </div>

                <button
                  onClick={() => onNavigate('trip-history')}
                  className="w-full mt-6 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all"
                >
                  View Trip History
                </button>
              </Card>
            ) : (
              <Card className="p-12 text-center">
                <UserIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Select a user to view details</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
