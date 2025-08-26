import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { Label } from '../ui/label'
import { Checkbox } from '../ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { useToast } from '../../hooks/use-toast'
import { Search, Filter, X, Calendar, Tag, Folder, FileText } from 'lucide-react'
import { debounce } from 'lodash'

interface SearchResult {
  id: string
  title: string
  content: string
  status: string
  metadata: any
  createdAt: string
  updatedAt: string
  relevanceScore: number
  highlights: {
    title?: string[]
    content?: string[]
  }
}

interface SearchResponse {
  results: SearchResult[]
  total: number
  facets: {
    status: Record<string, number>
    tags: Record<string, number>
    folders: Record<string, number>
  }
}

interface AdvancedSearchProps {
  onResultSelect?: (result: SearchResult) => void
}

export function AdvancedSearch({ onResultSelect }: AdvancedSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [facets, setFacets] = useState<SearchResponse['facets']>({
    status: {},
    tags: {},
    folders: {}
  })
  const [isSearching, setIsSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  
  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  })
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'title' | 'wordCount'>('relevance')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  const { toast } = useToast()

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string, filters: any) => {
      if (!searchQuery.trim() && Object.keys(filters).length === 0) {
        setResults([])
        setTotal(0)
        return
      }

      setIsSearching(true)
      try {
        const params = new URLSearchParams({
          q: searchQuery,
          sortBy,
          sortOrder,
          limit: '20',
          offset: '0'
        })

        // Add filters
        if (filters.status?.length > 0) {
          filters.status.forEach((status: string) => params.append('status', status))
        }
        if (filters.tags?.length > 0) {
          filters.tags.forEach((tag: string) => params.append('tags', tag))
        }
        if (filters.folderId) {
          params.append('folderId', filters.folderId)
        }
        if (filters.dateRange?.start) {
          params.append('dateStart', filters.dateRange.start)
        }
        if (filters.dateRange?.end) {
          params.append('dateEnd', filters.dateRange.end)
        }

        const response = await fetch(`/api/search/projects?${params}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })

        const result = await response.json()
        if (result.success) {
          setResults(result.data.results)
          setTotal(result.data.total)
          setFacets(result.data.facets)
        } else {
          throw new Error(result.error)
        }
      } catch (error) {
        toast({
          title: 'Search failed',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive'
        })
      } finally {
        setIsSearching(false)
      }
    }, 300),
    [sortBy, sortOrder, toast]
  )

  // Get search suggestions
  const debouncedSuggestions = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setSuggestions([])
        return
      }

      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(searchQuery)}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })

        const result = await response.json()
        if (result.success) {
          setSuggestions(result.data)
        }
      } catch (error) {
        console.error('Failed to get suggestions:', error)
      }
    }, 200),
    []
  )

  // Effect for search
  useEffect(() => {
    const filters = {
      status: selectedStatus,
      tags: selectedTags,
      folderId: selectedFolder || undefined,
      dateRange: (dateRange.start || dateRange.end) ? dateRange : undefined
    }
    
    debouncedSearch(query, filters)
  }, [query, selectedStatus, selectedTags, selectedFolder, dateRange, sortBy, sortOrder, debouncedSearch])

  // Effect for suggestions
  useEffect(() => {
    debouncedSuggestions(query)
  }, [query, debouncedSuggestions])

  const handleStatusFilter = (status: string, checked: boolean) => {
    if (checked) {
      setSelectedStatus([...selectedStatus, status])
    } else {
      setSelectedStatus(selectedStatus.filter(s => s !== status))
    }
  }

  const handleTagFilter = (tag: string, checked: boolean) => {
    if (checked) {
      setSelectedTags([...selectedTags, tag])
    } else {
      setSelectedTags(selectedTags.filter(t => t !== tag))
    }
  }

  const clearFilters = () => {
    setSelectedStatus([])
    setSelectedTags([])
    setSelectedFolder('')
    setDateRange({ start: '', end: '' })
  }

  const renderHighlightedText = (text: string, highlights?: string[]) => {
    if (!highlights || highlights.length === 0) {
      return <span>{text}</span>
    }

    // Use the first highlight
    const highlighted = highlights[0]
    return <span dangerouslySetInnerHTML={{ __html: highlighted }} />
  }

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search projects, content, conversations..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
            
            {/* Search Suggestions */}
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 mt-1">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                    onClick={() => {
                      setQuery(suggestion)
                      setSuggestions([])
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </span>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Filter */}
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <div className="space-y-2 mt-2">
                  {Object.entries(facets.status).map(([status, count]) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status}`}
                        checked={selectedStatus.includes(status)}
                        onCheckedChange={(checked) => handleStatusFilter(status, checked as boolean)}
                      />
                      <Label htmlFor={`status-${status}`} className="text-sm">
                        {status} ({count})
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Tags Filter */}
              <div>
                <Label className="text-sm font-medium">Tags</Label>
                <div className="space-y-2 mt-2">
                  {Object.entries(facets.tags).map(([tag, count]) => (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tag-${tag}`}
                        checked={selectedTags.includes(tag)}
                        onCheckedChange={(checked) => handleTagFilter(tag, checked as boolean)}
                      />
                      <Label htmlFor={`tag-${tag}`} className="text-sm">
                        {tag} ({count})
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Date Range */}
              <div>
                <Label className="text-sm font-medium">Date Range</Label>
                <div className="space-y-2 mt-2">
                  <Input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    placeholder="Start date"
                  />
                  <Input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    placeholder="End date"
                  />
                </div>
              </div>

              <Separator />

              {/* Sort Options */}
              <div>
                <Label className="text-sm font-medium">Sort By</Label>
                <div className="space-y-2 mt-2">
                  <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="date">Date Modified</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="wordCount">Word Count</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Descending</SelectItem>
                      <SelectItem value="asc">Ascending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Results */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  Search Results {total > 0 && `(${total})`}
                </span>
                {isSearching && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {query ? 'No results found' : 'Enter a search query to get started'}
                </div>
              ) : (
                <div className="space-y-4">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => onResultSelect?.(result)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-lg">
                            {renderHighlightedText(result.title, result.highlights.title)}
                          </h3>
                          
                          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                            <Badge variant="secondary">{result.status}</Badge>
                            <span>•</span>
                            <span>{result.metadata.wordCount} words</span>
                            <span>•</span>
                            <span>{new Date(result.updatedAt).toLocaleDateString()}</span>
                          </div>

                          {result.highlights.content && result.highlights.content.length > 0 && (
                            <div className="mt-2 text-sm text-gray-600">
                              {result.highlights.content.map((snippet, index) => (
                                <p key={index} dangerouslySetInnerHTML={{ __html: snippet }} />
                              ))}
                            </div>
                          )}

                          {result.metadata.tags && result.metadata.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {result.metadata.tags.map((tag: string) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  <Tag className="h-3 w-3 mr-1" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right text-sm text-gray-500">
                          <div>Score: {result.relevanceScore.toFixed(1)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}