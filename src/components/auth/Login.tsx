import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { User } from '../../types'; // Ensure this path is correct based on your folder structure
// Firebase Imports
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../../firebase';
import { sendLoginNotification } from '../../utils/emailService';

interface LoginProps {
  onLogin: (user: User) => void;
  onNavigate: (screen: string) => void;
}

export function Login({ onLogin, onNavigate }: LoginProps) {
  const [loginType, setLoginType] = useState<'user' | 'driver' | 'admin'>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // --- Helper to wait (for retries) ---
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // --- Helper to fetch user details safely with Retry ---
  const fetchUserDetailsWithRetry = async (uid: string, retries = 3): Promise<User> => {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Security Check
          if (userData.role !== loginType) {
              throw new Error(`Access Denied: You are a ${userData.role}, but trying to login as ${loginType}.`);
          }

          // Driver Checks
          if (loginType === 'driver' && userData.driverStatus === 'pending') {
              throw new Error('Your driver account is pending approval.');
          }
          if (loginType === 'driver' && userData.driverStatus === 'rejected') {
              throw new Error('Your driver account was rejected.');
          }

          return {
              id: uid,
              name: userData.fullName || userData.email,
              email: userData.email,
              role: userData.role,
              phone: userData.phone,
              ...userData
          } as User;
        } else {
          throw new Error('Profile not found. Please Register.');
        }
    } catch (err: any) {
        if (retries > 0 && (err.message?.includes("offline") || err.code === 'unavailable')) {
            await delay(1000); 
            return fetchUserDetailsWithRetry(uid, retries - 1);
        }
        throw err;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const appUser = await fetchUserDetailsWithRetry(userCredential.user.uid);
      
      // Send Email Notification
      console.log("Sending login email to:", appUser.email); // Debug log
      await sendLoginNotification(appUser.email, appUser.name);
      
      onLogin(appUser);

    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === 'auth/invalid-credential') setError('Invalid email or password.');
      else if (err.code === 'auth/too-many-requests') setError('Too many failed attempts. Wait 5 mins.');
      else setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const appUser = await fetchUserDetailsWithRetry(result.user.uid);
      
      console.log("Sending Google login email to:", appUser.email); // Debug log
      await sendLoginNotification(appUser.email, appUser.name);
      
      onLogin(appUser);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') setError('Sign-in cancelled.');
      else setError(err.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Header with Image */}
      <div className="bg-white border-b border-gray-200 py-6 px-4 sm:px-6">
        <div className="max-w-md mx-auto flex flex-col items-center justify-center gap-3 text-center">
          
          {/* LOGO IMAGE */}
          <img 
            src="/report-header.jpg" 
            alt="Transport System" 
            className="h-16 w-auto object-contain" 
            onError={(e) => {
                console.warn("Logo image failed to load"); // Debug log
                e.currentTarget.style.display = 'none';
            }}
          />

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">Transport System</div>
            <div className="text-xs text-gray-500">Carlos Embellishers / Eskimo Fashion Knitwear</div>
          </div>
        </div>
      </div>

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8">
            <div className="mb-6">
              <h1 className="text-2xl text-gray-900 mb-2">Welcome Back</h1>
              <p className="text-gray-600">Sign in to continue</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            {/* Role Selector */}
            <div className="flex gap-2 mb-6">
              {['user', 'driver', 'admin'].map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setLoginType(role as any)}
                  className={`flex-1 py-2.5 rounded-xl capitalize transition-all font-medium ${
                    loginType === role
                      ? 'bg-[#2563EB] text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all mb-6 disabled:opacity-50"
            >
              <span className="text-gray-700 font-medium">Continue with Google</span>
            </button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-4 bg-white text-gray-500">Or sign in with email</span></div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl"
                    placeholder="email@example.com"
                  />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pl-11 pr-11 border border-gray-300 rounded-xl"
                    placeholder="••••••••"
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full py-3 bg-[#2563EB] text-white font-medium rounded-xl hover:bg-[#1E40AF] disabled:opacity-70">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200">
              {loginType === 'admin' ? (
                  <button onClick={() => onNavigate('admin-registration')} className="w-full py-2 text-sm text-[#2563EB] border border-[#2563EB] rounded-xl hover:bg-[#2563EB] hover:text-white transition-all">
                    Register New Admin
                  </button>
              ) : (
                  <p className="text-center text-sm text-gray-500">
                    Don't have an account? Contact Admin.
                  </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}