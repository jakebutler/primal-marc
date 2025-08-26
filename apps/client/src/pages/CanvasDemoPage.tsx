import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CanvasChat } from '@/components/canvas/CanvasChat'
import { MessageCircle, Lightbulb, FileText, Image, CheckCircle } from 'lucide-react'

export const CanvasDemoPage: React.FC = () => {
  const [activeAgent, setActiveAgent] = useState<string>('ideation')
  const [conversationId] = useState(() => `demo-conversation-${Date.now()}`)
  const [projectId] = useState(() => `demo-project-${Date.now()}`)

  const agents = [
    {
      id: 'ideation',
      name: 'Ideation Agent',
      description: 'Brainstorm ideas and structure concepts',
      icon: <Lightbulb className="h-4 w-4" />,
      color: 'bg-yellow-500'
    },
    {
      id: 'refiner',
      name: 'Draft Refiner',
      description: 'Improve structure and writing style',
      icon: <FileText className="h-4 w-4" />,
      color: 'bg-blue-500'
    },
    {
      id: 'media',
      name: 'Media Assistant',
      description: 'Create visuals, memes, and charts',
      icon: <Image className="h-4 w-4" />,
      color: 'bg-purple-500'
    },
    {
      id: 'factchecker',
      name: 'Fact Checker',
      description: 'Verify facts and optimize for SEO',
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'bg-green-500'
    }
  ]

  const activeAgentInfo = agents.find(agent => agent.id === activeAgent)

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Canvas Chat Interface Demo</h1>
        <p className="text-muted-foreground">
          Experience real-time collaboration with AI agents in the canvas interface
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Selection */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                AI Agents
              </CardTitle>
              <CardDescription>
                Choose an AI agent to collaborate with
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    activeAgent === agent.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => setActiveAgent(agent.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${agent.color} flex items-center justify-center text-white`}>
                      {agent.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-sm">{agent.name}</h3>
                      <p className="text-xs text-muted-foreground">{agent.description}</p>
                    </div>
                    {activeAgent === agent.id && (
                      <Badge variant="default" className="text-xs">Active</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Features */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Real-time messaging
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Message streaming
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Typing indicators
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Connection status
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Mobile responsive
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Minimize/maximize
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chat Interface */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {activeAgentInfo?.icon}
                {activeAgentInfo?.name}
              </CardTitle>
              <CardDescription>
                {activeAgentInfo?.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <CanvasChat
                  conversationId={`${conversationId}-${activeAgent}`}
                  projectId={projectId}
                  agentType={activeAgent}
                  title={activeAgentInfo?.name || 'AI Assistant'}
                  className="w-full max-w-md"
                />
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">How to Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">1</div>
                <div>
                  <h4 className="font-medium">Select an Agent</h4>
                  <p className="text-sm text-muted-foreground">Choose from the four specialized AI agents on the left</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">2</div>
                <div>
                  <h4 className="font-medium">Start Chatting</h4>
                  <p className="text-sm text-muted-foreground">Type your message in the chat interface and press Enter or click Send</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">3</div>
                <div>
                  <h4 className="font-medium">Watch the Magic</h4>
                  <p className="text-sm text-muted-foreground">See real-time responses, typing indicators, and connection status</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}