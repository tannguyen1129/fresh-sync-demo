'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  ArrowRight, 
  Activity, 
  Truck, 
  Anchor, 
  Leaf, 
  ShieldCheck, 
  Zap,
  Globe,
  LayoutDashboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// --- Components ---

function Navbar() {
  return (
    <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tighter">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
            <Anchor className="w-5 h-5" />
          </div>
          FreshSync
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link href="#features" className="hover:text-primary transition-colors">Solutions</Link>
          <Link href="#roles" className="hover:text-primary transition-colors">Platform</Link>
          <Link href="#about" className="hover:text-primary transition-colors">About</Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button>Sign In <ArrowRight className="ml-2 w-4 h-4" /></Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      <div className="container mx-auto px-6 relative z-10 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium text-muted-foreground mb-6 bg-secondary/50 backdrop-blur-sm"
        >
          <Badge variant="secondary" className="mr-2 rounded-full px-1 py-0 bg-primary/20 text-primary">New</Badge> 
          AI-Powered Port Orchestration Engine v1.0
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground mb-6"
        >
          Synchronize Global Logistics <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600">
            In Real-Time
          </span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-2xl mx-auto text-lg text-muted-foreground mb-10"
        >
          FreshSync connects Port Operators, Logistics Businesses, and Drivers into a single unified workflow. Reduce congestion, optimize routes, and cut CO2 emissions with our AI Control Tower.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link href="/login">
            <Button size="lg" className="h-12 px-8 text-base bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
              Go to Console
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="h-12 px-8 text-base">
            View Documentation
          </Button>
        </motion.div>
      </div>

      {/* Background Decor */}
      <div className="absolute top-0 left-0 right-0 h-full overflow-hidden -z-10 opacity-20 dark:opacity-10 pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-500 rounded-full blur-[120px]" />
      </div>
    </section>
  );
}

function FeatureCard({ icon: Icon, title, description, delay }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="p-6 rounded-2xl border bg-card/50 backdrop-blur-sm hover:bg-card hover:shadow-md transition-all group"
    >
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </motion.div>
  );
}

function Features() {
  const features = [
    { icon: Globe, title: "End-to-End Visibility", description: "Track containers from vessel discharge to warehouse delivery with socket-based live updates." },
    { icon: Zap, title: "AI Scheduling", description: "Machine learning algorithms predict congestion and recommend optimal pickup slots automatically." },
    { icon: ShieldCheck, title: "Smart Contracts", description: "Automated verification and secure, role-based access control for all stakeholders." },
    { icon: Leaf, title: "ESG Analytics", description: "Monitor carbon footprints and optimize truck idle times to meet sustainability goals." },
    { icon: Activity, title: "Real-time Alerts", description: "Instant notifications for disruptions, rescheduling, and gate status changes." },
    { icon: Truck, title: "Driver Companion", description: "Mobile-first interface for drivers to manage assignments and navigation easily." },
  ];

  return (
    <section id="features" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Everything you need to run a modern port</h2>
          <p className="text-muted-foreground text-lg">
            Replace fragmented spreadsheets and phone calls with a single source of truth.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RoleCard({ title, desc, icon: Icon, color }: any) {
  return (
    <div className="flex gap-4 p-4 rounded-xl border bg-background hover:border-primary/50 transition-colors cursor-default">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <h4 className="font-semibold">{title}</h4>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function Roles() {
  return (
    <section id="roles" className="py-20">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-6">Built for every stakeholder</h2>
            <p className="text-lg text-muted-foreground mb-8">
              FreshSync provides tailored interfaces for each role in the logistics chain, ensuring everyone has exactly the tools they need.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
               <RoleCard title="Port Operators" desc="Manage gate capacity & disruptions." icon={LayoutDashboard} color="bg-blue-600" />
               <RoleCard title="Logistics Businesses" desc="Book slots & track shipments." icon={Globe} color="bg-indigo-600" />
               <RoleCard title="Truck Drivers" desc="Receive assignments & navigation." icon={Truck} color="bg-orange-600" />
               <RoleCard title="Port Authority" desc="Monitor ESG & compliance." icon={ShieldCheck} color="bg-green-600" />
            </div>
          </div>
          <div className="relative">
             {/* Abstract Dashboard Preview */}
             <div className="rounded-xl border shadow-2xl bg-card overflow-hidden relative z-10">
                <div className="h-8 bg-muted border-b flex items-center px-4 gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="p-8 space-y-4 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                    <div className="flex gap-4">
                        <div className="h-32 w-1/3 bg-primary/10 rounded-lg animate-pulse" />
                        <div className="h-32 w-1/3 bg-primary/10 rounded-lg animate-pulse" />
                        <div className="h-32 w-1/3 bg-primary/10 rounded-lg animate-pulse" />
                    </div>
                    <div className="h-64 w-full bg-muted rounded-lg" />
                </div>
                {/* Overlay Badge */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <Link href="/login">
                        <Button size="lg" className="shadow-2xl">Access Demo Console</Button>
                    </Link>
                </div>
             </div>
             {/* Decorative Elements */}
             <div className="absolute -top-10 -right-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl -z-0" />
             <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl -z-0" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 border-t bg-muted/20">
      <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2 font-bold text-lg">
           <Anchor className="w-5 h-5 text-primary" /> FreshSync
        </div>
        <div className="text-sm text-muted-foreground">
          © 2026 UMT TechGen. All rights reserved.
        </div>
        <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="#" className="hover:text-foreground">Privacy</Link>
            <Link href="#" className="hover:text-foreground">Terms</Link>
            <Link href="#" className="hover:text-foreground">Contact</Link>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Roles />
      </main>
      <Footer />
    </div>
  );
}