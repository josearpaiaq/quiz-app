import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {

  getHealth(): { status: string; timestamp: string, message: string } {
    return { 
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Server is running',
    }
  }
}