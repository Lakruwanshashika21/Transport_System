import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertTriangle, Phone } from 'lucide-react';
import { User } from '../../App'; 

// ==================================================================================
// ✅ REAL IMPORTS ENABLED
// ==================================================================================

import { signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth'; 
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore'; 
import { auth, db, googleProvider } from '../../firebase';
// import { sendLoginNotification } from '../../utils/emailService'; // Uncomment if/when ready

interface LoginProps {
  onLogin: (user: User) => void;
  onNavigate: (screen: string) => void;
}

export function Login({ onLogin, onNavigate }: LoginProps) {
  const [loginType, setLoginType] = useState<'user' | 'driver' | 'admin'>('user');
  
  // Form State
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(''); 
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // --- Helper: Restore Deleted Account (Self-Healing) ---
  const restoreUserAccount = async (uid: string, email: string | null, role: string) => {
    try {
      await setDoc(doc(db, "users", uid), {
        uid,
        email: email || "",
        role,
        status: 'active',
        createdAt: new Date().toISOString(),
        restoredAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error("Failed to restore account:", err);
      return false;
    }
  };

  // --- Helper: Fetch User Details & Security Checks ---
  const fetchUserDetailsWithRetry = async (uid: string, email: string | null, retries = 3): Promise<User> => {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // 1. BAN CHECK
          if (userData.status === 'banned') {
              await signOut(auth); 
              throw new Error("ACCESS DENIED: Your account has been banned by the administrator.");
          }

          // 2. ROLE CHECK REMOVED
          // We now allow cross-role login (e.g. Driver logging in via Email on User tab)
          // The App.tsx will handle routing based on the returned role.
          
          // 3. DRIVER STATUS CHECK (Only if the account is actually a driver)
          if (userData.role === 'driver') {
             if (userData.driverStatus === 'pending') { await signOut(auth); throw new Error('Your driver account is pending approval.'); }
             if (userData.driverStatus === 'rejected') { await signOut(auth); throw new Error('Your driver account was rejected.'); }
          }

          return {
              id: uid,
              name: userData.name || userData.fullName || userData.email,
              email: userData.email,
              role: userData.role,
              phone: userData.phone,
              ...userData
          } as User;
        } else {
          // 4. MISSING PROFILE -> ATTEMPT RESTORE
          console.log("Profile missing. Attempting auto-restore...");
          const restored = await restoreUserAccount(uid, email, loginType);
          
          if (restored) {
             return fetchUserDetailsWithRetry(uid, email, retries); 
          }

          await signOut(auth);
          throw new Error('Profile not found and could not be restored.');
        }
    } catch (err: any) {
        if (retries > 0 && (err.message?.includes("offline") || err.code === 'unavailable')) {
            await delay(1000); 
            return fetchUserDetailsWithRetry(uid, email, retries - 1);
        }
        throw err;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let targetEmail = email;

      // 🟢 PHONE NUMBER LOOKUP FOR DRIVERS
      if (loginType === 'driver') {
          if (!phone) { throw new Error("Please enter your phone number."); }
          
          // Lookup Email using Phone Number
          const q = query(collection(db, "users"), where("phone", "==", phone), where("role", "==", "driver"));
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
              throw new Error("No driver account found with this phone number.");
          }

          // Get the first matching user's email
          targetEmail = querySnapshot.docs[0].data().email;
      }

      // Authenticate
      const userCredential = await signInWithEmailAndPassword(auth, targetEmail, password);
      const appUser = await fetchUserDetailsWithRetry(userCredential.user.uid, userCredential.user.email);
      
      // await sendLoginNotification(appUser.email, appUser.name); 
      
      onLogin(appUser);

    } catch (err: any) {
      console.error("Login Error:", err);
      if (auth.currentUser) await signOut(auth);

      if (err.code === 'auth/invalid-credential') setError('Invalid credentials.');
      else if (err.code === 'auth/too-many-requests') setError('Too many failed attempts. Wait 5 mins.');
      else if (err.code === 'permission-denied') setError('System Error: Cannot verify phone number. Contact Admin.');
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
      const appUser = await fetchUserDetailsWithRetry(result.user.uid, result.user.email);
      onLogin(appUser);
    } catch (err: any) {
      if (auth.currentUser) await signOut(auth);
      if (err.code === 'auth/popup-closed-by-user') setError('Sign-in cancelled.');
      else setError(err.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* LOGO */}
        <div className="flex justify-center mb-4">
             <img src="/report-header.jpg" alt="Logo" className="h-16 object-contain" onError={(e) => e.currentTarget.style.display='none'} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Transport System</h1>
        <p className="text-gray-600 mb-6 text-center">Sign in to access dashboard</p>

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
                onClick={() => {
                    setLoginType(role as any);
                    setError('');
                }}
                className={`flex-1 py-2.5 rounded-lg capitalize text-sm font-medium transition-all ${
                loginType === role ? 'bg-[#2563EB] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
                {role}
            </button>
            ))}
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
            
            {/* DYNAMIC INPUT: Phone or Email */}
            {loginType === 'driver' ? (
                <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
                        <Phone className="w-4 h-4" /> Phone Number
                    </label>
                    <div className="relative">
                        <input 
                            type="tel" 
                            value={phone} 
                            onChange={e => setPhone(e.target.value)} 
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2563EB] outline-none transition-all" 
                            placeholder="07X XXX XXXX" 
                            required 
                        />
                    </div>
                </div>
            ) : (
                <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
                        <Mail className="w-4 h-4" /> Email Address
                    </label>
                    <div className="relative">
                        <input 
                            type="email" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2563EB] outline-none transition-all" 
                            placeholder="name@company.com" 
                            required 
                        />
                    </div>
                </div>
            )}

            <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
                    <Lock className="w-4 h-4" /> Password
                </label>
                <div className="relative">
                    <input 
                        type={showPassword ? "text" : "password"} 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        className="w-full p-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2563EB] outline-none transition-all" 
                        placeholder="••••••••" 
                        required 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                    </button>
                </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-3 bg-[#2563EB] text-white rounded-xl font-bold hover:bg-[#1E40AF] disabled:opacity-70 transition-all shadow-sm mt-2">
                {loading ? 'Signing In...' : `Sign In as ${loginType.charAt(0).toUpperCase() + loginType.slice(1)}`}
            </button>
        </form>

        {/* Google Login (Visible only for non-drivers, optional) */}
        {loginType !== 'driver' && (
            <>
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                    <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or continue with</span></div>
                </div>

                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2 font-medium"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 4.63c1.61 0 3.06.56 4.21 1.64l3.16-3.16C17.45 1.18 14.97 0 12 0 7.7 0 3.99 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign in with Google
                </button>
            </>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            {loginType === 'admin' ? (
                <button onClick={() => onNavigate('admin-registration')} className="text-sm text-[#2563EB] hover:underline font-medium">
                    Register New Admin
                </button>
            ) : (
                <p className="text-sm text-gray-500">Don't have an account? Contact Admin.</p>
            )}
        </div>
      </div>
    </div>
  );
}