import { FAQ, Features, FinalCTA, Hero, HowItWorks, Pricing, StatsBand, Testimonials } from '../../components/landing/Sections'
import MarketingFooter from '../../components/layout/MarketingFooter'
import MarketingNavbar from '../../components/layout/MarketingNavbar'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

export default function Landing() {
  useDocumentTitle()
  return (
    <div className="min-h-screen bg-white">
      <MarketingNavbar />
      <main>
        <Hero />
        <StatsBand />
        <Features />
        <HowItWorks />
        <Pricing />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <MarketingFooter />
    </div>
  )
}
