import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ArrowRight, Anchor, BarChart3, Truck, ShieldCheck, Zap, Globe } from "lucide-react";
import { Logo } from "@/components/common/Logo";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <section className="relative overflow-hidden pt-24 pb-20 md:pt-32 md:pb-32">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[1000px] rounded-full bg-blue-600/20 blur-[120px] -z-10" />
        <div className="absolute right-0 bottom-0 h-[600px] w-[800px] rounded-full bg-teal-500/10 blur-[100px] -z-10" />

        <div className="container mx-auto px-4 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
            </span>
            Live Demo: Smart Port Orchestration v2
          </div>

          <h1 className="mb-6 text-4xl font-extrabold tracking-tight md:text-6xl lg:text-7xl">
            Orchestrate Your Port <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-blue-600 to-teal-500 bg-clip-text text-transparent">
              Like a Symphony
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            FreshSync connects Terminals, Logistics Fleets, and Port Authorities in real-time.
            Reduce congestion, cut CO₂ emissions, and optimize every container move with AI-driven precision.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/login">
              <Button size="lg" className="h-12 rounded-full bg-blue-600 px-8 text-lg shadow-lg shadow-blue-600/25 hover:bg-blue-700">
                Launch Control Tower <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg" className="h-12 rounded-full px-8 text-lg">
                Explore Features
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section id="features" className="bg-slate-50 py-20 dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold">Why FreshSync?</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              A unified platform serving all stakeholders in the maritime logistics chain.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
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

      <section className="border-t py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 gap-8 divide-x divide-border/50 text-center md:grid-cols-4">
            <StatItem value="30%" label="Less Congestion" />
            <StatItem value="15%" label="CO₂ Reduction" />
            <StatItem value="2x" label="Faster Turnaround" />
            <StatItem value="24/7" label="Real-time Visibility" />
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-slate-950 py-24 text-white">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay" />

        <div className="container relative z-10 mx-auto px-4 text-center">
          <Logo size="lg" className="mb-6 justify-center [&_span]:text-white" showText={false} />
          <h2 className="mb-6 text-3xl font-bold md:text-5xl">Ready to Optimize Your Port?</h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-300">
            Join the digital transformation. Experience the future of port logistics today with the FreshSync demo.
          </p>
          <Link href="/login">
            <Button size="lg" className="h-14 rounded-full bg-white px-10 text-lg text-slate-950 hover:bg-slate-200">
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
    <div className="rounded-2xl border bg-background p-8 shadow-sm transition-shadow hover:shadow-md">
      <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mb-3 text-xl font-bold">{title}</h3>
      <p className="leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function StatItem({ value, label }: any) {
  return (
    <div className="p-4">
      <div className="mb-2 text-4xl font-extrabold text-blue-600 md:text-5xl">{value}</div>
      <div className="text-sm font-medium uppercase tracking-wide text-muted-foreground md:text-base">{label}</div>
    </div>
  );
}
