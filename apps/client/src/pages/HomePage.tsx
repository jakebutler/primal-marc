import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Primal Marc
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          AI-powered writing assistant with canvas-based collaborative interface
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Button size="lg">
            Get Started
          </Button>
          <Button variant="outline" size="lg">
            Learn More
          </Button>
        </div>
      </div>
    </div>
  )
}