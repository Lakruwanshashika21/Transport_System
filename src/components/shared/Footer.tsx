import { Facebook, Instagram, Linkedin, Youtube, ArrowUp, MessageCircle, Globe, ExternalLink } from 'lucide-react';

export function Footer() {
  
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          
          {/* LEFT: Company Logos */}
          <div className="flex justify-center md:justify-start">
            <div className="flex items-center gap-5 bg-gray-50 px-6 py-3 rounded-2xl border border-gray-100">
              {/* Carlos Logo */}
              <img 
                src="/report-header.jpg" 
                alt="Carlos Embellishers" 
                className="h-10 object-contain hover:opacity-80 transition-opacity" 
              />
              
              <div className="h-8 w-px bg-gray-300"></div>

              {/* Eskimo Logo */}
              <img 
                src="/logo2.jpeg" 
                alt="Eskimo Fashion" 
                className="h-10 object-contain hover:opacity-80 transition-opacity" 
              />
            </div>
          </div>

          {/* CENTER: Corporate Websites (Professional Look) */}
          <div className="flex flex-col items-center justify-center gap-3">

            <div className="flex items-center gap-6">
                <a 
                  href="https://www.carlosholdings.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-all"
                >
                    <Globe className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    <span>Carlos Holdings</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0 transition-all" />
                </a>
                
                <span className="text-gray-300">|</span>

                <a 
                  href="https://www.eskimofashion.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-green-600 transition-all"
                >
                    <Globe className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
                    <span>Eskimo Fashions</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0 transition-all" />
                </a>
            </div>
          </div>

          {/* RIGHT: Socials & Support (Inline) */}
          <div className="flex justify-center md:justify-end">
            <div className="flex items-center gap-0 bg-white border border-gray-100 rounded-full pl-6 pr-2 py-2 shadow-sm hover:shadow-md transition-shadow">
              {/* Social Icons */}
              <div className="flex gap-4 text-gray-400">
                <a href="#" className="hover:text-[#1877F2] transition-colors transform hover:scale-110"><Facebook className="w-5 h-5" /></a>
                <a href="#" className="hover:text-[#E4405F] transition-colors transform hover:scale-110"><Instagram className="w-5 h-5" /></a>
                <a href="#" className="hover:text-[#0A66C2] transition-colors transform hover:scale-110"><Linkedin className="w-5 h-5" /></a>
                <a href="#" className="hover:text-[#FF0000] transition-colors transform hover:scale-110"><Youtube className="w-5 h-5" /></a>
              </div>
              
              <div className="h-6 w-px bg-gray-200"></div>

              {/* Support Button */}
              <button className="flex items-center gap-2 bg-gray-900 text-black px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide hover:bg-gray-800 transition-all active:scale-95">
                <MessageCircle className="w-4 h-4" />
                <span>Support</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
            
            {/* Copyright & Tagline */}
            <div className="text-center md:text-left flex flex-col md:flex-row gap-1 md:gap-2">
              <span className="font-medium">&copy; {new Date().getFullYear()} Carlos Embellishers (Pvt) Ltd. All Rights Reserved.</span>
              <span className="hidden md:inline text-gray-300">|</span>
              <span className="text-gray-400">Safe & Reliable Transport Service</span>
            </div>

            {/* Links */}
            <div className="flex flex-wrap justify-center gap-4 md:gap-6">
              <a href="#" className="hover:text-gray-900 transition-colors">Terms of Use</a>
              <a href="#" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-gray-900 transition-colors">Sitemap</a>
              <a href="#" className="hover:text-gray-900 transition-colors">Accessibility</a>
            </div>

            {/* Scroll to Top */}
            <button 
              onClick={scrollToTop}
              className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-100 text-gray-600 transition-all group"
              aria-label="Scroll to top"
            >
              <ArrowUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
            </button>

          </div>
        </div>
      </div>
    </footer>
  );
}