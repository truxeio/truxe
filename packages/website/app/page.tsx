import { Header } from "@/components/sections/Header";
import { Hero } from "@/components/sections/Hero";
import { QuickBenefits } from "@/components/sections/QuickBenefits";
import { Problem } from "@/components/sections/Problem";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Features } from "@/components/sections/Features";
import { Comparison } from "@/components/sections/Comparison";
import { Architecture } from "@/components/sections/Architecture";
import { UseCases } from "@/components/sections/UseCases";
import { Pricing } from "@/components/sections/Pricing";
import { FAQ } from "@/components/sections/FAQ";
import { Waitlist } from "@/components/sections/Waitlist";
import { Footer } from "@/components/sections/Footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col gap-10 bg-gradient-to-b from-white via-white to-primary-light/20">
        <Hero />
        <QuickBenefits />
        <Problem />
        <HowItWorks />
        <Features />
        <Comparison />
        <Architecture />
        <UseCases />
        <Pricing />
        <FAQ />
        <Waitlist />
      </main>
      <Footer />
    </div>
  );
}
