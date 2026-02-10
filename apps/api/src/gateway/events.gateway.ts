import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service'; // Để verify token trong handshake

@WebSocketGateway({
  cors: {
    origin: '*', // Demo: Allow all (Production nên set cụ thể)
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('EventsGateway');

  constructor(private authService: AuthService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Initialized');
  }

  async handleConnection(client: Socket, ...args: any[]) {
    try {
      // 1. Extract Token from Handshake Auth
      const token = client.handshake.auth.token || client.handshake.headers.authorization;
      if (!token) {
        // Allow anonymous for public dashboard demo if needed, else disconnect
        // client.disconnect();
        return;
      }
      
      // 2. Verify Token & Get User (Simplified)
      // Trong thực tế, decode JWT và lấy userId/companyId/role
      // client.join(`user:${userId}`);
      // client.join(`company:${companyId}`);
      
      this.logger.log(`Client connected: ${client.id}`);
    } catch (e) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // --- Broadcast Methods ---

  emit(event: string, payload: any) {
    this.server.emit(event, payload); // Broadcast to ALL (Simple Demo)
  }

  emitToUser(userId: string, event: string, payload: any) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitToCompany(companyId: string, event: string, payload: any) {
    this.server.to(`company:${companyId}`).emit(event, payload);
  }
}