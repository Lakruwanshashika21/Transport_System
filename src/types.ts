export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'driver' | 'admin';
  epfNumber?: string;
  phone?: string;
  department?: string;
  joinDate?: string;
  [key: string]: any;
}