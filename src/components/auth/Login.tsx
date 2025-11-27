import { useState } from 'react';
import { Mail, Lock, Car, Eye, EyeOff, Wifi, AlertTriangle } from 'lucide-react';
// FIX: Import User from types to avoid circular dependency errors
// If you haven't created src/types.ts yet, change this back to '../../App'
import { User } from '../../types'; 
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, enableNetwork } from 'firebase/firestore';
import { auth, db, googleProvider } from '../../firebase';

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
        // Attempt to force network connection (Fixes 'Client is offline' issues)
        try { await enableNetwork(db); } catch (e) { console.log("Network already enabled"); }

        const userDoc = await getDoc(doc(db, "users", uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log("User Found:", userData); // Debugging Log

          // Security Check: Ensure role matches selected tab
          // Note: We compare lowercase to be safe
          if (userData.role?.toLowerCase() !== loginType.toLowerCase()) {
              throw new Error(`Access Denied: This account is a '${userData.role}', but you are trying to login as '${loginType}'. Please switch the tab above.`);
          }

          // Driver Approval Checks
          if (loginType === 'driver' && userData.driverStatus === 'pending') {
              throw new Error('Your driver account is pending approval by an admin.');
          }
          if (loginType === 'driver' && userData.driverStatus === 'rejected') {
              throw new Error('Your driver account application was rejected.');
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
          throw new Error('User profile not found in database. Please contact Admin.');
        }
    } catch (err: any) {
        console.error("Fetch Error:", err);
        // If "offline" or network error, wait and TRY AGAIN
        if (retries > 0 && (err.message?.includes("offline") || err.code === 'unavailable' || err.message?.includes("Connection failed"))) {
            console.warn(`Connection unstable. Retrying... (${retries} attempts left)`);
            await delay(500); // Wait 0.5s
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
      // 1. Authenticate with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // 2. Fetch Extra Data & Verify Role (With Retry)
      const appUser = await fetchUserDetailsWithRetry(userCredential.user.uid);
      onLogin(appUser);

    } catch (err: any) {
      console.error("Login Error Full:", err);
      
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Access blocked temporarily. Please wait 5 minutes.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection.');
      } else if (err.message && err.message.includes("offline")) {
         setError('Connection unstable. Please check internet and try again.');
      } else {
        setError(err.message || 'Failed to login.');
      }
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
      onLogin(appUser);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection.');
      } else {
        setError(err.message || 'Google sign-in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-4 px-4 sm:px-6">
        <div className="max-w-md mx-auto flex items-center justify-center gap-3">
          <div className="w-12 h-12 bg-[#2563EB] rounded-2xl flex items-center justify-center">
            <Car className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="text-xl text-gray-900">Transport System</div>
            <div className="text-xs text-gray-500">Eskimo Fashion Knitwear (Pvt) Ltd</div>
          </div>
        </div>
      </div>

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8">
            <div className="mb-6">
              <h1 className="text-2xl text-gray-900 mb-2">Welcome Back</h1>
              <p className="text-gray-600">Sign in to continue to your account</p>
            </div>

            {/* Error Message */}
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
                  className={`flex-1 py-2.5 rounded-xl capitalize transition-all ${
                    loginType === role
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>

            {/* Google Sign-in */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all mb-6 disabled:opacity-50"
            >
              <span className="text-gray-700">Continue with Google</span>
            </button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-4 bg-white text-gray-500">Or sign in with email</span></div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={loginType === 'user' ? "user@example.com" : "you@example.com"}
                    className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pl-11 pr-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
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

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 text-[#2563EB] border-gray-300 rounded focus:ring-[#2563EB]" />
                  <span className="text-sm text-gray-700">Remember me</span>
                </label>
                <button type="button" className="text-sm text-[#2563EB]">Forgot Password?</button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Dynamic Registration Links */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              {loginType === 'admin' ? (
                 <div className="flex flex-col gap-2">
                  <p className="text-center text-sm text-gray-600">Admin Access Only</p>
                  <button
                    onClick={() => onNavigate('admin-registration')}
                    className="w-full py-2 text-sm text-[#2563EB] border border-[#2563EB] rounded-xl hover:bg-[#2563EB] hover:text-white transition-all"
                  >
                    Register New Admin
                  </button>
                 </div>
              ) : (
                 <p className="text-center text-sm text-gray-500">
                   User registration is disabled. Please contact an Administrator to create your account.
                 </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}