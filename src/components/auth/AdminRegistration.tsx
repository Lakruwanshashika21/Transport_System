import { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Lock, Shield, Eye, EyeOff, AlertCircle, User as UserIcon, Phone as PhoneIcon, Key as KeyIcon } from 'lucide-react';

import { createUserWithEmailAndPassword } from 'firebase/auth'; // Removed unused imports
import { doc, setDoc, getDoc } from 'firebase/firestore'; 
import { auth, db } from '../../firebase'; // Removed unused googleProvider

interface AdminRegistrationProps {
  onBack: () => void;
  onRegister: () => void;
}

export function AdminRegistration({ onBack, onRegister }: AdminRegistrationProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'admin',
    name: '', 
    phone: '',
    epfNumber: '',
    adminCode: '',
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [systemAdminCode, setSystemAdminCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(true);

  // 0. Fetch the Real Admin Code from Firestore (UNCHANGED)
  useEffect(() => {
    const fetchAdminCode = async () => {
      try {
        const docRef = doc(db, "settings", "admin_config");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().registrationKey) {
          setSystemAdminCode(docSnap.data().registrationKey);
        } else {
          setSystemAdminCode('ADMIN2025'); 
        }
      } catch (err) {
        console.error("Failed to fetch admin config:", err);
        setSystemAdminCode('ADMIN2025'); 
      } finally {
        setLoadingCode(false);
      }
    };
    fetchAdminCode();
  }, []);

  // Helper to Create DB Record (Restoration logic removed, Firestore fix applied)
  const setupAdminProfile = async (user: any) => {
      // 1. Start with base data
      const userData: Record<string, any> = {
        uid: user.uid,
        email: user.email,
        name: formData.name, 
        phone: formData.phone, 
        epfNumber: formData.epfNumber, 
        role: 'admin',
        status: 'active',
        // Only set createdAt for new registration. restoredAt is intentionally omitted.
        createdAt: new Date().toISOString(),
      };
      
      // setDoc runs successfully, no restoredAt field is present
      await setDoc(doc(db, "users", user.uid), userData, { merge: true });
  };


  // --- SIMPLIFIED HANDLER: ONLY REGISTER NEW ADMIN ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (loadingCode) return;

    // Validation
    if (formData.adminCode !== systemAdminCode) {
      setError('Invalid Admin Access Code.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!formData.name.trim() || !formData.phone.trim() || !formData.epfNumber.trim()) {
        setError('Name, Phone Number, and EPF Number are required.');
        return;
    }


    setLoading(true);

    try {
      // 1. Create New Account
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      
      // 2. Setup DB Profile
      await setupAdminProfile(userCredential.user);
      
      alert('Admin registration successful!');
      onRegister();

    } catch (err: any) {
      // 3. Handle Error (no restoration attempt)
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please use the Sign In form.');
      } else {
        console.error(err);
        setError('Failed to register. ' + (err?.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Top Navigation/Header */}
      <div className="bg-white border-b border-gray-200 py-3 px-4 sm:px-6"> 
        <div className="max-w-md mx-auto flex items-center gap-3"> 
          <button
            onClick={onBack}
            className="p-1 hover:bg-gray-100 rounded-lg transition-all" 
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" /> 
          </button>
          <div>
            <div className="text-lg text-gray-900">Admin Registration</div> 
            <div className="text-xs text-gray-500">Restricted access</div>
          </div>
        </div>
      </div>

      {/* Main Content: Reduced vertical padding from py-6 to py-4 */}
      <div className="p-4 sm:p-6 flex justify-center">
        <div className="w-full max-w-md">
          {/* Card: Kept inner padding (p-6) for form aesthetics */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"> 
            
            {/* Icon Header: Reduced mb-5 to mb-4 */}
            <div className="flex items-center justify-center mb-4"> 
              <div className="w-12 h-12 bg-[#2563EB] rounded-xl flex items-center justify-center"> 
                <Shield className="w-6 h-6 text-white" /> 
              </div>
            </div>

            {/* Title Block: Reduced mb-6 to mb-4 */}
            <div className="mb-4 text-center"> 
              <h2 className="text-2xl font-semibold text-gray-900 mb-1">Administrator Access</h2> 
              <p className="text-sm text-gray-600">Only authorized personnel can register</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-left">{error}</div>
              </div>
            )}

            {/* Form: Reduced space-y-2 to space-y-1.5 for a more compact form */}
            <form onSubmit={handleSubmit} className="space-y-1.5"> 
              
              {/* Name Input */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Full Name *</label> 
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Smith"
                    // Input height reduced: py-2 instead of py-2.5
                    className="w-full px-4 py-2 pl-11 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" 
                  />
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /> {/* Icon size reduced for smaller input */}
                </div>
              </div>

              {/* Phone Number Input */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Phone Number *</label> 
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="07XXXXXXXX"
                    // Input height reduced: py-2 instead of py-2.5
                    className="w-full px-4 py-2 pl-11 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" 
                  />
                  <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /> {/* Icon size reduced for smaller input */}
                </div>
              </div>
            
              {/* EPF Number Input */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">EPF/Employee Number *</label> 
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.epfNumber}
                    onChange={(e) => setFormData({ ...formData, epfNumber: e.target.value })}
                    placeholder="E.g., 12345"
                    // Input height reduced: py-2 instead of py-2.5
                    className="w-full px-4 py-2 pl-11 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" 
                  />
                  <KeyIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /> {/* Icon size reduced for smaller input */}
                </div>
              </div>


              {/* Admin Code Input */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Admin Access Code *</label> 
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.adminCode}
                    onChange={(e) => setFormData({ ...formData, adminCode: e.target.value })}
                    placeholder={loadingCode ? "Verifying..." : "Enter admin code"}
                    disabled={loadingCode}
                    // Input height reduced: py-2 instead of py-2.5
                    className="w-full px-4 py-2 pl-11 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" 
                  />
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /> {/* Icon size reduced for smaller input */}
                </div>
              </div>

              {/* Email Input */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Email Address *</label> 
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="admin@example.com"
                    // Input height reduced: py-2 instead of py-2.5
                    className="w-full px-4 py-2 pl-11 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" 
                  />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /> {/* Icon size reduced for smaller input */}
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Password *</label> 
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    // Input height reduced: py-2 instead of py-2.5
                    className="w-full px-4 py-2 pl-11 pr-11 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" 
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /> {/* Icon size reduced for smaller input */}
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Confirm Password *</label> 
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    // Input height reduced: py-2 instead of py-2.5
                    className="w-full px-4 py-2 pl-11 pr-11 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" 
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /> {/* Icon size reduced for smaller input */}
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button: Reduced mt-3 to mt-2, reduced button height (py-2) */}
              <button
                type="submit"
                disabled={loading || loadingCode}
                className="w-full py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1E40AF] transition-all disabled:opacity-50 mt-2" 
              >
                {loading ? 'Processing...' : 'Register'}
              </button>
            </form>
            
            {/* Go Back Link: Reduced mt-3 to mt-2 */}
            <div className="mt-2 pt-2 border-t border-gray-100 text-center"> 
              <span className="text-sm text-gray-600">Go back to </span>
              <button onClick={onBack} className="text-sm text-[#2563EB] hover:text-[#1E40AF]">Sign In</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}