import React, { useState, useEffect, useCallback, use } from 'react';
import { Copy, Trash2, RefreshCw, Globe, Clock, Database, Eye, EyeOff, Rocket } from 'lucide-react';
import { useWebhookWS } from './Webhook';
import Swal from 'sweetalert2';
import.meta.env.VITE_API_URL;
import.meta.env.VITE_WEBSOCKET_URL;

// UUID v7 generator
const generateUUIDv7 = () => {
  const timestamp = Date.now();
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${timestampHex.slice(0, 8)}-${timestampHex.slice(8, 12)}-7${randomHex.slice(0, 3)}-${randomHex.slice(3, 4)}${randomHex.slice(4, 7)}-${randomHex.slice(7, 19)}`;
};

interface WebhookData {
  id: string;
  timestamp: number;
  method: string;
  headers: Record<string, string>;
  body: any;
  queryParams: Record<string, string>;
  userAgent: string;
  ip: string;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  createdAt: number;
  requests: WebhookData[];
}

const WebhookSite: React.FC = () => {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<WebhookData | null>(null);
  const [showRequestDetails, setShowRequestDetails] = useState(false);
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/";
  const { endpoints: endpoint, callbacks } = useWebhookWS("ws://" + import.meta.env.VITE_WEBSOCKET_URL || "localhost:8080/ws");

  // Load data from memory on component mount
  useEffect(() => {
    let browserId = localStorage.getItem('BrowserID');
    if (!browserId) {
      browserId = generateUUIDv7();
      localStorage.setItem('BrowserID', browserId);
    }
    
    fetch(baseUrl + 'api/endpoints?browserId=' + browserId)
    .then(async response => {
      let savedEndpoints = await response.json();

      if (!savedEndpoints) {
        savedEndpoints = [];
      }
      console.log('Loaded endpoints:', savedEndpoints);
      setEndpoints(savedEndpoints);

      if (savedEndpoints.length > 0) {
        setActiveEndpoint(savedEndpoints[0].id);
      }
    }).catch(() => []).finally(() => {
      console.log('Endpoints loaded from server');
    });
  }, []);

  // Update endpoints from WebSocket messages
  useEffect(() => {
    console.log('WebSocket endpoints update:', endpoint);
    if (endpoint.length > 0) {
      console.log('New endpoint received:', endpoint);
      setEndpoints(prev => [...endpoint, ...prev]);
      if (!activeEndpoint && endpoint.length > 0) {
        setActiveEndpoint(endpoint[0].id);
      }
    }
  }, [endpoint]);

  useEffect(() => {
    console.log('WebSocket callbacks update:', callbacks);
    if (callbacks.length > 0) {
      console.log('New callback received:', callbacks);
      setEndpoints(prev => prev.map(endpoint => {
        if (endpoint.id === callbacks[0].endpointId) {
          return {
            ...endpoint,
            requests: [callbacks[0], ...endpoint.requests]
          };
        }
        return endpoint;
      }));
    }
  }, [callbacks]);

  // Poll for new requests for the active endpoint every 2 seconds
  useEffect(() => {
    if (!activeEndpoint) return;

    let browserId = localStorage.getItem('BrowserID');
    if (!browserId) return;

    const fetchRequests = () => {
      fetch(baseUrl + `api/endpoints/${activeEndpoint}/data`)
        .then(async response => {
          if (!response.ok) return;
          const data = await response.json();
          setEndpoints(prevEndpoints =>
            prevEndpoints.map(endpoint =>
              endpoint.id === activeEndpoint
                ? { ...endpoint, requests: data.requests }
                : endpoint
            )
          );
        })
        .catch(() => {});
    };

    fetchRequests();
  }, [activeEndpoint, callbacks]);

  const createEndpoint = async () => {
    setIsCreating(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    await fetch(baseUrl + 'api/endpoints', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        browserId: localStorage.getItem('BrowserID'),
        customId: customUrl.trim() || undefined,
      }),
    }).then(async response => {
      if (!response.ok) {
        throw new Error(await response.text());
      }

    }).catch(error => {
      console.log(error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Failed to create endpoint',
        timer: 3000,
        showConfirmButton: false,
        position: 'top-end',
        toast: true,
      });
      console.error('Error creating endpoint:', error);
      setIsCreating(false);
      return null;
    }).finally(() => {
      setIsCreating(false);
      setCustomUrl('');
    });
  };

  const deleteEndpoint = async (id: string) => {
    let browserId = localStorage.getItem('BrowserID');
    if (!browserId) return;

    await fetch(baseUrl + `api/endpoints/${id}?browserId=${browserId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(response => {
      if (!response.ok) {
        throw new Error('Failed to delete endpoint');
      }

      setEndpoints(prev => prev.filter(endpoint => endpoint.id !== id));
      if (activeEndpoint === id) {
        const remaining = endpoints.filter(endpoint => endpoint.id !== id);
        setActiveEndpoint(remaining.length > 0 ? remaining[0].id : null);
      }
    }).catch(error => {
      console.error('Error deleting endpoint:', error);
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatJsonPreview = (obj: any) => {
    const str = JSON.stringify(obj, null, 2);
    return str.length > 100 ? str.substring(0, 100) + '...' : str;
  };

  const activeEndpointData = endpoints.find(e => e.id === activeEndpoint);

  return (
    <div className="min-h-screen min-w-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h4 className='text-4xl font-bold text-white '>Wazzi</h4>
          <h1 className="text-5xl font-bold text-white mb-4">
            <span className="text-purple-400">Webhook Tools</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Instantly test webhooks and HTTP requests with custom URLs. 
            Receive, inspect, and debug webhook data in real-time.
          </p>
        </div>

        {/* Create Endpoint Section */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mb-8 border border-white/20">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-3">
            <Globe className="w-6 h-6 text-purple-400" />
            Create Your Webhook URL
          </h2>
          
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Enter custom URL path (optional)"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-400 mt-2">
                Leave empty to generate a random UUID v7
              </p>
            </div>
            <button
              onClick={() => createEndpoint()}
              disabled={isCreating}
              className="px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-12 justify-center"
            >
              {isCreating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                Create
                <Rocket className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Endpoints List */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-400" />
                Your Endpoints ({endpoints.length})
              </h3>
              
              {endpoints.length === 0 ? (
                <p className="text-gray-400 text-center py-8">
                  No endpoints created yet
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {endpoints.map((endpoint) => (
                    <div
                      key={endpoint.id}
                      className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                        activeEndpoint === endpoint.id
                          ? 'bg-purple-600/30 border border-purple-400/50'
                          : 'bg-white/5 hover:bg-white/10 border border-white/10'
                      }`}
                      onClick={() => setActiveEndpoint(endpoint.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-mono text-sm truncate">
                          {endpoint.id}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEndpoint(endpoint.id);
                          }}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          {endpoint?.requests?.length ?? 0} requests
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(endpoint.url, endpoint.id);
                          }}
                          className="text-purple-400 hover:text-purple-300 p-1"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      {copiedId === endpoint.id && (
                        <p className="text-xs text-green-400 mt-1">Copied!</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Request Details */}
          <div className="lg:col-span-2">
            {activeEndpointData ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-purple-400" />
                    Requests for {activeEndpointData.id}
                  </h3>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400">
                      URL: {activeEndpointData.url}
                    </span>
                    <button
                      onClick={() => copyToClipboard(activeEndpointData.url, 'url')}
                      className="text-purple-400 hover:text-purple-300 p-1"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {!activeEndpointData.requests || activeEndpointData.requests?.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Globe className="w-8 h-8 text-purple-400" />
                    </div>
                    <p className="text-gray-400 mb-2">Waiting for requests...</p>
                    <p className="text-sm text-gray-500">
                      Send a HTTP request to your webhook URL to see it here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {activeEndpointData.requests?.map((request) => (
                      <div
                        key={request.id}
                        className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all duration-200 cursor-pointer"
                        onClick={() => {
                          setSelectedRequest(request);
                          setShowRequestDetails(true);
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              request.method === 'POST' ? 'bg-green-600/20 text-green-400' :
                              request.method === 'GET' ? 'bg-blue-600/20 text-blue-400' :
                              request.method === 'PUT' ? 'bg-yellow-600/20 text-yellow-400' :
                              request.method === 'DELETE' ? 'bg-red-600/20 text-red-400' :
                              'bg-gray-600/20 text-gray-400'
                            }`}>
                              {request.method}
                            </span>
                            <span className="text-white text-sm">
                              {formatTimestamp(request.timestamp)}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">{request.ip}</span>
                        </div>
                        <div className="text-sm text-gray-300">
                          <pre className="bg-black/20 p-2 rounded text-xs overflow-hidden">
                            {formatJsonPreview(request.body)}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 border border-white/20 text-center">
                <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Database className="w-8 h-8 text-purple-400" />
                </div>
                <p className="text-gray-400 mb-2">No endpoint selected</p>
                <p className="text-sm text-gray-500">
                  Create or select an endpoint to view requests
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Request Details Modal */}
        {showRequestDetails && selectedRequest && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-purple-400" />
                  Request Details
                </h3>
                <button
                  onClick={() => setShowRequestDetails(false)}
                  className="text-gray-400 hover:text-white p-2"
                >
                  <EyeOff className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Overview</h4>
                  <div className="bg-black/20 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Method:</span>
                      <span className="text-white font-mono">{selectedRequest.method}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Timestamp:</span>
                      <span className="text-white font-mono">{formatTimestamp(selectedRequest.timestamp)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">IP Address:</span>
                      <span className="text-white font-mono">{selectedRequest.ip}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">User Agent:</span>
                      <span className="text-white font-mono text-sm">{selectedRequest.userAgent}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Headers</h4>
                  <pre className="bg-black/20 rounded-xl p-4 text-sm text-gray-300 overflow-x-auto">
                    {JSON.stringify(selectedRequest.headers, null, 2)}
                  </pre>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Query Parameters</h4>
                  <pre className="bg-black/20 rounded-xl p-4 text-sm text-gray-300 overflow-x-auto">
                    {JSON.stringify(selectedRequest.queryParams, null, 2)}
                  </pre>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Body</h4>
                  <pre className="bg-black/20 rounded-xl p-4 text-sm text-gray-300 overflow-x-auto">
                    {JSON.stringify(selectedRequest.body, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebhookSite;