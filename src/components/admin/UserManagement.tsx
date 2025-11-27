import { useState, useEffect } from 'react';
import { Search, User as UserIcon, Mail, Phone, IdCard, Calendar, Plus, Briefcase, Trash2, Key, AlertTriangle } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
// Firebase Imports
import { collection, getDocs, query, where, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { initializeApp, deleteApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { db, firebaseConfig, auth as mainAuth } from '../../firebase';

interface UserManagementProps {
  user: User;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export function UserManagement({ user, onNavigate, onLogout }: UserManagementProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchType, setSearchType] = useState<'epf' | 'name' | 'email'>('epf');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', epfNumber: '', phone: '', department: '' });
  
  const departments = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"];

  // --- Fetch Data ---
  const fetchData = async () => {
    try {
      const usersQuery = query(collection(db, "users"), where("role", "==", "user"));
      const usersSnapshot = await getDocs(usersQuery);
      const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const tripsSnapshot = await getDocs(collection(db, "trip_requests"));
      const allTrips = tripsSnapshot.docs.map(doc => doc.data());

      const usersWithStats = usersList.map((u: any) => {
        const userTrips = allTrips.filter((t: any) => 
          t.customer === u.name || t.email === u.email || (u.uid && t.userId === u.uid)
        );
        return {
          ...u,
          totalTrips: userTrips.length,
          joinDate: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : 'Unknown'
        };
      });

      setUsers(usersWithStats);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching users:", error);
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- Create User ---
  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.name || !newUser.epfNumber || !newUser.department) {
      alert("Please fill in all required fields.");
      return;
    }
    let secondaryApp;
    try {
      if (getApps().some(app => app.name === "Secondary")) {
        const existingApp = getApp("Secondary");
        await deleteApp(existingApp);
      }
      secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        uid: uid,
        name: newUser.name,
        email: newUser.email,
        epfNumber: newUser.epfNumber,
        phone: newUser.phone,
        department: newUser.department,
        role: 'user',
        createdAt: new Date().toISOString()
      });
      
      alert(`User ${newUser.name} created successfully!`);
      setShowAddModal(false);
      setNewUser({ name: '', email: '', password: '', epfNumber: '', phone: '', department: '' });
      fetchData();
    } catch (error: any) {
      console.error("Error creating user:", error);
      alert("Failed to create user: " + error.message);
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp).catch(console.error);
    }
  };

  // --- Delete User ---
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (!window.confirm(`Are you sure you want to remove ${selectedUser.name}? This action cannot be undone.`)) return;
    
    try {
      await deleteDoc(doc(db, "users", selectedUser.id));
      alert(`User ${selectedUser.name} has been removed.`);
      setSelectedUser(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user profile.");
    }
  };

  // --- Reset Password ---
  const handleResetPassword = async () => {
    if (!selectedUser || !selectedUser.email) return;
    try {
      await sendPasswordResetEmail(mainAuth, selectedUser.email);
      alert(`Password reset email sent to ${selectedUser.email}.`);
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      alert("Failed to send reset email: " + error.message);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    if (searchType === 'epf') return (u.epfNumber || u.epf || '').toLowerCase().includes(query);
    if (searchType === 'name') return (u.name || '').toLowerCase().includes(query);
    if (searchType === 'email') return (u.email || '').toLowerCase().includes(query);
    return true;
  });

  if (loading) return <div className="p-10 text-center">Loading Users...</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="user-management" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl text-gray-900 mb-2">User Management</h1>
            <p className="text-gray-600">Search and manage user accounts</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all">
            <Plus className="w-5 h-5" /> Register User
          </button>
        </div>

        <Card className="p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <select value={searchType} onChange={(e) => setSearchType(e.target.value as any)} className="w-full px-4 py-3 border border-gray-300 rounded-xl">
                <option value="epf">EPF Number</option>
                <option value="name">Name</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <div className="relative">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={`Search...`} className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl" />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {filteredUsers.map((u) => (
              <Card key={u.id} onClick={() => setSelectedUser(u)} className={`p-6 cursor-pointer transition-all ${selectedUser?.id === u.id ? 'ring-2 ring-[#2563EB]' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-lg text-gray-900 mb-1">{u.name}</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600"><IdCard className="w-4 h-4 text-gray-400" />{u.epfNumber || 'No EPF'}</div>
                      <div className="flex items-center gap-2 text-sm text-gray-600"><Briefcase className="w-4 h-4 text-gray-400" />Dept: {u.department || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="lg:col-span-1">
            {selectedUser ? (
              <Card className="p-6 sticky top-24">
                <h2 className="text-lg text-gray-900 mb-6">User Profile</h2>
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3"><UserIcon className="w-10 h-10" /></div>
                  <div className="text-xl text-gray-900">{selectedUser.name}</div>
                  <div className="text-sm text-gray-500">Department: {selectedUser.department || 'None'}</div>
                </div>
                <div className="space-y-4 mb-8">
                  <div className="p-4 bg-gray-50 rounded-xl"><div className="text-xs text-gray-500">EPF</div><div>{selectedUser.epfNumber}</div></div>
                  <div className="p-4 bg-gray-50 rounded-xl"><div className="text-xs text-gray-500">Email</div><div>{selectedUser.email}</div></div>
                  <div className="p-4 bg-gray-50 rounded-xl"><div className="text-xs text-gray-500">Phone</div><div>{selectedUser.phone}</div></div>
                </div>

                <div className="space-y-3">
                  <button onClick={handleResetPassword} className="w-full flex items-center justify-center gap-2 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all">
                    <Key className="w-4 h-4" /> Send Password Reset
                  </button>
                  <button onClick={handleDeleteUser} className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 transition-all">
                    <Trash2 className="w-4 h-4" /> Remove User
                  </button>
                </div>
              </Card>
            ) : (
              <Card className="p-12 text-center">
                <UserIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Select a user to view actions</p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-xl text-gray-900 mb-6">Register New User</h3>
            <div className="space-y-4 mb-6">
              <input type="text" placeholder="Full Name" className="w-full p-3 border rounded-xl" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
              <input type="email" placeholder="Email" className="w-full p-3 border rounded-xl" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              <select className="w-full p-3 border rounded-xl bg-white" value={newUser.department} onChange={e => setNewUser({...newUser, department: e.target.value})}>
                <option value="">Select Department</option>
                {departments.map((dept, index) => (<option key={index} value={dept}>{dept}</option>))}
              </select>
              <input type="text" placeholder="EPF Number" className="w-full p-3 border rounded-xl" value={newUser.epfNumber} onChange={e => setNewUser({...newUser, epfNumber: e.target.value})} />
              <input type="tel" placeholder="Phone" className="w-full p-3 border rounded-xl" value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} />
              <input type="password" placeholder="Password" className="w-full p-3 border rounded-xl" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
              <button onClick={handleAddUser} className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl">Create Account</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}