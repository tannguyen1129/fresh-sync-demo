'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Logo } from '@/components/common/Logo';
import { Loader2, Truck, Anchor, Briefcase, Building2 } from "lucide-react"; // Import icon mới

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back to FreshSync!");
    } catch (error) {
      toast.error("Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- CẬP NHẬT THÔNG TIN LOGIN TẠI ĐÂY ---
  const fillDemo = (role: string) => {
    switch (role) {
      case 'operator':
        setEmail('ops@port.com');
        setPassword('admin123');
        break;
      case 'logistics': // Business
        setEmail('biz@logistics.com');
        setPassword('user123');
        break;
      case 'authority':
        setEmail('admin@authority.gov');
        setPassword('admin123');
        break;
      case 'driver':
        setEmail('driver@fleet.com'); // Giữ driver để test app tài xế
        setPassword('driver123');
        break;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
         <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[100px]" />
         <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-teal-500/10 blur-[100px]" />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-slate-200 dark:border-slate-800 relative z-10 backdrop-blur-sm bg-background/80">
        <CardHeader className="space-y-4 flex flex-col items-center text-center pt-8">
          <Logo size="lg" />
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">Control Tower Access</CardTitle>
            <CardDescription>
              Sign in to orchestrate your port logistics
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background/50"
              />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign In"}
            </Button>
          </form>

          {/* Quick Login Buttons - CẬP NHẬT GRID 4 */}
          <div className="mt-8">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground font-semibold">One-Click Demo Access</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="justify-start h-auto py-3 px-4" onClick={() => fillDemo('operator')}>
                <Anchor className="h-5 w-5 mr-3 text-blue-600" />
                <div className="text-left">
                    <div className="text-xs font-semibold">Operator</div>
                    <div className="text-[10px] text-muted-foreground">ops@port.com</div>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3 px-4" onClick={() => fillDemo('logistics')}>
                <Briefcase className="h-5 w-5 mr-3 text-teal-600" />
                 <div className="text-left">
                    <div className="text-xs font-semibold">Logistics</div>
                    <div className="text-[10px] text-muted-foreground">biz@logistics.com</div>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3 px-4" onClick={() => fillDemo('authority')}>
                <Building2 className="h-5 w-5 mr-3 text-purple-600" />
                 <div className="text-left">
                    <div className="text-xs font-semibold">Authority</div>
                    <div className="text-[10px] text-muted-foreground">admin@authority.gov</div>
                </div>
              </Button>
               <Button variant="outline" className="justify-start h-auto py-3 px-4" onClick={() => fillDemo('driver')}>
                <Truck className="h-5 w-5 mr-3 text-orange-600" />
                 <div className="text-left">
                    <div className="text-xs font-semibold">Driver</div>
                    <div className="text-[10px] text-muted-foreground">driver@fleet.com</div>
                </div>
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-center pb-6">
            <p className="text-xs text-muted-foreground text-center">
                Protected by FreshSync Enterprise Security.<br/>
                Unauthorized access is prohibited.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}