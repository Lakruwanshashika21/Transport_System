import { useState, useEffect } from 'react';
import { Search, User as UserIcon, Mail, Phone, IdCard, Plus, Briefcase, Trash2, Key, AlertTriangle, ArrowLeft } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
// Firebase Imports
import { collection, query, where, setDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { initializeApp, deleteApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { db, firebaseConfig, auth as mainAuth } from '../../firebase';
// Email & Logging
import emailjs from '@emailjs/browser';
import { logAction } from '../../utils/auditLogger'; // 1. Import Logger

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
  
  const departments = ["Human Resources", "Security", "Electrical & Boiler", "F.G.Stores (Hosiery)", "Finance","Premises Maintenance","Procurement & Logistics","Stores","Workshop","Dye House","Boarding","Cap Looping","Components","Cutting (Hosiery)","D.C. Knitting & Separating","D.C. Knitting (Hosiery)","Embroidery","FTK / KOEPER / RJM","Finishing Gloves","Gloves Looping","Grading","Hand Cutting","Hand Flat knitting","Handwork","Hosiery Application","LGT","Looping (Hosiery)","M Lock / Rubber Sewing","MCU/CMS","Machine Cutting","Matec","Outsourcing","Packing & Machine Stitch","Packing (Hosiery)","Production Office (Gloves)","Production Office (Hosiery)","Production Office (Sewing)","Sewing","Steaming","Toe Closing","WARP Knitting / Accessories","Weighing","Winding","Directors' Office","Merchandising","Pattern Making","Product Development","Sample","Sample (Hosiery)","IE","Quality Assurance","Information & Technology","Wages & Costing","Bungalow","Planning"];

  // --- Real-Time Data Fetching ---
  useEffect(() => {
    setLoading(true);
    
    // 1. Listen to Users
    const usersQuery = query(collection(db, "users"), where("role", "==", "user"));
    const unsubscribeUsers = onSnapshot(usersQuery, (userSnap) => {
      const usersList = userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 2. Listen to Trips (Nested Listener for Stats)
      const unsubscribeTrips = onSnapshot(collection(db, "trip_requests"), (tripSnap) => {
        const allTrips = tripSnap.docs.map(doc => doc.data());

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
      });

      return () => unsubscribeTrips();
    });

    return () => unsubscribeUsers();
  }, []);

  // --- Create User ---
  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.name || !newUser.epfNumber || !newUser.department) {
      alert("Please fill in all required fields.");
      return;
    }
    let secondaryApp;
    try {
      // Use secondary app to create user without logging out admin
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

      // 📝 2. Log Action (Creation)
      await logAction({
        adminName: user.name || user.email,
        adminEmail: user.email,
        section: 'User Management',
        action: 'User Created',
        details: `Created user account: ${newUser.name} (${newUser.email}) - ${newUser.department}`,
        targetId: uid
      });

      // Send Welcome Email via EmailJS
      emailjs.send("service_transport_app", "template_login_alert", {
        to_email: newUser.email,
        to_name: newUser.name,
        message: `Welcome! Your account has been created. \nEmail: ${newUser.email}\nPassword: ${newUser.password}\nPlease change your password after login.`,
      }, "YOUR_PUBLIC_KEY");
      
      alert(`User ${newUser.name} created successfully!`);
      setShowAddModal(false);
      setNewUser({ name: '', email: '', password: '', epfNumber: '', phone: '', department: '' });
      
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
    if (!window.confirm(`Are you sure you want to remove ${selectedUser.name}?`)) return;
    try {
      await deleteDoc(doc(db, "users", selectedUser.id));

      // 📝 3. Log Action (Deletion)
      await logAction({
        adminName: user.name || user.email,
        adminEmail: user.email,
        section: 'User Management',
        action: 'User Deleted',
        details: `Deleted user account: ${selectedUser.name} (${selectedUser.email})`,
        targetId: selectedUser.id
      });

      alert("User removed.");
      setSelectedUser(null);
    } catch (error) {
      alert("Failed to delete user.");
    }
  };

  // --- Reset Password ---
  const handleResetPassword = async () => {
    if (!selectedUser?.email) return;
    if (!window.confirm(`Send password reset email to ${selectedUser.email}?`)) return;
    try {
      await sendPasswordResetEmail(mainAuth, selectedUser.email);
      alert(`Reset email sent to ${selectedUser.email}`);
    } catch (error: any) {
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

  if (loading) return <div className="p-10 text-center text-gray-500">Loading Users...</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="user-management" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => onNavigate('admin-dashboard')} className="mb-2 text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors">
                 <ArrowLeft size={18}/> Back to Dashboard
            </button>
            <h1 className="text-3xl text-gray-900 mb-2">User Management</h1>
            <p className="text-gray-600">Search and manage employee accounts</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all shadow-sm">
            <Plus className="w-5 h-5" /> Register User
          </button>
        </div>

        <Card className="p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <select value={searchType} onChange={(e) => setSearchType(e.target.value as any)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="epf">EPF Number</option>
                <option value="name">Name</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <div className="relative">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={`Search...`} className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {filteredUsers.length === 0 && <div className="text-center p-10 text-gray-500 bg-white rounded-xl border border-gray-200">No users found matching your search.</div>}
            {filteredUsers.map((u) => (
              <Card key={u.id} onClick={() => setSelectedUser(u)} className={`p-6 cursor-pointer transition-all hover:shadow-md border-0 ring-1 ring-gray-100 ${selectedUser?.id === u.id ? 'ring-2 ring-[#2563EB] bg-blue-50/50' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 text-blue-600 font-bold text-lg">
                    {(u.name || u.fullName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="text-lg font-semibold text-gray-900 mb-1">{u.name}</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600"><IdCard className="w-4 h-4 text-gray-400" /> <span className="font-mono bg-gray-100 px-1 rounded text-xs">{u.epfNumber || 'No EPF'}</span></div>
                      <div className="flex items-center gap-2 text-sm text-gray-600"><Mail className="w-4 h-4 text-gray-400" />{u.email}</div>
                      <div className="flex items-center gap-2 text-sm text-gray-600"><Briefcase className="w-4 h-4 text-gray-400" />{u.department || 'Unassigned'}</div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="lg:col-span-1">
            {selectedUser ? (
              <Card className="p-6 sticky top-24 border-0 shadow-lg ring-1 ring-gray-200">
                <div className="text-center mb-6">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                      <UserIcon className="w-10 h-10 text-gray-400" />
                  </div>
                  <div className="text-xl font-bold text-gray-900">{selectedUser.name}</div>
                  <div className="text-sm text-gray-500 mt-1">{selectedUser.department || 'No Dept'}</div>
                </div>
                
                <div className="space-y-3 mb-8">
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg text-sm"><span className="text-gray-500">EPF Number</span><span className="font-medium">{selectedUser.epfNumber}</span></div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg text-sm"><span className="text-gray-500">Phone</span><span className="font-medium">{selectedUser.phone || 'N/A'}</span></div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg text-sm"><span className="text-gray-500">Total Trips</span><span className="font-medium text-blue-600">{selectedUser.totalTrips}</span></div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg text-sm"><span className="text-gray-500">Joined</span><span className="font-medium">{selectedUser.joinDate}</span></div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-100">
                  <button onClick={handleResetPassword} className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium">
                    <Key className="w-4 h-4" /> Send Password Reset
                  </button>
                  <button onClick={handleDeleteUser} className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 transition-all font-medium">
                    <Trash2 className="w-4 h-4" /> Remove User Account
                  </button>
                </div>
              </Card>
            ) : (
              <Card className="p-12 text-center border-dashed border-2 border-gray-200 bg-gray-50">
                <UserIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Select a user to view details</p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-200">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Register New User</h3>
            <div className="space-y-4 mb-6">
              <input type="text" placeholder="Full Name" className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
              <input type="email" placeholder="Email" className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              <select className="w-full p-3 border rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={newUser.department} onChange={e => setNewUser({...newUser, department: e.target.value})}>
                <option value="">Select Department</option>
                {departments.map((dept, index) => (<option key={index} value={dept}>{dept}</option>))}
              </select>
              <input type="text" placeholder="EPF Number" className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={newUser.epfNumber} onChange={e => setNewUser({...newUser, epfNumber: e.target.value})} />
              <input type="tel" placeholder="Phone" className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} />
              <input type="password" placeholder="Password" className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 border rounded-xl font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddUser} className="flex-1 py-3 bg-[#2563EB] text-white rounded-xl font-medium hover:bg-blue-700 shadow-sm">Create Account</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}