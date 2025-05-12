'use client'


import { ArrowRight, Bell, TrendingUp, Target, FileText } from 'lucide-react';
import NeonGraphBackdrop from './NeonGraphBackdrop';
import Footer from './Footer';
import SupportButton from './SupportButton';
import Link from 'next/link';

export default function HomePage() {
  

  return (
    <div className="relative min-h-screen overflow-hidden bg-black flex flex-col">
      <NeonGraphBackdrop />
      
      <div className="relative z-10 flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center space-y-6 animate-fade-in">
            <div className="relative mb-4">
              <h1 
                className="text-7xl md:text-8xl lg:text-9xl font-bold"
                style={{
                  background: 'linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 0 40px rgba(79, 70, 229, 0.3)',
                  fontFamily: "'Poppins', sans-serif",
                  letterSpacing: '-2px',
                  filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2))',
                  transform: 'translateZ(0)',
                }}
              >
                NOVEX PRO
              </h1>
            </div>
            
            <h2 
              className="text-4xl md:text-5xl lg:text-6xl font-extrabold max-w-4xl mx-auto leading-tight text-gray-200 mb-6"
              style={{
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
              }}
            >
              Empowering Metal Buyers with Real-Time Insights
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto mb-8">
              <FeatureCard
                icon={Bell}
                label="Set custom alerts"
                gradient="from-blue-500/10 to-blue-600/10"
                iconColor="text-blue-500"
                hoverGradient="from-blue-500/20 to-blue-600/20"
              />
              <FeatureCard
                icon={TrendingUp}
                label="Analyze global trends"
                gradient="from-green-500/10 to-green-600/10"
                iconColor="text-green-500"
                hoverGradient="from-green-500/20 to-green-600/20"
              />
              <FeatureCard
                icon={Target}
                label="Optimize procurement"
                gradient="from-indigo-500/10 to-indigo-600/10"
                iconColor="text-indigo-500"
                hoverGradient="from-indigo-500/20 to-indigo-600/20"
              />
              <FeatureCard
                icon={FileText}
                label="Get quotes & manage hedge"
                gradient="from-violet-500/10 to-violet-600/10"
                iconColor="text-violet-500"
                hoverGradient="from-violet-500/20 to-violet-600/20"
              />
            </div>

            <div className="text-center">
              <Link href="/auth/sign-in">
                <button
                  className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xl font-semibold rounded-full hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Get Started 
                  <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-1" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
      <SupportButton />
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ElementType;
  label: string;
  gradient: string;
  iconColor: string;
  hoverGradient: string;
}

function FeatureCard({ icon: Icon, label, gradient, iconColor, hoverGradient }: FeatureCardProps) {
  return (
    <div
      className={`group relative cursor-pointer rounded-xl bg-gradient-to-br ${gradient} 
        backdrop-blur-sm border border-white/10 py-6 px-4
        shadow-sm hover:shadow-xl transition-all duration-500 ease-out
        hover:scale-105 hover:z-10 hover:bg-gradient-to-br ${hoverGradient}
        transform-gpu will-change-transform`}
      style={{
        transformOrigin: 'center center',
        height: '140px',
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className={`p-3 rounded-full bg-white/5 ${iconColor} 
          group-hover:scale-110 transition-transform duration-500 ease-out`}>
          <Icon className="w-6 h-6" />
        </div>
        <span className="text-base font-semibold text-gray-200 text-center group-hover:scale-105 transition-transform duration-500 leading-tight">
          {label}
        </span>
      </div>
    </div>
  );
}