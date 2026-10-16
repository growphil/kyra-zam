import { UserRole } from "../middleware/rbac";

type WsConnection = { socket: any; roles: UserRole[] }; 

class WebSocketManager {
  private connections = new Map<string, WsConnection[]>();

  add(userId: string, roles: UserRole[], connection: any) {
    const existing = this.connections.get(userId) ?? [];
    this.connections.set(userId, [...existing, { socket: connection.socket, roles }]);
    console.log(`⚡ [WS] User ${userId} connected. Total active users: ${this.connections.size}`);
  }

  remove(userId: string, connection: any) {
    const existing = this.connections.get(userId) ?? [];
    const filtered = existing.filter(c => c.socket !== connection.socket);
    if (filtered.length === 0) {
      this.connections.delete(userId);
    } else {
      this.connections.set(userId, filtered);
    }
    console.log(`⚡ [WS] Connection closed for user ${userId}. Active users: ${this.connections.size}`);
  }

  getConnectedCount(): number {
    let count = 0;
    for (const conns of this.connections.values()) {
      count += conns.filter(c => c.socket?.readyState === 1).length;
    }
    return count;
  }

  async broadcast(event: string, data: unknown = {}) {
    const msg = JSON.stringify({ 
      event, 
      data, 
      timestamp: new Date().toISOString() 
    });

    for (const conns of this.connections.values()) {
      for (const c of conns) {
        try {
          if (c.socket && c.socket.readyState === 1) {
            c.socket.send(msg);
          }
        } catch (err) {
          // Ignore write failure on dead socket
        }
      }
    }
  }

  async sendToRole(role: UserRole, event: string, data: unknown = {}) {
    const msg = JSON.stringify({ 
      event, 
      data, 
      timestamp: new Date().toISOString() 
    });

    for (const conns of this.connections.values()) {
      for (const c of conns) {
        try {
          if (c.roles.includes(role) && c.socket && c.socket.readyState === 1) {
            c.socket.send(msg);
          }
        } catch (err) {}
      }
    }
  }

  async broadcastToRoles(roles: UserRole[], event: string, data: unknown = {}) {
    const msg = JSON.stringify({ 
      event, 
      data, 
      timestamp: new Date().toISOString() 
    });

    for (const conns of this.connections.values()) {
      for (const c of conns) {
        try {
          const hasMatch = roles.some(r => c.roles.includes(r));
          if (hasMatch && c.socket && c.socket.readyState === 1) {
            c.socket.send(msg);
          }
        } catch (err) {}
      }
    }
  }

  async sendToUser(userId: string, event: string, data: unknown = {}) {
    const msg = JSON.stringify({ 
      event, 
      data, 
      timestamp: new Date().toISOString() 
    });

    for (const c of this.connections.get(userId) ?? []) {
      try {
        if (c.socket && c.socket.readyState === 1) {
          c.socket.send(msg);
        }
      } catch (err) {}
    }
  }

  // Domain-specific broadcast helpers
  async broadcastAdmin(action: string, payload?: any) {
    return this.broadcast("admin:factory:update", { action, ...payload });
  }

  async broadcastInventory(action: string, payload?: any) {
    return this.broadcast("inventory:update", { action, ...payload });
  }

  async broadcastMaterials(action: string, payload?: any) {
    return this.broadcast("materials:update", { action, ...payload });
  }

  async broadcastBOM(action: string, payload?: any) {
    return this.broadcast("bom:update", { action, ...payload });
  }

  async broadcastProduction(action: string, payload?: any) {
    return this.broadcast("production:update", { action, ...payload });
  }

  async broadcastTesting(action: string, payload?: any) {
    return this.broadcast("testing:update", { action, ...payload });
  }

  async broadcastPAX(action: string, payload?: any) {
    return this.broadcast("pax:status_change", { action, ...payload });
  }

  async broadcastCRM(action: string, payload?: any) {
    return this.broadcast("crm:update", { action, ...payload });
  }

  async broadcastSales(action: string, payload?: any) {
    return this.broadcast("sales:update", { action, ...payload });
  }

  async broadcastFinance(action: string, payload?: any) {
    return this.broadcast("finance:update", { action, ...payload });
  }

  async broadcastProcurement(action: string, payload?: any) {
    return this.broadcast("procurement:update", { action, ...payload });
  }

  async broadcastService(action: string, payload?: any) {
    return this.broadcast("service:update", { action, ...payload });
  }

  async broadcastScrap(action: string, payload?: any) {
    return this.broadcast("scrap:update", { action, ...payload });
  }

  async broadcastDispatch(action: string, payload?: any) {
    return this.broadcast("dispatch:update", { action, ...payload });
  }
}

export const wsManager = new WebSocketManager();
