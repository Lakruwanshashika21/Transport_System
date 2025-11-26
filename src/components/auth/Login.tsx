import { useState } from 'react';
import { Mail, Lock, Car, Eye, EyeOff } from 'lucide-react';
import { User } from '../../App';
// Firebase Imports
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../../firebase'; // Adjust path if needed

interface LoginProps {
  onLogin: (user: User) => void;
  onNavigate: (screen: string) => void;
}

export function Login({ onLogin, onNavigate }: LoginProps) {
  const [loginType, setLoginType] = useState<'user' | 'driver' | 'admin'>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // UI Feedback
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Helper to fetch user details from Firestore
  const fetchUserDetails = async (uid: string) => {
    const userDoc = await getDoc(doc(db, "users", uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // Security Check: Ensure they are logging into the correct panel
      if (userData.role !== loginType) {
        throw new Error(`Access Denied: You are registered as a ${userData.role}, but trying to login as ${loginType}.`);
      }

      // Check for Driver Approval
      if (loginType === 'driver' && userData.driverStatus === 'pending') {
        throw new Error('Your driver account is pending approval by an admin.');
      }
      if (loginType === 'driver' && userData.driverStatus === 'rejected') {
        throw new Error('Your driver account application was rejected.');
      }

      return {
        id: uid,
        name: userData.fullName || userData.email, // Fallback to email if name missing
        email: userData.email,
        role: userData.role,
        phone: userData.phone,
        ...userData // Spread other fields like epfNumber etc.
      } as User;
    } else {
      throw new Error('User profile not found. Please register first.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Authenticate with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // 2. Fetch Extra Data & Verify Role
      const appUser = await fetchUserDetails(userCredential.user.uid);
      
      // 3. Log In
      onLogin(appUser);

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else {
        setError(err.message);
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
      
      // Fetch details and check if they actually registered
      const appUser = await fetchUserDetails(result.user.uid);
      
      onLogin(appUser);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google sign-in failed.');
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
            <div className="text-xs text-gray-500">Eskimo Fashion Knitwear (Pvt) Ltd - Vehicle Management</div>
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
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg text-center">
                {error}
              </div>
            )}

            {/* Role Selector */}
            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => setLoginType('user')}
                className={`flex-1 py-2.5 rounded-xl transition-all ${
                  loginType === 'user'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                User
              </button>
              <button
                type="button"
                onClick={() => setLoginType('driver')}
                className={`flex-1 py-2.5 rounded-xl transition-all ${
                  loginType === 'driver'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Driver
              </button>
              <button
                type="button"
                onClick={() => setLoginType('admin')}
                className={`flex-1 py-2.5 rounded-xl transition-all ${
                  loginType === 'admin'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Admin
              </button>
            </div>

            {/* Google Sign-in */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all mb-6 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="text-gray-700">Continue with Google</span>
            </button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">Or sign in with email</span>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Unified Email Input (Replaced EPF logic with Email for simplicity/Firebase compatibility) */}
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
                <button type="button" className="text-sm text-[#2563EB] hover:text-[#1E40AF]">
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#1E40AF] transition-all disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Registration Links */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-center text-sm text-gray-600 mb-3">Don't have an account?</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => onNavigate('user-registration')}
                  className="flex-1 py-2 text-sm text-[#2563EB] border border-[#2563EB] rounded-xl hover:bg-[#2563EB] hover:text-white transition-all"
                >
                  Register as User
                </button>
                <button
                  onClick={() => onNavigate('driver-registration')}
                  className="flex-1 py-2 text-sm text-[#2563EB] border border-[#2563EB] rounded-xl hover:bg-[#2563EB] hover:text-white transition-all"
                >
                  Register as Driver
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            © 2025 Eskimo Company Transport System. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}