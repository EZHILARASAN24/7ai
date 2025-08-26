'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, MessageSquare, BarChart3, Settings } from 'lucide-react';
import SearchInterface from '@/components/search-interface';
import ChatInterface from '@/components/chat-interface';
import AdminDashboard from '@/components/admin-dashboard';

export default function Home() {
  const [activeTab, setActiveTab] = useState('search');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-8 h-8">
                <img
                  src="/logo.svg"
                  alt="Z.ai Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold">Conversational Search System</h1>
                <p className="text-sm text-muted-foreground">AI-powered search and conversation</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-6">
        <div className="max-w-7xl mx-auto px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 max-w-md">
              <TabsTrigger value="search" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <span>Search</span>
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span>Chat</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span>Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-6">
              <SearchInterface />
            </TabsContent>

            <TabsContent value="chat" className="space-y-6">
              <ChatInterface />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <AdminDashboard />
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Search Settings</CardTitle>
                    <CardDescription>Configure search behavior</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Default Search Type</label>
                      <select className="w-full p-2 border rounded-md">
                        <option value="hybrid">Hybrid Search</option>
                        <option value="web">Web Only</option>
                        <option value="vector">Knowledge Base</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Max Results</label>
                      <input 
                        type="number" 
                        defaultValue="10" 
                        min="1" 
                        max="50"
                        className="w-full p-2 border rounded-md"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Include Citations</label>
                      <select className="w-full p-2 border rounded-md">
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Chat Settings</CardTitle>
                    <CardDescription>Configure chat behavior</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Default Response Length</label>
                      <select className="w-full p-2 border rounded-md">
                        <option value="brief">Brief</option>
                        <option value="detailed">Detailed</option>
                        <option value="comprehensive">Comprehensive</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Default Technical Level</label>
                      <select className="w-full p-2 border rounded-md">
                        <option value="basic">Basic</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Max Conversation History</label>
                      <input 
                        type="number" 
                        defaultValue="50" 
                        min="10" 
                        max="200"
                        className="w-full p-2 border rounded-md"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}