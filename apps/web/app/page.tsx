import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ArrowRight, Anchor, BarChart3, Truck, ShieldCheck, Zap, Globe } from "lucide-react";
import { Logo } from "@/components/common/Logo";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      
      {/* --- HERO SECTION --- */}
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-32 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-teal-500/10 rounded-full blur-[100px] -z-10" />

        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Live Demo: Smart Port Orchestration v1.0
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6">
            Orchestrate Your Port <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-blue-600 to-teal-500 bg-clip-text text-transparent">
              Like a Symphony
            </span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
            FreshSync connects Terminals, Logistics Fleets, and Port Authorities in real-time. 
            Reduce congestion, cut CO₂ emissions, and optimize every container move with AI-driven precision.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="h-12 px-8 text-lg rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25">
                Launch Control Tower <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg" className="h-12 px-8 text-lg rounded-full">
                Explore Features
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* --- FEATURES GRID --- */}
      <section id="features" className="py-20 bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Why FreshSync?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A unified platform serving all stakeholders in the maritime logistics chain.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Anchor}
              title="Smart Terminal Operation"
              description="Dynamic slot allocation and predictive gate planning to eliminate peak-hour bottlenecks."
              color="text-blue-600"
            />
            <FeatureCard 
              icon={Truck}
              title="Fleet Orchestration"
              description="Real-time navigation and just-in-time arrival guidance for truck drivers to reduce idle time."
              color="text-orange-500"
            />
            <FeatureCard 
              icon={BarChart3}
              title="ESG & Sustainability"
              description="Automated carbon footprint tracking and compliance reporting for Port Authorities."
              color="text-green-500"
            />
            <FeatureCard 
              icon={Zap}
              title="AI-Powered Decisions"
              description="Machine learning models that re-optimize schedules instantly when disruptions occur."
              color="text-purple-500"
            />
            <FeatureCard 
              icon={ShieldCheck}
              title="Secure Integration"
              description="Seamlessly connects with existing TOS and Shipping Line systems via secure APIs."
              color="text-teal-500"
            />
            <FeatureCard 
              icon={Globe}
              title="Empty Return Hub"
              description="Intelligent routing for empty containers to the nearest available depot."
              color="text-indigo-500"
            />
          </div>
        </div>
      </section>

      {/* --- STATS SECTION --- */}
      <section className="py-20 border-t">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-border/50">
            <StatItem value="30%" label="Less Congestion" />
            <StatItem value="15%" label="CO₂ Reduction" />
            <StatItem value="2x" label="Faster Turnaround" />
            <StatItem value="24/7" label="Real-time Visibility" />
          </div>
        </div>
      </section>

      {/* --- CTA SECTION --- */}
      <section className="py-24 bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay" />
        
        <div className="container mx-auto px-4 text-center relative z-10">
          <Logo size="lg" className="justify-center mb-6 [&_span]:text-white" showText={false} />
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to Optimize Your Port?</h2>
          <p className="text-slate-300 text-lg mb-10 max-w-2xl mx-auto">
            Join the digital transformation. Experience the future of port logistics today with the FreshSync Demo.
          </p>
          <Link href="/login">
            <Button size="lg" className="h-14 px-10 text-lg rounded-full bg-white text-slate-950 hover:bg-slate-200">
              Access Demo Environment
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, color }: any) {
  return (
    <div className="bg-background p-8 rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function StatItem({ value, label }: any) {
  return (
    <div className="p-4">
      <div className="text-4xl md:text-5xl font-extrabold text-blue-600 mb-2">{value}</div>
      <div className="text-sm md:text-base font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}