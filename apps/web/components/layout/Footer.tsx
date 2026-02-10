import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/common/Logo';
import { Facebook, Twitter, Linkedin, Github, Mail, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-muted/30 border-t pt-16 pb-8">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          
          {/* Column 1: Brand Info */}
          <div className="space-y-4">
            <Logo size="lg" />
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
              Orchestrating the future of port logistics. Reduce congestion, lower emissions, and optimize every move with AI-driven precision.
            </p>
            <div className="flex items-center gap-4">
              <SocialLink href="#" icon={Twitter} />
              <SocialLink href="#" icon={Linkedin} />
              <SocialLink href="#" icon={Facebook} />
              <SocialLink href="#" icon={Github} />
            </div>
          </div>

          {/* Column 2: Product */}
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <FooterLink href="#">Port Orchestration</FooterLink>
              <FooterLink href="#">Smart Gate</FooterLink>
              <FooterLink href="#">Reefer Monitoring</FooterLink>
              <FooterLink href="#">Empty Return Optimization</FooterLink>
              <FooterLink href="#">API Integrations</FooterLink>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <FooterLink href="#">About Us</FooterLink>
              <FooterLink href="#">Case Studies</FooterLink>
              <FooterLink href="#">Sustainability (ESG)</FooterLink>
              <FooterLink href="#">Careers</FooterLink>
              <FooterLink href="#">Contact</FooterLink>
            </ul>
          </div>

          {/* Column 4: Newsletter / Contact */}
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Stay Updated</h4>
            <p className="text-sm text-muted-foreground">
              Subscribe to our newsletter for the latest smart port trends.
            </p>
            <div className="flex gap-2">
              <Input placeholder="Enter your email" className="bg-background" />
              <Button size="icon" className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                <Mail className="h-4 w-4" />
              </Button>
            </div>
            <div className="pt-4 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <span>Cat Lai Terminal, HCMC, Vietnam</span>
                </div>
                <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <span>+84 28 3742 2234</span>
                </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground text-center md:text-left">
            © {currentYear} FreshSync Technology. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <Link href="#" className="hover:text-primary">Privacy Policy</Link>
            <Link href="#" className="hover:text-primary">Terms of Service</Link>
            <Link href="#" className="hover:text-primary">Cookie Settings</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Helper components nhỏ
function SocialLink({ href, icon: Icon }: { href: string; icon: any }) {
  return (
    <Link 
      href={href} 
      className="h-8 w-8 flex items-center justify-center rounded-full bg-background border hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors"
    >
      <Icon className="h-4 w-4" />
    </Link>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="hover:text-blue-600 transition-colors">
        {children}
      </Link>
    </li>
  );
}