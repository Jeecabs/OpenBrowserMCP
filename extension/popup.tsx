/**
 * Popup UI
 *
 * React component for the extension popup showing connection status,
 * tab info, and connect/disconnect controls.
 */

import { useState, useEffect } from "react";
import "./popup.css";

interface State {
  connectionState: "disconnected" | "connecting" | "connected";
  connectedTabId: number | null;
  wsUrl: string;
  connectionStartTime: number | null;
  messagesReceived: number;
  messagesSent: number;
}

interface TabInfo {
  title: string;
  url: string;
}

export default function Popup() {
  const [state, setState] = useState<State>({
    connectionState: "disconnected",
    connectedTabId: null,
    wsUrl: "ws://localhost:9222",
    connectionStartTime: null,
    messagesReceived: 0,
    messagesSent: 0
  });

  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null);
  const [uptime, setUptime] = useState<string>("0s");
  const [error, setError] = useState<string | null>(null);

  // Load initial state
  useEffect(() => {
    loadState();
    loadTabInfo();

    // Listen for state updates from background
    const messageListener = (message: any) => {
      if (message.type === "STATE_UPDATE") {
        setState(message.state);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  // Update uptime periodically
  useEffect(() => {
    if (state.connectionStartTime) {
      const interval = setInterval(() => {
        const elapsed = Date.now() - state.connectionStartTime!;
        setUptime(formatUptime(elapsed));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [state.connectionStartTime]);

  // Load state from background
  async function loadState() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
      setState(response);
    } catch (err) {
      console.error("Failed to load state:", err);
    }
  }

  // Load current tab info
  async function loadTabInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        setTabInfo({
          title: tab.title || "Unknown",
          url: tab.url || "Unknown"
        });
      }
    } catch (err) {
      console.error("Failed to load tab info:", err);
    }
  }

  // Connect to server
  async function connect() {
    try {
      setError(null);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        setError("No active tab");
        return;
      }

      await chrome.runtime.sendMessage({
        type: "CONNECT",
        tabId: tab.id,
        wsUrl: state.wsUrl
      });

      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // Disconnect from server
  async function disconnect() {
    try {
      setError(null);
      await chrome.runtime.sendMessage({ type: "DISCONNECT" });
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // Format uptime duration
  function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Get status badge component
  function getStatusBadge() {
    const statusConfig = {
      connected: { color: "#4ade80", label: "Connected" },
      connecting: { color: "#fbbf24", label: "Connecting..." },
      disconnected: { color: "#94a3b8", label: "Disconnected" }
    };

    const config = statusConfig[state.connectionState];

    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: config.color
          }}
        />
        <span style={{ fontWeight: 500 }}>{config.label}</span>
      </div>
    );
  }

  return (
    <div className="popup">
      <div className="header">
        <h1>Browser MCP</h1>
      </div>

      <div className="content">
        <div className="section">
          <label>Status</label>
          {getStatusBadge()}
        </div>

        {tabInfo && (
          <div className="section">
            <label>Tab</label>
            <div className="tab-info">
              <div className="tab-title">{tabInfo.title}</div>
              <div className="tab-url">{tabInfo.url}</div>
            </div>
          </div>
        )}

        {state.connectionState === "connected" && state.connectionStartTime && (
          <div className="section">
            <label>Connected</label>
            <div>{uptime} ago</div>
          </div>
        )}

        <div className="section">
          <label>Server</label>
          <div className="server-url">{state.wsUrl}</div>
        </div>

        {state.connectionState === "connected" && (
          <div className="section">
            <label>Messages</label>
            <div className="message-stats">
              <span>{state.messagesReceived} ↓</span>
              <span>{state.messagesSent} ↑</span>
            </div>
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <div className="actions">
          {state.connectionState === "connected" ? (
            <button onClick={disconnect} className="button button-disconnect">
              Disconnect
            </button>
          ) : (
            <button
              onClick={connect}
              className="button button-connect"
              disabled={state.connectionState === "connecting"}
            >
              {state.connectionState === "connecting" ? "Connecting..." : "Connect"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
