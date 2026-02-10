import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { AuthProvider } from '@/context/AuthContext'; // <--- QUAN TRỌNG: Import AuthProvider

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FreshSync - Smart Port Orchestration',
  description: 'AI-driven port logistics optimization platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* BẮT BUỘC: AuthProvider phải bọc lấy toàn bộ nội dung bên trong */}
          <AuthProvider>
            <Navbar />
            
            <main className="min-h-screen">
              {children}
            </main>

            {/* Footer */}
            <div className="hidden md:block dashboard-hidden"> 
               <Footer />
            </div>

            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}