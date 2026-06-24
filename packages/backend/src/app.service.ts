import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {

  getHealth(form: 'hello' | 'health'): { status: string; timestamp: string, message: string } {
    return { 
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: form === 'hello' ? 'Hello, World!' : 'Server is running healthy',
    }
  }
}